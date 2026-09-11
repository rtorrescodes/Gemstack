const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const {
  parsePlanBindings,
  parsePlanGates,
  parseTaskMetadata,
  reconcileTaskTraceability
} = require('../src/lib/closure-context');

describe('Wave 2: Traceability (P1 Category E & Bindings)', () => {

  test('TEST-CLOSURE-E01: Validates unidirectional task binding (TASK -> TEST IDs) and enforces validation_required field', () => {
    const validTasks = '# Tasks\n' +
      '- [ ] **T001: Implement something**\n' +
      '  <!-- gemstack:validation_required=true -->\n' +
      '  <!-- gemstack:tests=TEST-CLOSURE-A01 -->\n' +
      '  <!-- gemstack:files=src/lib/test.js -->\n' +
      '  <!-- gemstack:depends= -->\n' +
      '- [ ] **T002: Document something**\n' +
      '  <!-- gemstack:validation_required=false -->\n' +
      '  <!-- gemstack:tests= -->\n' +
      '  <!-- gemstack:files=README.md -->\n' +
      '  <!-- gemstack:depends=T001 -->\n';

    const tasks = parseTaskMetadata(validTasks);
    assert.equal(tasks.length, 2);
    assert.equal(tasks[0].validation_required, true);
    assert.deepEqual(tasks[0].tests, ['TEST-CLOSURE-A01']);
    assert.equal(tasks[1].validation_required, false);
    assert.deepEqual(tasks[1].tests, []);

    // Missing validation_required
    const missingValidation = '# Tasks\n- [ ] **T001: Task without metadata**\n';
    assert.throws(() => {
      parseTaskMetadata(missingValidation);
    }, (err) => {
      assert.equal(err.code, 'TASK_VALIDATION_MISSING');
      return true;
    });

    // validation_required=true with no tests
    const trueWithNoTests = '# Tasks\n- [ ] **T001: Task requiring validation but no tests**\n' +
      '  <!-- gemstack:validation_required=true -->\n' +
      '  <!-- gemstack:tests= -->\n';
    assert.throws(() => {
      parseTaskMetadata(trueWithNoTests);
    }, (err) => {
      assert.equal(err.code, 'TASK_VALIDATION_MISSING');
      return true;
    });
  });

  test('TEST-CLOSURE-E02: Confirms every required canonical test is bound to at least one implementation task', () => {
    const canonicalMatrix = [
      { id: 'TEST-CLOSURE-A01', gate: 'REQUIRED' },
      { id: 'TEST-CLOSURE-A02', gate: 'REQUIRED' }
    ];

    const tasksMapped = [
      { id: 'T001', validation_required: true, tests: ['TEST-CLOSURE-A01'] },
      { id: 'T002', validation_required: true, tests: ['TEST-CLOSURE-A02'] }
    ];

    const result = reconcileTaskTraceability(canonicalMatrix, tasksMapped);
    assert.equal(result.unmappedCanonical.length, 0);
    assert.equal(result.summary.unmapped_canonical_tests.length, 0);
    assert.deepEqual(result.reverseMap['TEST-CLOSURE-A01'], ['T001']);
    assert.deepEqual(result.reverseMap['TEST-CLOSURE-A02'], ['T002']);

    // Unmapped canonical test
    const tasksUnmapped = [
      { id: 'T001', validation_required: true, tests: ['TEST-CLOSURE-A01'] }
    ];
    const resultUnmapped = reconcileTaskTraceability(canonicalMatrix, tasksUnmapped);
    assert.equal(resultUnmapped.unmappedCanonical.length, 1);
    assert.equal(resultUnmapped.unmappedCanonical[0], 'TEST-CLOSURE-A02');
  });

});
