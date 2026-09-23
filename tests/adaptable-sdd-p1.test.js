'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { detectRigorLevel, validateRigorRequirements } = require('../src/lib/sdd-rigor');
const { parseSpecDelta, applySpecDelta } = require('../src/lib/spec-delta');
const { detectSpecConflicts, mergeSpecs } = require('../src/lib/spec-merge');
const { computeAmendmentSignature, computeAmendmentIntegrityHash, validateContractAmendments } = require('../src/lib/contract-amendments');

// ============================================================================
// Group A: SDD Rigor Levels (TEST-RIGOR-A01 .. TEST-RIGOR-A04)
// ============================================================================

test('TEST-RIGOR-A01: Quick rigor level validates with single artifact without requiring plan/tasks', () => {
  const quickSpec = `---
rigor: quick
---
# Quick Doc Update
Only single artifact needed.
`;
  const rigor = detectRigorLevel(quickSpec);
  assert.equal(rigor, 'quick');

  const result = validateRigorRequirements('quick', {
    specContent: quickSpec,
    planContent: null,
    tasksContent: null
  });

  assert.equal(result.valid, true);
  assert.equal(result.single_artifact_allowed, true);
});

test('TEST-RIGOR-A02: Fix rigor level enforces presence of linked regression test in test matrix', () => {
  // 1. Without regression test -> fail closed
  const fixMatrixWithoutReg = [
    { id: 'TEST-CORE-A01', category: 'CORE', description: 'Regular feature test' }
  ];
  const failResult = validateRigorRequirements('fix', {
    specContent: '# Bugfix',
    testMatrix: fixMatrixWithoutReg
  });
  assert.equal(failResult.valid, false);
  assert.equal(failResult.code, 'FIX_MISSING_REGRESSION_TEST');

  // 2. With regression test (category REGRESSION) -> pass
  const fixMatrixWithReg = [
    { id: 'TEST-BUG-R01', category: 'REGRESSION', description: 'Reproduce and prevent auth bypass' }
  ];
  const passResult = validateRigorRequirements('fix', {
    specContent: '# Bugfix',
    testMatrix: fixMatrixWithReg
  });
  assert.equal(passResult.valid, true);
  assert.equal(passResult.regression_test_id, 'TEST-BUG-R01');
});

test('TEST-RIGOR-A03: Feature rigor level enforces complete 3-phase SDD artifacts and closure manifest', () => {
  // Missing plan.md
  const missingPlan = validateRigorRequirements('feature', {
    specContent: '# Feature',
    planContent: null,
    tasksContent: '- [x] task'
  });
  assert.equal(missingPlan.valid, false);
  assert.equal(missingPlan.code, 'FEATURE_PLAN_MISSING');

  // Missing tasks.md
  const missingTasks = validateRigorRequirements('feature', {
    specContent: '# Feature',
    planContent: '# Plan',
    tasksContent: null
  });
  assert.equal(missingTasks.valid, false);
  assert.equal(missingTasks.code, 'FEATURE_TASKS_MISSING');

  // All 3 present
  const complete = validateRigorRequirements('feature', {
    specContent: '# Feature',
    planContent: '# Plan',
    tasksContent: '- [x] task'
  });
  assert.equal(complete.valid, true);
});

