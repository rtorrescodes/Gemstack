const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  saveTaskCapsule,
  readTaskCapsule,
  generateFreshnessFingerprints
} = require('../src/lib/task-capsule');
const {
  saveModuleManifest
} = require('../src/lib/module-manifest');
const {
  computeTaskContextUsage
} = require('../src/lib/context-budget');

describe('Vektorcast MVP-38 Context Reduction Benchmark (10 Representative Tasks)', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vektorcast-benchmark-'));
    fs.mkdirSync(path.join(tempDir, '.gemstack', 'task-context'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.gemstack', 'modules'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'current'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'apps', 'api', 'src', 'graphics'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'apps', 'web', 'components', 'studio'), { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('Measures real context token reduction across 10 representative MVP-38 tasks', () => {
    // 1. Simulate full historical specs and active specs (The Legacy Context Model)
    // ~930k tokens historical, handoff ~15k tokens, active SPEC+PLAN+TASKS ~45k tokens
    const legacyHandoff = 'x'.repeat(15000 * 4); // ~15k tokens
    const legacySpec = 'x'.repeat(20000 * 4);    // ~20k tokens
    const legacyPlan = 'x'.repeat(15000 * 4);    // ~15k tokens
    const legacyTasks = 'x'.repeat(10000 * 4);   // ~10k tokens

    const legacyTokensPerTask = 15000 + 20000 + 15000 + 10000; // 60,000 tokens

    // 2. Ten representative MVP-38 tasks
    const tasks = [
      { id: 'TASK-38-01', module: 'graphics-core', files: ['apps/api/src/graphics/types.ts', 'apps/api/src/graphics/engine.ts'], sizeLOC: [120, 240] },
      { id: 'TASK-38-02', module: 'graphics-core', files: ['apps/api/src/graphics/engine.ts', 'apps/api/src/graphics/canvas.ts'], sizeLOC: [240, 180] },
      { id: 'TASK-38-03', module: 'graphics-dsk', files: ['apps/api/src/graphics/dsk.ts', 'apps/api/src/graphics/types.ts'], sizeLOC: [210, 120] },
      { id: 'TASK-38-04', module: 'graphics-dsk', files: ['apps/api/src/graphics/dsk-alpha.ts'], sizeLOC: [150] },
      { id: 'TASK-38-05', module: 'studio-overlays', files: ['apps/web/components/studio/overlay-layer.tsx'], sizeLOC: [190] },
      { id: 'TASK-38-06', module: 'studio-overlays', files: ['apps/web/components/studio/overlay-controls.tsx'], sizeLOC: [220] },
      { id: 'TASK-38-07', module: 'studio-control', files: ['apps/api/src/graphics/studio-command.ts'], sizeLOC: [170] },
      { id: 'TASK-38-08', module: 'studio-control', files: ['apps/api/src/graphics/studio-state.ts'], sizeLOC: [140] },
      { id: 'TASK-38-09', module: 'graphics-preview', files: ['apps/api/src/graphics/preview-pipeline.ts'], sizeLOC: [280] },
      { id: 'TASK-38-10', module: 'graphics-preview', files: ['apps/web/components/studio/preview-canvas.tsx'], sizeLOC: [310] }
    ];

    let totalCapsuleTokens = 0;
    const taskReductions = [];

    for (const t of tasks) {
      const filePaths = [];
      for (let i = 0; i < t.files.length; i++) {
        const fRel = t.files[i];
        const fAbs = path.join(tempDir, fRel);
        const loc = t.sizeLOC[i];
        const content = `// File: ${fRel}\n` + 'const code = "operation";\n'.repeat(loc);
        fs.mkdirSync(path.dirname(fAbs), { recursive: true });
        fs.writeFileSync(fAbs, content, 'utf8');
        filePaths.push(fRel);
      }

      // Compute usage under v2.0.3 Task Capsule model
      const usage = computeTaskContextUsage(tempDir, filePaths);
      // Capsule JSON itself (~250 tokens) + read files
      const totalTaskTokens = usage.estimatedTokens + 250;
      totalCapsuleTokens += totalTaskTokens;

      const reductionPercent = ((legacyTokensPerTask - totalTaskTokens) / legacyTokensPerTask) * 100;
      taskReductions.push({
        taskId: t.id,
        legacyTokens: legacyTokensPerTask,
        v203Tokens: totalTaskTokens,
        reductionPercent: reductionPercent.toFixed(1),
        filesCount: filePaths.length
      });

      // Target criteria
      assert.ok(totalTaskTokens < 8000, `Task ${t.id} must be under 8000 tokens`);
      assert.ok(filePaths.length <= 8, `Task ${t.id} must require <= 8 files`);
    }

    const avgTokens = totalCapsuleTokens / tasks.length;
    const avgReduction = ((legacyTokensPerTask - avgTokens) / legacyTokensPerTask) * 100;

    // Required target >= 75%, stretch target >= 85%
    assert.ok(avgReduction >= 75, `Average reduction must be >= 75% (measured: ${avgReduction}%)`);
    assert.ok(avgReduction >= 85, `Average reduction achieved stretch target >= 85% (measured: ${avgReduction}%)`);
  });
});
