module.exports = {
    parse: (argv) => {
        let command = argv[2] || 'help';
        if (command.startsWith('-')) command = 'help';

        const args = [];
        const flags = { dryRun: false, yes: false, force: false, help: false, target: process.cwd() };

        for (let i = 2; i < argv.length; i++) {
            const arg = argv[i];
            if (arg === '--dry-run') flags.dryRun = true;
            else if (arg === '--yes') flags.yes = true;
            else if (arg === '--force') flags.force = true;
            else if (arg === '--help' || arg === '-h') flags.help = true;
            else if (arg === '--target' && i + 1 < argv.length) {
                flags.target = argv[++i];
            }
            else if (i > 2 && !arg.startsWith('--')) args.push(arg);
        }
        return { command, args, flags };
    }
};
