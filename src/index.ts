import fs from 'fs';
import path from 'path';
import { logger, LogLevel } from './utils/logger';
import { PerformanceMonitor } from './utils/performance';
import { ValidationError, handleError } from './utils/errors';
import { validateProjectStructure, validateAnalysisOptions, validateProjectPath } from './utils/validation';
import { ConfigManager, OptimizerConfig } from './utils/config';

// Initialize global instances
const performanceMonitor = new PerformanceMonitor();

// React Native Optimizer Plugin API
export interface UnusedImport {
	file: string;
	imports: string[];
	line?: number;
}

export interface FileStats {
	path: string;
	size: number;
	lines: number;
}

export interface ProjectStats {
	totalFiles: number;
	totalLines: number;
	totalSize: number;
	analysisTime: number;
}

export interface OptimizerResult {
	success: boolean;
	projectPath: string;
	projectType: 'react-native' | 'node' | 'unknown';
	projectStats: ProjectStats;
	unusedImports: UnusedImport[];
	unusedFiles: FileStats[];
	buildAnalysis?: import('./buildAnalyzer').BuildAnalysisResult;
	packageAnalysis?: import('./packageAnalyzer').PackageAnalysisResult;
	issues: string[];
	suggestions: string[];
	reportGeneratedAt: Date;
	performanceMetrics?: Record<string, any>;
	configUsed?: OptimizerConfig;
	validationResult?: import('./utils/validation').ProjectValidationResult;
}

import { runAnalysis } from './analyze';
import { generateHtmlReport } from './htmlReport';
import { analyzeBuild, BuildAnalysisResult } from './buildAnalyzer';
import { analyzePackages, PackageAnalysisResult, ProgressCallback, ProgressInfo } from './packageAnalyzer';
import { getSourceFiles } from './unusedImports';

function detectProjectType(projectPath: string): 'react-native' | 'node' | 'unknown' {
	performanceMonitor.start('detectProjectType');
	try {
		const packageJsonPath = path.join(projectPath, 'package.json');
		if (!fs.existsSync(packageJsonPath)) {
			logger.debug('No package.json found, cannot determine project type');
			return 'unknown';
		}

		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
		
		// Check for React Native
		if (deps['react-native'] || deps['@react-native/cli'] || deps['expo'] || 
			deps['@expo/cli'] || deps['@react-native-community/cli']) {
			logger.debug('Detected React Native project from dependencies');
			return 'react-native';
		}
		
		// Check for RN config files
		const rnFiles = ['metro.config.js', 'metro.config.ts', 'react-native.config.js', 'app.json'];
		for (const file of rnFiles) {
			if (fs.existsSync(path.join(projectPath, file))) {
				logger.debug(`Detected React Native project from ${file}`);
				return 'react-native';
			}
		}
		
		// Check for RN directories
		const rnDirs = ['android', 'ios'];
		for (const dir of rnDirs) {
			if (fs.existsSync(path.join(projectPath, dir))) {
				logger.debug(`Detected React Native project from ${dir} directory`);
				return 'react-native';
			}
		}
		
		// Check for Node.js
		if (packageJson.main || packageJson.bin || packageJson.scripts?.start || packageJson.type === 'module') {
			logger.debug('Detected Node.js project');
			return 'node';
		}
		
		logger.debug('Could not determine project type');
		performanceMonitor.end('detectProjectType');
		return 'unknown';
	} catch (error) {
		logger.warn('Error detecting project type:', error);
		performanceMonitor.end('detectProjectType');
		return 'unknown';
	} finally {
		performanceMonitor.end('detectProjectType');
	}
}

function getFileStats(filePath: string, projectPath?: string): FileStats {
	const stats = fs.statSync(filePath);
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n').length;
	return {
		path: projectPath ? path.relative(projectPath, filePath) : filePath,
		size: stats.size,
		lines
	};
}

export interface OptimizeProjectOptions {
	includeBuildAnalysis?: boolean;
	includePackageAnalysis?: boolean;
	config?: Partial<OptimizerConfig>;
	verbose?: boolean;
}

