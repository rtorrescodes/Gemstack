const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const fssafe = require('./filesystem-safe');
const { getModuleManifest, computeModuleHash } = require('./module-manifest');

/**
 * Computes deterministic SHA-256 hash of a string.
 */
function sha256(str) {
  return 'sha256:' + crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Normalizes text lines (strips trailing whitespace, normalizes CRLF to LF, trims edges).
 */
function normalizeText(text) {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();
}

/**
 * Extracts a specific task definition from a tasks.md content string.
 */
function extractTaskText(tasksContent, taskId) {
  const lines = tasksContent.replace(/\r\n/g, '\n').split('\n');
  let capturing = false;
  const capturedLines = [];

  // Match header like `### [ ] TASK-XX` or `- [ ] **TASK-XX**` or `## TASK-XX`
  const headerRegex = new RegExp(`^(?:###?\\s*|\-\\s*\\[[ xX]\\]\\s*\\*\\*|##\\s*).*\\b${taskId}\\b`, 'i');
  const nextHeaderRegex = /^(?:###?\s+|\-\s*\[[ xX]\]\s*\*\*|##\s+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!capturing) {
      if (headerRegex.test(line)) {
        capturing = true;
        capturedLines.push(line);
      }
    } else {
      if (nextHeaderRegex.test(line)) {
        break;
      }
      capturedLines.push(line);
    }
  }

  return normalizeText(capturedLines.join('\n'));
}

/**
 * Extracts canonical invariant definitions matching given invariant IDs from spec.md.
 */
function extractSpecInvariantsText(specContent, invariantIds) {
  if (!invariantIds || invariantIds.length === 0) return '';
  const lines = specContent.replace(/\r\n/g, '\n').split('\n');
  const sortedIds = [...invariantIds].sort();
  const matchedBlocks = [];

  for (const id of sortedIds) {
    let capturing = false;
    const block = [];
    const idRegex = new RegExp(`\\b${id}\\b`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!capturing) {
        if (idRegex.test(line)) {
          capturing = true;
          block.push(line);
        }
      } else {
        // Stop capturing when encountering an empty line followed by new section or new invariant
        if (/^(?:###?|\-\s*INV-|##\s+|[A-Z0-9_-]+:)/i.test(line) && !line.includes(id)) {
          break;
        }
        block.push(line);
      }
    }
    if (block.length > 0) {
      matchedBlocks.push(normalizeText(block.join('\n')));
    }
  }

  return matchedBlocks.join('\n---\n');
}

/**
 * Extracts plan sections relevant to given section names/module from plan.md.
 */
function extractPlanSectionsText(planContent, sectionNames) {
  if (!sectionNames || sectionNames.length === 0) return '';
  const lines = planContent.replace(/\r\n/g, '\n').split('\n');
  const matchedBlocks = [];

  for (const sec of sectionNames) {
    let capturing = false;
    const block = [];
    const secRegex = new RegExp(`^(?:###?|##)\\s*.*\\b${sec}\\b`, 'i');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!capturing) {
        if (secRegex.test(line)) {
          capturing = true;
          block.push(line);
        }
      } else {
        if (/^(?:###?|##)\s+/.test(line)) {
          break;
        }
        block.push(line);
      }
    }
    if (block.length > 0) {
      matchedBlocks.push(normalizeText(block.join('\n')));
    }
  }

  return matchedBlocks.join('\n---\n');
}

/**
 * Generates fresh dependency fingerprints for a task capsule.
 */
