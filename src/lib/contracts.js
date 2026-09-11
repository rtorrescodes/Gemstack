const { normalizeContent } = require('./hasher');

const CANONICAL_CONTRACT_TYPES = [
  'ENUM_SET',
  'IDENTITY_TUPLE',
  'PROVENANCE_RULE',
  'BOOLEAN_INVARIANT',
  'BOUNDARY',
  'ROADMAP_LIMIT'
];

/**
 * Extracts and parses the single canonical gemstack-contracts block from markdown.
 *
 * @param {string} markdownContent
 * @returns {{ contracts: Array<object>, isLegacy: boolean }}
 */
function extractContractsBlock(markdownContent) {
  // Check BOM and normalize newlines via hasher
  const normalized = normalizeContent(markdownContent);

  const lines = normalized.split('\n');
  const fence = '```';
  const header = '```gemstack-contracts';

  const blocks = [];
  let inBlock = false;
  let blockLines = [];

  for (const line of lines) {
    if (!inBlock) {
      if (line.trimEnd() === header) {
        inBlock = true;
        blockLines = [];
      }
    } else {
      if (line.trimEnd() === fence) {
        inBlock = false;
        blocks.push(blockLines.join('\n'));
      } else {
        blockLines.push(line);
      }
    }
  }

  if (blocks.length === 0) {
    return { contracts: [], isLegacy: true };
  }

  if (blocks.length > 1) {
    const err = new Error(`Multiple gemstack-contracts blocks detected (${blocks.length}). Exactly one is permitted.`);
    err.code = 'CONTRACT_PARSE_ERROR';
    throw err;
  }

  const jsonRaw = blocks[0].trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch (parseErr) {
    const err = new Error(`Malformed JSON in gemstack-contracts block: ${parseErr.message}`);
    err.code = 'CONTRACT_PARSE_ERROR';
    throw err;
  }

  if (!Array.isArray(parsed)) {
    const err = new Error('gemstack-contracts content must be a JSON array of contract objects');
    err.code = 'CONTRACT_INVALID_SHAPE';
    throw err;
  }

  return { contracts: parsed, isLegacy: false };
}

/**
 * Validates the schema of an array of contract objects and checks for duplicate IDs.
 *
 * @param {Array<object>} contractsArray
 * @returns {Array<object>} Validated contracts
 */
