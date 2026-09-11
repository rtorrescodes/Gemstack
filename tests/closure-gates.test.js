const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { extractTestMatrixBlock } = require('../src/lib/test-matrix');
const shipCommand = require('../src/commands/ship');

describe('Wave 5: Closure Gates & Legacy Compatibility (P1 Categories G & H)', () => {

  test('TEST-CLOSURE-G01: Blocks transition to SHIPPED when any REQUIRED closure gate fails or evidence is STALE', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ship-g01-'));
    const gemstackDir = path.join(tmpDir, '.gemstack');
    const featureDir = path.join(tmpDir, 'specs', '007-test');
    fs.mkdirSync(gemstackDir, { recursive: true });
    fs.mkdirSync(featureDir, { recursive: true });

    // Initial state
    const state = {
      version: '0.1',
      current_phase: 'tasks',
      active_spec: 'specs/007-test',
      phase_hashes: {}
    };
    fs.writeFileSync(path.join(gemstackDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');

    // Case 1: missing closure.json
    const specMd = '# Spec\n```gemstack-test-matrix\n[\n  {\n    "id": "TEST-TEST-001",\n    "category": "TEST",\n    "layer": "UNIT",\n    "description": "desc",\n    "pass_criteria": "pass",\n    "gate": "REQUIRED"\n  }\n]\n```\n';
    fs.writeFileSync(path.join(featureDir, 'spec.md'), specMd, 'utf8');

    let errorCaught = false;
    try {
      await shipCommand({ target: tmpDir });
    } catch (e) {
      errorCaught = true;
      assert.match(e.message, /closure\.json/i);
    }
    assert.equal(errorCaught, true, 'Should block ship when closure.json is missing');

    // Case 2: status is BLOCKED
    const blockedManifest = {
      schema: 'gemstack-closure',
      version: 1,
      status: 'BLOCKED',
      blockers: [{ code: 'REQUIRED_TEST_FAILED', message: 'Test failed' }]
    };
    fs.writeFileSync(path.join(featureDir, 'closure.json'), JSON.stringify(blockedManifest, null, 2), 'utf8');

    errorCaught = false;
    try {
      await shipCommand({ target: tmpDir });
    } catch (e) {
      errorCaught = true;
      assert.match(e.message, /BLOCKED/);
    }
    assert.equal(errorCaught, true, 'Should block ship when status is BLOCKED');

    // Case 3: status is STALE
    const staleManifest = {
      schema: 'gemstack-closure',
      version: 1,
      status: 'STALE',
      blockers: [{ code: 'CLOSURE_EVIDENCE_STALE', message: 'Evidence stale' }]
    };
    fs.writeFileSync(path.join(featureDir, 'closure.json'), JSON.stringify(staleManifest, null, 2), 'utf8');

    errorCaught = false;
    try {
      await shipCommand({ target: tmpDir });
    } catch (e) {
      errorCaught = true;
      assert.match(e.message, /STALE/);
    }
    assert.equal(errorCaught, true, 'Should block ship when status is STALE');

    // Verify lifecycle was NOT mutated
    const currentState = JSON.parse(fs.readFileSync(path.join(gemstackDir, 'state.json'), 'utf8'));
    assert.equal(currentState.current_phase, 'tasks');
    assert.equal(currentState.active_spec, 'specs/007-test');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('TEST-CLOSURE-G02: Allows transition to SHIPPED when all REQUIRED gates pass (VERIFIED or policy-permitted VERIFIED_WITH_EXCEPTIONS)', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ship-g02-'));
    const gemstackDir = path.join(tmpDir, '.gemstack');
    const featureDir = path.join(tmpDir, 'specs', '007-test');
    fs.mkdirSync(gemstackDir, { recursive: true });
    fs.mkdirSync(featureDir, { recursive: true });

    const specMd = '# Spec\n```gemstack-test-matrix\n[\n  {\n    "id": "TEST-TEST-001",\n    "category": "TEST",\n    "layer": "UNIT",\n    "description": "desc",\n    "pass_criteria": "pass",\n    "gate": "REQUIRED"\n  }\n]\n```\n';
    fs.writeFileSync(path.join(featureDir, 'spec.md'), specMd, 'utf8');

    // Valid VERIFIED manifest
    const verifiedManifest = {
      schema: 'gemstack-closure',
      version: 1,
      feature: 'specs/007-test',
      status: 'VERIFIED',
      required_gates: { 'project-tests': 'PASS' },
      blockers: []
    };
    fs.writeFileSync(path.join(featureDir, 'closure.json'), JSON.stringify(verifiedManifest, null, 2), 'utf8');

    const state = {
      version: '0.1',
      current_phase: 'tasks',
      active_spec: 'specs/007-test',
      phase_hashes: {}
    };
    fs.writeFileSync(path.join(gemstackDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');

    // Ship with yes flag
    const result = await shipCommand({ target: tmpDir, yes: true });
    assert.equal(result.shipped, true);

    const updatedState = JSON.parse(fs.readFileSync(path.join(gemstackDir, 'state.json'), 'utf8'));
    assert.equal(updatedState.current_phase, 'shipped');
    assert.equal(updatedState.active_spec, null);
    assert.equal(updatedState.last_completed_feature, 'specs/007-test');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('TEST-CLOSURE-H01: Preserves backward compatibility for specs without gemstack-test-matrix blocks', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ship-h01-'));
    const gemstackDir = path.join(tmpDir, '.gemstack');
    const featureDir = path.join(tmpDir, 'specs', '001-legacy');
    fs.mkdirSync(gemstackDir, { recursive: true });
    fs.mkdirSync(featureDir, { recursive: true });

    // Legacy spec without matrix
    const legacySpecMd = '# Legacy Feature\nThis feature has no test matrix.\n';
    fs.writeFileSync(path.join(featureDir, 'spec.md'), legacySpecMd, 'utf8');

    const state = {
      version: '0.1',
      current_phase: 'tasks',
      active_spec: 'specs/001-legacy',
      phase_hashes: {}
    };
    fs.writeFileSync(path.join(gemstackDir, 'state.json'), JSON.stringify(state, null, 2), 'utf8');

    // Ship should succeed in legacy mode without closure.json
    const result = await shipCommand({ target: tmpDir, yes: true });
    assert.equal(result.shipped, true);
    assert.equal(result.legacy, true);

    const updatedState = JSON.parse(fs.readFileSync(path.join(gemstackDir, 'state.json'), 'utf8'));
    assert.equal(updatedState.current_phase, 'shipped');
    assert.equal(updatedState.active_spec, null);
    assert.equal(updatedState.last_completed_feature, 'specs/001-legacy');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

});
