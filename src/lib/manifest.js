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
        const mPath = fssafe.resolveSafeStrict(targetDir, '.gemstack/manifest.json');
        if (fs.existsSync(mPath)) return JSON.parse(fs.readFileSync(mPath, 'utf8'));
        const pkgVersion = require('../../package.json').version;
        return { version: pkgVersion, files: [] };
    },
    saveManifest: (targetDir, manifest, dryRun) => {
        if (dryRun) return;
        manifest.installedAt = new Date().toISOString();
        fssafe.withConfinedAtomicWrite(targetDir, '.gemstack/manifest.json', (tempFile) => {
            fs.writeFileSync(tempFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
        });
    }
};
