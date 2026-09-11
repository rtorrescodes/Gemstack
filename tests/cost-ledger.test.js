const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  loadCostLedger,
  validateLedgerSchema,
  auditSecretsForbidden,
  checkStaleness,
  serializeCostLedger
} = require('../src/lib/cost-ledger');

function makeTempLedger(content) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ledger-test-'));
  const filePath = path.join(tmpDir, 'cost-ledger.json');
  fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
  return { tmpDir, filePath };
}

test('TEST-COST-E01: Validates syntax and schema structure of cost-ledger.json', () => {
  // 1. Malformed JSON syntax
  const badJson = makeTempLedger('{ malformed json');
  try {
    const res = loadCostLedger(badJson.filePath);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.ledger, null);
    assert.ok(res.findings.some(f => f.code === 'COST_LEDGER_INVALID'));
  } finally {
    fs.rmSync(badJson.tmpDir, { recursive: true, force: true });
  }

  // 2. Schema violation (missing providers, invalid version)
  const badSchema = makeTempLedger({ version: 2, currency: 'USD' });
  try {
    const res = loadCostLedger(badSchema.filePath);
    assert.strictEqual(res.valid, false);
    assert.ok(res.findings.some(f => f.code === 'COST_LEDGER_INVALID'));
  } finally {
    fs.rmSync(badSchema.tmpDir, { recursive: true, force: true });
  }

  // 3. Valid ledger
  const validLedgerData = {
    version: 1,
    currency: 'USD',
    providers: {
      'gemini-cloud': {
        type: 'COMMERCIAL',
        pricing_model: 'PER_1K_TOKENS',
        capabilities: {
          'inference.generate_text': {
            cost_state: 'BILLABLE',
            estimated_unit_cost: 0.0005,
            freshness_date: '2026-09-01'
          }
        }
      }
    }
  };
  const validLedger = makeTempLedger(validLedgerData);
  try {
    const res = loadCostLedger(validLedger.filePath, { referenceDate: new Date('2026-09-10T00:00:00Z') });
    assert.strictEqual(res.valid, true);
    assert.ok(res.ledger !== null);
    assert.strictEqual(res.findings.filter(f => f.is_blocking).length, 0);
  } finally {
    fs.rmSync(validLedger.tmpDir, { recursive: true, force: true });
  }
});

test('TEST-COST-E03: Enforces that cost ledger never contains credential secrets or authentication tokens', () => {
  // 1. Forbidden property name: apiKey
  const withSecretKey = {
    version: 1,
    currency: 'USD',
    providers: {
      'test-provider': {
        type: 'COMMERCIAL',
        pricing_model: 'PER_CALL',
        apiKey: 'fake-test-key',
        capabilities: {
          'test.cap': {
            cost_state: 'BILLABLE',
            estimated_unit_cost: 0.01
          }
        }
      }
    }
  };
  const keyFixture = makeTempLedger(withSecretKey);
  try {
    const res = loadCostLedger(keyFixture.filePath);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.ledger, null);
    const blocker = res.findings.find(f => f.code === 'COST_LEDGER_INVALID');
    assert.ok(blocker, 'Must emit COST_LEDGER_INVALID on forbidden apiKey property');
    assert.strictEqual(blocker.is_blocking, true);
  } finally {
    fs.rmSync(keyFixture.tmpDir, { recursive: true, force: true });
  }

  // 2. Forbidden secret value pattern: sk-pattern
  const withSecretPattern = {
    version: 1,
    currency: 'USD',
    providers: {
      'test-provider': {
        type: 'COMMERCIAL',
        pricing_model: 'PER_CALL',
        note: 'sk-abcdef1234567890abcdef1234',
        capabilities: {
          'test.cap': {
            cost_state: 'BILLABLE',
            estimated_unit_cost: 0.01
          }
        }
      }
    }
  };
  const patternFixture = makeTempLedger(withSecretPattern);
  try {
    const res = loadCostLedger(patternFixture.filePath);
    assert.strictEqual(res.valid, false);
    assert.ok(res.findings.some(f => f.code === 'COST_LEDGER_INVALID'));
  } finally {
    fs.rmSync(patternFixture.tmpDir, { recursive: true, force: true });
  }
});

test('TEST-COST-E02: Emits warning finding when pricing assumption freshness date exceeds threshold', () => {
  const staleData = {
    version: 1,
    currency: 'USD',
    providers: {
      'gemini-cloud': {
        type: 'COMMERCIAL',
        pricing_model: 'PER_1K_TOKENS',
        capabilities: {
          'inference.generate_text': {
            cost_state: 'BILLABLE',
            estimated_unit_cost: 0.0005,
            freshness_date: '2025-01-01'
          }
        }
      }
    }
  };

  const staleFixture = makeTempLedger(staleData);
  try {
    const res = loadCostLedger(staleFixture.filePath, {
      referenceDate: new Date('2026-09-11T00:00:00Z'),
      maxAgeDays: 90
    });

    // Warning does NOT block validity
    assert.strictEqual(res.valid, true);
    assert.ok(res.ledger !== null);

    const warning = res.findings.find(f => f.code === 'STALE_PROVIDER_COST_ASSUMPTION');
    assert.ok(warning, 'Must emit STALE_PROVIDER_COST_ASSUMPTION warning');
    assert.strictEqual(warning.is_blocking, false);
  } finally {
    fs.rmSync(staleFixture.tmpDir, { recursive: true, force: true });
  }
});
