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

/**
 * Normalizes file paths to repository-relative POSIX format (using forward slashes '/').
 *
 * @param {string} filePath
 * @param {string} [rootPath] - optional repository root
 * @returns {string} normalized POSIX relative path
 */
function normalizePath(filePath, rootPath) {
  if (!filePath) return '';
  let target = filePath;
  if (rootPath) {
    target = path.relative(rootPath, filePath);
  }
  return target.replace(/\\/g, '/');
}

module.exports = {
  normalizeContent,
  hashContent,
  hashFile,
  normalizePath
};
