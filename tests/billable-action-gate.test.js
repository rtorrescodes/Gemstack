const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateBillableAction, issueSpendingToken } = require('../src/lib/safety-gates');

const testBoundarySecret = 'gemstack-boundary-test-secret-32b!';

const testLedger = {
  version: 1,
  currency: 'USD',
  providers: {
    'gemini-cloud': {
      type: 'COMMERCIAL',
      capabilities: {
        'inference.generate_text': {
          cost_state: 'BILLABLE',
          estimated_unit_cost: 0.05
        },
        'inference.unknown_action': {
          cost_state: 'UNKNOWN',
          estimated_unit_cost: 0.0
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

test('TEST-COST-A01: Rejects execution when billable action is not declared in spec.md', () => {
  const req = {
    action_id: 'undeclared-custom-action',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development'
  };

  const decision = evaluateBillableAction(req, testLedger, {
    declaredActions: ['summarize-report', 'generate-code'], // 'undeclared-custom-action' is missing
    allowBillable: true
  });

  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'UNDECLARED_BILLABLE_ACTION');
});

test('TEST-COST-A02: Rejects billable action when explicit spending authorization is missing', () => {
  const req = {
    action_id: 'summarize-report',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    // Missing authorization_token
  };

  const decision = evaluateBillableAction(req, testLedger, {
    declaredActions: ['summarize-report'],
    allowBillable: true
  });

  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'BILLABLE_ACTION_UNAUTHORIZED');
});

test('TEST-COST-A03: Authorizes billable action when explicit valid spending token is supplied', () => {
  const token = issueSpendingToken({
    secret: testBoundarySecret,
    provider_id: 'gemini-cloud',
    action_id: 'summarize-report',
    max_budget_units: 5.00
  });

  const req = {
    action_id: 'summarize-report',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    requested_units: 10,
    authorization_token: token
  };

  const decision = evaluateBillableAction(req, testLedger, {
    declaredActions: ['summarize-report'],
    allowBillable: true,
    boundarySecret: testBoundarySecret
  });

  assert.strictEqual(decision.authorized, true);
  assert.strictEqual(decision.decision, 'ALLOW');
  assert.strictEqual(decision.reasonCode, 'ACTION_AUTHORIZED');
});

test('TEST-COST-A04: Rejects action when cost state is UNKNOWN without falling back to FREE', () => {
  const req = {
    action_id: 'summarize-report',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.unknown_action', // Configured as UNKNOWN in testLedger
    environment: 'development',
    authorization_token: { granted: true }
  };

  const decision = evaluateBillableAction(req, testLedger, {
    declaredActions: ['summarize-report'],
    allowBillable: true
  });

  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'UNKNOWN_COST_CLASSIFICATION');
});

test('TEST-COST-G01: Blocks action execution when estimated unit cost exceeds granted budget limit', () => {
  const token = issueSpendingToken({
    secret: testBoundarySecret,
    provider_id: 'gemini-cloud',
    action_id: 'summarize-report',
    max_budget_units: 2.00 // Budget limit 2.00 < estimated 5.00
  });

  const req = {
    action_id: 'summarize-report',
    provider_id: 'gemini-cloud',
    capability_id: 'inference.generate_text',
    environment: 'development',
    requested_units: 100, // 100 * 0.05 = 5.00
    authorization_token: token
  };

  const decision = evaluateBillableAction(req, testLedger, {
    declaredActions: ['summarize-report'],
    allowBillable: true,
    boundarySecret: testBoundarySecret
  });

  assert.strictEqual(decision.authorized, false);
  assert.strictEqual(decision.decision, 'DENY');
  assert.strictEqual(decision.reasonCode, 'BUDGET_THRESHOLD_EXCEEDED');
});
