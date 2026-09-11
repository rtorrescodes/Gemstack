const crypto = require('node:crypto');
const { normalizeContent } = require('./hasher');

const CANONICAL_LAYERS = ['UNIT', 'INTEGRATION', 'E2E', 'CLI'];
const CANONICAL_GATES = ['REQUIRED', 'SUPPLEMENTAL'];
const CANONICAL_ID_REGEX = /^TEST-[A-Z0-9]+-[A-Z0-9]+$/;
const REQUIRED_FIELDS = ['id', 'category', 'layer', 'description', 'pass_criteria', 'gate'];

/**
 * Extracts the single column-0 gemstack-test-matrix block from markdown.
 *
 * @param {string} markdownContent
 * @returns {{ matrix: Array<object>|null, isLegacy: boolean }}
 */
function extractTestMatrixBlock(markdownContent) {
  const normalized = normalizeContent(markdownContent);
  const lines = normalized.split('\n');
  const fence = '```';
  const header = '```gemstack-test-matrix';

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
    return { matrix: null, isLegacy: true };
  }

  if (blocks.length > 1) {
    const err = new Error(`Multiple gemstack-test-matrix blocks detected (${blocks.length}). Exactly one is permitted.`);
    err.code = 'TEST_MATRIX_PARSE_ERROR';
    throw err;
  }

  const jsonRaw = blocks[0].trim();
  let parsed;
  try {
    parsed = JSON.parse(jsonRaw);
  } catch (parseErr) {
    const err = new Error(`Failed to parse gemstack-test-matrix JSON: ${parseErr.message}`);
    err.code = 'TEST_MATRIX_PARSE_ERROR';
    throw err;
  }

  return { matrix: parsed, isLegacy: false };
}

/**
 * Validates a canonical test matrix array.
 *
 * @param {any} matrix
 * @returns {Array<object>} Sanitized array of canonical test objects
 */
function validateTestMatrix(matrix) {
  if (!Array.isArray(matrix)) {
    const err = new Error('gemstack-test-matrix must be a JSON array of test objects');
    err.code = 'TEST_MATRIX_INVALID_SHAPE';
    throw err;
  }

  const seenIds = new Set();
  const validated = [];

  for (let i = 0; i < matrix.length; i++) {
    const item = matrix[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      const err = new Error(`Item at index ${i} in gemstack-test-matrix must be a non-null object`);
      err.code = 'TEST_MATRIX_INVALID_SHAPE';
      throw err;
    }

    // Check unknown fields
    const keys = Object.keys(item);
    for (const k of keys) {
      if (!REQUIRED_FIELDS.includes(k)) {
        const err = new Error(`Item at index ${i} contains unknown field: "${k}"`);
        err.code = 'TEST_MATRIX_INVALID_SHAPE';
        throw err;
      }
    }

    // Check required fields and empty values
    for (const rf of REQUIRED_FIELDS) {
      if (!(rf in item)) {
        const err = new Error(`Item at index ${i} missing required field: "${rf}"`);
        err.code = 'TEST_MATRIX_INVALID_SHAPE';
        throw err;
      }
      if (typeof item[rf] !== 'string' || item[rf].trim().length === 0) {
        const err = new Error(`Item at index ${i} field "${rf}" must be a non-empty string`);
        err.code = 'TEST_MATRIX_INVALID_SHAPE';
        throw err;
      }
    }

    // Validate ID regex
    if (!CANONICAL_ID_REGEX.test(item.id)) {
      const err = new Error(`Item at index ${i} has invalid ID "${item.id}". Must match ^TEST-[A-Z0-9]+-[A-Z0-9]+$`);
      err.code = 'TEST_MATRIX_INVALID_SHAPE';
      throw err;
    }

    // Validate duplicate ID
    if (seenIds.has(item.id)) {
      const err = new Error(`Duplicate test ID detected in gemstack-test-matrix: "${item.id}"`);
      err.code = 'TEST_MATRIX_DUPLICATE_ID';
      throw err;
    }
    seenIds.add(item.id);

    // Validate enum fields
    if (!CANONICAL_LAYERS.includes(item.layer)) {
      const err = new Error(`Item "${item.id}" has invalid layer "${item.layer}". Must be one of: ${CANONICAL_LAYERS.join(', ')}`);
      err.code = 'TEST_MATRIX_INVALID_SHAPE';
      throw err;
    }

    if (!CANONICAL_GATES.includes(item.gate)) {
      const err = new Error(`Item "${item.id}" has invalid gate "${item.gate}". Must be one of: ${CANONICAL_GATES.join(', ')}`);
      err.code = 'TEST_MATRIX_INVALID_SHAPE';
      throw err;
    }

    validated.push({
      id: item.id,
      category: item.category,
      layer: item.layer,
      description: item.description,
      pass_criteria: item.pass_criteria,
      gate: item.gate
    });
  }

  return validated;
}

/**
 * Computes deterministic SHA-256 acceptanceSignature digest over canonical test matrix.
 *
 * @param {Array<object>} matrix
 * @returns {string} 64-character lowercase hexadecimal digest
 */
function computeAcceptanceSignature(matrix) {
  const validated = validateTestMatrix(matrix);

  // Sort canonical records by id using deterministic code-unit ordering
  const sorted = [...validated].sort((a, b) => (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0)));

  // Normalize each record with ASCII-sorted keys: category, description, gate, id, layer, pass_criteria
  const normalizedRecords = sorted.map(rec => ({
    category: rec.category,
    description: rec.description,
    gate: rec.gate,
    id: rec.id,
    layer: rec.layer,
    pass_criteria: rec.pass_criteria
  }));

  const canonicalJson = JSON.stringify(normalizedRecords);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

module.exports = {
  CANONICAL_LAYERS,
  CANONICAL_GATES,
  CANONICAL_ID_REGEX,
  REQUIRED_FIELDS,
  extractTestMatrixBlock,
  validateTestMatrix,
  computeAcceptanceSignature
};
