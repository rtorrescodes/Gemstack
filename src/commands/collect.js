const fs = require('fs');
const path = require('path');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const { hashFile } = require('../lib/hasher');
const { readState } = require('../lib/state');
const {
  extractTestMatrixBlock,
  validateTestMatrix,
  computeAcceptanceSignature
} = require('../lib/test-matrix');
const {
  parsePlanBindings,
  parsePlanGates,
  parseTaskMetadata,
  reconcileTaskTraceability,
  resolveRelevantFiles,
  computeContentAggregateHash,
  resolveRepositoryContext,
  computeClosureContextHash
} = require('../lib/closure-context');
const {
  executeNodeTestRunner,
  parseNodeTestTap,
  reconcileTestRun,
  executePackageScriptGate,
  generateClosureManifest
} = require('../lib/runner-adapters');

module.exports = async (flags = {}) => {
  const targetDir = flags.target || process.cwd();
  const state = readState(targetDir);

  if (!state || !state.active_spec) {
    logger.error('No active spec found in state.json.');
    process.exit(1);
  }

  const activeSpec = state.active_spec;
  const specDir = fssafe.resolveSafe(targetDir, activeSpec);
  const specFile = path.join(specDir, 'spec.md');
  const planFile = path.join(specDir, 'plan.md');
  const tasksFile = path.join(specDir, 'tasks.md');

  if (!fs.existsSync(specFile)) {
    logger.error(`spec.md not found at ${specFile}`);
    process.exit(1);
  }

  logger.info(`Iniciando recolección mecánica de evidencias para: ${activeSpec}`);

  // 1. Parse SPEC test matrix
  const specContent = fs.readFileSync(specFile, 'utf8');
  const { matrix, isLegacy } = extractTestMatrixBlock(specContent);

  if (isLegacy) {
    logger.info(`[LEGACY] Spec "${activeSpec}" opera en modo legacy sin matriz de pruebas.`);
    return;
  }

  let canonicalMatrix;
  let acceptanceSignature;
  try {
    canonicalMatrix = validateTestMatrix(matrix);
    acceptanceSignature = computeAcceptanceSignature(canonicalMatrix);
    logger.ok(`Matriz de pruebas validada (${canonicalMatrix.length} pruebas canónicas, signature: ${acceptanceSignature.slice(0, 12)}...)`);
  } catch (e) {
    logger.error(`Error validando matriz de pruebas: ${e.message}`);
    process.exit(1);
  }

  // 2. Parse PLAN bindings and gates
  let planBindings = [];
  let planGates = [];
  if (fs.existsSync(planFile)) {
    const planContent = fs.readFileSync(planFile, 'utf8');
    try {
      planBindings = parsePlanBindings(planContent);
      planGates = parsePlanGates(planContent);
      logger.ok(`Bindings de plan parseados (${planBindings.length} bindings, ${planGates.length} gates).`);
    } catch (e) {
      logger.error(`Error parseando plan.md: ${e.message}`);
      process.exit(1);
    }
  } else {
    logger.error(`plan.md no encontrado en ${planFile}`);
    process.exit(1);
  }

  // 3. Parse TASKS metadata & traceability
  let tasks = [];
  let traceability = {
    summary: {
      tasks_total: 0,
      tasks_with_validation: 0,
      tasks_documentation_only: 0,
      unmapped_canonical_tests: []
    },
    unmappedCanonical: [],
    reverseMap: {}
  };
  if (fs.existsSync(tasksFile)) {
    const tasksContent = fs.readFileSync(tasksFile, 'utf8');
    try {
      tasks = parseTaskMetadata(tasksContent);
      traceability = reconcileTaskTraceability(canonicalMatrix, tasks);
      if (traceability.unmappedCanonical.length === 0) {
        logger.ok(`Trazabilidad TASK <-> TEST confirmada (${tasks.length} tareas totales).`);
      } else {
        logger.warn(`Pruebas canónicas no mapeadas a tareas: ${traceability.unmappedCanonical.join(', ')}`);
      }
    } catch (e) {
      logger.error(`Error parseando tasks.md: ${e.message}`);
      process.exit(1);
    }
  }

  // 4. Execute Test Runner on bound files
  const boundTestFiles = Array.from(new Set(planBindings.map(b => b.file)));
  logger.info(`Ejecutando runner sobre ${boundTestFiles.length} archivo(s) de prueba vinculados...`);

  const startTime = Date.now();
  let runnerResult;
  try {
    runnerResult = await executeNodeTestRunner(targetDir, boundTestFiles);
  } catch (e) {
    logger.error(`Fallo crítico ejecutando test runner: ${e.message}`);
    runnerResult = { exitCode: 1, stdout: '', stderr: e.message };
  }
  const runnerDuration = Date.now() - startTime;

  const tapSummary = parseNodeTestTap(runnerResult.stdout);
  const reconciliation = reconcileTestRun(canonicalMatrix, planBindings, tapSummary.tests);

  logger.ok(`Runner completado (exitCode: ${runnerResult.exitCode}, physical: ${tapSummary.physicalTotal}, passed: ${tapSummary.passed}, failed: ${tapSummary.failed})`);

  // 5. Execute Required & Supplemental Gates
  const requiredGateResults = {};
  const supplementalGateResults = {};
  const blockers = [];
  const warnings = [];

  for (const gate of planGates) {
    logger.info(`Ejecutando gate "${gate.id}" (${gate.type}: ${gate.script})...`);
    if (gate.type === 'PACKAGE_SCRIPT') {
      const gateRes = await executePackageScriptGate(targetDir, gate);
      const passed = gateRes.exitCode === 0;
      const status = passed ? 'PASS' : 'FAIL';

      if (gate.requirement === 'REQUIRED') {
        requiredGateResults[gate.id] = status;
        if (!passed) {
          blockers.push({
            code: 'REQUIRED_GATE_FAILED',
            gate: gate.id,
            message: `Required gate "${gate.id}" failed with exit code ${gateRes.exitCode}`,
            waivable: gate.waivable
          });
        }
      } else {
        supplementalGateResults[gate.id] = status;
        if (!passed) {
          warnings.push({
            code: 'SUPPLEMENTAL_GATE_FAILED',
            gate: gate.id,
            message: `Supplemental gate "${gate.id}" failed with exit code ${gateRes.exitCode}`
          });
        }
      }
    }
  }

  // Check reconciliation anomalies
  if (!reconciliation.mathValid) {
    blockers.push({
      code: 'CLOSURE_RECONCILIATION_FAILURE',
      message: 'Arithmetic count mismatch between executed canonical/supporting events and total physical events'
    });
  }

  for (const m of reconciliation.missing) {
    blockers.push({
      code: 'REQUIRED_TEST_MISSING',
      canonicalId: m,
      message: `Required canonical test "${m}" is missing a physical binding in plan.md`
    });
  }

  for (const ne of reconciliation.notExecuted) {
    blockers.push({
      code: 'REQUIRED_TEST_NOT_EXECUTED',
      canonicalId: ne,
      message: `Required canonical test "${ne}" was bound in plan.md but not executed in test runner`
    });
  }

  for (const ph of reconciliation.phantoms) {
    blockers.push({
      code: 'PHANTOM_TEST',
      canonicalId: ph,
      message: `Claimed test "${ph}" was absent from runner execution traces`
    });
  }

  for (const orp of reconciliation.orphans) {
    blockers.push({
      code: 'ORPHAN_TEST',
      canonicalId: orp,
      message: `Physical test claimed canonical ID "${orp}" which is absent from spec.md matrix`
    });
  }

  for (const dup of reconciliation.duplicates) {
    blockers.push({
      code: 'DUPLICATE_TEST_BINDING',
      canonicalId: dup,
      message: `Multiple physical tests claimed the same canonical ID "${dup}"`
    });
  }

  // Check physical failures
  const executedCanonicalPassed = tapSummary.tests.filter(t => t.id && t.rawOutcome === 'PASS');
  const executedCanonicalFailed = tapSummary.tests.filter(t => t.id && t.rawOutcome === 'FAIL');
  for (const f of executedCanonicalFailed) {
    blockers.push({
      code: 'REQUIRED_TEST_FAILED',
      canonicalId: f.id,
      message: `Required canonical test "${f.id}" failed during execution`
    });
  }

  // Transfer traceability unmapped errors if any
  for (const unmappedId of traceability.unmappedCanonical) {
    blockers.push({
      code: 'UNMAPPED_CANONICAL_TEST',
      canonicalId: unmappedId,
      message: `Required canonical test "${unmappedId}" is not bound to any implementation task`
    });
  }

  // 6. Compute Closure Context Hash & Manifest
  const repoContext = resolveRepositoryContext(targetDir);

  const phaseHashes = {
    spec: hashFile(specFile),
    plan: hashFile(planFile),
    tasks: fs.existsSync(tasksFile) ? hashFile(tasksFile) : null
  };

  const relevantFiles = resolveRelevantFiles(targetDir, activeSpec, planBindings, tasks, planGates);
  const relevantFilesDigest = computeContentAggregateHash(targetDir, relevantFiles);

  const testFilesHash = computeContentAggregateHash(targetDir, boundTestFiles);
  const implementationFiles = Array.from(new Set(tasks.flatMap(t => t.files || [])))
    .filter(f => !f.endsWith('closure.json'));
  const implementationContextHash = computeContentAggregateHash(targetDir, implementationFiles);
  const requiredGateDefinitionHash = computeContentAggregateHash(targetDir, ['package.json']);

  const contextObj = {
    version: 1,
    repository: repoContext,
    phase_hashes: phaseHashes,
    acceptance_signature: acceptanceSignature,
    test_files_hash: testFilesHash,
    implementation_context_hash: implementationContextHash,
    required_gate_definition_hash: requiredGateDefinitionHash
  };

  const closureContextHash = computeClosureContextHash(contextObj);

  // Status determination
  let status = 'VERIFIED';
  if (blockers.length > 0) {
    status = 'BLOCKED';
  }

  const manifestData = {
    feature: activeSpec,
    generated_at: new Date().toISOString(),
    status,
    closure_context: {
      closure_context_hash: closureContextHash,
      repository_type: repoContext.type,
      git_commit: repoContext.commit,
      working_tree_clean: repoContext.working_tree_clean,
      relevant_files_digest: relevantFilesDigest
    },
    acceptance_signature: acceptanceSignature,
    canonical_summary: {
      required_total: canonicalMatrix.filter(c => c.gate === 'REQUIRED').length,
      required_passed: executedCanonicalPassed.length,
      supplemental_total: canonicalMatrix.filter(c => c.gate === 'SUPPLEMENTAL').length,
      supplemental_passed: 0
    },
    physical_summary: {
      supporting_total: reconciliation.supportingCount,
      supporting_passed: reconciliation.supportingCount - (tapSummary.failed - executedCanonicalFailed.length),
      total_executed: tapSummary.physicalTotal,
      total_passed: tapSummary.passed,
      total_failed: tapSummary.failed,
      total_skipped: tapSummary.skipped + tapSummary.todo + tapSummary.cancelled
    },
    reconciliation: {
      math_valid: reconciliation.mathValid,
      phantoms_detected: reconciliation.phantoms.length,
      orphans_detected: reconciliation.orphans.length,
      missing_canonical_ids: reconciliation.missing
    },
    task_traceability_summary: {
      tasks_total: tasks.length,
      tasks_with_validation: traceability.summary.tasks_with_validation,
      tasks_documentation_only: traceability.summary.tasks_documentation_only,
      unmapped_canonical_tests: traceability.unmappedCanonical
    },
    required_gates: requiredGateResults,
    supplemental_gates: supplementalGateResults,
    exceptions: [],
    evidence_sources: [
      {
        type: 'PACKAGE_SCRIPT',
        script: 'test',
        runner: 'node:test',
        exit_code: runnerResult.exitCode,
        duration_ms: runnerDuration
      }
    ],
    blockers,
    warnings
  };

  if (flags.dryRun) {
    logger.info('[DRY RUN] Manifest generado en memoria (no persistido en disco):');
    console.log(JSON.stringify(manifestData, null, 2));
    return manifestData;
  }

  const writtenManifest = generateClosureManifest(specDir, manifestData);
  logger.ok(`Manifest de cierre persistido en: ${path.join(specDir, 'closure.json')} (status: ${status})`);
  return writtenManifest;
};
