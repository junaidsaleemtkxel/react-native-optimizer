# 🚀 React Native Optimizer

[![npm version](https://badge.fury.io/js/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview
React Native Optimizer is a **production-grade CLI tool and TypeScript library** that provides comprehensive analysis for **React Native and Node.js projects**. It identifies unused code, analyzes package dependencies, detects deprecated packages, optimizes bundle size, and delivers enterprise-level code quality insights.

Built with **production-ready infrastructure** including performance monitoring, comprehensive error handling, configurable logging, and robust validation systems for enterprise environments.

**Supports both React Native and Node.js projects** with intelligent project type detection and framework-specific exclusions.

## ✨ Production-Grade Features

### 🔍 **Core Analysis**
- 🔍 **Unused Import Detection** - Find and remove unused imports using Babel AST parsing
- 🗑️ **Code Debt Analysis** - Identify unused files that can be safely deleted  
- 📦 **Package Analysis** - **NEW!** Detect unused packages and deprecated dependencies with npm registry integration
- 🏗️ **Build Analysis** - Analyze bundle size, dependencies, and get optimization suggestions
- 📊 **Project Statistics** - Get detailed insights about your project's size and complexity

### 🚀 **Enterprise Infrastructure**
- ⚡ **Performance Monitoring** - Real-time metrics collection with detailed timing analysis
- 🛡️ **Enterprise Error Handling** - Comprehensive error recovery with retry logic and exponential backoff  
- 📝 **Advanced Logging** - Multi-level logging (ERROR, WARN, INFO, DEBUG) with configurable output
- ✅ **Input Validation** - Robust project structure validation and parameter checking
- ⚙️ **Configuration Management** - File-based configuration with package.json integration
- 🔄 **Async Processing** - Non-blocking I/O with configurable concurrency limits

### 🎯 **Smart Analysis**
- 🎯 **Smart Entry Point Detection** - Automatically excludes entry files from unused file reports
- 🏗️ **Framework-Aware Analysis** - Detects React Native vs Node.js projects and applies appropriate rules
- 🛡️ **Infrastructure File Protection** - Excludes middleware, services, config files, and type definitions
- 🔗 **NPM Registry Integration** - Real-time package deprecation checking with caching and retries
- 📈 **Interactive HTML Reports** - Beautiful reports with charts and dependency breakdowns

## ✨ Features
- 🔍 **Unused Import Detection** - Find and remove unused imports across your codebase
- 🗑️ **Code Debt Analysis** - Identify unused files that can be safely deleted
- � **Build Analysis** - Analyze bundle size, dependencies, and get optimization suggestions
- �📊 **Project Statistics** - Get detailed insights about your project's size and complexity  
- ⚡ **Fast Analysis** - Powered by Babel AST parsing for accurate results
- 🎯 **Smart Entry Point Detection** - Automatically excludes entry files from unused file reports
- 🏗️ **Framework-Aware Analysis** - Detects React Native vs Node.js projects and applies appropriate rules
- 🛡️ **Infrastructure File Protection** - Excludes middleware, services, config files, and type definitions in Node.js projects
- 📈 **Interactive HTML Reports** - Beautiful reports with charts, build analysis, and dependency breakdowns
- 🌐 **Auto-Open Reports** - Generate and automatically open HTML reports in your browser
- 📄 **JSON Export** - Save detailed reports for CI/CD integration
- 🎨 **Beautiful CLI Output** - Production-ready terminal interface with colors and progress

## Installation

### Global Installation (Recommended for CLI)
```sh
npm install -g react-native-optimizer
```

### Project Installation (For API usage)
```sh
npm install --save-dev react-native-optimizer
```

### With Yarn
```sh
yarn global add react-native-optimizer
# or for project-specific
yarn add --dev react-native-optimizer
```

## 🚀 Quick Start

### CLI Usage
```sh
# Analyze current directory (includes package analysis and generates HTML report by default)
npx rnopt analyze

# Include build analysis with HTML report  
npx rnopt analyze --build

# Skip HTML report generation
npx rnopt analyze --no-html

# Generate HTML report but don't auto-open browser
npx rnopt analyze --no-open

# Skip package analysis (package analysis is included by default)
npx rnopt analyze --no-packages

# Complete analysis with all features and custom HTML path
npx rnopt analyze --build --verbose --html-path ./custom-report.html

# Save detailed report to JSON (still generates HTML by default)
npx rnopt analyze --output report.json --build

# Override project type detection
npx rnopt analyze --type node

# Show help
npx rnopt --help
```

### TypeScript/JavaScript API
```typescript
import { optimizeProject, generateHtmlReport, OptimizerResult } from 'react-native-optimizer';

// Basic analysis with package checking (default)
async function analyzeProject() {
  const result: OptimizerResult = await optimizeProject(process.cwd());
  
  console.log(`📊 Project: ${result.projectType} (${result.projectPath})`);
  console.log(`📊 Analyzed ${result.projectStats.totalFiles} files`);
  console.log(`⚠️ Found ${result.unusedImports.length} files with unused imports`);
  console.log(`🗑️ Found ${result.unusedFiles.length} unused files`);
  
  // NEW: Package analysis results
  if (result.packageAnalysis) {
    console.log(`📦 Found ${result.packageAnalysis.unusedPackages.length} unused packages`);
    console.log(`⚠️ Found ${result.packageAnalysis.deprecatedPackages.length} deprecated packages`);
    
    // Show unused packages
    result.packageAnalysis.unusedPackages.forEach(pkg => {
      console.log(`📦 ${pkg.name}@${pkg.version} (${pkg.size} bytes)`);
    });
    
    // Show deprecated packages
    result.packageAnalysis.deprecatedPackages.forEach(pkg => {
      console.log(`⚠️ ${pkg.name}@${pkg.version}: ${pkg.reason}`);
    });
  }
  
  // Access detailed results
  result.unusedImports.forEach(item => {
    console.log(`${item.file}: ${item.imports.join(', ')}`);
  });
}

// Advanced analysis with build insights and performance metrics
async function analyzeProjectWithBuild() {
  const result: OptimizerResult = await optimizeProject(process.cwd(), {
    includeBuildAnalysis: true,
    includePackageAnalysis: true // enabled by default
  });
  
  // NEW: Performance metrics
  if (result.performanceMetrics) {
    console.log('📊 Performance Metrics:');
    Object.entries(result.performanceMetrics).forEach(([operation, duration]) => {
      console.log(`  ${operation}: ${duration}ms`);
    });
  }
  
  // Display build analysis if available
  if (result.buildAnalysis) {
    console.log(`📦 Bundle size: ${result.buildAnalysis.totalSize} bytes`);
    console.log(`📂 Build path: ${result.buildAnalysis.buildPath}`);
    console.log(`📊 JavaScript files: ${result.buildAnalysis.bundleBreakdown.javascript} bytes`);
    
    // Show largest dependencies
    result.buildAnalysis.dependencies.slice(0, 5).forEach(dep => {
      console.log(`📚 ${dep.name}: ${dep.size} bytes (${dep.files} files)`);
    });
    
    // Show optimization suggestions
    result.buildAnalysis.suggestions.forEach(suggestion => {
      console.log(`💡 ${suggestion}`);
    });
  }
}

// Generate comprehensive HTML report
async function generateComprehensiveReport() {
  const result = await optimizeProject(process.cwd(), { 
    includeBuildAnalysis: true 
  });
  
  const htmlPath = generateHtmlReport(result, process.cwd());
  console.log(`📄 Comprehensive report generated: ${htmlPath}`);
  
  return result;
}

analyzeProject();
```

## 🛠️ CLI Options

| Option | Description | Default | Example |
|--------|-------------|---------|---------|
| `--build` | Include build analysis (bundle size, dependencies) | `false` | `rnopt analyze --build` |
| `--no-html` | Skip HTML report generation | `false` (HTML generated by default) | `rnopt analyze --no-html` |
| `--no-open` | Skip auto-opening HTML report in browser | `false` (auto-opens by default) | `rnopt analyze --no-open` |
| `--html-path` | Custom path for HTML report | `./optimizer-report.html` | `rnopt analyze --html-path ./custom.html` |
| `--no-packages` | Skip package analysis | `false` (package analysis included by default) | `rnopt analyze --no-packages` |
| `--verbose, -v` | Show detailed analysis information | `false` | `rnopt analyze -v` |
| `--output, -o` | Save JSON report to file | `none` | `rnopt analyze -o report.json` |
| `--type` | Override project type detection | `auto-detect` | `rnopt analyze --type node` |
| `--help` | Show help information | - | `rnopt --help` |

### JavaScript (CommonJS)
```javascript
const { optimizeProject } = require('react-native-optimizer');

optimizeProject(process.cwd())
  .then(result => {
    console.log('Analysis complete!', result.projectStats);
    
    // NEW: Check package analysis results
    if (result.packageAnalysis) {
      console.log('Package issues:', {
        unused: result.packageAnalysis.unusedPackages.length,
        deprecated: result.packageAnalysis.deprecatedPackages.length
      });
    }
  })
  .catch(error => {
    console.error('Analysis failed:', error);
  });
```

## 📊 Example CLI Output
```
🔍 React Native Optimizer
Analyzing project: my-react-native-app
Location: /path/to/my-react-native-app
Project type: 📱 react-native
────────────────────────────────────────────────────────────
📊 Project Statistics                             
   Files analyzed: 247
   Total lines: 15,432
   Total size: 892.4 KB
   Analysis time: 4.3s
────────────────────────────────────────────────────────────
⚠️  Unused Imports
   Found 3 file(s) with unused imports:
   📄 src/components/Button.tsx
      • React
      • StyleSheet
   📄 src/utils/helpers.ts
      • moment
────────────────────────────────────────────────────────────
🗑️  Unused Files (Code Debt)
   Found 2 unused file(s):
   📄 src/old-component.tsx (2.3 KB, 67 lines)
   📄 src/temp-utils.js (891 B, 24 lines)
   Total wasted space: 3.2 KB
────────────────────────────────────────────────────────────
� Package Analysis

   🗑️  Unused Packages
   Found 2 unused package(s):
      📦 lodash@^4.17.21 (dependencies) - 540.2 KB
      📦 moment@^2.29.4 (dependencies) - 287.6 KB
   Total wasted space: 827.8 KB

   ⚠️  Deprecated Packages
   Found 1 deprecated package(s):
      ⚠️  request@^2.88.2 (dependencies)
         request has been deprecated, see https://github.com/request/request/issues/3142
────────────────────────────────────────────────────────────
�💡 Suggestions
   • Remove 5 unused import(s) to clean up your code
   • Delete 2 unused file(s) to save 3.2KB
   • Remove 2 unused package(s) to save 827.8 KB
   • Run: npm uninstall lodash moment
   • Update 1 deprecated package(s) for security and compatibility
────────────────────────────────────────────────────────────
📋 Summary: 8 optimization opportunity(ies) found

🌐 HTML report generated: /path/to/optimizer-report.html

🕐 Report generated at: 11/3/2025, 6:46:23 PM
```

## 📋 API Response Structure
```typescript
interface OptimizerResult {
  success: boolean;
  projectPath: string;
  projectType: 'react-native' | 'node' | 'unknown';
  projectStats: {
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    analysisTime: number;
  };
  unusedImports: Array<{
    file: string;
    imports: string[];
  }>;
  unusedFiles: Array<{
    path: string;
    size: number;
    lines: number;
  }>;
  
  // NEW: Package Analysis
  packageAnalysis?: {
    unusedPackages: Array<{
      name: string;
      version: string;
      size: number;
      type: 'dependencies' | 'devDependencies';
    }>;
    deprecatedPackages: Array<{
      name: string;
      version: string;
      reason: string;
      type: 'dependencies' | 'devDependencies';
    }>;
    suggestions: string[];
  };
  
  buildAnalysis?: {
    buildPath: string;
    totalSize: number;
    files: Array<{
      path: string;
      size: number;
      type: 'js' | 'image' | 'font' | 'map' | 'other';
    }>;
    largestFiles: Array<{ path: string; size: number }>;
    dependencies: Array<{
      name: string;
      size: number;
      files: number;
    }>;
    suggestions: string[];
    bundleBreakdown: {
      javascript: number;
      images: number;
      fonts: number;
      maps: number;
      other: number;
    };
  };
  
  // NEW: Production Infrastructure
  performanceMetrics?: Record<string, number>;
  configUsed?: any;
  validationResult?: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    projectType: string;
    hasPackageJson: boolean;
    hasNodeModules: boolean;
    hasSourceFiles: boolean;
  };
  
  issues: string[];
  suggestions: string[];
  reportGeneratedAt: Date;
}
```

## 🎯 What It Analyzes

### Core Analysis
- **Unused Imports**: Detects imports that are declared but never used in the code
- **Unused Files**: Finds source files that aren't imported or referenced anywhere
- **Entry Point Detection**: Smart detection of main entry files from package.json and common patterns
- **TypeScript Support**: Full support for .ts, .tsx, .js, and .jsx files
- **Extension Mapping**: Handles cases where .js imports map to .ts/.tsx files

### 📦 Package Analysis (NEW!)
- **Unused Package Detection**: Identifies packages in dependencies/devDependencies that aren't used in code
- **Deprecated Package Detection**: Checks npm registry for deprecated packages with detailed reasons
- **Real-time NPM Integration**: Live API calls to npm registry with caching and retry logic
- **Size Calculation**: Estimates disk space savings from removing unused packages
- **Dependency Type Awareness**: Distinguishes between dependencies and devDependencies
- **Concurrent Processing**: Analyzes multiple packages simultaneously with rate limiting
- **Registry Caching**: Caches npm registry responses to improve performance
- **Retry Logic**: Handles network failures with exponential backoff

### Framework-Specific Intelligence

#### React Native Projects
- **Config Files**: `metro.config.js`, `react-native.config.js`, `app.json`, etc.
- **Build Scripts**: All files in `/scripts/` directory (font fixes, patches, linking tools)
- **Platform Files**: `/android/` and `/ios/` directories
- **Utility Scripts**: Files with patterns like `fix-*`, `link-*`, `patch-*`, `update-*`
- **Mobile Entry Points**: React Native specific entry patterns and Expo configurations

#### Node.js Projects  
- **Config Files**: `.eslintrc.js`, `jest.config.js`, `webpack.config.js`, etc.
- **Database/ORM**: Prisma seeds, migrations, TypeORM entities
- **Middleware**: Express.js middleware in `/middleware/` directories
- **Services**: Service layer files in `/services/` directories  
- **Type Definitions**: All `.d.ts` files are excluded
- **Test Setup**: Test configuration and setup files
- **Security**: Authentication and security-related files

## 🏗️ Production Infrastructure

### Performance Monitoring
- **Real-time Metrics**: Tracks timing for all major operations
- **Memory Usage**: Monitors resource consumption during analysis
- **Concurrent Operation Limits**: Configurable limits to prevent system overload (default: 8 concurrent operations)
- **Performance Decorators**: Built-in decorators for function-level timing

### Error Handling & Resilience  
- **Custom Error Types**: Specialized error classes (OptimizerError, ValidationError, FileSystemError, NetworkError, ParseError)
- **Retry Logic**: Exponential backoff for network operations (npm registry calls)
- **Graceful Degradation**: Continues analysis even if some operations fail
- **Comprehensive Logging**: Multi-level logging (ERROR, WARN, INFO, DEBUG) for debugging and monitoring

### Validation & Configuration
- **Input Validation**: Robust checking of all input parameters and project structure
- **Configuration Management**: Support for `.optimizerrc.json` and package.json configuration
- **Project Structure Validation**: Ensures project meets analysis requirements
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## 🔧 Advanced Configuration

### Configuration File (`.optimizerrc.json`)
```json
{
  "includeBuildAnalysis": false,
  "includePackageAnalysis": true,
  "logLevel": "INFO",
  "concurrencyLimit": 8,
  "excludePatterns": [
    "**/*.test.*",
    "**/fixtures/**"
  ],
  "packageAnalysis": {
    "checkDeprecated": true,
    "npmRegistryUrl": "https://registry.npmjs.org",
    "timeout": 5000,
    "retries": 3
  }
}
```

### Package.json Configuration
```json
{
  "reactNativeOptimizer": {
    "excludePatterns": ["**/test/**"],
    "includePackageAnalysis": true,
    "logLevel": "WARN"
  }
}
```

## 🚀 CI/CD Integration

### GitHub Actions
```yaml
name: Code Quality Analysis

on: [push, pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run React Native Optimizer
        run: |
          npx rnopt analyze --no-html --output optimization-report.json
          
      - name: Check Results
        run: |
          node -e "
            const report = require('./optimization-report.json');
            const issues = report.unusedImports.length + report.unusedFiles.length;
            const packageIssues = report.packageAnalysis ? 
              report.packageAnalysis.unusedPackages.length + 
              report.packageAnalysis.deprecatedPackages.length : 0;
            
            console.log(\`Found \${issues} code issues and \${packageIssues} package issues\`);
            
            if (issues > 10 || packageIssues > 5) {
              console.error('❌ Too many optimization issues found');
              process.exit(1);
            }
            console.log('✅ Code quality check passed');
          "
          
      - name: Upload Analysis Results
        uses: actions/upload-artifact@v3
        with:
          name: optimization-report
          path: optimization-report.json
```

### GitLab CI
```yaml
code-quality:
  stage: test
  script:
    - npm ci
    - npx rnopt analyze --no-html --output optimization-report.json
    - node scripts/check-quality.js
  artifacts:
    reports:
      junit: optimization-report.json
    paths:
      - optimization-report.json
```

## 🤝 Contributing
We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License
MIT © [Junaid Saleem](https://github.com/junaidsaleemtkxel)

## 🙏 Acknowledgments
- Built with [Babel](https://babeljs.io/) for accurate AST parsing
- Powered by [Commander.js](https://github.com/tj/commander.js/) for CLI interface
- Styled with [Chalk](https://github.com/chalk/chalk) for beautiful terminal output
- Package analysis powered by [npm Registry API](https://registry.npmjs.org)

---

**Ready for production?** 🚀 The React Native Optimizer provides enterprise-grade code analysis with comprehensive package management, performance monitoring, and robust error handling for mission-critical applications.