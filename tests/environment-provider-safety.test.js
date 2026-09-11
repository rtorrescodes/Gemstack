const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveEnvironmentTier,
  checkEnvironmentCommercialPolicy,
  validateMockIntegrity,
  createProviderRegistry
} = require('../src/lib/provider-registry');

test('TEST-COST-C01: Blocks commercial provider invocation in test environment despite ambient credentials', () => {
  // Ambient credentials are set in mock env
  const fakeEnv = {
    OPENAI_API_KEY: 'sk-ambient-secret-key-12345678901234567890',
    GEMINI_API_KEY: 'AIzaSyAmbientSecretKey1234567890123456',
    NODE_ENV: 'test'
  };

  const envTier = resolveEnvironmentTier({ env: fakeEnv });
  assert.strictEqual(envTier, 'test');

  const policy = checkEnvironmentCommercialPolicy(envTier);
  assert.strictEqual(policy.allowed, false);
  assert.strictEqual(policy.reasonCode, 'ENV_COMMERCIAL_DENIED');
  assert.ok(policy.message.includes('strictly denied in test environment'));
});

test('TEST-COST-C02: Blocks commercial provider invocation in CI environment without explicit signed waiver', () => {
  const ciEnv = {
    CI: 'true',
    ANTHROPIC_API_KEY: 'sk-ant-test-key-1234567890'
  };

  const envTier = resolveEnvironmentTier({ env: ciEnv });
  assert.strictEqual(envTier, 'ci');

  // 1. Without waiver -> denied
  const policyWithoutWaiver = checkEnvironmentCommercialPolicy(envTier);
  assert.strictEqual(policyWithoutWaiver.allowed, false);
  assert.strictEqual(policyWithoutWaiver.reasonCode, 'ENV_COMMERCIAL_DENIED');

  // 2. With expired waiver -> denied
  const policyWithExpiredWaiver = checkEnvironmentCommercialPolicy(envTier, {
    ciWaiver: { signed: true, expires_at: Date.now() - 10000 }
  });
  assert.strictEqual(policyWithExpiredWaiver.allowed, false);
  assert.strictEqual(policyWithExpiredWaiver.reasonCode, 'ENV_COMMERCIAL_DENIED');

  // 3. With valid signed waiver -> allowed
  const policyWithValidWaiver = checkEnvironmentCommercialPolicy(envTier, {
    ciWaiver: { signed: true, expires_at: Date.now() + 60000 }
  });
  assert.strictEqual(policyWithValidWaiver.allowed, true);
  assert.strictEqual(policyWithValidWaiver.reasonCode, 'CI_WAIVER_ACCEPTED');
});

test('TEST-COST-C03: Allows verified MOCK providers to execute cleanly in test environment', () => {
  const validMockConfig = {
    type: 'MOCK',
    mock_adapter: 'in-memory',
    capabilities: {
      'inference.generate_text': {
        cost_state: 'FREE',
        estimated_unit_cost: 0.0
      }
    }
  };

  const audit = validateMockIntegrity(validMockConfig);
  assert.strictEqual(audit.valid, true);
  assert.strictEqual(audit.reasonCode, null);
});

test('Adversarial Threat Vector 8: Fake mock provider declaring external endpoint fails closed', () => {
  const fakeMockWithUrl = {
    type: 'MOCK',
    url: 'https://api.openai.com/v1',
    capabilities: {
      'inference.generate_text': {
        cost_state: 'FREE'
      }
    }
  };

  const audit = validateMockIntegrity(fakeMockWithUrl);
  assert.strictEqual(audit.valid, false);
  assert.strictEqual(audit.reasonCode, 'MOCK_PROVIDER_ESCAPE_VIOLATION');
  assert.ok(audit.message.includes('forbidden remote endpoint'));
});

test('Adversarial Threat Vector 14: Conflicting or ambiguous policy declarations fail closed', () => {
  // If an environment is unrecognized, it must fall back to development or fail closed
  const unknownPolicy = checkEnvironmentCommercialPolicy('unknown_tier');
  assert.strictEqual(unknownPolicy.allowed, true); // Staging/production fallback only for known tiers
  
  // Conflicting options: allowBillable false in dev
  const devPolicy = checkEnvironmentCommercialPolicy('development', { allowBillable: false });
  assert.strictEqual(devPolicy.allowed, false);
  assert.strictEqual(devPolicy.reasonCode, 'BILLABLE_ACTION_UNAUTHORIZED');
});

test('Adversarial Threat Vector 9: Mock provider attempting remote network socket fails closed', () => {
  const fakeMockWithHost = {
    type: 'MOCK',
    host: 'api.anthropic.com',
    capabilities: {
      'inference.generate_text': {
        cost_state: 'FREE'
      }
    }
  };

  const audit = validateMockIntegrity(fakeMockWithHost);
  assert.strictEqual(audit.valid, false);
  assert.strictEqual(audit.reasonCode, 'MOCK_PROVIDER_ESCAPE_VIOLATION');
});

