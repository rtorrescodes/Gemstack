const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const updateCommand = require('../src/commands/update');
const doctorCommand = require('../src/commands/doctor');
const manifestLib = require('../src/lib/manifest');
const { readState } = require('../src/lib/state');

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

describe('Gemstack v2.0.3 Direct Upgrade Safety Matrix (1.0.1, 1.0.2, 1.4.0, 2.0.2 -> 2.0.3)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-upgrade-matrix-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  function setupFixture(version, stateVersion) {
    const projDir = path.join(tempDir, `proj-${version}`);
    fs.mkdirSync(path.join(projDir, '.gemstack'), { recursive: true });
    fs.mkdirSync(path.join(projDir, '.gemstack', 'task-context'), { recursive: true });
    fs.mkdirSync(path.join(projDir, '.gemstack', 'modules'), { recursive: true });
    fs.mkdirSync(path.join(projDir, '.gemstack', 'metrics'), { recursive: true });
    fs.mkdirSync(path.join(projDir, 'specs', 'current'), { recursive: true });
    fs.mkdirSync(path.join(projDir, 'docs', 'qa'), { recursive: true });
    fs.mkdirSync(path.join(projDir, 'docs', 'reviews'), { recursive: true });
    fs.mkdirSync(path.join(projDir, 'docs', 'security'), { recursive: true });
    fs.mkdirSync(path.join(projDir, '.agents', 'rules'), { recursive: true });

    // Operational files
    fs.writeFileSync(path.join(projDir, 'handoff.md'), `# Operational Handoff\n- Milestone: MVP-38\n- Critical notes preserved\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'handoff_archive.md'), `# Handoff Archive\n- Old log 1\n- Old log 2\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, '.gemstack', 'learnings.md'), `# Learnings\n- Invariant 1\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'specs', 'current', 'spec.md'), `# Active Spec\nInvariants here\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'specs', 'current', 'plan.md'), `# Active Plan\nArchitecture plan\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'specs', 'current', 'tasks.md'), `# Active Tasks\n- [ ] TASK-1\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'docs', 'qa', 'latest-qa.md'), `# QA Report\nAll passed\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'docs', 'reviews', 'latest-review.md'), `# Review Report\nLGTM\n`, 'utf8');
    fs.writeFileSync(path.join(projDir, 'docs', 'security', 'latest-security-audit.md'), `# Security Audit\nClean\n`, 'utf8');

    // New v2.0.3 operational structures
    fs.writeFileSync(path.join(projDir, '.gemstack', 'modules', 'graphics.json'), '{"module":"graphics"}\n', 'utf8');
    fs.writeFileSync(path.join(projDir, '.gemstack', 'task-context', 'TASK-1.json'), '{"taskId":"TASK-1"}\n', 'utf8');
    fs.writeFileSync(path.join(projDir, '.gemstack', 'metrics', 'TASK-1.json'), '{"taskId":"TASK-1","duration":100}\n', 'utf8');

    // Framework file with user modification
    fs.writeFileSync(path.join(projDir, '.agents', 'rules', '01-gemstack-core.md'), `# Custom User Core Rule\nDo not overwrite me\n`, 'utf8');

    // State file
    const stateObj = {
      version: stateVersion,
      current_phase: 'implementation',
      status: 'in_progress',
      active_spec: 'specs/038-graphics-engine',
      blockers: ['BLOCKER-1'],
      custom_extension_data: { foo: 'bar' }
    };
    fs.writeFileSync(path.join(projDir, '.gemstack', 'state.json'), JSON.stringify(stateObj, null, 2), 'utf8');

    // Manifest file (older versions might have incorrectly tracked operational files)
    const manifestObj = {
      version,
      files: [
        { path: '.agents/rules/01-gemstack-core.md', checksum: 'old-sum' },
        { path: 'handoff.md', checksum: 'legacy-spurious-sum' },
        { path: 'specs/current/spec.md', checksum: 'legacy-spurious-sum' },
        { path: '.gemstack/modules/graphics.json', checksum: 'legacy-spurious-sum' }
      ]
    };
    fs.writeFileSync(path.join(projDir, '.gemstack', 'manifest.json'), JSON.stringify(manifestObj, null, 2), 'utf8');

    return projDir;
  }

  const versionsToTest = [
    { from: '1.0.1', stateVer: '0.1' },
    { from: '1.0.2', stateVer: '0.2.0' },
    { from: '1.4.0', stateVer: '0.2.0' },
    { from: '2.0.2', stateVer: '0.2.0' }
  ];

  for (const v of versionsToTest) {
    test(`Direct Upgrade: v${v.from} -> v2.0.3 preserves operational data and sanitizes manifest`, async () => {
      const projDir = setupFixture(v.from, v.stateVer);

      // Record hashes of all operational files before update
      const opFiles = [
        'handoff.md',
        'handoff_archive.md',
        '.gemstack/learnings.md',
        'specs/current/spec.md',
        'specs/current/plan.md',
        'specs/current/tasks.md',
        'docs/qa/latest-qa.md',
        'docs/reviews/latest-review.md',
        'docs/security/latest-security-audit.md',
        '.gemstack/modules/graphics.json',
        '.gemstack/task-context/TASK-1.json',
        '.gemstack/metrics/TASK-1.json',
        '.agents/rules/01-gemstack-core.md'
      ];
      const preHashes = {};
      for (const rel of opFiles) {
        preHashes[rel] = hashFile(path.join(projDir, rel));
      }

      // 1. Dry run
      await updateCommand({ target: projDir, dryRun: true });
      for (const rel of opFiles) {
        assert.strictEqual(hashFile(path.join(projDir, rel)), preHashes[rel], `Dry-run must not mutate ${rel}`);
      }

      // 2. Real update
      await updateCommand({ target: projDir, yes: true });

      // Verify all operational files preserved byte-for-byte
      for (const rel of opFiles) {
        const postHash = hashFile(path.join(projDir, rel));
        assert.strictEqual(postHash, preHashes[rel], `Operational file ${rel} must be preserved byte-for-byte`);
      }

      // Verify manifest sanitized and updated to 2.0.3
      const updatedManifest = JSON.parse(fs.readFileSync(path.join(projDir, '.gemstack', 'manifest.json'), 'utf8'));
      assert.strictEqual(updatedManifest.version, '2.0.3');
      for (const entry of updatedManifest.files) {
        assert.strictEqual(manifestLib.isOperationalFile(entry.path), false, `Manifest must not track operational file: ${entry.path}`);
      }

      // Verify state schema migrated non-destructively
      const state = readState(projDir);
      assert.strictEqual(state.schemaVersion, '0.3.0');
      assert.strictEqual(state.version, '0.3.0');
      assert.strictEqual(state.frameworkVersion, '2.0.3');
      assert.strictEqual(state.current_phase, 'implementation');
      assert.strictEqual(state.activeMilestone, 'MVP-38');
      assert.deepStrictEqual(state.blockers, ['BLOCKER-1']);
      assert.strictEqual(state.custom_extension_data.foo, 'bar');

      // 3. Second update is completely idempotent
      await updateCommand({ target: projDir, yes: true });
      for (const rel of opFiles) {
        assert.strictEqual(hashFile(path.join(projDir, rel)), preHashes[rel], `Second update must remain idempotent for ${rel}`);
      }
    });
  }

  test('Vektorcast Canary Scenario: Large history, dirty tree, schema 0.2.0, active MVP-38', async () => {
    const projDir = setupFixture('1.0.2', '0.2.0');

    // Simulate huge historical specs (MVP-01 through MVP-37)
    for (let i = 1; i <= 10; i++) {
      const histDir = path.join(projDir, 'specs', `00${i}-historical-milestone`);
      fs.mkdirSync(histDir, { recursive: true });
      fs.writeFileSync(path.join(histDir, 'spec.md'), `# Historical Spec ${i}\nLong prose...\n`, 'utf8');
      fs.writeFileSync(path.join(histDir, 'plan.md'), `# Historical Plan ${i}\nTechnical details...\n`, 'utf8');
    }

    const preHandoff = fs.readFileSync(path.join(projDir, 'handoff.md'), 'utf8');

    // Run update
    await updateCommand({ target: projDir, yes: true });

    // Ensure working tree and handoff intact
    const postHandoff = fs.readFileSync(path.join(projDir, 'handoff.md'), 'utf8');
    assert.strictEqual(postHandoff, preHandoff);

    // Verify state
    const state = readState(projDir);
    assert.strictEqual(state.activeMilestone, 'MVP-38');
    assert.strictEqual(state.schemaVersion, '0.3.0');
  });
});
