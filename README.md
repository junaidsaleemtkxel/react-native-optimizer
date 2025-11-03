# 🚀 React Native Optimizer

[![npm version](https://badge.fury.io/js/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dm/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)

> **Production-grade code analysis and optimization tool for React Native and Node.js projects**

Automatically detect unused code, analyze package dependencies, find deprecated packages, and optimize your codebase with comprehensive reporting.

## 🚀 Quick Start

### Installation
```bash
# Global installation (recommended for CLI usage)
npm install -g react-native-optimizer

# Or use directly with npx (no installation required)
npx react-native-optimizer analyze
```

### Basic Usage
```bash
# Analyze current project (includes package analysis + HTML report)
npx rnopt analyze

# Quick analysis without HTML report
npx rnopt analyze --no-html

# Full analysis with build insights
npx rnopt analyze --build --verbose
```

### What You Get
- ✅ **Unused imports** detection across your entire codebase
- ✅ **Unused files** identification to reduce code debt
- ✅ **Package analysis** - find unused dependencies and deprecated packages
- ✅ **Build analysis** - bundle size insights and optimization recommendations
- ✅ **Beautiful HTML reports** with interactive charts and actionable insights

## � Configuration

### Project-level Configuration
Create `.optimizerrc.json` in your project root:
```json
{
  "includeBuildAnalysis": false,
  "includePackageAnalysis": true,
  "logLevel": "INFO",
  "concurrencyLimit": 8,
  "excludePatterns": [
    "**/*.test.*",
    "**/fixtures/**",
    "**/__mocks__/**"
  ]
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
name: Code Quality Check
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        
      - name: Run code analysis
        run: npx rnopt analyze --no-html --output analysis.json
        
      - name: Check results
        run: |
          node -e "
            const r = require('./analysis.json');
            const issues = r.unusedImports.length + r.unusedFiles.length;
            const pkgIssues = r.packageAnalysis?.unusedPackages.length || 0;
            if (issues > 5 || pkgIssues > 3) process.exit(1);
          "
```

### Pre-commit Hook
```bash
# .husky/pre-commit
npx rnopt analyze --no-html --no-open
if [ $? -ne 0 ]; then
  echo "❌ Code quality check failed. Fix issues before committing."
  exit 1
fi
```
```
🔍 React Native Optimizer
Analyzing project: my-react-native-app
Project type: 📱 react-native
────────────────────────────────────────────────────────────
� Project Statistics                             
   Files analyzed: 247 | Lines: 15,432 | Size: 892.4 KB | Time: 4.3s
────────────────────────────────────────────────────────────
⚠️  Unused Imports (3 files)
   � src/components/Button.tsx → React, StyleSheet
   📄 src/utils/helpers.ts → moment
────────────────────────────────────────────────────────────
�️  Unused Files (2 files, 3.2 KB wasted)
   📄 src/old-component.tsx (2.3 KB)
   📄 src/temp-utils.js (891 B)
────────────────────────────────────────────────────────────
📦 Package Analysis
   �️  Unused: lodash@4.17.21 (540KB), moment@2.29.4 (288KB)
   ⚠️  Deprecated: request@2.88.2 - use axios or fetch instead
────────────────────────────────────────────────────────────
💡 Recommendations
   • Remove 5 unused imports to clean up code
   • Delete 2 unused files to save 3.2KB  
   • Uninstall 2 unused packages to save 828KB
   • Update 1 deprecated package for security
────────────────────────────────────────────────────────────
✅ 8 optimization opportunities found!
🌐 HTML report: ./optimizer-report.html
```

## � CLI Usage

### Basic Commands
```bash
# Quick analysis with HTML report
npx rnopt analyze

# Analysis without HTML report
npx rnopt analyze --no-html

# Full analysis with build insights
npx rnopt analyze --build --verbose

# Skip package analysis (faster for large projects)
npx rnopt analyze --no-packages

# Custom output location
npx rnopt analyze --output ./reports/analysis.json --html-path ./reports/report.html

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

# Force project type (auto-detected by default)
npx rnopt analyze --type react-native

# Show detailed help
npx rnopt --help
```

### Available Options
| Flag | Description | Default |
|------|-------------|---------|
| `--build` | Include bundle size analysis | `false` |
| `--no-html` | Skip HTML report generation | `false` |
| `--no-open` | Don't auto-open HTML report | `false` |
| `--no-packages` | Skip package dependency analysis | `false` |
| `--verbose` | Show detailed analysis logs | `false` |
| `--output <file>` | Save JSON report to file | - |
| `--html-path <file>` | Custom HTML report location | `./optimizer-report.html` |
| `--type <type>` | Force project type detection | `auto` |

## 📚 API Usage

### TypeScript/ES6
```typescript
import { optimizeProject, generateHtmlReport } from 'react-native-optimizer';

// Simple analysis
const result = await optimizeProject('./my-project');
console.log(`Found ${result.unusedImports.length} unused imports`);
console.log(`Found ${result.packageAnalysis?.unusedPackages.length} unused packages`);

// Generate HTML report
const reportPath = generateHtmlReport(result, './my-project');
console.log(`Report saved to: ${reportPath}`);
```

### JavaScript/CommonJS
```javascript
const { optimizeProject } = require('react-native-optimizer');

optimizeProject('./my-project')
  .then(result => {
    console.log('Analysis complete:', {
      unusedImports: result.unusedImports.length,
      unusedFiles: result.unusedFiles.length,
      unusedPackages: result.packageAnalysis?.unusedPackages.length || 0
    });
  })
  .catch(console.error);
```

### Advanced Usage
```typescript
import { optimizeProject } from 'react-native-optimizer';

const result = await optimizeProject('./my-project', {
  includeBuildAnalysis: true,      // Bundle size analysis
  includePackageAnalysis: true,    // Package dependency analysis (default: true)
});

// Access all analysis results
if (result.success) {
  console.log('� Project Stats:', result.projectStats);
  console.log('⚠️ Unused Imports:', result.unusedImports);
  console.log('�️ Unused Files:', result.unusedFiles);
  console.log('� Package Issues:', result.packageAnalysis);
  console.log('🏗️ Build Analysis:', result.buildAnalysis);
  console.log('⚡ Performance:', result.performanceMetrics);
}
```

## ✨ Features

### � Code Analysis
- **Unused Import Detection** - Find and remove unused imports using Babel AST parsing
- **Unused File Detection** - Identify source files that aren't referenced anywhere
- **Smart Entry Points** - Automatically excludes main entry files and config files
- **TypeScript Support** - Full support for .ts, .tsx, .js, and .jsx files
- **Framework Awareness** - Detects React Native vs Node.js projects with specific rules

### 📦 Package Management
- **Unused Package Detection** - Find dependencies that aren't actually used in code
- **Deprecated Package Detection** - Check npm registry for deprecated packages
- **Real-time NPM Integration** - Live API calls with caching and retry logic
- **Size Estimation** - Calculate potential disk space savings
- **Dependency Type Awareness** - Handles both dependencies and devDependencies

### 🏗️ Build Analysis  
- **Bundle Size Analysis** - Analyze your build output for optimization opportunities
- **Dependency Breakdown** - See which packages contribute most to bundle size
- **Asset Analysis** - JavaScript, images, fonts, and other asset categorization
- **Optimization Suggestions** - Actionable recommendations for reducing bundle size

### 📊 Reporting & Integration
- **Interactive HTML Reports** - Beautiful reports with charts and actionable insights
- **JSON Export** - Machine-readable reports for CI/CD integration
- **Performance Metrics** - Detailed timing information for all operations
- **Configurable Output** - Customize report location and format
- **CI/CD Ready** - Fail builds based on code quality thresholds

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

## 📋 What Gets Analyzed

### 📂 Project Types Supported
- **React Native** - Metro config, platform directories (ios/android), native dependencies
- **Node.js** - Express middleware, services, database schemas, API endpoints  
- **Universal** - TypeScript/JavaScript files, imports, exports, package.json dependencies

### 🔍 Code Analysis Rules

#### Files Included
- `.js`, `.jsx`, `.ts`, `.tsx` source files
- Import/export statements and usage patterns
- Package.json dependencies and devDependencies

#### Files Excluded (Smart Filtering)
- Test files (`*.test.*`, `*.spec.*`, `__tests__/**`)
- Config files (`*.config.js`, `.eslintrc.*`, etc.)
- Build outputs (`dist/`, `build/`, `node_modules/`)
- Platform-specific files (`ios/`, `android/` for React Native)
- Type definitions (`*.d.ts` files)

### 📦 Package Analysis
- **Unused Detection** - Scans all source code for actual package usage
- **Deprecation Check** - Queries npm registry for deprecated package status
- **Size Calculation** - Estimates disk space savings from cleanup
- **Dependency Types** - Analyzes both `dependencies` and `devDependencies`

## 📖 API Reference

### Main Functions

#### `optimizeProject(projectPath, options?)`
Analyzes a project and returns optimization results.

```typescript
interface OptimizeOptions {
  includeBuildAnalysis?: boolean;    // Include bundle size analysis
  includePackageAnalysis?: boolean; // Include package dependency analysis (default: true)
}

interface OptimizerResult {
  success: boolean;
  projectType: 'react-native' | 'node' | 'unknown';
  projectStats: {
    totalFiles: number;
    totalLines: number;
    totalSize: number;
    analysisTime: number;
  };
  unusedImports: Array<{ file: string; imports: string[]; }>;
  unusedFiles: Array<{ path: string; size: number; lines: number; }>;
  packageAnalysis?: {
    unusedPackages: Array<{ name: string; version: string; size: number; }>;
    deprecatedPackages: Array<{ name: string; version: string; reason: string; }>;
  };
  suggestions: string[];
  issues: string[];
}
```

#### `generateHtmlReport(result, projectPath, outputPath?)`
Generates an interactive HTML report from analysis results.

```typescript
const reportPath = generateHtmlReport(result, './my-project', './custom-report.html');
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `rnopt analyze` | Analyze current directory |
| `rnopt analyze --build` | Include build size analysis |
| `rnopt analyze --no-packages` | Skip package analysis |
| `rnopt analyze --output report.json` | Save JSON report |
| `rnopt --help` | Show help information |

## ❓ FAQ

**Q: Will this tool modify my code?**  
A: No, React Native Optimizer only analyzes and reports. It never modifies your source code automatically.

**Q: How accurate is the unused code detection?**  
A: Very accurate! We use Babel AST parsing instead of regex, which provides precise analysis of your code structure.

**Q: Does it work with monorepos?**  
A: Yes! Run the analyzer in each package directory, or use it at the root to analyze the entire monorepo.

**Q: Can I customize what gets analyzed?**  
A: Absolutely. Use `.optimizerrc.json` or package.json configuration to exclude patterns and customize analysis.

**Q: Is it safe for production projects?**  
A: Yes, it's read-only analysis with no code modifications. Many teams use it in their CI/CD pipelines.

## 🤝 Contributing

We welcome contributions! Here's how to get started:

```bash
# Clone and setup
git clone https://github.com/junaidsaleemtkxel/react-native-optimizer
cd react-native-optimizer
npm install

# Build and test
npm run build
npm test

# Test your changes
npx rnopt analyze ./test-project
```

## 📄 License

MIT © [Junaid Saleem](https://github.com/junaidsaleemtkxel)

## 🌟 Show Your Support

If this tool helped optimize your project, please:
- ⭐ Star the repository
- 🐦 Share on Twitter
- 📝 Write a review or blog post
- 🤝 Contribute improvements

---

**Built for developers, by developers** 🚀  
*Helping teams ship cleaner, more efficient React Native and Node.js applications.*