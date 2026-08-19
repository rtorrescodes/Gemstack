const fs = require('fs');
const path = require('path');
const fssafe = require('./filesystem-safe');
const logger = require('./logger');

module.exports = {
    backupFile: (targetDir, relativeFilePath, dryRun) => {
        const fullPath = fssafe.resolveSafe(targetDir, relativeFilePath);
        if (!fs.existsSync(fullPath)) return;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = fssafe.resolveSafe(targetDir, `.gemstack/backups/${timestamp}`);
        const backupDest = fssafe.resolveSafe(backupDir, relativeFilePath);

        logger.info(`Backup: ${relativeFilePath}`);
        if (!dryRun) {
            fssafe.ensureDir(path.dirname(backupDest));
            fs.copyFileSync(fullPath, backupDest);
            
            const manifestPath = path.join(backupDir, 'manifest.json');
            let manifest = [];
            if (fs.existsSync(manifestPath)) {
                manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            }
            manifest.push({ original: relativeFilePath, backup: backupDest, timestamp });
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }
    }
};
