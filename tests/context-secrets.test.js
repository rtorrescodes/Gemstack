const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  assertSecretsForbidden,
  generateContextCapsule,
  validateContextCapsule
} = require('../src/lib/context-capsule');

test('TEST-CONTEXT-E01: Rejects capsule generation if forbidden credential property is detected', (t) => {
  const forbiddenKeys = ['apiKey', 'api_key', 'token', 'accessToken', 'access_token', 'secret', 'clientSecret', 'password', 'credentials'];

  for (const key of forbiddenKeys) {
    const obj = { project: { name: 'gemstack' }, [key]: 'inert_value_123' };
    assert.throws(
      () => assertSecretsForbidden(obj),
      (err) => {
        assert.equal(err.code, 'CONTEXT_CAPSULE_SECRET_DETECTED');
        assert.ok(err.message.includes(key));
        return true;
      },
      `Should reject forbidden property: ${key}`
    );
  }
});

test('TEST-CONTEXT-E02: Rejects capsule containing API key value patterns (sk-..., ghp_..., Bearer tokens, private keys)', (t) => {
  const syntheticSecrets = [
    'AKIAIOSFODNN7EXAMPLE',
    'ghp_1234567890abcdefghijklmnopqrstuvwxyz',
    'sk-1234567890abcdefghijklmnopqrstuv',
    'AIzaSyD-1234567890abcdefghijklmnopqr',
    'Bearer abcdef123456.7890xyz',
    '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----'
  ];

  for (const secretVal of syntheticSecrets) {
    const obj = { nested: { notes: `Here is token: ${secretVal}` } };
    assert.throws(
      () => assertSecretsForbidden(obj),
      (err) => {
        assert.equal(err.code, 'CONTEXT_CAPSULE_SECRET_DETECTED');
        // Critical: error message must NEVER contain the secret value verbatim
        assert.ok(!err.message.includes(secretVal), 'Error must not leak secret value');
        return true;
      },
      `Should reject secret value pattern: ${secretVal}`
    );
  }
});

test('TEST-CONTEXT-E03: Proves local .env files and process environment secrets are excluded from capsule inputs', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-env-test-'));
  const featDir = path.join(tmpDir, 'specs', '009-context-capsule');
  fs.mkdirSync(featDir, { recursive: true });

  // Place a local .env file containing fake credentials
  fs.writeFileSync(path.join(tmpDir, '.env'), 'OPENAI_API_KEY=sk-dummy12345678901234567890\nAWS_KEY=AKIAIOSFODNN7EXAMPLE\n', 'utf8');
  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- System MUST run offline.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const res = generateContextCapsule(tmpDir, 'specs/009-context-capsule');
  const capsuleContent = fs.readFileSync(res.path, 'utf8');

  // Verify .env is completely absent from sources and content
  assert.ok(!capsuleContent.includes('.env'));
  assert.ok(!capsuleContent.includes('OPENAI_API_KEY'));
  assert.ok(!capsuleContent.includes('AKIAIOSFODNN7EXAMPLE'));

  const validation = validateContextCapsule(tmpDir, 'specs/009-context-capsule');
  assert.equal(validation.valid, true);
  assert.equal(validation.state, 'VALID');

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
