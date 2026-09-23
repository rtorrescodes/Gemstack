'use strict';

const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');
const fssafe = require('../lib/filesystem-safe');
const { loadState } = require('../lib/state');
const { detectSpecConflicts, mergeSpecs } = require('../lib/spec-merge');
const { detectRigorLevel, validateRigorRequirements } = require('../lib/sdd-rigor');
const { validateContractAmendments } = require('../lib/contract-amendments');

async function specCommand(args = [], flags = {}) {
  const targetDir = flags.target ? path.resolve(flags.target) : process.cwd();
  const subCommand = args[0] || 'validate';

  const state = loadState(targetDir);
  if (!state || !state.active_spec) {
    logger.error('No hay una especificación activa configurada en .gemstack/state.json');
    process.exit(1);
  }

  const activeSpecDir = fssafe.resolveSafe(targetDir, state.active_spec);
  const activeSpecFile = path.join(activeSpecDir, 'spec.md');

  if (!fs.existsSync(activeSpecFile)) {
    logger.error(`spec.md no encontrado en ${activeSpecFile}`);
    process.exit(1);
  }

  const activeSpecContent = fs.readFileSync(activeSpecFile, 'utf8');

  switch (subCommand) {
    case 'merge': {
      const targetSpecPath = args[1];
      if (!targetSpecPath) {
        logger.error('Uso: gemstack spec merge <ruta-o-rama-de-spec>');
        process.exit(1);
      }

      const incomingDir = fssafe.resolveSafe(targetDir, targetSpecPath);
      const incomingSpecFile = path.join(incomingDir, 'spec.md');

      if (!fs.existsSync(incomingSpecFile)) {
        logger.error(`spec.md entrante no encontrado en: ${incomingSpecFile}`);
        process.exit(1);
      }

      const incomingContent = fs.readFileSync(incomingSpecFile, 'utf8');
      logger.info(`Comparando especificaciones: "${state.active_spec}" vs "${targetSpecPath}"...`);

      const conflictReport = detectSpecConflicts(activeSpecContent, incomingContent);
      if (!conflictReport.valid) {
        logger.error(`[SPEC_MERGE_CONFLICT] Se detectaron ${conflictReport.conflicts.length} conflicto(s):`);
        for (const c of conflictReport.conflicts) {
          logger.error(`  - [${c.type}] ${c.id}: ${c.reason}`);
        }
        process.exit(1);
      }

      logger.ok('No se detectaron colisiones de contratos ni duplicados de tests canónicos.');
      const merged = mergeSpecs(activeSpecContent, incomingContent);
      logger.ok(`Fusión completada con éxito (${merged.contracts.length} contratos, ${merged.tests.length} tests canónicos).`);
      break;
    }

    case 'validate': {
      const rigor = detectRigorLevel(activeSpecContent);
      logger.info(`Validando especificación "${state.active_spec}" (Rigor: ${rigor})...`);

      const planFile = path.join(activeSpecDir, 'plan.md');
      const tasksFile = path.join(activeSpecDir, 'tasks.md');
      const planContent = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : null;
      const tasksContent = fs.existsSync(tasksFile) ? fs.readFileSync(tasksFile, 'utf8') : null;

      const { extractTestMatrixBlock } = require('../lib/test-matrix');
      const matrixResult = extractTestMatrixBlock(activeSpecContent);
      const testMatrix = !matrixResult.isLegacy ? matrixResult.matrix : [];

      const { readSidecar } = require('../lib/state');
      const sidecar = readSidecar(activeSpecDir);

      const rigorResult = validateRigorRequirements(rigor, {
        specContent: activeSpecContent,
        planContent,
        tasksContent,
        testMatrix,
        sidecar
      });

      if (!rigorResult.valid) {
        logger.error(`[RIGOR_VALIDATION_FAILED] ${rigorResult.code}: ${rigorResult.error}`);
        process.exit(1);
      }

      logger.ok(`Especificación válida bajo rigor "${rigor}".`);
      break;
    }

    default:
      logger.error(`Subcomando desconocido para "gemstack spec": ${subCommand}. Subcomandos disponibles: validate, merge`);
      process.exit(1);
  }
}

module.exports = specCommand;
