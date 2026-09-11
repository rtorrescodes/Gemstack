const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { hashFile, normalizePath, normalizeContent } = require('./hasher');

function parsePlanBindings(planContent, canonicalMatrix) {
  const normalized = normalizeContent(planContent);
  const lines = normalized.split('\n');
  const fence = String.fromCharCode(96, 96, 96);
  const header = fence + 'gemstack-test-bindings';

  const blocks = [];
  let inBlock = false;
  let blockLines = [];

  for (const line of lines) {
    if (!inBlock) {
      if (line.trimEnd() === header) {
        inBlock = true;
        blockLines = [];
      }
    } else {
      if (line.trimEnd() === fence) {
        inBlock = false;
        blocks.push(blockLines.join('\n'));
      } else {
        blockLines.push(line);
      }
    }
  }

  if (blocks.length === 0) {
    return [];
  }

  if (blocks.length > 1) {
    const err = new Error('Multiple gemstack-test-bindings blocks detected. Exactly one is permitted.');
    err.code = 'BINDINGS_PARSE_ERROR';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(blocks[0].trim());
  } catch (e) {
    const err = new Error('Failed to parse gemstack-test-bindings JSON: ' + e.message);
    err.code = 'BINDINGS_PARSE_ERROR';
    throw err;
  }

  if (!Array.isArray(parsed)) {
    const err = new Error('gemstack-test-bindings must be a JSON array');
    err.code = 'BINDINGS_PARSE_ERROR';
    throw err;
  }

  const validCanonicalIds = new Set(canonicalMatrix ? canonicalMatrix.map(m => m.id) : []);
  const seenTestIds = new Set();
  const validated = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item || typeof item !== 'object') {
      const err = new Error('Binding at index ' + i + ' must be an object');
      err.code = 'BINDINGS_PARSE_ERROR';
      throw err;
    }

    const testId = item.test_id || item.id;
    if (!testId || typeof testId !== 'string') {
      const err = new Error('Binding at index ' + i + ' missing test_id');
      err.code = 'BINDINGS_PARSE_ERROR';
      throw err;
    }

    if (validCanonicalIds.size > 0 && !validCanonicalIds.has(testId)) {
      const err = new Error('Binding references unknown canonical ID: "' + testId + '"');
      err.code = 'BINDINGS_PARSE_ERROR';
      throw err;
    }

    if (seenTestIds.has(testId)) {
      const err = new Error('Duplicate test_id binding detected: "' + testId + '"');
      err.code = 'DUPLICATE_TEST_BINDING';
      throw err;
    }
    seenTestIds.add(testId);

    if (!item.file || typeof item.file !== 'string') {
      const err = new Error('Binding for "' + testId + '" missing file');
      err.code = 'BINDINGS_PARSE_ERROR';
      throw err;
    }

    const normFile = item.file.replace(/\\/g, '/');
    if (path.isAbsolute(normFile) || normFile.startsWith('../')) {
      const err = new Error('Binding file must be repository-relative POSIX path: "' + item.file + '"');
      err.code = 'BINDINGS_PARSE_ERROR';
      throw err;
    }

    validated.push({
      test_id: testId,
      runner: item.runner || 'node:test',
      file: normFile
    });
  }

  return validated;
}

function parsePlanGates(planContent) {
  const normalized = normalizeContent(planContent);
  const lines = normalized.split('\n');
  const fence = String.fromCharCode(96, 96, 96);
  const header = fence + 'gemstack-closure-gates';

  const blocks = [];
  let inBlock = false;
  let blockLines = [];

  for (const line of lines) {
    if (!inBlock) {
      if (line.trimEnd() === header) {
        inBlock = true;
        blockLines = [];
      }
    } else {
      if (line.trimEnd() === fence) {
        inBlock = false;
        blocks.push(blockLines.join('\n'));
      } else {
        blockLines.push(line);
      }
    }
  }

  if (blocks.length === 0) {
    return [];
  }

  if (blocks.length > 1) {
    const err = new Error('Multiple gemstack-closure-gates blocks detected. Exactly one is permitted.');
    err.code = 'GATES_PARSE_ERROR';
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(blocks[0].trim());
  } catch (e) {
    const err = new Error('Failed to parse gemstack-closure-gates JSON: ' + e.message);
    err.code = 'GATES_PARSE_ERROR';
    throw err;
  }

  if (!Array.isArray(parsed)) {
    const err = new Error('gemstack-closure-gates must be a JSON array');
    err.code = 'GATES_PARSE_ERROR';
    throw err;
  }

  const seenGateIds = new Set();
  const validated = [];

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i];
    if (!item.id || typeof item.id !== 'string') {
      const err = new Error('Gate at index ' + i + ' missing id');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }

    if (seenGateIds.has(item.id)) {
      const err = new Error('Duplicate gate id detected: "' + item.id + '"');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }
    seenGateIds.add(item.id);

    if (item.type !== 'PACKAGE_SCRIPT') {
      const err = new Error('Unsupported gate type: "' + item.type + '". Only PACKAGE_SCRIPT is supported in MVP.');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }

    if (!item.script || typeof item.script !== 'string') {
      const err = new Error('PACKAGE_SCRIPT gate "' + item.id + '" missing script name');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }

    if (!['REQUIRED', 'SUPPLEMENTAL'].includes(item.requirement)) {
      const err = new Error('Gate "' + item.id + '" has invalid requirement: "' + item.requirement + '"');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }

    if (item.requirement === 'REQUIRED' && typeof item.waivable !== 'boolean') {
      const err = new Error('REQUIRED gate "' + item.id + '" requires explicit boolean waivable property');
      err.code = 'GATES_PARSE_ERROR';
      throw err;
    }

    validated.push({
      id: item.id,
      type: item.type,
      script: item.script,
      requirement: item.requirement,
      waivable: typeof item.waivable === 'boolean' ? item.waivable : false
    });
  }

  return validated;
}

