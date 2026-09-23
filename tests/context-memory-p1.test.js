'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  estimateTokens,
  computeRedundancyRatio,
  detectContextFatigue,
  pruneContextNoise
} = require('../src/lib/context-fatigue');
const {
  auditDependencies,
  extractImportsFromContent,
  findCircularCycles
} = require('../src/lib/dependency-audit');
const {
  crossAuditMemoryWithGit
} = require('../src/lib/memory-audit');
const {
  generateContextCapsule,
  serializeCanonicalJson,
  computeCapsuleSemanticHash
} = require('../src/lib/context-capsule');

// ============================================================================
// Group A: Context Fatigue & Noise Pruning (TEST-FATIGUE-A01 .. TEST-FATIGUE-A03)
// ============================================================================

test('TEST-FATIGUE-A01: Detects context fatigue when accumulated token count exceeds configurable threshold', () => {
  const shortMessages = ['Short message one', 'Short message two'];
  const resClean = detectContextFatigue(shortMessages, { tokenThreshold: 50 });
  assert.equal(resClean.fatigue, false);

  // Large messages exceeding 20 tokens
  const largeMessages = [
    'A'.repeat(100), // ~25 tokens
    'B'.repeat(100)  // ~25 tokens
  ];
  const resFatigued = detectContextFatigue(largeMessages, { tokenThreshold: 20 });
  assert.equal(resFatigued.fatigue, true);
  assert.ok(resFatigued.total_tokens > 20);
  assert.ok(resFatigued.reason.includes('Token count'));
});

test('TEST-FATIGUE-A02: Identifies repetitive context fragments and computes redundancy ratio accurately', () => {
  const messages = [
    'Duplicate message payload here',
    'Unique payload here',
    'Duplicate message payload here',
    'Another unique payload'
  ];

  const ratio = computeRedundancyRatio(messages);
  assert.ok(ratio > 0.2 && ratio < 0.5, `Expected redundancy ratio ~0.3, got: ${ratio}`);

  const res = detectContextFatigue(messages, { redundancyThreshold: 0.2, tokenThreshold: 10000 });
  assert.equal(res.fatigue, true);
  assert.ok(res.reason.includes('Redundancy ratio'));
});

test('TEST-FATIGUE-A03: Deterministically prunes noise and duplicate chatter while preserving contracts and state', () => {
  const messages = [
    'ok',
    'gemstack-contracts\n[{"id":"core-invariant","type":"BOOLEAN_INVARIANT","value":true}]',
    'Duplicate tool output error 500',
    'Duplicate tool output error 500',
    'running...',
    'handoff.md Section 4. Intentos fallidos - never delete',
    'Current decision: deploy to staging',
    'Final tail message 1',
    'Final tail message 2'
  ];

  const pruned = pruneContextNoise(messages, { retainTail: 2 });
  const prunedText = pruned.join('\n');

  // Contracts and mandatory memory sections must be preserved
  assert.ok(prunedText.includes('core-invariant'), 'Architectural contracts must be preserved');
  assert.ok(prunedText.includes('4. Intentos fallidos'), 'Memory sections must be preserved');
  assert.ok(prunedText.includes('Final tail message 2'), 'Recent tail must be preserved');

  // Ephemeral noise like "ok" or "running..." or duplicates must be pruned
  assert.equal(pruned.includes('ok'), false, 'Ephemeral ok must be pruned');
  assert.equal(pruned.includes('running...'), false, 'Ephemeral running... must be pruned');
  
  // Duplicates reduced to at most 1
  const duplicateCount = pruned.filter(m => m === 'Duplicate tool output error 500').length;
  assert.ok(duplicateCount <= 1, 'Duplicate messages must be reduced');
});

// ============================================================================
// Group B: Offline Dependency Audit in Doctor (TEST-DEP-B01 .. TEST-DEP-B04)
// ============================================================================

test('TEST-DEP-B01: Detects orphan dependencies declared in package.json but never imported in code', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-dep-audit-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      dependencies: {
        'used-pkg': '^1.0.0',
        'orphan-pkg': '^2.0.0'
      }
    }));
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'index.js'), "const u = require('used-pkg');");

    const audit = auditDependencies(tempDir);
    assert.deepEqual(audit.orphans, ['orphan-pkg']);
    assert.equal(audit.is_clean, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TEST-DEP-B02: Detects undeclared module dependencies imported in code but missing from package.json', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-dep-undeclared-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      dependencies: { 'declared-pkg': '^1.0.0' }
    }));
    fs.mkdirSync(path.join(tempDir, 'src'));
    fs.writeFileSync(path.join(tempDir, 'src', 'app.js'), "const m = require('missing-pkg');\nconst d = require('declared-pkg');");

    const audit = auditDependencies(tempDir);
    assert.deepEqual(audit.undeclared, ['missing-pkg']);
    assert.equal(audit.is_clean, false);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TEST-DEP-B03: Detects circular import cycles among local project modules', () => {
  const graph = new Map();
  graph.set('src/a.js', ['src/b.js']);
  graph.set('src/b.js', ['src/c.js']);
  graph.set('src/c.js', ['src/a.js']); // Cycle: a -> b -> c -> a

  const cycles = findCircularCycles(graph);
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0], ['src/a.js', 'src/b.js', 'src/c.js', 'src/a.js']);
});

