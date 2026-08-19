const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');
let hasError = false;

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (f === 'node_modules' || f === '.git' || f === 'temp dirs' || f.endsWith('.tgz') || f.endsWith('.zip') || f.endsWith('.sqlite')) return;
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath, callback);
        } else {
            if (/\.(md|js|json|yml|yaml|ps1|sh)$/.test(f)) {
                callback(dirPath);
            }
        }
    });
}

const mojibakePatterns = new RegExp('\\xC3|\\xC2|\\xE2\\x9C|\\xF0\\x9F');

walkDir(rootDir, (filePath) => {
    // skip this script and the specs directory
    if (filePath.replace(/\\/g, '/').includes('scripts/ci/check-mojibake.js')) return;
    if (filePath.replace(/\\/g, '/').includes('specs/')) return;
    if (filePath.replace(/\\/g, '/').endsWith('handoff.md')) {
        // Just skip handoff as it also logs the spec content
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    if (mojibakePatterns.test(content)) {
        console.error(`[FAIL] Mojibake detected in: ${path.relative(rootDir, filePath)}`);
        hasError = true;
    }
});

if (hasError) {
    process.exit(1);
} else {
    console.log('[OK] No mojibake detected.');
}
