const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Normalizes content for canonical hashing:
 * - Checks and rejects UTF-8 BOM by throwing CONTRACT_PARSE_ERROR
 * - Normalizes CRLF and lone CR to standard LF
 * Does NOT trim or alter whitespace/markdown/json formatting.
 *
 * @param {string} content
 * @returns {string} normalized string
 */
function normalizeContent(content) {
  if (typeof content !== 'string') {
    throw new TypeError('Content must be a string');
  }

  // Reject UTF-8 BOM
  if (content.charCodeAt(0) === 0xFEFF) {
    const err = new Error('UTF-8 BOM is forbidden in phase artifacts.');
    err.code = 'CONTRACT_PARSE_ERROR';
    throw err;
  }

  // Normalize newlines: CRLF -> LF, then lone CR -> LF
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * Computes canonical 64-character lowercase hexadecimal SHA-256 hash of normalized content.
 *
 * @param {string} content
 * @returns {string} 64-char lowercase hex SHA-256
 */
function hashContent(content) {
  const normalized = normalizeContent(content);
  return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Reads a file as UTF-8 and computes its canonical hash.
 *
 * @param {string} filePath
 * @returns {string} 64-char lowercase hex SHA-256
 */
function hashFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return hashContent(raw);
}

const WINDOWS_DRIVE_RE = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_RE = /^\\\\[^\\/]+[\\/][^\\/]+/;

/**
 * Checks if a path string has Windows structure (drive letter, UNC, or backslashes).
 *
 * @param {string} p
 * @returns {boolean}
 */
function isWindowsPath(p) {
  if (typeof p !== 'string') return false;
  return WINDOWS_DRIVE_RE.test(p) || WINDOWS_UNC_RE.test(p) || p.includes('\\');
}

/**
 * Normalizes file paths to repository-relative POSIX format (using forward slashes '/').
 * Uses explicit path.win32 or path.posix based on input path flavor rather than host OS.
 *
 * @param {string} filePath
 * @param {string} [rootPath] - optional repository root
 * @returns {string} normalized POSIX relative path
 */
function normalizePath(filePath, rootPath) {
  if (!filePath) return '';
  if (!rootPath) {
    return filePath.replace(/\\/g, '/');
  }

  const fileIsWindows = isWindowsPath(filePath);
  const rootIsWindows = isWindowsPath(rootPath);

  const isPosixAbs = (p) => typeof p === 'string' && p.startsWith('/') && !WINDOWS_DRIVE_RE.test(p);
  if ((fileIsWindows && isPosixAbs(rootPath)) || (isPosixAbs(filePath) && rootIsWindows)) {
    throw new Error(`Incompatible mixed path flavors: filePath="${filePath}", rootPath="${rootPath}"`);
  }

  const impl = (fileIsWindows || rootIsWindows) ? path.win32 : path.posix;
  const rel = impl.relative(rootPath, filePath);

  if (rel.startsWith('..\\') || rel.startsWith('../') || rel === '..') {
    throw new Error(`Path "${filePath}" is outside root directory "${rootPath}"`);
  }

  return rel.replace(/\\/g, '/');
}

module.exports = {
  normalizeContent,
  hashContent,
  hashFile,
  normalizePath
};