function validateContractSchemas(contractsArray) {
  if (!Array.isArray(contractsArray)) {
    const err = new Error('Contracts must be an array');
    err.code = 'CONTRACT_INVALID_SHAPE';
    throw err;
  }

  const seenIds = new Set();

  for (const c of contractsArray) {
    if (!c || typeof c !== 'object') {
      const err = new Error('Each contract must be a non-null object');
      err.code = 'CONTRACT_INVALID_SHAPE';
      throw err;
    }

    if (typeof c.id !== 'string' || !c.id.trim()) {
      const err = new Error('Contract missing valid string id');
      err.code = 'CONTRACT_INVALID_SHAPE';
      throw err;
    }

    if (seenIds.has(c.id)) {
      const err = new Error(`Duplicate contract ID detected: "${c.id}"`);
      err.code = 'CONTRACT_DUPLICATE_ID';
      throw err;
    }
    seenIds.add(c.id);

    if (!CANONICAL_CONTRACT_TYPES.includes(c.type)) {
      const err = new Error(`Unknown contract type: "${c.type}" on contract "${c.id}"`);
      err.code = 'CONTRACT_UNKNOWN_TYPE';
      throw err;
    }

    // Type specific validations
    if (c.type === 'ENUM_SET') {
      if (!Array.isArray(c.values)) {
        const err = new Error(`ENUM_SET "${c.id}" requires a values array`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
      const seenVals = new Set();
      for (const v of c.values) {
        if (typeof v !== 'string' || !v.trim()) {
          const err = new Error(`ENUM_SET "${c.id}" contains empty or non-string member`);
          err.code = 'CONTRACT_INVALID_SHAPE';
          throw err;
        }
        if (seenVals.has(v.trim())) {
          const err = new Error(`ENUM_SET "${c.id}" contains duplicate value "${v}"`);
          err.code = 'CONTRACT_INVALID_SHAPE';
          throw err;
        }
        seenVals.add(v.trim());
      }
    } else if (c.type === 'IDENTITY_TUPLE') {
      if (!Array.isArray(c.values)) {
        const err = new Error(`IDENTITY_TUPLE "${c.id}" requires a values array of dimensions`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
      const seenDims = new Set();
      for (const d of c.values) {
        if (typeof d !== 'string' || !d.trim()) {
          const err = new Error(`IDENTITY_TUPLE "${c.id}" contains invalid dimension string`);
          err.code = 'CONTRACT_INVALID_SHAPE';
          throw err;
        }
        if (seenDims.has(d.trim())) {
          const err = new Error(`IDENTITY_TUPLE "${c.id}" contains duplicate dimension "${d}"`);
          err.code = 'CONTRACT_INVALID_SHAPE';
          throw err;
        }
        seenDims.add(d.trim());
      }
    } else if (c.type === 'PROVENANCE_RULE') {
      if (typeof c.entity !== 'string' || !c.entity.trim()) {
        const err = new Error(`PROVENANCE_RULE "${c.id}" requires an entity string`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
      if (!Array.isArray(c.values)) {
        const err = new Error(`PROVENANCE_RULE "${c.id}" requires a values array of provenance fields`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
      for (const f of c.values) {
        if (typeof f !== 'string' || !f.trim()) {
          const err = new Error(`PROVENANCE_RULE "${c.id}" contains invalid field string`);
          err.code = 'CONTRACT_INVALID_SHAPE';
          throw err;
        }
      }
    } else if (c.type === 'BOOLEAN_INVARIANT') {
      if (typeof c.value !== 'boolean') {
        const err = new Error(`BOOLEAN_INVARIANT "${c.id}" requires native boolean value, got ${typeof c.value}`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
    } else if (c.type === 'BOUNDARY') {
      if (c.value !== 'FORBIDDEN' && c.value !== 'REQUIRED') {
        const err = new Error(`BOUNDARY "${c.id}" value must be strictly "FORBIDDEN" or "REQUIRED", got "${c.value}"`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
    } else if (c.type === 'ROADMAP_LIMIT') {
      if (typeof c.value !== 'number' && typeof c.value !== 'string') {
        const err = new Error(`ROADMAP_LIMIT "${c.id}" value must be a number or string`);
        err.code = 'CONTRACT_INVALID_SHAPE';
        throw err;
      }
    }
  }

  return contractsArray;
}

/**
 * Normalizes contract representation deterministically.
 * Arrays of set-like members are trimmed and sorted alphabetically.
 *
 * @param {object} contract
 * @returns {object} Normalized copy
 */
function normalizeContract(contract) {
  const norm = { ...contract };
  if (norm.type === 'ENUM_SET' || norm.type === 'IDENTITY_TUPLE' || norm.type === 'PROVENANCE_RULE') {
    if (Array.isArray(norm.values)) {
      norm.values = norm.values.map(v => typeof v === 'string' ? v.trim() : v).slice().sort();
    }
  }
  return norm;
}

/**
 * Resolves cumulative phase inheritance.
 * Upstream contracts are inherited; downstream additions are merged if not contradicting.
 *
 * @param {Array<object>} upstreamContracts
 * @param {Array<object>} currentContracts
 * @returns {Array<object>} Consolidated effective contract registry
 */
function resolvePhaseInheritance(upstreamContracts = [], currentContracts = []) {
  const effective = new Map();

  for (const c of upstreamContracts) {
    effective.set(c.id, normalizeContract(c));
  }

  for (const c of currentContracts) {
    // If it's an additive contract not present in upstream
    if (!effective.has(c.id)) {
      effective.set(c.id, normalizeContract(c));
    }
  }

  return Array.from(effective.values());
}

/**
 * Compares current phase contracts against upstream accepted contracts.
 * Emits one consolidated violation finding per (contractId, phase, violationType).
 *
 * @param {Array<object>} upstreamContracts
 * @param {Array<object>} currentContracts
 * @param {string} currentPhase - e.g. 'plan' or 'tasks'
 * @returns {Array<object>} List of violations
 */
function comparePhaseContracts(upstreamContracts = [], currentContracts = [], currentPhase = 'plan') {
  const violations = [];
  const currentMap = new Map();
  for (const c of currentContracts) {
    currentMap.set(c.id, normalizeContract(c));
  }

  for (const up of upstreamContracts) {
    const normUp = normalizeContract(up);
    // If downstream does not redeclare an inherited contract, that is PASS (implicit inheritance)
    if (!currentMap.has(normUp.id)) {
      continue;
    }

    const normCurr = currentMap.get(normUp.id);

    // If contract types differ
    if (normCurr.type !== normUp.type) {
      violations.push({
        code: 'FROZEN_CONTRACT_VIOLATION',
        contractId: normUp.id,
        phase: currentPhase,
        violationType: 'TYPE_MUTATION',
        delta: {
          expectedType: normUp.type,
          observedType: normCurr.type
        }
      });
      continue;
    }

    // Comparison by type
    if (normUp.type === 'ENUM_SET') {
      const upSet = new Set(normUp.values);
      const currSet = new Set(normCurr.values);

      const added = normCurr.values.filter(v => !upSet.has(v)).sort();
      const missing = normUp.values.filter(v => !currSet.has(v)).sort();

      if (added.length > 0 || missing.length > 0) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'ENUM_SET_MISMATCH',
          delta: { added, missing }
        });
      }
    } else if (normUp.type === 'IDENTITY_TUPLE') {
      const upSet = new Set(normUp.values);
      const currSet = new Set(normCurr.values);

      const added = normCurr.values.filter(d => !upSet.has(d)).sort();
      const missing = normUp.values.filter(d => !currSet.has(d)).sort();

      if (added.length > 0 || missing.length > 0 || normUp.values.length !== normCurr.values.length) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'IDENTITY_TUPLE_MISMATCH',
          delta: { added, missing }
        });
      }
    } else if (normUp.type === 'PROVENANCE_RULE') {
      let entityMismatch = normUp.entity !== normCurr.entity;
      const upSet = new Set(normUp.values);
      const currSet = new Set(normCurr.values);

      const added = normCurr.values.filter(f => !upSet.has(f)).sort();
      const missing = normUp.values.filter(f => !currSet.has(f)).sort();

      if (entityMismatch || added.length > 0 || missing.length > 0) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'PROVENANCE_MISMATCH',
          delta: {
            entityExpected: normUp.entity,
            entityObserved: normCurr.entity,
            added,
            missing
          }
        });
      }
    } else if (normUp.type === 'BOOLEAN_INVARIANT') {
      if (normUp.value !== normCurr.value) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'BOOLEAN_CONTRADICTION',
          delta: {
            expected: normUp.value,
            observed: normCurr.value
          }
        });
      }
    } else if (normUp.type === 'BOUNDARY') {
      if (normUp.value !== normCurr.value) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'BOUNDARY_CONTRADICTION',
          delta: {
            expected: normUp.value,
            observed: normCurr.value
          }
        });
      }
    } else if (normUp.type === 'ROADMAP_LIMIT') {
      if (normUp.value !== normCurr.value) {
        violations.push({
          code: 'FROZEN_CONTRACT_VIOLATION',
          contractId: normUp.id,
          phase: currentPhase,
          violationType: 'ROADMAP_LIMIT_MISMATCH',
          delta: {
            expected: normUp.value,
            observed: normCurr.value
          }
        });
      }
    }
  }

  return violations;
}

module.exports = {
  CANONICAL_CONTRACT_TYPES,
  extractContractsBlock,
  validateContractSchemas,
  normalizeContract,
  resolvePhaseInheritance,
  comparePhaseContracts
};
