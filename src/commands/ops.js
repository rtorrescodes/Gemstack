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
    console.log(`Fecha de auditoría: ${report.auditTimestamp}`);
    console.log(`Directorio evaluado: ${report.targetDir}`);
    console.log(`Rama detectada:      ${report.currentBranch} (${report.isMainBranch ? 'PRODUCCIÓN PRINCIPAL' : 'RAMA AISLADA'})`);
    console.log('='.repeat(75) + '\n');

    for (const finding of report.findings) {
        let badge = '⚪';
        if (finding.status === 'VERIFICADO') badge = '✅ VERIFICADO';
        else if (finding.status === 'CONFIGURADO EN RAMA') badge = '🌿 CONFIGURADO EN RAMA';
        else if (finding.status === 'REQUIERE ATENCIÓN') badge = '⚠️ REQUIERE ATENCIÓN';
        else badge = '❓ NO COMPROBADO';

        console.log(`[${finding.pillar}] ${finding.name}`);
        console.log(`  Estado:         ${badge}`);
        console.log(`  Tipo Evidencia: ${finding.evidenceType}`);
        console.log(`  Fuente:         ${finding.source}`);
        console.log(`  Fecha:          ${finding.evidenceDate}`);
        console.log(`  Frescura:       ${finding.freshness}`);
        console.log(`  Detalle:        ${finding.evidence}`);
        if (finding.recommendation) {
            console.log(`  Acción:         ${finding.recommendation}`);
        }
        console.log('');
    }

    console.log('-'.repeat(75));
    console.log(`📊 BALANCE FINAL DE OPERACIONES:`);
    console.log(`   - VERIFICADO:          ${report.summary.verificado}`);
    console.log(`   - CONFIGURADO EN RAMA: ${report.summary.configuradoEnRama || 0}`);
    console.log(`   - REQUIERE ATENCIÓN:   ${report.summary.requiereAtencion}`);
    console.log(`   - NO COMPROBADO:       ${report.summary.noComprobado}`);
    console.log('-'.repeat(75) + '\n');

    if (flags.json) {
        console.log(JSON.stringify(report, null, 2));
    }
};
