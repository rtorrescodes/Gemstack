const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function runSafe(cmd, cwd) {
    try {
        console.log(`Running: ${cmd}`);
        execSync(cmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
    } catch (err) {
        console.error(`[FAIL] Command failed: ${cmd}\n${err.stderr || err.message}`);
        process.exit(1);
    }
}

const rootDir = path.resolve(__dirname, '../../');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-smoke-'));

console.log(`[INFO] Smoke testing CLI in ${tmpDir}`);

runSafe(`node "${path.join(rootDir, 'src/cli.js')}" --help`, tmpDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" list`, rootDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" show gemstack-handoff`, rootDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" init --dry-run --target "${tmpDir}"`, tmpDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" init --yes --target "${tmpDir}"`, tmpDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" doctor --target "${tmpDir}"`, tmpDir);
runSafe(`node "${path.join(rootDir, 'src/cli.js')}" update --dry-run --target "${tmpDir}"`, tmpDir);

fs.rmSync(tmpDir, { recursive: true, force: true });
console.log('[OK] CLI Smoke tests passed.');
