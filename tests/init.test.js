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

test('Update preserves operational files byte-for-byte and prunes them from manifest', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Set custom/historical operational files
    const customHandoff = '# Handoff\n\n## 1. Objetivo\nHistorical goal\n\n## 2. Estado actual\nIn progress\n\n## 3. Archivos y cambios\nNone\n\n## 4. Intentos fallidos\nNone\n\n## 5. Próximos pasos\nDeploy\n';
    const customState = JSON.stringify({ version: '2.0.0', initialized: true, active_spec: 'specs/current', current_phase: 'tasks' }, null, 2);
    const customSpec = '# Custom Feature Spec\n\n## Goal\nProduction Ready\n';
    const customPlan = '# Custom Feature Plan\n\nStep 1: Test\n';
    const customTasks = '# Tasks\n\n- [ ] Task 1\n';
    const customLearnings = '# Learnings\n\nCrucial historical learning.\n';
    const customQA = '# QA\n\nVerified\n';
    const customReview = '# Review\n\nApproved\n';
    const customSecurity = '# Security Audit\n\nClean\n';

    fs.writeFileSync(path.join(tmp, 'handoff.md'), customHandoff);
    fs.writeFileSync(path.join(tmp, '.gemstack/state.json'), customState);
    fs.writeFileSync(path.join(tmp, 'specs/current/spec.md'), customSpec);
    fs.writeFileSync(path.join(tmp, 'specs/current/plan.md'), customPlan);
    fs.writeFileSync(path.join(tmp, 'specs/current/tasks.md'), customTasks);
    fs.writeFileSync(path.join(tmp, '.gemstack/learnings.md'), customLearnings);
    fs.writeFileSync(path.join(tmp, 'docs/qa/latest-qa.md'), customQA);
    fs.writeFileSync(path.join(tmp, 'docs/reviews/latest-review.md'), customReview);
    fs.writeFileSync(path.join(tmp, 'docs/security/latest-security-audit.md'), customSecurity);

    // Simulate a legacy manifest with old version and containing operational entries
    const manifestPath = path.join(tmp, '.gemstack/manifest.json');
    const legacyManifest = {
        version: '1.0.2',
        files: [
            { path: 'handoff.md', checksum: 'old-fake-checksum' },
            { path: '.gemstack/state.json', checksum: 'old-fake-checksum' },
            { path: 'specs/current/spec.md', checksum: 'old-fake-checksum' },
            { path: '.agents/rules/01-gemstack-core.md', checksum: 'outdated-hash' }
        ]
    };
    fs.writeFileSync(manifestPath, JSON.stringify(legacyManifest, null, 2));

    // Also simulate an outdated framework file whose checksum in manifest matches disk
    const frameworkFile = path.join(tmp, '.agents/rules/01-gemstack-core.md');
    fs.writeFileSync(frameworkFile, 'Outdated framework content');
    legacyManifest.files.find(f => f.path === '.agents/rules/01-gemstack-core.md').checksum = require('../src/lib/manifest').getChecksum('Outdated framework content');
    fs.writeFileSync(manifestPath, JSON.stringify(legacyManifest, null, 2));

    // 1. Dry run test: must NOT list operational files in toUpdate
    await updateCommand({ dryRun: true, target: tmp });

    // 2. Real update with --yes
    await updateCommand({ dryRun: false, yes: true, target: tmp });

    // Verify byte-for-byte preservation
    assert.equal(fs.readFileSync(path.join(tmp, 'handoff.md'), 'utf8'), customHandoff);
    assert.equal(fs.readFileSync(path.join(tmp, '.gemstack/state.json'), 'utf8'), customState);
    assert.equal(fs.readFileSync(path.join(tmp, 'specs/current/spec.md'), 'utf8'), customSpec);
    assert.equal(fs.readFileSync(path.join(tmp, 'specs/current/plan.md'), 'utf8'), customPlan);
    assert.equal(fs.readFileSync(path.join(tmp, 'specs/current/tasks.md'), 'utf8'), customTasks);
    assert.equal(fs.readFileSync(path.join(tmp, '.gemstack/learnings.md'), 'utf8'), customLearnings);
    assert.equal(fs.readFileSync(path.join(tmp, 'docs/qa/latest-qa.md'), 'utf8'), customQA);
    assert.equal(fs.readFileSync(path.join(tmp, 'docs/reviews/latest-review.md'), 'utf8'), customReview);
    assert.equal(fs.readFileSync(path.join(tmp, 'docs/security/latest-security-audit.md'), 'utf8'), customSecurity);

    // Verify manifest was migrated
    const updatedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(updatedManifest.version, '2.0.2');
    assert.equal(updatedManifest.files.some(f => f.path === 'handoff.md'), false);
    assert.equal(updatedManifest.files.some(f => f.path === '.gemstack/state.json'), false);
    assert.equal(updatedManifest.files.some(f => f.path.startsWith('specs/current/')), false);

    // Verify framework file WAS updated
    const templateContent = fs.readFileSync(path.resolve(__dirname, '../template/.agents/rules/01-gemstack-core.md'), 'utf8');
    assert.equal(fs.readFileSync(frameworkFile, 'utf8'), templateContent);

    // 3. Second run must be completely idempotent
    await updateCommand({ dryRun: false, yes: true, target: tmp });
    assert.equal(fs.readFileSync(path.join(tmp, 'handoff.md'), 'utf8'), customHandoff);
    assert.equal(fs.readFileSync(path.join(tmp, '.gemstack/state.json'), 'utf8'), customState);
});

