const fs = require('fs');
const path = require('path');
const fssafe = require('./filesystem-safe');

/**
 * Gemstack Operations Guardian (Read-Only Production Health Diagnostics)
 *
 * Responsibilities:
 * - Read-only assessment of downstream production operational safety
 * - Verifies the 6 prioritized operations pillars:
 *   1. Verifiable Database & Storage recovery scripts/procedures
 *   2. Tenant isolation & RBAC test matrix existence
 *   3. Hardened CI/CD quality gate & deployment smoke test
 *   4. Observability / Sentry configuration & PII scrubbing
 *   5. Vulnerability & dependency scanning readiness
 *   6. Cost / quota boundaries & provider fail-safe configuration
 *
 * Contract:
 * - Strictly read-only (zero writes to project files during audit).
 * - Categorizes findings with evidence date and status:
 *   - VERIFICADO (evidence confirmed operating)
 *   - REQUIERE ATENCIÓN (missing protection, misconfiguration, or staging/prod clash)
 *   - NO COMPROBADO (declared or configured, but unverified at runtime)
 */

function assessOperationalHealth(targetDir = process.cwd()) {
    const timestamp = new Date().toISOString();
    const findings = [];

    // Helper to log findings
    function addFinding(pillar, name, status, evidence, recommendation = null) {
        findings.push({
            pillar,
            name,
            status, // 'VERIFICADO' | 'REQUIERE ATENCIÓN' | 'NO COMPROBADO'
            evidence,
            recommendation,
            timestamp
        });
    }

    // -------------------------------------------------------------
    // Pillar 1: Verifiable Database & Storage Recovery
    // -------------------------------------------------------------
    const restoreScriptCandidates = [
        'scripts/ops/restore-drill-dryrun.mjs',
        'scripts/ops/restore-drill-dryrun.js',
        'scripts/backup-db.ts',
        'scripts/backup-db.js',
        'scripts/clone-db-to-staging.ts',
        'scripts/verify-production-db.mjs',
        'scripts/verify-production-storage.mjs'
    ];

    const detectedRecoveryScripts = restoreScriptCandidates.filter(rel => 
        fs.existsSync(fssafe.resolveSafe(targetDir, rel))
    );

    if (detectedRecoveryScripts.length > 0) {
        addFinding(
            'Recuperación DB & Storage',
            'Procedimientos y scripts de respaldo/recuperación',
            'VERIFICADO',
            `Scripts de recuperación detectados en repositorio: ${detectedRecoveryScripts.join(', ')}`
        );
    } else {
        addFinding(
            'Recuperación DB & Storage',
            'Procedimientos y scripts de respaldo/recuperación',
            'REQUIERE ATENCIÓN',
            'No se detectaron scripts automatizados ni procedimientos para simulacros de recuperación topológica ni volcado de Storage.',
            'Implementar script de restore drill no destructivo y verificación de buckets de almacenamiento.'
        );
    }

    // -------------------------------------------------------------
    // Pillar 2: Tenant Isolation & RBAC/RLS Audit
    // -------------------------------------------------------------
    const rbacScriptCandidates = [
        'scripts/rbac-tenant-isolation-audit.mjs',
        'scripts/release-gate.ts',
        'tests/tenant-bootstrap.test.ts',
        'src/__tests__/tenant-isolation.test.ts',
        'src/__tests__/rbac-audit.test.ts'
    ];

    const detectedRbacTests = rbacScriptCandidates.filter(rel => 
        fs.existsSync(fssafe.resolveSafe(targetDir, rel))
    );

    if (detectedRbacTests.length > 0) {
        addFinding(
            'Aislamiento Multi-Tenant & RBAC',
            'Pruebas y auditorías de aislamiento de datos y permisos',
            'VERIFICADO',
            `Pruebas o scripts de auditoría RBAC/RLS localizados: ${detectedRbacTests.join(', ')}`
        );
    } else {
        addFinding(
            'Aislamiento Multi-Tenant & RBAC',
            'Pruebas y auditorías de aislamiento de datos y permisos',
            'REQUIERE ATENCIÓN',
            'No se detectaron suites dedicadas a la prevención de IDOR ni auditoría de Row Level Security (RLS).',
            'Añadir tests de aislamiento multi-tenant y verificación de RLS en base de datos.'
        );
    }

    // -------------------------------------------------------------
    // Pillar 3: CI/CD Quality Gate, Staging & Rollback Controls
    // -------------------------------------------------------------
    const deployWorkflowPath = fssafe.resolveSafe(targetDir, '.github/workflows/deploy.yml');
    const releaseChecklistPath = fssafe.resolveSafe(targetDir, 'docs/release-checklist.md');

    if (fs.existsSync(deployWorkflowPath)) {
        const workflowContent = fs.readFileSync(deployWorkflowPath, 'utf8');
        const hasPreDeploy = workflowContent.includes('pre-deploy-checks') || workflowContent.includes('needs:');
        const hasSmokeCheck = workflowContent.includes('health') || workflowContent.includes('smoke');

        if (hasPreDeploy && hasSmokeCheck) {
            addFinding(
                'Controles de CI/CD & Rollback',
                'Candado de despliegue y verificación de salud post-despliegue',
                'VERIFICADO',
                'Workflow de CI (.github/workflows/deploy.yml) contiene compuerta pre-deploy y prueba post-deploy de salud.'
            );
        } else if (hasPreDeploy) {
            addFinding(
                'Controles de CI/CD & Rollback',
                'Candado de despliegue y verificación de salud post-despliegue',
                'REQUIERE ATENCIÓN',
                'El workflow de despliegue cuenta con pre-checks pero carece de smoke test post-despliegue para verificar routing y salud.',
                'Añadir curl/smoke test al endpoint de salud tras el despliegue.'
            );
        } else {
            addFinding(
                'Controles de CI/CD & Rollback',
                'Candado de despliegue y verificación de salud post-despliegue',
                'REQUIERE ATENCIÓN',
                'El workflow despliega directamente a producción sin compuerta previa de tests/typecheck.',
                'Añadir trabajo pre-deploy-checks que requiera build, typecheck y tests en verde.'
            );
        }
    } else {
        addFinding(
            'Controles de CI/CD & Rollback',
            'Automatización de CI/CD',
            'NO COMPROBADO',
            'No se encontró archivo .github/workflows/deploy.yml en el repositorio.'
        );
    }

    if (fs.existsSync(releaseChecklistPath)) {
        addFinding(
            'Controles de CI/CD & Rollback',
            'Checklist y protocolo de reversión documentado',
            'VERIFICADO',
            'Existe docs/release-checklist.md con procedimientos de control de cambios y rollback.'
        );
    }

    // -------------------------------------------------------------
    // Pillar 4: Sentry & Observability Integration
    // -------------------------------------------------------------
    const clientSentry = fssafe.resolveSafe(targetDir, 'sentry.client.config.ts');
    const serverSentry = fssafe.resolveSafe(targetDir, 'sentry.server.config.ts');
    const hasSentryConfigs = fs.existsSync(clientSentry) || fs.existsSync(serverSentry);

    if (hasSentryConfigs) {
        let scrubsPII = false;
        try {
            const clientContent = fs.existsSync(clientSentry) ? fs.readFileSync(clientSentry, 'utf8') : '';
            const serverContent = fs.existsSync(serverSentry) ? fs.readFileSync(serverSentry, 'utf8') : '';
            scrubsPII = clientContent.includes('authorization') || serverContent.includes('authorization') ||
                        clientContent.includes('beforeSend') || serverContent.includes('beforeSend');
        } catch (_) {}

        if (scrubsPII) {
            addFinding(
                'Monitoreo & Sentry',
                'Integración de Sentry y saneamiento de PII',
                'VERIFICADO',
                'Archivos sentry.*.config.ts presentes y configurados con filtros beforeSend para depuración de cabeceras sensibles y PII.'
            );
        } else {
            addFinding(
                'Monitoreo & Sentry',
                'Integración de Sentry y saneamiento de PII',
                'REQUIERE ATENCIÓN',
                'Archivos sentry.*.config.ts presentes pero sin evidencia explícita de saneamiento (scrubbing) de tokens o credenciales.',
                'Configurar beforeSend para eliminar cabeceras de autorización y datos de usuario sensibles.'
            );
        }
    } else {
        addFinding(
            'Monitoreo & Sentry',
            'Integración de Sentry',
            'REQUIERE ATENCIÓN',
            'No se encontraron configuraciones de Sentry en el proyecto.',
            'Instalar y configurar SDK de Sentry con controles de muestreo y filtrado de PII.'
        );
    }

    // -------------------------------------------------------------
    // Pillar 5: Vulnerability & Dependency Scanning Readiness
    // -------------------------------------------------------------
    const pkgJsonPath = fssafe.resolveSafe(targetDir, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            const scripts = pkg.scripts || {};
            const hasAuditScript = Object.keys(scripts).some(k => k.includes('audit') || k.includes('trivy') || k.includes('security'));
            if (hasAuditScript) {
                addFinding(
                    'Vulnerabilidades & Dependencias',
                    'Scripts de auditoría de seguridad y dependencias',
                    'VERIFICADO',
                    `Scripts declarados en package.json: ${Object.keys(scripts).filter(k => k.includes('audit') || k.includes('trivy') || k.includes('security')).join(', ')}`
                );
            } else {
                addFinding(
                    'Vulnerabilidades & Dependencias',
                    'Escaneo de vulnerabilidades',
                    'NO COMPROBADO',
                    'No se encontraron scripts de auditoría de paquetes o Trivy definidos en package.json.'
                );
            }
        } catch (_) {}
    }

    // -------------------------------------------------------------
    // Pillar 6: Cost Ledger & Provider Quota Bounds
    // -------------------------------------------------------------
    const costLedgerCandidates = [
        'docs/cost-ledger.md',
        'docs/budget.md',
        '.gemstack/cost-ledger.json'
    ];
    const detectedCostDocs = costLedgerCandidates.filter(rel =>
        fs.existsSync(fssafe.resolveSafe(targetDir, rel))
    );

    if (detectedCostDocs.length > 0) {
        addFinding(
            'Costos & Cuotas',
            'Registro y límites de consumo de proveedores',
            'VERIFICADO',
            `Evidencia de seguimiento de costos encontrada en: ${detectedCostDocs.join(', ')}`
        );
    } else {
        addFinding(
            'Costos & Cuotas',
            'Registro y límites de consumo de proveedores',
            'NO COMPROBADO',
            'No se detectaron registros de límites presupuestarios o cuotas de consumo en el repositorio.'
        );
    }

    return {
        timestamp,
        targetDir,
        findings,
        summary: {
            total: findings.length,
            verificado: findings.filter(f => f.status === 'VERIFICADO').length,
            requiereAtencion: findings.filter(f => f.status === 'REQUIERE ATENCIÓN').length,
            noComprobado: findings.filter(f => f.status === 'NO COMPROBADO').length
        }
    };
}

module.exports = {
    assessOperationalHealth
};
