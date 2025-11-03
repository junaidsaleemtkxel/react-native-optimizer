// src/packageAnalyzer.ts
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import https from 'https';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * React Native Optimizer
 * production-grade package analysis utilities
 *
 * Key features:
 * - async non-blocking file IO
 * - concurrency control for parsing and network access
 * - npm registry caching + retries + timeout
 * - safe AST parsing and robust error handling
 */

/* ---------------------------
   Types
   --------------------------- */

export interface UnusedPackage {
  name: string;
  version: string;
  size: number; // bytes
  type: 'dependencies' | 'devDependencies';
  estimatedSize?: string;
}

export interface DeprecatedPackage {
  name: string;
  version: string;
  deprecatedMessage?: string;
  type: 'dependencies' | 'devDependencies';
  suggestedReplacement?: string;
}

export interface PackageAnalysisResult {
  unusedPackages: UnusedPackage[];
  deprecatedPackages: DeprecatedPackage[];
  totalUnusedSize: number;
  suggestions: string[];
}

/* ---------------------------
   Config / helpers
   --------------------------- */

const DEFAULT_AST_PLUGINS: any[] = [
  'jsx',
  'typescript',
  'classProperties',
  'objectRestSpread',
  'decorators-legacy',
];

const DEFAULT_CONCURRENCY = 8; // number of files / requests processed in parallel
const NPM_FETCH_TIMEOUT = 8_000; // ms
const NPM_BATCH_DELAY = 120; // ms between batches to be polite

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function basePackageName(specifier: string): string {
  if (!specifier) return specifier;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : specifier;
  }
  return specifier.split('/')[0];
}

function isExternalModule(specifier: string): boolean {
  return !specifier.startsWith('.') && !path.isAbsolute(specifier);
}

/* ---------------------------
   Simple concurrency limiter
   --------------------------- */

function pLimit(concurrency: number) {
  const queue: Array<() => void> = [];
  let active = 0;

  const next = () => {
    active--;
    if (queue.length > 0) {
      const fn = queue.shift()!;
      fn();
    }
  };

  return function <T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        fn()
          .then(resolve)
          .catch(reject)
          .finally(next);
      };

      if (active < concurrency) {
        run();
      } else {
        queue.push(run);
      }
    });
  };
}

/* ---------------------------
   File scanning — find source files
   - you can replace this with your existing getSourceFiles for consistency
   --------------------------- */

async function collectSourceFiles(root: string, exts = ['.js', '.jsx', '.ts', '.tsx']) {
  const files: string[] = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fsPromises.readdir(current, { withFileTypes: true });
    } catch (err) {
      // ignore unreadable folders
      continue;
    }

    for (const entry of entries) {
      const full = path.join(current, entry.name);

      // skip node_modules and hidden folders
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;

      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        if (exts.includes(path.extname(entry.name))) {
          files.push(full);
        }
      }
    }
  }

  return files;
}

/* ---------------------------
   AST-based importer collector
   --------------------------- */

export async function getImportedPackages(projectPath: string, concurrency = DEFAULT_CONCURRENCY): Promise<Set<string>> {
  const sourceRoot = projectPath;
  const files = await collectSourceFiles(sourceRoot);
  const imported = new Set<string>();

  const limit = pLimit(concurrency);

  const parsePromises = files.map((file) =>
    limit(async () => {
      let content: string;
      try {
        content = await fsPromises.readFile(file, 'utf8');
        if (!content.trim()) return;
      } catch {
        return; // unreadable file -> skip
      }

      // Attempt to parse; tolerate parse errors.
      let ast;
      try {
        ast = parse(content, {
          sourceType: 'unambiguous',
          plugins: DEFAULT_AST_PLUGINS,
        });
      } catch (err) {
        // If parsing fails, try relaxed options (strip TypeScript plugin if needed)
        try {
          ast = parse(content, { sourceType: 'unambiguous', plugins: ['jsx'] });
        } catch {
          // give up on this file
          return;
        }
      }

      try {
        traverse(ast, {
          ImportDeclaration(path: any) {
            const src = path.node.source?.value;
            if (typeof src === 'string' && isExternalModule(src)) {
              imported.add(basePackageName(src));
            }
          },
          CallExpression(path: any) {
            const callee = path.node.callee;
            // require('module')
            if (callee.type === 'Identifier' && callee.name === 'require') {
              const arg = path.node.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const src = arg.value;
                if (isExternalModule(src)) imported.add(basePackageName(src));
              }
            }
          },
          Import(path: any) {
            // dynamic import(...) - parent is CallExpression
            const parent = path.parent;
            if (parent && parent.type === 'CallExpression') {
              const arg = parent.arguments[0];
              if (arg && arg.type === 'StringLiteral') {
                const src = arg.value;
                if (isExternalModule(src)) imported.add(basePackageName(src));
              }
            }
          },
        });
      } catch {
        // traverse errors -> ignore file
      }
    })
  );

  await Promise.all(parsePromises);
  return imported;
}