test('TEST-RIGOR-A04: High-risk rigor level fails closed without Threat Model, Rollback Plan, and 2 approvals', () => {
  const specNoThreat = '# High Risk Feature';
  const planNoRollback = '# Implementation Plan';

  // 1. Missing threat model
  const r1 = validateRigorRequirements('high-risk', {
    specContent: specNoThreat,
    planContent: '## Rollback Plan\nRollback via git revert.',
    sidecar: { approvals: [{ approver: 'alice', signature: 'sig1' }, { approver: 'bob', signature: 'sig2' }] }
  });
  assert.equal(r1.valid, false);
  assert.equal(r1.code, 'HIGH_RISK_MISSING_THREAT_MODEL');

  // 2. Missing rollback plan
  const r2 = validateRigorRequirements('high-risk', {
    specContent: '## Threat Model\nSTRIDE analysis.',
    planContent: planNoRollback,
    sidecar: { approvals: [{ approver: 'alice', signature: 'sig1' }, { approver: 'bob', signature: 'sig2' }] }
  });
  assert.equal(r2.valid, false);
  assert.equal(r2.code, 'HIGH_RISK_MISSING_ROLLBACK_PLAN');

  // 3. Insufficient approvals (< 2 unique approvers)
  const r3 = validateRigorRequirements('high-risk', {
    specContent: '## Threat Model\nSTRIDE analysis.',
    planContent: '## Rollback Plan\nRollback steps.',
    sidecar: { approvals: [{ approver: 'alice', signature: 'sig1' }] }
  });
  assert.equal(r3.valid, false);
  assert.equal(r3.code, 'HIGH_RISK_INSUFFICIENT_APPROVALS');

  // 4. Valid with threat model, rollback plan, and dual approvals
  const r4 = validateRigorRequirements('high-risk', {
    specContent: '## Threat Model\nSTRIDE analysis.',
    planContent: '## Rollback Plan\nRollback steps.',
    sidecar: {
      approvals: [
        { approver: 'alice', signature: 'sig1', timestamp: '2026-09-23T00:00:00Z' },
        { approver: 'bob', signature: 'sig2', timestamp: '2026-09-23T00:00:00Z' }
      ]
    }
  });
  assert.equal(r4.valid, true);
  assert.equal(r4.approvals_count, 2);
});

// ============================================================================
// Group B: Incremental Spec Deltas (TEST-DELTA-B01 .. TEST-DELTA-B03)
// ============================================================================

test('TEST-DELTA-B01: Parses and applies ADDED, MODIFIED, and REMOVED deltas onto a base spec', () => {
  const baseSpec = {
    contracts: [
      { id: 'c1', type: 'BOOLEAN_INVARIANT', value: true },
      { id: 'c2', type: 'ENUM_SET', values: ['a', 'b'] }
    ],
    requirements: [{ id: 'FR-001', text: 'Old requirement' }],
    tests: [{ id: 'TEST-001', category: 'CORE', description: 'Original test' }]
  };

  const delta = {
    added: {
      contracts: [{ id: 'c3', type: 'BOOLEAN_INVARIANT', value: false }],
      tests: [{ id: 'TEST-002', category: 'CORE', description: 'Added test' }]
    },
    modified: {
      contracts: [{ id: 'c2', type: 'ENUM_SET', values: ['a', 'b', 'c'] }]
    },
    removed: {
      contracts: ['c1'],
      requirements: ['FR-001']
    }
  };

  const merged = applySpecDelta(baseSpec, delta);

  // c1 removed, c2 modified, c3 added
  assert.equal(merged.contracts.length, 2);
  assert.equal(merged.contracts.find(c => c.id === 'c1'), undefined);
  assert.deepEqual(merged.contracts.find(c => c.id === 'c2').values, ['a', 'b', 'c']);
  assert.equal(merged.contracts.find(c => c.id === 'c3').value, false);

  // requirements: FR-001 removed
  assert.equal(merged.requirements.length, 0);

  // tests: TEST-001 preserved, TEST-002 added
  assert.equal(merged.tests.length, 2);
  assert.ok(merged.tests.find(t => t.id === 'TEST-001'));
  assert.ok(merged.tests.find(t => t.id === 'TEST-002'));
});

