// src/utils/validation.ts
import fs from 'fs';
import path from 'path';
import { ValidationError } from './errors';
import { logger } from './logger';

export interface ProjectValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  projectType: 'react-native' | 'node' | 'unknown';
  hasPackageJson: boolean;
  hasNodeModules: boolean;
  hasSourceFiles: boolean;
}

export async function validateProjectStructure(projectPath: string): Promise<ProjectValidationResult> {
  const result: ProjectValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    projectType: 'unknown',
    hasPackageJson: false,
    hasNodeModules: false,
    hasSourceFiles: false
  };

  try {
    // Check if path exists and is accessible
    if (!fs.existsSync(projectPath)) {
      result.errors.push(`Project path does not exist: ${projectPath}`);
      result.isValid = false;
      return result;
    }

    const stat = fs.statSync(projectPath);
    if (!stat.isDirectory()) {
      result.errors.push(`Project path is not a directory: ${projectPath}`);
      result.isValid = false;
      return result;
    }

    // Check for package.json
    const packageJsonPath = path.join(projectPath, 'package.json');
    result.hasPackageJson = fs.existsSync(packageJsonPath);
    
    if (!result.hasPackageJson) {
      result.warnings.push('No package.json found - limited analysis capabilities');
    } else {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        result.projectType = detectProjectType(packageJson, projectPath);
      } catch (error) {
        result.errors.push(`Invalid package.json: ${error instanceof Error ? error.message : String(error)}`);
        result.isValid = false;
      }
    }

    // Check for node_modules
    result.hasNodeModules = fs.existsSync(path.join(projectPath, 'node_modules'));
    if (!result.hasNodeModules) {
      result.warnings.push('No node_modules found - package analysis may be limited');
    }

    // Check for source files
    result.hasSourceFiles = await hasSourceFiles(projectPath);
    if (!result.hasSourceFiles) {
      result.warnings.push('No JavaScript/TypeScript source files found');
    }

    // Additional validations based on project type
    if (result.projectType === 'react-native') {
      validateReactNativeProject(projectPath, result);
    }

  } catch (error) {
    result.errors.push(`Validation failed: ${error instanceof Error ? error.message : String(error)}`);
    result.isValid = false;
  }

  logger.debug('Project validation completed', { result });
  return result;
}

function detectProjectType(packageJson: any, projectPath: string): 'react-native' | 'node' | 'unknown' {
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

  // React Native indicators
  if (deps['react-native'] || deps['@react-native/cli'] || deps['expo']) {
    return 'react-native';
  }

  // Check for RN config files
  const rnFiles = ['metro.config.js', 'react-native.config.js', 'app.json'];
  if (rnFiles.some(file => fs.existsSync(path.join(projectPath, file)))) {
    return 'react-native';
  }

  // Check for RN directories
  const rnDirs = ['android', 'ios'];
  if (rnDirs.some(dir => fs.existsSync(path.join(projectPath, dir)))) {
    return 'react-native';
  }

  // Node.js indicators
  if (packageJson.main || packageJson.bin || packageJson.scripts?.start) {
    return 'node';
  }

  return 'unknown';
}

async function hasSourceFiles(projectPath: string): Promise<boolean> {
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  
  try {
    const items = fs.readdirSync(projectPath, { withFileTypes: true });
    
    for (const item of items) {
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
      
      if (item.isFile() && extensions.some(ext => item.name.endsWith(ext))) {
        return true;
      }
      
      if (item.isDirectory()) {
        const hasFiles = await hasSourceFiles(path.join(projectPath, item.name));
        if (hasFiles) return true;
      }
    }
    
    return false;
  } catch (error) {
    logger.debug(`Error checking for source files in ${projectPath}:`, error);
    return false;
  }
}

function validateReactNativeProject(projectPath: string, result: ProjectValidationResult): void {
  // Check for essential RN files/directories
  const requiredItems = [
    { path: 'App.js', type: 'file', message: 'No App.js found - ensure main app component exists' },
    { path: 'App.tsx', type: 'file', message: 'No App.tsx found - ensure main app component exists' },
  ];

  let hasMainApp = false;
  for (const item of requiredItems) {
    if (fs.existsSync(path.join(projectPath, item.path))) {
      hasMainApp = true;
      break;
    }
  }

  if (!hasMainApp) {
    result.warnings.push('No main App component found (App.js or App.tsx)');
  }
}

export function validateAnalysisOptions(options: any): void {
  if (options && typeof options !== 'object') {
    throw new ValidationError('Analysis options must be an object');
  }

  if (options?.includeBuildAnalysis !== undefined && typeof options.includeBuildAnalysis !== 'boolean') {
    throw new ValidationError('includeBuildAnalysis option must be a boolean');
  }

  if (options?.includePackageAnalysis !== undefined && typeof options.includePackageAnalysis !== 'boolean') {
    throw new ValidationError('includePackageAnalysis option must be a boolean');
  }
}

export function validateProjectPath(projectPath: string): void {
  if (typeof projectPath !== 'string') {
    throw new ValidationError('Project path must be a string');
  }

  if (!projectPath.trim()) {
    throw new ValidationError('Project path cannot be empty');
  }

  if (!path.isAbsolute(projectPath)) {
    throw new ValidationError('Project path must be absolute');
  }
}