export async function optimizeProject(
	projectPath: string, 
	options: OptimizeProjectOptions = {},
	progressCallback?: ProgressCallback
): Promise<OptimizerResult> {
	performanceMonitor.start('optimizeProject');
	const startTime = Date.now();
	
	try {
		// Input validation
		validateProjectPath(projectPath);
		validateAnalysisOptions(options);
		
		// Set verbose logging if requested
		if (options.verbose) {
			logger.setLevel(LogLevel.DEBUG);
		}
		
		logger.info(`Starting analysis of project: ${projectPath}`);
		
		// Load configuration
		const configManager = await ConfigManager.loadFromProject(projectPath);
		if (options.config) {
			configManager.update(options.config);
		}
		const config = configManager.get();
		
		// Validate project structure
		const validationResult = await validateProjectStructure(projectPath);
		if (!validationResult.isValid) {
			throw new ValidationError(`Project validation failed: ${validationResult.errors.join(', ')}`);
		}
		
		// Show warnings if any
		if (validationResult.warnings.length > 0) {
			validationResult.warnings.forEach(warning => logger.warn(warning));
		}
		
		const projectType = validationResult.projectType;
		logger.info(`Detected project type: ${projectType}`);
		
		// Set default values with config overrides
		const {
			includeBuildAnalysis = config.buildAnalysis.enabled,
			includePackageAnalysis = config.packageAnalysis.enabled
		} = options;
		
		// Track total modules for progress calculation
		const totalModules = 8;
		let currentModule = 0;
		
		const updateProgress = (
			module: 'initialization' | 'source-scan' | 'unused-imports' | 'unused-files' | 'package-analysis' | 'framework-detection' | 'deprecated-check' | 'finalization' | 'project-stats', 
			stage: string, 
			percentage: number = 0, 
			current: number = 0, 
			total: number = 0, 
			currentItem?: string
		) => {
			if (progressCallback) {
				const overallPercentage = Math.round(((currentModule + percentage / 100) / totalModules) * 100);
				progressCallback({
					module: module === 'project-stats' ? 'finalization' : module, // Map project-stats to finalization
					stage,
					current,
					total,
					percentage: overallPercentage,
					currentItem,
					timeElapsed: Math.round((Date.now() - startTime) / 1000),
					estimatedTimeRemaining: overallPercentage > 0 ? Math.round(((Date.now() - startTime) / (overallPercentage / 100) - (Date.now() - startTime)) / 1000) : undefined,
					moduleProgress: {
						currentModule: currentModule + 1,
						totalModules,
						modulePercentage: Math.round(percentage)
					}
				});
			}
		};

		// Module 1: Initialization
		currentModule = 0;
		updateProgress('initialization', 'Initializing project analysis...', 100);
		
		// Module 2: Source Scanning
		currentModule = 1;
		updateProgress('source-scan', 'Scanning source files...', 0);
		performanceMonitor.start('codeAnalysis');
		const allFiles = getSourceFiles(projectPath);
		updateProgress('source-scan', 'Found source files', 50, allFiles.length, allFiles.length);
		
		const { unusedImports: unusedImportsReport, unusedFiles } = await runAnalysis(projectPath);
		updateProgress('source-scan', 'Source analysis complete', 100);
		performanceMonitor.end('codeAnalysis');
		
		// Module 3: Import Analysis  
		currentModule = 2;
		updateProgress('unused-imports', 'Analyzing unused imports...', 0);
		const unusedImports: UnusedImport[] = unusedImportsReport.map(report => {
			const [file, imports] = report.split(': ');
			return {
				file,
				imports: imports.split(', ')
			};
		});
		updateProgress('unused-imports', 'Import analysis complete', 100, unusedImports.length, unusedImports.length);
		
		// Module 4: File Analysis
		currentModule = 3; 
		updateProgress('unused-files', 'Analyzing unused files...', 0);
		const unusedFileStats: FileStats[] = unusedFiles.map(file => {
			const fullPath = path.resolve(projectPath, file);
			return getFileStats(fullPath, projectPath);
		});
		updateProgress('unused-files', 'File analysis complete', 100, unusedFiles.length, unusedFiles.length);
		
		// Module 5: Project Statistics
		currentModule = 4;
		updateProgress('project-stats', 'Calculating project statistics...', 0);
		performanceMonitor.start('projectStats');
		let totalLines = 0;
		let totalSize = 0;
		
		for (let i = 0; i < allFiles.length; i++) {
			try {
				const file = allFiles[i];
				const fullPath = path.resolve(projectPath, file);
				const stats = getFileStats(fullPath, projectPath);
				totalLines += stats.lines;
				totalSize += stats.size;
				updateProgress('project-stats', 'Calculating statistics...', (i / allFiles.length) * 100, i + 1, allFiles.length, file);
			} catch (e) {
				// Skip files that can't be read
				logger.debug(`Skipping unreadable file: ${allFiles[i]}`);
			}
		}
		performanceMonitor.end('projectStats');
		updateProgress('project-stats', 'Statistics complete', 100);
		
		// Module 6: Build Analysis
		currentModule = 5;
		let buildAnalysis: BuildAnalysisResult | undefined;
		if (includeBuildAnalysis) {
			updateProgress('framework-detection', 'Analyzing build configuration...', 0);
			performanceMonitor.start('buildAnalysis');
			try {
				const buildResult = await analyzeBuild(projectPath);
				buildAnalysis = buildResult || undefined;
				updateProgress('framework-detection', 'Build analysis complete', 100);
			} catch (error) {
				const optimizerError = handleError(error, 'buildAnalysis');
				logger.warn('Build analysis failed:', optimizerError.message);
				updateProgress('framework-detection', 'Build analysis skipped', 100);
			} finally {
				performanceMonitor.end('buildAnalysis');
			}
		} else {
			updateProgress('framework-detection', 'Build analysis skipped', 100);
		}
		
		// Module 7: Package Analysis 
		currentModule = 6;
		let packageAnalysis: PackageAnalysisResult | undefined;
		if (includePackageAnalysis) {
			performanceMonitor.start('packageAnalysis');
			try {
				// Create a wrapper callback that updates the current module
				const packageProgressCallback = progressCallback ? (progress: ProgressInfo) => {
					const updatedProgress = {
						...progress,
						moduleProgress: progress.moduleProgress ? {
							...progress.moduleProgress,
							currentModule: currentModule + 1,
							totalModules
						} : undefined
					};
					progressCallback(updatedProgress);
				} : undefined;
				
				packageAnalysis = await analyzePackages(projectPath, packageProgressCallback);
			} catch (error) {
				const optimizerError = handleError(error, 'packageAnalysis');
				logger.warn('Package analysis failed:', optimizerError.message);
				updateProgress('package-analysis', 'Package analysis failed', 100);
			} finally {
				performanceMonitor.end('packageAnalysis');
			}
		} else {
			updateProgress('package-analysis', 'Package analysis skipped', 100);
		}
		
		// Module 8: Finalization
		currentModule = 7;
		updateProgress('finalization', 'Finalizing analysis...', 100);
		
		const analysisTime = Date.now() - startTime;
		
		// Generate suggestions
		const suggestions: string[] = [];
		if (unusedImports.length > 0) {
			suggestions.push(`Remove ${unusedImports.length} unused import(s) to clean up your code`);
		}
		if (unusedFiles.length > 0) {
			const totalUnusedSize = unusedFileStats.reduce((sum, file) => sum + file.size, 0);
			suggestions.push(`Delete ${unusedFiles.length} unused file(s) to save ${(totalUnusedSize / 1024).toFixed(1)}KB`);
		}
		
		// Add build-specific suggestions
		if (buildAnalysis) {
			suggestions.push(...buildAnalysis.suggestions);
		}
		
		// Add package-specific suggestions
		if (packageAnalysis) {
			suggestions.push(...packageAnalysis.suggestions);
		}
		
		// Add positive feedback if everything is clean
		if (suggestions.length === 0) {
			suggestions.push('✅ Excellent! Your project is well optimized with no issues detected.');
		}
		
		const performanceMetrics = performanceMonitor.getAllMetrics();
		
		logger.info(`Analysis completed successfully in ${analysisTime}ms`);
		
		return {
			success: true,
			projectPath,
			projectType,
			projectStats: {
				totalFiles: allFiles.length,
				totalLines,
				totalSize,
				analysisTime
			},
			unusedImports,
			unusedFiles: unusedFileStats,
			buildAnalysis,
			packageAnalysis,
			issues: [],
			suggestions,
			reportGeneratedAt: new Date(),
			performanceMetrics,
			configUsed: config,
			validationResult
		};
		
	} catch (error) {
		const optimizerError = handleError(error, 'optimizeProject');
		logger.error('Project optimization failed:', optimizerError);
		
		return {
			success: false,
			projectPath,
			projectType: 'unknown',
			projectStats: {
				totalFiles: 0,
				totalLines: 0,
				totalSize: 0,
				analysisTime: Date.now() - startTime
			},
			unusedImports: [],
			unusedFiles: [],
			issues: [optimizerError.message],
			suggestions: ['Please check your project structure and try again'],
			reportGeneratedAt: new Date(),
			performanceMetrics: performanceMonitor.getAllMetrics()
		};
	} finally {
		performanceMonitor.end('optimizeProject');
	}
}

