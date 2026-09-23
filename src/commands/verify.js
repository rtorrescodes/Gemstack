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
    logger.info('--- 1/6 Verificación Estructural (Archivos Base) ---');
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
    logger.info('--- 2/6 Verificación de Memoria e Integridad de Handoff ---');
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

        // Cross-Audit con Git Log (Gemstack 2.0 Sprint D)
        const { crossAuditMemoryWithGit } = require('../lib/memory-audit');
        const memAudit = crossAuditMemoryWithGit(targetDir);
        if (!memAudit.valid && memAudit.unrecorded_commits.length > 0) {
            logger.warn(`Detectados commits recientes no registrados en handoff.md: ${memAudit.unrecorded_commits.map(c => c.hash).join(', ')}`);
            totalWarnings++;
        } else {
            logger.ok('Memoria cruzada (handoff.md <-> git log) verificada.');
        }
    }

    // 3. Consistencia de Estado Local (.gemstack/state.json)
    logger.info('--- 3/6 Verificación de Estado Local (.gemstack/state.json) ---');
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
    logger.info('--- 4/6 Verificación de Consistencia de Arquitectura y Hashes de Fase ---');
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

    // 5. Verificación de Evidencia de Cierre Mecánico (Upgrade B - Read-Only)
    logger.info('--- 5/6 Verificación de Evidencia de Cierre Mecánico (Read-Only) ---');
    if (loadedState && loadedState.active_spec) {
        try {
            const { extractTestMatrixBlock } = require('../lib/test-matrix');
            const specFile = fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'spec.md'));

            if (!fs.existsSync(specFile)) {
                logger.ok(`Modo legacy: no existe spec.md en ${loadedState.active_spec}`);
            } else {
                const specContent = fs.readFileSync(specFile, 'utf8');
                const { isLegacy } = extractTestMatrixBlock(specContent);

                if (isLegacy) {
                    logger.info(`[LEGACY] Spec "${loadedState.active_spec}" opera en modo legacy sin matriz de pruebas.`);
                } else {
                    // Feature structured: read closure.json in strictly read-only mode
                    const specDir = fssafe.resolveSafe(targetDir, loadedState.active_spec);
                    const closurePath = path.join(specDir, 'closure.json');

                    if (!fs.existsSync(closurePath)) {
                        logger.error(`[CLOSURE_MANIFEST_MISSING] closure.json no existe en ${loadedState.active_spec}. Ejecuta "gemstack collect" para generar la evidencia mecánica.`);
                        totalErrors++;
                    } else {
                        let manifest;
                        try {
                            manifest = JSON.parse(fs.readFileSync(closurePath, 'utf8'));
                        } catch (e) {
                            logger.error(`[CLOSURE_MANIFEST_INVALID] closure.json tiene formato JSON inválido: ${e.message}`);
                            totalErrors++;
                            manifest = null;
                        }

                        if (manifest) {
                            // Recompute closureContextHash in-memory without modifying any file
                            const {
                                validateTestMatrix,
                                computeAcceptanceSignature
                            } = require('../lib/test-matrix');
                            const {
                                parsePlanBindings,
                                parsePlanGates,
                                parseTaskMetadata,
                                computeContentAggregateHash,
                                resolveRepositoryContext,
                                computeClosureContextHash
                            } = require('../lib/closure-context');
                            const { hashFile } = require('../lib/hasher');

                            const planFile = path.join(specDir, 'plan.md');
                            const tasksFile = path.join(specDir, 'tasks.md');

                            let planBindings = [];
                            let planGates = [];
                            if (fs.existsSync(planFile)) {
                                const planContent = fs.readFileSync(planFile, 'utf8');
                                planBindings = parsePlanBindings(planContent);
                                planGates = parsePlanGates(planContent);
                            }

                            let tasks = [];
                            if (fs.existsSync(tasksFile)) {
                                const tasksContent = fs.readFileSync(tasksFile, 'utf8');
                                tasks = parseTaskMetadata(tasksContent);
                            }

                            const { matrix } = extractTestMatrixBlock(specContent);
                            const canonicalMatrix = validateTestMatrix(matrix);
                            const acceptanceSignature = computeAcceptanceSignature(canonicalMatrix);

                            const repoContext = resolveRepositoryContext(targetDir);
                            const phaseHashes = {
                                spec: hashFile(specFile),
                                plan: fs.existsSync(planFile) ? hashFile(planFile) : null,
                                tasks: fs.existsSync(tasksFile) ? hashFile(tasksFile) : null
                            };

                            const boundTestFiles = Array.from(new Set(planBindings.map(b => b.file)));
                            const testFilesHash = computeContentAggregateHash(targetDir, boundTestFiles);
                            const implementationFiles = Array.from(new Set(tasks.flatMap(t => t.files || [])))
                                .filter(f => !f.endsWith('closure.json'));
                            const implementationContextHash = computeContentAggregateHash(targetDir, implementationFiles);
                            const requiredGateDefinitionHash = computeContentAggregateHash(targetDir, ['package.json']);

                            const freshContextObj = {
                                version: 1,
                                repository: repoContext,
                                phase_hashes: phaseHashes,
                                acceptance_signature: acceptanceSignature,
                                test_files_hash: testFilesHash,
                                implementation_context_hash: implementationContextHash,
                                required_gate_definition_hash: requiredGateDefinitionHash
                            };

                            const freshContextHash = computeClosureContextHash(freshContextObj);
                            const recordedContextHash = manifest.closure_context ? manifest.closure_context.closure_context_hash : null;

                            if (recordedContextHash !== freshContextHash) {
                                logger.error(`[CLOSURE_EVIDENCE_STALE] La evidencia de cierre está desactualizada respecto al estado actual del proyecto. Re-ejecuta "gemstack collect". (Registrado: ${recordedContextHash ? recordedContextHash.slice(0, 12) : 'none'}..., Actual: ${freshContextHash.slice(0, 12)}...)`);
                                totalErrors++;
                            } else {
                                logger.ok(`Frescura de evidencia de cierre verificada (${freshContextHash.slice(0, 12)}...).`);

                                if (manifest.status !== 'VERIFIED' && manifest.status !== 'VERIFIED_WITH_EXCEPTIONS') {
                                    logger.error(`[CLOSURE_NOT_VERIFIED] Estado del manifiesto es "${manifest.status}". Bloqueadores: ${JSON.stringify(manifest.blockers || [])}`);
                                    totalErrors++;
                                } else {
                                    logger.ok(`Evidencia de cierre aprobada: status="${manifest.status}", ${manifest.canonical_summary ? manifest.canonical_summary.required_passed : 0}/${manifest.canonical_summary ? manifest.canonical_summary.required_total : 0} pruebas canónicas pasadas.`);
                                }
                            }
                        }
                    }
                }
            }
        } catch (mErr) {
            logger.error(`Error en verificación de evidencia de cierre: ${mErr.message}`);
            totalErrors++;
        }
    } else {
        logger.ok('Sin spec activa configurada para validación de evidencia de cierre.');
    }

    // 5.1 Verificación de Políticas de Costos y Proveedores (Upgrade C - Read-Only)
    const { loadCostLedger } = require('../lib/cost-ledger');
    let costLedgerFound = false;
    const ledgerCandidates = [];
    if (loadedState && loadedState.active_spec) {
        ledgerCandidates.push(fssafe.resolveSafe(targetDir, path.join(loadedState.active_spec, 'cost-ledger.json')));
    }
    ledgerCandidates.push(fssafe.resolveSafe(targetDir, 'cost-ledger.json'));
    ledgerCandidates.push(fssafe.resolveSafe(targetDir, '.gemstack/cost-ledger.json'));

    for (const lPath of ledgerCandidates) {
        if (fs.existsSync(lPath)) {
            costLedgerFound = true;
            const res = loadCostLedger(lPath);
            if (res.findings.length > 0) {
                for (const f of res.findings) {
                    if (f.is_blocking) {
                        logger.error(`[COST_SAFETY_BLOCKER] ${f.code}: ${f.details}`);
                        totalErrors++;
                    } else {
                        logger.warn(`[COST_SAFETY_WARNING] ${f.code}: ${f.details}`);
                        totalWarnings++;
                    }
                }
            } else {
                logger.ok(`Cost ledger verificado (${path.basename(lPath)}): íntegro y sin secretos.`);
            }
            break;
        }
    }

    if (!costLedgerFound) {
        logger.info('[LEGACY] [LEGACY_NO_PROVIDERS_DECLARED] No se detectaron declaraciones de costos o proveedores (Modo Legacy Provider-Free).');
    }

    // 5.2 Verificación de Context Capsule (Upgrade D - Read-Only)
    logger.info('--- 5.2 Verificación de Context Capsule (Read-Only) ---');
    if (loadedState && loadedState.active_spec) {
        const { validateContextCapsule } = require('../lib/context-capsule');
        const capResult = validateContextCapsule(targetDir, loadedState.active_spec);
        if (capResult.valid) {
            logger.ok(`Context capsule verificado y fresco (${loadedState.active_spec}/context-capsule.json).`);
        } else if (capResult.state === 'MISSING') {
            logger.info(`[LEGACY] No se detectó context-capsule.json en "${loadedState.active_spec}" (Modo Legacy Context-Free).`);
        } else {
            for (const f of capResult.findings) {
                logger.error(`[${f.code}] ${f.message}`);
                totalErrors++;
            }
        }
    } else {
        logger.ok('Sin spec activa configurada para verificación de context capsule.');
    }

    // 5.3 Verificación de Swarm Manifest (Upgrade E - Read-Only)
    logger.info('--- 5.3 Verificación de Swarm Manifest & Partition Safety (Read-Only) ---');
    if (loadedState && loadedState.active_spec) {
        const { validateSwarmManifest } = require('../lib/swarm');
        const swarmResult = validateSwarmManifest(targetDir, loadedState.active_spec);
        if (swarmResult.valid) {
            logger.ok(`Swarm manifest verificado y sin colisiones (${loadedState.active_spec}/swarm.json).`);
        } else if (swarmResult.state === 'MISSING') {
            logger.info(`[LEGACY] No se detectó swarm.json en "${loadedState.active_spec}" (Modo Legacy Swarm-Free).`);
        } else {
            for (const f of swarmResult.findings) {
                logger.error(`[${f.code}] ${f.details || f.message}`);
                totalErrors++;
            }
        }
    } else {
        logger.ok('Sin spec activa configurada para verificación de swarm manifest.');
    }

    // 5.4 Verificación de Visual QA Manifest & Baselines (Upgrade E - Read-Only)
    logger.info('--- 5.4 Verificación de Visual QA Manifest & Baselines (Read-Only) ---');
    if (loadedState && loadedState.active_spec) {
        const { validateVisualManifest } = require('../lib/visual-qa');
        const vqaResult = validateVisualManifest(targetDir, loadedState.active_spec);
        if (vqaResult.valid) {
            logger.ok(`Visual QA manifest y baselines íntegros (${loadedState.active_spec}/visual-qa.json).`);
        } else if (vqaResult.state === 'MISSING') {
            logger.info(`[LEGACY] No se detectó visual-qa.json en "${loadedState.active_spec}" (Modo Legacy Visual-Free).`);
        } else {
            for (const f of vqaResult.findings) {
                logger.error(`[${f.code}] ${f.details || f.message}`);
                totalErrors++;
            }
        }
    } else {
        logger.ok('Sin spec activa configurada para verificación de visual QA.');
    }

    // 6. Seguridad Local y Anti-Silent Failures en Tests
    logger.info('--- 6/6 Verificación de Seguridad y Test Runners ---');
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
