const fs = require('fs');
const fssafe = require('./filesystem-safe');
const logger = require('./logger');

module.exports = {
    patchGitignore: (targetDir, dryRun) => {
        const giPath = fssafe.resolveSafe(targetDir, '.gitignore');
        let content = fs.existsSync(giPath) ? fs.readFileSync(giPath, 'utf8') : '';
        if (content.includes('# Gemstack')) {
            return;
        }
        
        const block = `\n# Gemstack\n.gemstack/state.json\n.gemstack/backups/\n`;
        logger.info(`Patching .gitignore`);
        if (!dryRun) {
            fs.appendFileSync(giPath, block);
        }
    }
};
