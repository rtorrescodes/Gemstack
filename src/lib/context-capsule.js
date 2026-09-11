const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { hashFile, normalizePath } = require('./hasher');
const { extractContractsBlock, validateContractSchemas } = require('./contracts');
const { extractTestMatrixBlock, validateTestMatrix, computeAcceptanceSignature } = require('./test-matrix');
const { parseTaskMetadata } = require('./closure-context');

const SCHEMA_VERSION = 1;
const TARGET_SIZE_BUDGET_BYTES = 32768; // 32 KB
const HARD_SIZE_LIMIT_BYTES = 65536;    // 64 KB

const FORBIDDEN_PROPERTY_KEYS = new Set([
  'apiKey',
  'api_key',
  'token',
  'accessToken',
  'access_token',
  'secret',
  'clientSecret',
  'password',
  'credentials'
]);

const SECRET_VALUE_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9_]{36,}/,
  /sk-[A-Za-z0-9_-]{20,}/,
  /AIza[0-9A-Za-z-_]{30,}/,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  /-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/
];

/**
 * Sorts array elements deterministically by identifier if available.
 */
function sortArrayDeterministically(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return arr;
  const copy = [...arr];

  if (typeof copy[0] === 'string') {
    return copy.sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  }

  if (typeof copy[0] === 'object' && copy[0] !== null) {
    if ('path' in copy[0]) {
      return copy.sort((a, b) => (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0)));
    }
    if ('id' in copy[0]) {
      return copy.sort((a, b) => (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)));
    }
    if ('feature' in copy[0]) {
      return copy.sort((a, b) => (a.feature < b.feature ? -1 : (a.feature > b.feature ? 1 : 0)));
    }
  }

  return copy;
}

/**
 * Recursively orders all object keys by UTF-16 code units.
 */
function canonicalizeObject(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    const sorted = sortArrayDeterministically(value);
    return sorted.map(canonicalizeObject);
  }

  const sortedKeys = Object.keys(value).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  const result = {};
  for (const k of sortedKeys) {
    result[k] = canonicalizeObject(value[k]);
  }
  return result;
}

/**
 * Serializes object to canonical UTF-8 JSON with sorted keys, 2-space indentation, and LF newline.
 */
function serializeCanonicalJson(data) {
  const canonical = canonicalizeObject(data);
  return JSON.stringify(canonical, null, 2) + '\n';
}

/**
 * Computes semantic digest of capsule, excluding volatile timestamps.
 */
function computeCapsuleSemanticHash(capsuleObj) {
  const copy = JSON.parse(JSON.stringify(capsuleObj));
  delete copy.generated_at;
  const canonical = canonicalizeObject(copy);
  return crypto.createHash('sha256').update(JSON.stringify(canonical), 'utf8').digest('hex');
}

/**
 * Recursively scans object for forbidden credential properties or token patterns.
 * Throws fail-closed error if detected.
 */
function assertSecretsForbidden(obj, pathPrefix = '') {
  if (obj === null || typeof obj !== 'object') {
    if (typeof obj === 'string') {
      for (const pattern of SECRET_VALUE_PATTERNS) {
        if (pattern.test(obj)) {
          const err = new Error('CONTEXT_CAPSULE_SECRET_DETECTED: Forbidden credential token pattern detected.');
          err.code = 'CONTEXT_CAPSULE_SECRET_DETECTED';
          throw err;
        }
      }
    }
    return;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      assertSecretsForbidden(obj[i], `${pathPrefix}[${i}]`);
    }
    return;
  }

  for (const [k, v] of Object.entries(obj)) {
    if (FORBIDDEN_PROPERTY_KEYS.has(k)) {
      const err = new Error(`CONTEXT_CAPSULE_SECRET_DETECTED: Forbidden credential property "${k}" detected.`);
      err.code = 'CONTEXT_CAPSULE_SECRET_DETECTED';
      throw err;
    }
    assertSecretsForbidden(v, pathPrefix ? `${pathPrefix}.${k}` : k);
  }
}

