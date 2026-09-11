const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const { reconcileTestRun } = require('../src/lib/runner-adapters');

describe('Wave 3: Reconciliation Engine (P1 Category C)', () => {

  test('TEST-CLOSURE-C01: Verifies exact arithmetic: executed canonical + executed supporting = total physical executed', () => {
    const canonicalMatrix = [
      { id: 'TEST-CLOSURE-A01', gate: 'REQUIRED' },
      { id: 'TEST-CLOSURE-A02', gate: 'REQUIRED' }
    ];

    const planBindings = [
      { test_id: 'TEST-CLOSURE-A01', file: 'tests/test-matrix.test.js' },
      { test_id: 'TEST-CLOSURE-A02', file: 'tests/test-matrix.test.js' }
    ];

    const executedEvents = [
      { id: 'TEST-CLOSURE-A01', rawOutcome: 'PASS' },
      { id: 'TEST-CLOSURE-A02', rawOutcome: 'PASS' },
      { id: null, rawOutcome: 'PASS' } // supporting test
    ];

    const result = reconcileTestRun(canonicalMatrix, planBindings, executedEvents);
    assert.equal(result.mathValid, true);
    assert.equal(result.canonicalCount, 2);
    assert.equal(result.supportingCount, 1);
    assert.equal(result.totalPhysical, 3);
    assert.equal(result.canonicalCount + result.supportingCount, result.totalPhysical);
  });

  test('TEST-CLOSURE-C02: Identifies missing or unexecuted canonical tests when required canonical test IDs are not executed', () => {
    const canonicalMatrix = [
      { id: 'TEST-CLOSURE-A01', gate: 'REQUIRED' },
      { id: 'TEST-CLOSURE-A02', gate: 'REQUIRED' },
      { id: 'TEST-CLOSURE-A03', gate: 'REQUIRED' }
    ];

    // A01 & A02 bound in plan; A03 missing from plan bindings
    const planBindings = [
      { test_id: 'TEST-CLOSURE-A01', file: 'tests/test-matrix.test.js' },
      { test_id: 'TEST-CLOSURE-A02', file: 'tests/test-matrix.test.js' }
    ];

    // Only A01 actually executed in runner
    const executedEvents = [
      { id: 'TEST-CLOSURE-A01', rawOutcome: 'PASS' }
    ];

    const result = reconcileTestRun(canonicalMatrix, planBindings, executedEvents);

    // A03 has no plan binding -> missing
    assert.deepEqual(result.missing, ['TEST-CLOSURE-A03']);

    // A02 has plan binding but was not executed -> notExecuted
    assert.deepEqual(result.notExecuted, ['TEST-CLOSURE-A02']);
  });

  test('TEST-CLOSURE-C03: Detects phantom tests (claimed tests absent from runner execution traces)', () => {
    // If closure manifest claims a test passed, but runner events didn't execute it
    const claimedIds = ['TEST-CLOSURE-A01', 'TEST-CLOSURE-A02'];
    const executedRunnerEvents = [{ id: 'TEST-CLOSURE-A01', rawOutcome: 'PASS' }];

    const executedIdSet = new Set(executedRunnerEvents.map(e => e.id));
    const phantoms = claimedIds.filter(id => !executedIdSet.has(id));

    assert.equal(phantoms.length, 1);
    assert.equal(phantoms[0], 'TEST-CLOSURE-A02');

    let finding = null;
    if (phantoms.length > 0) {
      finding = {
        code: 'PHANTOM_TEST',
        phantomIds: phantoms,
        is_blocking: true,
        waivable: false
      };
    }

    assert.notEqual(finding, null);
    assert.equal(finding.code, 'PHANTOM_TEST');
    assert.equal(finding.waivable, false);
  });

  test('TEST-CLOSURE-C04: Detects orphan tests (physical tests claiming non-existent canonical IDs)', () => {
    const canonicalMatrix = [
      { id: 'TEST-CLOSURE-A01', gate: 'REQUIRED' }
    ];

    const planBindings = [
      { test_id: 'TEST-CLOSURE-A01', file: 'tests/test-matrix.test.js' }
    ];

    // Physical test claims TEST-CLOSURE-Z99 which is NOT in spec.md
    const executedEvents = [
      { id: 'TEST-CLOSURE-A01', rawOutcome: 'PASS' },
      { id: 'TEST-CLOSURE-Z99', rawOutcome: 'PASS' }
    ];

    const result = reconcileTestRun(canonicalMatrix, planBindings, executedEvents);
    assert.equal(result.orphans.length, 1);
    assert.equal(result.orphans[0], 'TEST-CLOSURE-Z99');
  });

});