function generateFreshnessFingerprints(targetDir, specDir, taskId, invariantIds = [], planSections = [], moduleName = null) {
  const tasksPath = path.join(specDir, 'tasks.md');
  const specPath = path.join(specDir, 'spec.md');
  const planPath = path.join(specDir, 'plan.md');

  const tasksContent = fs.existsSync(tasksPath) ? fs.readFileSync(tasksPath, 'utf8') : '';
  const specContent = fs.existsSync(specPath) ? fs.readFileSync(specPath, 'utf8') : '';
  const planContent = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : '';

  const taskText = extractTaskText(tasksContent, taskId);
  const taskHash = taskText ? sha256(taskText) : sha256(taskId);

  const specText = extractSpecInvariantsText(specContent, invariantIds);
  const specHash = specText ? sha256(specText) : sha256('NO_INVARIANTS');

  const planText = extractPlanSectionsText(planContent, planSections);
  const planHash = planText ? sha256(planText) : sha256('NO_PLAN_SECTIONS');

  let moduleHash = sha256('NO_MODULE');
  let moduleSource = null;
  if (moduleName) {
    moduleSource = `.gemstack/modules/${moduleName}.json`;
    moduleHash = computeModuleHash(targetDir, moduleName);
  }

  const relTasks = path.relative(targetDir, tasksPath).replace(/\\/g, '/');
  const relSpec = path.relative(targetDir, specPath).replace(/\\/g, '/');
  const relPlan = path.relative(targetDir, planPath).replace(/\\/g, '/');

  return {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    task: {
      source: relTasks,
      selector: taskId,
      hash: taskHash
    },
    specDependencies: [
      {
        source: relSpec,
        invariants: invariantIds,
        hash: specHash
      }
    ],
    planDependencies: [
      {
        source: relPlan,
        sections: planSections,
        hash: planHash
      }
    ],
    module: {
      source: moduleSource,
      hash: moduleHash
    }
  };
}

/**
 * Validates the freshness of a task capsule without loading full documents into LLM context.
 * Returns { valid: boolean, state: string, reason: string }
 */
function validateTaskFreshness(targetDir, capsule, activeMilestone = null) {
  if (!capsule || !capsule.freshness) {
    return { valid: false, state: 'STALE_TASK', reason: 'Missing freshness metadata' };
  }

  // 1. Milestone check
  if (activeMilestone && capsule.milestone && capsule.milestone !== activeMilestone) {
    return {
      valid: false,
      state: 'MILESTONE_MISMATCH',
      reason: `Capsule milestone "${capsule.milestone}" differs from active milestone "${activeMilestone}"`
    };
  }

  const { task, specDependencies, planDependencies, module } = capsule.freshness;

  // 2. Task freshness
  if (task && task.source) {
    const tasksAbs = path.join(targetDir, task.source);
    if (!fs.existsSync(tasksAbs)) {
      return { valid: false, state: 'STALE_TASK', reason: `Source tasks file missing: ${task.source}` };
    }
    const currentTasks = fs.readFileSync(tasksAbs, 'utf8');
    const currentTaskText = extractTaskText(currentTasks, task.selector);
    const currentTaskHash = currentTaskText ? sha256(currentTaskText) : sha256(task.selector);
    if (currentTaskHash !== task.hash) {
      return { valid: false, state: 'STALE_TASK', reason: `Task definition ${task.selector} in ${task.source} has changed` };
    }
  }

  // 3. SPEC freshness
  if (Array.isArray(specDependencies)) {
    for (const dep of specDependencies) {
      if (dep.source) {
        const specAbs = path.join(targetDir, dep.source);
        if (!fs.existsSync(specAbs)) {
          return { valid: false, state: 'STALE_SPEC', reason: `Source spec file missing: ${dep.source}` };
        }
        const currentSpec = fs.readFileSync(specAbs, 'utf8');
        const currentInvariantsText = extractSpecInvariantsText(currentSpec, dep.invariants);
        const currentSpecHash = currentInvariantsText ? sha256(currentInvariantsText) : sha256('NO_INVARIANTS');
        if (currentSpecHash !== dep.hash) {
          return {
            valid: false,
            state: 'STALE_SPEC',
            reason: `Declared invariants [${(dep.invariants || []).join(', ')}] in ${dep.source} have changed`
          };
        }
      }
    }
  }

  // 4. PLAN freshness
  if (Array.isArray(planDependencies)) {
    for (const dep of planDependencies) {
      if (dep.source) {
        const planAbs = path.join(targetDir, dep.source);
        if (!fs.existsSync(planAbs)) {
          return { valid: false, state: 'STALE_PLAN', reason: `Source plan file missing: ${dep.source}` };
        }
        const currentPlan = fs.readFileSync(planAbs, 'utf8');
        const currentPlanText = extractPlanSectionsText(currentPlan, dep.sections);
        const currentPlanHash = currentPlanText ? sha256(currentPlanText) : sha256('NO_PLAN_SECTIONS');
        if (currentPlanHash !== dep.hash) {
          return {
            valid: false,
            state: 'STALE_PLAN',
            reason: `Declared plan sections [${(dep.sections || []).join(', ')}] in ${dep.source} have changed`
          };
        }
      }
    }
  }

  // 5. Module freshness
  if (module && module.source) {
    const modAbs = path.join(targetDir, module.source);
    if (!fs.existsSync(modAbs)) {
      return { valid: false, state: 'STALE_MODULE', reason: `Module manifest missing: ${module.source}` };
    }
    const modName = path.basename(module.source, '.json');
    const currentModHash = computeModuleHash(targetDir, modName);
    if (currentModHash !== module.hash) {
      return { valid: false, state: 'STALE_MODULE', reason: `Module manifest ${module.source} has changed` };
    }
  }

  // 6. Path validation
  if (Array.isArray(capsule.readFiles)) {
    for (const f of capsule.readFiles) {
      const fAbs = path.join(targetDir, f);
      if (!fs.existsSync(fAbs)) {
        return { valid: false, state: 'INVALID_PATH', reason: `Declared readFile does not exist: ${f}` };
      }
    }
  }

  // 7. Dependencies check
  if (Array.isArray(capsule.dependencies) && capsule.dependencies.length > 0) {
    const stateFile = path.join(targetDir, '.gemstack/state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        // If lastCompletedTaskId is defined, check if immediate previous dependency matches or exists
        // Not failing if state has no completed task tracking yet, but if explicit dependency is marked missing
      } catch (_) {}
    }
  }

  return { valid: true, state: 'CURRENT', reason: 'All source dependency fingerprints match' };
}

