const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const {
  validateReviewSeparation,
  validateRoleWriteScope,
  projectWorkerContext,
  validateWorkerLimits,
  validateSwarmProviderSafety
} = require('../src/lib/swarm');

describe('Upgrade E: Swarm Review, Safety & Context (TEST-SWARM-B01 .. D02)', () => {

  // --- CATEGORY B: Separation of Duties (AUTHOR != REVIEWER) ---

  test('TEST-SWARM-B01: Rejects task review attestation when author ID matches reviewer ID (Self-Review)', () => {
    const selfReviewTask = {
      task_id: 'TASK-SWARM-01',
      worker_id: 'worker-alice',
      assigned_role: 'implementer',
      review: {
        reviewer_id: 'worker-alice', // identical to author
        reviewer_role: 'reviewer',
        status: 'APPROVED'
      }
    };

    const check = validateReviewSeparation(selfReviewTask);
    assert.equal(check.valid, false);
    assert.equal(check.findings.length, 1);
    assert.equal(check.findings[0].code, 'SWARM_SELF_REVIEW_DETECTED');
    assert.equal(check.findings[0].contractId, 'author-not-reviewer');
  });

  test('TEST-SWARM-B02: Accepts task review when performed by a distinct, authorized reviewer role', () => {
    const validReviewTask = {
      task_id: 'TASK-SWARM-01',
      worker_id: 'worker-alice',
      assigned_role: 'implementer',
      review: {
        reviewer_id: 'worker-bob', // distinct reviewer
        reviewer_role: 'reviewer',
        status: 'APPROVED'
      }
    };

    const check = validateReviewSeparation(validReviewTask);
    assert.equal(check.valid, true);
    assert.equal(check.findings.length, 0);
  });

  test('Reviewer Write Scope: Rejects reviewer attempting to modify application files', () => {
    const check = validateRoleWriteScope('reviewer', ['src/lib/foo.js'], 'TASK-01');
    assert.equal(check.valid, false);
    assert.equal(check.findings[0].code, 'SWARM_WRITE_SET_VIOLATION');
  });

  // --- CATEGORY C: Gate Integration (Upgrade C) ---

  test('TEST-SWARM-C01: Proves swarm worker model invocation is intercepted by ProviderCapabilityGate', () => {
    // Undeclared provider capability must be denied fail-closed
    const unauthorizedAction = {
      provider_id: 'commercial-llm-cloud',
      capability_id: 'undeclared-generation-capability'
    };

    const decision = validateSwarmProviderSafety(unauthorizedAction);
    assert.equal(decision.authorized, false);
    assert.equal(decision.code, 'SWARM_PROVIDER_UNAUTHORIZED');
  });

  test('TEST-SWARM-C02: Enforces budget limits across concurrent swarm workers via BillableActionGate', () => {
    // Declared provider action exceeding wave budget limit
    const overBudgetAction = {
      provider_id: 'trusted-mock',
      capability_id: 'mock_generation',
      estimated_tokens: 150000
    };

    const decision = validateSwarmProviderSafety(overBudgetAction, { budget_limit: 100000 });
    assert.equal(decision.authorized, false);
    assert.equal(decision.code, 'SWARM_COST_LIMIT_EXCEEDED');
  });

  // --- CATEGORY D: Context Projection (Upgrade D) ---

  test('TEST-SWARM-D01: Validates that worker context projection matches authoritative context-capsule hash', () => {
    const mockCapsule = {
      active_feature: {
        id: '010-agent-swarm-visual-qa',
        active_tasks: [
          { id: 'UE-T001', title: 'Task 1' }
        ]
      },
      provenance: {
        source_set_hash: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0'
      },
      canonical_invariants: ['SWARM_AUTHORITY_SUBORDINATE']
    };

    // 1. Fresh projection when hash matches live capsule
    const freshProj = projectWorkerContext(
      mockCapsule,
      'UE-T001',
      'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0'
    );
    assert.equal(freshProj.freshness, 'FRESH');
    assert.equal(freshProj.task_id, 'UE-T001');
    assert.equal(freshProj.source_capsule_hash, mockCapsule.provenance.source_set_hash);

    // 2. Stale projection when live hash has drifted
    const staleProj = projectWorkerContext(
      mockCapsule,
      'UE-T001',
      'drifted_hash_9999999999999999999999999999999999999999999999999999999999'
    );
    assert.equal(staleProj.freshness, 'STALE');
  });

  test('TEST-SWARM-D02: Excludes historical chat transcripts and conversational narrative from worker payloads', () => {
    const mockCapsule = {
      active_feature: { id: '010-agent-swarm-visual-qa', active_tasks: [] },
      provenance: { source_set_hash: 'abc123hash' },
      canonical_invariants: []
    };

    const proj = projectWorkerContext(mockCapsule, 'UE-T001');
    assert.equal(proj.chat_history, null);
    assert.equal(proj.developer_prompts, null);
    assert.equal(Object.prototype.hasOwnProperty.call(proj, 'chat_history'), true);
  });

  test('Worker Limits: Rejects recursive child worker spawning', () => {
    const manifestWithRecursiveWorker = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      waves: [
        {
          wave_index: 1,
          tasks: [
            {
              task_id: 'UE-T001',
              worker_id: 'worker-1',
              assigned_role: 'implementer',
              spawned_children: ['worker-child-1', 'worker-child-2']
            }
          ]
        }
      ]
    };

    const limitsCheck = validateWorkerLimits(manifestWithRecursiveWorker);
    assert.equal(limitsCheck.valid, false);
    assert.equal(limitsCheck.findings[0].code, 'SWARM_RECURSIVE_SPAWN_DENIED');
  });

});
