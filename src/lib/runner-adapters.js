const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { writeJsonAtomic } = require('./state');

/**
 * Spawns node:test runner safely with explicit argv and shell: false.
 *
 * @param {string} rootPath
 * @param {Array<string>} testFiles
 * @param {object} options
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string, durationMs: number }>}
 */
function executeNodeTestRunner(rootPath, testFiles, options = {}) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const args = ['--test', '--test-reporter=tap', ...(testFiles || [])];

    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_TEST_CONTEXT;
    delete cleanEnv.NODE_TEST_WORKER_ID;

    const child = spawn(process.execPath, args, {
      cwd: rootPath,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({
        exitCode: 1,
        stdout,
        stderr: err.message,
        durationMs: Date.now() - startTime
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        exitCode: exitCode === null ? 1 : exitCode,
        stdout,
        stderr,
        durationMs: Date.now() - startTime
      });
    });
  });
}

/**
 * Parses node:test TAP output to extract physical counts and test events.
 *
 * @param {string} tapOutput
 * @returns {{ physicalTotal: number, passed: number, failed: number, skipped: number, todo: number, cancelled: number, tests: Array<object> }}
 */
function parseNodeTestTap(tapOutput) {
  const lines = (tapOutput || '').split('\n');
  const tests = [];
  const suites = [];
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let todo = 0;
  let cancelled = 0;

  const idRegex = /\b(TEST-[A-Z0-9]+-[A-Z0-9]+)\b/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // TAP test line format: ok 1 - title # duration_ms
    // or: not ok 2 - title # duration_ms
    if (trimmed.startsWith('ok ') || trimmed.startsWith('not ok ')) {
      const isNotOk = trimmed.startsWith('not ok ');
      const rest = isNotOk ? trimmed.slice(7) : trimmed.slice(3);

      // Remove test number: "1 - title..."
      const numMatch = rest.match(/^\d+\s*-\s*(.*)/);
      const titleAndDirectives = numMatch ? numMatch[1] : rest;

      // Lookahead in YAML diagnostic block for "type: 'suite'" vs "type: 'test'"
      let eventType = null;
      let durationMs = 0;

      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        const nextTrimmed = lines[j].trim();
        if (nextTrimmed === '...') break;
        if (nextTrimmed.startsWith('ok ') || nextTrimmed.startsWith('not ok ')) break;

        const typeMatch = nextTrimmed.match(/^type:\s*['"]?([a-zA-Z0-9_-]+)['"]?/i);
        if (typeMatch) {
          eventType = typeMatch[1].toLowerCase();
        }

        const durMatch = nextTrimmed.match(/^duration_ms:\s*([\d.]+)/i);
        if (durMatch) {
          durationMs = parseFloat(durMatch[1]);
        }
      }

      // Check inline duration if not in YAML
      if (!durationMs) {
        const durMatchInline = titleAndDirectives.match(/duration_ms\s*[:=]\s*([\d.]+)/i) ||
                               titleAndDirectives.match(/time=([\d.]+)ms/i);
        if (durMatchInline) durationMs = parseFloat(durMatchInline[1]);
      }

      // If explicit suite container event in TAP, classify as SUITE and exclude from physical tests
      if (eventType === 'suite') {
        suites.push({
          kind: 'SUITE',
          title: titleAndDirectives.split('#')[0].trim(),
          durationMs
        });
        continue;
      }

      let rawOutcome = isNotOk ? 'FAIL' : 'PASS';

      if (/#\s*SKIP\b/i.test(titleAndDirectives)) {
        rawOutcome = 'SKIP';
      } else if (/#\s*TODO\b/i.test(titleAndDirectives)) {
        rawOutcome = 'TODO';
      } else if (/#\s*CANCELLED\b/i.test(titleAndDirectives)) {
        rawOutcome = 'CANCELLED';
      }

      const idMatch = titleAndDirectives.match(idRegex);
      const canonicalId = idMatch ? idMatch[1] : null;

      if (rawOutcome === 'PASS') passed++;
      else if (rawOutcome === 'FAIL') failed++;
      else if (rawOutcome === 'SKIP') skipped++;
      else if (rawOutcome === 'TODO') todo++;
      else if (rawOutcome === 'CANCELLED') cancelled++;

      tests.push({
        kind: 'TEST',
        id: canonicalId,
        title: titleAndDirectives.split('#')[0].trim(),
        rawOutcome,
        durationMs,
        isSupporting: canonicalId === null
      });
    }
  }

  const physicalTotal = passed + failed + skipped + todo + cancelled;

  return {
    physicalTotal,
    passed,
    failed,
    skipped,
    todo,
    cancelled,
    tests,
    suites
  };
}

/**
 * Reconciles canonical acceptance requirements with runner execution traces.
 *
 * @param {Array<object>} canonicalMatrix
 * @param {Array<object>} planBindings
 * @param {Array<object>} executedEvents
 * @returns {object}
 */
