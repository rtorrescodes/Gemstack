const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const {
  extractContractsBlock,
  validateContractSchemas,
  normalizeContract,
  comparePhaseContracts,
  resolvePhaseInheritance
} = require('../src/lib/contracts');

describe('Wave 1 / Suite 1: Contracts Parser & Consistency Engine (P1-A & P1-B)', () => {

  // --- CATEGORY A: Parsing & Validation (P1-A) ---

  test('TEST-CONSISTENCY-A01: Valid canonical gemstack-contracts block parses successfully', () => {
    const markdown = `# Spec
Some header
\`\`\`gemstack-contracts
[
  {
    "id": "job-status",
    "type": "ENUM_SET",
    "values": ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"],
    "description": "Standard job lifecycle status"
  }
]
\`\`\`
More text`;

    const result = extractContractsBlock(markdown);
    assert.equal(result.isLegacy, false);
    assert.equal(result.contracts.length, 1);
    assert.equal(result.contracts[0].id, 'job-status');
    assert.equal(result.contracts[0].type, 'ENUM_SET');

    const validated = validateContractSchemas(result.contracts);
    assert.equal(validated.length, 1);
  });

  test('TEST-CONSISTENCY-A02: Invalid JSON or multiple contract blocks throw CONTRACT_PARSE_ERROR', () => {
    // 1. Invalid JSON inside block
    const badJsonMarkdown = `# Spec
\`\`\`gemstack-contracts
[
  { "id": "test", "type": "BOOLEAN_INVARIANT", value: true }
]
\`\`\``;
    assert.throws(() => {
      extractContractsBlock(badJsonMarkdown);
    }, (err) => {
      assert.equal(err.code, 'CONTRACT_PARSE_ERROR');
      return true;
    });

    // 2. Multiple blocks throw CONTRACT_PARSE_ERROR
    const multipleBlocksMarkdown = `# Spec
\`\`\`gemstack-contracts
[]
\`\`\`
Middle
\`\`\`gemstack-contracts
[]
\`\`\``;
    assert.throws(() => {
      extractContractsBlock(multipleBlocksMarkdown);
    }, (err) => {
      assert.equal(err.code, 'CONTRACT_PARSE_ERROR');
      return true;
    });

    // 3. UTF-8 BOM throws CONTRACT_PARSE_ERROR with exact forbidden message
    const bomMarkdown = '\uFEFF# Spec\n```gemstack-contracts\n[]\n```';
    assert.throws(() => {
      extractContractsBlock(bomMarkdown);
    }, (err) => {
      assert.equal(err.code, 'CONTRACT_PARSE_ERROR');
      assert.match(err.message, /UTF-8 BOM is forbidden in phase artifacts/i);
      return true;
    });
  });

  test('TEST-CONSISTENCY-A03: Duplicate contract ID throws CONTRACT_DUPLICATE_ID', () => {
    const duplicateContracts = [
      { id: 'dup-id', type: 'BOOLEAN_INVARIANT', value: true, description: 'first' },
      { id: 'dup-id', type: 'BOOLEAN_INVARIANT', value: false, description: 'second' }
    ];

    assert.throws(() => {
      validateContractSchemas(duplicateContracts);
    }, (err) => {
      assert.equal(err.code, 'CONTRACT_DUPLICATE_ID');
      return true;
    });
  });

  // --- CATEGORY B: Cross-Phase Consistency (P1-B) ---

  test('TEST-CONSISTENCY-B01: ENUM_SET unapproved addition is BLOCKED (FROZEN_CONTRACT_VIOLATION)', () => {
    const specContracts = [
      { id: 'job-status', type: 'ENUM_SET', values: ['QUEUED', 'PROCESSING', 'COMPLETED'] }
    ];
    const planContracts = [
      { id: 'job-status', type: 'ENUM_SET', values: ['QUEUED', 'PROCESSING', 'COMPLETED', 'PURGED'] }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 1);
    assert.equal(violations[0].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations[0].contractId, 'job-status');
    assert.deepEqual(violations[0].delta.added, ['PURGED']);
  });

  test('TEST-CONSISTENCY-B02: ENUM_SET permuted equivalent order passes validation', () => {
    const specContracts = [
      { id: 'job-status', type: 'ENUM_SET', values: ['QUEUED', 'PROCESSING', 'COMPLETED'] }
    ];
    const planContracts = [
      { id: 'job-status', type: 'ENUM_SET', values: ['COMPLETED', 'QUEUED', 'PROCESSING'] }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 0);
  });

  test('TEST-CONSISTENCY-B03: IDENTITY_TUPLE missing dimension is BLOCKED (FROZEN_CONTRACT_VIOLATION)', () => {
    const specContracts = [
      { id: 'pub-id', type: 'IDENTITY_TUPLE', values: ['workspaceId', 'recordingId', 'languageTag', 'kind'] }
    ];
    const planContracts = [
      { id: 'pub-id', type: 'IDENTITY_TUPLE', values: ['workspaceId', 'recordingId', 'languageTag'] }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 1);
    assert.equal(violations[0].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations[0].contractId, 'pub-id');
    assert.deepEqual(violations[0].delta.missing, ['kind']);
  });

  test('TEST-CONSISTENCY-B04: IDENTITY_TUPLE permutation of identical dimensions passes', () => {
    const specContracts = [
      { id: 'pub-id', type: 'IDENTITY_TUPLE', values: ['workspaceId', 'recordingId', 'languageTag', 'kind'] }
    ];
    const planContracts = [
      { id: 'pub-id', type: 'IDENTITY_TUPLE', values: ['kind', 'languageTag', 'recordingId', 'workspaceId'] }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 0);
  });

  test('TEST-CONSISTENCY-B05: PROVENANCE_RULE field omission or entity change is BLOCKED', () => {
    const specContracts = [
      {
        id: 'caption-prov',
        type: 'PROVENANCE_RULE',
        entity: 'CaptionAsset',
        values: ['parentRecordingAssetId', 'sourceMediaAssetType', 'sourceRecordingExportAssetId']
      }
    ];
    // Plan drops sourceRecordingExportAssetId
    const planContracts = [
      {
        id: 'caption-prov',
        type: 'PROVENANCE_RULE',
        entity: 'CaptionAsset',
        values: ['parentRecordingAssetId', 'sourceMediaAssetType']
      }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 1);
    assert.equal(violations[0].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations[0].contractId, 'caption-prov');
    assert.deepEqual(violations[0].delta.missing, ['sourceRecordingExportAssetId']);
  });

  test('TEST-CONSISTENCY-B06: BOOLEAN_INVARIANT and ROADMAP_LIMIT contradictions are BLOCKED', () => {
    const specContracts = [
      { id: 'zero-dep', type: 'BOOLEAN_INVARIANT', value: true },
      { id: 'max-mvp', type: 'ROADMAP_LIMIT', value: 18 }
    ];
    const planContracts = [
      { id: 'zero-dep', type: 'BOOLEAN_INVARIANT', value: false },
      { id: 'max-mvp', type: 'ROADMAP_LIMIT', value: 20 }
    ];

    const violations = comparePhaseContracts(specContracts, planContracts, 'plan');
    assert.equal(violations.length, 2);
    assert.equal(violations[0].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations[0].contractId, 'zero-dep');
    assert.equal(violations[1].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations[1].contractId, 'max-mvp');
  });

  test('TEST-CONSISTENCY-B07: BOUNDARY FORBIDDEN / REQUIRED contradiction is BLOCKED; equivalent passes', () => {
    const specContracts = [
      { id: 'sync-dep', type: 'BOUNDARY', value: 'FORBIDDEN' }
    ];
    // Contradiction
    const planContradiction = [
      { id: 'sync-dep', type: 'BOUNDARY', value: 'REQUIRED' }
    ];
    const violations1 = comparePhaseContracts(specContracts, planContradiction, 'plan');
    assert.equal(violations1.length, 1);
    assert.equal(violations1[0].code, 'FROZEN_CONTRACT_VIOLATION');
    assert.equal(violations1[0].contractId, 'sync-dep');

    // Equivalent passes
    const planEquivalent = [
      { id: 'sync-dep', type: 'BOUNDARY', value: 'FORBIDDEN' }
    ];
    const violations2 = comparePhaseContracts(specContracts, planEquivalent, 'plan');
    assert.equal(violations2.length, 0);
  });

  test('TEST-CONSISTENCY-B08: SPEC -> PLAN -> TASKS inheritance and additive extensions pass', () => {
    const specContracts = [
      { id: 'c1', type: 'BOOLEAN_INVARIANT', value: true }
    ];
    // PLAN inherits c1 implicitly and adds compatible c2
    const planContracts = [
      { id: 'c2', type: 'ENUM_SET', values: ['A', 'B'] }
    ];
    const planResolved = resolvePhaseInheritance(specContracts, planContracts);
    assert.equal(planResolved.length, 2);
    assert.ok(planResolved.some(c => c.id === 'c1'));
    assert.ok(planResolved.some(c => c.id === 'c2'));

    // TASKS does not redeclare c1 or c2 (empty declarations) -> inherits all cleanly
    const tasksContracts = [];
    const tasksResolved = resolvePhaseInheritance(planResolved, tasksContracts);
    assert.equal(tasksResolved.length, 2);

    const violations = comparePhaseContracts(planResolved, tasksContracts, 'tasks');
    assert.equal(violations.length, 0);
  });

});
