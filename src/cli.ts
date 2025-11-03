#!/usr/bin/env node
import { Command } from 'commander';
import { optimizeProject } from './index';
import { generateHtmlReport } from './htmlReport';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';

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

const program = new Command();

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function printSeparator() {
  console.log(chalk.gray('─'.repeat(60)));
}

program
  .name('rnopt')
  .description('🚀 React Native Optimizer - Analyze and optimize React Native and Node.js projects')
  .version('0.1.0');

program
  .command('analyze')
  .description('Analyze React Native or Node.js project for optimization opportunities')
  .option('-v, --verbose', 'Show detailed analysis information')
  .option('-o, --output <file>', 'Save report to JSON file')
  .option('--html [file]', 'Generate HTML report (optional custom path)')
  .option('--open', 'Auto-open HTML report in browser')
  .option('--type <type>', 'Override project type detection (react-native|node)')
  .action(async (options) => {
    const projectPath = process.cwd();
    const projectName = path.basename(projectPath);
    
    console.log(chalk.bold.cyan('\n🔍 React Native Optimizer'));
    console.log(chalk.gray(`Analyzing project: ${chalk.white(projectName)}`));
    console.log(chalk.gray(`Location: ${projectPath}`));
    
    // Detect and show project type
    const projectType = detectProjectType(projectPath);
    const typeEmoji = projectType === 'react-native' ? '📱' : projectType === 'node' ? '🚀' : '📦';
    console.log(chalk.gray(`Project type: ${typeEmoji} ${chalk.white(projectType)}`));
    printSeparator();
    
    // Show spinner/progress
    process.stdout.write(chalk.yellow('⏳ Analyzing project... '));
    
    const result = await optimizeProject(projectPath);
    
    // Clear progress line
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    
    if (!result.success) {
      console.log(chalk.red.bold('\n❌ Analysis Failed'));
      result.issues.forEach(issue => {
        console.log(chalk.red(`   ${issue}`));
      });
      process.exit(1);
    }
    
    // Project Statistics
    console.log(chalk.bold.white('📊 Project Statistics'));
    console.log(`   Files analyzed: ${chalk.white(result.projectStats.totalFiles)}`);
    console.log(`   Total lines: ${chalk.white(result.projectStats.totalLines.toLocaleString())}`);
    console.log(`   Total size: ${chalk.white(formatBytes(result.projectStats.totalSize))}`);
    console.log(`   Analysis time: ${chalk.white(formatTime(result.projectStats.analysisTime))}`);
    printSeparator();
    
    // Unused Imports
    if (result.unusedImports.length > 0) {
      console.log(chalk.yellow.bold('⚠️  Unused Imports'));
      console.log(chalk.gray(`   Found ${result.unusedImports.length} file(s) with unused imports:`));
      result.unusedImports.forEach(item => {
        console.log(chalk.yellow(`   📄 ${item.file}`));
        item.imports.forEach(imp => {
          console.log(chalk.gray(`      • ${imp}`));
        });
      });
    } else {
      console.log(chalk.green.bold('✅ No unused imports found'));
    }
    printSeparator();
    
    // Unused Files
    if (result.unusedFiles.length > 0) {
      console.log(chalk.red.bold('🗑️  Unused Files (Code Debt)'));
      console.log(chalk.gray(`   Found ${result.unusedFiles.length} unused file(s):`));
      let totalWastedSize = 0;
      result.unusedFiles.forEach(file => {
        totalWastedSize += file.size;
        console.log(chalk.red(`   📄 ${file.path} ${chalk.gray(`(${formatBytes(file.size)}, ${file.lines} lines)`)}`));
      });
      console.log(chalk.gray(`   Total wasted space: ${chalk.red.bold(formatBytes(totalWastedSize))}`));
    } else {
      console.log(chalk.green.bold('✅ No unused files found'));
    }
    printSeparator();
    
    // Suggestions
    if (result.suggestions.length > 0) {
      console.log(chalk.blue.bold('💡 Suggestions'));
      result.suggestions.forEach(suggestion => {
        console.log(chalk.blue(`   • ${suggestion}`));
      });
      printSeparator();
    }
    
    // Summary
    const totalIssues = result.unusedImports.length + result.unusedFiles.length;
    if (totalIssues === 0) {
      console.log(chalk.green.bold('🎉 Excellent! Your project is well optimized!'));
    } else {
      console.log(chalk.yellow.bold(`📋 Summary: ${totalIssues} optimization opportunity(ies) found`));
    }
    
    // Save JSON report if requested
    if (options.output) {
      try {
        fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
        console.log(chalk.gray(`\n📄 JSON report saved to: ${options.output}`));
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to save JSON report: ${error}`));
      }
    }
    
    // Generate HTML report if requested
    if (options.html !== undefined) {
      try {
        const htmlPath = typeof options.html === 'string' ? options.html : undefined;
        const reportPath = generateHtmlReport(result, projectPath, htmlPath);
        console.log(chalk.gray(`\n🌐 HTML report generated: ${reportPath}`));
        
        // Auto-open in browser if requested
        if (options.open) {
          const command = process.platform === 'darwin' ? 'open' : 
                        process.platform === 'win32' ? 'start' : 'xdg-open';
          
          exec(`${command} "${reportPath}"`, (error) => {
            if (error) {
              console.log(chalk.yellow(`\n⚠️ Could not auto-open browser: ${error.message}`));
              console.log(chalk.gray(`Please manually open: ${reportPath}`));
            } else {
              console.log(chalk.green(`\n🚀 HTML report opened in browser!`));
            }
          });
        }
      } catch (error) {
        console.log(chalk.red(`\n❌ Failed to generate HTML report: ${error}`));
      }
    }
    
    console.log(chalk.gray(`\n🕐 Report generated at: ${result.reportGeneratedAt.toLocaleString()}`));
    console.log('');
  });

program.parse();
