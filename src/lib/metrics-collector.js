const fs = require('node:fs');
const path = require('node:path');
const fssafe = require('./filesystem-safe');

/**
 * Records lightweight execution metrics in .gemstack/metrics/<taskId>.json
 * Guarantees zero sensitive source content or secrets.
 */
function recordTaskMetrics(targetDir, metricData) {
  const metricsDir = path.join(targetDir, '.gemstack', 'metrics');
  if (!fs.existsSync(metricsDir)) {
    fs.mkdirSync(metricsDir, { recursive: true });
  }

  const taskId = metricData.taskId || `task_${Date.now()}`;
  const metricRecord = {
    taskId,
    timestamp: new Date().toISOString(),
    contextFilesOpened: metricData.contextFilesOpened || 0,
    approxInputTokens: metricData.approxInputTokens || 0,
    searchCount: metricData.searchCount || 0,
    repoWideSearchCount: metricData.repoWideSearchCount || 0,
    implementationDurationMs: metricData.implementationDurationMs || 0,
    scopedTestDurationMs: metricData.scopedTestDurationMs || 0,
    fullGateDurationMs: metricData.fullGateDurationMs || 0,
    withinBudget: metricData.withinBudget ?? true,
    testImpact: metricData.testImpact || 'UNIT_LOCAL'
  };

  const metricFile = path.join(metricsDir, `${taskId}.json`);
  fssafe.withConfinedAtomicWrite(targetDir, path.join('.gemstack', 'metrics', `${taskId}.json`), (tempFile) => {
    fs.writeFileSync(tempFile, JSON.stringify(metricRecord, null, 2) + '\n', 'utf8');
  });

  return metricFile;
}

/**
 * Reads all telemetry metrics records.
 */
function readAllMetrics(targetDir) {
  const metricsDir = path.join(targetDir, '.gemstack', 'metrics');
  if (!fs.existsSync(metricsDir)) return [];
  const records = [];
  for (const file of fs.readdirSync(metricsDir)) {
    if (file.endsWith('.json')) {
      try {
        const raw = fs.readFileSync(path.join(metricsDir, file), 'utf8');
        records.push(JSON.parse(raw));
      } catch (_) {}
    }
  }
  return records;
}

module.exports = {
  recordTaskMetrics,
  readAllMetrics
};
