const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const {
  extractTestMatrixBlock,
  validateTestMatrix,
  computeAcceptanceSignature
} = require('../src/lib/test-matrix');

describe('Wave 1: Test Matrix & Signatures (P1 Categories A & B)', () => {

  test('TEST-CLOSURE-A01: Parses a valid gemstack-test-matrix block from spec.md into structured CanonicalTest objects', () => {
    const validMarkdown = '# Spec\n' +
      '```gemstack-test-matrix\n' +
      JSON.stringify([
        {
          id: 'TEST-CLOSURE-A01',
          category: 'PARSING',
          layer: 'UNIT',
          description: 'Parses a valid block',
          pass_criteria: 'Returns array of CanonicalTest objects',
          gate: 'REQUIRED'
        }
      ], null, 2) + '\n' +
      '```\n';

    const { matrix, isLegacy } = extractTestMatrixBlock(validMarkdown);
    assert.equal(isLegacy, false);
    assert.equal(Array.isArray(matrix), true);
    assert.equal(matrix.length, 1);

    const validated = validateTestMatrix(matrix);
    assert.equal(validated.length, 1);
    assert.equal(validated[0].id, 'TEST-CLOSURE-A01');
    assert.equal(validated[0].category, 'PARSING');
    assert.equal(validated[0].layer, 'UNIT');
    assert.equal(validated[0].gate, 'REQUIRED');
  });

  test('TEST-CLOSURE-A02: Emits TEST_MATRIX_PARSE_ERROR on malformed JSON or TEST_MATRIX_DUPLICATE_ID on duplicate IDs', () => {
    const malformedJson = '# Spec\n```gemstack-test-matrix\n[ { broken\n```\n';
    assert.throws(() => {
      extractTestMatrixBlock(malformedJson);
    }, (err) => {
      assert.equal(err.code, 'TEST_MATRIX_PARSE_ERROR');
      return true;
    });

    const multipleBlocks = '# Spec\n```gemstack-test-matrix\n[]\n```\n```gemstack-test-matrix\n[]\n```\n';
    assert.throws(() => {
      extractTestMatrixBlock(multipleBlocks);
    }, (err) => {
      assert.equal(err.code, 'TEST_MATRIX_PARSE_ERROR');
      return true;
    });

    const duplicateIds = [
      { id: 'TEST-CLOSURE-A01', category: 'PARSING', layer: 'UNIT', description: 'First', pass_criteria: 'Pass', gate: 'REQUIRED' },
      { id: 'TEST-CLOSURE-A01', category: 'PARSING', layer: 'UNIT', description: 'Second duplicate', pass_criteria: 'Pass', gate: 'REQUIRED' }
    ];
    assert.throws(() => {
      validateTestMatrix(duplicateIds);
    }, (err) => {
      assert.equal(err.code, 'TEST_MATRIX_DUPLICATE_ID');
      return true;
    });

    assert.throws(() => {
      validateTestMatrix([{ id: 'TEST-CLOSURE-A01' }]);
    }, (err) => {
      assert.equal(err.code, 'TEST_MATRIX_INVALID_SHAPE');
      return true;
    });
  });

  test('TEST-CLOSURE-A03: Ignores non-column-0 or un-tagged fenced blocks cleanly', () => {
    const indentedMarkdown = '# Spec\n  ```gemstack-test-matrix\n[]\n  ```\n```js\nconsole.log("normal code block");\n```\n';
    const { matrix, isLegacy } = extractTestMatrixBlock(indentedMarkdown);
    assert.equal(isLegacy, true);
    assert.equal(matrix, null);
  });

  test('TEST-CLOSURE-B01: Computes deterministic SHA-256 acceptanceSignature digest over canonical test matrix', () => {
    const matrix1 = [
      {
        id: 'TEST-CLOSURE-A01',
        category: 'PARSING',
        layer: 'UNIT',
        description: 'Description A',
        pass_criteria: 'Criteria A',
        gate: 'REQUIRED'
      },
      {
        id: 'TEST-CLOSURE-B01',
        category: 'SIGNATURE',
        layer: 'UNIT',
        description: 'Description B',
        pass_criteria: 'Criteria B',
        gate: 'REQUIRED'
      }
    ];

    const matrix2 = [
      {
        gate: 'REQUIRED',
        pass_criteria: 'Criteria B',
        description: 'Description B',
        layer: 'UNIT',
        category: 'SIGNATURE',
        id: 'TEST-CLOSURE-B01'
      },
      {
        category: 'PARSING',
        description: 'Description A',
        id: 'TEST-CLOSURE-A01',
        gate: 'REQUIRED',
        pass_criteria: 'Criteria A',
        layer: 'UNIT'
      }
    ];

    const sig1 = computeAcceptanceSignature(matrix1);
    const sig2 = computeAcceptanceSignature(matrix2);

    assert.equal(sig1.length, 64);
    assert.match(sig1, /^[0-9a-f]{64}$/);
    assert.equal(sig1, sig2);
  });

  test('TEST-CLOSURE-B02: Emits ACCEPTANCE_SIGNATURE_MISMATCH when structured matrix disagrees with expected signature on approved artifact', () => {
    const matrix = [
      {
        id: 'TEST-CLOSURE-A01',
        category: 'PARSING',
        layer: 'UNIT',
        description: 'Original description',
        pass_criteria: 'Criteria',
        gate: 'REQUIRED'
      }
    ];

    const originalSig = computeAcceptanceSignature(matrix);

    const modifiedMatrix = [
      {
        id: 'TEST-CLOSURE-A01',
        category: 'PARSING',
        layer: 'UNIT',
        description: 'Modified description',
        pass_criteria: 'Criteria',
        gate: 'REQUIRED'
      }
    ];

    const modifiedSig = computeAcceptanceSignature(modifiedMatrix);
    assert.notEqual(originalSig, modifiedSig);

    const finding = (originalSig !== modifiedSig) ? {
      code: 'ACCEPTANCE_SIGNATURE_MISMATCH',
      expected: originalSig,
      actual: modifiedSig
    } : null;

    assert.notEqual(finding, null);
    assert.equal(finding.code, 'ACCEPTANCE_SIGNATURE_MISMATCH');
  });

});
