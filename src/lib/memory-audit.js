'use strict';

/**
 * Memory Cross-Audit Engine (Gemstack 2.0 Sprint D)
 * Reconciles git commit log with handoff.md to detect unrecorded work and memory drift.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const fssafe = require('./filesystem-safe');

const MANDATORY_SECTIONS = [
  '1. Objetivo',
  '2. Estado actual',
  '3. Archivos y cambios',
  '4. Intentos fallidos',
  '5. Próximos pasos'
];

/**
 * Extracts recent git commits offline from the repository log.
 * @param {string} targetDir 
 * @param {number} limit 
 * @returns {Array<{ hash: string, message: string }>}
 */
function getRecentGitCommits(targetDir, limit = 5) {
  try {
    const gitRes = spawnSync('git', ['log', `-n${limit}`, '--oneline'], {
      cwd: targetDir,
      encoding: 'utf8',
      shell: false
    });

    if (gitRes.status !== 0 || !gitRes.stdout) {
      return [];
    }

    return gitRes.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const parts = line.trim().split(' ');
        const hash = parts[0];
        const message = parts.slice(1).join(' ');
        return { hash, message };
      });
  } catch (_) {
    return [];
  }
}

/**
 * Validates handoff integrity and cross-checks recent git commits against handoff records.
 * @param {string} targetDir - Directory containing handoff.md
 * @param {object} options - { commits?: Array<{ hash: string, message: string }>, limit?: number }
 * @returns {{ valid: boolean, handoff_intact: boolean, unrecorded_commits: Array<object>, error?: string }}
 */
function crossAuditMemoryWithGit(targetDir, options = {}) {
  const handoffPath = fssafe.resolveSafe(targetDir, 'handoff.md');
  if (!fs.existsSync(handoffPath)) {
    return {
      valid: false,
      handoff_intact: false,
      unrecorded_commits: [],
      error: 'handoff.md no encontrado en el directorio raíz'
    };
  }

  const handoffContent = fs.readFileSync(handoffPath, 'utf8');

  // 1. Verify mandatory sections
  for (const sec of MANDATORY_SECTIONS) {
    if (!handoffContent.includes(sec)) {
      return {
        valid: false,
        handoff_intact: false,
        missing_section: sec,
        unrecorded_commits: [],
        error: `handoff.md carece de la sección obligatoria: "${sec}".`
      };
    }
  }

  // 2. Obtain commits to check
  const commits = options.commits || getRecentGitCommits(targetDir, options.limit || 5);
  const unrecordedCommits = [];

  for (const c of commits) {
    // Check if commit hash or key terms of message are mentioned in handoff
    const hashFound = c.hash && handoffContent.toLowerCase().includes(c.hash.toLowerCase());
    
    // Extract meaningful words (length >= 5) from commit message
    const words = c.message
      ? c.message
          .replace(/[^\w\s-]/g, '')
          .split(/\s+/)
          .filter(w => w.length >= 5)
      : [];

    const wordsFound = words.length > 0 && words.some(w => handoffContent.toLowerCase().includes(w.toLowerCase()));

    if (!hashFound && !wordsFound) {
      unrecordedCommits.push(c);
    }
  }

  return {
    valid: unrecordedCommits.length === 0,
    handoff_intact: true,
    unrecorded_commits: unrecordedCommits,
    recent_commits_checked: commits.length
  };
}

module.exports = {
  MANDATORY_SECTIONS,
  getRecentGitCommits,
  crossAuditMemoryWithGit
};
