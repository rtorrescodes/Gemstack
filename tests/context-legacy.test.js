const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const initCommand = require('../src/commands/init');
const verifyCommand = require('../src/commands/verify');

test('TEST-CONTEXT-H01: Preserves backward compatibility for legacy projects lacking context capsules', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-legacy-test-'));
  await initCommand({ dryRun: false, yes: true, target: tmpDir });

  // A freshly initialized project has no context-capsule.json; verify must exit code 0
  await assert.doesNotReject(async () => {
    await verifyCommand({ target: tmpDir, runTests: false });
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
