// src/packageAnalyzer.ts
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import https from 'https';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { PurePackageAnalyzer } from './purePackageAnalyzer';

/**
 * React Native Optimizer
 * production-grade package analysis utilities
 *
 * Key features:
 * - async non-blocking file IO
 * - concurrency control for parsing and network access
 * - npm registry caching + retries + timeout
 * - safe AST parsing and robust error handling
 */

/* ---------------------------
   Types
   --------------------------- */

export interface UnusedPackage {
  name: string;
  version: string;
  size: number; // bytes
  type: 'dependencies' | 'devDependencies';
  estimatedSize?: string;
}

export interface ProgressInfo {
  module: 'initialization' | 'source-scan' | 'unused-imports' | 'unused-files' | 'package-analysis' | 'framework-detection' | 'deprecated-check' | 'finalization';
  stage: string;
  current: number;
  total: number;
  percentage: number;
  currentItem?: string;
  timeElapsed?: number;
  estimatedTimeRemaining?: number;
  moduleProgress?: {
    currentModule: number;
    totalModules: number;
    modulePercentage: number;
  };
}

export type ProgressCallback = (progress: ProgressInfo) => void;

/**
 * Advanced modular progress tracking for real-time user engagement
 */
class ProgressTracker {
  private startTime: number;
  private callback?: ProgressCallback;
  private modules: Array<{
    id: ProgressInfo['module'];
    name: string;
    emoji: string;
    weight: number;
    started: boolean;
    completed: boolean;
    current: number;
    total: number;
  }>;
  private currentModuleIndex: number = 0;

  constructor(callback?: ProgressCallback) {
    this.startTime = Date.now();
    this.callback = callback;
    
    // Define all analysis modules with their display info and weights
    this.modules = [
      { id: 'initialization', name: 'Initializing Analysis', emoji: '🚀', weight: 5, started: false, completed: false, current: 0, total: 1 },
      { id: 'source-scan', name: 'Scanning Source Files', emoji: '📁', weight: 20, started: false, completed: false, current: 0, total: 0 },
      { id: 'unused-imports', name: 'Analyzing Unused Imports', emoji: '📦', weight: 25, started: false, completed: false, current: 0, total: 0 },
      { id: 'unused-files', name: 'Detecting Unused Files', emoji: '🗑️', weight: 15, started: false, completed: false, current: 0, total: 0 },
      { id: 'framework-detection', name: 'Framework Detection', emoji: '🔍', weight: 10, started: false, completed: false, current: 0, total: 0 },
      { id: 'package-analysis', name: 'Package Analysis', emoji: '📋', weight: 20, started: false, completed: false, current: 0, total: 0 },
      { id: 'deprecated-check', name: 'Deprecated Package Check', emoji: '⚠️', weight: 10, started: false, completed: false, current: 0, total: 0 },
      { id: 'finalization', name: 'Finalizing Results', emoji: '✨', weight: 5, started: false, completed: false, current: 0, total: 1 }
    ];
  }

  /**
   * Initialize with dynamic workload based on project size
   */
  initialize(workload: {
    sourceFiles: number;
    packages: number;
    configFiles: number;
  }) {
    // Update totals based on actual project workload
    this.updateModuleTotal('source-scan', workload.sourceFiles);
    this.updateModuleTotal('unused-imports', workload.sourceFiles);
    this.updateModuleTotal('unused-files', workload.sourceFiles);
    this.updateModuleTotal('framework-detection', Math.max(workload.configFiles, 1));
    this.updateModuleTotal('package-analysis', workload.packages);
    this.updateModuleTotal('deprecated-check', workload.packages);
    
    // Adjust weights based on workload size
    const sourceWeight = Math.min(workload.sourceFiles / 10, 30);
    const packageWeight = Math.min(workload.packages / 5, 25);
    
    this.updateModuleWeight('source-scan', sourceWeight);
    this.updateModuleWeight('unused-imports', sourceWeight * 1.2);
    this.updateModuleWeight('package-analysis', packageWeight);
    this.updateModuleWeight('deprecated-check', packageWeight * 0.5);
  }

  private updateModuleTotal(moduleId: ProgressInfo['module'], total: number) {
    const module = this.modules.find(m => m.id === moduleId);
    if (module) module.total = Math.max(total, 1);
  }

  private updateModuleWeight(moduleId: ProgressInfo['module'], weight: number) {
    const module = this.modules.find(m => m.id === moduleId);
    if (module) module.weight = weight;
  }