function reconcileTestRun(canonicalMatrix, planBindings, executedEvents) {
  const boundCanonicalIds = new Set((planBindings || []).map(b => b.test_id));
  const expectedRequired = (canonicalMatrix || []).filter(m => m.gate === 'REQUIRED');
  const validCanonicalIds = new Set((canonicalMatrix || []).map(m => m.id));

  const executedCanonical = [];
  const executedSupporting = [];
  const executedIdCounts = {};

  for (const ev of (executedEvents || [])) {
    if (ev.id) {
      executedCanonical.push(ev);
      executedIdCounts[ev.id] = (executedIdCounts[ev.id] || 0) + 1;
    } else {
      executedSupporting.push(ev);
    }
  }

  // 1. Check duplicate physical execution identities
  const duplicates = Object.keys(executedIdCounts).filter(id => executedIdCounts[id] > 1);

  // 2. Check orphans (physical test claimed canonical ID absent from SPEC)
  const orphans = Object.keys(executedIdCounts).filter(id => !validCanonicalIds.has(id));

  // 3. Check missing vs not executed
  const executedIdSet = new Set(Object.keys(executedIdCounts));
  const missing = [];
  const notExecuted = [];

  for (const req of expectedRequired) {
    if (!boundCanonicalIds.has(req.id)) {
      missing.push(req.id);
    } else if (!executedIdSet.has(req.id)) {
      notExecuted.push(req.id);
    }
  }

  // 4. Check phantoms (phantom test: claimed executed/pass but absent from runner events)
  const phantoms = [];

  // 5. Arithmetic equation validation
  const canonicalCount = executedCanonical.length;
  const supportingCount = executedSupporting.length;
  const totalPhysical = executedEvents.length;

  const mathValid = (canonicalCount + supportingCount === totalPhysical);

  return {
    mathValid,
    totalPhysical,
    canonicalCount,
    supportingCount,
    duplicates,
    orphans,
    missing,
    notExecuted,
    phantoms
  };
}

/**
 * Executes a PACKAGE_SCRIPT gate safely without shell: true.
 *
 * @param {string} rootPath
 * @param {object} gateConfig
 * @returns {Promise<{ exitCode: number, stdout: string, stderr: string }>}
 */
function executePackageScriptGate(rootPath, gateConfig) {
  return new Promise((resolve) => {
    const pkgPath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      const err = new Error('package.json not found for PACKAGE_SCRIPT gate');
      err.code = 'REQUIRED_GATE_MISSING';
      return resolve({ exitCode: 1, stdout: '', stderr: err.message, error: err });
    }

    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      const err = new Error('Failed to parse package.json: ' + e.message);
      err.code = 'REQUIRED_GATE_MISSING';
      return resolve({ exitCode: 1, stdout: '', stderr: err.message, error: err });
    }

    if (!pkg.scripts || !pkg.scripts[gateConfig.script]) {
      const err = new Error('Script "' + gateConfig.script + '" not found in package.json');
      err.code = 'REQUIRED_GATE_MISSING';
      return resolve({ exitCode: 1, stdout: '', stderr: err.message, error: err });
    }

    const cleanEnv = { ...process.env };
    delete cleanEnv.NODE_TEST_CONTEXT;
    delete cleanEnv.NODE_TEST_WORKER_ID;

    let execBinary = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    let execArgs = ['run', gateConfig.script];

    // On Windows, node.js spawn('npm.cmd', ..., { shell: false }) triggers EINVAL in node 22+ unless .cmd is spawned via cmd /c or direct npm-cli.js
    if (process.platform === 'win32') {
      const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
      if (fs.existsSync(npmCli)) {
        execBinary = process.execPath;
        execArgs = [npmCli, 'run', gateConfig.script];
      }
    }

    const child = spawn(execBinary, execArgs, {
      cwd: rootPath,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: cleanEnv
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      resolve({ exitCode: 1, stdout, stderr: err.message, error: err });
    });

    child.on('close', (exitCode) => {
      resolve({ exitCode: exitCode === null ? 1 : exitCode, stdout, stderr });
    });
  });
}

/**
 * Assembles and atomically writes the feature-local closure.json manifest.
 *
 * @param {string} targetDir
 * @param {object} manifestData
 * @returns {object} Written manifest
 */
function generateClosureManifest(targetDir, manifestData) {
  const closurePath = path.join(targetDir, 'closure.json');

  const manifest = {
    schema: 'gemstack-closure',
    version: 1,
    feature: manifestData.feature,
    generated_at: manifestData.generated_at || new Date().toISOString(),
    status: manifestData.status,
    closure_context: manifestData.closure_context,
    acceptance_signature: manifestData.acceptance_signature,
    canonical_summary: manifestData.canonical_summary,
    physical_summary: manifestData.physical_summary,
    reconciliation: manifestData.reconciliation,
    task_traceability_summary: manifestData.task_traceability_summary,
    required_gates: manifestData.required_gates || {},
    supplemental_gates: manifestData.supplemental_gates || {},
    exceptions: manifestData.exceptions || [],
    evidence_sources: manifestData.evidence_sources || [],
    blockers: manifestData.blockers || [],
    warnings: manifestData.warnings || []
  };

  writeJsonAtomic(closurePath, manifest);
  return manifest;
}

module.exports = {
  executeNodeTestRunner,
  parseNodeTestTap,
  reconcileTestRun,
  executePackageScriptGate,
  generateClosureManifest
};
