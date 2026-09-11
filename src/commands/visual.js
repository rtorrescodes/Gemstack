/**
 * Gemstack Visual QA Command Handler (Upgrade E)
 *
 * Implements "gemstack vqa validate" and "gemstack vqa promote" subcommands.
 * Read-only validation and explicit baseline promotion.
 */

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../lib/logger');
const fssafe = require('../lib/filesystem-safe');
const { readState } = require('../lib/state');
const { validateVisualManifest, promoteVisualBaseline } = require('../lib/visual-qa');

async function visualCommand(args = [], flags = {}) {
  const subcommand = args[0] || 'validate';
  const targetDir = flags.target ? path.resolve(flags.target) : process.cwd();

  let state;
  try {
    state = readState(targetDir);
  } catch (e) {
    logger.error(`Error loading .gemstack/state.json: ${e.message}`);
    process.exit(1);
  }

  const activeSpec = state.active_spec;
  if (!activeSpec) {
    if (flags.json) {
      console.log(JSON.stringify({ status: 'NO_ACTIVE_SPEC', message: 'No active feature spec set.' }));
    } else {
      logger.info('Sin spec activa pendiente. Opera en modo legacy.');
    }
    return;
  }

  if (subcommand === 'validate') {
    const res = validateVisualManifest(targetDir, activeSpec);
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    if (res.state === 'MISSING') {
      logger.info(`[LEGACY] No se detectó visual-qa.json en "${activeSpec}".`);
      return;
    }

    if (res.valid) {
      logger.ok(`Visual QA manifest validado con éxito: ${activeSpec}/visual-qa.json.`);
    } else {
      for (const f of res.findings) {
        logger.error(`[${f.code}] ${f.details}`);
      }
      process.exit(1);
    }
  } else if (subcommand === 'promote') {
    const scenarioId = args[1];
    const liveImagePath = args[2];

    if (!scenarioId || !liveImagePath) {
      logger.error('Usage: gemstack vqa promote <scenario-id> <live-image-path>');
      process.exit(1);
    }

    try {
      const res = promoteVisualBaseline(targetDir, activeSpec, scenarioId, liveImagePath);
      logger.ok(`Baseline promoted for scenario "${scenarioId}". Updated ${activeSpec}/visual-qa.json.`);
      if (flags.json) {
        console.log(JSON.stringify(res, null, 2));
      }
    } catch (err) {
      logger.error(`Failed to promote baseline: ${err.message}`);
      process.exit(1);
    }
  } else {
    logger.error(`Unknown visual subcommand: "${subcommand}". Use "validate" or "promote".`);
    process.exit(1);
  }
}

module.exports = visualCommand;