  private calculateOverallProgress(): number {
    const totalWeight = this.modules.reduce((sum, m) => sum + m.weight, 0);
    let completedWeight = 0;
    
    for (const module of this.modules) {
      if (module.completed) {
        completedWeight += module.weight;
      } else if (module.started && module.total > 0) {
        const moduleProgress = module.current / module.total;
        completedWeight += module.weight * moduleProgress;
      }
    }
    
    return Math.round((completedWeight / totalWeight) * 100);
  }

  private findModuleIndex(moduleId: ProgressInfo['module']): number {
    return this.modules.findIndex(m => m.id === moduleId);
  }

  startModule(moduleId: ProgressInfo['module']) {
    const moduleIndex = this.findModuleIndex(moduleId);
    if (moduleIndex === -1) return;
    
    this.currentModuleIndex = moduleIndex;
    const module = this.modules[moduleIndex];
    module.started = true;
    module.current = 0;
    
    this.reportProgress(moduleId, `${module.name}...`, 0, module.total);
  }

  updateModule(moduleId: ProgressInfo['module'], current: number, currentItem?: string, customStage?: string) {
    const module = this.modules.find(m => m.id === moduleId);
    if (!module) return;
    
    module.current = Math.min(current, module.total);
    
    const stage = customStage || `${module.name}${module.total > 1 ? ` (${current}/${module.total})` : ''}`;
    
    this.reportProgress(moduleId, stage, current, module.total, currentItem);
  }

  completeModule(moduleId: ProgressInfo['module']) {
    const module = this.modules.find(m => m.id === moduleId);
    if (!module) return;
    
    module.completed = true;
    module.current = module.total;
    
    this.reportProgress(moduleId, `${module.name} Complete`, module.total, module.total);
  }

  private reportProgress(
    moduleId: ProgressInfo['module'], 
    stage: string, 
    current: number, 
    total: number, 
    currentItem?: string
  ) {
    if (!this.callback) return;

    const timeElapsed = (Date.now() - this.startTime) / 1000;
    const overallProgress = this.calculateOverallProgress();
    
    // Calculate module progress
    const moduleProgress = total > 0 ? Math.round((current / total) * 100) : 0;
    
    // Estimate remaining time based on overall progress
    let estimatedTimeRemaining: number | undefined;
    if (overallProgress > 5 && overallProgress < 95) {
      const averageTimePerPercent = timeElapsed / overallProgress;
      const remainingPercents = 100 - overallProgress;
      estimatedTimeRemaining = Math.round(remainingPercents * averageTimePerPercent);
    }

    // Find current module info
    const currentModule = this.modules[this.currentModuleIndex];

    this.callback({
      module: moduleId,
      stage: `${currentModule.emoji} ${stage}`,
      current,
      total,
      percentage: overallProgress,
      currentItem,
      timeElapsed: Math.round(timeElapsed),
      estimatedTimeRemaining,
      moduleProgress: {
        currentModule: this.currentModuleIndex + 1,
        totalModules: this.modules.length,
        modulePercentage: moduleProgress
      }
    });
  }

  // Legacy compatibility methods for existing code
  setStage(stage: string) {
    this.startModule('initialization');
  }

  complete(stage: string) {
    this.completeModule('finalization');
  }

  report(stage: string, current: number, total: number, currentItem?: string) {
    // Map legacy calls to appropriate modules based on stage content
    const stageStr = stage.toLowerCase();
    let moduleId: ProgressInfo['module'] = 'package-analysis';
    
    if (stageStr.includes('loading') || stageStr.includes('initializ')) {
      moduleId = 'initialization';
    } else if (stageStr.includes('scanning') || stageStr.includes('source')) {
      moduleId = 'source-scan';
    } else if (stageStr.includes('framework') || stageStr.includes('config')) {
      moduleId = 'framework-detection';
    } else if (stageStr.includes('deprecated')) {
      moduleId = 'deprecated-check';
    } else if (stageStr.includes('finaliz')) {
      moduleId = 'finalization';
    }
    
    this.updateModule(moduleId, current, currentItem, stage);
  }

  // New methods for specific module control
  startStage(stageName: string) {
    // Legacy method - map to new system
    this.report(`Starting ${stageName}`, 0, 1);
  }

  updateStage(stageName: string, completed: number, currentItem?: string) {
    // Legacy method - map to new system
    this.report(stageName, completed, 100, currentItem);
  }

  completeStage(stageName: string) {
    // Legacy method - map to new system
    this.report(`${stageName} complete`, 100, 100);
  }
}

export interface DeprecatedPackage {
  name: string;
  version: string;
  deprecatedMessage?: string;
  type: 'dependencies' | 'devDependencies';
  suggestedReplacement?: string;
}