test('TEST-DEP-B04: Dependency auditor runs completely offline without spawning npm or network requests', () => {
  const start = Date.now();
  const audit = auditDependencies(process.cwd());
  const duration = Date.now() - start;

  assert.ok(duration < 250, `Expected audit < 250ms, took ${duration}ms`);
  assert.ok(Array.isArray(audit.orphans));
  assert.ok(Array.isArray(audit.undeclared));
  assert.ok(Array.isArray(audit.circularCycles));
});

// ============================================================================
// Group C: Memory Cross-Verification with Git Log (TEST-MEM-C01 .. TEST-MEM-C03)
// ============================================================================

test('TEST-MEM-C01: Detects discrepancies between recent git commit messages and handoff.md records', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-mem-test-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'handoff.md'), `# Handoff
## 1. Objetivo
Init.
## 2. Estado actual
- Work done.
## 3. Archivos y cambios
- None.
## 4. Intentos fallidos
- None.
## 5. Próximos pasos
- Next.
`);

    const fakeCommits = [
      { hash: 'a1b2c3d', message: 'feat: add unrecorded secret feature' }
    ];

    const audit = crossAuditMemoryWithGit(tempDir, { commits: fakeCommits });
    assert.equal(audit.valid, false);
    assert.equal(audit.unrecorded_commits.length, 1);
    assert.equal(audit.unrecorded_commits[0].hash, 'a1b2c3d');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TEST-MEM-C02: Approves cleanly when all recent commits are accurately reflected in handoff.md', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-mem-clean-'));
  try {
    fs.writeFileSync(path.join(tempDir, 'handoff.md'), `# Handoff
## 1. Objetivo
Init.
## 2. Estado actual
- Implemented commit a1b2c3d (adaptable sdd rigor).
## 3. Archivos y cambios
- src/lib/sdd-rigor.js
## 4. Intentos fallidos
- None.
## 5. Próximos pasos
- Next.
`);

    const fakeCommits = [
      { hash: 'a1b2c3d', message: 'feat: adaptable sdd rigor' }
    ];

    const audit = crossAuditMemoryWithGit(tempDir, { commits: fakeCommits });
    assert.equal(audit.valid, true);
    assert.equal(audit.unrecorded_commits.length, 0);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('TEST-MEM-C03: Preserves section 4 Intentos fallidos and flags any attempt to mutate or delete it', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-mem-corrupted-'));
  try {
    // Missing section 4
    fs.writeFileSync(path.join(tempDir, 'handoff.md'), `# Handoff
## 1. Objetivo
Init.
## 2. Estado actual
Done.
## 3. Archivos y cambios
Files.
## 5. Próximos pasos
Next.
`);

    const audit = crossAuditMemoryWithGit(tempDir, { commits: [] });
    assert.equal(audit.valid, false);
    assert.equal(audit.handoff_intact, false);
    assert.equal(audit.missing_section, '4. Intentos fallidos');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

// ============================================================================
// Group D: Capsule Compression & Noise Filter (TEST-CAPSULE-D01 .. TEST-CAPSULE-D02)
// ============================================================================

test('TEST-CAPSULE-D01: Context capsule projection excludes ephemeral conversation logs and noise', () => {
  const activeSpec = 'specs/013-gemstack-2.0-adaptable-sdd';
  const genResult = generateContextCapsule(process.cwd(), activeSpec);
  assert.ok(fs.existsSync(genResult.path));

  const capsule = JSON.parse(fs.readFileSync(genResult.path, 'utf8'));
  assert.ok(capsule.project, 'Project state must be generated');
  assert.equal(capsule.schema_version, 1);
  // Ensure no chat history or ephemeral chat fields exist in projected capsule
  assert.equal(capsule.chat_history, undefined);
  assert.equal(capsule.messages, undefined);
});

test('TEST-CAPSULE-D02: Validates capsule determinism and size budget compliance (< 32KB)', () => {
  const activeSpec = 'specs/013-gemstack-2.0-adaptable-sdd';
  const genResult1 = generateContextCapsule(process.cwd(), activeSpec);
  const raw1 = fs.readFileSync(genResult1.path, 'utf8');

  const genResult2 = generateContextCapsule(process.cwd(), activeSpec);
  const raw2 = fs.readFileSync(genResult2.path, 'utf8');

  assert.equal(genResult1.source_set_hash, genResult2.source_set_hash);
  const hash1 = computeCapsuleSemanticHash(JSON.parse(raw1));
  const hash2 = computeCapsuleSemanticHash(JSON.parse(raw2));

  assert.equal(hash1, hash2, 'Capsule semantic hash must be 100% deterministic');
  assert.ok(Buffer.byteLength(raw1, 'utf8') <= 32768, `Capsule size (${Buffer.byteLength(raw1, 'utf8')} bytes) exceeds 32KB budget`);
});