function parseTaskMetadata(tasksContent) {
  const normalized = normalizeContent(tasksContent);
  const lines = normalized.split('\n');
  const tasks = [];

  const taskHeaderRegex = /^[*-]\s+\[[ xX]\]\s+\*\*([A-Za-z0-9_-]+):\s*(.*?)\*\*/;
  let currentTask = null;

  for (const line of lines) {
    const match = line.match(taskHeaderRegex);
    if (match) {
      if (currentTask) {
        tasks.push(currentTask);
      }
      currentTask = {
        id: match[1],
        title: match[2].trim(),
        validation_required: null,
        tests: [],
        files: [],
        depends: []
      };
      continue;
    }

    if (currentTask) {
      const vMatch = line.match(/<!--\s*gemstack:validation_required=(true|false)\s*-->/);
      if (vMatch) {
        currentTask.validation_required = vMatch[1] === 'true';
        continue;
      }
      const tMatch = line.match(/<!--\s*gemstack:tests=(.*?)\s*-->/);
      if (tMatch) {
        currentTask.tests = tMatch[1] ? tMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
        continue;
      }
      const fMatch = line.match(/<!--\s*gemstack:files=(.*?)\s*-->/);
      if (fMatch) {
        currentTask.files = fMatch[1] ? fMatch[1].split(',').map(s => s.trim().replace(/\\/g, '/')).filter(Boolean) : [];
        continue;
      }
      const dMatch = line.match(/<!--\s*gemstack:depends=(.*?)\s*-->/);
      if (dMatch) {
        currentTask.depends = dMatch[1] ? dMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];
        continue;
      }
    }
  }

  if (currentTask) {
    tasks.push(currentTask);
  }

  for (const t of tasks) {
    if (t.validation_required === null) {
      const err = new Error('Task ' + t.id + ' must explicitly declare validation_required');
      err.code = 'TASK_VALIDATION_MISSING';
      throw err;
    }
    if (t.validation_required && t.tests.length === 0) {
      const err = new Error('Task ' + t.id + ' has validation_required=true but specifies no tests');
      err.code = 'TASK_VALIDATION_MISSING';
      throw err;
    }
  }

  return tasks;
}

function reconcileTaskTraceability(canonicalMatrix, taskList) {
  const reverseMap = {};
  const tasksWithValidation = [];
  const tasksDocOnly = [];

  for (const t of taskList) {
    if (t.validation_required) {
      tasksWithValidation.push(t.id);
      for (const testId of t.tests) {
        if (!reverseMap[testId]) {
          reverseMap[testId] = [];
        }
        reverseMap[testId].push(t.id);
      }
    } else {
      tasksDocOnly.push(t.id);
    }
  }

  const unmappedCanonical = [];
  const requiredCanonical = canonicalMatrix.filter(m => m.gate === 'REQUIRED');

  for (const c of requiredCanonical) {
    if (!reverseMap[c.id] || reverseMap[c.id].length === 0) {
      unmappedCanonical.push(c.id);
    }
  }

  const summary = {
    tasks_total: taskList.length,
    tasks_with_validation: tasksWithValidation.length,
    tasks_documentation_only: tasksDocOnly.length,
    unmapped_canonical_tests: unmappedCanonical
  };

  return { summary, unmappedCanonical, reverseMap };
}

