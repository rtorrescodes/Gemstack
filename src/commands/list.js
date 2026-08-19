const fs = require('fs');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');

module.exports = async (flags) => {
    const targetDir = flags.target;
    const skillsDir = fssafe.resolveSafe(targetDir, '.agents/skills');
    
    if (!fs.existsSync(skillsDir)) {
        logger.error(`No skills directory found at ${skillsDir}`);
        return;
    }
    
    logger.info('Installed Skills:');
    fs.readdirSync(skillsDir).forEach(dir => {
        if (dir.startsWith('gemstack-')) {
            logger.ok(dir);
        }
    });
};
