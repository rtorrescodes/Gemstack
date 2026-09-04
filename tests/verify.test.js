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