/**
 * Enforces size budgets (32 KB target, 64 KB hard limit fail-closed).
 */
function enforceSizeBudget(capsuleObj) {
  let serialized = serializeCanonicalJson(capsuleObj);
  let byteLength = Buffer.byteLength(serialized, 'utf8');

  if (byteLength > TARGET_SIZE_BUDGET_BYTES) {
    // Priority 3 Condensation: Condense historical context
    if (Array.isArray(capsuleObj.historical_context)) {
      capsuleObj.historical_context = capsuleObj.historical_context.map(h => ({
        feature: h.feature,
        status: h.status,
        key_guarantees: (h.key_guarantees || []).slice(0, 2)
      }));
      serialized = serializeCanonicalJson(capsuleObj);
      byteLength = Buffer.byteLength(serialized, 'utf8');
    }

    // Priority 2 Condensation if still > 32 KB
    if (byteLength > TARGET_SIZE_BUDGET_BYTES) {
      if (capsuleObj.acceptance_matrix && Array.isArray(capsuleObj.acceptance_matrix.canonical_ids)) {
        // Retain IDs only (already compact)
      }
      serialized = serializeCanonicalJson(capsuleObj);
      byteLength = Buffer.byteLength(serialized, 'utf8');
    }
  }

  if (byteLength > HARD_SIZE_LIMIT_BYTES) {
    const err = new Error(`CONTEXT_CAPSULE_TOO_LARGE: Critical invariants exceed capsule size budget (${byteLength} > ${HARD_SIZE_LIMIT_BYTES} bytes).`);
    err.code = 'CONTEXT_CAPSULE_TOO_LARGE';
    err.byteLength = byteLength;
    throw err;
  }

  return { capsuleObj, byteLength };
}

function resolveFeatureRel(featureDir, rootPath) {
  if (path.isAbsolute(featureDir)) {
    return normalizePath(featureDir, rootPath);
  }
  return normalizePath(featureDir);
}

/**
 * Resolves authoritative input sources for an active feature and calculates source_set_hash.
 */
