const fs = require('node:fs');
const path = require('node:path');
const logger = require('../lib/logger');
const fssafe = require('../lib/filesystem-safe');
const {
  generateContextCapsule,
  validateContextCapsule
} = require('../lib/context-capsule');

async function contextCommand(args = [], flags = {}) {
  const subcommand = args[0] || 'show';
  const targetDir = flags.target ? path.resolve(flags.target) : process.cwd();

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
    // Check if specs/009-context-capsule or specs/current exists
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
      logger.error(`Unknown context subcommand: ${subcommand}. Valid subcommands: generate, show, verify.`);
      process.exit(1);
  }
}

module.exports = contextCommand;
