const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

function normalizePlatformPath(p) {
    const resolved = path.resolve(p);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function resolveSafe(targetDir, relativePath) {
    const target = path.resolve(targetDir);
    const candidate = path.resolve(targetDir, relativePath);
    const rel = path.relative(target, candidate);
    
    const isInside = rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
    
    if (!isInside) {
        const err = new Error(`[PATH_TRAVERSAL_DETECTED] Path Traversal blocked: ${relativePath}`);
        err.code = 'PATH_TRAVERSAL_DETECTED';
        throw err;
    }
    return candidate;
}

function resolveSafeStrict(targetDir, relativePath) {
    const candidate = resolveSafe(targetDir, relativePath);
    const target = path.resolve(targetDir);

    const realRoot = fs.existsSync(target) ? fs.realpathSync(target) : target;
    const normRoot = normalizePlatformPath(realRoot);

    // Check intermediate components and candidate for symlink escapes
    const rel = path.relative(target, candidate);
    const parts = rel.split(/[\\/]/).filter(Boolean);

    let current = target;
    for (const part of parts) {
        current = path.join(current, part);
        let isLink = false;
        try {
            const st = fs.lstatSync(current);
            isLink = st.isSymbolicLink();
        } catch {}

        if (fs.existsSync(current) || isLink) {
            let realCurrent;
            try {
                realCurrent = fs.realpathSync(current);
            } catch {
                try {
                    realCurrent = path.resolve(path.dirname(current), fs.readlinkSync(current));
                } catch {
                    realCurrent = current;
                }
            }
            const normCurrent = normalizePlatformPath(realCurrent);
            if (!normCurrent.startsWith(normRoot) || (normCurrent !== normRoot && normCurrent[normRoot.length] !== path.sep && normCurrent[normRoot.length] !== '/' && normCurrent[normRoot.length] !== '\\')) {
                const err = new Error(`Symlink escape detected: path component "${part}" resolves to "${realCurrent}" outside project root "${realRoot}"`);
                err.code = 'SYMLINK_ESCAPE_DETECTED';
                throw err;
            }
        }
    }

    let isCandidateLink = false;
    try {
        const st = fs.lstatSync(candidate);
        isCandidateLink = st.isSymbolicLink();
    } catch {}

    if (fs.existsSync(candidate) || isCandidateLink) {
        let realCandidate;
        try {
            realCandidate = fs.realpathSync(candidate);
        } catch {
            try {
                realCandidate = path.resolve(path.dirname(candidate), fs.readlinkSync(candidate));
            } catch {
                realCandidate = candidate;
            }
        }
        const normCandidate = normalizePlatformPath(realCandidate);
        if (!normCandidate.startsWith(normRoot) || (normCandidate !== normRoot && normCandidate[normRoot.length] !== path.sep && normCandidate[normRoot.length] !== '/' && normCandidate[normRoot.length] !== '\\')) {
            const err = new Error(`Symlink escape detected: destination resolves to "${realCandidate}" outside project root "${realRoot}"`);
            err.code = 'SYMLINK_ESCAPE_DETECTED';
            throw err;
        }
    }

    return candidate;
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function withConfinedAtomicWrite(rootDir, relativePath, writeFn) {
    const finalPath = resolveSafeStrict(rootDir, relativePath);
    const tmpDir = resolveSafeStrict(rootDir, '.gemstack/tmp');
    ensureDir(tmpDir);

    const tmpFile = path.join(tmpDir, `atomic-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.tmp`);
    try {
        writeFn(tmpFile);
        ensureDir(path.dirname(finalPath));
        fs.renameSync(tmpFile, finalPath);
        return finalPath;
    } finally {
        if (fs.existsSync(tmpFile)) {
            try { fs.unlinkSync(tmpFile); } catch {}
        }
    }
}

module.exports = {
    resolveSafe,
    resolveSafeStrict,
    ensureDir,
    withConfinedAtomicWrite
};