function resolveAuthoritativeSources(rootPath, featureDir, currentPhase = 'specification') {
  const normFeature = resolveFeatureRel(featureDir, rootPath);
  const sources = [];

  const specRel = `${normFeature}/spec.md`.replace(/^\.\//, '');
  const planRel = `${normFeature}/plan.md`.replace(/^\.\//, '');
  const tasksRel = `${normFeature}/tasks.md`.replace(/^\.\//, '');
  const stateRel = '.gemstack/state.json';
  const closureRel = `${normFeature}/closure.json`.replace(/^\.\//, '');
  const ledgerRel = 'cost-ledger.json';
  const featureLedgerRel = `${normFeature}/cost-ledger.json`.replace(/^\.\//, '');

  const checkAndAdd = (relPath, role, mandatory = false) => {
    const absPath = path.join(rootPath, relPath);
    if (fs.existsSync(absPath)) {
      const hash = hashFile(absPath);
      sources.push({
        path: relPath.replace(/\\/g, '/'),
        hash,
        role
      });
      return true;
    } else if (mandatory) {
      const err = new Error(`Missing mandatory authoritative source: ${relPath}`);
      err.code = 'CONTEXT_CAPSULE_SOURCE_MISMATCH';
      throw err;
    }
    return false;
  };

  checkAndAdd(specRel, 'SPECIFICATION', true);
  checkAndAdd(planRel, 'PLAN', false);
  checkAndAdd(tasksRel, 'TASKS', false);

  checkAndAdd(stateRel, 'LIFECYCLE_STATE', false);
  checkAndAdd(closureRel, 'CLOSURE_EVIDENCE', false);
  checkAndAdd(ledgerRel, 'COST_LEDGER', false);
  checkAndAdd(featureLedgerRel, 'FEATURE_COST_LEDGER', false);

  sources.sort((a, b) => (a.path < b.path ? -1 : (a.path > b.path ? 1 : 0)));

  const sourceSetEntries = sources.map(s => ({ path: s.path, hash: s.hash }));
  const sourceSetHash = crypto.createHash('sha256')
    .update(JSON.stringify(sourceSetEntries), 'utf8')
    .digest('hex');

  return { sources, source_set_hash: sourceSetHash };
}

/**
 * Extracts normative MUST / MUST NOT rules from spec.md content.
 */
function extractNormativeConstraints(specContent) {
  const lines = specContent.split(/\r?\n/);
  const invariants = [];
  let counter = 1;
  let currentSection = 'spec.md';

  const sectionRegex = /^(?:#{1,4})\s+(?:(\d+(?:\.\d+)?)\.?\s*)?(.*?)$/;

  for (const line of lines) {
    const secMatch = line.match(sectionRegex);
    if (secMatch) {
      const num = secMatch[1] || '';
      currentSection = num ? `spec.md#${num}` : `spec.md#${secMatch[2].trim().toLowerCase().replace(/\s+/g, '-')}`;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('```')) continue;

    const hasMustNot = /\b(?:MUST NOT|SHALL NOT|FORBIDDEN|NEVER)\b/.test(trimmed);
    const hasMust = !hasMustNot && /\b(?:MUST|SHALL|REQUIRED)\b/.test(trimmed);

    if (hasMust || hasMustNot) {
      // Clean leading bullet or list markers
      const cleanRule = trimmed.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '').trim();
      invariants.push({
        id: `INV-${String(counter++).padStart(3, '0')}`,
        rule: cleanRule,
        normative: hasMustNot ? 'MUST_NOT' : 'MUST',
        source_ref: currentSection
      });
    }
  }

  return invariants;
}

/**
 * Generates canonical context-capsule.json atomically.
 */
function generateContextCapsule(rootPath, featureDir, options = {}) {
  const normFeature = resolveFeatureRel(featureDir, rootPath);
  const featureAbs = path.join(rootPath, normFeature);

  let state = { current_phase: 'specification', status: 'SPEC_COMPLETE', active_spec: normFeature };
  const statePath = path.join(rootPath, '.gemstack/state.json');
  if (fs.existsSync(statePath)) {
    try {
      state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch (_) {}
  }

  const specPath = path.join(featureAbs, 'spec.md');
  if (!fs.existsSync(specPath)) {
    const err = new Error(`Cannot generate context capsule: spec.md not found in ${normFeature}`);
    err.code = 'CONTEXT_CAPSULE_MISSING';
    throw err;
  }

  const specContent = fs.readFileSync(specPath, 'utf8');
  const { sources, source_set_hash } = resolveAuthoritativeSources(rootPath, featureDir, state.current_phase || 'specification');

  // Parse contracts
  const { contracts } = extractContractsBlock(specContent);
  const validatedContracts = validateContractSchemas(contracts);
  const frozenContracts = validatedContracts.map(c => ({
    id: c.id,
    type: c.type,
    value: c.value !== undefined ? c.value : true
  }));

  // Parse acceptance matrix
  let acceptanceMatrix = { total_required: 0, signature: null, canonical_ids: [] };
  const { matrix } = extractTestMatrixBlock(specContent);
  if (matrix) {
    const canonicalMatrix = validateTestMatrix(matrix);
    acceptanceMatrix = {
      total_required: canonicalMatrix.length,
      signature: computeAcceptanceSignature(canonicalMatrix),
      canonical_ids: canonicalMatrix.map(m => m.id)
    };
  }

  // Parse tasks if present
  let tasksState = { total: 0, completed: 0, in_progress: null, active_task_ids: [] };
  const tasksPath = path.join(featureAbs, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    try {
      const taskList = parseTaskMetadata(fs.readFileSync(tasksPath, 'utf8'));
      const activeIds = taskList.map(t => t.id);
      tasksState = {
        total: taskList.length,
        completed: 0,
        in_progress: activeIds.length > 0 ? activeIds[0] : null,
        active_task_ids: activeIds
      };
    } catch (_) {}
  }

  // Extract invariants
  const canonicalInvariants = extractNormativeConstraints(specContent);

  // Historical upgrades
  const historicalContext = [
    {
      feature: 'specs/006-architecture-consistency-engine',
      status: 'CLOSED',
      key_guarantees: ['Frozen contracts', 'Deterministic hashing', 'Anti-loop findings']
    },
    {
      feature: 'specs/007-mechanical-test-matrix-closure-evidence',
      status: 'CLOSED',
      key_guarantees: ['Mechanical test matrix', 'VERIFY = VALIDATE', 'closure.json evidence']
    },
    {
      feature: 'specs/008-cost-provider-safety-gates',
      status: 'CLOSED',
      key_guarantees: ['NO PROOF = NO EXECUTION', 'Fail-closed gates', 'Zero network verify']
    }
  ];

  const payload = {
    $schema: 'https://gemstack.dev/schemas/context-capsule-v1.json',
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    generator: {
      name: 'gemstack',
      version: '1.2.0'
    },
    provenance: {
      source_set_hash,
      sources
    },
    project: {
      name: 'gemstack-ai',
      active_feature: normFeature,
      current_phase: state.current_phase || 'specification',
      lifecycle_status: state.status || 'SPEC_COMPLETE',
      next_permitted_phase: 'PLAN'
    },
    historical_context: historicalContext,
    architecture_summary: {
      core_purpose: 'Deterministic context compression and safe continuation for AI-assisted engineering.',
      critical_boundaries: [
        'Capsule is strictly derived, never authoritative',
        'Semantic constraint losslessness: MUST/MUST NOT survive compression',
        'Verification is read-only and never regenerates capsules'
      ]
    },
    canonical_invariants: canonicalInvariants,
    frozen_contracts: frozenContracts,
    acceptance_matrix: acceptanceMatrix,
    tasks_state: tasksState,
    relevant_files: [
      'src/lib/context-capsule.js',
      'src/commands/context.js',
      'tests/context-determinism.test.js'
    ],
    deferred_items: [
      'Autonomous cross-repo capsule federations (out of scope)',
      'LLM narrative fine-tuning (non-authoritative)'
    ],
    unresolved_blockers: []
  };

  assertSecretsForbidden(payload);
  const { capsuleObj } = enforceSizeBudget(payload);
  const serialized = serializeCanonicalJson(capsuleObj);

  const targetFile = path.join(featureAbs, 'context-capsule.json');
  const tmpFile = `${targetFile}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  fs.writeFileSync(tmpFile, serialized, 'utf8');

  // Atomic replace with retry for Windows file locks
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      fs.renameSync(tmpFile, targetFile);
      break;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        throw err;
      }
      const start = Date.now();
      while (Date.now() - start < 20) {}
    }
  }

  return {
    path: targetFile,
    source_set_hash,
    byteLength: Buffer.byteLength(serialized, 'utf8'),
    invariantsCount: canonicalInvariants.length
  };
}

/**
 * Validates an existing context-capsule.json in strictly read-only mode.
 */
function validateContextCapsule(rootPath, featureDir) {
  const normFeature = resolveFeatureRel(featureDir, rootPath);
  const capsulePath = path.join(rootPath, normFeature, 'context-capsule.json');

  if (!fs.existsSync(capsulePath)) {
    return {
      valid: false,
      state: 'MISSING',
      findings: [{
        code: 'CONTEXT_CAPSULE_MISSING',
        message: `Context capsule not found at ${normFeature}/context-capsule.json`
      }]
    };
  }

  let capsule;
  try {
    const raw = fs.readFileSync(capsulePath, 'utf8');
    capsule = JSON.parse(raw);
  } catch (err) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [{
        code: 'CONTEXT_CAPSULE_INVALID',
        message: `Context capsule JSON parse error: ${err.message}`
      }]
    };
  }

  if (capsule.schema_version !== SCHEMA_VERSION) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [{
        code: 'CONTEXT_CAPSULE_INVALID',
        message: `Unsupported schema version: ${capsule.schema_version}`
      }]
    };
  }

  // Size check
  const rawSize = Buffer.byteLength(fs.readFileSync(capsulePath, 'utf8'), 'utf8');
  if (rawSize > HARD_SIZE_LIMIT_BYTES) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [{
        code: 'CONTEXT_CAPSULE_TOO_LARGE',
        message: `Capsule exceeds hard size limit (${rawSize} > ${HARD_SIZE_LIMIT_BYTES} bytes).`
      }]
    };
  }

  // Secrets check
  try {
    assertSecretsForbidden(capsule);
  } catch (secErr) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [{
        code: 'CONTEXT_CAPSULE_SECRET_DETECTED',
        message: secErr.message
      }]
    };
  }

  // Provenance & Freshness check
  const recordedSources = (capsule.provenance && capsule.provenance.sources) || [];
  for (const src of recordedSources) {
    const diskPath = path.join(rootPath, src.path);
    if (!fs.existsSync(diskPath)) {
      return {
        valid: false,
        state: 'STALE',
        findings: [{
          code: 'CONTEXT_CAPSULE_SOURCE_MISMATCH',
          message: `Recorded source file missing on disk: ${src.path}`
        }]
      };
    }
    const currentHash = hashFile(diskPath);
    if (currentHash !== src.hash) {
      return {
        valid: false,
        state: 'STALE',
        findings: [{
          code: 'CONTEXT_CAPSULE_STALE',
          message: `Source file ${src.path} was modified since capsule generation.`
        }]
      };
    }
  }

  // Check source-set hash integrity
  const sourceSetEntries = recordedSources.map(s => ({ path: s.path, hash: s.hash }));
  const expectedSourceSetHash = crypto.createHash('sha256')
    .update(JSON.stringify(sourceSetEntries), 'utf8')
    .digest('hex');

  if (capsule.provenance && capsule.provenance.source_set_hash !== expectedSourceSetHash) {
    return {
      valid: false,
      state: 'STALE',
      findings: [{
        code: 'CONTEXT_CAPSULE_STALE',
        message: 'Capsule source_set_hash does not reconcile with recorded source files.'
      }]
    };
  }

  // Check semantic constraint coverage
  const specSrc = recordedSources.find(s => s.role === 'SPECIFICATION');
  if (specSrc) {
    const specDiskPath = path.join(rootPath, specSrc.path);
    if (fs.existsSync(specDiskPath)) {
      const specContent = fs.readFileSync(specDiskPath, 'utf8');
      const liveInvariants = extractNormativeConstraints(specContent);
      const capsuleInvariants = new Set((capsule.canonical_invariants || []).map(i => i.rule));

      for (const live of liveInvariants) {
        if (!capsuleInvariants.has(live.rule)) {
          return {
            valid: false,
            state: 'INVALID',
            findings: [{
              code: 'CONTEXT_CAPSULE_INVARIANT_DROPPED',
              message: `Normative constraint "${live.rule}" is missing from capsule.`
            }]
          };
        }
      }
    }
  }

  return {
    valid: true,
    state: 'VALID',
    findings: []
  };
}

module.exports = {
  SCHEMA_VERSION,
  TARGET_SIZE_BUDGET_BYTES,
  HARD_SIZE_LIMIT_BYTES,
  serializeCanonicalJson,
  canonicalizeObject,
  computeCapsuleSemanticHash,
  assertSecretsForbidden,
  enforceSizeBudget,
  resolveAuthoritativeSources,
  extractNormativeConstraints,
  generateContextCapsule,
  validateContextCapsule
};
