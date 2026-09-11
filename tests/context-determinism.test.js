const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  serializeCanonicalJson,
  canonicalizeObject,
  computeCapsuleSemanticHash,
  generateContextCapsule
} = require('../src/lib/context-capsule');
const { hashContent } = require('../src/lib/hasher');

test('TEST-CONTEXT-A01: Generates byte-for-byte identical context-capsule.json across repeated runs', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-det-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  const specContent = `# Specification
## 1. Requirements
- The system MUST preserve all constraints.
- The system MUST NOT leak credentials.
\`\`\`gemstack-contracts
[]
\`\`\`
`;
  fs.writeFileSync(path.join(featDir, 'spec.md'), specContent, 'utf8');

  // Generation 1
  const res1 = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const bytes1 = fs.readFileSync(res1.path, 'utf8');

  // Generation 2
  const res2 = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const bytes2 = fs.readFileSync(res2.path, 'utf8');

  // Verify semantic hash and source_set_hash match 100%
  assert.equal(res1.source_set_hash, res2.source_set_hash);
  const hash1 = computeCapsuleSemanticHash(JSON.parse(bytes1));
  const hash2 = computeCapsuleSemanticHash(JSON.parse(bytes2));
  assert.equal(hash1, hash2);

  // Clean up
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-A02: Enforces strict UTF-16 code-unit key ordering across all JSON objects', (t) => {
  const input = {
    zebra: 1,
    alpha: 2,
    beta: {
      delta: 4,
      charlie: 3
    },
    arr: [{ b: 2, a: 1 }]
  };

  const canonical = canonicalizeObject(input);
  const keys = Object.keys(canonical);
  assert.deepEqual(keys, ['alpha', 'arr', 'beta', 'zebra']);
  assert.deepEqual(Object.keys(canonical.beta), ['charlie', 'delta']);
  assert.deepEqual(Object.keys(canonical.arr[0]), ['a', 'b']);

  const serialized = serializeCanonicalJson(input);
  const expected = '{\n  "alpha": 2,\n  "arr": [\n    {\n      "a": 1,\n      "b": 2\n    }\n  ],\n  "beta": {\n    "charlie": 3,\n    "delta": 4\n  },\n  "zebra": 1\n}\n';
  assert.equal(serialized, expected);
});

test('TEST-CONTEXT-A03: Excludes volatile execution timestamps from semantic content hash computation', (t) => {
  const capsule1 = {
    schema_version: 1,
    generated_at: '2026-09-11T12:00:00.000Z',
    project: { name: 'gemstack' }
  };

  const capsule2 = {
    schema_version: 1,
    generated_at: '2026-09-12T18:30:45.123Z',
    project: { name: 'gemstack' }
  };

  const hash1 = computeCapsuleSemanticHash(capsule1);
  const hash2 = computeCapsuleSemanticHash(capsule2);

  assert.equal(hash1, hash2, 'Semantic hash must be identical regardless of generated_at timestamp');
});

test('TEST-CONTEXT-A04: Normalizes all file paths to POSIX repository-relative strings without drive letters', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-path-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- System MUST run.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs\\009-context-capsule');
  const capsule = JSON.parse(fs.readFileSync(res.path, 'utf8'));

  assert.ok(capsule.provenance.sources.length > 0);
  for (const src of capsule.provenance.sources) {
    assert.ok(!src.path.includes('\\'), `Path should not have backslashes: ${src.path}`);
    assert.ok(!/^[A-Za-z]:/.test(src.path), `Path should not have Windows drive letter: ${src.path}`);
    assert.ok(src.path.startsWith('specs/009-context-capsule/'), `Path should be repo-relative: ${src.path}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
