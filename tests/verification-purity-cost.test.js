const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');

const initCommand = require('../src/commands/init');
const verifyCommand = require('../src/commands/verify');

function createTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-purity-test-'));
}

function computeDirectoryHashes(dirPath) {
  const hashes = {};
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile()) {
        const content = fs.readFileSync(full);
        const rel = path.relative(dirPath, full).replace(/\\/g, '/');
        hashes[rel] = crypto.createHash('sha256').update(content).digest('hex');
      }
    }
  }
  walk(dirPath);
  return hashes;
}

test('TEST-COST-F01: Proves gemstack verify executes zero outbound network or provider requests', async () => {
  const tmp = createTempDir();
  try {
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Add a valid cost ledger to the initialized project
    const ledgerContent = JSON.stringify({
      version: 1,
      currency: 'USD',
      providers: {
        'mock-local': {
          type: 'MOCK',
          pricing_model: 'NONE',
          capabilities: {
            'inference.generate_text': {
              cost_state: 'FREE',
              estimated_unit_cost: 0.0,
              freshness_date: '2026-09-11'
            }
          }
        }
      }
    }, null, 2);
    fs.writeFileSync(path.join(tmp, 'cost-ledger.json'), ledgerContent, 'utf8');

    // Monkeypatch network primitives to throw if invoked
    let networkAttempted = false;
    const originalConnect = net.Socket.prototype.connect;
    const originalHttpRequest = http.request;
    const originalHttpsRequest = https.request;

    net.Socket.prototype.connect = function () {
      networkAttempted = true;
      throw new Error('OUTBOUND_NETWORK_FORBIDDEN: Socket.connect called during verify');
    };
    http.request = function () {
      networkAttempted = true;
      throw new Error('OUTBOUND_NETWORK_FORBIDDEN: http.request called during verify');
    };
    https.request = function () {
      networkAttempted = true;
      throw new Error('OUTBOUND_NETWORK_FORBIDDEN: https.request called during verify');
    };

    try {
      await verifyCommand({ target: tmp, runTests: false });
      assert.strictEqual(networkAttempted, false, 'Verify must not attempt network connections');
    } finally {
      // Restore network primitives
      net.Socket.prototype.connect = originalConnect;
      http.request = originalHttpRequest;
      https.request = originalHttpsRequest;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('TEST-COST-F02: Proves gemstack verify does not mutate cost ledger or state files on disk', async () => {
  const tmp = createTempDir();
  try {
    await initCommand({ dryRun: false, yes: true, target: tmp });

    const ledgerPath = path.join(tmp, 'cost-ledger.json');
    const ledgerContent = JSON.stringify({
      version: 1,
      currency: 'USD',
      providers: {
        'mock-local': {
          type: 'MOCK',
          pricing_model: 'NONE',
          capabilities: {
            'inference.generate_text': {
              cost_state: 'FREE',
              estimated_unit_cost: 0.0,
              freshness_date: '2026-09-11'
            }
          }
        }
      }
    }, null, 2);
    fs.writeFileSync(ledgerPath, ledgerContent, 'utf8');

    // Snapshot before
    const beforeHashes = computeDirectoryHashes(tmp);

    // Execute verify
    await verifyCommand({ target: tmp, runTests: false });

    // Snapshot after
    const afterHashes = computeDirectoryHashes(tmp);

    // Verify 100% hash match across all files
    assert.deepStrictEqual(beforeHashes, afterHashes, 'Verification must be 100% read-only with zero file mutations');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('TEST-COST-H01: Preserves backward compatibility for provider-free projects in legacy mode', async () => {
  const tmp = createTempDir();
  try {
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Fresh project has no cost-ledger.json
    assert.strictEqual(fs.existsSync(path.join(tmp, 'cost-ledger.json')), false);

    // Verification must pass with exit code 0 and no unhandled rejections
    await assert.doesNotReject(async () => {
      await verifyCommand({ target: tmp, runTests: false });
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