export interface PackageAnalysisResult {
  unusedPackages: UnusedPackage[];
  deprecatedPackages: DeprecatedPackage[];
  totalUnusedSize: number;
  suggestions: string[];
}

/* ---------------------------
   Config / helpers
   --------------------------- */

const DEFAULT_AST_PLUGINS: any[] = [
  'jsx',
  'typescript',
  'classProperties',
  'objectRestSpread',
  'decorators-legacy',
];

const DEFAULT_CONCURRENCY = 8; // number of files / requests processed in parallel
const NPM_FETCH_TIMEOUT = 8_000; // ms
const NPM_BATCH_DELAY = 120; // ms between batches to be polite

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function basePackageName(specifier: string): string {
  if (!specifier) return specifier;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

function isExternalModule(specifier: string): boolean {
  return !specifier.startsWith('.') && !path.isAbsolute(specifier);
}

/* ---------------------------
   Simple concurrency limiter
   --------------------------- */

function pLimit(concurrency: number) {
  const queue: Array<() => void> = [];
  let active = 0;

  const next = () => {
    active--;
    if (queue.length > 0) {
      const fn = queue.shift()!;
      fn();
    }
  };

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve)
          .catch(reject)
          .finally(next);
      };

      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

/* ---------------------------
   File scanning — find source files
   - you can replace this with your existing getSourceFiles for consistency
   --------------------------- */

async function collectSourceFiles(root: string, exts = ['.js', '.jsx', '.ts', '.tsx']) {
  const files: string[] = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(current, { withFileTypes: true });
    } catch (err) {
      // ignore unreadable folders
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);

      // skip node_modules and hidden folders
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (exts.includes(path.extname(entry.name))) {
          files.push(full);
        }
      }
    }
  }

  return files;
}

/* ---------------------------
   AST-based importer collector
   --------------------------- */

/**
 * Count configuration files in project for workload estimation
 */
async function getConfigFileCount(projectPath: string): Promise<number> {
  const configPatterns = [
    'tsconfig*.json', '.eslintrc*', 'babel.config.*', '.babelrc*',
    'webpack.config.*', 'vite.config.*', 'rollup.config.*', 
    'jest.config.*', 'prettier.config.*', '.prettierrc*',
    'tailwind.config.*', 'postcss.config.*', 'next.config.*',
    'gatsby-config.*', 'nuxt.config.*', 'prisma/schema.prisma'
  ];
  
  let count = 0;
  
  try {
    const files = await fsPromises.readdir(projectPath);
    
    for (const file of files) {
      for (const pattern of configPatterns) {
        const regex = new RegExp(pattern.replace('*', '.*'));
        if (regex.test(file)) {
          count++;
          break; // Don't double count same file
        }
      }
    }
    
    // Check for prisma directory
    try {
      const prismaPath = path.join(projectPath, 'prisma');
      await fsPromises.access(prismaPath);
      count++; // Add 1 for prisma directory
    } catch {
      // No prisma directory
    }
    
  } catch {
    // Error reading directory
  }
  
  return Math.max(count, 1); // At least 1 to avoid division by zero
}

/**
 * Get package metadata from npm registry
 */