test('TEST-DELTA-B02: Preserves untouched baseline requirements and contracts when applying deltas', () => {
  const baseSpec = {
    contracts: [
      { id: 'c-immutable', type: 'BOOLEAN_INVARIANT', value: true },
      { id: 'c-untouched', type: 'ENUM_SET', values: ['x', 'y'] }
    ],
    requirements: [{ id: 'FR-STABLE', text: 'Must remain untouched' }],
    tests: [{ id: 'TEST-STABLE', category: 'SECURITY', description: 'Untouched test' }]
  };

  const delta = {
    added: {
      tests: [{ id: 'TEST-NEW', category: 'CORE', description: 'New test' }]
    },
    modified: {},
    removed: {}
  };

  const merged = applySpecDelta(baseSpec, delta);

  assert.equal(merged.contracts.length, 2);
  assert.equal(merged.contracts[0].id, 'c-immutable');
  assert.equal(merged.contracts[1].id, 'c-untouched');
  assert.equal(merged.requirements.length, 1);
  assert.equal(merged.requirements[0].id, 'FR-STABLE');
  assert.equal(merged.tests.length, 2);
  assert.equal(merged.tests[0].id, 'TEST-STABLE');
});

test('TEST-DELTA-B03: Fails closed when an incremental delta modifies or removes a non-existent item', () => {
  const baseSpec = {
    contracts: [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }],
    requirements: [],
    tests: []
  };

  // Modify non-existent contract
  assert.throws(
    () => applySpecDelta(baseSpec, { modified: { contracts: [{ id: 'c-ghost', value: false }] } }),
    err => err.code === 'DELTA_TARGET_NOT_FOUND'
  );

  // Remove non-existent test
  assert.throws(
    () => applySpecDelta(baseSpec, { removed: { tests: ['TEST-GHOST'] } }),
    err => err.code === 'DELTA_TARGET_NOT_FOUND'
  );
});

// ============================================================================
// Group C: Spec Conflict & Merge (TEST-MERGE-C01 .. TEST-MERGE-C03)
// ============================================================================

test('TEST-MERGE-C01: Spec merge detects colliding contract IDs with divergent values or schemas', () => {
  const specA = {
    contracts: [{ id: 'auth-contract', type: 'BOOLEAN_INVARIANT', value: true }]
  };
  const specB = {
    contracts: [{ id: 'auth-contract', type: 'BOOLEAN_INVARIANT', value: false }]
  };

  const report = detectSpecConflicts(specA, specB);
  assert.equal(report.valid, false);
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].type, 'CONTRACT_COLLISION');
  assert.equal(report.conflicts[0].id, 'auth-contract');

  assert.throws(() => mergeSpecs(specA, specB), err => err.code === 'SPEC_MERGE_CONFLICT');
});

test('TEST-MERGE-C02: Spec merge detects colliding canonical test IDs declared across concurrent specs', () => {
  const specA = {
    contracts: [],
    tests: [{ id: 'TEST-COLLIDE-01', category: 'AUTH', layer: 'UNIT', pass_criteria: 'Criteria A' }]
  };
  const specB = {
    contracts: [],
    tests: [{ id: 'TEST-COLLIDE-01', category: 'AUTH', layer: 'INTEGRATION', pass_criteria: 'Criteria B' }]
  };

  const report = detectSpecConflicts(specA, specB);
  assert.equal(report.valid, false);
  assert.equal(report.conflicts.length, 1);
  assert.equal(report.conflicts[0].type, 'DUPLICATE_TEST_ID');
  assert.equal(report.conflicts[0].id, 'TEST-COLLIDE-01');
});

test('TEST-MERGE-C03: Spec merge succeeds cleanly when contract sets and test IDs are disjoint or identical', () => {
  const specA = {
    contracts: [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }],
    tests: [{ id: 'TEST-001', category: 'CORE', layer: 'UNIT', pass_criteria: 'Passes' }]
  };
  const specB = {
    contracts: [
      { id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }, // Identical -> no conflict
      { id: 'c2', type: 'BOOLEAN_INVARIANT', value: false } // Disjoint -> no conflict
    ],
    tests: [
      { id: 'TEST-002', category: 'CORE', layer: 'UNIT', pass_criteria: 'Passes' }
    ]
  };

  const report = detectSpecConflicts(specA, specB);
  assert.equal(report.valid, true);
  assert.equal(report.conflicts.length, 0);

  const merged = mergeSpecs(specA, specB);
  assert.equal(merged.contracts.length, 2);
  assert.equal(merged.tests.length, 2);
});

