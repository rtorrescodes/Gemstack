const { execSync } = require('child_process');
const path = require('path');

try {
    const rootDir = path.resolve(__dirname, '../../');
    const output = execSync('npm pack --dry-run --json', { cwd: rootDir, encoding: 'utf8' });
    const result = JSON.parse(output);
    const files = result[0].files.map(f => f.path.replace(/\\/g, '/'));
    
    const required = ['src/cli.js', 'template/handoff.md', 'README.md', 'LICENSE', 'CHANGELOG.md', 'RELEASE_NOTES.md', 'package.json'];
    const forbidden = ['node_modules', 'securedocs.sqlite', 'demo-app/node_modules', '.git/', 'demo-app/securedocs.sqlite'];
    
    let hasError = false;
    for (const req of required) {
        if (!files.some(f => f === req || f.startsWith(req))) {
            console.error(`[FAIL] Package missing required file/folder: ${req}`);
            hasError = true;
        }
    }
    for (const fbn of forbidden) {
        if (files.some(f => f.includes(fbn))) {
            console.error(`[FAIL] Package includes forbidden file/folder: ${fbn}`);
            hasError = true;
        }
    }
    
    if (hasError) process.exit(1);
    console.log('[OK] Package contents are valid.');
} catch (err) {
    console.error('[FAIL] Error parsing package contents:', err.message);
    process.exit(1);
}
