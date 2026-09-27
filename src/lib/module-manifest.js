const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fssafe = require('./filesystem-safe');

/**
 * Computes deterministic SHA-256 hash of a module manifest.
 */
function computeModuleHash(targetDir, moduleName) {
  const modPath = path.join(targetDir, '.gemstack', 'modules', `${moduleName}.json`);
  if (!fs.existsSync(modPath)) {
    return 'sha256:' + crypto.createHash('sha256').update(`MISSING:${moduleName}`, 'utf8').digest('hex');
  }
  const raw = fs.readFileSync(modPath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    const sortedKeys = Object.keys(parsed).sort();
    const sortedObj = {};
    for (const k of sortedKeys) sortedObj[k] = parsed[k];
    const canonical = JSON.stringify(sortedObj);
    return 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  } catch (_) {
    return 'sha256:' + crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }
}

/**
 * Loads a module manifest from .gemstack/modules/<module>.json.
 */
function getModuleManifest(targetDir, moduleName) {
  const modPath = path.join(targetDir, '.gemstack', 'modules', `${moduleName}.json`);
  if (!fs.existsSync(modPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(modPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse module manifest at ${modPath}: ${err.message}`);
  }
}

/**
 * Saves a module manifest to .gemstack/modules/<module>.json.
 */
function saveModuleManifest(targetDir, manifest) {
  const modDir = path.join(targetDir, '.gemstack', 'modules');
  if (!fs.existsSync(modDir)) {
    fs.mkdirSync(modDir, { recursive: true });
  }
  const modPath = path.join(modDir, `${manifest.module}.json`);
  fssafe.withConfinedAtomicWrite(targetDir, path.join('.gemstack', 'modules', `${manifest.module}.json`), (tempFile) => {
    fs.writeFileSync(tempFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  });
  return modPath;
}

/**
 * Validates drift and boundary violations for a module manifest.
 * Returns { valid: boolean, findings: Array<{ code: string, message: string }> }
 */
function validateModuleDrift(targetDir, manifest) {
  const findings = [];
  if (!manifest || !manifest.module) {
    return { valid: false, findings: [{ code: 'INVALID_MANIFEST', message: 'Missing module name' }] };
  }

  // 1. Validate owned paths
  if (Array.isArray(manifest.owns)) {
    for (const p of manifest.owns) {
      // If it's a glob or directory, check base directory existence
      const basePath = p.replace(/\/\*\*.*$/, '').replace(/\/\*.*$/, '');
      const absPath = path.join(targetDir, basePath);
      if (!fs.existsSync(absPath)) {
        findings.push({
          code: 'MODULE_MANIFEST_DRIFT',
          message: `Module "${manifest.module}" owns non-existent base path: ${basePath}`
        });
      }
    }
  }

  // 2. Validate forbidden dependencies (static import check in owned source files)
  if (Array.isArray(manifest.forbiddenDependencies) && manifest.forbiddenDependencies.length > 0) {
    const forbidden = manifest.forbiddenDependencies;
    if (Array.isArray(manifest.owns)) {
      for (const pattern of manifest.owns) {
        const basePath = pattern.replace(/\/\*\*.*$/, '').replace(/\/\*.*$/, '');
        const absBase = path.join(targetDir, basePath);
        if (fs.existsSync(absBase)) {
          const filesToCheck = [];
          if (fs.statSync(absBase).isDirectory()) {
            const collect = (d) => {
              for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
                const full = path.join(d, entry.name);
                if (entry.isDirectory()) collect(full);
                else if (/\.(js|ts|jsx|tsx|mjs|cjs)$/.test(entry.name)) filesToCheck.push(full);
              }
            };
            collect(absBase);
          } else {
            filesToCheck.push(absBase);
          }

          for (const f of filesToCheck) {
            const content = fs.readFileSync(f, 'utf8');
            for (const fb of forbidden) {
              const regex = new RegExp(`(?:from|require\\s*\\()\\s*['"][^'"]*\\b${fb}\\b[^'"]*['"]`, 'i');
              if (regex.test(content)) {
                findings.push({
                  code: 'MODULE_BOUNDARY_VIOLATION',
                  message: `File ${path.relative(targetDir, f).replace(/\\/g, '/')} violates forbidden dependency on "${fb}"`
                });
              }
            }
          }
        }
      }
    }
  }

  // 3. Validate direct dependency modules exist
  if (Array.isArray(manifest.dependsOn)) {
    for (const dep of manifest.dependsOn) {
      const depModPath = path.join(targetDir, '.gemstack', 'modules', `${dep}.json`);
      if (!fs.existsSync(depModPath)) {
        findings.push({
          code: 'MODULE_MANIFEST_DRIFT',
          message: `Module "${manifest.module}" depends on missing module manifest: ${dep}`
        });
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

module.exports = {
  computeModuleHash,
  getModuleManifest,
  saveModuleManifest,
  validateModuleDrift
};
