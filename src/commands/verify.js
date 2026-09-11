const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');

module.exports = async (flags) => {
    const targetDir = flags.target || process.cwd();
    logger.info(`Ejecutando verificación integral de Gemstack en: ${targetDir}`);

    let totalErrors = 0;
    let totalWarnings = 0;

    // 1. Verificación Estructural y Manifest
    logger.info('--- 1/5 Verificación Estructural (Archivos Base) ---');
    const manifestPath = fssafe.resolveSafe(targetDir, '.gemstack/manifest.json');
    if (!fs.existsSync(manifestPath)) {
        logger.warn('Manifest no encontrado (.gemstack/manifest.json). Es posible que Gemstack no esté inicializado en este directorio.');
        totalWarnings++;
    } else {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            let missing = 0;
            let modified = 0;
            (manifest.files || []).forEach(f => {
                const p = fssafe.resolveSafe(targetDir, f.path);
                if (!fs.existsSync(p)) {
                    logger.error(`Archivo requerido faltante: ${f.path}`);
                    missing++;
                } else {
                    const destContent = fs.readFileSync(p);
                    if (manifestLib.getChecksum(destContent) !== f.checksum) {
                        modified++;
                    }
                }
            });
            if (missing === 0 && modified === 0) {
                logger.ok('Todos los archivos base de Gemstack están presentes e íntegros.');
            } else {
                if (missing > 0) totalErrors += missing;
                if (modified > 0) {
                    logger.info(`${modified} archivos base modificados localmente (personalización permitida).`);
                }
            }
        } catch (e) {
            logger.error(`Error leyendo manifest.json: ${e.message}`);
            totalErrors++;
        }
    }

    const giPath = fssafe.resolveSafe(targetDir, '.gitignore');
    if (fs.existsSync(giPath) && fs.readFileSync(giPath, 'utf8').includes('# Gemstack')) {
        logger.ok('.gitignore contiene el bloque de Gemstack.');
    } else {
        logger.warn('.gitignore no está configurado con las exclusiones de Gemstack.');
        totalWarnings++;
    }

    // 2. Verificación de Memoria (handoff.md)
    logger.info('--- 2/5 Verificación de Memoria e Integridad de Handoff ---');
    const handoffPath = fssafe.resolveSafe(targetDir, 'handoff.md');
    if (!fs.existsSync(handoffPath)) {
        logger.error('handoff.md no existe en la raíz. La memoria de sesión es obligatoria.');
        totalErrors++;
    } else {
        const handoffContent = fs.readFileSync(handoffPath, 'utf8');
        const requiredSections = [
            '1. Objetivo',
            '2. Estado actual',
            '3. Archivos y cambios',
            '4. Intentos fallidos',
            '5. Próximos pasos'
        ];
        const missingSections = requiredSections.filter(s => !handoffContent.includes(s));
        if (missingSections.length > 0) {
            logger.error(`handoff.md está incompleto. Faltan secciones obligatorias: ${missingSections.join(', ')}`);
            totalErrors++;
        } else {
            logger.ok('handoff.md contiene las 5 secciones obligatorias.');
        }

        // Regla inmutable: '4. Intentos fallidos' no debe estar eliminada
        if (!handoffContent.includes('4. Intentos fallidos')) {
            logger.error('Violación de la Constitución: La sección "4. Intentos fallidos" fue eliminada.');
            totalErrors++;
        } else {
            logger.ok('Sección inmutable "4. Intentos fallidos" preservada.');
        }
    }

    // 3. Consistencia de Estado Local (.gemstack/state.json)
    logger.info('--- 3/5 Verificación de Estado Local (.gemstack/state.json) ---');
    const statePath = fssafe.resolveSafe(targetDir, '.gemstack/state.json');
    let loadedState = null;
    if (!fs.existsSync(statePath)) {
        logger.warn('.gemstack/state.json no encontrado.');
        totalWarnings++;
    } else {
        try {
            const { readState } = require('../lib/state');
            loadedState = readState(targetDir);
            logger.ok(`Estado local cargado. Fase actual: ${loadedState.current_phase || 'no definida'}`);
            if (loadedState.active_spec) {
                const specFile = fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'spec.md'));
                if (!fs.existsSync(specFile)) {
                    logger.warn(`Desfase de estado: active_spec apunta a "${loadedState.active_spec}", pero "${specFile}" no existe.`);
                    totalWarnings++;
                } else {
                    logger.ok(`active_spec confirmado: ${loadedState.active_spec}`);
                }
            } else {
                logger.ok('Sin spec activa pendiente (estado limpio o cerrado).');
            }
        } catch (e) {
            logger.error(`.gemstack/state.json tiene formato JSON inválido: ${e.message}`);
            totalErrors++;
        }
    }

    // 4. Consistencia de Arquitectura y Hashes de Fase (Upgrade A)
    logger.info('--- 4/5 Verificación de Consistencia de Arquitectura y Hashes de Fase ---');
    if (loadedState && loadedState.active_spec) {
        try {
            const { hashFile } = require('../lib/hasher');
            const {
                extractContractsBlock,
                validateContractSchemas,
                comparePhaseContracts,
                resolvePhaseInheritance
            } = require('../lib/contracts');
            const {
                reconcileFindings,
                evaluateAcceptedExceptions,
                formatDisplayFingerprint
            } = require('../lib/findings');

            const specFile = fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'spec.md'));
            const planFile = fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'plan.md'));
            const tasksFile = fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'tasks.md'));

            if (fs.existsSync(specFile)) {
                const specRaw = fs.readFileSync(specFile, 'utf8');
                const specBlock = extractContractsBlock(specRaw);

                if (specBlock.isLegacy) {
                    logger.ok(`[LEGACY] Feature "${loadedState.active_spec}" opera en modo legacy (sin bloques de contratos).`);
                } else {
                    const specContracts = validateContractSchemas(specBlock.contracts);
                    logger.ok(`[STRUCTURED] ${specContracts.length} contrato(s) base declarados en spec.md.`);

                    // Detección de mutación de spec congelada (VERIFY != FREEZE)
                    if (loadedState.phase_hashes && loadedState.phase_hashes.spec) {
                        const currentSpecHash = hashFile(specFile);
                        if (currentSpecHash !== loadedState.phase_hashes.spec) {
                            logger.error(`[FROZEN_ARTIFACT_CHANGED] El artefacto congelado spec.md fue mutado sin autorización. Hash esperado: ${loadedState.phase_hashes.spec}, actual: ${currentSpecHash}`);
                            totalErrors++;
                        } else {
                            logger.ok(`Hash congelado de spec.md verificado: ${loadedState.phase_hashes.spec.slice(0, 12)}...`);
                        }
                    }

                    // Validación de PLAN si existe
                    let effectiveUpstream = specContracts;
                    let planContracts = [];
                    let violations = [];

                    if (fs.existsSync(planFile)) {
                        const planRaw = fs.readFileSync(planFile, 'utf8');
                        const planBlock = extractContractsBlock(planRaw);
                        if (!planBlock.isLegacy) {
                            planContracts = validateContractSchemas(planBlock.contracts);
                            const planViolations = comparePhaseContracts(effectiveUpstream, planContracts, 'plan');
                            violations.push(...planViolations.map(v => ({ ...v, location: path.join(loadedState.active_spec, 'plan.md') })));
                            effectiveUpstream = resolvePhaseInheritance(effectiveUpstream, planContracts);
                        }

                        if (loadedState.phase_hashes && loadedState.phase_hashes.plan) {
                            const currentPlanHash = hashFile(planFile);
                            if (currentPlanHash !== loadedState.phase_hashes.plan) {
                                logger.error(`[FROZEN_ARTIFACT_CHANGED] El artefacto congelado plan.md fue mutado sin autorización. Hash esperado: ${loadedState.phase_hashes.plan}, actual: ${currentPlanHash}`);
                                totalErrors++;
                            } else {
                                logger.ok(`Hash congelado de plan.md verificado: ${loadedState.phase_hashes.plan.slice(0, 12)}...`);
                            }
                        }
                    }

                    // Validación de TASKS si existe
                    if (fs.existsSync(tasksFile)) {
                        const tasksRaw = fs.readFileSync(tasksFile, 'utf8');
                        const tasksBlock = extractContractsBlock(tasksRaw);
                        if (!tasksBlock.isLegacy) {
                            const tasksContracts = validateContractSchemas(tasksBlock.contracts);
                            const tasksViolations = comparePhaseContracts(effectiveUpstream, tasksContracts, 'tasks');
                            violations.push(...tasksViolations.map(v => ({ ...v, location: path.join(loadedState.active_spec, 'tasks.md') })));
                        }

                        if (loadedState.phase_hashes && loadedState.phase_hashes.tasks) {
                            const currentTasksHash = hashFile(tasksFile);
                            if (currentTasksHash !== loadedState.phase_hashes.tasks) {
                                logger.error(`[FROZEN_ARTIFACT_CHANGED] El artefacto congelado tasks.md fue mutado sin autorización. Hash esperado: ${loadedState.phase_hashes.tasks}, actual: ${currentTasksHash}`);
                                totalErrors++;
                            } else {
                                logger.ok(`Hash congelado de tasks.md verificado: ${loadedState.phase_hashes.tasks.slice(0, 12)}...`);
                            }
                        }
                    }

                    // Reconciliación de hallazgos y evaluación de excepciones aceptadas vía sidecar de feature
                    const featureDir = fssafe.resolveSafe(targetDir, loadedState.active_spec);
                    const { readSidecar, writeSidecarAtomic } = require('../lib/state');
                    const sidecar = readSidecar(featureDir);

                    // Migración retrocompatible: si state tenía findings o accepted_exceptions, migrarlos al sidecar
                    const existingFindings = sidecar.historical_findings && sidecar.historical_findings.length > 0
                        ? sidecar.historical_findings
                        : (loadedState.findings || []);
                    const acceptedExceptions = sidecar.accepted_exceptions && sidecar.accepted_exceptions.length > 0
                        ? sidecar.accepted_exceptions
                        : (loadedState.accepted_exceptions || []);

                    const reconciled = reconcileFindings(existingFindings, violations);
                    const currentContext = {
                        upstreamAcceptedPhaseHash: (loadedState.phase_hashes && loadedState.phase_hashes.spec) || '',
                        currentComparedPhaseHash: (loadedState.phase_hashes && loadedState.phase_hashes.plan) || '',
                        normalizedContractRepresentation: JSON.stringify(effectiveUpstream)
                    };
                    const evaluated = evaluateAcceptedExceptions(reconciled, acceptedExceptions, currentContext);

                    // Persistir el historial detallado de hallazgos exclusivamente en el sidecar
                    sidecar.historical_findings = evaluated;
                    sidecar.accepted_exceptions = acceptedExceptions;
                    writeSidecarAtomic(featureDir, sidecar);

                    const blockers = evaluated.filter(f => f.is_blocking);
                    if (blockers.length > 0) {
                        for (const b of blockers) {
                            logger.error(`[CONSISTENCY_BLOCKER] Contrato "${b.contractId}" en fase "${b.phase}" (${formatDisplayFingerprint(b.fingerprint)}): ${JSON.stringify(b.delta)}`);
                        }
                        totalErrors += blockers.length;
                    } else {
                        logger.ok('Verificación de consistencia arquitectónica aprobada (0 bloqueadores).');
                    }
                }
            } else {
                logger.ok(`Modo legacy: no existe spec.md en ${loadedState.active_spec}`);
            }
        } catch (cErr) {
            logger.error(`Error en verificación de consistencia: ${cErr.message}`);
            totalErrors++;
        }
    } else {
        logger.ok('Sin spec activa configurada para verificación de contratos.');
    }

    // 5. Seguridad Local y Anti-Silent Failures en Tests
    logger.info('--- 5/5 Verificación de Seguridad y Test Runners ---');
    const envPath = fssafe.resolveSafe(targetDir, '.env');
    if (fs.existsSync(envPath)) {
        logger.warn('Archivo .env detectado en el directorio de trabajo. Verifica que esté en .gitignore.');
        totalWarnings++;
    }

    const pkgPath = fssafe.resolveSafe(targetDir, 'package.json');
    if (fs.existsSync(pkgPath)) {
        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            const scripts = pkg.scripts || {};
            for (const [scriptName, scriptCmd] of Object.entries(scripts)) {
                if (typeof scriptCmd === 'string') {
                    // Detección de supresores de error peligrosos en scripts
                    if (scriptCmd.includes('2>nul') || scriptCmd.includes('2> nul')) {
                        logger.error(`Falso positivo silencioso detectado en script "${scriptName}": contiene "2>nul", incompatible con PowerShell/Bash y enmascara fallos.`);
                        logger.info(`Solución: Estandariza el runner multiplataforma usando: "tsx --test <paths>" o "node --test <paths>"`);
                        totalErrors++;
                    } else if (scriptCmd.includes('|| true') && scriptName.includes('test')) {
                        logger.warn(`Script de prueba "${scriptName}" contiene "|| true", lo que ignora fallos de testing.`);
                        totalWarnings++;
                    }
                }
            }
            logger.ok('Revisión de scripts de package.json completada.');
        } catch (e) {
            logger.warn(`No se pudo parsear package.json: ${e.message}`);
        }
    }

    // Ejecución de pruebas si se solicita explícitamente (--run-tests)
    if (flags.runTests) {
        logger.info('Ejecutando suite de pruebas (--run-tests activado)...');
        try {
            execSync('npm test', { cwd: targetDir, stdio: 'inherit' });
            logger.ok('Suite de pruebas ejecutada con éxito.');
        } catch (err) {
            logger.error('La suite de pruebas falló.');
            totalErrors++;
        }
    }

    // Resumen Final
    console.log('\n--- Resumen de Auditoría Gemstack ---');
    if (totalErrors === 0 && totalWarnings === 0) {
        logger.ok('Auditoría completada sin errores ni advertencias. Todo el sistema está saludable.');
    } else if (totalErrors === 0) {
        logger.ok(`Auditoría completada con éxito (${totalWarnings} advertencia(s) menores).`);
    } else {
        logger.error(`Auditoría finalizada con ${totalErrors} error(es) y ${totalWarnings} advertencia(s).`);
        process.exit(1);
    }
};
