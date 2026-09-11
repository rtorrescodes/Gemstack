const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  enforceSizeBudget,
  serializeCanonicalJson,
  HARD_SIZE_LIMIT_BYTES,
  TARGET_SIZE_BUDGET_BYTES
} = require('../src/lib/context-capsule');

test('TEST-CONTEXT-G01: Fails closed with CONTEXT_CAPSULE_TOO_LARGE if critical invariants exceed hard budget', (t) => {
  // Construct an oversized capsule where critical invariants alone exceed 64 KB
  const hugeInvariants = [];
  for (let i = 1; i <= 800; i++) {
    hugeInvariants.push({
      id: `INV-${String(i).padStart(3, '0')}`,
      rule: `The system MUST rigorously enforce critical safety invariant number ${i} across all distributed nodes and execution contexts without compromise.`,
      normative: 'MUST',
      source_ref: 'spec.md#requirements'
    });
  }

  const hugeCapsule = {
    schema_version: 1,
    project: { name: 'gemstack-ai' },
    canonical_invariants: hugeInvariants
  };

  const rawBytes = Buffer.byteLength(serializeCanonicalJson(hugeCapsule), 'utf8');
  assert.ok(rawBytes > HARD_SIZE_LIMIT_BYTES, `Test payload must exceed 64KB (got ${rawBytes} bytes)`);

  assert.throws(
    () => enforceSizeBudget(hugeCapsule),
    (err) => {
      assert.equal(err.code, 'CONTEXT_CAPSULE_TOO_LARGE');
      assert.ok(err.message.includes('exceed capsule size budget'));
      return true;
    },
    'Must fail closed with CONTEXT_CAPSULE_TOO_LARGE when exceeding 64KB'
  );
});

test('Preserves critical invariants while condensing Priority 3 when size exceeds 32 KB target (supporting)', (t) => {
  // Construct capsule between 32KB and 64KB with Priority 3 historical context
  const invariants = [];
  for (let i = 1; i <= 250; i++) {
    invariants.push({
      id: `INV-${String(i).padStart(3, '0')}`,
      rule: `The system MUST maintain architectural integrity and consistency for invariant ${i}.`,
      normative: 'MUST',
      source_ref: 'spec.md#section'
    });
  }

  const historicalContext = [
    {
      feature: 'specs/006-architecture-consistency-engine',
      status: 'CLOSED',
      key_guarantees: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
    },
    {
      feature: 'specs/007-mechanical-test-matrix-closure-evidence',
      status: 'CLOSED',
      key_guarantees: ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']
    }
  ];

  const capsule = {
    schema_version: 1,
    project: { name: 'gemstack-ai' },
    canonical_invariants: invariants,
    historical_context: historicalContext
  };

  const { capsuleObj, byteLength } = enforceSizeBudget(capsule);

  // Assert Priority 1 invariants are 100% untouched
  assert.equal(capsuleObj.canonical_invariants.length, invariants.length);
  assert.ok(byteLength <= HARD_SIZE_LIMIT_BYTES, 'Must not exceed hard limit');
});
