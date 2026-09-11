const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const path = require('node:path');
const {
  parseSwarmManifest,
  validateSwarmSchema,
  planSwarmWaves,
  validateWritePartitions,
  validateSwarmAuthority,
  resolveTaskOwnership,
  canonicalSerialize
} = require('../src/lib/swarm');

describe('Upgrade E: Swarm Partitioning & Write Safety (TEST-SWARM-A01 .. A02)', () => {

  test('TEST-SWARM-A01: Validates that parallel tasks with disjoint write sets schedule cleanly in concurrent waves', () => {
    const tasks = [
      {
        task_id: 'TASK-SWARM-01',
        description: 'Module A implementer',
        assigned_role: 'implementer',
        worker_id: 'worker-impl-1',
        write_set: ['src/lib/module-a.js']
      },
      {
        task_id: 'TASK-SWARM-02',
        description: 'Module B implementer',
        assigned_role: 'implementer',
        worker_id: 'worker-impl-2',
        write_set: ['src/lib/module-b.js']
      },
      {
        task_id: 'TASK-SWARM-03',
        description: 'Module C implementer',
        assigned_role: 'implementer',
        worker_id: 'worker-impl-3',
        write_set: ['src/lib/module-c.js']
      }
    ];

    const waves = planSwarmWaves(tasks);
    assert.equal(waves.length, 1, 'Disjoint tasks should schedule into a single concurrent wave');
    assert.equal(waves[0].tasks.length, 3);

    // Verify wave partition check emits zero write collisions
    const check = validateWritePartitions(waves[0]);
    assert.equal(check.valid, true);
    assert.equal(check.findings.length, 0);
  });

  test('TEST-SWARM-A02: Detects overlapping write sets between parallel tasks and serializes them into sequential waves', () => {
    const tasks = [
      {
        task_id: 'TASK-SWARM-01',
        description: 'Core logic worker A',
        assigned_role: 'implementer',
        worker_id: 'worker-impl-1',
        write_set: ['src/lib/shared.js']
      },
      {
        task_id: 'TASK-SWARM-02',
        description: 'Core logic worker B (colliding)',
        assigned_role: 'implementer',
        worker_id: 'worker-impl-2',
        write_set: ['src/lib/shared.js']
      }
    ];

    // Planning should separate conflicting tasks into wave 1 and wave 2
    const waves = planSwarmWaves(tasks);
    assert.equal(waves.length, 2, 'Conflicting tasks must be separated into 2 distinct waves');
    assert.equal(waves[0].tasks.length, 1);
    assert.equal(waves[1].tasks.length, 1);
    assert.equal(waves[0].tasks[0].task_id, 'TASK-SWARM-01');
    assert.equal(waves[1].tasks[0].task_id, 'TASK-SWARM-02');

    // If an invalid wave with collisions is evaluated, validateWritePartitions must fail closed
    const collidedWave = {
      wave_index: 1,
      tasks: [
        { task_id: 'T1', write_set: ['src/lib/collision.js'] },
        { task_id: 'T2', write_set: ['src/lib/collision.js'] }
      ]
    };
    const collisionCheck = validateWritePartitions(collidedWave);
    assert.equal(collisionCheck.valid, false);
    assert.equal(collisionCheck.findings.length, 1);
    assert.equal(collisionCheck.findings[0].code, 'SWARM_WRITE_COLLISION');
    assert.equal(collisionCheck.findings[0].contractId, 'exclusive-task-write-ownership');
  });

  test('Swarm Authority Subordination: Rejects manifest attempting to override specification authority', () => {
    const maliciousManifest = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      overrides_spec: true,
      waves: []
    };

    const authCheck = validateSwarmAuthority(maliciousManifest);
    assert.equal(authCheck.valid, false);
    assert.equal(authCheck.findings[0].code, 'SWARM_AUTHORITY_CONFLICT');
    assert.equal(authCheck.findings[0].contractId, 'swarm-authority-subordinate');
  });

  test('Task Ownership: Detects orphaned tasks not declared in authoritative tasks.md', () => {
    const tasksMdContent = `
# Tasks
### Task UE-T001
Some description
### Task UE-T002
Another description
`;
    const manifest = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      waves: [
        {
          wave_index: 1,
          tasks: [
            { task_id: 'UE-T001', worker_id: 'worker-1', assigned_role: 'implementer', write_set: [] },
            { task_id: 'UNKNOWN-TASK-999', worker_id: 'worker-2', assigned_role: 'implementer', write_set: [] }
          ]
        }
      ]
    };

    const check = resolveTaskOwnership(tasksMdContent, manifest);
    assert.equal(check.valid, false);
    assert.equal(check.findings.length, 1);
    assert.equal(check.findings[0].code, 'SWARM_TASK_ORPHANED');
    assert.equal(check.findings[0].location, 'UNKNOWN-TASK-999');
  });

  test('Determinism: Serializes swarm manifest keys in UTF-16 code-unit order', () => {
    const obj = { z: 1, a: 2, m: { y: 3, b: 4 } };
    const serialized = canonicalSerialize(obj);
    assert.equal(serialized, '{"a":2,"m":{"b":4,"y":3},"z":1}');
  });

});
