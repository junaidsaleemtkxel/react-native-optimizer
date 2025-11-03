import { getSourceFiles, findUnusedImports } from './unusedImports';
import path from 'path';
import { findUnusedFiles } from './unusedFiles';
import fs from 'fs';

export async function runAnalysis(projectPath: string): Promise<{ unusedImports: string[]; unusedFiles: string[] }> {
  // Validate project path
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  
  if (!fs.statSync(projectPath).isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }
  
  const unusedImportsReport: string[] = [];
  
  try {
    const files = getSourceFiles(projectPath);
    
    if (files.length === 0) {
      throw new Error('No source files found in the project. Make sure you have .ts, .tsx, .js, or .jsx files.');
    }
    
    // Analyze unused imports with error handling
    files.forEach(f => {
      try {
        const fullPath = path.join(projectPath, f);
        const unused = findUnusedImports(fullPath);
        if (unused.length) {
          unusedImportsReport.push(`${f}: ${unused.join(', ')}`);
        }
      } catch (error) {
        // Skip files that can't be analyzed but don't fail the whole process
        console.warn(`Warning: Could not analyze file ${f}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
    
    // Analyze unused files
    const unusedFiles = findUnusedFiles(projectPath);
    
    return { 
      unusedImports: unusedImportsReport, 
      unusedFiles 
    };
  } catch (error) {
    throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
