const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  generateContextCapsule,
  validateContextCapsule
} = require('../src/lib/context-capsule');

test('TEST-CONTEXT-C01: Detects modification of spec.md and marks capsule STALE immediately', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-fresh-spec-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  const initialSpec = '# Initial Spec\n- System MUST be reliable.\n```gemstack-contracts\n[]\n```\n';
  fs.writeFileSync(path.join(featDir, 'spec.md'), initialSpec, 'utf8');

  // Generate valid capsule
  generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const validCheck = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(validCheck.valid, true);
  assert.equal(validCheck.state, 'VALID');

  // Mutate spec.md
  fs.writeFileSync(path.join(featDir, 'spec.md'), initialSpec + '\n- Added mutated requirement MUST fail freshness.\n', 'utf8');

  // Validate without regenerating
  const staleCheck = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(staleCheck.valid, false);
  assert.equal(staleCheck.state, 'STALE');
  assert.ok(staleCheck.findings.some(f => f.code === 'CONTEXT_CAPSULE_STALE'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-C02: Detects task status mutation in tasks.md and invalidates capsule freshness', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-fresh-tasks-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- System MUST run.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const initialTasks = `# Tasks
- [ ] **T001: First Task**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-001 -->
  <!-- gemstack:files=src/index.js -->
  <!-- gemstack:depends= -->
  *Objective*: Init
`;
  fs.writeFileSync(path.join(featDir, 'tasks.md'), initialTasks, 'utf8');

  // Generate valid capsule
  generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const validCheck = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(validCheck.valid, true);

  // Mutate tasks.md (check task box)
  const checkedTasks = initialTasks.replace('- [ ] **T001:', '- [x] **T001:');
  fs.writeFileSync(path.join(featDir, 'tasks.md'), checkedTasks, 'utf8');

  // Validate without regenerating
  const staleCheck = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(staleCheck.valid, false);
  assert.equal(staleCheck.state, 'STALE');
  assert.ok(staleCheck.findings.some(f => f.code === 'CONTEXT_CAPSULE_STALE'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-C03: Preserves VALID status when all authoritative sources match recorded source_set_hash', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-fresh-valid-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- The system MUST be deterministic.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  generateContextCapsule(tmpDir, 'specs/009-context-capsule');

  // Validate multiple times without touching sources
  for (let i = 0; i < 3; i++) {
    const check = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
    assert.equal(check.valid, true);
    assert.equal(check.state, 'VALID');
    assert.equal(check.findings.length, 0);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
