'use strict';

/**
 * Incremental Spec Delta Engine (Gemstack 2.0 Sprint C)
 * Parses and applies structured ADDED, MODIFIED, REMOVED deltas onto base specifications.
 */

/**
 * Extracts and parses a spec delta block or JSON structure.
 * @param {string|object} input - Markdown content containing gemstack-spec-delta block or parsed delta object.
 * @returns {object} Normalized delta object { base_spec, added, modified, removed }
 */
function parseSpecDelta(input) {
  if (typeof input === 'object' && input !== null) {
    return normalizeDelta(input);
  }

  if (typeof input !== 'string') {
    throw new Error('Delta input must be a string or object');
  }

  const blockRegex = /```gemstack-spec-delta\s*([\s\S]*?)```/;
  const match = input.match(blockRegex);
  let parsed;

  if (match) {
    try {
      parsed = JSON.parse(match[1].trim());
    } catch (e) {
      const err = new Error(`Error parseando gemstack-spec-delta: ${e.message}`);
      err.code = 'DELTA_PARSE_ERROR';
      throw err;
    }
  } else {
    // Try parsing raw JSON
    try {
      parsed = JSON.parse(input.trim());
    } catch (e) {
      const err = new Error('No se encontró bloque gemstack-spec-delta ni JSON válido');
      err.code = 'DELTA_BLOCK_MISSING';
      throw err;
    }
  }

  return normalizeDelta(parsed);
}

function normalizeDelta(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    const err = new Error('Delta debe ser un objeto');
    err.code = 'INVALID_DELTA_SCHEMA';
    throw err;
  }

  return {
    base_spec: parsed.base_spec || null,
    added: {
      contracts: Array.isArray(parsed.added?.contracts) ? parsed.added.contracts : [],
      requirements: Array.isArray(parsed.added?.requirements) ? parsed.added.requirements : [],
      tests: Array.isArray(parsed.added?.tests) ? parsed.added.tests : []
    },
    modified: {
      contracts: Array.isArray(parsed.modified?.contracts) ? parsed.modified.contracts : [],
      requirements: Array.isArray(parsed.modified?.requirements) ? parsed.modified.requirements : [],
      tests: Array.isArray(parsed.modified?.tests) ? parsed.modified.tests : []
    },
    removed: {
      contracts: Array.isArray(parsed.removed?.contracts) ? parsed.removed.contracts : [],
      requirements: Array.isArray(parsed.removed?.requirements) ? parsed.removed.requirements : [],
      tests: Array.isArray(parsed.removed?.tests) ? parsed.removed.tests : []
    }
  };
}

/**
 * Applies a normalized delta onto a base specification representation.
 * @param {object} baseSpec - { contracts: [], requirements: [], tests: [] }
 * @param {object} delta - Normalized delta from parseSpecDelta
 * @returns {object} Merged specification representation
 */
function applySpecDelta(baseSpec, delta) {
  if (!baseSpec || typeof baseSpec !== 'object') {
    throw new Error('baseSpec must be an object');
  }

  const normDelta = normalizeDelta(delta);

  // Clone collections
  const contracts = Array.isArray(baseSpec.contracts) ? JSON.parse(JSON.stringify(baseSpec.contracts)) : [];
  const requirements = Array.isArray(baseSpec.requirements) ? JSON.parse(JSON.stringify(baseSpec.requirements)) : [];
  const tests = Array.isArray(baseSpec.tests) ? JSON.parse(JSON.stringify(baseSpec.tests)) : [];

  // 1. Process REMOVED
  for (const item of normDelta.removed.contracts) {
    const id = typeof item === 'string' ? item : item.id;
    const idx = contracts.findIndex(c => c.id === id);
    if (idx === -1) {
      const err = new Error(`No se puede remover el contrato "${id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    contracts.splice(idx, 1);
  }

  for (const item of normDelta.removed.tests) {
    const id = typeof item === 'string' ? item : item.id;
    const idx = tests.findIndex(t => t.id === id);
    if (idx === -1) {
      const err = new Error(`No se puede remover el test canónico "${id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    tests.splice(idx, 1);
  }

  for (const item of normDelta.removed.requirements) {
    const id = typeof item === 'string' ? item : item.id;
    const idx = requirements.findIndex(r => (typeof r === 'string' ? r === id : r.id === id));
    if (idx === -1) {
      const err = new Error(`No se puede remover el requisito "${id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    requirements.splice(idx, 1);
  }

  // 2. Process MODIFIED
  for (const item of normDelta.modified.contracts) {
    const idx = contracts.findIndex(c => c.id === item.id);
    if (idx === -1) {
      const err = new Error(`No se puede modificar el contrato "${item.id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    contracts[idx] = { ...contracts[idx], ...item };
  }

  for (const item of normDelta.modified.tests) {
    const idx = tests.findIndex(t => t.id === item.id);
    if (idx === -1) {
      const err = new Error(`No se puede modificar el test "${item.id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    tests[idx] = { ...tests[idx], ...item };
  }

  for (const item of normDelta.modified.requirements) {
    const id = typeof item === 'string' ? item : item.id;
    const idx = requirements.findIndex(r => (typeof r === 'string' ? r === id : r.id === id));
    if (idx === -1) {
      const err = new Error(`No se puede modificar el requisito "${id}": no existe en la especificación base.`);
      err.code = 'DELTA_TARGET_NOT_FOUND';
      throw err;
    }
    requirements[idx] = typeof item === 'string' ? item : { ...requirements[idx], ...item };
  }

  // 3. Process ADDED
  for (const item of normDelta.added.contracts) {
    const existing = contracts.find(c => c.id === item.id);
    if (existing) {
      const err = new Error(`Conflicto al agregar contrato "${item.id}": ya existe en la especificación base.`);
      err.code = 'DELTA_ADD_CONFLICT';
      throw err;
    }
    contracts.push(item);
  }

  for (const item of normDelta.added.tests) {
    const existing = tests.find(t => t.id === item.id);
    if (existing) {
      const err = new Error(`Conflicto al agregar test "${item.id}": ya existe en la especificación base.`);
      err.code = 'DELTA_ADD_CONFLICT';
      throw err;
    }
    tests.push(item);
  }

  for (const item of normDelta.added.requirements) {
    requirements.push(item);
  }

  return {
    contracts,
    requirements,
    tests
  };
}

module.exports = {
  parseSpecDelta,
  applySpecDelta
};
