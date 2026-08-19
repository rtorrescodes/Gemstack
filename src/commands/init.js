const fs = require('fs');
const path = require('path');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');
const backupLib = require('../lib/backup');
const gitignoreLib = require('../lib/gitignore');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath, callback);
        else callback(dirPath);
    });
}

module.exports = async (flags) => {
    const targetDir = flags.target;
    const templateDir = path.resolve(__dirname, '../../template');
    if (!fs.existsSync(templateDir)) {
        throw new Error('Template directory missing in Gemstack installation.');
    }

    logger.info(`Running init on ${targetDir}`);
    const manifest = manifestLib.loadManifest(targetDir);
    if (!manifest.files) manifest.files = [];
    
    let conflicts = [];
    let toCopy = [];

    walkDir(templateDir, (filePath) => {
        const relativePath = path.relative(templateDir, filePath).replace(/\\/g, '/');
        const destPath = fssafe.resolveSafe(targetDir, relativePath);

        if (fs.existsSync(destPath)) {
            if (['handoff.md', 'handoff_archive.md', '.gemstack/learnings.md', '.gemstack/state.json'].includes(relativePath)) {
                // Safe ignore
            } else {
                conflicts.push(relativePath);
            }
        } else {
            toCopy.push(relativePath);
        }
    });

    if (flags.dryRun) {
        logger.ok(`Dry run: Will create ${toCopy.length} files.`);
        if (conflicts.length > 0) logger.warn(`Conflicts found in ${conflicts.length} files. Requires --yes to backup & overwrite.`);
        return;
    }

    if (conflicts.length > 0 && !flags.yes) {
        logger.error(`Conflicts detected in ${conflicts.length} files. Aborting.`);
        logger.info(`Run with --yes to backup and overwrite Gemstack-owned files, or --dry-run to inspect.`);
        process.exit(1);
    }

    if (flags.yes) {
        for (const rel of conflicts) {
            backupLib.backupFile(targetDir, rel, flags.dryRun);
            toCopy.push(rel);
        }
    }

    for (const rel of toCopy) {
        const src = path.join(templateDir, rel);
        const dest = fssafe.resolveSafe(targetDir, rel);
        fssafe.ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        logger.ok(`Created ${rel}`);
        
        const content = fs.readFileSync(dest);
        const ex = manifest.files.find(f => f.path === rel);
        if (ex) ex.checksum = manifestLib.getChecksum(content);
        else manifest.files.push({ path: rel, checksum: manifestLib.getChecksum(content) });
    }

    gitignoreLib.patchGitignore(targetDir, flags.dryRun);
    manifestLib.saveManifest(targetDir, manifest, flags.dryRun);
    logger.ok('Gemstack initialization complete.');
};