/* ---------------------------
   Package size calculation (iterative)
   --------------------------- */

export async function getPackageSize(packagePath: string): Promise<number> {
  let total = 0;
  const stack = [packagePath];

  while (stack.length) {
    const cur = stack.pop()!;
    let stat: fs.Stats;
    try {
      stat = await fsPromises.lstat(cur);
    } catch {
      continue;
    }

    if (stat.isDirectory()) {
      let entries: fs.Dirent[];
      try {
        entries = await fsPromises.readdir(cur, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        // skip symlink loops and inaccessible items
        stack.push(path.join(cur, e.name));
      }
    } else if (stat.isFile()) {
      total += stat.size;
    } else {
      // ignore other types (sockets, pipes)
    }
  }

  return total;
}

/* ---------------------------
   NPM registry fetch (with timeout, retry, caching)
   --------------------------- */

type NpmPackageMetadata = any;
const npmCache = new Map<string, NpmPackageMetadata>();

function httpsGetJson(url: string, timeout = NPM_FETCH_TIMEOUT): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Accept: 'application/vnd.npm.install-v1+json' } }, (res: any) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: any) => chunks.push(Buffer.from(c)));
      res.on('end', () => {
        try {
          const raw = Buffer.concat(chunks).toString('utf8');
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode || 0, json });
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', (err: any) => reject(err));
    req.setTimeout(timeout, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

async function fetchNpmMetadata(packageName: string): Promise<NpmPackageMetadata | null> {
  if (npmCache.has(packageName)) return npmCache.get(packageName)!;

  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;

  // simple retry strategy: 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { status, json } = await httpsGetJson(url);
      if (status >= 200 && status < 300) {
        npmCache.set(packageName, json);
        return json;
      } else if (status === 404) {
        return null;
      }
      // otherwise try again
    } catch (err) {
      if (attempt === 2) return null;
      // small backoff
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
  return null;
}

export async function checkDeprecated(packageName: string, rawVersion: string | undefined): Promise<{ deprecated?: string; suggestedReplacement?: string } | null> {
  try {
    const metadata = await fetchNpmMetadata(packageName);
    if (!metadata) return null;

    // Clean version token
    const cleanVersion = (rawVersion || '').replace(/^[\^~><=\s]*/g, '');

    // Check specific version
    if (cleanVersion && metadata.versions && metadata.versions[cleanVersion] && metadata.versions[cleanVersion].deprecated) {
      return { deprecated: metadata.versions[cleanVersion].deprecated };
    }

    // Check latest version deprecation
    const latest = metadata['dist-tags']?.latest;
    if (latest && metadata.versions?.[latest]?.deprecated) {
      return { deprecated: metadata.versions[latest].deprecated };
    }

    // Not deprecated
    return null;
  } catch {
    return null;
  }
}

/* ---------------------------
   Batch check deprecated packages (with concurrency)
   --------------------------- */

export async function checkDeprecatedPackages(
  packages: Record<string, string>,
  dependencies: Record<string, any>,
  devDependencies: Record<string, any>,
  concurrency = DEFAULT_CONCURRENCY
): Promise<DeprecatedPackage[]> {
  const entries = Object.entries(packages);
  const results: DeprecatedPackage[] = [];
  const limit = pLimit(concurrency);

  for (let i = 0; i < entries.length; i += concurrency) {
    const batch = entries.slice(i, i + concurrency);

    const checks = batch.map(([name, version]) =>
      limit(async () => {
        const info = await checkDeprecated(name, version);
        if (info?.deprecated) {
          const type: 'dependencies' | 'devDependencies' = dependencies && Object.prototype.hasOwnProperty.call(dependencies, name) ? 'dependencies' : 'devDependencies';
          const suggestedReplacement = undefined; // placeholder: advanced heuristics could fill this
          return {
            name,
            version: (version || '').toString(),
            deprecatedMessage: info.deprecated,
            type,
            suggestedReplacement,
          } as DeprecatedPackage;
        }
        return null;
      })
    );

    const settled = await Promise.allSettled(checks);
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value) results.push(s.value);
    }

    // friendly delay
    if (i + concurrency < entries.length) {
      await new Promise((r) => setTimeout(r, NPM_BATCH_DELAY));
    }
  }

  return results;
}

