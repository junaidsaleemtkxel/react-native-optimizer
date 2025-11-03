# Contributing to React Native Optimizer

Thank you for your interest in contributing to React Native Optimizer! We welcome contributions from the community.

## 🚀 Getting Started

### Prerequisites
- Node.js 16+ 
- npm or yarn
- TypeScript knowledge

### Development Setup
1. Fork and clone the repository
```sh
git clone https://github.com/junaidsaleemtkxel/react-native-optimizer.git
cd react-native-optimizer
```

2. Install dependencies
```sh
npm install
```

3. Build the project
```sh
npm run build
```

4. Run tests
```sh
npm test
```

## 🏗️ Project Structure
```
src/
├── cli.ts          # CLI entry point
├── index.ts        # Plugin API
├── analyze.ts      # Core analysis logic  
├── unusedImports.ts # Unused import detection
└── unusedFiles.ts   # Unused file detection
unit/               # Test files
dist/               # Built output
```

## 🧪 Testing
- Write tests for new features in the `unit/` directory
- Ensure 100% test coverage for critical paths
- Run `npm test` to execute all tests

## 📝 Code Style
- Use TypeScript with strict mode
- Follow existing code formatting
- Use meaningful variable names
- Add JSDoc comments for public APIs

## 🐛 Bug Reports
When filing a bug report, please include:
- Node.js version
- Package version
- Sample project structure that reproduces the issue
- Expected vs actual behavior

## ✨ Feature Requests
We welcome feature requests! Please:
- Check existing issues first
- Provide clear use cases
- Consider backward compatibility

## 📋 Pull Request Process
1. Create a feature branch from main
2. Make your changes with tests
3. Update documentation if needed
4. Ensure all tests pass
5. Submit PR with clear description

## 📄 License
By contributing, you agree that your contributions will be licensed under the MIT License.
