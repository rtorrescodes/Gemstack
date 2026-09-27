const fs = require('node:fs');
const path = require('node:path');
const logger = require('../lib/logger');
const fssafe = require('../lib/filesystem-safe');
const {
  generateContextCapsule,
  validateContextCapsule
} = require('../lib/context-capsule');
const {
  readTaskCapsule,
  saveTaskCapsule,
  refreshTaskCapsule,
  validateTaskFreshness
} = require('../lib/task-capsule');
const {
  getModuleManifest,
  validateModuleDrift
} = require('../lib/module-manifest');
const {
  computeTaskContextUsage
} = require('../lib/context-budget');
const {
  readState
} = require('../lib/state');

async function contextCommand(args = [], flags = {}) {
  const targetDir = flags.target ? path.resolve(flags.target) : process.cwd();
  const firstArg = args[0];

  // If firstArg matches TASK-*, or --refresh is used with a task ID, handle task context
  if (firstArg && (firstArg.startsWith('TASK-') || flags.refresh || firstArg === 'task')) {
    const taskId = firstArg.startsWith('TASK-') ? firstArg : (args[1] || flags.task);
    if (!taskId) {
      logger.error('No taskId specified for task context.');
      process.exit(1);
    }

    if (flags.refresh || args.includes('--refresh')) {
      logger.info(`Refreshing task context capsule for ${taskId}...`);
      try {
        const refreshed = refreshTaskCapsule(targetDir, taskId);
        logger.ok(`[OK] Task capsule refreshed: ${taskId} is now updated.`);
        return;
      } catch (err) {
        logger.error(`Failed to refresh task capsule: ${err.message}`);
        process.exit(1);
      }
    }

    const capsule = readTaskCapsule(targetDir, taskId);
    if (!capsule) {
      logger.error(`Task capsule not found for: ${taskId} under .gemstack/task-context/`);
      process.exit(1);
    }

    const state = readState(targetDir);
    const freshness = validateTaskFreshness(targetDir, capsule, state.activeMilestone);

    // Compute context usage
    const filesToRead = [...(capsule.readFiles || []), ...(capsule.writeFiles || [])];
    const usage = computeTaskContextUsage(targetDir, filesToRead);

    if (flags.json) {
      console.log(JSON.stringify({ capsule, freshness, contextUsage: usage }, null, 2));
      return;
    }

    console.log(`=== Gemstack Task Context: ${capsule.taskId} ===`);
    console.log(`Milestone:        ${capsule.milestone || 'N/A'}`);
    console.log(`Phase:            ${capsule.phase || 'implementation'}`);
    console.log(`Module:           ${capsule.module || 'N/A'}`);
    console.log(`Objective:        ${capsule.objective || 'N/A'}`);
    console.log(`Test Impact:      ${capsule.testImpact || 'UNIT_LOCAL'}`);
    console.log(`Scoped Test:      ${capsule.scopedTestCommand || 'npm test'}`);
    console.log(`Freshness State:  ${freshness.state} (${freshness.reason})`);
    console.log(`Budget Usage:     ${usage.estimatedTokens} / ${usage.maxBudgetTokens} tokens (Target: ${usage.targetBudgetTokens})`);
    console.log(`Read Files (${capsule.readFiles ? capsule.readFiles.length : 0}):`);
    for (const rf of capsule.readFiles || []) console.log(`  - ${rf}`);
    console.log(`Write Files (${capsule.writeFiles ? capsule.writeFiles.length : 0}):`);
    for (const wf of capsule.writeFiles || []) console.log(`  - ${wf}`);

    if (capsule.module) {
      const mod = getModuleManifest(targetDir, capsule.module);
      if (mod) {
        const drift = validateModuleDrift(targetDir, mod);
        console.log(`Module Status:    ${drift.valid ? 'VALID' : 'DRIFT DETECTED'}`);
        if (!drift.valid) {
          for (const df of drift.findings) console.log(`  ! [${df.code}] ${df.message}`);
        }
      }
    }

    if (!freshness.valid) {
      logger.error(`[STALE_TASK_CONTEXT] Execution halted. Reason: [${freshness.state}] ${freshness.reason}`);
      process.exit(1);
    }
    return;
  }

  // Feature-level context capsule subcommands (show, generate, verify)
  const subcommand = firstArg || 'show';
  let activeSpec = (args[1] && !args[1].startsWith('-') ? args[1] : null) || flags.feature;
  if (!activeSpec) {
    const stateFile = path.join(targetDir, '.gemstack/state.json');
    if (fs.existsSync(stateFile)) {
      try {
        const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        activeSpec = state.active_spec;
      } catch (_) {}
    }
  }

  if (!activeSpec) {
    if (fs.existsSync(path.join(targetDir, 'specs/009-context-capsule'))) {
      activeSpec = 'specs/009-context-capsule';
    } else if (fs.existsSync(path.join(targetDir, 'specs/current'))) {
      activeSpec = 'specs/current';
    } else {
      logger.error('No active feature found or specified via --feature.');
      process.exit(1);
    }
  }

  switch (subcommand) {
    case 'generate': {
      logger.info(`Generating context capsule for "${activeSpec}" in: ${targetDir}`);
      try {
        const res = generateContextCapsule(targetDir, activeSpec);
        logger.ok(`Context capsule generated successfully: ${res.path} (${res.byteLength} bytes, ${res.invariantsCount} invariants).`);
      } catch (err) {
        logger.error(`Generation failed: ${err.message}`);
        process.exit(1);
      }
      break;
    }

    case 'show': {
      const capsuleFile = path.join(targetDir, activeSpec, 'context-capsule.json');
      if (!fs.existsSync(capsuleFile)) {
        logger.error(`Context capsule not found at: ${capsuleFile}`);
        process.exit(1);
      }
      const raw = fs.readFileSync(capsuleFile, 'utf8');
      if (flags.json) {
        console.log(raw);
      } else {
        const parsed = JSON.parse(raw);
        console.log('=== Gemstack Context Capsule ===');
        console.log(`Schema Version: ${parsed.schema_version}`);
        console.log(`Project:        ${parsed.project ? parsed.project.name : 'unknown'}`);
        console.log(`Feature:        ${parsed.project ? parsed.project.active_feature : 'unknown'}`);
        console.log(`Lifecycle:      ${parsed.project ? parsed.project.lifecycle_status : 'unknown'}`);
        console.log(`Sources:        ${parsed.provenance ? parsed.provenance.sources.length : 0} files`);
        console.log(`Invariants:     ${parsed.canonical_invariants ? parsed.canonical_invariants.length : 0} rules`);
        console.log(`Contracts:      ${parsed.frozen_contracts ? parsed.frozen_contracts.length : 0} contracts`);
        console.log(`Acceptance:     ${parsed.acceptance_matrix ? parsed.acceptance_matrix.total_required : 0} tests`);
      }
      break;
    }

    case 'verify': {
      logger.info(`Auditing context capsule for "${activeSpec}" in: ${targetDir}`);
      const res = validateContextCapsule(targetDir, activeSpec);
      if (res.valid) {
        logger.ok(`[OK] Context capsule is VALID and FRESH for ${activeSpec}.`);
      } else {
        logger.error(`[${res.state}] Context capsule validation failed.`);
        for (const f of res.findings) {
          logger.error(` - [${f.code}] ${f.message}`);
        }
        process.exit(1);
      }
      break;
    }

    default:
      logger.error(`Unknown context subcommand: ${subcommand}. Valid: <TASK-ID>, generate, show, verify.`);
      process.exit(1);
  }
}

module.exports = contextCommand;
