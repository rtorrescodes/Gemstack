const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createProviderRegistry } = require('../src/lib/provider-registry');
const { executeProviderAction, executeWithFallback, normalizeProviderId } = require('../src/lib/provider-boundary');

const testRegistry = createProviderRegistry({
  'gemini-cloud': {
    type: 'COMMERCIAL',
    capabilities: ['inference.generate_text']
  },
  'anthropic-cloud': {
    type: 'COMMERCIAL',
    capabilities: ['inference.generate_text']
  },
  'mock-local': {
    type: 'MOCK',
    capabilities: ['inference.generate_text']
  }
});

const testLedger = {
  version: 1,
  currency: 'USD',
  providers: {
    'gemini-cloud': {
      type: 'COMMERCIAL',
      capabilities: {
        'inference.generate_text': {
          cost_state: 'BILLABLE',
          estimated_unit_cost: 0.01
        }
      }
    },
    'anthropic-cloud': {
      type: 'COMMERCIAL',
      capabilities: {
        'inference.generate_text': {
          cost_state: 'BILLABLE',
          estimated_unit_cost: 0.02
        }
      }
    },
    'mock-local': {
      type: 'MOCK',
      capabilities: {
        'inference.generate_text': {
          cost_state: 'FREE',
          estimated_unit_cost: 0.0
        }
      }
    }
  }
};

const { issueSpendingToken } = require('../src/lib/safety-gates');

const testBoundarySecret = 'gemstack-boundary-test-secret-32b!';

test('Execution boundary passes only when both gates approve', () => {
  let executionCount = 0;
  const mockAdapter = {
    supportsCapability: () => true,
    execute: (req, ctx) => {
      executionCount++;
      assert.ok(ctx.boundToken, 'Must provide bound token');
      return { output: 'success' };
    }
  };

  const token = issueSpendingToken({
    secret: testBoundarySecret,
    provider_id: 'gemini-cloud',
    action_id: 'generate-summary',
    max_budget_units: 10
  });

  const req = {
    action_id: 'generate-summary',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    authorization_token: token
  };

  const result = executeProviderAction(req, mockAdapter, {
    registry: testRegistry,
    ledger: testLedger,
    allowBillable: true,
    boundarySecret: testBoundarySecret
  });

  assert.strictEqual(result.output, 'success');
  assert.strictEqual(executionCount, 1);
});

test('TEST-COST-D01: Fallback candidate triggers independent gate re-evaluation', () => {
  let primaryExecuted = false;
  let fallbackExecuted = false;

  const failingPrimaryAdapter = {
    supportsCapability: () => true,
    execute: () => {
      primaryExecuted = true;
      throw new Error('Primary provider temporary connection timeout');
    }
  };

  const workingFallbackAdapter = {
    supportsCapability: () => true,
    execute: () => {
      fallbackExecuted = true;
      return { output: 'fallback-success' };
    }
  };

  const primaryReq = {
    action_id: 'generate-summary',
    provider_id: 'mock-local',
    capability_id: 'inference.generate_text',
    environment: 'development'
  };

  const token = issueSpendingToken({
    secret: testBoundarySecret,
    provider_id: 'gemini-cloud',
    action_id: 'generate-summary',
    max_budget_units: 10
  });

  const fallbackReq = {
    action_id: 'generate-summary',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    authorization_token: token // Independent spending token for fallback
  };

  const res = executeWithFallback(
    { request: primaryReq, adapter: failingPrimaryAdapter },
    [{ request: fallbackReq, adapter: workingFallbackAdapter }],
    { registry: testRegistry, ledger: testLedger, allowBillable: true, boundarySecret: testBoundarySecret }
  );

  assert.strictEqual(primaryExecuted, true);
  assert.strictEqual(fallbackExecuted, true);
  assert.strictEqual(res.fallbackUsed, true);
  assert.strictEqual(res.result.output, 'fallback-success');
});

test('TEST-COST-D02: Blocks fallback when secondary provider does not satisfy cost authorization policy', () => {
  let fallbackExecuted = false;

  const failingPrimaryAdapter = {
    supportsCapability: () => true,
    execute: () => {
      throw new Error('Primary network failure');
    }
  };

  const secondaryAdapter = {
    supportsCapability: () => true,
    execute: () => {
      fallbackExecuted = true;
      return { output: 'should-not-run' };
    }
  };

  // Primary was FREE mock
  const primaryReq = {
    action_id: 'generate-summary',
    provider_id: 'mock-local',
    capability_id: 'inference.generate_text',
    environment: 'development'
  };

  // Secondary is commercial anthropic-cloud WITHOUT spending authorization
  const unauthorizedFallbackReq = {
    action_id: 'generate-summary',
    provider_id: 'anthropic-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development'
    // Missing authorization_token
  };

  assert.throws(() => {
    executeWithFallback(
      { request: primaryReq, adapter: failingPrimaryAdapter },
      [{ request: unauthorizedFallbackReq, adapter: secondaryAdapter }],
      { registry: testRegistry, ledger: testLedger, allowBillable: true }
    );
  }, (err) => {
    assert.strictEqual(err.reasonCode, 'PROVIDER_FALLBACK_UNAUTHORIZED');
    return true;
  });

  assert.strictEqual(fallbackExecuted, false, 'Unauthorized fallback must never execute');
});

test('Adversarial Threat Vector 6: Provider alias and path traversal bypass attempts fail closed', () => {
  assert.throws(() => {
    normalizeProviderId('mock/../gemini-cloud');
  }, /illegal path characters/);

  assert.throws(() => {
    normalizeProviderId('gemini cloud with spaces');
  }, /canonical slug format/);
});

test('Adversarial Threat Vector 10: Direct adapter invocation without boundary context throws on ungated call', () => {
  const protectedAdapter = {
    supportsCapability: () => true,
    execute: (req, ctx) => {
      if (!ctx || !ctx.boundToken) {
        throw new Error('DIRECT_ADAPTER_CALL_FORBIDDEN: Must execute through provider boundary');
      }
      return { output: 'protected' };
    }
  };

  // 1. Direct call without boundary context throws
  assert.throws(() => {
    protectedAdapter.execute({ action_id: 'test' }, null);
  }, /DIRECT_ADAPTER_CALL_FORBIDDEN/);

  // 2. Call via boundary passes
  const req = {
    action_id: 'generate-summary',
    provider_id: 'mock-local',
    capability_id: 'inference.generate_text',
    environment: 'development'
  };
  const res = executeProviderAction(req, protectedAdapter, {
    registry: testRegistry,
    ledger: testLedger,
    allowBillable: true
  });
  assert.strictEqual(res.output, 'protected');
});

