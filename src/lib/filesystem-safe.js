const path = require('path');
const fs = require('fs');

module.exports = {
    resolveSafe: (targetDir, relativePath) => {
        const resolved = path.resolve(targetDir, relativePath);
        const targetResolved = path.resolve(targetDir);
        if (!resolved.startsWith(targetResolved)) {
            throw new Error(`Path Traversal blocked: ${relativePath}`);
        }
        return resolved;
    },
    ensureDir: (dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
};
