# 🚀 React Native Optimizer

[![npm version](https://badge.fury.io/js/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview
React Native Optimizer is a powerful CLI tool and TypeScript library that analyzes **React Native and Node.js projects** to identify unused code, optimize bundle size, and improve code quality. Built with production-grade analysis using Babel AST parsing for maximum accuracy.

**Supports both React Native and Node.js projects** with intelligent project type detection and framework-specific exclusions.

## ✨ Features
- 🔍 **Unused Import Detection** - Find and remove unused imports across your codebase
- 🗑️ **Code Debt Analysis** - Identify unused files that can be safely deleted
- 📊 **Project Statistics** - Get detailed insights about your project's size and complexity  
- ⚡ **Fast Analysis** - Powered by Babel AST parsing for accurate results
- 🎯 **Smart Entry Point Detection** - Automatically excludes entry files from unused file reports
- 🏗️ **Framework-Aware Analysis** - Detects React Native vs Node.js projects and applies appropriate rules
- 🛡️ **Infrastructure File Protection** - Excludes middleware, services, config files, and type definitions in Node.js projects
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
# Analyze current directory
npx rnopt analyze

# Save detailed report to JSON
npx rnopt analyze --output report.json

# Override project type detection
npx rnopt analyze --type node

# Show help
npx rnopt --help
```

### TypeScript/JavaScript API
```typescript
import { optimizeProject, generateReport, OptimizerResult } from 'react-native-optimizer';

// Basic analysis
async function analyzeProject() {
  const result: OptimizerResult = await optimizeProject(process.cwd());
  
  console.log(`📊 Analyzed ${result.projectStats.totalFiles} files`);
  console.log(`⚠️ Found ${result.unusedImports.length} files with unused imports`);
  console.log(`🗑️ Found ${result.unusedFiles.length} unused files`);
  
  // Access detailed results
  result.unusedImports.forEach(item => {
    console.log(`${item.file}: ${item.imports.join(', ')}`);
  });
}

// Generate HTML report with auto-open
async function generateHtmlReport() {
  const { result, htmlPath } = await generateReport(process.cwd(), {
    openInBrowser: true
  });
  
  console.log(`Report generated: ${htmlPath}`);
  return result;
}

analyzeProject();
```

### JavaScript (CommonJS)
```javascript
const { optimizeProject } = require('react-native-optimizer');

optimizeProject(process.cwd())
  .then(result => {
    console.log('Analysis complete!', result.projectStats);
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
────────────────────────────────────────────────────────────
📊 Project Statistics                             
   Files analyzed: 247
   Total lines: 15,432
   Total size: 892.4 KB
   Analysis time: 1.2s
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
💡 Suggestions
   • Remove 5 unused import(s) to clean up your code
   • Delete 2 unused file(s) to save 3.2KB
────────────────────────────────────────────────────────────
📋 Summary: 5 optimization opportunity(ies) found

🕐 Report generated at: 11/3/2025, 2:30:45 PM
```

## 📋 API Response Structure
```typescript
interface OptimizerResult {
  success: boolean;
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

## 🔧 CLI Options
```sh
npx rnopt analyze [options]

Options:
  -o, --output <file>     Save detailed report to JSON file
  --html [file]           Generate beautiful HTML report (optional custom path)
  --open                  Auto-open HTML report in browser
  -v, --verbose           Show detailed analysis information
  --type <type>           Override project type detection (react-native|node)  
  -h, --help              Show help information
  --version               Show version number

Examples:
  npx rnopt analyze                          # Auto-detect project type
  npx rnopt analyze --html --open          # Generate HTML report and open in browser
  npx rnopt analyze --html custom.html     # Generate HTML report with custom filename
  npx rnopt analyze --type node             # Force Node.js analysis rules
  npx rnopt analyze --output report.json   # Save detailed JSON report
```

## 🏗️ CI/CD Integration
```yaml
# GitHub Actions example
- name: Analyze Code Quality
  run: |
    npx rnopt analyze --output optimization-report.json
    # Fail if too many issues found
    node -e "
      const report = require('./optimization-report.json');
      const issues = report.unusedImports.length + report.unusedFiles.length;
      if (issues > 10) {
        console.error('Too many optimization issues found:', issues);
        process.exit(1);
      }
    "
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