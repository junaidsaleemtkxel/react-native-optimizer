import fs from 'fs';
import path from 'path';
import { EXCLUDE_DIRS } from './unusedImports';

export interface BuildFile {
  path: string;
  size: number;
  type: 'js' | 'json' | 'map' | 'image' | 'font' | 'other';
  gzipSize?: number;
}

export interface DependencyAnalysis {
  name: string;
  size: number;
  files: number;
  category: 'critical' | 'large' | 'optimization-candidate';
  suggestions: string[];
}

export interface BuildAnalysisResult {
  buildPath: string;
  totalSize: number;
  files: BuildFile[];
  largestFiles: BuildFile[];
  dependencies: DependencyAnalysis[];
  suggestions: string[];
  bundleBreakdown: {
    javascript: number;
    images: number;
    fonts: number;
    maps: number;
    other: number;
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function detectBuildPath(projectPath: string): string | null {
  // Common build output directories
  const buildPaths = [
    'dist',
    'build', 
    'android/app/build/outputs',
    'ios/build',
    '.expo/web/build',
    'web-build',
    'output'
  ];

  for (const buildPath of buildPaths) {
    const fullPath = path.join(projectPath, buildPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

export function getFileType(filePath: string): BuildFile['type'] {
  const ext = path.extname(filePath).toLowerCase();
  
  if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) return 'js';
  if (ext === '.json') return 'json';
  if (ext === '.map') return 'map';
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(ext)) return 'image';
  if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) return 'font';
  
  return 'other';
}

export function scanBuildDirectory(buildPath: string): BuildFile[] {
  const files: BuildFile[] = [];

  function scanDir(currentPath: string) {
    try {
      const entries = fs.readdirSync(currentPath);
      
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // Skip excluded directories
          if (!EXCLUDE_DIRS.includes(entry)) {
            scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const relativePath = path.relative(buildPath, fullPath);
          files.push({
            path: relativePath,
            size: stat.size,
            type: getFileType(fullPath)
          });
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  scanDir(buildPath);
  return files.sort((a, b) => b.size - a.size);
}

export function analyzeDependencySizes(projectPath: string): DependencyAnalysis[] {
  const nodeModulesPath = path.join(projectPath, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    return [];
  }

  const dependencies: DependencyAnalysis[] = [];

  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(projectPath, 'package.json'), 'utf-8')
    );
    
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    for (const [depName] of Object.entries(allDeps)) {
      const depPath = path.join(nodeModulesPath, depName);
      if (fs.existsSync(depPath)) {
        const size = calculateDirectorySize(depPath);
        const files = getPackageFiles(depPath);
        
        if (size > 0) {
          dependencies.push({
            name: depName,
            size,
            files: files.length,
            category: categorizeDependency(depName, size),
            suggestions: generateDependencySuggestions(depName, size)
          });
        }
      }
    }
  } catch (error) {
    // Ignore package.json read errors
  }

  return dependencies.sort((a, b) => b.size - a.size);
}

function calculateDirectorySize(dirPath: string): number {
  let size = 0;
  
  try {
    const entries = fs.readdirSync(dirPath);
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        size += calculateDirectorySize(fullPath);
      } else {
        size += stat.size;
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }
  
  return size;
}

function getPackageFiles(packagePath: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(packagePath);
    for (const entry of entries) {
      const fullPath = path.join(packagePath, entry);
      if (fs.statSync(fullPath).isFile()) {
        files.push(entry);
      }
    }
  } catch (error) {
    // Skip if can't read
  }
  
  return files.slice(0, 10); // Limit to first 10 files
}

function categorizeDependency(name: string, size: number): DependencyAnalysis['category'] {
  // Large dependencies (> 1MB)
  if (size > 1024 * 1024) {
    return 'large';
  }
  
  // Critical dependencies that might be optimization candidates
  const optimizationCandidates = [
    'lodash', 'moment', 'date-fns', 'rxjs', 'antd',
    'material-ui', '@mui/material', 'react-bootstrap',
    'bootstrap', 'jquery', 'axios', 'request',
    'react-native-vector-icons', '@react-native-async-storage',
    'react-native-gesture-handler', 'react-native-reanimated'
  ];
  
  if (optimizationCandidates.some(candidate => name.includes(candidate))) {
    return 'optimization-candidate';
  }
  
  return 'critical';
}

function generateDependencySuggestions(name: string, size: number): string[] {
  const suggestions: string[] = [];
  
  // Size-based suggestions
  if (size > 5 * 1024 * 1024) { // > 5MB
    suggestions.push('⚠️ Very large dependency - consider alternatives or lazy loading');
  } else if (size > 1024 * 1024) { // > 1MB
    suggestions.push('📦 Large dependency - verify if all features are needed');
  }
  
  // Specific package suggestions
  const packageSuggestions: Record<string, string[]> = {
    'lodash': [
      '🔧 Use lodash-es or import specific functions: import { debounce } from "lodash/debounce"',
      '⚡ Consider native JS alternatives for simple operations'
    ],
    'moment': [
      '📅 Replace with day.js (2kB) or date-fns for smaller bundle size',
      '🚀 Use native Intl.DateTimeFormat for basic formatting'
    ],
    'axios': [
      '🌐 Consider using fetch API for simple requests',
      '📦 Use axios/lib/axios for smaller bundle if needed'
    ],
    'react-native-vector-icons': [
      '🎨 Only import required icon sets in react-native.config.js',
      '⚡ Consider react-native-heroicons or @expo/vector-icons for smaller bundle'
    ],
    '@react-native-async-storage/async-storage': [
      '💾 Verify usage - consider alternatives for simple storage needs',
      '🔧 Use selective imports if only basic functionality needed'
    ],
    'react-native-gesture-handler': [
      '👆 Large but often necessary - ensure you\'re using the latest version',
      '⚡ Consider if all gesture types are needed'
    ],
    'react-native-reanimated': [
      '🎬 Powerful but large - ensure animations justify the size',
      '⚡ Consider react-native Animated API for simple animations'
    ],
    '@mui/material': [
      '🎨 Large UI library - use tree shaking and import only needed components',
      '📦 Consider @mui/base for smaller footprint'
    ],
    'antd': [
      '🎨 Large UI library - use babel-plugin-import for tree shaking',
      '📦 Consider importing individual components'
    ]
  };
  
  for (const [pkg, pkgSuggestions] of Object.entries(packageSuggestions)) {
    if (name.includes(pkg)) {
      suggestions.push(...pkgSuggestions);
      break;
    }
  }
  
  return suggestions;
}

export function generateBuildOptimizationSuggestions(
  files: BuildFile[], 
  dependencies: DependencyAnalysis[],
  projectType: 'react-native' | 'node' | 'unknown'
): string[] {
  const suggestions: string[] = [];
  
  // Calculate total bundle size for context
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const totalSizeMB = totalSize / (1024 * 1024);
  
  // Bundle size assessment
  if (totalSizeMB > 10) {
    suggestions.push(`⚠️ Large bundle size (${totalSizeMB.toFixed(1)}MB) - target under 5MB for optimal performance`);
  } else if (totalSizeMB > 5) {
    suggestions.push(`📊 Moderate bundle size (${totalSizeMB.toFixed(1)}MB) - consider optimization for better loading times`);
  } else {
    suggestions.push(`✅ Good bundle size (${totalSizeMB.toFixed(1)}MB) - well optimized`);
  }
  
  // Large file suggestions with specific thresholds
  const largeJsFiles = files.filter(f => f.type === 'js' && f.size > 500 * 1024);
  if (largeJsFiles.length > 0) {
    const largestFile = largeJsFiles[0];
    const fileSizeMB = largestFile.size / (1024 * 1024);
    suggestions.push(`📦 Largest JS file: ${largestFile.path} (${fileSizeMB.toFixed(1)}MB) - implement code splitting`);
    
    if (projectType === 'react-native') {
      suggestions.push('� Use Metro bundle splitting: npx react-native bundle --dev false --platform android --entry-file index.js');
    } else {
      suggestions.push('🔧 Use dynamic imports: const Component = lazy(() => import("./Component"))');
    }
  }
  
  // Image optimization with size-based recommendations
  const largeImages = files.filter(f => f.type === 'image' && f.size > 100 * 1024);
  if (largeImages.length > 0) {
    const totalImageSize = largeImages.reduce((sum, img) => sum + img.size, 0);
    suggestions.push(`🖼️ ${largeImages.length} large images (${(totalImageSize / 1024 / 1024).toFixed(1)}MB total) - compress to reduce by 60-80%`);
    
    if (projectType === 'react-native') {
      suggestions.push('📱 RN Image optimization: Use react-native-fast-image and optimize with @react-native-async-storage/async-storage');
    } else {
      suggestions.push('🌐 Web optimization: Convert to WebP/AVIF, use next/image or gatsby-image for automatic optimization');
    }
  }
  
  // Source maps handling
  const sourceMaps = files.filter(f => f.type === 'map');
  const sourceMapSize = sourceMaps.reduce((sum, f) => sum + f.size, 0);
  if (sourceMaps.length > 0) {
    suggestions.push(`🗺️ ${sourceMaps.length} source maps (${(sourceMapSize / 1024 / 1024).toFixed(1)}MB) - disable in production: devtool: false`);
  }
  
  // Font optimization
  const fonts = files.filter(f => f.type === 'font');
  const fontSize = fonts.reduce((sum, f) => sum + f.size, 0);
  if (fonts.length > 2) {
    suggestions.push(`📝 ${fonts.length} font files (${(fontSize / 1024).toFixed(0)}KB) - use font-display: swap and subset fonts`);
  }
  
  // Dependency analysis with actionable advice
  const largeDeps = dependencies.filter(d => d.size > 1024 * 1024);
  if (largeDeps.length > 0) {
    const topDep = largeDeps[0];
    suggestions.push(`📚 Largest dependency: ${topDep.name} (${(topDep.size / 1024 / 1024).toFixed(1)}MB) - review if all features are needed`);
  }
  
  const optimizableDeps = dependencies.filter(d => d.category === 'optimization-candidate');
  if (optimizableDeps.length > 0) {
    suggestions.push(`🔧 ${optimizableDeps.length} dependencies have optimization opportunities - check individual suggestions`);
  }
  
  // Project-specific suggestions
  if (projectType === 'react-native') {
    suggestions.push('⚡ Enable Hermes engine for React Native (if not already enabled)');
    suggestions.push('🗜️ Enable ProGuard/R8 for Android builds to reduce APK size');
    suggestions.push('📱 Use Flipper conditionally (disable in release builds)');
    suggestions.push('🎯 Consider using react-native-bundle-visualizer to analyze bundle');
  } else if (projectType === 'node') {
    suggestions.push('📦 Use webpack-bundle-analyzer to visualize dependency sizes');
    suggestions.push('🔧 Enable gzip compression in production server');
    suggestions.push('⚡ Consider serverless deployment for better cold start performance');
  }
  
  // General suggestions
  if (files.length > 100) {
    suggestions.push('📂 Large number of files - consider bundling and minification');
  }
  
  return suggestions;
}

export async function analyzeBuild(
  projectPath: string, 
  projectType: 'react-native' | 'node' | 'unknown' = 'unknown'
): Promise<BuildAnalysisResult | null> {
  const buildPath = detectBuildPath(projectPath);
  
  if (!buildPath) {
    return null;
  }
  
  const files = scanBuildDirectory(buildPath);
  const dependencies = analyzeDependencySizes(projectPath);
  
  const bundleBreakdown = {
    javascript: files.filter(f => f.type === 'js').reduce((sum, f) => sum + f.size, 0),
    images: files.filter(f => f.type === 'image').reduce((sum, f) => sum + f.size, 0),
    fonts: files.filter(f => f.type === 'font').reduce((sum, f) => sum + f.size, 0),
    maps: files.filter(f => f.type === 'map').reduce((sum, f) => sum + f.size, 0),
    other: files.filter(f => !['js', 'image', 'font', 'map'].includes(f.type)).reduce((sum, f) => sum + f.size, 0)
  };
  
  const totalSize = Object.values(bundleBreakdown).reduce((sum, size) => sum + size, 0);
  
  return {
    buildPath: path.relative(projectPath, buildPath),
    totalSize,
    files,
    largestFiles: files.slice(0, 15), // Show max 15 largest files
    dependencies: dependencies.slice(0, 15), // Limit to top 15 dependencies
    suggestions: generateBuildOptimizationSuggestions(files, dependencies, projectType),
    bundleBreakdown
  };
}