// Generate and optionally open HTML report
export async function generateReport(projectPath: string, options: {
	outputPath?: string;
	openInBrowser?: boolean;
} = {}): Promise<{ result: OptimizerResult; htmlPath: string }> {
	const result = await optimizeProject(projectPath);
	const htmlPath = generateHtmlReport(result, projectPath, options.outputPath);
	
	if (options.openInBrowser) {
		const { exec } = require('child_process');
		const command = process.platform === 'darwin' ? 'open' : 
		              process.platform === 'win32' ? 'start' : 'xdg-open';
		
		exec(`${command} "${htmlPath}"`);
	}
	
	return { result, htmlPath };
}

// Export all analysis functions and types
export { generateHtmlReport };
export { analyzePackages, ProgressCallback, ProgressInfo };
export { getSourceFiles };
export type { UnusedPackage, DeprecatedPackage, PackageAnalysisResult } from './packageAnalyzer';
export type { BuildAnalysisResult } from './buildAnalyzer';

// Usage examples (for docs):
// import { optimizeProject, generateReport, analyzePackages } from 'react-native-optimizer';
// const result = await optimizeProject(process.cwd());
// const { result, htmlPath } = await generateReport(process.cwd(), { openInBrowser: true });
// const packageAnalysis = await analyzePackages(process.cwd());