test('Update preserves user-customized framework files without --force', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    const frameworkFile = path.join(tmp, '.agents/rules/01-gemstack-core.md');
    fs.writeFileSync(frameworkFile, 'Custom user rule in framework file');

    // Run update without --force: should NOT overwrite
    await updateCommand({ dryRun: false, yes: true, force: false, target: tmp });
    assert.equal(fs.readFileSync(frameworkFile, 'utf8'), 'Custom user rule in framework file');

    // Run update with --force: should overwrite and create backup
    await updateCommand({ dryRun: false, yes: true, force: true, target: tmp });
    const templateContent = fs.readFileSync(path.resolve(__dirname, '../template/.agents/rules/01-gemstack-core.md'), 'utf8');
    assert.equal(fs.readFileSync(frameworkFile, 'utf8'), templateContent);
});

test('Update failure mid-process preserves existing backups for recovery', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    const frameworkFile = path.join(tmp, '.agents/rules/01-gemstack-core.md');
    fs.writeFileSync(frameworkFile, 'Original framework file version 1');

    // Make an update that triggers backup, but simulate failure right after copying by mocking or making destination read-only/throwing
    const realCopyFileSync = fs.copyFileSync;
    let backupCreated = false;
    try {
        fs.copyFileSync = (src, dest) => {
            // If copying into backup folder, let it succeed
            if (dest.includes('.gemstack') && dest.includes('backups')) {
                realCopyFileSync(src, dest);
                return;
            }
            // If writing updated file to target project directory, verify backup was already created and simulate failure
            if (dest.includes('01-gemstack-core.md')) {
                const backupsDir = path.join(tmp, '.gemstack/backups');
                if (fs.existsSync(backupsDir)) {
                    const folders = fs.readdirSync(backupsDir);
                    if (folders.length > 0) {
                        const backupFile = path.join(backupsDir, folders[0], '.agents/rules/01-gemstack-core.md');
                        if (fs.existsSync(backupFile)) {
                            backupCreated = true;
                        }
                    }
                }
                throw new Error('SIMULATED_DISK_WRITE_FAILURE_MID_UPDATE');
            }
            realCopyFileSync(src, dest);
        };

        await assert.rejects(
            async () => {
                await updateCommand({ dryRun: false, yes: true, force: true, target: tmp });
            },
            /SIMULATED_DISK_WRITE_FAILURE_MID_UPDATE/
        );

        assert.equal(backupCreated, true);
    } finally {
        fs.copyFileSync = realCopyFileSync;
    }
});
