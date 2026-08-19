const fs = require('fs');
const path = require('path');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');
const backupLib = require('../lib/backup');

module.exports = async (flags) => {
    const targetDir = flags.target;
    const templateDir = path.resolve(__dirname, '../../template');
    
    logger.info(`Running update on ${targetDir}`);
    const manifest = manifestLib.loadManifest(targetDir);
    if (!manifest.files) manifest.files = [];
    let toUpdate = [];

    manifest.files.forEach(f => {
        const destPath = fssafe.resolveSafe(targetDir, f.path);
        const tmplPath = path.join(templateDir, f.path);
        if (!fs.existsSync(tmplPath)) return;
        
        const tmplContent = fs.readFileSync(tmplPath);
        const tmplCheck = manifestLib.getChecksum(tmplContent);
        
        if (fs.existsSync(destPath)) {
            const destContent = fs.readFileSync(destPath);
            const destCheck = manifestLib.getChecksum(destContent);
            if (destCheck !== f.checksum && destCheck !== tmplCheck) {
                if (!flags.force) {
                    logger.warn(`User modified ${f.path}. Skipping. Use --force to override.`);
                    return;
                }
            }
            if (tmplCheck !== destCheck) {
                toUpdate.push(f.path);
            }
        } else {
            toUpdate.push(f.path);
        }
    });

    if (toUpdate.length === 0) {
        logger.ok('Everything is up to date.');
        return;
    }

    if (flags.dryRun) {
        logger.ok(`Dry run: Will update ${toUpdate.length} files.`);
        toUpdate.forEach(f => logger.info(` -> ${f}`));
        return;
    }

    if (!flags.yes) {
        logger.error(`Updates available for ${toUpdate.length} files. Aborting.`);
        logger.info(`Run with --yes to backup and apply updates.`);
        process.exit(1);
    }

    for (const rel of toUpdate) {
        backupLib.backupFile(targetDir, rel, flags.dryRun);
        const src = path.join(templateDir, rel);
        const dest = fssafe.resolveSafe(targetDir, rel);
        fssafe.ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        logger.ok(`Updated ${rel}`);
        
        const ex = manifest.files.find(f => f.path === rel);
        if (ex) ex.checksum = manifestLib.getChecksum(fs.readFileSync(dest));
    }

    manifestLib.saveManifest(targetDir, manifest, flags.dryRun);
    logger.ok('Gemstack update complete.');
};
