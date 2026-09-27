const fs = require('fs');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');

module.exports = async (flags) => {
    const targetDir = flags.target;
    logger.info(`Running doctor on ${targetDir}`);
    
    const manifestPath = fssafe.resolveSafe(targetDir, '.gemstack/manifest.json');
    if (!fs.existsSync(manifestPath)) {
        logger.error('Manifest not found. Gemstack is not initialized here.');
        process.exit(1);
    }
    
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    logger.ok(`Manifest version: ${manifest.version}`);
    
    let missing = 0;
    let modified = 0;
    let operationalEntries = 0;
    const manifestLib = require('../lib/manifest');

    (manifest.files || []).forEach(f => {
        if (manifestLib.isOperationalFile(f.path)) {
            operationalEntries++;
            logger.info(`Operational file recorded in manifest (legacy): ${f.path}`);
            return;
        }

        const p = fssafe.resolveSafe(targetDir, f.path);
        if (!fs.existsSync(p)) {
            logger.error(`Missing owned file: ${f.path}`);
            missing++;
        } else {
            const destContent = fs.readFileSync(p);
            const destCheck = manifestLib.getChecksum(destContent);
            if (destCheck !== f.checksum) {
                logger.warn(`Modified owned file: ${f.path}`);
                modified++;
            }
        }
    });

    if (missing === 0 && modified === 0) {
        if (operationalEntries > 0) {
            logger.ok(`All framework-owned files are present and unmodified. (${operationalEntries} legacy operational manifest entries detected; run 'gemstack update' to sanitize manifest).`);
        } else {
            logger.ok('All owned files are present and unmodified.');
        }
    } else {
        logger.info(`Summary: ${missing} missing, ${modified} modified framework file(s). Use 'gemstack update' if you want to restore defaults.`);
    }

    const giPath = fssafe.resolveSafe(targetDir, '.gitignore');
    if (fs.existsSync(giPath) && fs.readFileSync(giPath, 'utf8').includes('# Gemstack')) {
        logger.ok('.gitignore is patched.');
    } else {
        logger.warn('.gitignore is not patched.');
    }

    // Offline Dependency Audit (Gemstack 2.0 Sprint D)
    const { auditDependencies } = require('../lib/dependency-audit');
    const depAudit = auditDependencies(targetDir);
    if (depAudit.orphans.length > 0) {
        logger.warn(`Orphan dependencies detected in package.json: ${depAudit.orphans.join(', ')}`);
    } else {
        logger.ok('Zero orphan dependencies detected.');
    }
    if (depAudit.undeclared.length > 0) {
        logger.warn(`Undeclared dependencies used in source: ${depAudit.undeclared.join(', ')}`);
    }
    if (depAudit.circularCycles.length > 0) {
        logger.warn(`Circular import cycles detected: ${depAudit.circularCycles.map(c => c.join(' -> ')).join('; ')}`);
    } else {
        logger.ok('Zero circular import cycles detected.');
    }

    // v2.0.3 Context Locality & Module Drift Diagnostics (Read-Only)
    const { readState } = require('../lib/state');
    const state = readState(targetDir);

    // Branch context check
    try {
        const { execSync } = require('node:child_process');
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: targetDir, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        if (state.activeMilestone && currentBranch && !currentBranch.includes(state.activeMilestone.toLowerCase()) && !currentBranch.includes(state.activeMilestone)) {
            logger.warn(`BRANCH_CONTEXT_STALE: Active milestone is "${state.activeMilestone}" but current git branch is "${currentBranch}".`);
        }
    } catch (_) {}

    // Check modules
    const modulesDir = fssafe.resolveSafe(targetDir, '.gemstack/modules');
    if (fs.existsSync(modulesDir)) {
        const { validateModuleDrift } = require('../lib/module-manifest');
        for (const file of fs.readdirSync(modulesDir)) {
            if (file.endsWith('.json')) {
                try {
                    const mod = JSON.parse(fs.readFileSync(path.join(modulesDir, file), 'utf8'));
                    const drift = validateModuleDrift(targetDir, mod);
                    if (!drift.valid) {
                        for (const df of drift.findings) {
                            logger.warn(`Module [${mod.module || file}] ${df.code}: ${df.message}`);
                        }
                    }
                } catch (e) {
                    logger.warn(`Malformed module manifest: ${file} (${e.message})`);
                }
            }
        }
    }

    // Check task capsules
    const tasksDir = fssafe.resolveSafe(targetDir, '.gemstack/task-context');
    if (fs.existsSync(tasksDir)) {
        const { validateTaskFreshness } = require('../lib/task-capsule');
        for (const file of fs.readdirSync(tasksDir)) {
            if (file.endsWith('.json')) {
                try {
                    const capsule = JSON.parse(fs.readFileSync(path.join(tasksDir, file), 'utf8'));
                    const fresh = validateTaskFreshness(targetDir, capsule, state.activeMilestone);
                    if (!fresh.valid) {
                        logger.warn(`Task capsule [${capsule.taskId || file}] ${fresh.state}: ${fresh.reason}`);
                    }
                } catch (e) {
                    logger.warn(`Malformed task capsule: ${file} (${e.message})`);
                }
            }
        }
    }

    logger.ok('Doctor checks completed.');
};
