/**
 * Gemstack Visual QA Validation & Baseline Engine (Upgrade E)
 *
 * Implements deterministic viewport validation, dynamic region masking,
 * cryptographic baseline hashing, and offline visual evidence comparison.
 *
 * ZERO RUNTIME DEPENDENCIES - Node.js built-ins exclusively.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizePath, hashFile } = require('./hasher');
const { createFinding } = require('./findings');
const fssafe = require('./filesystem-safe');

const VQA_SCHEMA_VERSION = '1.0.0';

const CANONICAL_VIEWPORT_PROFILES = {
  'desktop-standard': { width: 1920, height: 1080, device_scale_factor: 1 },
  'desktop-compact': { width: 1280, height: 800, device_scale_factor: 1 },
  'tablet-portrait': { width: 768, height: 1024, device_scale_factor: 2 },
  'mobile-portrait': { width: 375, height: 667, device_scale_factor: 2 }
};

/**
 * Parses and validates visual-qa.json manifest.
 *
 * @param {string|object} input - Raw JSON string or parsed object
 * @returns {object} Canonical parsed visual QA manifest
 */
function parseVisualManifest(input) {
  let parsed;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      const error = new Error(`Invalid JSON in visual-qa manifest: ${err.message}`);
      error.code = 'VQA_PARSE_ERROR';
      throw error;
    }
  } else if (input && typeof input === 'object') {
    parsed = input;
  } else {
    const error = new Error('Visual manifest input must be a JSON string or object.');
    error.code = 'VQA_INVALID_INPUT';
    throw error;
  }

  return validateVisualSchema(parsed);
}

/**
 * Validates the schema structure of visual-qa.json manifest.
 *
 * @param {object} manifest
 * @returns {object} Validated manifest
 */
function validateVisualSchema(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    const err = new Error('Visual manifest root must be a JSON object.');
    err.code = 'VQA_INVALID_MANIFEST';
    throw err;
  }

  if (manifest.version && manifest.version !== VQA_SCHEMA_VERSION) {
    const err = new Error(`Unsupported visual QA schema version: "${manifest.version}". Expected "${VQA_SCHEMA_VERSION}".`);
    err.code = 'VQA_INVALID_MANIFEST';
    throw err;
  }

  if (!manifest.feature_id || typeof manifest.feature_id !== 'string') {
    const err = new Error('Visual manifest must declare a valid "feature_id".');
    err.code = 'VQA_INVALID_MANIFEST';
    throw err;
  }

  if (!Array.isArray(manifest.scenarios)) {
    const err = new Error('Visual manifest must declare a "scenarios" array.');
    err.code = 'VQA_INVALID_MANIFEST';
    throw err;
  }

  const seenIds = new Set();
  for (const s of manifest.scenarios) {
    if (!s.scenario_id || typeof s.scenario_id !== 'string') {
      const err = new Error('Every visual QA scenario must declare an explicit "scenario_id".');
      err.code = 'VQA_INVALID_MANIFEST';
      throw err;
    }

    if (seenIds.has(s.scenario_id)) {
      const err = new Error(`Duplicate scenario_id detected: "${s.scenario_id}".`);
      err.code = 'VQA_INVALID_MANIFEST';
      throw err;
    }
    seenIds.add(s.scenario_id);

    if (!s.route || typeof s.route !== 'string') {
      const err = new Error(`Scenario "${s.scenario_id}" is missing required "route".`);
      err.code = 'VQA_INVALID_MANIFEST';
      throw err;
    }

    if (!s.viewport || typeof s.viewport !== 'object') {
      const err = new Error(`Scenario "${s.scenario_id}" is missing required "viewport" configuration.`);
      err.code = 'VQA_INVALID_MANIFEST';
      throw err;
    }

    validateViewport(s.viewport, s.scenario_id);
  }

  return manifest;
}

/**
 * Validates deterministic viewport dimensions and profiles.
 *
 * @param {object} viewport - Viewport declaration
 * @param {string} [scenarioId='unknown']
 * @returns {boolean} True if valid; throws if invalid
 */
