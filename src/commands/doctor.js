const fs = require('fs');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');

module.exports = async (flags) => {
    const targetDir = flags.target;
    logger.info(`Running doctor on ${targetDir}`);
    
    const manifestPath = fssafe.resolveSafe(targetDir, '.gemstack/manifest.json');
    if (!fs.existsSync(manifestPath)) {
        logger.error('Manifest not found. Gemstack is not initialized here.');
        process.exit(1);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    logger.ok(`Manifest version: ${manifest.version}`);
    
    let missing = 0;
    let modified = 0;
    const manifestLib = require('../lib/manifest');

    (manifest.files || []).forEach(f => {
        const p = fssafe.resolveSafe(targetDir, f.path);
        if (!fs.existsSync(p)) {
            logger.error(`Missing owned file: ${f.path}`);
            missing++;
        } else {
            const destContent = fs.readFileSync(p);
            const destCheck = manifestLib.getChecksum(destContent);
            if (destCheck !== f.checksum) {
                logger.warn(`Modified owned file: ${f.path}`);
                modified++;
            }
        }
    });

    if (missing === 0 && modified === 0) {
        logger.ok('All owned files are present and unmodified.');
    } else {
        logger.info(`Summary: ${missing} missing, ${modified} modified. Use 'gemstack update' if you want to restore defaults.`);
    }

    const giPath = fssafe.resolveSafe(targetDir, '.gitignore');
    if (fs.existsSync(giPath) && fs.readFileSync(giPath, 'utf8').includes('# Gemstack')) {
        logger.ok('.gitignore is patched.');
    } else {
        logger.warn('.gitignore is not patched.');
    }
    logger.ok('Doctor checks completed.');
};
