const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  extractNormativeConstraints,
  generateContextCapsule,
  validateContextCapsule
} = require('../src/lib/context-capsule');

test('TEST-CONTEXT-D01: Preserves 100% of MUST and MUST NOT normative constraints from spec.md in canonical_invariants', (t) => {
  const specContent = `# Specification
## 1. Problem Statement
This is a background paragraph explaining context.

## 2. Invariants
1. The engine MUST preserve all behavioral rules.
2. The verification MUST NOT regenerate the file.
3. The generator SHALL NOT leak environment keys.
4. Developers MUST NOT commit credentials.
5. All operations REQUIRED to be offline.
6. Real network calls are FORBIDDEN.
`;

  const invariants = extractNormativeConstraints(specContent);
  assert.equal(invariants.length, 6);

  assert.equal(invariants[0].normative, 'MUST');
  assert.ok(invariants[0].rule.includes('preserve all behavioral rules'));

  assert.equal(invariants[1].normative, 'MUST_NOT');
  assert.ok(invariants[1].rule.includes('regenerate the file'));

  assert.equal(invariants[2].normative, 'MUST_NOT');
  assert.ok(invariants[2].rule.includes('leak environment keys'));

  assert.equal(invariants[3].normative, 'MUST_NOT');
  assert.equal(invariants[4].normative, 'MUST');
  assert.equal(invariants[5].normative, 'MUST_NOT');
});

test('TEST-CONTEXT-D02: Preserves frozen contracts and closure acceptance IDs across context compression', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-contracts-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  const specContent = `# Spec
## Invariants
- The system MUST run deterministically.

\`\`\`gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Zero external dependencies."
  },
  {
    "id": "capsule-offline-deterministic",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Offline deterministic."
  }
]
\`\`\`

\`\`\`gemstack-test-matrix
[
  {
    "id": "TEST-CONTEXT-A01",
    "category": "DETERMINISM",
    "layer": "UNIT",
    "description": "Byte identity.",
    "pass_criteria": "Match 100%.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-B01",
    "category": "AUTHORITY",
    "layer": "UNIT",
    "description": "Authority conflict.",
    "pass_criteria": "Conflict detected.",
    "gate": "REQUIRED"
  }
]
\`\`\`
`;

  fs.writeFileSync(path.join(featDir, 'spec.md'), specContent, 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const capsule = JSON.parse(fs.readFileSync(res.path, 'utf8'));

  // Verify frozen contracts preserved (sorted alphabetically by id)
  assert.equal(capsule.frozen_contracts.length, 2);
  assert.equal(capsule.frozen_contracts[0].id, 'capsule-offline-deterministic');
  assert.equal(capsule.frozen_contracts[1].id, 'zero-dependency-core');

  // Verify acceptance matrix preserved
  assert.equal(capsule.acceptance_matrix.total_required, 2);
  assert.ok(capsule.acceptance_matrix.signature);
  assert.deepEqual(capsule.acceptance_matrix.canonical_ids, ['TEST-CONTEXT-A01', 'TEST-CONTEXT-B01']);

  // Adversarial check: delete an invariant from capsule JSON and validate
  capsule.canonical_invariants = [];
  fs.writeFileSync(res.path, JSON.stringify(capsule, null, 2), 'utf8');

  const tamperedValidation = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(tamperedValidation.valid, false);
  assert.ok(tamperedValidation.findings.some(f => f.code === 'CONTEXT_CAPSULE_INVARIANT_DROPPED'));

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
