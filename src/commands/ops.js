const { assessOperationalHealth } = require('../lib/operations-guard');
const logger = require('../lib/logger');

/**
 * gemstack ops (Gemstack Operations Command)
 *
 * Strictly read-only evaluation of downstream project's production guardianship.
 * Audits the 6 prioritized pillars:
 * 1. Database & Storage recovery
 * 2. Tenant isolation & RBAC
 * 3. CI/CD quality gate & deployment smoke checks
 * 4. Observability & Sentry PII sanitization
 * 5. Vulnerability & dependency checks
 * 6. Cost ledger & quotas
 */
module.exports = async (flags) => {
    const targetDir = flags.target || process.cwd();
    logger.info(`Ejecutando auditoría de Gemstack Operations en: ${targetDir}`);

    const report = assessOperationalHealth(targetDir);

    console.log('\n' + '='.repeat(75));
    console.log('🛡️ GEMSTACK OPERATIONS — REPORTE DE SALUD OPERATIVA (PRODUCCIÓN)');
    console.log(`Fecha de auditoría: ${report.timestamp}`);
    console.log(`Directorio evaluado: ${report.targetDir}`);
    console.log('='.repeat(75) + '\n');

    for (const finding of report.findings) {
        let badge = '⚪';
        if (finding.status === 'VERIFICADO') badge = '✅ VERIFICADO';
        else if (finding.status === 'REQUIERE ATENCIÓN') badge = '⚠️ REQUIERE ATENCIÓN';
        else badge = '❓ NO COMPROBADO';

        console.log(`[${finding.pillar}] ${finding.name}`);
        console.log(`  Estado:    ${badge}`);
        console.log(`  Evidencia: ${finding.evidence}`);
        if (finding.recommendation) {
            console.log(`  Acción:    ${finding.recommendation}`);
        }
        console.log('');
    }

    console.log('-'.repeat(75));
    console.log(`📊 BALANCE FINAL DE OPERACIONES:`);
    console.log(`   - VERIFICADO:        ${report.summary.verificado}`);
    console.log(`   - REQUIERE ATENCIÓN: ${report.summary.requiereAtencion}`);
    console.log(`   - NO COMPROBADO:     ${report.summary.noComprobado}`);
    console.log('-'.repeat(75) + '\n');

    if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
    }
};
