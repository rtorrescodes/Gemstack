const fs = require('fs');
const path = require('path');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');
const backupLib = require('../lib/backup');

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
    
    logger.info(`Running update on ${targetDir}`);
    const manifest = manifestLib.loadManifest(targetDir);
    if (!manifest.files) manifest.files = [];
    let toUpdate = [];

    walkDir(templateDir, (filePath) => {
        const relativePath = path.relative(templateDir, filePath).replace(/\\/g, '/');
        const destPath = fssafe.resolveSafe(targetDir, relativePath);
        
        const tmplContent = fs.readFileSync(filePath);
        const tmplCheck = manifestLib.getChecksum(tmplContent);
        
        const exManifest = manifest.files.find(f => f.path === relativePath);

        if (fs.existsSync(destPath)) {
            const destContent = fs.readFileSync(destPath);
            const destCheck = manifestLib.getChecksum(destContent);
            
            if (exManifest && destCheck !== exManifest.checksum && destCheck !== tmplCheck) {
                if (!flags.force) {
                    logger.warn(`User modified ${relativePath}. Skipping. Use --force to override.`);
                    return;
                }
            }
            if (tmplCheck !== destCheck) {
                toUpdate.push(relativePath);
            }
        } else {
            // File exists in template but not in target (new skill/file)
            toUpdate.push(relativePath);
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

    const sessionTimestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const rel of toUpdate) {
        backupLib.backupFile(targetDir, rel, flags.dryRun, sessionTimestamp);
        const src = path.join(templateDir, rel);
        const dest = fssafe.resolveSafe(targetDir, rel);
        fssafe.ensureDir(path.dirname(dest));
        fs.copyFileSync(src, dest);
        logger.ok(`Updated ${rel}`);
        
        const ex = manifest.files.find(f => f.path === rel);
        const newChecksum = manifestLib.getChecksum(fs.readFileSync(dest));
        if (ex) ex.checksum = newChecksum;
        else manifest.files.push({ path: rel, checksum: newChecksum });
    }

    manifestLib.saveManifest(targetDir, manifest, flags.dryRun);
    logger.ok('Gemstack update complete.');
};
