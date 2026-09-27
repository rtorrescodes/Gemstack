const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_BUDGET_TOKENS = 12000;
const TARGET_BUDGET_TOKENS = 8000;

const VALID_JUSTIFICATIONS = new Set([
  'UNRESOLVED_CONTRACT',
  'CONTRADICTION',
  'SECURITY_BOUNDARY',
  'MISSING_TASK_CONTEXT',
  'EXPLICIT_AUDIT'
]);

/**
 * Heuristic approximation: 1 token ~ 4 characters.
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Checks file lines count and returns large-file context classification.
 */
function classifyFileSize(filePath) {
  if (!fs.existsSync(filePath)) return { lines: 0, status: 'NOT_FOUND' };
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').length;

  if (lines > 1200) {
    return { lines, status: 'CRITICAL', guidance: 'File exceeds 1200 LOC. Symbol or range reading MANDATORY. Do NOT ingest full file.' };
  }
  if (lines > 800) {
    return { lines, status: 'HIGH', guidance: 'File exceeds 800 LOC. High context impact. Prefer range or symbol reading.' };
  }
  if (lines > 500) {
    return { lines, status: 'REVIEW', guidance: 'File exceeds 500 LOC. Range reading recommended.' };
  }
  return { lines, status: 'OK', guidance: 'Normal context size.' };
}

/**
 * Computes context budget usage for a task execution.
 */
function computeTaskContextUsage(targetDir, files = []) {
  let totalChars = 0;
  const fileBreakdowns = [];

  for (const f of files) {
    const absPath = path.isAbsolute(f) ? f : path.join(targetDir, f);
    if (fs.existsSync(absPath)) {
      const content = fs.readFileSync(absPath, 'utf8');
      const tokens = estimateTokens(content);
      const sizeClass = classifyFileSize(absPath);
      totalChars += content.length;
      fileBreakdowns.push({
        path: path.relative(targetDir, absPath).replace(/\\/g, '/'),
        tokens,
        lines: sizeClass.lines,
        status: sizeClass.status
      });
    }
  }

  const estimatedTokens = Math.ceil(totalChars / 4);
  const withinTarget = estimatedTokens <= TARGET_BUDGET_TOKENS;
  const withinBudget = estimatedTokens <= DEFAULT_BUDGET_TOKENS;

  return {
    estimatedTokens,
    targetBudgetTokens: TARGET_BUDGET_TOKENS,
    maxBudgetTokens: DEFAULT_BUDGET_TOKENS,
    withinTarget,
    withinBudget,
    fileBreakdowns
  };
}

module.exports = {
  DEFAULT_BUDGET_TOKENS,
  TARGET_BUDGET_TOKENS,
  VALID_JUSTIFICATIONS,
  estimateTokens,
  classifyFileSize,
  computeTaskContextUsage
};
