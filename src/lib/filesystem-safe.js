const path = require('path');
const fs = require('fs');

module.exports = {
    resolveSafe: (targetDir, relativePath) => {
        const target = path.resolve(targetDir);
        const candidate = path.resolve(targetDir, relativePath);
        const rel = path.relative(target, candidate);
        
        const isInside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
        
        if (!isInside) {
            throw new Error(`Path Traversal blocked: ${relativePath}`);
        }
        return candidate;
    },
    ensureDir: (dirPath) => {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
};
