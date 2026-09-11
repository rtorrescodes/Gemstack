const fs = require('node:fs');
const path = require('node:path');

/**
 * Reads .gemstack/state.json with legacy fallback defaults.
 * Preserves all unknown existing fields.
 *
 * @param {string} rootPath - Workspace root path
 * @returns {object} State object
 */
function readState(rootPath) {
  const statePath = path.join(rootPath, '.gemstack', 'state.json');
  if (!fs.existsSync(statePath)) {
    return {
      version: '0.1',
      current_phase: null,
      status: null,
      stop_reason: null,
      active_spec: null,
      completed_phases: [],
      phase_hashes: null,
      consistency: null,
      guard_mode: { careful: false, freeze: false, allowed_paths: [] }
    };
  }

  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    const { findings, accepted_exceptions, ...cleanParsed } = parsed;
    return {
      version: cleanParsed.version || '0.1',
      current_phase: cleanParsed.current_phase ?? null,
      status: cleanParsed.status ?? null,
      stop_reason: cleanParsed.stop_reason ?? null,
      active_spec: cleanParsed.active_spec ?? null,
      completed_phases: Array.isArray(cleanParsed.completed_phases) ? cleanParsed.completed_phases : [],
      phase_hashes: cleanParsed.phase_hashes ?? null,
      consistency: cleanParsed.consistency ?? null,
      guard_mode: cleanParsed.guard_mode || { careful: false, freeze: false, allowed_paths: [] },
      ...cleanParsed // preserve any extra operational fields (excluding findings / accepted_exceptions)
    };
  } catch (err) {
    throw new Error(`Failed to parse .gemstack/state.json: ${err.message}`);
  }
}

/**
 * Writes an object atomically to disk by writing to a temporary file in the same directory
 * and renaming it over the destination. Bounded retry for Windows locks.
 *
 * @param {string} filePath - Absolute path to destination file
 * @param {object} data - Object to serialize
 */
function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const serialized = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(tmpPath, serialized, 'utf8');

  // Bounded retry for Windows transient file locks
  let attempts = 0;
  const maxAttempts = 5;
  while (attempts < maxAttempts) {
    try {
      fs.renameSync(tmpPath, filePath);
      return;
    } catch (err) {
      attempts++;
      if (attempts >= maxAttempts) {
        // cleanup tmp
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        throw err;
      }
      // Busy wait short sleep
      const start = Date.now();
      while (Date.now() - start < 20) {}
    }
  }
}

/**
 * Writes .gemstack/state.json atomically.
 * Strips historical findings and accepted_exceptions to enforce persistence boundary.
 *
 * @param {string} rootPath - Workspace root path
 * @param {object} stateObj - State data
 */
function writeStateAtomic(rootPath, stateObj) {
  const statePath = path.join(rootPath, '.gemstack', 'state.json');
  const { findings, accepted_exceptions, ...operationalState } = stateObj;
  writeJsonAtomic(statePath, operationalState);
}

/**
 * Reads feature sidecar .gemstack.json with safe defaults.
 *
 * @param {string} featureDir - Path to specs/<feature>
 * @returns {object} Sidecar data
 */
function readSidecar(featureDir) {
  const sidecarPath = path.join(featureDir, '.gemstack.json');
  if (!fs.existsSync(sidecarPath)) {
    return {
      phase_hashes: {},
      historical_findings: [],
      accepted_exceptions: []
    };
  }
  try {
    const raw = fs.readFileSync(sidecarPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return {
      phase_hashes: {},
      historical_findings: [],
      accepted_exceptions: []
    };
  }
}

/**
 * Writes feature sidecar .gemstack.json atomically.
 *
 * @param {string} featureDir - Path to specs/<feature>
 * @param {object} sidecarObj - Data to write
 */
function writeSidecarAtomic(featureDir, sidecarObj) {
  const sidecarPath = path.join(featureDir, '.gemstack.json');
  writeJsonAtomic(sidecarPath, sidecarObj);
}

module.exports = {
  readState,
  writeStateAtomic,
  readSidecar,
  writeSidecarAtomic,
  writeJsonAtomic
};
