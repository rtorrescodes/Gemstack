/**
 * Gemstack Swarm Coordination & Validation Engine (Upgrade E)
 *
 * Implements deterministic swarm planning, exclusive write partitions,
 * separation of duties (AUTHOR != REVIEWER), context capsule projection,
 * and Upgrade C safety gate interception.
 *
 * ZERO RUNTIME DEPENDENCIES - Node.js built-ins exclusively.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { normalizePath } = require('./hasher');
const { createFinding } = require('./findings');

const SWARM_SCHEMA_VERSION = '1.0.0';
const CANONICAL_ROLES = ['implementer', 'reviewer', 'security-auditor', 'coordinator'];
const DEFAULT_MAX_WORKERS = 4;
const HARD_MAX_WORKERS = 8;

/**
 * Parses and validates a swarm manifest against canonical schema v1.0.0.
 *
 * @param {string|object} input - Raw JSON string or parsed object
 * @returns {object} Canonical parsed manifest
 */
function parseSwarmManifest(input) {
  let parsed;
  if (typeof input === 'string') {
    try {
      parsed = JSON.parse(input);
    } catch (err) {
      const error = new Error(`Invalid JSON in swarm manifest: ${err.message}`);
      error.code = 'SWARM_PARSE_ERROR';
      throw error;
    }
  } else if (input && typeof input === 'object') {
    parsed = input;
  } else {
    const error = new Error('Swarm manifest input must be a JSON string or object.');
    error.code = 'SWARM_INVALID_INPUT';
    throw error;
  }

  return validateSwarmSchema(parsed);
}

/**
 * Validates the schema structure of a parsed swarm manifest.
 *
 * @param {object} manifest
 * @returns {object} Validated manifest
 */
function validateSwarmSchema(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    const err = new Error('Swarm manifest root must be a JSON object.');
    err.code = 'SWARM_INVALID_SCHEMA';
    throw err;
  }

  if (manifest.version && manifest.version !== SWARM_SCHEMA_VERSION) {
    const err = new Error(`Unsupported swarm schema version: "${manifest.version}". Expected "${SWARM_SCHEMA_VERSION}".`);
    err.code = 'SWARM_INVALID_SCHEMA';
    throw err;
  }

  if (!manifest.feature_id || typeof manifest.feature_id !== 'string') {
    const err = new Error('Swarm manifest must declare a valid "feature_id".');
    err.code = 'SWARM_INVALID_SCHEMA';
    throw err;
  }

  if (!Array.isArray(manifest.waves)) {
    const err = new Error('Swarm manifest must declare a "waves" array.');
    err.code = 'SWARM_INVALID_SCHEMA';
    throw err;
  }

  return manifest;
}

/**
 * Serializes an object deterministically with UTF-16 code-unit sorted keys.
 *
 * @param {*} value
 * @returns {string} Deterministic JSON string
 */