/* ---------------------------
   Main exported function: analyzePackages
   --------------------------- */

const DEFAULT_SKIP_PATTERNS = [
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
];

export async function analyzePackages(projectPath: string): Promise<PackageAnalysisResult> {
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    try {
      await fsPromises.access(packageJsonPath);
    } catch {
      return {
        unusedPackages: [],
        deprecatedPackages: [],
        totalUnusedSize: 0,
        suggestions: ['No package.json found'],
      };
    }

    const raw = await fsPromises.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(raw);
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    const allPackages: Record<string, string> = { ...dependencies, ...devDependencies };

    // Gather imported packages from source files
    const importedPackages = await getImportedPackages(projectPath);

    // Identify unused packages (excluding common tooling packages)
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const unusedPackages: UnusedPackage[] = [];
    let totalUnusedSize = 0;

    // Limit concurrency for size checking
    const sizeLimit = pLimit(DEFAULT_CONCURRENCY);

    const entries = Object.entries(allPackages);

    const sizeChecks = entries.map(([name, version]) =>
      (async () => {
        // Skip obvious tooling packages
        if (DEFAULT_SKIP_PATTERNS.some((pat) => name.includes(pat))) return null;

        if (importedPackages.has(name)) return null;

        // It's unused according to imports; compute size if installed
        const pkgPath = path.join(nodeModulesPath, name);
        const exists = await fsPromises.stat(pkgPath).then(() => true).catch(() => false);
        const size = exists ? await sizeLimit(() => getPackageSize(pkgPath)) : 0;

        const type: 'dependencies' | 'devDependencies' = dependencies && Object.prototype.hasOwnProperty.call(dependencies, name) ? 'dependencies' : 'devDependencies';

        totalUnusedSize += size;

        return {
          name,
          version: version.toString(),
          size,
          type,
          estimatedSize: formatBytes(size),
        } as UnusedPackage;
      })()
    );

    // Resolve all size checks
    const resolved = await Promise.all(sizeChecks);
    for (const u of resolved) {
      if (u) unusedPackages.push(u);
    }

    // Check deprecated packages (network calls)
    const deprecatedPackages = await checkDeprecatedPackages(allPackages, dependencies, devDependencies);

    // Build suggestions
    const suggestions: string[] = [];
    if (unusedPackages.length > 0) {
      suggestions.push(`Remove ${unusedPackages.length} unused package(s) to save ${formatBytes(totalUnusedSize)}`);
      suggestions.push(`Run: npm uninstall ${unusedPackages.map((p) => p.name).join(' ')}`);
    }
    if (deprecatedPackages.length > 0) {
      suggestions.push(`Update ${deprecatedPackages.length} deprecated package(s) for security and compatibility`);
      deprecatedPackages.forEach((pkg) => {
        if (pkg.suggestedReplacement) {
          suggestions.push(`Replace ${pkg.name} with ${pkg.suggestedReplacement}`);
        }
      });
    }
    if (unusedPackages.length === 0 && deprecatedPackages.length === 0) {
      suggestions.push('✅ All packages appear used and not deprecated (based on registry checks)');
    }

    // Limit results to keep reports readable
    const topUnused = unusedPackages.sort((a, b) => b.size - a.size).slice(0, 50);
    const topDeprecated = deprecatedPackages.slice(0, 50);

    return {
      unusedPackages: topUnused,
      deprecatedPackages: topDeprecated,
      totalUnusedSize,
      suggestions,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      unusedPackages: [],
      deprecatedPackages: [],
      totalUnusedSize: 0,
      suggestions: [`Package analysis failed: ${message}`],
    };
  }
}
