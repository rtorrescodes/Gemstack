const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const initCommand = require('../src/commands/init');
const verifyCommand = require('../src/commands/verify');
const { generateContextCapsule } = require('../src/lib/context-capsule');
const { hashFile } = require('../src/lib/hasher');

function snapshotDirectoryHashes(dirPath) {
  const fileHashes = {};
  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(current, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile()) {
        fileHashes[full] = hashFile(full);
      }
    }
  }
  walk(dirPath);
  return fileHashes;
}

test('TEST-CONTEXT-F01: Proves gemstack verify evaluates context capsule in read-only mode with zero file mutations', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-purity-hash-'));
  await initCommand({ dryRun: false, yes: true, target: tmpDir });

  const featDir = path.join(tmpDir, 'specs', 'current');
  fs.mkdirSync(featDir, { recursive: true });

  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- System MUST remain pure.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  // Update state.json with active_spec
  const statePath = path.join(tmpDir, '.gemstack', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.active_spec = 'specs/current';
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  // Pre-initialize sidecar
  const sidecarPath = path.join(featDir, '.gemstack.json');
  fs.writeFileSync(sidecarPath, JSON.stringify({ historical_findings: [], accepted_exceptions: [] }, null, 2), 'utf8');

  // Generate context capsule
  generateContextCapsule(tmpDir, 'specs/current');

  // Snapshot all file hashes BEFORE verify
  const snapshotBefore = snapshotDirectoryHashes(tmpDir);

  // Execute gemstack verify
  await assert.doesNotReject(async () => {
    await verifyCommand({ target: tmpDir, runTests: false });
  });

  // Snapshot all file hashes AFTER verify
  const snapshotAfter = snapshotDirectoryHashes(tmpDir);

  // Assert that context-capsule.json and authoritative source files have 100% identical hashes
  const capsulePath = path.join(featDir, 'context-capsule.json');
  const specFilePath = path.join(featDir, 'spec.md');

  assert.equal(snapshotBefore[capsulePath], snapshotAfter[capsulePath], 'context-capsule.json must not be mutated during verify');
  assert.equal(snapshotBefore[specFilePath], snapshotAfter[specFilePath], 'spec.md must not be mutated during verify');
  assert.equal(fs.existsSync(capsulePath), true);

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('TEST-CONTEXT-F02: Proves context capsule verification executes completely offline with zero network requests', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-purity-net-'));
  await initCommand({ dryRun: false, yes: true, target: tmpDir });

  const featDir = path.join(tmpDir, 'specs', 'current');
  fs.mkdirSync(featDir, { recursive: true });
  fs.writeFileSync(path.join(featDir, 'spec.md'), '# Spec\n- Offline only.\n```gemstack-contracts\n[]\n```\n', 'utf8');

  const statePath = path.join(tmpDir, '.gemstack', 'state.json');
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  state.active_spec = 'specs/current';
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');

  generateContextCapsule(tmpDir, 'specs/current');

  // Intercept sockets and http/https requests to fail immediately on any network activity
  const origSocketConnect = net.Socket.prototype.connect;
  const origHttpRequest = http.request;
  const origHttpsRequest = https.request;

  net.Socket.prototype.connect = function () {
    throw new Error('NETWORK_VIOLATION: Socket connect called during offline verification');
  };
  http.request = function () {
    throw new Error('NETWORK_VIOLATION: HTTP request called during offline verification');
  };
  https.request = function () {
    throw new Error('NETWORK_VIOLATION: HTTPS request called during offline verification');
  };

  try {
    await assert.doesNotReject(async () => {
      await verifyCommand({ target: tmpDir, runTests: false });
    });
  } finally {
    net.Socket.prototype.connect = origSocketConnect;
    http.request = origHttpRequest;
    https.request = origHttpsRequest;
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
