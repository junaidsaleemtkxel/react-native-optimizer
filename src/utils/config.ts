// src/utils/config.ts
import fs from 'fs';
import path from 'path';
import { logger } from './logger';

export interface OptimizerConfig {
  // Analysis settings
  maxConcurrency: number;
  timeoutMs: number;
  
  // Package analysis
  packageAnalysis: {
    enabled: boolean;
    npmRegistryTimeout: number;
    batchDelay: number;
    maxRetries: number;
    skipPatterns: string[];
  };
  
  // Build analysis  
  buildAnalysis: {
    enabled: boolean;
    maxFileSize: number;
    maxFiles: number;
  };
  
  // File scanning
  fileScanning: {
    extensions: string[];
    excludePatterns: string[];
    maxDepth: number;
    followSymlinks: boolean;
  };
  
  // AST parsing
  astParsing: {
    plugins: string[];
    sourceType: 'module' | 'script' | 'unambiguous';
    allowReturnOutsideFunction: boolean;
  };
  
  // Output
  output: {
    htmlReport: boolean;
    jsonReport: boolean;
    verboseLogging: boolean;
  };
}

const DEFAULT_CONFIG: OptimizerConfig = {
  maxConcurrency: 8,
  timeoutMs: 30000,
  
  packageAnalysis: {
    enabled: true,
    npmRegistryTimeout: 8000,
    batchDelay: 120,
    maxRetries: 2,
    skipPatterns: [
      '@types/',
      'eslint',
      'prettier',
      'jest',
      'babel',
      'webpack',
      'rollup',
      'vite',
      'husky',
      'lint-staged',
      'standard-version',
      'nodemon',
      'ts-node',
      'tsx',
      'esbuild',
      'typescript',
      '@react-native/cli',
      '@expo/cli',
      'metro',
    ]
  },
  
  buildAnalysis: {
    enabled: false,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxFiles: 10000
  },
  
  fileScanning: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs'],
    excludePatterns: [
      'node_modules',
      'dist',
      'build',
      '.git',
      '.next',
      'coverage',
      '.cache',
      '.husky',
      '.vscode',
      '.idea',
      '*.test.*',
      '*.spec.*',
      '__tests__',
      '__mocks__'
    ],
    maxDepth: 20,
    followSymlinks: false
  },
  
  astParsing: {
    plugins: [
      'jsx',
      'typescript',
      'classProperties',
      'objectRestSpread',
      'decorators-legacy',
      'asyncGenerators',
      'bigInt',
      'dynamicImport',
      'nullishCoalescingOperator',
      'optionalChaining'
    ],
    sourceType: 'unambiguous',
    allowReturnOutsideFunction: true
  },
  
  output: {
    htmlReport: true,
    jsonReport: false,
    verboseLogging: false
  }
};

export class ConfigManager {
  private config: OptimizerConfig;

  constructor(initialConfig?: Partial<OptimizerConfig>) {
    this.config = this.mergeConfig(DEFAULT_CONFIG, initialConfig || {});
  }

  static async loadFromFile(configPath: string): Promise<ConfigManager> {
    try {
      if (!fs.existsSync(configPath)) {
        logger.info(`Config file not found at ${configPath}, using defaults`);
        return new ConfigManager();
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const userConfig = JSON.parse(configContent);
      
      logger.info(`Loaded configuration from ${configPath}`);
      return new ConfigManager(userConfig);
    } catch (error) {
      logger.warn(`Failed to load config from ${configPath}:`, error);
      return new ConfigManager();
    }
  }

  static async loadFromProject(projectPath: string): Promise<ConfigManager> {
    const configFiles = [
      'optimizer.config.json',
      '.optimizer.config.json',
      'package.json'
    ];

    for (const configFile of configFiles) {
      const configPath = path.join(projectPath, configFile);
      
      if (fs.existsSync(configPath)) {
        try {
          if (configFile === 'package.json') {
            const packageJson = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (packageJson.optimizerConfig) {
              return new ConfigManager(packageJson.optimizerConfig);
            }
          } else {
            return await ConfigManager.loadFromFile(configPath);
          }
        } catch (error) {
          logger.warn(`Failed to load config from ${configPath}:`, error);
        }
      }
    }

    return new ConfigManager();
  }

  get(): OptimizerConfig {
    return { ...this.config };
  }

  update(updates: Partial<OptimizerConfig>): void {
    this.config = this.mergeConfig(this.config, updates);
  }

  saveToFile(filePath: string): void {
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.config, null, 2));
      logger.info(`Configuration saved to ${filePath}`);
    } catch (error) {
      logger.error(`Failed to save configuration to ${filePath}:`, error);
      throw error;
    }
  }

  private mergeConfig(base: OptimizerConfig, override: Partial<OptimizerConfig>): OptimizerConfig {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value !== undefined) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // @ts-ignore
          result[key] = { ...base[key], ...value };
        } else {
          // @ts-ignore
          result[key] = value;
        }
      }
    }

    return result;
  }
}

export const defaultConfig = new ConfigManager();
