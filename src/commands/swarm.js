/**
 * Gemstack Swarm Command Handler (Upgrade E)
 *
 * Implements "gemstack swarm plan" and "gemstack swarm validate" subcommands.
 * Read-only planning and manifest auditing.
 */

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../lib/logger');
const fssafe = require('../lib/filesystem-safe');
const { readState } = require('../lib/state');
const { planSwarmWaves, validateSwarmManifest, canonicalSerialize } = require('../lib/swarm');

async function swarmCommand(args = [], flags = {}) {
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

  const featureDir = fssafe.resolveSafe(targetDir, activeSpec);

  if (subcommand === 'plan') {
    const tasksPath = path.join(featureDir, 'tasks.md');
    if (!fs.existsSync(tasksPath)) {
      logger.error(`tasks.md not found in "${activeSpec}".`);
      process.exit(1);
    }

    const tasksRaw = fs.readFileSync(tasksPath, 'utf8');
    // Extract tasks with parallel tag or lines
    const parsedTasks = [];
    const lines = tasksRaw.split('\n');
    for (const line of lines) {
      const m = line.match(/###\s+(?:Task\s+)?([A-Za-z0-9_-]+)/i);
      if (m) {
        parsedTasks.push({
          task_id: m[1],
          description: line.replace(/^#+\s*/, '').trim(),
          assigned_role: 'implementer',
          worker_id: `worker-impl-${parsedTasks.length + 1}`,
          write_set: [`src/${m[1].toLowerCase()}.js`],
          status: 'PLANNED'
        });
      }
    }

    const waves = planSwarmWaves(parsedTasks);
    const manifest = {
      $schema: 'https://gemstack.dev/schemas/v1/swarm.json',
      version: '1.0.0',
      feature_id: activeSpec,
      source_capsule_hash: 'd0mmy_c4psul3_h4sh',
      max_workers: 4,
      waves
    };

    const manifestPath = path.join(featureDir, 'swarm.json');
    if (!flags['dry-run']) {
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      logger.ok(`Swarm plan generated: ${manifestPath} (${waves.length} wave(s)).`);
    } else {
      logger.info(`[DRY-RUN] Swarm plan computed: ${waves.length} wave(s).`);
    }

    if (flags.json) {
      console.log(JSON.stringify(manifest, null, 2));
    }
  } else if (subcommand === 'validate') {
    const res = validateSwarmManifest(targetDir, activeSpec);
    if (flags.json) {
      console.log(JSON.stringify(res, null, 2));
      return;
    }

    if (res.state === 'MISSING') {
      logger.info(`[LEGACY] No se detectó swarm.json en "${activeSpec}".`);
      return;
    }

    if (res.valid) {
      logger.ok(`Swarm manifest validado con éxito: ${activeSpec}/swarm.json.`);
    } else {
      for (const f of res.findings) {
        logger.error(`[${f.code}] ${f.details}`);
      }
      process.exit(1);
    }
  } else {
    logger.error(`Unknown swarm subcommand: "${subcommand}". Use "plan" or "validate".`);
    process.exit(1);
  }
}

module.exports = swarmCommand;
