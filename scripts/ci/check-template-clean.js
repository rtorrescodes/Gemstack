const fs = require('fs');
const path = require('path');

const templateDir = path.resolve(__dirname, '../../template');
let hasError = false;

function walkDir(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) walkDir(dirPath, callback);
        else callback(dirPath);
    });
}

const forbiddenPatterns = [/node_modules/, /\.sqlite$/, /\.db$/, /\.tgz$/, /\.zip$/, /\.gemstack[\\\/]backups/, /temp dirs/, /\.log$/];
walkDir(templateDir, (filePath) => {
    for (const pattern of forbiddenPatterns) {
        if (pattern.test(filePath)) {
            console.error(`[FAIL] Forbidden file found in template: ${filePath}`);
            hasError = true;
        }
    }
});

const handoffPath = path.join(templateDir, 'handoff.md');
if (fs.existsSync(handoffPath)) {
    const content = fs.readFileSync(handoffPath, 'utf8');
    if (!content.includes('1. Objetivo') || !content.includes('5. Próximos pasos')) {
        console.error('[FAIL] template/handoff.md is missing required sections.');
        hasError = true;
    }
    if (content.match(/[a-f0-9]{40}/)) {
        console.error('[FAIL] template/handoff.md contains what looks like real git hashes.');
        hasError = true;
    }
} else {
    console.error('[FAIL] template/handoff.md is missing.');
    hasError = true;
}

if (hasError) {
    process.exit(1);
} else {
    console.log('[OK] Template directory is clean.');
}
