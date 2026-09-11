const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  computeFindingFingerprint,
  formatDisplayFingerprint,
  createFinding,
  computeContextHash,
  reconcileFindings,
  evaluateAcceptedExceptions
} = require('../src/lib/findings');
const {
  readState,
  writeStateAtomic,
  readSidecar,
  writeSidecarAtomic
} = require('../src/lib/state');

describe('Wave 1 / Suite 3: Findings, Anti-Loop, Exceptions & Atomic State (P1-D, P1-E, P1-F, P1-G)', () => {

  test('TEST-CONSISTENCY-D01: Canonical 64-character SHA-256 fingerprint with POSIX relative location; display token cosmetic only', () => {
    const payload = {
      code: 'FROZEN_CONTRACT_VIOLATION',
      contractId: 'job-status',
      phase: 'plan',
      location: 'specs\\006-architecture-consistency-engine\\plan.md'
    };

    const fp = computeFindingFingerprint(payload);
    assert.equal(fp.length, 64);
    assert.match(fp, /^[0-9a-f]{64}$/);

    // Identical payload with posix slash produces identical fingerprint
    const fpPosix = computeFindingFingerprint({
      ...payload,
      location: 'specs/006-architecture-consistency-engine/plan.md'
    });
    assert.equal(fp, fpPosix);

    // Display fingerprint is cosmetic 12-char prefix
    const display = formatDisplayFingerprint(fp);
    assert.equal(display.length, 12);
    assert.equal(display, fp.slice(0, 12));
  });

  test('TEST-CONSISTENCY-D02: Fixed finding marks RESOLVED; persisting violation reopens OPEN', () => {
    const contractId = 'c-test';
    const violation = {
      code: 'FROZEN_CONTRACT_VIOLATION',
      contractId,
      phase: 'plan',
      location: 'specs/test/plan.md',
      delta: { added: ['BAD'] }
    };

    // 1. Initial detection -> OPEN
    let findings = reconcileFindings([], [violation]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, 'OPEN');

    // 2. Violation resolved in subsequent check (no violations) -> RESOLVED
    findings = reconcileFindings(findings, []);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, 'RESOLVED');
    assert.ok(findings[0].resolved_at);

    // 3. Violation recurs -> reopens OPEN (Anti-loop)
    findings = reconcileFindings(findings, [violation]);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].status, 'OPEN');
  });

  test('TEST-CONSISTENCY-E01: Accepted exception with identical full contextHash suppresses blocker', () => {
    const upstreamHash = 'a'.repeat(64);
    const currentHash = 'b'.repeat(64);
    const contractRep = JSON.stringify({ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true });

    const contextHash = computeContextHash({
      upstreamAcceptedPhaseHash: upstreamHash,
      currentComparedPhaseHash: currentHash,
      normalizedContractRepresentation: contractRep
    });
    assert.equal(contextHash.length, 64);

    const fp = computeFindingFingerprint({
      code: 'FROZEN_CONTRACT_VIOLATION',
      contractId: 'c1',
      phase: 'plan',
      location: 'specs/test/plan.md'
    });

    const activeFinding = {
      fingerprint: fp,
      contractId: 'c1',
      phase: 'plan',
      status: 'OPEN',
      is_blocking: true
    };

    const acceptedExceptions = [
      {
        fingerprint: fp,
        reason: 'Temporary architectural compromise for migration',
        approvedByHuman: true,
        contextHash,
        createdAt: new Date().toISOString()
      }
    ];

    const currentContext = {
      upstreamAcceptedPhaseHash: upstreamHash,
      currentComparedPhaseHash: currentHash,
      normalizedContractRepresentation: contractRep
    };

    const evaluated = evaluateAcceptedExceptions([activeFinding], acceptedExceptions, currentContext);
    assert.equal(evaluated.length, 1);
    assert.equal(evaluated[0].status, 'ACCEPTED_EXCEPTION');
    assert.equal(evaluated[0].is_blocking, false);
  });

  test('TEST-CONSISTENCY-E02: Mutation of upstream hash, current phase hash, or normalized contract invalidates exception', () => {
    const upstreamHash = 'a'.repeat(64);
    const currentHash = 'b'.repeat(64);
    const contractRep = JSON.stringify({ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true });

    const originalContextHash = computeContextHash({
      upstreamAcceptedPhaseHash: upstreamHash,
      currentComparedPhaseHash: currentHash,
      normalizedContractRepresentation: contractRep
    });

    const fp = computeFindingFingerprint({
      code: 'FROZEN_CONTRACT_VIOLATION',
      contractId: 'c1',
      phase: 'plan',
      location: 'specs/test/plan.md'
    });

    const activeFinding = {
      fingerprint: fp,
      contractId: 'c1',
      phase: 'plan',
      status: 'OPEN',
      is_blocking: true
    };

    const acceptedExceptions = [
      {
        fingerprint: fp,
        contextHash: originalContextHash,
        approvedByHuman: true
      }
    ];

    // Case 1: Upstream hash mutated
    const contextMutatedUpstream = {
      upstreamAcceptedPhaseHash: 'f'.repeat(64),
      currentComparedPhaseHash: currentHash,
      normalizedContractRepresentation: contractRep
    };
    const res1 = evaluateAcceptedExceptions([{ ...activeFinding }], acceptedExceptions, contextMutatedUpstream);
    assert.equal(res1[0].status, 'OPEN');
    assert.equal(res1[0].is_blocking, true);

    // Case 2: Current phase hash mutated
    const contextMutatedCurrent = {
      upstreamAcceptedPhaseHash: upstreamHash,
      currentComparedPhaseHash: 'e'.repeat(64),
      normalizedContractRepresentation: contractRep
    };
    const res2 = evaluateAcceptedExceptions([{ ...activeFinding }], acceptedExceptions, contextMutatedCurrent);
    assert.equal(res2[0].status, 'OPEN');
    assert.equal(res2[0].is_blocking, true);

    // Case 3: Normalized contract mutated
    const contextMutatedContract = {
      upstreamAcceptedPhaseHash: upstreamHash,
      currentComparedPhaseHash: currentHash,
      normalizedContractRepresentation: JSON.stringify({ id: 'c1', type: 'BOOLEAN_INVARIANT', value: false })
    };
    const res3 = evaluateAcceptedExceptions([{ ...activeFinding }], acceptedExceptions, contextMutatedContract);
    assert.equal(res3[0].status, 'OPEN');
    assert.equal(res3[0].is_blocking, true);
  });

  test('TEST-CONSISTENCY-F02: Legacy state.json v0.1 loads safely; state.json never persists historical findings or exceptions arrays', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-state-test-'));
    const stateDir = path.join(tempDir, '.gemstack');
    fs.mkdirSync(stateDir, { recursive: true });

    // Legacy state with accidental historical arrays
    const legacyState = {
      version: '0.1',
      current_phase: 'spec',
      status: 'SPEC_COMPLETE',
      active_spec: 'specs/001-test/',
      findings: [{ code: 'SOME_VIOLATION' }],
      accepted_exceptions: [{ fingerprint: 'xyz' }]
    };
    fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(legacyState, null, 2), 'utf8');

    const loaded = readState(tempDir);
    assert.equal(loaded.version, '0.1');
    assert.equal(loaded.current_phase, 'spec');
    assert.equal(loaded.phase_hashes, null);
    assert.deepEqual(loaded.completed_phases, []);
    // Boundary invariant: findings and exceptions are stripped from state object
    assert.equal(loaded.findings, undefined);
    assert.equal(loaded.accepted_exceptions, undefined);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  test('TEST-CONSISTENCY-G02: Atomic state writing prevents partial or corrupted files; persists operational state only, sidecar holds history', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-state-atomic-'));
    const stateDir = path.join(tempDir, '.gemstack');
    const featureDir = path.join(tempDir, 'specs', '006-test');
    fs.mkdirSync(stateDir, { recursive: true });
    fs.mkdirSync(featureDir, { recursive: true });

    const stateObj = {
      version: '0.1',
      current_phase: 'plan',
      status: 'PLAN_COMPLETE',
      phase_hashes: { spec: 'abc' },
      consistency: { status: 'PASS', open_blockers: 0 },
      findings: [{ fingerprint: 'bad1' }],
      accepted_exceptions: [{ fingerprint: 'ex1' }]
    };

    writeStateAtomic(tempDir, stateObj);

    const reloaded = readState(tempDir);
    assert.equal(reloaded.current_phase, 'plan');
    assert.equal(reloaded.phase_hashes.spec, 'abc');
    assert.deepEqual(reloaded.consistency, { status: 'PASS', open_blockers: 0 });
    // Boundary check: state.json strictly does not contain findings or accepted_exceptions
    assert.equal(reloaded.findings, undefined);
    assert.equal(reloaded.accepted_exceptions, undefined);

    const stateRaw = JSON.parse(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8'));
    assert.equal(stateRaw.findings, undefined);
    assert.equal(stateRaw.accepted_exceptions, undefined);

    // Feature sidecar holds historical findings and exceptions
    const sidecarObj = {
      phase_hashes: { spec: 'abc' },
      historical_findings: [{ fingerprint: 'bad1' }],
      accepted_exceptions: [{ fingerprint: 'ex1' }]
    };
    writeSidecarAtomic(featureDir, sidecarObj);

    const reloadedSidecar = readSidecar(featureDir);
    assert.equal(reloadedSidecar.historical_findings.length, 1);
    assert.equal(reloadedSidecar.historical_findings[0].fingerprint, 'bad1');

    // Ensure no left-over .tmp files exist
    const files = fs.readdirSync(stateDir);
    assert.ok(files.includes('state.json'));
    assert.ok(!files.some(f => f.includes('.tmp')));

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

});