function validateViewport(viewport, scenarioId = 'unknown') {
  if (!viewport || typeof viewport !== 'object') {
    const err = new Error(`Scenario "${scenarioId}": Viewport must be an object.`);
    err.code = 'VQA_INVALID_VIEWPORT';
    throw err;
  }

  const { width, height, device_scale_factor } = viewport;

  if (typeof width !== 'number' || width <= 0 || !Number.isInteger(width)) {
    const err = new Error(`Scenario "${scenarioId}": Viewport width must be a positive integer.`);
    err.code = 'VQA_INVALID_VIEWPORT';
    throw err;
  }

  if (typeof height !== 'number' || height <= 0 || !Number.isInteger(height)) {
    const err = new Error(`Scenario "${scenarioId}": Viewport height must be a positive integer.`);
    err.code = 'VQA_INVALID_VIEWPORT';
    throw err;
  }

  if (device_scale_factor !== undefined) {
    if (typeof device_scale_factor !== 'number' || device_scale_factor <= 0) {
      const err = new Error(`Scenario "${scenarioId}": Viewport device_scale_factor must be a positive number.`);
      err.code = 'VQA_INVALID_VIEWPORT';
      throw err;
    }
  }

  return true;
}

/**
 * Validates capture environment metadata match against scenario expectations.
 *
 * @param {object} scenario - Scenario object
 * @param {object} evidence - Submitted evidence object
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateEnvironmentMetadata(scenario, evidence) {
  const findings = [];
  if (!evidence || !evidence.environment) {
    return { valid: true, findings: [] };
  }

  const expViewport = scenario.viewport || {};
  const actEnv = evidence.environment || {};

  if (actEnv.color_scheme && expViewport.color_scheme) {
    if (actEnv.color_scheme !== expViewport.color_scheme) {
      findings.push(createFinding({
        code: 'VQA_ENVIRONMENT_MISMATCH',
        contractId: 'deterministic-viewports',
        phase: 'visual-qa',
        location: scenario.scenario_id,
        details: `Color scheme mismatch for scenario "${scenario.scenario_id}": expected "${expViewport.color_scheme}", got "${actEnv.color_scheme}".`
      }));
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Applies neutral masking rules to dynamic selectors and sensitive inputs.
 *
 * @param {string} domHtml - Serialized DOM HTML or structure
 * @param {Array<string>} maskSelectors - Custom mask selectors
 * @returns {string} Masked DOM structure
 */
