const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  generateFreshnessFingerprints,
  validateTaskFreshness,
  saveTaskCapsule,
  readTaskCapsule,
  refreshTaskCapsule,
  extractTaskText,
  extractSpecInvariantsText,
  extractPlanSectionsText
} = require('../src/lib/task-capsule');
const {
  saveModuleManifest,
  getModuleManifest,
  validateModuleDrift,
  computeModuleHash
} = require('../src/lib/module-manifest');
const {
  computeTaskContextUsage,
  classifyFileSize
} = require('../src/lib/context-budget');
const {
  recordTaskMetrics,
  readAllMetrics
} = require('../src/lib/metrics-collector');
const {
  readState,
  writeStateAtomic
} = require('../src/lib/state');

describe('Gemstack v2.0.3: Context Budgeting, Task Locality & Freshness Engine', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-v203-test-'));
    fs.mkdirSync(path.join(tempDir, '.gemstack'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.gemstack', 'task-context'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, '.gemstack', 'modules'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'specs', 'current'), { recursive: true });
    fs.mkdirSync(path.join(tempDir, 'src', 'graphics'), { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  });

  test('State schema separation: schemaVersion 0.3.0 distinct from frameworkVersion 2.0.3', () => {
    // Write legacy 0.2.0 state without frameworkVersion
    const legacyState = {
      version: '0.2.0',
      current_phase: 'implementation',
      status: 'in_progress',
      active_spec: 'specs/038-graphics-engine'
    };
    fs.writeFileSync(path.join(tempDir, '.gemstack', 'state.json'), JSON.stringify(legacyState, null, 2), 'utf8');

    const loaded = readState(tempDir);
    assert.strictEqual(loaded.schemaVersion, '0.3.0', 'schemaVersion must be 0.3.0');
    assert.strictEqual(loaded.version, '0.3.0', 'compatibility version alias must be 0.3.0');
    assert.strictEqual(loaded.frameworkVersion, '2.0.3', 'frameworkVersion must be 2.0.3');
    assert.strictEqual(loaded.activeMilestone, 'MVP-38', 'Inferred activeMilestone from active_spec');
    assert.strictEqual(loaded.current_phase, 'implementation');
    assert.strictEqual(loaded.blocked, false);

    // Save state and verify it writes schemaVersion 0.3.0 atomically
    writeStateAtomic(tempDir, loaded);
    const rawWritten = JSON.parse(fs.readFileSync(path.join(tempDir, '.gemstack', 'state.json'), 'utf8'));
    assert.strictEqual(rawWritten.schemaVersion, '0.3.0');
    assert.strictEqual(rawWritten.frameworkVersion, '2.0.3');
  });

  test('Task capsule generation, state machine, and dependency freshness', () => {
    // 1. Create spec.md, plan.md, tasks.md
    const specContent = `# Specification
## Invariants
INV-38-001: Program is rendered from immutable snapshot committed by TAKE.
INV-38-004: Alpha compositing must reject invalid channels with StudioRenderError.
INV-38-090: Billing export generates immutable invoice records.
`;
    const planContent = `# Plan
### [graphics-dsk]
Implement downstream DSK layer renderer for studio overlays.
### [billing]
Billing invoice processing logic.
`;
    const tasksContent = `# Tasks
### [ ] TASK-38-20: Implement DSK renderer
- Objective: Render DSK overlays with alpha compositing
- Invariants: INV-38-001, INV-38-004
- Module: graphics-dsk
`;
    fs.writeFileSync(path.join(tempDir, 'specs', 'current', 'spec.md'), specContent, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'specs', 'current', 'plan.md'), planContent, 'utf8');
    fs.writeFileSync(path.join(tempDir, 'specs', 'current', 'tasks.md'), tasksContent, 'utf8');

    // 2. Create source files
    const dskSrc = path.join(tempDir, 'src', 'graphics', 'dsk.ts');
    fs.writeFileSync(dskSrc, '// DSK renderer implementation\nexport const render = () => {};\n', 'utf8');

    // 3. Create module manifest
    const modManifest = {
      module: 'graphics-dsk',
      owns: ['src/graphics/**'],
      contracts: ['StudioControlCommand'],
      dependsOn: [],
      forbiddenDependencies: ['billing']
    };
    saveModuleManifest(tempDir, modManifest);

    // 4. Generate freshness fingerprints
    const fingerprints = generateFreshnessFingerprints(
      tempDir,
      path.join(tempDir, 'specs', 'current'),
      'TASK-38-20',
      ['INV-38-001', 'INV-38-004'],
      ['graphics-dsk'],
      'graphics-dsk'
    );

    const capsule = {
      taskId: 'TASK-38-20',
      milestone: 'MVP-38',
      phase: 'implementation',
      module: 'graphics-dsk',
      objective: 'Implement downstream DSK layer renderer',
      invariants: ['INV-38-001', 'INV-38-004'],
      readFiles: ['src/graphics/dsk.ts'],
      writeFiles: ['src/graphics/dsk.ts'],
      contracts: ['StudioControlCommand'],
      dependencies: [],
      forbiddenScope: ['src/billing/**'],
      tests: ['src/graphics/__tests__/dsk.test.ts'],
      scopedTestCommand: 'npm test src/graphics/__tests__/dsk.test.ts',
      testImpact: 'UNIT_LOCAL',
      acceptanceCriteria: ['Valid alpha rendering'],
      stopConditions: ['Tests pass'],
      freshness: fingerprints
    };

    saveTaskCapsule(tempDir, capsule);

    // 5. Initial validation -> CURRENT
    const check1 = validateTaskFreshness(tempDir, capsule, 'MVP-38');
    assert.strictEqual(check1.valid, true);
    assert.strictEqual(check1.state, 'CURRENT');

    // 6. SPEC invalidation: mutate relevant invariant INV-38-001
    fs.writeFileSync(
      path.join(tempDir, 'specs', 'current', 'spec.md'),
      specContent.replace('committed by TAKE', 'committed by PREVIEW_TAKE'),
      'utf8'
    );
    const checkSpecStale = validateTaskFreshness(tempDir, capsule, 'MVP-38');
    assert.strictEqual(checkSpecStale.valid, false);
    assert.strictEqual(checkSpecStale.state, 'STALE_SPEC');

    // 7. Refresh capsule -> returns to CURRENT
    const refreshed = refreshTaskCapsule(tempDir, 'TASK-38-20', 'specs/current');
    const checkAfterRefresh = validateTaskFreshness(tempDir, refreshed, 'MVP-38');
    assert.strictEqual(checkAfterRefresh.valid, true);
    assert.strictEqual(checkAfterRefresh.state, 'CURRENT');

    // 8. Unrelated SPEC change: modify INV-38-090 (billing)
    const currentSpec = fs.readFileSync(path.join(tempDir, 'specs', 'current', 'spec.md'), 'utf8');
    fs.writeFileSync(
      path.join(tempDir, 'specs', 'current', 'spec.md'),
      currentSpec.replace('immutable invoice records', 'mutable invoice records'),
      'utf8'
    );
    // Capsule depends only on INV-38-001 and INV-38-004 -> MUST REMAIN CURRENT
    const checkUnrelated = validateTaskFreshness(tempDir, refreshed, 'MVP-38');
    assert.strictEqual(checkUnrelated.valid, true, 'Unrelated spec change must not invalidate task capsule');
    assert.strictEqual(checkUnrelated.state, 'CURRENT');

    // 9. PLAN invalidation: modify relevant plan section
    fs.writeFileSync(
      path.join(tempDir, 'specs', 'current', 'plan.md'),
      planContent.replace('Implement downstream DSK layer renderer', 'Completely rewritten plan for DSK'),
      'utf8'
    );
    const checkPlanStale = validateTaskFreshness(tempDir, refreshed, 'MVP-38');
    assert.strictEqual(checkPlanStale.valid, false);
    assert.strictEqual(checkPlanStale.state, 'STALE_PLAN');

    // 10. Module drift & forbidden dependency
    fs.writeFileSync(dskSrc, "import { invoice } from '../billing/tax';\n", 'utf8');
    const modDrift = validateModuleDrift(tempDir, modManifest);
    assert.strictEqual(modDrift.valid, false);
    assert.strictEqual(modDrift.findings[0].code, 'MODULE_BOUNDARY_VIOLATION');
  });

  test('Context Budgeting and File Size Guidance', () => {
    // Create a 600-line file
    const mediumFile = path.join(tempDir, 'medium.js');
    const lines = [];
    for (let i = 0; i < 600; i++) lines.push(`const line${i} = ${i};`);
    fs.writeFileSync(mediumFile, lines.join('\n'), 'utf8');

    const classMed = classifyFileSize(mediumFile);
    assert.strictEqual(classMed.status, 'REVIEW');
    assert.strictEqual(classMed.lines, 600);

    // Compute task context usage
    const usage = computeTaskContextUsage(tempDir, [mediumFile]);
    assert.strictEqual(usage.withinBudget, true);
    assert.strictEqual(usage.fileBreakdowns.length, 1);
  });

  test('Local telemetry metrics recording in .gemstack/metrics/', () => {
    const metricRecord = {
      taskId: 'TASK-38-20',
      contextFilesOpened: 3,
      approxInputTokens: 3400,
      searchCount: 2,
      repoWideSearchCount: 0,
      implementationDurationMs: 1450,
      scopedTestDurationMs: 310,
      fullGateDurationMs: 45000,
      withinBudget: true,
      testImpact: 'UNIT_LOCAL'
    };

    recordTaskMetrics(tempDir, metricRecord);
    const metrics = readAllMetrics(tempDir);
    assert.strictEqual(metrics.length, 1);
    assert.strictEqual(metrics[0].taskId, 'TASK-38-20');
    assert.strictEqual(metrics[0].repoWideSearchCount, 0);
    assert.strictEqual(metrics[0].withinBudget, true);
  });
});
