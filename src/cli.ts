#!/usr/bin/env node
import { Command } from 'commander';
import { runAnalysis } from './analyze';
import chalk from 'chalk';

const program = new Command();

program
  .name('rnopt')
  .description('React Native Optimizer CLI')
  .version('0.1.0')
  .command('analyze')
  .description('Analyze React Native project for performance and size issues')
  .action(async () => {
    const { unusedImports, unusedFiles } = await runAnalysis(process.cwd());
    console.log(chalk.bold.cyan('\n=== React Native Optimizer Report ==='));
    if (unusedImports.length) {
      console.log(chalk.magentaBright.bold('\n⚠️  Unused Imports Found:'));
      unusedImports.forEach(line => console.log(chalk.magentaBright('• ' + line)));
    } else {
      console.log(chalk.greenBright.bold('\n✅ No unused imports found!'));
    }
    if (unusedFiles.length) {
      console.log(chalk.redBright.bold('\n🗑️  Unused Code Files (Code Debt):'));
      unusedFiles.forEach(file => console.log(chalk.redBright('• ' + file)));
    } else {
      console.log(chalk.greenBright.bold('\n✅ No unused code files found!'));
    }
    console.log(chalk.bold.cyan('====================================\n'));
  });

program.parse();
