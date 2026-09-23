'use strict';

/**
 * Offline Dependency Auditor (Gemstack 2.0 Sprint D)
 * Detects orphan dependencies, undeclared imports, and circular local import cycles offline.
 */

const fs = require('fs');
const path = require('path');
const fssafe = require('./filesystem-safe');

const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console',
  'constants', 'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain',
  'events', 'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector',
  'module', 'net', 'os', 'path', 'path/posix', 'path/win32', 'perf_hooks',
  'process', 'punycode', 'querystring', 'readline', 'repl', 'stream',
  'stream/promises', 'stream/consumers', 'stream/web', 'string_decoder',
  'test', 'timers', 'timers/promises', 'tls', 'trace_events', 'tty',
  'url', 'util', 'util/types', 'v8', 'vm', 'wasi', 'worker_threads', 'zlib'
]);

function isNodeBuiltin(moduleName) {
  if (moduleName.startsWith('node:')) return true;
  return NODE_BUILTINS.has(moduleName);
}

/**
 * Extracts import/require targets from file content.
 * @param {string} content 
 * @returns {Array<string>} List of required/imported module specifiers
 */
function extractImportsFromContent(content) {
  const imports = [];
  // Match require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let match;
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  // Match import ... from '...' or import('...')
  const importRegex = /(?:import\s+(?:[\s\S]*?from\s+)?|import\s*\()\s*['"]([^'"]+)['"]/g;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }

  return imports;
}

/**
 * Resolves package name from import specifier.
 * E.g., 'express' -> 'express', '@scope/pkg/sub' -> '@scope/pkg'
 */
function getPackageName(specifier) {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

/**
 * Scans directory recursively for JavaScript/TypeScript files.
 */
function collectSourceFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        collectSourceFiles(fullPath, files);
      }
    } else if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Detects circular dependency cycles using depth-first search.
 */
function findCircularCycles(dependencyGraph) {
  const cycles = [];
  const visited = new Set();
  const recursionStack = [];

  function dfs(node) {
    visited.add(node);
    recursionStack.push(node);

    const neighbors = dependencyGraph.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else {
        const cycleStartIndex = recursionStack.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          const cyclePath = [...recursionStack.slice(cycleStartIndex), neighbor];
          cycles.push(cyclePath);
        }
      }
    }

    recursionStack.pop();
  }

  for (const node of dependencyGraph.keys()) {
    if (!visited.has(node)) {
      dfs(node);
    }
  }

  return cycles;
}

/**
 * Audits project dependencies and local module cycles completely offline.
 * @param {string} targetDir - Directory containing package.json and src/
 * @returns {{ orphans: string[], undeclared: string[], circularCycles: string[][], is_clean: boolean }}
 */
function auditDependencies(targetDir) {
  const pkgPath = fssafe.resolveSafe(targetDir, 'package.json');
  let dependencies = {};
  let devDependencies = {};

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      dependencies = pkg.dependencies || {};
      devDependencies = pkg.devDependencies || {};
    } catch (_) {}
  }

  const srcDir = fssafe.resolveSafe(targetDir, 'src');
  const sourceFiles = collectSourceFiles(srcDir);

  const usedPackages = new Set();
  const dependencyGraph = new Map();

  for (const filePath of sourceFiles) {
    const normFile = filePath.replace(/\\/g, '/');
    dependencyGraph.set(normFile, []);

    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (_) {
      continue;
    }

    const imports = extractImportsFromContent(content);
    for (const imp of imports) {
      if (imp.startsWith('.')) {
        // Local relative import
        const resolvedPath = path.resolve(path.dirname(filePath), imp);
        const candidates = [
          resolvedPath,
          resolvedPath + '.js',
          resolvedPath + '.mjs',
          path.join(resolvedPath, 'index.js')
        ];
        const match = candidates.find(c => fs.existsSync(c) && fs.statSync(c).isFile());
        if (match) {
          const normNeighbor = match.replace(/\\/g, '/');
          dependencyGraph.get(normFile).push(normNeighbor);
        }
      } else if (!isNodeBuiltin(imp)) {
        // External package
        const pkgName = getPackageName(imp);
        usedPackages.add(pkgName);
      }
    }
  }

  // 1. Detect orphans (in dependencies but not used in src)
  const orphans = Object.keys(dependencies).filter(dep => !usedPackages.has(dep));

  // 2. Detect undeclared (used in src but missing from dependencies & devDependencies)
  const allDeclared = new Set([...Object.keys(dependencies), ...Object.keys(devDependencies)]);
  const undeclared = Array.from(usedPackages).filter(dep => !allDeclared.has(dep));

  // 3. Detect circular cycles
  const circularCycles = findCircularCycles(dependencyGraph);

  return {
    orphans,
    undeclared,
    circularCycles,
    is_clean: orphans.length === 0 && undeclared.length === 0 && circularCycles.length === 0
  };
}

module.exports = {
  isNodeBuiltin,
  extractImportsFromContent,
  auditDependencies,
  findCircularCycles
};
