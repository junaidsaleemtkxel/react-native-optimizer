// src/purePackageAnalyzer.ts
import fs from 'fs/promises';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

// Define ProgressTracker interface locally to avoid circular dependency
interface ProgressTracker {
  updateModule(moduleId: string, current: number, currentItem?: string, customStage?: string): void;
}

/**
 * Pure package usage detection using enhanced Babel AST + Config analysis (no external dependencies)
 */
export interface PurePackageUsageResult {
  used: Set<string>;
  unused: Set<string>;
  devOnlyUsed: Set<string>;
  unreliable: Set<string>; // Packages that couldn't be reliably analyzed
  analysis: {
    babelResults: Map<string, string[]>; // Package -> files where it's used
    configResults: Map<string, string[]>; // Package -> config files where it's referenced
    frameworkResults: Map<string, string>; // Package -> detection method
  };
  confidence: number; // Analysis confidence score (0-1)
}

/**
 * Pure package analyzer using only Babel AST + config analysis + framework detection
 * Achieves same accuracy as Knip-based approach without external dependencies
 */
export class PurePackageAnalyzer {
  async analyzePackageUsage(
    projectPath: string, 
    packages: Record<string, string>,
    progress?: ProgressTracker
  ): Promise<PurePackageUsageResult> {
    const packageNames = Object.keys(packages);
    const result: PurePackageUsageResult = {
      used: new Set(),
      unused: new Set(),
      devOnlyUsed: new Set(),
      unreliable: new Set(),
      analysis: {
        babelResults: new Map(),
        configResults: new Map(),
        frameworkResults: new Map()
      },
      confidence: 0
    };

    if (progress) {
      progress.updateModule('package-analysis', 0, undefined, 'Starting package analysis...');
    }

    try {
      let analysisSteps = 0;
      const totalSteps = 4;

      // Method 1: Enhanced Babel AST analysis
      const babelResults = await this.analyzeBabelAST(projectPath, progress);
      result.analysis.babelResults = babelResults;
      analysisSteps++;

      // Process Babel results
      for (const [packageName, usageFiles] of babelResults) {
        if (packages[packageName]) {
          result.used.add(packageName);
        }
      }

      if (progress) {
        progress.updateModule('package-analysis', analysisSteps / totalSteps * 0.7, undefined, 'Analyzing configuration files...');
      }

      // Method 2: Enhanced config file analysis
      const configResults = await this.analyzeConfigFiles(projectPath, progress);
      result.analysis.configResults = configResults;
      analysisSteps++;

      // Process config results
      for (const [packageName, configFiles] of configResults) {
        if (packages[packageName]) {
          result.used.add(packageName);
        }
      }

      if (progress) {
        progress.updateModule('package-analysis', analysisSteps / totalSteps * 0.7, undefined, 'Detecting framework packages...');
      }

      // Method 3: Framework-specific detection
      const frameworkResults = await this.analyzeFrameworkPackages(projectPath, packages, result, progress);
      result.analysis.frameworkResults = frameworkResults;
      analysisSteps++;

      // Method 4: Determine unused packages with safety checks
      for (const packageName of packageNames) {
        if (!result.used.has(packageName)) {
          // Check if it's a development tool that might not appear in source
          if (this.isLikelyDevTool(packageName) || this.isFrameworkPackage(packageName)) {
            result.devOnlyUsed.add(packageName);
            result.used.add(packageName); // Keep as used for safety
          } else {
            result.unused.add(packageName);
          }
        }
      }

      // Method 5: Safety validation for React Native packages
      this.applyReactNativeSafetyRules(result, packages);
      analysisSteps++;

      // Calculate confidence based on analysis completeness
      const totalPackages = packageNames.length;
      const analyzedPackages = result.used.size + result.unused.size;
      const uncertainPackages = result.unreliable.size;
      
      result.confidence = Math.max(0, (analyzedPackages - uncertainPackages) / totalPackages);

      if (progress) {
        progress.updateModule('package-analysis', 1, undefined, 'Package analysis complete');
      }

      return result;

    } catch (error) {
      console.warn('Pure analyzer error:', error);
      
      // Fallback: mark all packages as used for safety
      for (const packageName of packageNames) {
        result.used.add(packageName);
        result.unreliable.add(packageName);
      }
      
      result.confidence = 0;
      return result;
    }
  }

