// List of known entry files to exclude from code debt report
export const ENTRY_FILES = [
  path.resolve(__dirname, 'cli.ts'),
  path.resolve(__dirname, 'index.ts'),
];
import fs from 'fs';
import path from 'path';
import { getSourceFiles } from './unusedImports';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

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

  // Unused files: not imported anywhere and not entry files
  return absFiles
    .filter(f => !importedFiles.has(f) && !ENTRY_FILES.includes(f))
    .map(f => path.relative(projectPath, f));
}

function resolveImport(importPath: string, fromFile: string, absFiles: string[]): string | null {
  if (!importPath.startsWith('.')) return null;
  const fullPath = path.resolve(path.dirname(fromFile), importPath);
  // Try with extensions
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
    const candidate = fullPath + ext;
    if (absFiles.includes(candidate)) return candidate;
  }
  return null;
}
