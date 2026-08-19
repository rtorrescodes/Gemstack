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
    const safeTarget = path.resolve(process.cwd(), 'tmp', 'app');
    
    // Attempt to escape (using native path separator logic)
    assert.throws(() => fssafe.resolveSafe(safeTarget, '../malicious'), /Path Traversal blocked/);
    
    // Absolute paths pointing outside
    assert.throws(() => fssafe.resolveSafe(safeTarget, '/etc/passwd'), /Path Traversal blocked/);
    
    // Test Windows-specific paths only on Windows, else they are considered safe relative paths
    if (path.sep === '\\') {
        assert.throws(() => fssafe.resolveSafe(safeTarget, '..\\malicious'), /Path Traversal blocked/);
        assert.throws(() => fssafe.resolveSafe(safeTarget, 'D:\\malicious'), /Path Traversal blocked/);
    }
    
    // Sibling directory with similar prefix (e.g. app-evil)
    assert.throws(() => fssafe.resolveSafe(safeTarget, '../app-evil/file'), /Path Traversal blocked/);

    // Allowed paths
    assert.doesNotThrow(() => fssafe.resolveSafe(safeTarget, 'normal/file.txt'));
    assert.doesNotThrow(() => fssafe.resolveSafe(safeTarget, 'folder/with spaces/file.txt'));
    assert.doesNotThrow(() => fssafe.resolveSafe(safeTarget, '')); // The target itself
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
