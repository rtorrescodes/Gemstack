const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProviderRegistry } = require('../src/lib/provider-registry');
const { evaluateProviderCapability } = require('../src/lib/safety-gates');

const testRegistry = createProviderRegistry({
  'gemini-cloud': {
    type: 'COMMERCIAL',
    capabilities: ['inference.generate_text', 'embeddings.create']
  },
  'mock-local': {
    type: 'MOCK',
    capabilities: ['inference.generate_text']
  }
});

test('TEST-COST-B03: Blocks execution when provider identity is unknown or unregistered', () => {
  const req = {
    provider_id: 'unknown-provider-xyz',
    capability_id: 'inference.generate_text',
    environment: 'development'
  };

  const decision = evaluateProviderCapability(req, testRegistry);
  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'UNKNOWN_PROVIDER_IDENTITY');
});

test('TEST-COST-B01: Blocks execution when capability is not declared in plan or provider registry', () => {
  const req = {
    provider_id: 'gemini-cloud',
    capability_id: 'storage.s3_upload', // Undeclared capability
    environment: 'development'
  };

  const decision = evaluateProviderCapability(req, testRegistry, { allowBillable: true });
  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'PROVIDER_CAPABILITY_UNDECLARED');
});

test('TEST-COST-B02: Blocks execution when adapter does not implement requested capability', () => {
  const dummyAdapter = {
    supportedCapabilities: ['inference.generate_text'] // Missing embeddings.create
  };

  const req = {
    provider_id: 'gemini-cloud',
    capability_id: 'embeddings.create',
    environment: 'development',
    adapter: dummyAdapter
  };

  const decision = evaluateProviderCapability(req, testRegistry, { allowBillable: true });
  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'PROVIDER_CAPABILITY_UNSUPPORTED');
});

test('TEST-COST-B04: Allows execution when provider and capability are declared and supported', () => {
  const validAdapter = {
    supportedCapabilities: ['inference.generate_text']
  };

  const req = {
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    adapter: validAdapter
  };

  const decision = evaluateProviderCapability(req, testRegistry, { allowBillable: true });
  assert.strictEqual(decision.authorized, true);
  assert.strictEqual(decision.decision, 'ALLOW');
  assert.strictEqual(decision.reasonCode, 'CAPABILITY_VERIFIED');
});