  private async analyzeBabelAST(projectPath: string, progress?: ProgressTracker): Promise<Map<string, string[]>> {
    const usageMap = new Map<string, string[]>();
    
    try {
      const sourceFiles = await this.collectSourceFiles(projectPath);
      
      if (progress) {
        progress.updateModule('package-analysis', 0.2, undefined, `Analyzing ${sourceFiles.length} source files...`);
      }

      let processed = 0;
      for (const filePath of sourceFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const ext = path.extname(filePath).toLowerCase();
          
          // Enhanced Babel parsing with comprehensive plugins
          const parserOptions = {
            sourceType: 'module' as const,
            allowImportExportEverywhere: true,
            allowAwaitOutsideFunction: true,
            allowReturnOutsideFunction: true,
            plugins: [
              'asyncGenerators',
              'bigInt',
              'classProperties',
              'decorators-legacy',
              'doExpressions',
              'dynamicImport',
              'exportDefaultFrom',
              'exportNamespaceFrom',
              'functionBind',
              'importMeta',
              'nullishCoalescingOperator',
              'optionalCatchBinding',
              'optionalChaining',
              'throwExpressions',
              'topLevelAwait',
              'objectRestSpread',
              ...(ext === '.tsx' || ext === '.jsx' ? ['jsx'] : []),
              ...(ext === '.ts' || ext === '.tsx' ? ['typescript'] : [])
            ] as any[]
          };

          const ast = parse(content, parserOptions);

          // Enhanced AST traversal for comprehensive package detection
          traverse(ast, {
            // Standard imports: import { x } from 'package'
            ImportDeclaration: (path) => {
              const source = path.node.source.value;
              if (typeof source === 'string') {
                const packageName = this.extractPackageName(source);
                if (packageName) {
                  this.addUsage(usageMap, packageName, filePath);
                }
              }
            },

            // CommonJS require: require('package')
            CallExpression: (path) => {
              const { callee, arguments: args } = path.node;
              
              // require() calls
              if (callee.type === 'Identifier' && callee.name === 'require' && args.length > 0) {
                if (args[0].type === 'StringLiteral') {
                  const packageName = this.extractPackageName(args[0].value);
                  if (packageName) {
                    this.addUsage(usageMap, packageName, filePath);
                  }
                } else if (args[0].type === 'TemplateLiteral') {
                  // Template literal require: require(`package/${variable}`)
                  const templateValue = this.extractTemplatePackageName(args[0]);
                  if (templateValue) {
                    this.addUsage(usageMap, templateValue, filePath);
                  }
                }
              }

              // require.resolve() calls
              if (
                callee.type === 'MemberExpression' &&
                callee.object.type === 'Identifier' &&
                callee.object.name === 'require' &&
                callee.property.type === 'Identifier' &&
                callee.property.name === 'resolve' &&
                args.length > 0 &&
                args[0].type === 'StringLiteral'
              ) {
                const packageName = this.extractPackageName(args[0].value);
                if (packageName) {
                  this.addUsage(usageMap, packageName, filePath);
                }
              }

              // Dynamic imports: import('package')
              if (callee.type === 'Import' && args.length > 0) {
                if (args[0].type === 'StringLiteral') {
                  const packageName = this.extractPackageName(args[0].value);
                  if (packageName) {
                    this.addUsage(usageMap, packageName, filePath);
                  }
                } else if (args[0].type === 'TemplateLiteral') {
                  const templateValue = this.extractTemplatePackageName(args[0]);
                  if (templateValue) {
                    this.addUsage(usageMap, templateValue, filePath);
                  }
                }
              }
            },

            // JSX elements that might reference packages
            JSXOpeningElement: (path) => {
              const name = path.node.name;
              if (name.type === 'JSXIdentifier') {
                // Check for component names that match package names
                // This is useful for packages like 'react-native-vector-icons'
                const componentName = name.name;
                if (componentName.includes('Icon') || componentName.includes('Vector')) {
                  // This is heuristic - might need package-specific logic
                }
              }
            },

            // String literals that might reference packages (for dynamic imports)
            StringLiteral: (path) => {
              const parent = path.parent;
              // Only consider string literals in specific contexts to avoid false positives
              if (
                parent && (
                  parent.type === 'CallExpression' ||
                  parent.type === 'ImportDeclaration' ||
                  (parent.type as string) === 'Property' // Type assertion for compatibility
                )
              ) {
                const value = path.node.value;
                if (typeof value === 'string' && this.looksLikePackageName(value)) {
                  const packageName = this.extractPackageName(value);
                  if (packageName) {
                    this.addUsage(usageMap, packageName, filePath);
                  }
                }
              }
            }
          });

          processed++;
          if (processed % 5 === 0 && progress) {
            progress.updateModule(
              'package-analysis', 
              0.2 + (processed / sourceFiles.length) * 0.3, 
              undefined,
              `Processing files: ${processed}/${sourceFiles.length}`
            );
          }

        } catch (parseError) {
          console.warn(`Failed to parse ${filePath}:`, parseError);
          // Continue with other files
        }
      }

      return usageMap;

    } catch (error) {
      console.warn('Babel AST analysis error:', error);
      return new Map();
    }
  }

  private async collectSourceFiles(projectPath: string): Promise<string[]> {
    const sourceFiles: string[] = [];
    const sourceExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    const excludePatterns = ['node_modules', '.git', 'dist', 'build', 'coverage', '__tests__'];

    async function walkDirectory(dir: string): Promise<void> {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (!excludePatterns.some(pattern => entry.name.includes(pattern))) {
              await walkDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (sourceExtensions.includes(ext)) {
              sourceFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    }

    await walkDirectory(projectPath);
    return sourceFiles;
  }

  private async analyzeConfigFiles(projectPath: string, progress?: ProgressTracker): Promise<Map<string, string[]>> {
    const configUsageMap = new Map<string, string[]>();
    
    const configFiles = [
      'babel.config.js',
      'babel.config.json',
      '.babelrc',
      '.babelrc.js',
      'metro.config.js',
      'metro.config.json',
      '.eslintrc.js',
      '.eslintrc.json',
      'jest.config.js',
      'jest.config.json',
      'webpack.config.js',
      'rollup.config.js',
      'vite.config.js',
      'tsconfig.json',
      'tailwind.config.js',
      'postcss.config.js'
    ];

    if (progress) {
      progress.updateModule('package-analysis', 0.5, undefined, 'Analyzing config files...');
    }

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      
      try {
        const exists = await fs.access(configPath).then(() => true).catch(() => false);
        if (!exists) continue;

        const content = await fs.readFile(configPath, 'utf-8');
        
        // Parse config files carefully to avoid false positives from package.json dependencies
        if (configFile.endsWith('.json')) {
          try {
            const jsonContent = JSON.parse(content);
            this.extractPackagesFromConfig(jsonContent, configPath, configUsageMap, configFile);
          } catch (jsonError) {
            // Invalid JSON, skip
          }
        } else {
          // JavaScript config files - use safer string analysis
          this.extractPackagesFromJSConfig(content, configPath, configUsageMap);
        }

      } catch (error) {
        // Skip files we can't read
      }
    }

    // Special handling for package.json scripts (not dependencies!)
    await this.analyzePackageJsonScripts(projectPath, configUsageMap);

    return configUsageMap;
  }

  private extractPackagesFromConfig(
    config: any, 
    configPath: string, 
    usageMap: Map<string, string[]>,
    fileName: string
  ): void {
    if (!config || typeof config !== 'object') return;

    // Skip package.json dependencies to avoid false positives
    if (fileName === 'package.json') {
      // Only analyze scripts, not dependencies/devDependencies
      if (config.scripts) {
        this.extractPackagesFromScripts(config.scripts, configPath, usageMap);
      }
      return;
    }

    // For other config files, look for package references in configuration
    const configStr = JSON.stringify(config);
    
    // Enhanced patterns for different config types
    const patterns = [
      // Babel plugins/presets
      /@babel\/[a-z-]+/g,
      /babel-[a-z-]+/g,
      // ESLint plugins/configs
      /eslint-[a-z-]+/g,
      /@typescript-eslint\/[a-z-]+/g,
      // Jest transformers/setupFiles
      /jest-[a-z-]+/g,
      /@testing-library\/[a-z-]+/g,
      // Metro/bundler plugins
      /metro-[a-z-]+/g,
      // General package patterns (more conservative)
      /"[a-z][a-z0-9-]*\/[a-z0-9-]+"/g,
      /"[a-z][a-z0-9-]+"/g
    ];

    for (const pattern of patterns) {
      const matches = configStr.match(pattern);
      if (matches) {
        for (const match of matches) {
          const packageName = match.replace(/"/g, '');
          if (this.isValidPackageName(packageName)) {
            this.addUsage(usageMap, packageName, configPath);
          }
        }
      }
    }
  }

  private extractPackagesFromJSConfig(content: string, configPath: string, usageMap: Map<string, string[]>): void {
    // Use regex to find require/import statements in JS config files
    const requirePattern = /require\(['"`]([^'"`]+)['"`]\)/g;
    const importPattern = /from\s+['"`]([^'"`]+)['"`]/g;
    
    let match;
    
    // Find require() calls
    while ((match = requirePattern.exec(content)) !== null) {
      const packageName = this.extractPackageName(match[1]);
      if (packageName) {
        this.addUsage(usageMap, packageName, configPath);
      }
    }
    
    // Find import statements
    while ((match = importPattern.exec(content)) !== null) {
      const packageName = this.extractPackageName(match[1]);
      if (packageName) {
        this.addUsage(usageMap, packageName, configPath);
      }
    }
  }

  private extractPackagesFromScripts(scripts: Record<string, string>, configPath: string, usageMap: Map<string, string[]>): void {
    for (const [scriptName, command] of Object.entries(scripts)) {
      if (typeof command === 'string') {
        // Extract binary commands that might reference packages
        const words = command.split(/\s+/);
        for (const word of words) {
          // Check if it's a package binary (without path separators)
          if (!word.includes('/') && !word.includes('\\') && this.looksLikePackageName(word)) {
            const packageName = this.extractPackageName(word);
            if (packageName && this.isValidPackageName(packageName)) {
              this.addUsage(usageMap, packageName, configPath);
            }
          }
        }
      }
    }
  }

  private async analyzePackageJsonScripts(projectPath: string, usageMap: Map<string, string[]>): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    try {
      const exists = await fs.access(packageJsonPath).then(() => true).catch(() => false);
      if (!exists) return;

      const content = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      if (packageJson.scripts) {
        this.extractPackagesFromScripts(packageJson.scripts, packageJsonPath, usageMap);
      }

    } catch (error) {
      // Skip if we can't read package.json
    }
  }

  private async analyzeFrameworkPackages(
    projectPath: string, 
    packages: Record<string, string>, 
    result: PurePackageUsageResult,
    progress?: ProgressTracker
  ): Promise<Map<string, string>> {
    const frameworkResults = new Map<string, string>();

    if (progress) {
      progress.updateModule('package-analysis', 0.7, undefined, 'Framework detection...');
    }

    // React Native framework detection
    if (packages['react-native']) {
      const isRNProject = await this.detectReactNativeProject(projectPath);
      if (isRNProject) {
        // Mark essential RN packages as used
        const rnEssentials = ['react', 'react-native', 'metro', 'metro-config'];
        for (const pkg of rnEssentials) {
          if (packages[pkg]) {
            result.used.add(pkg);
            frameworkResults.set(pkg, 'React Native Essential');
          }
        }
      }
    }

    // Expo framework detection
    if (packages['expo']) {
      const isExpoProject = await this.detectExpoProject(projectPath);
      if (isExpoProject) {
        result.used.add('expo');
        frameworkResults.set('expo', 'Expo Framework');
        
        // Mark Expo ecosystem packages as used
        for (const [pkgName] of Object.entries(packages)) {
          if (pkgName.startsWith('@expo/') || pkgName.startsWith('expo-')) {
            result.used.add(pkgName);
            frameworkResults.set(pkgName, 'Expo Ecosystem');
          }
        }
      }
    }

    // Next.js detection
    if (packages['next']) {
      const isNextProject = await this.detectNextProject(projectPath);
      if (isNextProject) {
        result.used.add('next');
        frameworkResults.set('next', 'Next.js Framework');
      }
    }

    return frameworkResults;
  }

  private async detectReactNativeProject(projectPath: string): Promise<boolean> {
    const indicators = [
      'android',
      'ios',
      'metro.config.js',
      'react-native.config.js'
    ];

    for (const indicator of indicators) {
      const indicatorPath = path.join(projectPath, indicator);
      const exists = await fs.access(indicatorPath).then(() => true).catch(() => false);
      if (exists) return true;
    }

    return false;
  }

  private async detectExpoProject(projectPath: string): Promise<boolean> {
    const indicators = [
      'app.json',
      'app.config.js',
      'expo.json'
    ];

    for (const indicator of indicators) {
      const indicatorPath = path.join(projectPath, indicator);
      try {
        const exists = await fs.access(indicatorPath).then(() => true).catch(() => false);
        if (exists) {
          // Verify it's actually an Expo config
          const content = await fs.readFile(indicatorPath, 'utf-8');
          if (content.includes('expo') || content.includes('Expo')) {
            return true;
          }
        }
      } catch {
        // Continue checking other indicators
      }
    }

    return false;
  }

  private async detectNextProject(projectPath: string): Promise<boolean> {
    const indicators = [
      'next.config.js',
      'pages',
      'app' // Next.js 13+ app directory
    ];

    for (const indicator of indicators) {
      const indicatorPath = path.join(projectPath, indicator);
      const exists = await fs.access(indicatorPath).then(() => true).catch(() => false);
      if (exists) return true;
    }

    return false;
  }

  private isLikelyDevTool(packageName: string): boolean {
    const devToolPatterns = [
      'eslint', 'prettier', 'jest', 'babel', 'webpack',
      'rollup', 'vite', 'storybook', 'cypress', 'playwright',
      '@testing-library', '@types/', 'typescript', 'ts-node',
      'nodemon', 'concurrently', 'cross-env', 'rimraf'
    ];

    return devToolPatterns.some(pattern => packageName.includes(pattern));
  }

  private isFrameworkPackage(packageName: string): boolean {
    const frameworkPatterns = [
      // React Native & Mobile
      'react-native', 'expo', '@react-native', '@expo/', 'metro',
      
      // Web Frameworks  
      'next', 'gatsby', 'nuxt', '@nestjs/', 'fastify', 'express', 'koa',
      
      // Database & ORM
      '@prisma/', 'prisma', 'typeorm', 'sequelize', 'mongoose',
      'sqlite3', 'mysql2', 'pg', 'mongodb',
      
      // Build & Core
      '@babel/', 'core-js', 'regenerator-runtime'
    ];

    return frameworkPatterns.some(pattern => packageName.startsWith(pattern));
  }

  private applyReactNativeSafetyRules(result: PurePackageUsageResult, packages: Record<string, string>): void {
    // Framework safety rules to prevent breaking apps
    const criticalPackages = [
      // React Native packages
      'react',
      'react-native',
      'react-native-vector-icons', // Often used through linking
      '@react-native-community/', // Community packages
      '@react-native/', // Official packages
      'metro', // Bundler
      'hermes-engine', // JavaScript engine
      
      // Prisma/Database packages (used internally)
      '@prisma/engines', // Prisma query engine
      '@prisma/client', // Prisma client generator
      'prisma', // Prisma CLI and schema
      
      // Other database/ORM engines
      'sqlite3', // SQLite native bindings
      'mysql2', // MySQL driver
      'pg', // PostgreSQL driver
      'mongodb', // MongoDB driver
      'typeorm', // TypeORM dependencies
      'sequelize', // Sequelize dependencies
      
      // Framework core packages
      '@nestjs/', // NestJS framework
      'fastify', // Fastify framework core
      'express', // Express framework
      'koa', // Koa framework
      
      // Build and tooling (often used by framework)
      '@babel/runtime', // Babel runtime
      'core-js', // Polyfills
      'regenerator-runtime' // Async/await runtime
    ];

    for (const [packageName] of Object.entries(packages)) {
      for (const criticalPattern of criticalPackages) {
        if (packageName.startsWith(criticalPattern) || packageName === criticalPattern) {
          if (result.unused.has(packageName)) {
            result.unused.delete(packageName);
            result.used.add(packageName);
            result.devOnlyUsed.add(packageName); // Mark as framework-used for clarity
          }
          break;
        }
      }
    }
  }

  private extractPackageName(importPath: string): string | null {
    if (!importPath || typeof importPath !== 'string') return null;
    
    // Remove relative path indicators
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      return null;
    }

    // Handle scoped packages (@org/package)
    if (importPath.startsWith('@')) {
      const parts = importPath.split('/');
      if (parts.length >= 2) {
        return `${parts[0]}/${parts[1]}`;
      }
    }

    // Handle regular packages with subpaths (package/submodule)
    const parts = importPath.split('/');
    return parts[0];
  }

  private extractTemplatePackageName(templateLiteral: any): string | null {
    // Simple case: template with no expressions
    if (templateLiteral.expressions.length === 0 && templateLiteral.quasis.length === 1) {
      const value = templateLiteral.quasis[0].value.cooked;
      return this.extractPackageName(value);
    }

    // Complex case: template with expressions - try to extract base package
    if (templateLiteral.quasis.length > 0) {
      const firstPart = templateLiteral.quasis[0].value.cooked;
      if (firstPart && !firstPart.startsWith('./') && !firstPart.startsWith('../')) {
        // Try to extract package name from the first static part
        const packageName = this.extractPackageName(firstPart);
        if (packageName) return packageName;
      }
    }

    return null;
  }

  private looksLikePackageName(value: string): boolean {
    // Basic heuristics for package names
    if (!value || typeof value !== 'string') return false;
    if (value.startsWith('./') || value.startsWith('../')) return false;
    if (value.includes('\\') || value.includes('*')) return false;
    if (value.length > 100) return false; // Too long
    
    // Should match npm package naming rules
    return /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(value);
  }

  private isValidPackageName(packageName: string): boolean {
    if (!packageName || typeof packageName !== 'string') return false;
    
    // More strict validation for actual npm package names
    const npmNameRegex = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
    
    return (
      npmNameRegex.test(packageName) &&
      packageName.length <= 214 && // npm package name limit
      !packageName.startsWith('.') &&
      !packageName.startsWith('_')
    );
  }

  private addUsage(usageMap: Map<string, string[]>, packageName: string, filePath: string): void {
    if (!usageMap.has(packageName)) {
      usageMap.set(packageName, []);
    }
    const files = usageMap.get(packageName)!;
    if (!files.includes(filePath)) {
      files.push(filePath);
    }
  }
}
