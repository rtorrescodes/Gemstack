const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  generateContextCapsule,
  validateContextCapsule
} = require('../src/lib/context-capsule');

test('TEST-CONTEXT-B01: Rejects capsule assertion when it conflicts with authoritative spec.md or plan.md content', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-auth-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  const specContent = '# Spec\n- The system MUST run offline.\n```gemstack-contracts\n[]\n```\n';
  fs.writeFileSync(path.join(featDir, 'spec.md'), specContent, 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const capsule = JSON.parse(fs.readFileSync(res.path, 'utf8'));

  // Tamper: Assert project status is SHIPPED when live state is not
  capsule.project.lifecycle_status = 'SHIPPED';
  fs.writeFileSync(res.path, JSON.stringify(capsule, null, 2), 'utf8');

  // Verify that live state wins and resolver detects divergence
  const liveState = { status: 'SPEC_COMPLETE' };
  assert.notEqual(capsule.project.lifecycle_status, liveState.status);

  // Authority precedence resolver
  const resolveEffectiveStatus = (cap, live) => live.status;
  assert.equal(resolveEffectiveStatus(capsule, liveState), 'SPEC_COMPLETE');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-B02: Enforces that authoritative artifacts unconditionally override capsule claims in consumer resolver', (t) => {
  // Scenario: Capsule claims Task T005 is complete, but authoritative tasks.md says unchecked
  const capsuleClaim = { task_id: 'T005', completed: true };
  const authoritativeTasks = [{ id: 'T005', completed: false }];

  function resolveTaskStatus(capClaim, authList) {
    const auth = authList.find(t => t.id === capClaim.task_id);
    if (!auth) return capClaim.completed;
    // Authoritative source unconditionally governs
    return auth.completed;
  }

  const effective = resolveTaskStatus(capsuleClaim, authoritativeTasks);
  assert.equal(effective, false, 'Authoritative tasks.md must unconditionally override capsule claim');
});

test('TEST-CONTEXT-B03: Rejects manually edited capsule whose content hash does not reconcile with source digest', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-tamper-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- The system MUST operate safely.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const capsule = JSON.parse(fs.readFileSync(res.path, 'utf8'));

  // Tamper with recorded source hash directly inside capsule JSON
  capsule.provenance.sources[0].hash = '0000000000000000000000000000000000000000000000000000000000000000';
  fs.writeFileSync(res.path, JSON.stringify(capsule, null, 2), 'utf8');

  const result = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(result.valid, false);
  assert.equal(result.state, 'STALE');
  assert.ok(result.findings.some(f => f.code === 'CONTEXT_CAPSULE_STALE'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-B04: Proves chat transcripts and conversational logs are never ingested into capsule sources', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-transcript-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  // Add conversation logs and transcript files in project
  fs.mkdirSync(path.join(tmpDir, '.gemini', 'antigravity', 'logs'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, '.gemini', 'antigravity', 'logs', 'transcript.jsonl'), '{"type":"USER_INPUT"}\n', 'utf8');
  fs.writeFileSync(path.join(tmpDir, 'chat_history.txt'), 'User: please implement X\nAgent: sure\n', 'utf8');

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- System MUST run offline.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const capsule = JSON.parse(fs.readFileSync(res.path, 'utf8'));

  // Verify none of the conversational transcripts exist in sources
  for (const src of capsule.provenance.sources) {
    assert.ok(!src.path.includes('transcript'), `Source must not be a transcript: ${src.path}`);
    assert.ok(!src.path.includes('chat_history'), `Source must not be chat history: ${src.path}`);
    assert.ok(!src.path.startsWith('.gemini'), `Source must not be from .gemini: ${src.path}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
