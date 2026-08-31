const fs = require('fs');
const path = require('path');
const https = require('https');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');

async function fetchUrl(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    return await response.text();
}

function extractSkillName(content) {
    const match = content.match(/^name:\s*(.+)$/m);
    return match ? match[1].trim() : null;
}

module.exports = async (url, flags) => {
    if (!url) {
        logger.error("Debe proporcionar una URL. Ejemplo: gemstack install https://raw.githubusercontent.com/.../SKILL.md");
        process.exit(1);
    }

    const targetDir = flags.target || process.cwd();
    logger.info(`Descargando skill desde: ${url}`);

    try {
        const content = await fetchUrl(url);
        
        // Ensure it's a valid skill file
        if (!content.includes('---')) {
            throw new Error('El archivo descargado no parece un SKILL válido (no tiene frontmatter).');
        }

        const skillName = extractSkillName(content);
        if (!skillName) {
            throw new Error('No se encontró "name: <nombre>" en el frontmatter del SKILL.');
        }

        // Calculate path
        const relativePath = `.agents/skills/${skillName}/SKILL.md`;
        const destPath = fssafe.resolveSafe(targetDir, relativePath);

        if (flags.dryRun) {
            logger.ok(`Dry run: Se instalaría el skill "${skillName}" en ${relativePath}`);
            return;
        }

        // Install the skill
        fssafe.ensureDir(path.dirname(destPath));
        fs.writeFileSync(destPath, content, 'utf8');

        // Update manifest
        const manifest = manifestLib.loadManifest(targetDir);
        if (!manifest.files) manifest.files = [];
        
        const checksum = manifestLib.getChecksum(Buffer.from(content, 'utf8'));
        const ex = manifest.files.find(f => f.path === relativePath);
        if (ex) ex.checksum = checksum;
        else manifest.files.push({ path: relativePath, checksum });
        
        manifestLib.saveManifest(targetDir, manifest, false);

        logger.ok(`✅ Skill "${skillName}" instalado exitosamente en ${relativePath}`);
    } catch (e) {
        logger.error(`Error instalando el skill: ${e.message}`);
        process.exit(1);
    }
};