// ============================================================================
// Group D: Formal Contract Amendments (TEST-AMEND-D01 .. TEST-AMEND-D06)
// ============================================================================

const testAmendmentSecret = 'gemstack-amendment-boundary-secret-32b!';

test('TEST-AMEND-D01: Accepts contract modification only when accompanied by a valid formal signed amendment record', () => {
  const upstream = [{ id: 'rate-limit', type: 'ENUM_SET', values: ['10rpm'] }];
  const current = [{ id: 'rate-limit', type: 'ENUM_SET', values: ['10rpm', '60rpm'] }];

  // 1. Without amendment -> fail closed
  const failResult = validateContractAmendments(upstream, current, [], { secret: testAmendmentSecret });
  assert.equal(failResult.valid, false);
  assert.equal(failResult.code, 'UNAUTHORIZED_CONTRACT_MUTATION');

  // 2. With valid signed amendment -> pass
  const amendment = {
    amendment_id: 'AMD-RATE-001',
    contract_id: 'rate-limit',
    version: 2,
    reason: 'Expand rate limit for batch processing',
    approved_by: 'lead-architect@gemstack.ai'
  };
  amendment.signature = computeAmendmentSignature(amendment, testAmendmentSecret, {
    previousContract: upstream[0],
    proposedContract: current[0]
  });

  const passResult = validateContractAmendments(upstream, current, [amendment], { secret: testAmendmentSecret });
  assert.equal(passResult.valid, true);
  assert.equal(passResult.verified_amendments, 1);
});

test('TEST-AMEND-D02: Rejects contract amendments that are unapproved or have invalid signatures', () => {
  const upstream = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }];
  const current = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: false }];

  const tamperedAmendment = {
    amendment_id: 'AMD-002',
    contract_id: 'c1',
    version: 2,
    reason: 'Unjustified alteration',
    approved_by: 'attacker',
    signature: 'fake_signature_hex_12345'
  };

  const result = validateContractAmendments(upstream, current, [tamperedAmendment], { secret: testAmendmentSecret });
  assert.equal(result.valid, false);
  assert.equal(result.code, 'AMENDMENT_SIGNATURE_INVALID');
});

test('TEST-AMEND-D03: Verifies amendment integrity hash separate from human approval signature', () => {
  const amendment = {
    amendment_id: 'AMD-HASH-001',
    contract_id: 'sec-boundary',
    version: 3,
    reason: 'Upgrading HMAC key rotation policy',
    approved_by: 'cso@gemstack.ai'
  };

  // Integrity hash (unkeyed record digest)
  const hash1 = computeAmendmentIntegrityHash(amendment);
  assert.equal(typeof hash1, 'string');
  assert.equal(hash1.length, 64);

  // HMAC approval signature (requires trusted secret)
  const sig1 = computeAmendmentSignature(amendment, testAmendmentSecret);
  assert.equal(typeof sig1, 'string');
  assert.equal(sig1.length, 64);
  assert.notEqual(hash1, sig1); // Integrity hash != approval signature

  // Field sensitivity: tampering any field changes hash and signature
  const tampered = { ...amendment, reason: 'Tampered reason' };
  const hashTampered = computeAmendmentIntegrityHash(tampered);
  assert.notEqual(hash1, hashTampered);
  const sigTampered = computeAmendmentSignature(tampered, testAmendmentSecret);
  assert.notEqual(sig1, sigTampered);
});