function resolveRelevantFiles(rootPath, featureDir, planBindings, taskList, planGates) {
  const relFeature = normalizePath(featureDir, rootPath);
  const filesSet = new Set();

  const specPath = (relFeature + '/spec.md').replace(/^\.\//, '');
  const planPath = (relFeature + '/plan.md').replace(/^\.\//, '');
  const tasksPath = (relFeature + '/tasks.md').replace(/^\.\//, '');

  if (fs.existsSync(path.join(rootPath, specPath))) filesSet.add(specPath);
  if (fs.existsSync(path.join(rootPath, planPath))) filesSet.add(planPath);
  if (fs.existsSync(path.join(rootPath, tasksPath))) filesSet.add(tasksPath);

  const featureLedger = (relFeature + '/cost-ledger.json').replace(/^\.\//, '');
  if (fs.existsSync(path.join(rootPath, featureLedger))) filesSet.add(featureLedger);
  if (fs.existsSync(path.join(rootPath, 'cost-ledger.json'))) filesSet.add('cost-ledger.json');
  if (fs.existsSync(path.join(rootPath, '.gemstack/cost-ledger.json'))) filesSet.add('.gemstack/cost-ledger.json');

  const featureCapsule = (relFeature + '/context-capsule.json').replace(/^\.\//, '');
  if (fs.existsSync(path.join(rootPath, featureCapsule))) filesSet.add(featureCapsule);
  if (fs.existsSync(path.join(rootPath, '.gemstack/context-capsule.json'))) filesSet.add('.gemstack/context-capsule.json');

  const featureSwarm = (relFeature + '/swarm.json').replace(/^\.\//, '');
  if (fs.existsSync(path.join(rootPath, featureSwarm))) filesSet.add(featureSwarm);
  if (fs.existsSync(path.join(rootPath, '.gemstack/swarm.json'))) filesSet.add('.gemstack/swarm.json');

  const featureVqa = (relFeature + '/visual-qa.json').replace(/^\.\//, '');
  if (fs.existsSync(path.join(rootPath, featureVqa))) filesSet.add(featureVqa);
  if (fs.existsSync(path.join(rootPath, '.gemstack/visual-qa.json'))) filesSet.add('.gemstack/visual-qa.json');

  for (const b of (planBindings || [])) {
    if (b.file && fs.existsSync(path.join(rootPath, b.file))) {
      filesSet.add(b.file);
    }
  }

  for (const t of (taskList || [])) {
    for (const f of (t.files || [])) {
      if (fs.existsSync(path.join(rootPath, f))) {
        filesSet.add(f);
      }
    }
  }

  const hasPkgScript = (planGates || []).some(g => g.type === 'PACKAGE_SCRIPT');
  if (hasPkgScript && fs.existsSync(path.join(rootPath, 'package.json'))) {
    filesSet.add('package.json');
  }

  return Array.from(filesSet).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
}

function computeContentAggregateHash(rootPath, filePaths) {
  const sortedPaths = [...filePaths].sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  const entries = [];

  for (const p of sortedPaths) {
    const abs = path.join(rootPath, p);
    if (fs.existsSync(abs)) {
      entries.push({
        path: p.replace(/\\/g, '/'),
        hash: hashFile(abs)
      });
    }
  }

  const canonicalJson = JSON.stringify(entries);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

function resolveRepositoryContext(rootPath) {
  const gitDir = path.join(rootPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      type: 'non-git',
      commit: null,
      working_tree_clean: null
    };
  }

  try {
    const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: rootPath,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();

    const statusOutput = execFileSync('git', ['status', '--porcelain'], {
      cwd: rootPath,
      stdio: ['ignore', 'pipe', 'ignore'],
      encoding: 'utf8'
    }).trim();

    return {
      type: 'git',
      commit: headCommit,
      working_tree_clean: statusOutput.length === 0
    };
  } catch (e) {
    return {
      type: 'git',
      commit: null,
      working_tree_clean: null
    };
  }
}

function computeClosureContextHash(contextObj) {
  const sortedKeys = Object.keys(contextObj).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
  const normalized = {};

  for (const k of sortedKeys) {
    const val = contextObj[k];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const subKeys = Object.keys(val).sort((a, b) => (a < b ? -1 : (a > b ? 1 : 0)));
      normalized[k] = {};
      for (const sk of subKeys) {
        normalized[k][sk] = val[sk];
      }
    } else {
      normalized[k] = val;
    }
  }

  const canonicalJson = JSON.stringify(normalized);
  return crypto.createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

module.exports = {
  parsePlanBindings,
  parsePlanGates,
  parseTaskMetadata,
  reconcileTaskTraceability,
  resolveRelevantFiles,
  computeContentAggregateHash,
  resolveRepositoryContext,
  computeClosureContextHash
};
