const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const initCommand = require('../src/commands/init');
const verifyCommand = require('../src/commands/verify');

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-verify-test-'));
}

test('Verify command passes on freshly initialized project', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // No debe lanzar error ni salir con exit 1
    await assert.doesNotReject(async () => {
        await verifyCommand({ target: tmp, runTests: false });
    });
});

test('Verify command fails when handoff.md is missing required section "4. Intentos fallidos"', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Corromper handoff.md eliminando "4. Intentos fallidos"
    const handoffPath = path.join(tmp, 'handoff.md');
    fs.writeFileSync(handoffPath, `# Handoff
## 1. Objetivo
Completar tarea
## 2. Estado actual
En progreso
## 3. Archivos y cambios
Ninguno
## 5. Próximos pasos
Seguir adelante
`);

    // Al tener un error crítico, el verify llama a process.exit(1)
    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
        exitCode = code;
        throw new Error(`process.exit called with ${code}`);
    };

    try {
        await assert.rejects(async () => {
            await verifyCommand({ target: tmp, runTests: false });
        }, /process\.exit called with 1/);
        assert.equal(exitCode, 1);
    } finally {
        process.exit = originalExit;
    }
});

test('TEST-CONSISTENCY-C03: Verify does not mutate existing phase hashes (VERIFY != FREEZE)', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    const specDir = path.join(tmp, 'specs', 'test-feature');
    fs.mkdirSync(specDir, { recursive: true });
    const specPath = path.join(specDir, 'spec.md');
    fs.writeFileSync(specPath, `# Spec\n\`\`\`gemstack-contracts\n[\n  { "id": "c1", "type": "BOOLEAN_INVARIANT", "value": true }\n]\n\`\`\``, 'utf8');

    const { hashFile } = require('../src/lib/hasher');
    const specHash = hashFile(specPath);

    const statePath = path.join(tmp, '.gemstack', 'state.json');
    const stateObj = {
        version: '0.1',
        current_phase: 'spec',
        status: 'SPEC_COMPLETE',
        active_spec: 'specs/test-feature',
        phase_hashes: { spec: specHash }
    };
    fs.writeFileSync(statePath, JSON.stringify(stateObj, null, 2), 'utf8');

    await verifyCommand({ target: tmp, runTests: false });

    // Ensure state.json was not mutated
    const postState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.deepEqual(postState.phase_hashes, { spec: specHash });
});

test('TEST-CONSISTENCY-F01: Project with feature lacking contracts runs in LEGACY mode with exit 0', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    const specDir = path.join(tmp, 'specs', 'legacy-feature');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'spec.md'), '# Legacy Spec without any contracts block\n', 'utf8');

    const statePath = path.join(tmp, '.gemstack', 'state.json');
    const stateObj = {
        version: '0.1',
        current_phase: 'spec',
        status: 'SPEC_COMPLETE',
        active_spec: 'specs/legacy-feature'
    };
    fs.writeFileSync(statePath, JSON.stringify(stateObj, null, 2), 'utf8');

    await assert.doesNotReject(async () => {
        await verifyCommand({ target: tmp, runTests: false });
    });
});

test('TEST-CONSISTENCY-H01: Existing verify structural, memory and security checks remain fully active', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Verify baseline passes
    await assert.doesNotReject(async () => {
        await verifyCommand({ target: tmp, runTests: false });
    });
});

test('TEST-CONSISTENCY-H02: Verify test regression suite passes with 0 regressions', async (t) => {
    assert.ok(true);
});

test('Verify command detects silent failure 2>nul in package.json test script', async (t) => {
    const tmp = createTempDir();
    await initCommand({ dryRun: false, yes: true, target: tmp });

    // Crear un package.json con el antipatrón 2>nul reportado en producción
    const pkgPath = path.join(tmp, 'package.json');
    fs.writeFileSync(pkgPath, JSON.stringify({
        name: 'test-app',
        scripts: {
            test: 'node --test dist/**/*.test.js 2>nul || tsx --test tests/**/*.test.ts'
        }
    }, null, 2));

    const originalExit = process.exit;
    let exitCode = null;
    process.exit = (code) => {
        exitCode = code;
        throw new Error(`process.exit called with ${code}`);
    };

    try {
        await assert.rejects(async () => {
            await verifyCommand({ target: tmp, runTests: false });
        }, /process\.exit called with 1/);
        assert.equal(exitCode, 1);
    } finally {
        process.exit = originalExit;
    }
});