test('TEST-AMEND-D04: Fails closed when trusted signing secret is missing for contract modification', () => {
  const upstream = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }];
  const current = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: false }];

  const amendment = {
    amendment_id: 'AMD-004',
    contract_id: 'c1',
    version: 2,
    reason: 'Valid reason',
    approved_by: 'architect@gemstack.ai',
    signature: 'some_sig'
  };

  const oldEnv = process.env.GEMSTACK_AMENDMENT_SECRET;
  delete process.env.GEMSTACK_AMENDMENT_SECRET;
  try {
    const res = validateContractAmendments(upstream, current, [amendment], {});
    assert.equal(res.valid, false);
    assert.equal(res.code, 'AMENDMENT_SECRET_MISSING');
  } finally {
    if (oldEnv) process.env.GEMSTACK_AMENDMENT_SECRET = oldEnv;
  }
});

test('TEST-AMEND-D05: Detects subsequent contract modification or tampering after signature', () => {
  const upstream = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }];
  const approvedProposal = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: false }];
  const attackerTamperedProposal = [{ id: 'c1', type: 'MALICIOUS_OVERRIDE', payload: 'rm -rf /' }];

  const amendment = {
    amendment_id: 'AMD-005',
    contract_id: 'c1',
    version: 2,
    reason: 'Disable invariant for testing',
    approved_by: 'lead@gemstack.ai'
  };
  amendment.signature = computeAmendmentSignature(amendment, testAmendmentSecret, {
    previousContract: upstream[0],
    proposedContract: approvedProposal[0]
  });

  // Validating against approved proposal -> passes
  const validRes = validateContractAmendments(upstream, approvedProposal, [amendment], { secret: testAmendmentSecret });
  assert.equal(validRes.valid, true);

  // Validating against tampered proposal -> fails
  const tamperedRes = validateContractAmendments(upstream, attackerTamperedProposal, [amendment], { secret: testAmendmentSecret });
  assert.equal(tamperedRes.valid, false);
  assert.equal(tamperedRes.code, 'AMENDMENT_SIGNATURE_INVALID');
});

test('TEST-AMEND-D06: Detects cross-feature signature replay attack', () => {
  const upstream = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }];
  const current = [{ id: 'c1', type: 'BOOLEAN_INVARIANT', value: false }];

  const amendment = {
    amendment_id: 'AMD-006',
    feature_id: '010-feature-a',
    contract_id: 'c1',
    version: 2,
    reason: 'Approved for feature A',
    approved_by: 'lead@gemstack.ai'
  };
  amendment.signature = computeAmendmentSignature(amendment, testAmendmentSecret, {
    feature_id: '010-feature-a',
    previousContract: upstream[0],
    proposedContract: current[0]
  });

  // Replay attempt on feature B -> fails closed
  const replayRes = validateContractAmendments(upstream, current, [amendment], {
    secret: testAmendmentSecret,
    feature_id: '011-feature-b'
  });

  assert.equal(replayRes.valid, false);
  assert.equal(replayRes.code, 'AMENDMENT_REPLAY_DETECTED');
});