function applySelectorMasks(domHtml, maskSelectors = []) {
  if (!domHtml || typeof domHtml !== 'string') return '';

  let masked = domHtml;

  // 1. Mandatory secret auto-masking: replace password values with solid mask
  masked = masked.replace(/type=["']password["'][^>]*value=["'][^"']*["']/gi, 'type="password" value="[MASKED_SECRET]"');
  masked = masked.replace(/data-sensitive=["']true["'][^>]*>([^<]*)<\//gi, 'data-sensitive="true">[MASKED_SECRET]</');

  // 2. Custom selector masking (timestamps, live avatars)
  for (const sel of maskSelectors) {
    const cleanSel = sel.replace(/[.#]/, '');
    const regex = new RegExp(`class=["'][^"']*\\b${cleanSel}\\b[^"']*["'][^>]*>([^<]*)<\\/`, 'gi');
    masked = masked.replace(regex, `class="${cleanSel}">[MASKED_NEUTRAL]</`);
  }

  return masked;
}

/**
 * Validates baseline image integrity and cryptographic hash.
 *
 * @param {object} scenario - Scenario object
 * @param {string} targetDir - Repository target directory
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateBaselineIntegrity(scenario, targetDir) {
  const findings = [];
  const baseline = scenario.baseline;

  if (!baseline) {
    findings.push(createFinding({
      code: 'VQA_BASELINE_MISSING',
      contractId: 'visual-evidence-subordinate',
      phase: 'visual-qa',
      location: scenario.scenario_id,
      details: `Scenario "${scenario.scenario_id}" does not declare a baseline.`
    }));
    return { valid: false, findings };
  }

  const imgPath = path.join(targetDir, baseline.image_path);
  if (!fs.existsSync(imgPath)) {
    findings.push(createFinding({
      code: 'VQA_BASELINE_MISSING',
      contractId: 'visual-evidence-subordinate',
      phase: 'visual-qa',
      location: baseline.image_path,
      details: `Baseline image file "${baseline.image_path}" does not exist on disk.`
    }));
    return { valid: false, findings };
  }

  const { hashFile } = require('./hasher');
  const liveHash = hashFile(imgPath);

  if (liveHash !== baseline.image_sha256) {
    findings.push(createFinding({
      code: 'VQA_BASELINE_TAMPERED',
      contractId: 'baseline-explicit-update-only',
      phase: 'visual-qa',
      location: baseline.image_path,
      details: `Baseline image "${baseline.image_path}" was modified on disk without explicit promotion. Recorded: ${baseline.image_sha256.slice(0, 12)}..., Actual: ${liveHash.slice(0, 12)}...`
    }));
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Sanitizes and masks sensitive input fields and tokens before visual capture persistence.
 *
 * @param {string} content - HTML or DOM text
 * @returns {string} Sanitized content with sensitive data masked
 */
function maskSensitiveFieldsBeforeCapture(content) {
  if (!content || typeof content !== 'string') return content;
  let masked = content;

  // 1. Password input values
  masked = masked.replace(/(<input\b[^>]*\btype\s*=\s*["']?password["']?[^>]*\bvalue\s*=\s*["'])([^"']*)(["'])/gi, '$1[MASKED_PASSWORD]$3');
  masked = masked.replace(/(<input\b[^>]*\bvalue\s*=\s*["'])([^"']*)(["'][^>]*\btype\s*=\s*["']?password["']?[^>]*>)/gi, '$1[MASKED_PASSWORD]$3');

  // 2. Sensitive ids or names (password, token, secret, key, credit_card, card)
  masked = masked.replace(/(<input\b[^>]*(?:\bid|\bname)\s*=\s*["']?[^"']*(?:password|token|secret|key|credit_card|card)[^"']*["']?[^>]*\bvalue\s*=\s*["'])([^"']*)(["'])/gi, '$1[MASKED_SENSITIVE]$3');
  masked = masked.replace(/(<input\b[^>]*\bvalue\s*=\s*["'])([^"']*)(["'][^>]*(?:\bid|\bname)\s*=\s*["']?[^"']*(?:password|token|secret|key|credit_card|card)[^"']*["']?[^>]*>)/gi, '$1[MASKED_SENSITIVE]$3');

  // 3. API Keys and Tokens in attributes or text
  masked = masked.replace(/sk-(?:live_|proj-)?[a-zA-Z0-9_-]{10,}/g, '[MASKED_KEY]');

  // 4. Credit card numbers (13-19 consecutive digits or grouped with spaces/dashes)
  masked = masked.replace(/\b(?:\d{4}[ -]?){3,4}\d{1,4}\b/g, '[MASKED_CARD]');

  return masked;
}

/**
 * Compares live visual evidence against canonical baseline with honest disk recomputation.
 *
 * @param {object} scenario - Scenario definition
 * @param {object} evidence - Submitted evidence object
 * @param {string} targetDir - Repository target directory
 * @param {object} [options={}] - Additional options (e.g. diffAdapter)
 * @returns {{ status: string, passed: boolean, diff_percentage: number, findings: Array<object> }}
 */
function compareVisualEvidence(scenario, evidence, targetDir, options = {}) {
  const findings = [];
  const baseline = scenario.baseline;

  if (!evidence) {
    findings.push(createFinding({
      code: 'VQA_EVIDENCE_MISSING',
      contractId: 'visual-evidence-subordinate',
      phase: 'visual-qa',
      location: scenario.scenario_id,
      details: `Scenario "${scenario.scenario_id}" has no submitted live evidence.`
    }));
    return { status: 'EVIDENCE_MISSING', passed: false, diff_percentage: 1.0, findings };
  }

  if (!baseline) {
    findings.push(createFinding({
      code: 'VQA_BASELINE_MISSING',
      contractId: 'visual-evidence-subordinate',
      phase: 'visual-qa',
      location: scenario.scenario_id,
      details: `Scenario "${scenario.scenario_id}" has no baseline.`
    }));
    return { status: 'BASELINE_MISSING', passed: false, diff_percentage: 1.0, findings };
  }

  let effectiveLiveHash = evidence.image_sha256;
  let effectiveBaselineHash = baseline.image_sha256;

  // Recompute hashes directly from disk files if targetDir and paths are available
  if (targetDir) {
    if (baseline.image_path) {
      try {
        const absBaselinePath = fssafe.resolveSafeStrict(targetDir, baseline.image_path);
        if (fs.existsSync(absBaselinePath)) {
          const diskBaselineHash = hashFile(absBaselinePath);
          if (baseline.image_sha256 && diskBaselineHash !== baseline.image_sha256) {
            findings.push(createFinding({
              code: 'VQA_BASELINE_TAMPERED',
              contractId: 'baseline-explicit-update-only',
              phase: 'visual-qa',
              location: baseline.image_path,
              details: `Baseline image "${baseline.image_path}" was modified on disk. Recorded: ${baseline.image_sha256}, Actual: ${diskBaselineHash}.`
            }));
            return { status: 'BASELINE_TAMPERED', passed: false, diff_percentage: 1.0, findings };
          }
          effectiveBaselineHash = diskBaselineHash;
        }
      } catch (err) {
        findings.push(createFinding({
          code: 'VQA_BASELINE_TAMPERED',
          contractId: 'baseline-explicit-update-only',
          phase: 'visual-qa',
          location: baseline.image_path,
          details: `Error validating baseline path: ${err.message}`
        }));
        return { status: 'BASELINE_TAMPERED', passed: false, diff_percentage: 1.0, findings };
      }
    }

    const livePathCandidate = evidence.live_screenshot_path || (evidence.image_path && fs.existsSync(fssafe.resolveSafe(targetDir, evidence.image_path)) ? evidence.image_path : null);
    if (livePathCandidate) {
      try {
        const absLivePath = fssafe.resolveSafeStrict(targetDir, livePathCandidate);
        if (!fs.existsSync(absLivePath)) {
          findings.push(createFinding({
            code: 'VQA_IMAGE_NOT_FOUND',
            contractId: 'visual-evidence-subordinate',
            phase: 'visual-qa',
            location: scenario.scenario_id,
            details: `Live screenshot file not found: ${livePathCandidate}`
          }));
          return { status: 'EVIDENCE_MISSING', passed: false, diff_percentage: 1.0, findings };
        }
        const diskLiveHash = hashFile(absLivePath);
        if (evidence.image_sha256 && evidence.image_sha256 !== diskLiveHash) {
          findings.push(createFinding({
            code: 'VQA_EVIDENCE_HASH_MISMATCH',
            contractId: 'visual-evidence-subordinate',
            phase: 'visual-qa',
            location: scenario.scenario_id,
            details: `Submitted evidence image_sha256 (${evidence.image_sha256}) does not match disk file hash (${diskLiveHash}).`
          }));
          return { status: 'EVIDENCE_HASH_MISMATCH', passed: false, diff_percentage: 1.0, findings };
        }
        effectiveLiveHash = diskLiveHash;
      } catch (err) {
        findings.push(createFinding({
          code: 'VQA_IMAGE_NOT_FOUND',
          contractId: 'visual-evidence-subordinate',
          phase: 'visual-qa',
          location: scenario.scenario_id,
          details: `Error validating live screenshot path: ${err.message}`
        }));
        return { status: 'EVIDENCE_MISSING', passed: false, diff_percentage: 1.0, findings };
      }
    }
  }

  // Fast-path: SHA-256 match from verified disk hashes
  if (effectiveLiveHash && effectiveBaselineHash && effectiveLiveHash === effectiveBaselineHash) {
    return {
      status: 'PASS',
      passed: true,
      diff_percentage: 0.0,
      findings: []
    };
  }

  // Evaluate tolerances and real diff adapter
  const maxDiff = (scenario.tolerances && scenario.tolerances.max_diff_percentage !== undefined)
    ? scenario.tolerances.max_diff_percentage
    : 0.00;

  const diffAdapter = (options && options.diffAdapter) || (evidence && evidence.diffAdapter);

  if (diffAdapter && typeof diffAdapter.computeDiff === 'function') {
    let baselineBuf = null;
    let liveBuf = null;
    if (targetDir && baseline.image_path) {
      try { baselineBuf = fs.readFileSync(fssafe.resolveSafeStrict(targetDir, baseline.image_path)); } catch {}
    }
    const liveRel = evidence.live_screenshot_path || evidence.image_path;
    if (targetDir && liveRel) {
      try { liveBuf = fs.readFileSync(fssafe.resolveSafeStrict(targetDir, liveRel)); } catch {}
    }

    const diffResult = diffAdapter.computeDiff(baselineBuf, liveBuf, scenario.tolerances);
    const observedDiff = typeof diffResult.diff_percentage === 'number' ? diffResult.diff_percentage : 0.0;

    if (observedDiff > maxDiff) {
      findings.push(createFinding({
        code: 'VQA_VISUAL_REGRESSION',
        contractId: 'visual-evidence-subordinate',
        phase: 'visual-qa',
        location: scenario.scenario_id,
        details: `Visual regression on "${scenario.scenario_id}": observed diff ${observedDiff} exceeds maximum allowed ${maxDiff}.`
      }));
      return {
        status: 'VISUAL_REGRESSION',
        passed: false,
        diff_percentage: observedDiff,
        findings
      };
    }

    return {
      status: 'PASS',
      passed: true,
      diff_percentage: observedDiff,
      findings: []
    };
  }

  // If no diff adapter is provided:
  const observedDiff = typeof evidence.diff_percentage === 'number' ? evidence.diff_percentage : 0.05;

  if (observedDiff > maxDiff) {
    findings.push(createFinding({
      code: 'VQA_VISUAL_REGRESSION',
      contractId: 'visual-evidence-subordinate',
      phase: 'visual-qa',
      location: scenario.scenario_id,
      details: `Visual regression on "${scenario.scenario_id}": observed diff ${observedDiff} exceeds maximum allowed ${maxDiff}.`
    }));
    return {
      status: 'VISUAL_REGRESSION',
      passed: false,
      diff_percentage: observedDiff,
      findings
    };
  }

  // When live screenshot differs from baseline and caller claims low diff without adapter: FAIL-CLOSED UNVERIFIED
  findings.push(createFinding({
    code: 'VQA_DIFF_ENGINE_UNAVAILABLE',
    contractId: 'visual-evidence-subordinate',
    phase: 'visual-qa',
    location: scenario.scenario_id,
    details: `Visual deviation detected on "${scenario.scenario_id}" but no diff engine adapter is available. Status UNVERIFIED.`
  }));

  return {
    status: 'UNVERIFIED',
    passed: false,
    diff_percentage: observedDiff,
    findings
  };
}

/**
 * Promotes a live evidence capture to canonical baseline status.
 *
 * @param {string} targetDir - Repository target directory
 * @param {string} featureId - Active feature directory path
 * @param {string} scenarioId - Target scenario ID
 * @param {string} liveImagePath - Relative path to captured screenshot
 * @param {string} approvedBy - Approver role/identity
 * @returns {{ success: boolean, updatedManifest: object }}
 */
function promoteVisualBaseline(targetDir, featureId, scenarioId, liveImagePath, approvedBy = 'human-lead') {
  const manifestPath = path.join(targetDir, featureId, 'visual-qa.json');
  if (!fs.existsSync(manifestPath)) {
    const err = new Error(`visual-qa.json not found in "${featureId}".`);
    err.code = 'VQA_MANIFEST_NOT_FOUND';
    throw err;
  }

  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = parseVisualManifest(raw);

  const scenario = (manifest.scenarios || []).find(s => s.scenario_id === scenarioId);
  if (!scenario) {
    const err = new Error(`Scenario "${scenarioId}" not found in manifest.`);
    err.code = 'VQA_SCENARIO_NOT_FOUND';
    throw err;
  }

  const absLivePath = path.join(targetDir, liveImagePath);
  if (!fs.existsSync(absLivePath)) {
    const err = new Error(`Live image file "${liveImagePath}" not found.`);
    err.code = 'VQA_IMAGE_NOT_FOUND';
    throw err;
  }

  const { hashFile } = require('./hasher');
  const imgHash = hashFile(absLivePath);

  // Copy to canonical baselines directory
  const baselinesDir = path.join(targetDir, featureId, 'baselines');
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }

  const canonicalRelPath = path.posix.join(featureId.replace(/\\/g, '/'), 'baselines', `${scenarioId.toLowerCase()}.png`);
  const canonicalAbsPath = path.join(targetDir, canonicalRelPath);
  fs.copyFileSync(absLivePath, canonicalAbsPath);

  scenario.baseline = {
    image_path: canonicalRelPath,
    image_sha256: imgHash,
    dom_hash: scenario.baseline ? scenario.baseline.dom_hash : 'd0m_h4sh_pr0m0t3d',
    approved_by: approvedBy,
    approved_at: new Date().toISOString()
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    success: true,
    updatedManifest: manifest
  };
}

/**
 * Validates a complete visual-qa.json file in read-only mode.
 *
 * @param {string} targetDir - Repository target directory
 * @param {string} featureId - Active feature directory path
 * @returns {{ valid: boolean, state: string, findings: Array<object> }}
 */
function validateVisualManifest(targetDir, featureId) {
  const manifestPath = path.join(targetDir, featureId, 'visual-qa.json');
  if (!fs.existsSync(manifestPath)) {
    return {
      valid: false,
      state: 'MISSING',
      findings: []
    };
  }

  let raw;
  try {
    raw = fs.readFileSync(manifestPath, 'utf8');
  } catch (err) {
    return {
      valid: false,
      state: 'UNREADABLE',
      findings: [createFinding({
        code: 'VQA_UNREADABLE',
        contractId: 'visual-evidence-subordinate',
        phase: 'visual-qa',
        location: manifestPath,
        details: err.message
      })]
    };
  }

  let manifest;
  try {
    manifest = parseVisualManifest(raw);
  } catch (err) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [createFinding({
        code: 'VQA_INVALID_MANIFEST',
        contractId: 'visual-evidence-subordinate',
        phase: 'visual-qa',
        location: manifestPath,
        details: err.message
      })]
    };
  }

  const findings = [];
  const scenarios = manifest.scenarios || [];

  for (const s of scenarios) {
    // 1. Viewport check
    try {
      validateViewport(s.viewport, s.scenario_id);
    } catch (vErr) {
      findings.push(createFinding({
        code: 'VQA_INVALID_VIEWPORT',
        contractId: 'deterministic-viewports',
        phase: 'visual-qa',
        location: s.scenario_id,
        details: vErr.message
      }));
    }

    // 2. Baseline integrity check
    const baseCheck = validateBaselineIntegrity(s, targetDir);
    findings.push(...baseCheck.findings);
  }

  return {
    valid: findings.length === 0,
    state: findings.length === 0 ? 'VALID' : 'INVALID',
    findings
  };
}

module.exports = {
  VQA_SCHEMA_VERSION,
  CANONICAL_VIEWPORT_PROFILES,
  parseVisualManifest,
  validateVisualSchema,
  validateViewport,
  validateEnvironmentMetadata,
  applySelectorMasks,
  maskSensitiveFieldsBeforeCapture,
  validateBaselineIntegrity,
  compareVisualEvidence,
  promoteVisualBaseline,
  validateVisualManifest
};
