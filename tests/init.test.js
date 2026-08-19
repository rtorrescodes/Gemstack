const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const initCommand = require('../src/commands/init');
const updateCommand = require('../src/commands/update');
const fssafe = require('../src/lib/filesystem-safe');

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-'));
}

test('Filesystem safe blocks traversal', (t) => {
    assert.throws(() => {
        // Need absolute paths for resolve to work correctly on Windows tests
        const safeTarget = path.resolve('C:\\safe\\target');
        fssafe.resolveSafe(safeTarget, '../malicious/path');
    }, /Path Traversal blocked/);
});

test('Init command copies scaffolding into empty directory', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });
    
    assert.ok(fs.existsSync(path.join(tmp, 'handoff.md')));
    assert.ok(fs.existsSync(path.join(tmp, '.gemstack/manifest.json')));
    assert.ok(fs.existsSync(path.join(tmp, '.agents/rules/01-gemstack-core.md')));
    
    const gi = fs.readFileSync(path.join(tmp, '.gitignore'), 'utf8');
    assert.ok(gi.includes('# Gemstack'));
});

test('Init respects existing handoff.md', async (t) => {
    const tmp = createTempDir();
    const handoffPath = path.join(tmp, 'handoff.md');
    fs.writeFileSync(handoffPath, 'Original Content');
    
    await initCommand({ dryRun: false, yes: true, target: tmp });
    
    const content = fs.readFileSync(handoffPath, 'utf8');
    assert.equal(content, 'Original Content');
});

test('Init dry-run does not write files', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: true, yes: true, target: tmp });
    assert.equal(fs.existsSync(path.join(tmp, '.gemstack')), false);
});

test('Update creates backup when force overwriting', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });
    
    const skillPath = path.join(tmp, '.agents/rules/01-gemstack-core.md');
    fs.writeFileSync(skillPath, 'Modified content');
    
    await updateCommand({ dryRun: false, yes: true, force: true, target: tmp });
    
    const backupsDir = path.join(tmp, '.gemstack/backups');
    const backupFolders = fs.readdirSync(backupsDir);
    assert.ok(backupFolders.length > 0);
    
    const manifestPath = path.join(backupsDir, backupFolders[0], 'manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    const backupManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.ok(backupManifest.some(m => m.original.includes('01-gemstack-core.md')));
});