test('TEST-AMEND-D07: CLI verify rejects project when frozen contract is modified without a valid signed amendment', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-verify-amend-fail-'));
  const initCmd = require('../src/commands/init');
  const verifyCmd = require('../src/commands/verify');
  const { writeStateAtomic } = require('../src/lib/state');

  try {
    await initCmd({ dryRun: false, yes: true, target: tempDir });

    const specDir = path.join(tempDir, 'specs', '001-test');
    fs.mkdirSync(specDir, { recursive: true });

    // spec.md declares contract c1 = true
    const specMd = `# Spec\n\`\`\`gemstack-contracts\n[\n  {"id": "c1", "type": "BOOLEAN_INVARIANT", "value": true}\n]\n\`\`\`\n`;
    fs.writeFileSync(path.join(specDir, 'spec.md'), specMd, 'utf8');

    // plan.md modifies contract c1 to false
    const planMd = `# Plan\n\`\`\`gemstack-contracts\n[\n  {"id": "c1", "type": "BOOLEAN_INVARIANT", "value": false}\n]\n\`\`\`\n`;
    fs.writeFileSync(path.join(specDir, 'plan.md'), planMd, 'utf8');

    writeStateAtomic(tempDir, {
      version: '0.1',
      current_phase: 'plan',
      active_spec: 'specs/001-test',
      phase_hashes: {}
    });

    const forgedAmendment = [{
      amendment_id: 'AMD-FORGED',
      contract_id: 'c1',
      version: 2,
      reason: 'Unapproved modification',
      approved_by: 'attacker',
      signature: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    }];
    fs.writeFileSync(path.join(specDir, 'amendments.json'), JSON.stringify(forgedAmendment, null, 2), 'utf8');

    const originalExit = process.exit;
    let exitCalled = false;
    process.exit = (code) => {
      exitCalled = true;
      throw new Error(`process.exit called with ${code}`);
    };

    try {
      await assert.rejects(
        async () => {
          await verifyCmd({ target: tempDir, runTests: false });
        },
        /process\.exit called with 1/
      );
      assert.equal(exitCalled, true);
    } finally {
      process.exit = originalExit;
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TEST-AMEND-D08: CLI verify succeeds when modified contract has a valid formal signed amendment', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-verify-amend-pass-'));
  const initCmd = require('../src/commands/init');
  const verifyCmd = require('../src/commands/verify');
  const { writeStateAtomic } = require('../src/lib/state');

  const oldSecret = process.env.GEMSTACK_AMENDMENT_SECRET;
  process.env.GEMSTACK_AMENDMENT_SECRET = testAmendmentSecret;

  try {
    await initCmd({ dryRun: false, yes: true, target: tempDir });

    const specDir = path.join(tempDir, 'specs', '001-test');
    fs.mkdirSync(specDir, { recursive: true });

    // spec.md declares contract c1 = true
    const specMd = `# Spec\n\`\`\`gemstack-contracts\n[\n  {"id": "c1", "type": "BOOLEAN_INVARIANT", "value": true}\n]\n\`\`\`\n`;
    fs.writeFileSync(path.join(specDir, 'spec.md'), specMd, 'utf8');

    // plan.md modifies contract c1 to false
    const planMd = `# Plan\n\`\`\`gemstack-contracts\n[\n  {"id": "c1", "type": "BOOLEAN_INVARIANT", "value": false}\n]\n\`\`\`\n`;
    fs.writeFileSync(path.join(specDir, 'plan.md'), planMd, 'utf8');

    writeStateAtomic(tempDir, {
      version: '0.1',
      current_phase: 'plan',
      active_spec: 'specs/001-test',
      phase_hashes: {}
    });

    const upstreamContract = { id: 'c1', type: 'BOOLEAN_INVARIANT', value: true };
    const proposedContract = { id: 'c1', type: 'BOOLEAN_INVARIANT', value: false };

    const validAmendment = {
      amendment_id: 'AMD-VALID-001',
      feature_id: '001-test',
      contract_id: 'c1',
      version: 2,
      reason: 'Authorized modification by Lead Architect',
      approved_by: 'lead@gemstack.ai'
    };
    validAmendment.signature = computeAmendmentSignature(validAmendment, testAmendmentSecret, {
      feature_id: '001-test',
      previousContract: upstreamContract,
      proposedContract: proposedContract
    });

    fs.writeFileSync(path.join(specDir, 'amendments.json'), JSON.stringify([validAmendment], null, 2), 'utf8');

    await assert.doesNotReject(async () => {
      await verifyCmd({ target: tempDir, runTests: false });
    });
  } finally {
    if (oldSecret) process.env.GEMSTACK_AMENDMENT_SECRET = oldSecret;
    else delete process.env.GEMSTACK_AMENDMENT_SECRET;
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
