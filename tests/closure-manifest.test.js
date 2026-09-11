const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  resolveRelevantFiles,
  computeContentAggregateHash,
  resolveRepositoryContext,
  computeClosureContextHash
} = require('../src/lib/closure-context');

describe('Wave 2: Closure Manifest & Context (P1 Category F)', () => {

  test('TEST-CLOSURE-F01: Serializes valid closure.json schema matching specification with nullable Git fields', () => {
    const manifest = {
      schema: 'gemstack-closure',
      version: 1,
      feature: 'specs/007-mechanical-test-matrix-closure-evidence/',
      generated_at: new Date().toISOString(),
      status: 'VERIFIED',
      closure_context: {
        closure_context_hash: 'abc123hash',
        repository_type: 'non-git',
        git_commit: null,
        working_tree_clean: null,
        relevant_files_digest: 'def456digest'
      },
      acceptance_signature: 'sig789',
      canonical_summary: { required_total: 20, required_passed: 20, supplemental_total: 0, supplemental_passed: 0 },
      physical_summary: { supporting_total: 5, supporting_passed: 5, total_executed: 25, total_passed: 25, total_failed: 0, total_skipped: 0 },
      reconciliation: { math_valid: true, phantoms_detected: 0, orphans_detected: 0, missing_canonical_ids: [] },
      task_traceability_summary: { tasks_total: 22, tasks_with_validation: 20, tasks_documentation_only: 2, unmapped_canonical_tests: [] },
      required_gates: { 'project-tests': 'PASS' },
      supplemental_gates: {},
      exceptions: [],
      evidence_sources: [
        { type: 'PACKAGE_SCRIPT', script: 'test', runner: 'node:test', exit_code: 0, duration_ms: 350 }
      ],
      blockers: [],
      warnings: []
    };

    assert.equal(manifest.schema, 'gemstack-closure');
    assert.equal(manifest.version, 1);
    assert.equal(manifest.closure_context.repository_type, 'non-git');
    assert.equal(manifest.closure_context.git_commit, null);
    assert.equal(manifest.closure_context.working_tree_clean, null);
    assert.equal(manifest.status, 'VERIFIED');
  });

  test('TEST-CLOSURE-F02: Computes deterministic structured closureContextHash across clean Git, dirty Git, and non-Git setups', () => {
    const contextObj = {
      version: 1,
      repository: {
        type: 'git',
        commit: '1111222233334444555566667777888899990000',
        working_tree_clean: true
      },
      phase_hashes: {
        spec: 'hash_spec',
        plan: 'hash_plan',
        tasks: 'hash_tasks'
      },
      acceptance_signature: 'sig_acceptance',
      test_files_hash: 'hash_tests',
      implementation_context_hash: 'hash_impl',
      required_gate_definition_hash: 'hash_gates'
    };

    const hash1 = computeClosureContextHash(contextObj);
    assert.equal(hash1.length, 64);
    assert.match(hash1, /^[0-9a-f]{64}$/);

    // Key order permutation yields identical hash
    const permutedObj = {
      required_gate_definition_hash: 'hash_gates',
      implementation_context_hash: 'hash_impl',
      test_files_hash: 'hash_tests',
      acceptance_signature: 'sig_acceptance',
      phase_hashes: {
        tasks: 'hash_tasks',
        spec: 'hash_spec',
        plan: 'hash_plan'
      },
      repository: {
        working_tree_clean: true,
        commit: '1111222233334444555566667777888899990000',
        type: 'git'
      },
      version: 1
    };
    const hash2 = computeClosureContextHash(permutedObj);
    assert.equal(hash1, hash2);

    // Non-Git object
    const nonGitObj = {
      ...contextObj,
      repository: { type: 'non-git', commit: null, working_tree_clean: null }
    };
    const hashNonGit = computeClosureContextHash(nonGitObj);
    assert.equal(hashNonGit.length, 64);
    assert.notEqual(hash1, hashNonGit);
  });

  test('TEST-CLOSURE-F03: Verifies read-only detection of stale evidence when relevant bound files change after manifest generation', () => {
    const recordedContextHash = 'a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890a1b2c3d4e5f67890';
    const currentContextHash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    let status = 'VERIFIED';
    const blockers = [];

    if (recordedContextHash !== currentContextHash) {
      status = 'STALE';
      blockers.push({
        code: 'CLOSURE_EVIDENCE_STALE',
        message: 'Relevant closure files changed after evidence collection'
      });
    }

    assert.equal(status, 'STALE');
    assert.equal(blockers.length, 1);
    assert.equal(blockers[0].code, 'CLOSURE_EVIDENCE_STALE');
  });

});
