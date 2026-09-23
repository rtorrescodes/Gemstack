'use strict';

/**
 * Spec Conflict & Merge Engine (Gemstack 2.0 Sprint C)
 * Detects contract and test ID collisions between branches/specs offline.
 */

const { extractContractsBlock } = require('./contracts');
const { extractTestMatrixBlock } = require('./test-matrix');

/**
 * Normalizes input which can be markdown string or parsed object.
 * @param {string|object} specInput 
 * @returns {{ contracts: Array, tests: Array, requirements: Array }}
 */
function normalizeSpecRepresentation(specInput) {
  if (typeof specInput === 'object' && specInput !== null) {
    return {
      contracts: Array.isArray(specInput.contracts) ? specInput.contracts : [],
      tests: Array.isArray(specInput.tests) ? specInput.tests : [],
      requirements: Array.isArray(specInput.requirements) ? specInput.requirements : []
    };
  }

  if (typeof specInput === 'string') {
    const contractsRes = extractContractsBlock(specInput);
    const contracts = !contractsRes.isLegacy ? contractsRes.contracts : [];

    const matrixRes = extractTestMatrixBlock(specInput);
    const tests = !matrixRes.isLegacy ? matrixRes.matrix : [];

    return {
      contracts,
      tests,
      requirements: []
    };
  }

  return { contracts: [], tests: [], requirements: [] };
}

/**
 * Detects conflicts between two specifications.
 * @param {string|object} specA - Base or local spec
 * @param {string|object} specB - Incoming or remote spec
 * @returns {{ valid: boolean, conflicts: Array<{ type: string, id: string, reason: string, details?: any }> }}
 */
function detectSpecConflicts(specA, specB) {
  const repA = normalizeSpecRepresentation(specA);
  const repB = normalizeSpecRepresentation(specB);

  const conflicts = [];

  // 1. Detect Contract Collisions
  const contractsMapA = new Map(repA.contracts.map(c => [c.id, c]));
  for (const cB of repB.contracts) {
    if (contractsMapA.has(cB.id)) {
      const cA = contractsMapA.get(cB.id);

      // Check type collision
      if (cA.type !== cB.type) {
        conflicts.push({
          type: 'CONTRACT_COLLISION',
          id: cB.id,
          reason: `Contract "${cB.id}" has conflicting types: "${cA.type}" vs "${cB.type}".`
        });
        continue;
      }

      // Check value collision based on type
      if (cA.type === 'BOOLEAN_INVARIANT' && cA.value !== cB.value) {
        conflicts.push({
          type: 'CONTRACT_COLLISION',
          id: cB.id,
          reason: `Contract "${cB.id}" has conflicting boolean values: ${cA.value} vs ${cB.value}.`
        });
      } else if (cA.type === 'ENUM_SET') {
        const setA = new Set(cA.values || []);
        const setB = new Set(cB.values || []);
        // If values differ materially and neither is empty
        const diffA = [...setA].filter(x => !setB.has(x));
        const diffB = [...setB].filter(x => !setA.has(x));
        if (diffA.length > 0 || diffB.length > 0) {
          conflicts.push({
            type: 'CONTRACT_COLLISION',
            id: cB.id,
            reason: `Contract ENUM_SET "${cB.id}" has divergent enum values.`
          });
        }
      } else {
        // Generic deep check
        if (JSON.stringify(cA) !== JSON.stringify(cB)) {
          conflicts.push({
            type: 'CONTRACT_COLLISION',
            id: cB.id,
            reason: `Contract "${cB.id}" has incompatible configuration definitions.`
          });
        }
      }
    }
  }

  // 2. Detect Test ID Collisions with divergent criteria
  const testsMapA = new Map(repA.tests.map(t => [t.id, t]));
  for (const tB of repB.tests) {
    if (testsMapA.has(tB.id)) {
      const tA = testsMapA.get(tB.id);
      if (
        tA.category !== tB.category ||
        tA.layer !== tB.layer ||
        tA.gate !== tB.gate ||
        tA.description !== tB.description ||
        tA.pass_criteria !== tB.pass_criteria
      ) {
        conflicts.push({
          type: 'DUPLICATE_TEST_ID',
          id: tB.id,
          reason: `Canonical test ID "${tB.id}" is declared in both specs with divergent definitions.`
        });
      }
    }
  }

  return {
    valid: conflicts.length === 0,
    conflicts
  };
}

/**
 * Merges two specifications if no conflicts exist.
 * @param {string|object} specA 
 * @param {string|object} specB 
 * @returns {object} Merged representation
 */
function mergeSpecs(specA, specB) {
  const conflictReport = detectSpecConflicts(specA, specB);
  if (!conflictReport.valid) {
    const err = new Error(`Conflictos detectados al fusionar especificaciones: ${conflictReport.conflicts.map(c => `${c.type} (${c.id}): ${c.reason}`).join('; ')}`);
    err.code = 'SPEC_MERGE_CONFLICT';
    err.conflicts = conflictReport.conflicts;
    throw err;
  }

  const repA = normalizeSpecRepresentation(specA);
  const repB = normalizeSpecRepresentation(specB);

  // Merge contracts (union by ID)
  const contractsMap = new Map();
  for (const c of repA.contracts) contractsMap.set(c.id, c);
  for (const c of repB.contracts) contractsMap.set(c.id, c);

  // Merge tests (union by ID)
  const testsMap = new Map();
  for (const t of repA.tests) testsMap.set(t.id, t);
  for (const t of repB.tests) testsMap.set(t.id, t);

  return {
    contracts: Array.from(contractsMap.values()),
    tests: Array.from(testsMap.values()),
    requirements: [...repA.requirements, ...repB.requirements]
  };
}

module.exports = {
  detectSpecConflicts,
  mergeSpecs
};
