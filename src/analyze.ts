import { getSourceFiles, findUnusedImports } from './unusedImports';
import path from 'path';
import { findUnusedFiles } from './unusedFiles';

export async function runAnalysis(projectPath: string): Promise<{ unusedImports: string[]; unusedFiles: string[] }> {
  const unusedImportsReport: string[] = [];
  const files = getSourceFiles(projectPath);
  files.forEach(f => {
    const unused = findUnusedImports(path.join(projectPath, f));
    if (unused.length) {
      unusedImportsReport.push(`${f}: ${unused.join(', ')}`);
    }
  });
  const unusedFiles = findUnusedFiles(projectPath);
  return { unusedImports: unusedImportsReport, unusedFiles };
}
