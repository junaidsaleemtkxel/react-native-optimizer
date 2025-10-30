import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export const EXCLUDE_DIRS = [
  'node_modules',
  'dist',
  'android',
  'ios',
  'coverage',
  '.git',
  '.expo',
  '.vscode',
  'test',
  '__tests__',
  '__mocks__',
  'unit',
  'build',
  'out',
  '.next',
  '.cache',
  '.husky',
  '.idea',
  '.tmp',
  '.storybook',
  '.env',
  '.DS_Store'
];

// Recursively collect source files
export function getSourceFiles(dir: string, baseDir = dir): string[] {
  return fs.readdirSync(dir).flatMap(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (EXCLUDE_DIRS.includes(file)) return [];
      return getSourceFiles(filePath, baseDir);
    }

    if (/\.(jsx?|tsx?)$/.test(file)) {
      // Return project-relative path
      return [path.relative(baseDir, filePath)];
    }

    return [];
  });
}

// Detect unused imports
export function findUnusedImports(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8');

  let ast;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return [];
  }

  const imported: Record<string, true> = {};
  const used: Record<string, true> = {};

  traverse(ast, {
    ImportDeclaration({ node }) {
      for (const spec of node.specifiers) {
        imported[spec.local.name] = true;
      }
    },
    Identifier({ node, parent }) {
      if (
        imported[node.name] &&
        parent.type !== 'ImportSpecifier' &&
        parent.type !== 'ImportDefaultSpecifier' &&
        parent.type !== 'ImportNamespaceSpecifier'
      ) {
        used[node.name] = true;
      }
    },
  });

  return Object.keys(imported).filter(name => !used[name]);
}

// Example usage
// const projectRoot = process.cwd();
// for (const f of getSourceFiles(projectRoot)) {
//   const unused = findUnusedImports(path.join(projectRoot, f));
//   if (unused.length) console.log(`${f}: ${unused.join(', ')}`);
// }