function canonicalSerialize(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    const serializedItems = value.map(canonicalSerialize);
    return '[' + serializedItems.join(',') + ']';
  }

  const keys = Object.keys(value).sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  const parts = [];
  for (const k of keys) {
    parts.push(JSON.stringify(k) + ':' + canonicalSerialize(value[k]));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * Validates worker IDs, role assignments, and checks that manifest is subordinate to specifications.
 *
 * @param {object} manifest
 * @param {object} [authoritativeSources={}]
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateSwarmAuthority(manifest, authoritativeSources = {}) {
  const findings = [];

  // Check if manifest attempts to modify or contradict specification content
  if (manifest.overrides_spec === true || manifest.alter_contracts === true) {
    findings.push(createFinding({
      code: 'SWARM_AUTHORITY_CONFLICT',
      contractId: 'swarm-authority-subordinate',
      phase: 'swarm',
      location: `specs/${manifest.feature_id}/swarm.json`,
      details: 'Swarm manifest attempted to declare authority overrides over specifications or contracts.'
    }));
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Validates worker identity format and mechanical role permissions.
 *
 * @param {object} task
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateWorkerIdentityAndRole(task) {
  const findings = [];
  const workerId = task.worker_id;
  const role = task.assigned_role;

  if (!workerId || typeof workerId !== 'string' || workerId.trim().length === 0) {
    findings.push(createFinding({
      code: 'SWARM_ASSIGNMENT_INVALID',
      contractId: 'swarm-authority-subordinate',
      phase: 'swarm',
      location: task.task_id || 'unknown',
      details: 'Worker ID must be a non-empty explicit string.'
    }));
  }

  if (!role || !CANONICAL_ROLES.includes(role)) {
    findings.push(createFinding({
      code: 'SWARM_ASSIGNMENT_INVALID',
      contractId: 'swarm-authority-subordinate',
      phase: 'swarm',
      location: task.task_id || 'unknown',
      details: `Assigned role "${role}" is not in canonical roles: ${CANONICAL_ROLES.join(', ')}.`
    }));
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Validates that all tasks in swarm manifest reference valid tasks in tasks.md.
 *
 * @param {string} tasksContent - Content of tasks.md
 * @param {object} manifest - Swarm manifest
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function resolveTaskOwnership(tasksContent, manifest) {
  const findings = [];
  const declaredTaskIds = new Set();

  // Parse task IDs from tasks.md (e.g. "Task UE-T001", "TASK-001", "### UE-T001", etc.)
  const lines = (tasksContent || '').split('\n');
  for (const line of lines) {
    const m = line.match(/\b(TASK-[A-Za-z0-9_-]+|UE-T[0-9]{3}|T[0-9]{3})\b/i);
    if (m) {
      declaredTaskIds.add(m[1].toUpperCase());
    }
  }

  const waves = manifest.waves || [];
  for (const wave of waves) {
    const tasks = wave.tasks || [];
    for (const t of tasks) {
      const tid = (t.task_id || '').toUpperCase();
      if (!declaredTaskIds.has(tid) && declaredTaskIds.size > 0) {
        findings.push(createFinding({
          code: 'SWARM_TASK_ORPHANED',
          contractId: 'swarm-authority-subordinate',
          phase: 'swarm',
          location: t.task_id || 'unknown',
          details: `Task "${t.task_id}" in swarm manifest is not declared in authoritative tasks.md.`
        }));
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Plans and groups parallel tasks into concurrent waves ensuring disjoint write sets.
 *
 * @param {Array<object>} tasks - Array of task objects with task_id and write_set
 * @returns {Array<object>} Scheduled waves
 */
function planSwarmWaves(tasks) {
  if (!Array.isArray(tasks)) return [];

  const waves = [];
  let remaining = [...tasks];

  while (remaining.length > 0) {
    const currentWaveTasks = [];
    const currentWaveWriteSet = new Set();
    const nextRemaining = [];

    for (const task of remaining) {
      const taskWrites = (task.write_set || []).map(normalizePath);
      let collides = false;

      for (const p of taskWrites) {
        if (currentWaveWriteSet.has(p)) {
          collides = true;
          break;
        }
      }

      if (!collides && currentWaveTasks.length < DEFAULT_MAX_WORKERS) {
        currentWaveTasks.push(task);
        for (const p of taskWrites) {
          currentWaveWriteSet.add(p);
        }
      } else {
        nextRemaining.push(task);
      }
    }

    if (currentWaveTasks.length === 0 && nextRemaining.length > 0) {
      // Force single task progress if deadlock occurs
      currentWaveTasks.push(nextRemaining.shift());
    }

    waves.push({
      wave_index: waves.length + 1,
      status: 'PLANNED',
      tasks: currentWaveTasks
    });

    remaining = nextRemaining;
  }

  return waves;
}

/**
 * Validates that concurrent tasks in a wave declare mutually disjoint write sets.
 *
 * @param {object} wave - Swarm wave object
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateWritePartitions(wave) {
  const findings = [];
  const tasks = (wave && wave.tasks) || [];
  const claimedPaths = new Map(); // path -> task_id

  for (const t of tasks) {
    const writes = (t.write_set || []).map(normalizePath);
    for (const p of writes) {
      if (claimedPaths.has(p)) {
        const otherTaskId = claimedPaths.get(p);
        findings.push(createFinding({
          code: 'SWARM_WRITE_COLLISION',
          contractId: 'exclusive-task-write-ownership',
          phase: 'swarm',
          location: p,
          details: `Write collision on "${p}": concurrently claimed by "${otherTaskId}" and "${t.task_id}".`
        }));
      } else {
        claimedPaths.set(p, t.task_id);
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Enforces non-waivable separation of duties: AUTHOR != REVIEWER.
 *
 * @param {object} task - Task assignment with implementer and review block
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateReviewSeparation(task) {
  const findings = [];
  if (!task || !task.review) {
    return { valid: true, findings: [] };
  }

  const authorId = (task.worker_id || '').trim();
  const reviewerId = (task.review.reviewer_id || '').trim();

  if (authorId && reviewerId && authorId.toLowerCase() === reviewerId.toLowerCase()) {
    findings.push(createFinding({
      code: 'SWARM_SELF_REVIEW_DETECTED',
      contractId: 'author-not-reviewer',
      phase: 'swarm',
      location: task.task_id || 'unknown',
      details: `Self-review detected on task "${task.task_id}": Author "${authorId}" is identical to Reviewer "${reviewerId}".`
    }));
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Enforces role-specific write-set boundaries (e.g. reviewer is read-only).
 *
 * @param {string} role - Worker role
 * @param {Array<string>} modifiedFiles - List of files modified by worker
 * @param {string} [taskId='unknown']
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateRoleWriteScope(role, modifiedFiles = [], taskId = 'unknown') {
  const findings = [];
  const normModified = (modifiedFiles || []).map(normalizePath);

  if ((role === 'reviewer' || role === 'security-auditor') && normModified.length > 0) {
    findings.push(createFinding({
      code: 'SWARM_WRITE_SET_VIOLATION',
      contractId: 'author-not-reviewer',
      phase: 'swarm',
      location: normModified[0],
      details: `Role "${role}" on task "${taskId}" is strictly read-only but modified ${normModified.length} file(s).`
    }));
  }

  if (role === 'visual-qa') {
    for (const f of normModified) {
      if (!f.includes('evidence/') && !f.endsWith('.png') && !f.endsWith('.json')) {
        findings.push(createFinding({
          code: 'SWARM_WRITE_SET_VIOLATION',
          contractId: 'exclusive-task-write-ownership',
          phase: 'swarm',
          location: f,
          details: `Role "visual-qa" is restricted to evidence directories but modified "${f}".`
        }));
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Projects a minimal, task-scoped context derived from context-capsule.json.
 *
 * @param {object} capsule - Loaded context-capsule.json object
 * @param {string} taskId - Target task ID
 * @param {string} [liveCapsuleHash=null] - Live SHA-256 hash of context-capsule.json
 * @returns {object} Projected worker context
 */
function projectWorkerContext(capsule, taskId, liveCapsuleHash = null) {
  if (!capsule || typeof capsule !== 'object') {
    const err = new Error('Capsule must be an object to project worker context.');
    err.code = 'SWARM_CONTEXT_INVALID';
    throw err;
  }

  const recordedHash = capsule.provenance ? capsule.provenance.source_set_hash : null;
  const isStale = Boolean(liveCapsuleHash && recordedHash && liveCapsuleHash !== recordedHash);

  // Extract only task-relevant items
  const activeTasks = (capsule.active_feature && capsule.active_feature.active_tasks) || [];
  const matchedTask = activeTasks.find(t => (t.id || '').toUpperCase() === (taskId || '').toUpperCase()) || null;

  return {
    task_id: taskId,
    feature_id: capsule.active_feature ? capsule.active_feature.id : 'unknown',
    source_capsule_hash: recordedHash,
    freshness: isStale ? 'STALE' : 'FRESH',
    canonical_invariants: capsule.canonical_invariants || [],
    frozen_contracts: capsule.frozen_contracts || [],
    task_metadata: matchedTask,
    // Strictly exclude conversational chat history
    chat_history: null,
    developer_prompts: null
  };
}

/**
 * Validates worker count limits and rejects recursive spawning claims.
 *
 * @param {object} manifest - Swarm manifest
 * @returns {{ valid: boolean, findings: Array<object> }}
 */
function validateWorkerLimits(manifest) {
  const findings = [];
  const maxWorkers = manifest.max_workers || DEFAULT_MAX_WORKERS;

  const waves = manifest.waves || [];
  for (const wave of waves) {
    const tasks = wave.tasks || [];
    const workers = new Set(tasks.map(t => t.worker_id).filter(Boolean));

    if (workers.size > maxWorkers || workers.size > HARD_MAX_WORKERS) {
      findings.push(createFinding({
        code: 'SWARM_WORKER_LIMIT_EXCEEDED',
        contractId: 'swarm-authority-subordinate',
        phase: 'swarm',
        location: `Wave ${wave.wave_index}`,
        details: `Wave ${wave.wave_index} declared ${workers.size} workers, exceeding maximum allowed (${maxWorkers}).`
      }));
    }

    for (const t of tasks) {
      if (t.spawned_children && t.spawned_children.length > 0) {
        findings.push(createFinding({
          code: 'SWARM_RECURSIVE_SPAWN_DENIED',
          contractId: 'swarm-authority-subordinate',
          phase: 'swarm',
          location: t.task_id || 'unknown',
          details: `Worker "${t.worker_id}" claimed spawned child workers. Recursive subagent spawning is prohibited.`
        }));
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

/**
 * Intercepts worker external tool actions through Upgrade C Provider Safety Gates.
 *
 * @param {object} workerAction - Action payload with provider_id and capability_id
 * @param {object} [options={}] - Gate options
 * @returns {object} Gate decision
 */
function validateSwarmProviderSafety(workerAction, options = {}) {
  const { evaluateProviderCapability } = require('./safety-gates');
  const { createProviderRegistry } = require('./provider-registry');

  // Build registry with mock provider for testing if none provided
  const providers = options.providers || {
    'trusted-mock': {
      type: 'MOCK',
      mock_adapter: 'in-memory',
      capabilities: {
        'mock_generation': { cost_state: 'FREE', estimated_unit_cost: 0.0 }
      }
    }
  };
  const registry = createProviderRegistry(providers);
  const capResult = evaluateProviderCapability(workerAction, registry, options);

  if (!capResult.authorized) {
    return {
      authorized: false,
      code: 'SWARM_PROVIDER_UNAUTHORIZED',
      message: capResult.message
    };
  }

  if (workerAction.estimated_tokens && options.budget_limit) {
    if (workerAction.estimated_tokens > options.budget_limit) {
      return {
        authorized: false,
        code: 'SWARM_COST_LIMIT_EXCEEDED',
        message: `Token usage ${workerAction.estimated_tokens} exceeds wave budget limit of ${options.budget_limit}.`
      };
    }
  }

  return {
    authorized: true,
    code: 'SWARM_PROVIDER_AUTHORIZED',
    message: 'Worker provider action authorized.'
  };
}

/**
 * Validates a complete swarm.json file in read-only mode.
 *
 * @param {string} targetDir - Repository target directory
 * @param {string} featureId - Active feature directory path
 * @returns {{ valid: boolean, state: string, findings: Array<object> }}
 */
function validateSwarmManifest(targetDir, featureId) {
  const manifestPath = path.join(targetDir, featureId, 'swarm.json');
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
        code: 'SWARM_UNREADABLE',
        contractId: 'swarm-authority-subordinate',
        phase: 'swarm',
        location: manifestPath,
        details: err.message
      })]
    };
  }

  let manifest;
  try {
    manifest = parseSwarmManifest(raw);
  } catch (err) {
    return {
      valid: false,
      state: 'INVALID',
      findings: [createFinding({
        code: 'SWARM_INVALID_SCHEMA',
        contractId: 'swarm-authority-subordinate',
        phase: 'swarm',
        location: manifestPath,
        details: err.message
      })]
    };
  }

  const findings = [];

  // 1. Authority validation
  const authCheck = validateSwarmAuthority(manifest);
  findings.push(...authCheck.findings);

  // 2. Worker limits & recursive spawns
  const limitsCheck = validateWorkerLimits(manifest);
  findings.push(...limitsCheck.findings);

  // 3. Per wave validations
  const waves = manifest.waves || [];
  for (const wave of waves) {
    // Write collisions
    const writeCheck = validateWritePartitions(wave);
    findings.push(...writeCheck.findings);

    // Tasks check
    for (const t of wave.tasks || []) {
      const idRoleCheck = validateWorkerIdentityAndRole(t);
      findings.push(...idRoleCheck.findings);

      const reviewCheck = validateReviewSeparation(t);
      findings.push(...reviewCheck.findings);
    }
  }

  // 4. Tasks.md ownership check if available
  const tasksPath = path.join(targetDir, featureId, 'tasks.md');
  if (fs.existsSync(tasksPath)) {
    const tasksRaw = fs.readFileSync(tasksPath, 'utf8');
    const ownerCheck = resolveTaskOwnership(tasksRaw, manifest);
    findings.push(...ownerCheck.findings);
  }

  // 5. Context capsule freshness check if available
  const capsulePath = path.join(targetDir, featureId, 'context-capsule.json');
  if (fs.existsSync(capsulePath) && manifest.source_capsule_hash) {
    const { hashFile } = require('./hasher');
    const liveHash = hashFile(capsulePath);
    if (liveHash !== manifest.source_capsule_hash) {
      findings.push(createFinding({
        code: 'SWARM_CONTEXT_STALE',
        contractId: 'swarm-context-projected',
        phase: 'swarm',
        location: manifestPath,
        details: `Swarm manifest source_capsule_hash (${manifest.source_capsule_hash.slice(0, 12)}...) is stale. Live: ${liveHash.slice(0, 12)}...`
      }));
    }
  }

  return {
    valid: findings.length === 0,
    state: findings.length === 0 ? 'VALID' : 'INVALID',
    findings
  };
}

module.exports = {
  SWARM_SCHEMA_VERSION,
  CANONICAL_ROLES,
  DEFAULT_MAX_WORKERS,
  HARD_MAX_WORKERS,
  parseSwarmManifest,
  validateSwarmSchema,
  canonicalSerialize,
  validateSwarmAuthority,
  validateWorkerIdentityAndRole,
  resolveTaskOwnership,
  planSwarmWaves,
  validateWritePartitions,
  validateReviewSeparation,
  validateRoleWriteScope,
  projectWorkerContext,
  validateWorkerLimits,
  validateSwarmProviderSafety,
  validateSwarmManifest
};
