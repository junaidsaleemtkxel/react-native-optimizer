import fs from 'fs';
import path from 'path';
import { getSourceFiles } from './unusedImports';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

// Detect project type
function detectProjectType(projectPath: string): 'react-native' | 'node' | 'unknown' {
  try {
    const packagePath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Check dependencies for React Native
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['react-native'] || deps['@react-native/cli'] || deps['@react-native-community/cli'] ||
          deps['expo'] || deps['@expo/cli']) {
        return 'react-native';
      }
      
      // Check for React Native config files
      if (fs.existsSync(path.join(projectPath, 'metro.config.js')) ||
          fs.existsSync(path.join(projectPath, 'react-native.config.js')) ||
          fs.existsSync(path.join(projectPath, 'app.json')) ||
          fs.existsSync(path.join(projectPath, 'android')) ||
          fs.existsSync(path.join(projectPath, 'ios'))) {
        return 'react-native';
      }
      
      // Check for Node.js specific patterns
      if (deps['express'] || deps['fastify'] || deps['koa'] || 
          deps['prisma'] || deps['sequelize'] || deps['typeorm'] ||
          pkg.main || pkg.bin) {
        return 'node';
      }
    }
  } catch (e) {
    // Ignore errors
  }
  
  return 'unknown';
}

// Get entry files from package.json and common patterns
function getEntryFiles(projectPath: string): string[] {
  const entryFiles = new Set<string>();
  const projectType = detectProjectType(projectPath);
  
  // Check package.json for entry points
  try {
    const packagePath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packagePath)) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      
      // Add main entry point
      if (pkg.main) {
        const mainFile = path.resolve(projectPath, pkg.main);
        // Convert .js to .ts/.tsx if exists
        const tsMain = mainFile.replace(/\.js$/, '.ts');
        const tsxMain = mainFile.replace(/\.js$/, '.tsx');
        if (fs.existsSync(tsMain)) entryFiles.add(tsMain);
        else if (fs.existsSync(tsxMain)) entryFiles.add(tsxMain);
        else if (fs.existsSync(mainFile)) entryFiles.add(mainFile);
      }
      
      // Add bin entry points
      if (pkg.bin) {
        const bins = typeof pkg.bin === 'string' ? [pkg.bin] : Object.values(pkg.bin);
        bins.forEach((binPath: any) => {
          const binFile = path.resolve(projectPath, binPath);
          const tsBin = binFile.replace(/\.js$/, '.ts');
          const tsxBin = binFile.replace(/\.js$/, '.tsx');
          if (fs.existsSync(tsBin)) entryFiles.add(tsBin);
          else if (fs.existsSync(tsxBin)) entryFiles.add(tsxBin);
          else if (fs.existsSync(binFile)) entryFiles.add(binFile);
        });
      }
    }
  } catch (e) {
    // Ignore package.json parsing errors
  }
  
  // Add common entry file patterns and framework-specific files
  const commonEntries = [
    // Entry points
    'index.js', 'index.ts', 'index.tsx',
    'main.js', 'main.ts', 'main.tsx',
    'app.js', 'app.ts', 'app.tsx',
    'cli.js', 'cli.ts', 'cli.tsx',
    'server.js', 'server.ts', 'server.tsx',
    'src/index.js', 'src/index.ts', 'src/index.tsx',
    'src/main.js', 'src/main.ts', 'src/main.tsx',
    'src/app.js', 'src/app.ts', 'src/app.tsx',
    'src/cli.js', 'src/cli.ts', 'src/cli.tsx',
    'src/server.js', 'src/server.ts', 'src/server.tsx',
    
    // Configuration files
    '.eslintrc.js', '.eslintrc.ts', '.eslintrc.json',
    'jest.config.js', 'jest.config.ts',
    'webpack.config.js', 'webpack.config.ts',
    'vite.config.js', 'vite.config.ts',
    'rollup.config.js', 'rollup.config.ts',
    'tsconfig.json', 'jsconfig.json',
    'babel.config.js', 'babel.config.json',
    'prettier.config.js', '.prettierrc.js',
    'tailwind.config.js', 'tailwind.config.ts',
    'next.config.js', 'next.config.ts',
    
    // React Native specific configuration files
    'metro.config.js', 'metro.config.ts',
    'react-native.config.js', 'react-native.config.ts',
    'rn-cli.config.js',
    'android/build.gradle',
    'android/app/build.gradle',
    'ios/Podfile',
    'app.json', 'app.config.js', 'app.config.ts',
    'eas.json',
    'expo.json',
    
    // Database and ORM files
    'prisma/seed.js', 'prisma/seed.ts',
    'prisma/schema.prisma',
    'migrations/**/*',
    'database/seed.js', 'database/seed.ts',
    
    // Test setup files
    'src/tests/setup.js', 'src/tests/setup.ts',
    'src/test/setup.js', 'src/test/setup.ts',
    'test/setup.js', 'test/setup.ts',
    'tests/setup.js', 'tests/setup.ts',
    '__tests__/setup.js', '__tests__/setup.ts',
    'setupTests.js', 'setupTests.ts'
  ];
  
  commonEntries.forEach(entry => {
    const entryPath = path.resolve(projectPath, entry);
    if (fs.existsSync(entryPath)) {
      entryFiles.add(entryPath);
    }
  });
  
  // Add files with special patterns based on project type
  const allFiles = require('./unusedImports').getSourceFiles(projectPath);
  allFiles.forEach((file: string) => {
    const fullPath = path.resolve(projectPath, file);
    const relativePath = file.toLowerCase();
    
    // Type definition files (.d.ts) - always exclude
    if (relativePath.endsWith('.d.ts')) {
      entryFiles.add(fullPath);
    }
    
    // React Native specific patterns
    if (projectType === 'react-native' || projectType === 'unknown') {
      // Scripts directory (build scripts, patches, etc.)
      if (relativePath.includes('/scripts/') || relativePath.includes('\\scripts\\')) {
        entryFiles.add(fullPath);
      }
      
      // Patches directory
      if (relativePath.includes('/patches/') || relativePath.includes('\\patches\\')) {
        entryFiles.add(fullPath);
      }
      
      // Platform specific files
      if (relativePath.includes('/android/') || relativePath.includes('\\android\\') ||
          relativePath.includes('/ios/') || relativePath.includes('\\ios\\')) {
        entryFiles.add(fullPath);
      }
      
      // React Native configuration files by pattern
      if (relativePath.includes('metro') || relativePath.includes('react-native') ||
          relativePath.includes('rn-cli') || relativePath.includes('expo')) {
        entryFiles.add(fullPath);
      }
      
      // Utility scripts (font fixing, linking, etc.)
      if (relativePath.includes('fix-') || relativePath.includes('link-') ||
          relativePath.includes('patch-') || relativePath.includes('update-')) {
        entryFiles.add(fullPath);
      }
    }
    
    // Node.js specific patterns
    if (projectType === 'node' || projectType === 'unknown') {
      // Middleware files (Express.js pattern)
      if (relativePath.includes('middleware') && 
          (relativePath.includes('/middleware/') || relativePath.includes('\\middleware\\'))) {
        entryFiles.add(fullPath);
      }
      
      // Service files (Service layer pattern)
      if (relativePath.includes('service') && 
          (relativePath.includes('/services/') || relativePath.includes('\\services\\') ||
           relativePath.endsWith('.service.ts') || relativePath.endsWith('.service.js'))) {
        entryFiles.add(fullPath);
      }
      
      // Config files in config directory
      if (relativePath.includes('config') && 
          (relativePath.includes('/config/') || relativePath.includes('\\config\\'))) {
        entryFiles.add(fullPath);
      }
      
      // Environment/deployment files
      if (relativePath.includes('env') || relativePath.includes('environment')) {
        entryFiles.add(fullPath);
      }
      
      // Database/ORM related files
      if (relativePath.includes('prisma') || 
          relativePath.includes('sequelize') || 
          relativePath.includes('typeorm') ||
          relativePath.includes('migration')) {
        entryFiles.add(fullPath);
      }
      
      // Validation files (like Joi, Zod schemas)
      if (relativePath.includes('validation') || relativePath.includes('schema')) {
        entryFiles.add(fullPath);
      }
      
      // Security files
      if (relativePath.includes('security') || relativePath.includes('auth')) {
        entryFiles.add(fullPath);
      }
      
      // Cache service files
      if (relativePath.includes('cache')) {
        entryFiles.add(fullPath);
      }
    }
    
    // Common patterns for all project types
    // Build and deployment scripts
    if (relativePath.includes('/build/') || relativePath.includes('\\build\\') ||
        relativePath.includes('/deploy/') || relativePath.includes('\\deploy\\')) {
      entryFiles.add(fullPath);
    }
  });
  
  return Array.from(entryFiles);
}

