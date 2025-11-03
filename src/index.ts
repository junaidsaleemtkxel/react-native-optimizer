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
	projectStats: ProjectStats;
	unusedImports: UnusedImport[];
	unusedFiles: FileStats[];
	issues: string[];
	suggestions: string[];
	reportGeneratedAt: Date;
}

import { runAnalysis } from './analyze';
import { generateHtmlReport } from './htmlReport';
import fs from 'fs';
import path from 'path';

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

export async function optimizeProject(projectPath: string): Promise<OptimizerResult> {
	const startTime = Date.now();
	
	try {
		const { unusedImports: unusedImportsReport, unusedFiles } = await runAnalysis(projectPath);
		
		// Parse unused imports into structured format
		const unusedImports: UnusedImport[] = unusedImportsReport.map(report => {
			const [file, imports] = report.split(': ');
			return {
				file,
				imports: imports.split(', ')
			};
		});
		
		// Get file stats for unused files
		const unusedFileStats: FileStats[] = unusedFiles.map(file => {
			const fullPath = path.resolve(projectPath, file);
			return getFileStats(fullPath, projectPath);
		});
		
		// Calculate project stats
		const allFiles = require('./unusedImports').getSourceFiles(projectPath);
		let totalLines = 0;
		let totalSize = 0;
		
		allFiles.forEach((file: string) => {
			try {
				const fullPath = path.resolve(projectPath, file);
				const stats = getFileStats(fullPath, projectPath);
				totalLines += stats.lines;
				totalSize += stats.size;
			} catch (e) {
				// Skip files that can't be read
			}
		});
		
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
		if (unusedImports.length === 0 && unusedFiles.length === 0) {
			suggestions.push('Great! Your project is well optimized with no unused code detected.');
		}
		
		return {
			success: true,
			projectStats: {
				totalFiles: allFiles.length,
				totalLines,
				totalSize,
				analysisTime
			},
			unusedImports,
			unusedFiles: unusedFileStats,
			issues: [],
			suggestions,
			reportGeneratedAt: new Date()
		};
	} catch (error) {
		return {
			success: false,
			projectStats: {
				totalFiles: 0,
				totalLines: 0,
				totalSize: 0,
				analysisTime: Date.now() - startTime
			},
			unusedImports: [],
			unusedFiles: [],
			issues: [error instanceof Error ? error.message : 'Unknown error occurred'],
			suggestions: ['Please check your project structure and try again'],
			reportGeneratedAt: new Date()
		};
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

// Export HTML report generator
export { generateHtmlReport };

// Usage examples (for docs):
// import { optimizeProject, generateReport } from 'react-native-optimizer';
// const result = await optimizeProject(process.cwd());
// const { result, htmlPath } = await generateReport(process.cwd(), { openInBrowser: true });
