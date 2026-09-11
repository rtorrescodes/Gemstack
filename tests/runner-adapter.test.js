const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  executeNodeTestRunner,
  parseNodeTestTap
} = require('../src/lib/runner-adapters');

describe('Wave 3: Runner Adapter (P1 Category D)', () => {

  test('TEST-CLOSURE-D01: Executes node:test via child_process without shell:true and extracts structured results', async () => {
    // Run an existing small test file directly via the runner adapter
    const result = await executeNodeTestRunner(process.cwd(), ['tests/hasher.test.js']);
    assert.equal(typeof result.exitCode, 'number');
    assert.equal(typeof result.stdout, 'string');
    assert.equal(result.exitCode, 0);

    const parsed = parseNodeTestTap(result.stdout);
    assert.equal(parsed.physicalTotal, 4);
    assert.equal(parsed.passed, 4);
    assert.equal(parsed.failed, 0);
    assert.equal(parsed.suites.length, 1);
  });

  test('TEST-CLOSURE-D02: Extracts canonical test IDs embedded in test title strings or metadata', () => {
    const sampleTap = 'TAP version 13\n' +
      '# Subtest: TEST-CLOSURE-A01: Parses a valid block\n' +
      'ok 1 - TEST-CLOSURE-A01: Parses a valid block # time=2.1ms\n' +
      '  ---\n' +
      '  duration_ms: 2.1\n' +
      '  type: \'test\'\n' +
      '  ...\n' +
      '# Subtest: [TEST-CLOSURE-B01] Computes digest\n' +
      'ok 2 - [TEST-CLOSURE-B01] Computes digest # time=1.4ms\n' +
      '  ---\n' +
      '  duration_ms: 1.4\n' +
      '  type: \'test\'\n' +
      '  ...\n' +
      '# Subtest: Helper supporting test without canonical token\n' +
      'ok 3 - Helper supporting test without canonical token # time=0.8ms\n' +
      '  ---\n' +
      '  duration_ms: 0.8\n' +
      '  type: \'test\'\n' +
      '  ...\n' +
      'ok 4 - Sample Test Suite Container\n' +
      '  ---\n' +
      '  duration_ms: 4.5\n' +
      '  type: \'suite\'\n' +
      '  ...\n' +
      '1..3\n';

    const parsed = parseNodeTestTap(sampleTap);
    assert.equal(parsed.physicalTotal, 3);
    assert.equal(parsed.passed, 3);
    assert.equal(parsed.suites.length, 1);

    const tests = parsed.tests;
    assert.equal(tests[0].id, 'TEST-CLOSURE-A01');
    assert.equal(tests[0].isSupporting, false);

    assert.equal(tests[1].id, 'TEST-CLOSURE-B01');
    assert.equal(tests[1].isSupporting, false);

    assert.equal(tests[2].id, null);
    assert.equal(tests[2].isSupporting, true);
  });

  test('TEST-CLOSURE-D03: Handles runner execution failure or non-zero exit code gracefully', async () => {
    // Pass a non-existent test file to observe graceful non-zero exit code
    const result = await executeNodeTestRunner(process.cwd(), ['tests/non-existent-test-file.test.js']);
    assert.notEqual(result.exitCode, 0);
    assert.equal(typeof result.exitCode, 'number');
    assert.equal(typeof result.durationMs, 'number');
  });

});
