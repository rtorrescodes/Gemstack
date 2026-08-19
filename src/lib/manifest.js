const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fssafe = require('./filesystem-safe');

function getChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

module.exports = {
    getChecksum,
    loadManifest: (targetDir) => {
        const mPath = fssafe.resolveSafe(targetDir, '.gemstack/manifest.json');
        if (fs.existsSync(mPath)) return JSON.parse(fs.readFileSync(mPath, 'utf8'));
        return { version: '0.2.0', files: [] };
    },
    saveManifest: (targetDir, manifest, dryRun) => {
        if (dryRun) return;
        const mPath = fssafe.resolveSafe(targetDir, '.gemstack/manifest.json');
        fssafe.ensureDir(path.dirname(mPath));
        manifest.installedAt = new Date().toISOString();
        fs.writeFileSync(mPath, JSON.stringify(manifest, null, 2));
    }
};
