#!/usr/bin/env node
const parser = require('./lib/parser');
const logger = require('./lib/logger');
const initCommand = require('./commands/init');
const updateCommand = require('./commands/update');
const doctorCommand = require('./commands/doctor');
const listCommand = require('./commands/list');
const showCommand = require('./commands/show');
const hooksCommand = require('./commands/hooks');
const installCommand = require('./commands/install');
const verifyCommand = require('./commands/verify');
const collectCommand = require('./commands/collect');
const shipCommand = require('./commands/ship');
const contextCommand = require('./commands/context');
const swarmCommand = require('./commands/swarm');
const visualCommand = require('./commands/visual');
const specCommand = require('./commands/spec');

async function main() {
    const { command, args, flags } = parser.parse(process.argv);

    if (flags.help || command === 'help') {
        console.log(`Gemstack CLI
Commands:
  init      Install Gemstack scaffolding
  update    Update Gemstack-owned files
  doctor    Check health of the installation
  verify    Run complete integrity, state, memory and security audit (alias: audit)
  collect   Collect mechanical test matrix and closure evidence
  ship      Verify closure gates and transition feature to shipped
  context   Generate, show, or verify context capsule
  swarm     Plan or validate agent swarm work and write partitions
  vqa       Validate or promote visual QA manifests and evidence
  spec      Validate spec rigor, merge concurrent specs, and check conflicts
  list      List available skills
  show      Show content of a skill
  handoff   Show content of handoff.md
  hooks     Install native Git pre-commit hooks for active security
  install   Install a remote skill via URL (requires --sha256 or --inspect)
  mcp       Start the Gemstack MCP (Model Context Protocol) server over stdio
Options:
  --sha256    Expected SHA-256 checksum of the remote skill payload
  --inspect   Inspect remote skill metadata without installing to disk
  --update    Update an existing skill with automatic timestamped backup
  --dry-run   Show changes without writing
  --yes       Skip confirmations
  --force     Force overwrite
  --target    Specify target directory
  --run-tests Run test suite during verify`);
        return;
    }

    try {
        switch (command) {
            case 'init': await initCommand(flags); break;
            case 'update': await updateCommand(flags); break;
            case 'doctor': await doctorCommand(flags); break;
            case 'verify':
            case 'audit': await verifyCommand(flags); break;
            case 'collect': await collectCommand(flags); break;
            case 'ship': await shipCommand(flags); break;
            case 'context': await contextCommand(args, flags); break;
            case 'swarm': await swarmCommand(args, flags); break;
            case 'vqa':
            case 'visual': await visualCommand(args, flags); break;
            case 'spec': await specCommand(args, flags); break;
            case 'list': await listCommand(flags); break;
            case 'show': await showCommand(args[0], flags); break;
            case 'hooks': hooksCommand.installHooks(flags.target); break;
            case 'install': await installCommand(args[0], flags); break;
            case 'mcp': require('./mcp-server'); break;
            case 'handoff': {
                const fs = require('fs');
                const path = require('path');
                const fssafe = require('./lib/filesystem-safe');
                const p = fssafe.resolveSafe(flags.target, 'handoff.md');
                if (fs.existsSync(p)) console.log(fs.readFileSync(p, 'utf8'));
                else logger.error('handoff.md not found');
                break;
            }
            default:
                logger.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (e) {
        logger.error(e.message);
        process.exit(1);
    }
}

main();