// Find unused code files (not imported anywhere)
export function findUnusedFiles(projectPath: string): string[] {
  const files = getSourceFiles(projectPath);
  const absFiles = files.map(f => path.resolve(projectPath, f));
  const importedFiles = new Set<string>();

  absFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    let ast;
    try {
      ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'classProperties', 'objectRestSpread'],
      });
    } catch {
      return;
    }
    traverse(ast, {
      ImportDeclaration(path) {
        const importPath = path.node.source.value;
        const resolved = resolveImport(importPath, file, absFiles);
        if (resolved) importedFiles.add(resolved);
      },
      CallExpression(path) {
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') {
          const arg = path.node.arguments[0];
          if (arg && arg.type === 'StringLiteral') {
            const importPath = arg.value;
            const resolved = resolveImport(importPath, file, absFiles);
            if (resolved) importedFiles.add(resolved);
          }
        }
      },
    });
  });

  // Get entry files for this project
  const entryFiles = getEntryFiles(projectPath);
  
  // Unused files: not imported anywhere and not entry files
  return absFiles
    .filter(f => !importedFiles.has(f) && !entryFiles.includes(f))
    .map(f => path.relative(projectPath, f));
}

function resolveImport(importPath: string, fromFile: string, absFiles: string[]): string | null {
  if (!importPath.startsWith('.')) return null;
  const fullPath = path.resolve(path.dirname(fromFile), importPath);
  // Try with extensions
  const possibleExts = ['', '.ts', '.tsx', '.js', '.jsx'];
  for (const ext of possibleExts) {
    const candidate = fullPath + ext;
    if (absFiles.includes(candidate)) return candidate;
  }
  // Handle .js import for .ts/.tsx file
  if (fullPath.endsWith('.js')) {
    for (const ext of ['.ts', '.tsx']) {
      const alt = fullPath.replace(/\.js$/, ext);
      if (absFiles.includes(alt)) return alt;
    }
  }
  // Handle .ts/.tsx import for .js file
  if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
    const alt = fullPath.replace(/\.tsx?$/, '.js');
    if (absFiles.includes(alt)) return alt;
  }
  return null;
}
