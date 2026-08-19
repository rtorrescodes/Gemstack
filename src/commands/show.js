const fs = require('fs');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');

module.exports = async (skill, flags) => {
    if (!skill) {
        logger.error('Must provide skill name');
        process.exit(1);
    }
    const targetDir = flags.target;
    const p = fssafe.resolveSafe(targetDir, `.agents/skills/${skill}/SKILL.md`);
    
    if (!fs.existsSync(p)) {
        logger.error(`Skill ${skill} not found at ${p}`);
        return;
    }
    console.log(fs.readFileSync(p, 'utf8'));
};
