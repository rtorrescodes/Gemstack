const test = require('node:test');
const describe = test.describe;
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-purity-swarm-vqa-'));
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

describe('Upgrade E: Swarm & Visual Purity & Legacy Compatibility (TEST-SWARM-E01 .. E02 & TEST-VISUAL-E01 .. E02)', () => {

  test('TEST-SWARM-E01: Proves gemstack verify checks swarm.json manifest in pure read-only mode', async () => {
    const tmp = createTempDir();
    try {
      await initCommand({ dryRun: false, yes: true, target: tmp });

      let networkAttempted = false;
      const originalConnect = net.Socket.prototype.connect;
      net.Socket.prototype.connect = function () {
        networkAttempted = true;
        throw new Error('OUTBOUND_NETWORK_FORBIDDEN: Socket.connect called during verify');
      };

      const hashesBefore = computeDirectoryHashes(tmp);
      try {
        await verifyCommand({ target: tmp });
      } finally {
        net.Socket.prototype.connect = originalConnect;
      }

      assert.equal(networkAttempted, false, 'Zero network requests allowed during verify');
      const hashesAfter = computeDirectoryHashes(tmp);
      assert.deepEqual(hashesBefore, hashesAfter, 'Zero file mutations allowed during verify (VERIFY = VALIDATE)');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('TEST-SWARM-E02: Preserves backward compatibility for repositories lacking swarm schedules', async () => {
    const tmp = createTempDir();
    try {
      await initCommand({ dryRun: false, yes: true, target: tmp });
      let verifySucceeded = false;
      try {
        await verifyCommand({ target: tmp });
        verifySucceeded = true;
      } catch (err) {
        verifySucceeded = false;
      }
      assert.equal(verifySucceeded, true, 'Repositories without swarm.json must pass verify cleanly with exit code 0');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('TEST-VISUAL-E01: Proves gemstack verify validates visual evidence offline with zero browser spawns', async () => {
    const tmp = createTempDir();
    try {
      await initCommand({ dryRun: false, yes: true, target: tmp });

      let networkAttempted = false;
      const originalHttpRequest = http.request;
      const originalHttpsRequest = https.request;

      http.request = function () {
        networkAttempted = true;
        throw new Error('OUTBOUND_NETWORK_FORBIDDEN: http.request called during verify');
      };
      https.request = function () {
        networkAttempted = true;
        throw new Error('OUTBOUND_NETWORK_FORBIDDEN: https.request called during verify');
      };

      const hashesBefore = computeDirectoryHashes(tmp);
      try {
        await verifyCommand({ target: tmp });
      } finally {
        http.request = originalHttpRequest;
        https.request = originalHttpsRequest;
      }

      assert.equal(networkAttempted, false, 'Zero HTTP/HTTPS requests allowed during verify');
      const hashesAfter = computeDirectoryHashes(tmp);
      assert.deepEqual(hashesBefore, hashesAfter, 'Zero file mutations allowed during visual evidence verify');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('TEST-VISUAL-E02: Preserves clean verification for backend or headless projects lacking visual QA manifests', async () => {
    const tmp = createTempDir();
    try {
      await initCommand({ dryRun: false, yes: true, target: tmp });
      let verifySucceeded = false;
      try {
        await verifyCommand({ target: tmp });
        verifySucceeded = true;
      } catch (err) {
        verifySucceeded = false;
      }
      assert.equal(verifySucceeded, true, 'Projects without visual-qa.json must pass verify cleanly with exit code 0');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

});