async function getPackageMetadata(packageName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`;
    https.get(url, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.versions ? parsed.versions[parsed['dist-tags']?.latest] : parsed);
        } catch (error) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * Detect packages used via CLI, scripts, config files, or framework patterns
 * Uses dynamic detection based on npm metadata and actual config parsing
 */
async function detectFrameworkAndCliPackages(
  projectPath: string, 
  packageNames: string[], 
  progressTracker?: ProgressTracker
): Promise<Set<string>> {
  const detectedPackages = new Set<string>();
  
  try {

    
    // 1. Check package.json scripts and config for CLI usage
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageJson = JSON.parse(await fsPromises.readFile(packageJsonPath, 'utf8'));
    const scripts = packageJson.scripts || {};
    const packageJsonContent = JSON.stringify(packageJson);
    
    // Check scripts for direct package usage
    for (const script of Object.values(scripts)) {
      if (typeof script === 'string') {
        for (const pkgName of packageNames) {
          if (script.includes(pkgName)) {
            detectedPackages.add(pkgName);
          }
        }
      }
    }

    // Check for package-specific config sections in package.json
    for (const pkgName of packageNames) {
      const configKey = pkgName.replace(/^@[^/]+\//, ''); // Remove scope
      if (packageJson[configKey] || packageJson[pkgName]) {
        detectedPackages.add(pkgName);
      }
    }



    // 2. Dynamic framework-specific file detection
    const frameworkFiles = new Map([
      ['prisma', ['prisma/schema.prisma', 'prisma/migrations']],
      ['webpack', ['webpack.config.js', 'webpack.config.ts', 'webpack.*.js']],
      ['vite', ['vite.config.js', 'vite.config.ts']],
      ['rollup', ['rollup.config.js', 'rollup.config.ts']],
      ['babel', ['.babelrc', '.babelrc.js', 'babel.config.js', '.babelrc.json']],
      ['eslint', ['.eslintrc.js', '.eslintrc.json', '.eslintrc.yml', 'eslint.config.js']],
      ['prettier', ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js']],
      ['typescript', ['tsconfig.json', 'tsconfig.*.json']],
      ['jest', ['jest.config.js', 'jest.config.ts', 'jest.config.json']],
      ['tailwindcss', ['tailwind.config.js', 'tailwind.config.ts']],
      ['postcss', ['postcss.config.js', 'postcss.config.ts']],
      ['next', ['next.config.js', 'next.config.ts']],
      ['gatsby', ['gatsby-config.js', 'gatsby-node.js']],
      ['nuxt', ['nuxt.config.js', 'nuxt.config.ts']],
    ]);

    // Check for framework-related files and directories
    for (const [framework, patterns] of frameworkFiles) {
      const relatedPackages = packageNames.filter(pkg => 
        pkg.includes(framework) || 
        pkg.startsWith(`@${framework}/`) ||
        pkg.startsWith(`${framework}-`)
      );
      
      if (relatedPackages.length > 0) {
        for (const pattern of patterns) {
          try {
            const fullPath = path.join(projectPath, pattern);
            await fsPromises.access(fullPath);
            // Found config file/directory, mark related packages as used
            relatedPackages.forEach(pkg => detectedPackages.add(pkg));
            break; // Found one config, no need to check others for this framework
          } catch {
            // Pattern not found, try next
          }
        }
      }
    }

    // 3. Dynamic environment and config detection
    const envFiles = ['.env', '.env.local', '.env.production', '.env.development'];
    const allEnvContent = [];
    
    for (const envFile of envFiles) {
      try {
        const content = await fsPromises.readFile(path.join(projectPath, envFile), 'utf8');
        allEnvContent.push(content.toUpperCase());
      } catch {
        // Env file doesn't exist
      }
    }
    
    const combinedEnvContent = allEnvContent.join('\n');
    
    // Check packages against environment variables
    for (const pkgName of packageNames) {
      const upperPkgName = pkgName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      if (combinedEnvContent.includes(upperPkgName) ||
          combinedEnvContent.includes(pkgName.toUpperCase()) ||
          (pkgName.includes('database') && combinedEnvContent.includes('DATABASE_URL')) ||
          (pkgName.includes('redis') && combinedEnvContent.includes('REDIS')) ||
          (pkgName.includes('mongo') && combinedEnvContent.includes('MONGO')) ||
          (pkgName.includes('postgres') && combinedEnvContent.includes('POSTGRES'))) {
        detectedPackages.add(pkgName);
      }
    }

    // 4. Dynamic testing framework detection
    try {
      // Check for test files
      const files = await collectSourceFiles(projectPath, ['.js', '.jsx', '.ts', '.tsx']);
      const hasTestFiles = files.some(file => 
        file.includes('.test.') || 
        file.includes('.spec.') || 
        file.includes('/test/') || 
        file.includes('/tests/') ||
        file.includes('/__tests__/')
      );
      
      if (hasTestFiles) {
        // Find all testing-related packages dynamically
        const testingKeywords = ['test', 'testing', 'spec', 'jest', 'mocha', 'chai', 'cypress', 'vitest', 'ava'];
        const testingPackages = packageNames.filter(pkg => {
          const lowerPkg = pkg.toLowerCase();
          return testingKeywords.some(keyword => lowerPkg.includes(keyword)) ||
                 pkg.startsWith('@types/jest') ||
                 pkg.startsWith('jest-') ||
                 pkg.includes('-test') ||
                 pkg.includes('test-');
        });
        
        testingPackages.forEach(pkg => detectedPackages.add(pkg));
        
        // Also check for common testing utilities
        ['supertest', 'sinon', 'enzyme', 'puppeteer', 'playwright'].forEach(util => {
          if (packageNames.includes(util)) {
            detectedPackages.add(util);
          }
        });
      }
    } catch {
      // Error checking files
    }

    // 5. Dynamic config file parsing for plugins and extensions
    const configFiles = [
      { pattern: /\.eslintrc\.(js|json|yml|yaml)$/, type: 'eslint' },
      { pattern: /eslint\.config\.(js|ts)$/, type: 'eslint' },
      { pattern: /babel\.(config|rc)\.(js|json)$/, type: 'babel' },
      { pattern: /\.babelrc$/, type: 'babel' },
      { pattern: /webpack\.config\.(js|ts)$/, type: 'webpack' },
      { pattern: /vite\.config\.(js|ts)$/, type: 'vite' },
      { pattern: /rollup\.config\.(js|ts)$/, type: 'rollup' },
      { pattern: /jest\.config\.(js|ts|json)$/, type: 'jest' },
      { pattern: /tsconfig.*\.json$/, type: 'typescript' }
    ];
    
    // Scan for all config files
    const allFiles = await fsPromises.readdir(projectPath).catch(() => []);
    
    for (const file of allFiles) {
      for (const { pattern, type } of configFiles) {
        if (pattern.test(file)) {
          try {
            const configPath = path.join(projectPath, file);
            let configContent = await fsPromises.readFile(configPath, 'utf8');
            
            // Add base tool if present
            const basePackages = packageNames.filter(pkg => 
              pkg === type || 
              pkg.startsWith(`@${type}/`) || 
              pkg.includes(type)
            );
            basePackages.forEach(pkg => detectedPackages.add(pkg));
            
            // Parse config for plugins/extensions
            if (type === 'eslint') {
              // Find ESLint plugins and parsers mentioned in config
              const eslintRelated = packageNames.filter(pkg => 
                pkg.startsWith('eslint-plugin-') || 
                pkg.startsWith('@typescript-eslint/') ||
                pkg.includes('eslint-config-')
              );
              
              for (const pkg of eslintRelated) {
                if (pkg.startsWith('eslint-plugin-')) {
                  const pluginName = pkg.replace('eslint-plugin-', '');
                  if (configContent.includes(`"${pluginName}"`) || 
                      configContent.includes(`'${pluginName}'`) ||
                      configContent.includes(pkg)) {
                    detectedPackages.add(pkg);
                  }
                } else if (pkg.startsWith('@typescript-eslint/')) {
                  if (configContent.includes('@typescript-eslint') || 
                      configContent.includes('typescript-eslint')) {
                    detectedPackages.add(pkg);
                  }
                } else if (pkg.includes('eslint-config-')) {
                  const configName = pkg.replace('eslint-config-', '');
                  if (configContent.includes(configName) || configContent.includes(pkg)) {
                    detectedPackages.add(pkg);
                  }
                }
              }
            } else if (type === 'babel') {
              // Find Babel plugins and presets
              const babelRelated = packageNames.filter(pkg => 
                pkg.startsWith('babel-plugin-') || 
                pkg.startsWith('babel-preset-') ||
                pkg.startsWith('@babel/')
              );
              
              for (const pkg of babelRelated) {
                if (configContent.includes(pkg) || 
                    configContent.includes(pkg.replace(/^@babel\//, '').replace(/^(plugin|preset)-/, ''))) {
                  detectedPackages.add(pkg);
                }
              }
            } else if (type === 'jest') {
              // Find Jest-related packages
              const jestRelated = packageNames.filter(pkg => 
                pkg.includes('jest') || 
                pkg.startsWith('@types/jest')
              );
              jestRelated.forEach(pkg => detectedPackages.add(pkg));
            }
            
          } catch {
            // Can't read config file
          }
        }
      }
    }    // 6. Dynamic CLI and development tool detection  
    const scriptsText = JSON.stringify(scripts).toLowerCase();
    
    // Check for packages used in scripts (CLI tools)
    for (const pkgName of packageNames) {
      if (scriptsText.includes(pkgName.toLowerCase()) || 
          scriptsText.includes(`npx ${pkgName}`) ||
          scriptsText.includes(`yarn ${pkgName}`) ||
          scriptsText.includes(`pnpm ${pkgName}`)) {
        detectedPackages.add(pkgName);
      }
    }
    
    // Check for @types packages when TypeScript is present
    if (packageNames.includes('typescript') || detectedPackages.has('typescript')) {
      const typePackages = packageNames.filter(pkg => pkg.startsWith('@types/'));
      typePackages.forEach(pkg => detectedPackages.add(pkg));
    }
    
    // Development server and build tools typically used via scripts
    const devTools = packageNames.filter(pkg => {
      const lower = pkg.toLowerCase();
      return lower.includes('dev-server') || 
             lower.includes('nodemon') ||
             lower.includes('ts-node') ||
             lower.includes('tsx') ||
             lower.includes('concurrently') ||
             pkg.startsWith('create-') ||
             lower.includes('-cli') ||
             lower.includes('serve');
    });
    
    // If dev tools are installed, they're likely used
    devTools.forEach(tool => {
      if (scriptsText.includes(tool.toLowerCase()) || 
          scriptsText.includes('dev') || 
          scriptsText.includes('start') ||
          scriptsText.includes('serve')) {
        detectedPackages.add(tool);
      }
    });

  } catch (error) {
    // If anything fails, just return what we've detected so far
    console.debug('Framework detection error:', error);
  }

  return detectedPackages;
}

export async function getImportedPackages(
  projectPath: string, 
  concurrency = DEFAULT_CONCURRENCY, 
  progressTracker?: ProgressTracker
): Promise<Set<string>> {
  const sourceRoot = projectPath;
  const files = await collectSourceFiles(sourceRoot);
  const imported = new Set<string>();

  const limit = pLimit(concurrency);
  let processedFiles = 0;

  const parsePromises = files.map((file, index) =>
    limit(async () => {
      let content: string;
      try {
        content = await fsPromises.readFile(file, 'utf8');
        if (!content.trim()) return;
      } catch {
        return; // unreadable file -> skip
      }

      // Attempt to parse; tolerate parse errors.
      let ast;
      try {
        ast = parse(content, {
          sourceType: 'unambiguous',
          plugins: DEFAULT_AST_PLUGINS,
        });
      } catch (err) {
        // If parsing fails, try relaxed options (strip TypeScript plugin if needed)
        try {
          ast = parse(content, { sourceType: 'unambiguous', plugins: ['jsx'] });
        } catch {
          // give up on this file
          return;
        }
      }

      try {
        traverse(ast, {
          ImportDeclaration(path: any) {
            const src = path.node.source?.value;
            if (typeof src === 'string' && isExternalModule(src)) {
              imported.add(basePackageName(src));
            }
          },
          CallExpression(path: any) {
            const callee = path.node.callee;
            // require('module')
            if (callee.type === 'Identifier' && callee.name === 'require') {
              const arg = path.node.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const src = arg.value;
                if (isExternalModule(src)) imported.add(basePackageName(src));
              }
            }
          },
          Import(path: any) {
            // dynamic import(...) - parent is CallExpression
            const parent = path.parent;
            if (parent && parent.type === 'CallExpression') {
              const arg = parent.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const src = arg.value;
                if (isExternalModule(src)) imported.add(basePackageName(src));
              }
            }
          },
        });
      } catch {
        // traverse errors -> ignore file
      }
      
      // Report progress
      processedFiles++;
      if (progressTracker && (processedFiles % 5 === 0 || processedFiles === files.length)) {
        progressTracker.updateModule(
          'source-scan', 
          processedFiles, 
          path.basename(file),
          `Scanning source files (${processedFiles}/${files.length})`
        );
      }
    })
  );

  await Promise.all(parsePromises);
  
  return imported;
}

/* ---------------------------
   Package size calculation (iterative)
   --------------------------- */

export async function getPackageSize(packagePath: string): Promise<number> {
  let total = 0;
  const stack = [packagePath];

  while (stack.length) {
    const cur = stack.pop()!;
    let stat: fs.Stats;
    try {
      stat = await fsPromises.lstat(cur);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      let entries: fs.Dirent[];
      try {
        entries = await fsPromises.readdir(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        // skip symlink loops and inaccessible items
        stack.push(path.join(cur, e.name));
      }
    } else if (stat.isFile()) {
      total += stat.size;
    } else {
      // ignore other types (sockets, pipes)
    }
  }

  return total;
}

/* ---------------------------
   NPM registry fetch (with timeout, retry, caching)
   --------------------------- */

type NpmPackageMetadata = any;
const npmCache = new Map<string, NpmPackageMetadata>();

function httpsGetJson(url: string, timeout = NPM_FETCH_TIMEOUT): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/vnd.npm.install-v1+json' } }, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: any) => chunks.push(Buffer.from(c)));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode || 0, json });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err: any) => reject(err));
    req.setTimeout(timeout, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function fetchNpmMetadata(packageName: string): Promise<NpmPackageMetadata | null> {
  if (npmCache.has(packageName)) return npmCache.get(packageName)!;

  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;

  // simple retry strategy: 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { status, json } = await httpsGetJson(url);
      if (status >= 200 && status < 300) {
        npmCache.set(packageName, json);
        return json;
      } else if (status === 404) {
        return null;
      }
      // otherwise try again
    } catch (err) {
      if (attempt === 2) return null;
      // small backoff
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return null;
}

export async function checkDeprecated(packageName: string, rawVersion: string | undefined): Promise<{ deprecated?: string; suggestedReplacement?: string } | null> {
  try {
    const metadata = await fetchNpmMetadata(packageName);
    if (!metadata) return null;

    // Clean version token
    const cleanVersion = (rawVersion || '').replace(/^[\^~><=\s]*/g, '');

    // Check specific version
    if (cleanVersion && metadata.versions && metadata.versions[cleanVersion] && metadata.versions[cleanVersion].deprecated) {
      return { deprecated: metadata.versions[cleanVersion].deprecated };
    }

    // Check latest version deprecation
    const latest = metadata['dist-tags']?.latest;
    if (latest && metadata.versions?.[latest]?.deprecated) {
      return { deprecated: metadata.versions[latest].deprecated };
    }

    // Not deprecated
    return null;
  } catch {
    return null;
  }
}

/* ---------------------------
   Batch check deprecated packages (with concurrency)
   --------------------------- */

export async function checkDeprecatedPackages(
  packages: Record<string, string>,
  dependencies: Record<string, any>,
  devDependencies: Record<string, any>,
  progress?: ProgressTracker,
  concurrency = DEFAULT_CONCURRENCY
): Promise<DeprecatedPackage[]> {
  const entries = Object.entries(packages);
  const results: DeprecatedPackage[] = [];
  const limit = pLimit(concurrency);

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);

    const checks = batch.map(([name, version]) =>
      limit(async () => {
        const info = await checkDeprecated(name, version);
        if (info?.deprecated) {
          const type: 'dependencies' | 'devDependencies' = dependencies && Object.prototype.hasOwnProperty.call(dependencies, name) ? 'dependencies' : 'devDependencies';
          const suggestedReplacement = undefined; // placeholder: advanced heuristics could fill this
          return {
            name,
            version: (version || '').toString(),
            deprecatedMessage: info.deprecated,
            type,
            suggestedReplacement,
          } as DeprecatedPackage;
        }
        return null;
      })
    );

    const settled = await Promise.allSettled(checks);
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) results.push(s.value);
    }

    // Report progress
    if (progress) {
      const completed = Math.min(i + concurrency, entries.length);
      progress.updateModule(
        'deprecated-check', 
        completed, 
        batch[0]?.[0],
        `Checking deprecated packages (${completed}/${entries.length})`
      );
    }

    // friendly delay
    if (i + concurrency < entries.length) {
      await new Promise((r) => setTimeout(r, NPM_BATCH_DELAY));
    }
  }

  return results;
}

/* ---------------------------
   Main exported function: analyzePackages
   --------------------------- */

const DEFAULT_SKIP_PATTERNS = [
  '@types/',        // TypeScript type definitions are always needed
  'husky',          // Git hooks tool - hard to detect usage
  'lint-staged',    // Git hooks tool - hard to detect usage  
  'standard-version', // Release tool - hard to detect usage
  '@react-native/cli', // React Native framework core
  '@expo/cli',      // Expo framework core
  'metro',          // React Native bundler - framework core
];

export async function analyzePackages(
  projectPath: string, 
  progressCallback?: ProgressCallback
): Promise<PackageAnalysisResult> {
  const progress = new ProgressTracker(progressCallback);
  
  try {
    // Initialize analysis
    progress.startModule('initialization');
    
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      await fsPromises.access(packageJsonPath);
    } catch {
      progress.completeModule('initialization');
      return {
        unusedPackages: [],
        deprecatedPackages: [],
        totalUnusedSize: 0,
        suggestions: ['No package.json found'],
      };
    }

    // Load and parse package.json
    progress.updateModule('initialization', 1, 'package.json', 'Loading package.json...');
    
    const raw = await fsPromises.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(raw);
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const allPackages: Record<string, string> = { ...dependencies, ...devDependencies };
    const packageNames = Object.keys(allPackages);

    // Get project workload for dynamic progress tracking
    const sourceFiles = await collectSourceFiles(projectPath);
    const configFiles = await getConfigFileCount(projectPath);
    
    // Initialize progress tracking with actual workload
    progress.initialize({
      sourceFiles: sourceFiles.length,
      packages: packageNames.length,
      configFiles
    });
    
    progress.completeModule('initialization');

    // Start source scanning
    progress.startModule('source-scan');
    
    // Gather imported packages from source files
    const importedPackages = await getImportedPackages(projectPath, DEFAULT_CONCURRENCY, progress);
    
    progress.completeModule('source-scan');
    
    // Start framework detection
    progress.startModule('framework-detection');
    
    // Detect additional packages used via CLI, frameworks, or config files
    const frameworkPackages = await detectFrameworkAndCliPackages(projectPath, packageNames, progress);
    
    progress.completeModule('framework-detection');
    
    // Merge both sets of detected packages
    const allUsedPackages = new Set([...importedPackages, ...frameworkPackages]);

    // Start package analysis with reliable analyzer
    progress.startModule('package-analysis');

    // Use the Pure Package Analyzer (Enhanced Babel AST + Config Analysis + Framework Detection)
    let unusedPackages: UnusedPackage[] = [];
    let totalUnusedSize = 0;

    try {
      // Use Pure Package Analyzer (no external dependencies required)
      const pureAnalyzer = new PurePackageAnalyzer();
      
      // Run pure analysis with progress tracking
      const pureResult = await pureAnalyzer.analyzePackageUsage(projectPath, allPackages, progress);

      // Convert reliable results to our format with size calculation
      const nodeModulesPath = path.join(projectPath, 'node_modules');
      const sizeLimit = pLimit(DEFAULT_CONCURRENCY);
      
      progress.updateModule('package-analysis', 0.7, undefined, 'Calculating package sizes...');

      const unusedPackageNames: string[] = Array.from(pureResult.unused);
      const sizeChecks = unusedPackageNames.map(async (packageName: string) => {
        const version = allPackages[packageName] || '0.0.0';
        const pkgPath = path.join(nodeModulesPath, packageName);
        const exists = await fsPromises.stat(pkgPath).then(() => true).catch(() => false);
        const size = exists ? await sizeLimit(() => getPackageSize(pkgPath)) : 0;

        const type: 'dependencies' | 'devDependencies' = 
          dependencies && Object.prototype.hasOwnProperty.call(dependencies, packageName) 
            ? 'dependencies' 
            : 'devDependencies';

        totalUnusedSize += size;

        return {
          name: packageName,
          version: version.toString(),
          size,
          type,
          estimatedSize: formatBytes(size),
        } as UnusedPackage;
      });

      unusedPackages = await Promise.all(sizeChecks);

      // The pure analyzer already logs its own summary with confidence score
      // No need for additional logging here since it's handled in pureAnalyzer.analyzePackageUsage()

    } catch (error) {
      console.error('❌ Pure analyzer failed:', error);
      
      // Fallback: mark all packages as used for safety and log error
      const entries = Object.entries(allPackages);
      unusedPackages = []; // No packages marked as unused in case of error
      
      console.log('⚠️ Analysis failed - all packages marked as used for safety');
      console.log('   Please check your project structure and try again');
    }

    progress.completeModule('package-analysis');

    // Start deprecated package check
    progress.startModule('deprecated-check');

    // Check deprecated packages (network calls)
    const deprecatedPackages = await checkDeprecatedPackages(allPackages, dependencies, devDependencies, progress);

    // Build suggestions
    const suggestions: string[] = [];
    if (unusedPackages.length > 0) {
      suggestions.push(`Remove ${unusedPackages.length} unused package(s) to save ${formatBytes(totalUnusedSize)}`);
      suggestions.push(`Run: npm uninstall ${unusedPackages.map((p) => p.name).join(' ')}`);
    }
    if (deprecatedPackages.length > 0) {
      suggestions.push(`Update ${deprecatedPackages.length} deprecated package(s) for security and compatibility`);
      deprecatedPackages.forEach((pkg) => {
        if (pkg.suggestedReplacement) {
          suggestions.push(`Replace ${pkg.name} with ${pkg.suggestedReplacement}`);
        }
      });
    }
    if (unusedPackages.length === 0 && deprecatedPackages.length === 0) {
      suggestions.push('✅ All packages appear used and not deprecated (based on registry checks)');
    }

    progress.completeModule('deprecated-check');

    // Finalize results
    progress.startModule('finalization');
    progress.updateModule('finalization', 1, undefined, 'Preparing final report...');

    // Limit results to keep reports readable
    const topUnused = unusedPackages.sort((a, b) => b.size - a.size).slice(0, 50);
    const topDeprecated = deprecatedPackages.slice(0, 50);

    progress.completeModule('finalization');

    return {
      unusedPackages: topUnused,
      deprecatedPackages: topDeprecated,
      totalUnusedSize,
      suggestions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      unusedPackages: [],
      deprecatedPackages: [],
      totalUnusedSize: 0,
      suggestions: [`Package analysis failed: ${message}`],
    };
  }
}