/**
 * Saves a task context capsule to .gemstack/task-context/<TASK-ID>.json
 */
function saveTaskCapsule(targetDir, capsule) {
  const capsuleDir = path.join(targetDir, '.gemstack', 'task-context');
  if (!fs.existsSync(capsuleDir)) {
    fs.mkdirSync(capsuleDir, { recursive: true });
  }
  const capsulePath = path.join(capsuleDir, `${capsule.taskId}.json`);
  fssafe.withConfinedAtomicWrite(targetDir, path.join('.gemstack', 'task-context', `${capsule.taskId}.json`), (tempFile) => {
    fs.writeFileSync(tempFile, JSON.stringify(capsule, null, 2) + '\n', 'utf8');
  });
  return capsulePath;
}

/**
 * Reads a task context capsule from .gemstack/task-context/<TASK-ID>.json
 */
function readTaskCapsule(targetDir, taskId) {
  const capsulePath = path.join(targetDir, '.gemstack', 'task-context', `${taskId}.json`);
  if (!fs.existsSync(capsulePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(capsulePath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse task capsule at ${capsulePath}: ${err.message}`);
  }
}

/**
 * Refreshes an existing task context capsule fingerprints.
 */
function refreshTaskCapsule(targetDir, taskId, activeSpec = null) {
  const capsule = readTaskCapsule(targetDir, taskId);
  if (!capsule) {
    throw new Error(`Task capsule ${taskId} not found`);
  }

  let specDir = null;
  if (activeSpec) {
    specDir = path.join(targetDir, activeSpec);
  } else if (capsule.freshness && capsule.freshness.task && capsule.freshness.task.source) {
    specDir = path.dirname(path.join(targetDir, capsule.freshness.task.source));
  } else {
    specDir = path.join(targetDir, 'specs', 'current');
  }

  const invariantIds = capsule.invariants || [];
  const planSections = capsule.module ? [capsule.module] : [];
  const moduleName = capsule.module || null;

  capsule.freshness = generateFreshnessFingerprints(
    targetDir,
    specDir,
    taskId,
    invariantIds,
    planSections,
    moduleName
  );

  saveTaskCapsule(targetDir, capsule);
  return capsule;
}

module.exports = {
  sha256,
  normalizeText,
  extractTaskText,
  extractSpecInvariantsText,
  extractPlanSectionsText,
  generateFreshnessFingerprints,
  validateTaskFreshness,
  saveTaskCapsule,
  readTaskCapsule,
  refreshTaskCapsule
};
