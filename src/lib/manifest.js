const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fssafe = require('./filesystem-safe');

function getChecksum(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}

function getVersion() {
    return require('../../package.json').version;
}

const OPERATIONAL_PATTERNS = [
    /^handoff\.md$/,
    /^handoff_archive\.md$/,
    /^\.gemstack\/learnings\.md$/,
    /^\.gemstack\/state\.json$/,
    /^specs\/current\//,
    /^docs\/qa\/latest-qa\.md$/,
    /^docs\/reviews\/latest-review\.md$/,
    /^docs\/security\/latest-security-audit\.md$/
];

function isOperationalFile(relativePath) {
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    return OPERATIONAL_PATTERNS.some(pattern => pattern.test(normalized));
}

function sanitizeManifestFiles(files) {
    if (!Array.isArray(files)) return [];
    return files.filter(f => f && f.path && !isOperationalFile(f.path));
}

module.exports = {
    getChecksum,
    getVersion,
    OPERATIONAL_PATTERNS,
    isOperationalFile,
    sanitizeManifestFiles,
    loadManifest: (targetDir) => {
        const mPath = fssafe.resolveSafeStrict(targetDir, '.gemstack/manifest.json');
        if (fs.existsSync(mPath)) return JSON.parse(fs.readFileSync(mPath, 'utf8'));
        const pkgVersion = getVersion();
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
