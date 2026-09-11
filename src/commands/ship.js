const fs = require('fs');
const path = require('path');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const { readState, writeStateAtomic } = require('../lib/state');
const { extractTestMatrixBlock } = require('../lib/test-matrix');

module.exports = async (flags = {}) => {
  const targetDir = flags.target || process.cwd();
  const state = readState(targetDir);

  if (!state || !state.active_spec) {
    const err = new Error('No active spec found to ship');
    err.code = 'NO_ACTIVE_SPEC';
    throw err;
  }

  const activeSpec = state.active_spec;
  const specDir = fssafe.resolveSafe(targetDir, activeSpec);
  const specFile = path.join(specDir, 'spec.md');

  if (!fs.existsSync(specFile)) {
    const err = new Error(`spec.md not found at ${specFile}`);
    err.code = 'SPEC_NOT_FOUND';
    throw err;
  }

  const specContent = fs.readFileSync(specFile, 'utf8');
  const { matrix, isLegacy } = extractTestMatrixBlock(specContent);

  if (isLegacy) {
    logger.info(`[LEGACY] Spec "${activeSpec}" opera en modo legacy sin matriz de pruebas.`);
    // Transition lifecycle
    state.last_completed_feature = activeSpec;
    state.active_spec = null;
    state.current_phase = 'shipped';
    state.status = 'SHIPPED';
    state.last_update = new Date().toISOString();
    writeStateAtomic(targetDir, state);
    logger.ok(`Feature "${activeSpec}" enviada exitosamente en modo legacy.`);
    return { shipped: true, legacy: true, feature: activeSpec };
  }

  // Structured Upgrade B closure verification
  const closurePath = path.join(specDir, 'closure.json');
  if (!fs.existsSync(closurePath)) {
    const err = new Error(`Cannot ship "${activeSpec}": closure.json not found. Run "gemstack collect" first.`);
    err.code = 'CLOSURE_MANIFEST_MISSING';
    throw err;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(closurePath, 'utf8'));
  } catch (e) {
    const err = new Error(`Failed to parse closure.json: ${e.message}`);
    err.code = 'CLOSURE_MANIFEST_INVALID';
    throw err;
  }

  const allowedStatuses = ['VERIFIED', 'VERIFIED_WITH_EXCEPTIONS'];
  if (!allowedStatuses.includes(manifest.status)) {
    const blockersSummary = (manifest.blockers || []).map(b => b.code || b.message).join(', ');
    const err = new Error(`Cannot ship "${activeSpec}": closure status is "${manifest.status}". Blockers: ${blockersSummary || 'none'}`);
    err.code = 'CLOSURE_NOT_VERIFIED';
    throw err;
  }

  // Transition lifecycle to SHIPPED
  state.last_completed_feature = activeSpec;
  state.active_spec = null;
  state.current_phase = 'shipped';
  state.status = 'SHIPPED';
  state.last_update = new Date().toISOString();
  writeStateAtomic(targetDir, state);

  logger.ok(`Feature "${activeSpec}" verificada mecánicamente y enviada exitosamente (status: ${manifest.status}).`);
  return { shipped: true, legacy: false, feature: activeSpec, status: manifest.status };
};
