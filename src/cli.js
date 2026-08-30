#!/usr/bin/env node
const parser = require('./lib/parser');
const logger = require('./lib/logger');
const initCommand = require('./commands/init');
const updateCommand = require('./commands/update');
const doctorCommand = require('./commands/doctor');
const listCommand = require('./commands/list');
const showCommand = require('./commands/show');

async function main() {
    const { command, args, flags } = parser.parse(process.argv);

    if (flags.help || command === 'help') {
        console.log(`Gemstack CLI
Commands:
  init      Install Gemstack scaffolding
  update    Update Gemstack-owned files
  doctor    Check health of the installation
  list      List available skills
  show      Show content of a skill
  handoff   Show content of handoff.md
Options:
  --dry-run Show changes without writing
  --yes     Skip confirmations
  --force   Force overwrite (update only)
  --target  Specify target directory`);
        return;
    }

    try {
        switch (command) {
            case 'init': await initCommand(flags); break;
            case 'update': await updateCommand(flags); break;
            case 'doctor': await doctorCommand(flags); break;
            case 'list': await listCommand(flags); break;
            case 'show': await showCommand(args[0], flags); break;
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
