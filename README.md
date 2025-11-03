# 🚀 React Native Optimizer

[![npm version](https://badge.fury.io/js/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)
[![npm downloads](https://img.shields.io/npm/dm/react-native-optimizer.svg)](https://www.npmjs.com/package/react-native-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/junaidsaleemtkxel/react-native-optimizer.svg)](https://github.com/junaidsaleemtkxel/react-native-optimizer/stargazers)

> **Effortlessly analyze and optimize your React Native & Node.js projects**

Automatically detect unused code, find deprecated dependencies, analyze bundle sizes, and clean up your codebase with beautiful reports and actionable insights.

---

## ⚡ Quick Start

```bash
# Run instantly with npx (no installation needed)
npx react-native-optimizer analyze

# Or install globally
npm install -g react-native-optimizer
rnopt analyze
```

**That's it!** Get instant insights into your codebase in seconds. 

<details>
<summary>📊 See example output</summary>

```
🔍 React Native Optimizer
Analyzing project: my-awesome-app
Project type: 📱 react-native
────────────────────────────────────────────────────────────
📊 Analysis Results (4.3s)
   Files: 247 | Lines: 15,432 | Size: 892.4 KB
────────────────────────────────────────────────────────────
⚠️  Found Issues
   📄 3 files with unused imports
   🗑️ 2 unused files (3.2 KB)
   📦 2 unused packages (828 KB)
   ⚠️ 1 deprecated package
────────────────────────────────────────────────────────────
💡 Quick Wins
   • Remove unused imports → cleaner code
   • Delete unused files → save 3.2KB
   • Uninstall unused packages → save 828KB
   • Update deprecated packages → improve security
────────────────────────────────────────────────────────────
✨ 8 optimization opportunities found!
🌐 Interactive report: ./optimizer-report.html
```
</details>

---

## 🎯 Why Use This?

- **🔍 Zero Configuration** - Works out of the box with React Native & Node.js projects
- **⚡ Lightning Fast** - Powered by Babel AST parsing for accurate analysis
- **📊 Beautiful Reports** - Interactive HTML reports with charts and actionable insights
- **🔧 CI/CD Ready** - Perfect for automated code quality checks
- **🛡️ Safe & Secure** - Read-only analysis, never modifies your code
- **📦 Production Tested** - Used by teams to optimize real-world applications

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Unused Import Detection** | Find and clean up unused imports across your codebase |
| 🗑️ **Dead Code Elimination** | Identify unused files safe for removal |
| 📦 **Package Analysis** | Detect unused dependencies and deprecated packages |
| 🏗️ **Bundle Size Analysis** | Optimize build output with detailed breakdowns |
| 📊 **Interactive Reports** | Beautiful HTML reports with charts and insights |
| 🚀 **Framework Aware** | Smart handling of React Native vs Node.js projects |
| ⚙️ **Configurable** | Customize analysis with `.optimizerrc.json` |
| 🔧 **CI/CD Integration** | Automated quality checks in your pipeline |

---

## 📦 Installation

<details>
<summary>Choose your preferred method</summary>

### Global Installation (Recommended)
```bash
npm install -g react-native-optimizer
```

### Project Installation  
```bash
npm install --save-dev react-native-optimizer
# or
yarn add --dev react-native-optimizer
```

### Use with npx (No Installation)
```bash
npx react-native-optimizer analyze
```
</details>

---

## 🚀 Usage

### Basic Commands

```bash
# Analyze current project (includes package analysis + HTML report)
npx rnopt analyze

# Quick analysis without HTML report
npx rnopt analyze --no-html

# Full analysis with build insights
npx rnopt analyze --build --verbose

# Save results to JSON for CI/CD
npx rnopt analyze --output report.json --no-html
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--build` | Include bundle size analysis | `false` |
| `--no-html` | Skip HTML report generation | `false` |
| `--no-packages` | Skip package dependency analysis | `false` |
| `--verbose` | Show detailed analysis logs | `false` |
| `--output <file>` | Save JSON report to file | - |
| `--type <type>` | Force project type (`react-native`, `node`) | auto-detect |

---

## 💻 API Usage

### TypeScript/ES6
```typescript
import { optimizeProject, generateHtmlReport } from 'react-native-optimizer';

// Simple analysis
const result = await optimizeProject('./my-project');
console.log(`Found ${result.unusedImports.length} unused imports`);

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

<details>
<summary>📋 View complete API reference</summary>

### Main Functions

#### `optimizeProject(projectPath, options?)`

```typescript
interface OptimizeOptions {
  includeBuildAnalysis?: boolean;    // Bundle size analysis
  includePackageAnalysis?: boolean; // Package analysis (default: true)
}

interface OptimizerResult {
  success: boolean;
  projectType: 'react-native' | 'node' | 'unknown';
  projectStats: { totalFiles: number; totalLines: number; totalSize: number; };
  unusedImports: Array<{ file: string; imports: string[]; }>;
  unusedFiles: Array<{ path: string; size: number; }>;
  packageAnalysis?: {
    unusedPackages: Array<{ name: string; version: string; size: number; }>;
    deprecatedPackages: Array<{ name: string; reason: string; }>;
  };
  suggestions: string[];
}
```

#### `generateHtmlReport(result, projectPath, outputPath?)`

Generates an interactive HTML report from analysis results.

</details>

---

## ⚙️ Configuration

<details>
<summary>Customize analysis behavior</summary>

### Project Configuration (`.optimizerrc.json`)
```json
{
  "includeBuildAnalysis": false,
  "includePackageAnalysis": true,
  "logLevel": "INFO",
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
</details>

---

## 🚀 CI/CD Integration

<details>
<summary>Automate code quality checks</summary>

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
</details>

---

## 📂 What Gets Analyzed

<details>
<summary>Understanding the analysis scope</summary>

### Supported Project Types
- **React Native** - Metro configs, platform directories, native dependencies
- **Node.js** - Express apps, APIs, microservices, CLI tools
- **Universal** - Any TypeScript/JavaScript project

### Code Analysis
- **Included**: `.js`, `.jsx`, `.ts`, `.tsx` source files, import/export patterns
- **Excluded**: Test files, config files, build outputs, type definitions
- **Smart Filtering**: Automatically excludes framework-specific files

### Package Analysis
- **Unused Detection** - Scans source code for actual package usage
- **Deprecation Check** - Queries npm registry for package status
- **Size Calculation** - Estimates potential space savings
</details>

---

## ❓ FAQ

<details>
<summary>Common questions and answers</summary>

**Q: Does this tool modify my code?**  
A: No, it's read-only analysis. We never modify your source code.

**Q: How accurate is the unused code detection?**  
A: Very accurate! We use Babel AST parsing instead of regex for precise analysis.

**Q: Can I use this in CI/CD pipelines?**  
A: Absolutely! Many teams use it to fail builds with too many issues.

**Q: Does it work with monorepos?**  
A: Yes! Run it in each package directory or at the root level.

**Q: Is it safe for production projects?**  
A: Yes, it's completely safe and used by production teams worldwide.
</details>

---

## 🤝 Contributing

We love contributions! Here's how to get started:

```bash
# 1. Fork & clone the repo
git clone https://github.com/junaidsaleemtkxel/react-native-optimizer
cd react-native-optimizer

# 2. Install dependencies
npm install

# 3. Build & test
npm run build
npm test

# 4. Test your changes
npx rnopt analyze ./test-project
```

See our [Contributing Guide](CONTRIBUTING.md) for detailed guidelines.

---

## 🌐 Community & Support

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/junaidsaleemtkxel/react-native-optimizer/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/junaidsaleemtkxel/react-native-optimizer/discussions)
- 📋 **Roadmap**: [Project Roadmap](https://github.com/junaidsaleemtkxel/react-native-optimizer/projects)
- 📧 **Email**: [support@react-native-optimizer.com](mailto:support@react-native-optimizer.com)

---

## 📄 License

[MIT](LICENSE) © [Junaid Saleem](https://github.com/junaidsaleemtkxel)

---

## 🌟 Show Your Support

**Found this useful?** Help us grow the community:

- ⭐ **Star this repo** if it helped optimize your project
- 🐦 **Share on Twitter** with `#ReactNativeOptimizer`
- 📝 **Write a review** or blog post about your experience
- 🤝 **Contribute** improvements and new features

<div align="center">

**[⭐ Star on GitHub](https://github.com/junaidsaleemtkxel/react-native-optimizer)** • **[📦 View on npm](https://www.npmjs.com/package/react-native-optimizer)** • **[📚 Read the Docs](https://react-native-optimizer.com)**

*Built for developers, by developers* 🚀

</div>
