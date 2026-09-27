const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { assessOperationalHealth } = require('../src/lib/operations-guard');

test('gemstack ops: assesses production health accurately and strictly read-only', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ops-test-'));

    try {
        // Initial state: empty project
        const initialReport = assessOperationalHealth(tempDir);
        assert.ok(initialReport.summary.total > 0);
        assert.strictEqual(initialReport.summary.verificado, 0);
        assert.ok(initialReport.summary.requiereAtencion > 0);

        // Add recovery script
        const scriptsOps = path.join(tempDir, 'scripts', 'ops');
        fs.mkdirSync(scriptsOps, { recursive: true });
        fs.writeFileSync(path.join(scriptsOps, 'restore-drill-dryrun.mjs'), '// dry run');

        // Add RBAC test
        const testsDir = path.join(tempDir, 'src', '__tests__');
        fs.mkdirSync(testsDir, { recursive: true });
        fs.writeFileSync(path.join(testsDir, 'tenant-isolation.test.ts'), '// isolation');

        // Add hardened CI workflow with Trivy container scan
        const workflowsDir = path.join(tempDir, '.github', 'workflows');
        fs.mkdirSync(workflowsDir, { recursive: true });
        fs.writeFileSync(path.join(workflowsDir, 'deploy.yml'), 'jobs:\n  pre-deploy-checks:\n    run: trivy\n  deploy:\n    run: health smoke');

        // Add Sentry with PII scrubbing
        fs.writeFileSync(path.join(tempDir, 'sentry.client.config.ts'), 'beforeSend(e) { delete e.request.headers.authorization; }');

        // Add release checklist
        const docsDir = path.join(tempDir, 'docs');
        fs.mkdirSync(docsDir, { recursive: true });
        fs.writeFileSync(path.join(docsDir, 'release-checklist.md'), '# Checklist');

        // Add package.json with audit script and trivy evaluator
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
            name: "test-app",
            scripts: {
                "audit:security": "echo ok"
            }
        }));
        fs.writeFileSync(path.join(scriptsOps, 'scan-container-security.mjs'), '// trivy gate');

        const protectedReport = assessOperationalHealth(tempDir);
        assert.strictEqual(protectedReport.summary.requiereAtencion, 0);
        assert.ok(protectedReport.summary.verificado >= 4);
        assert.ok(protectedReport.summary.noComprobado >= 1); // Cost ledger and remote Sentry DSN not added

        // Verify finding metadata
        const recoveryFinding = protectedReport.findings.find(f => f.pillar === 'Recuperación DB & Storage');
        assert.ok(recoveryFinding);
        assert.strictEqual(recoveryFinding.evidenceType, 'PROBADO_LOCALMENTE');
        assert.strictEqual(recoveryFinding.freshness, 'VIGENTE');
        assert.ok(recoveryFinding.evidenceDate);

        // Verify read-only guarantee: nothing extraneous was written
        assert.strictEqual(fs.existsSync(path.join(tempDir, '.gemstack.json')), false);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});

test('gemstack ops: detects expired evidence when artifact is older than 7 days', (t) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-ops-expired-'));

    try {
        const scriptsOps = path.join(tempDir, 'scripts', 'ops');
        fs.mkdirSync(scriptsOps, { recursive: true });
        const scriptPath = path.join(scriptsOps, 'restore-drill-dryrun.mjs');
        fs.writeFileSync(scriptPath, '// dry run');

        // Mutate mtime to 10 days ago
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        fs.utimesSync(scriptPath, tenDaysAgo, tenDaysAgo);

        const report = assessOperationalHealth(tempDir);
        const finding = report.findings.find(f => f.pillar === 'Recuperación DB & Storage');
        assert.ok(finding);
        assert.strictEqual(finding.freshness, 'CADUCADO');
        assert.strictEqual(finding.status, 'REQUIERE ATENCIÓN');
        assert.ok(finding.recommendation);
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
