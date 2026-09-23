const fs = require('fs');
const path = require('path');
const { detectSecrets } = require('../../src/commands/hooks');

const rootDir = path.resolve(__dirname, '../../');

const IGNORED_DIRS = new Set([
    '.git',
    'node_modules',
    '.gemstack',
    'tests'
]);

const IGNORED_FILES = new Set([
    'package-lock.json',
    'check-secrets.js',
    'security-p0-hardening.test.js' // Contains test patterns
]);

const BINARY_EXTENSIONS = new Set([
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.tgz', '.sqlite', '.db'
]);

function walkDirectory(dir, fileList = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            if (!IGNORED_DIRS.has(entry.name)) {
                walkDirectory(fullPath, fileList);
            }
        } else if (entry.isFile()) {
            if (!IGNORED_FILES.has(entry.name) && !BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                fileList.push(fullPath);
            }
        }
    }
    return fileList;
}

function runSecretsCheck() {
    const files = walkDirectory(rootDir);
    let violations = [];

    for (const filePath of files) {
        const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
        // Skip demo-app test fixtures or node_modules
        if (relPath.includes('node_modules/') || relPath.includes('fixtures/')) {
            continue;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const detected = detectSecrets(content);
            if (detected.length > 0) {
                for (const d of detected) {
                    violations.push({
                        file: relPath,
                        line: d.lineNumber,
                        type: d.type,
                        description: d.description,
                        snippet: d.lineSnippet
                    });
                }
            }
        } catch (e) {
            // Non-text file or read error, skip
        }
    }

    if (violations.length > 0) {
        console.error(`\n❌ [FAIL] ${violations.length} secret(s) detected in repository files:`);
        for (const v of violations) {
            console.error(`  - ${v.file}:${v.line} [${v.type}] ${v.description}`);
        }
        process.exit(1);
    } else {
        console.log('[OK] Zero secrets detected in repository.');
    }
}

runSecretsCheck();
