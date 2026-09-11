const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  parseVisualManifest,
  validateVisualSchema,
  validateViewport,
  validateBaselineIntegrity,
  validateEnvironmentMetadata
} = require('../src/lib/visual-qa');
const { hashContent } = require('../src/lib/hasher');

describe('Upgrade E: Visual Manifest & Baseline Safety (TEST-VISUAL-A01 .. B02)', () => {

  // --- CATEGORY A: Visual Manifest & Viewports ---

  test('TEST-VISUAL-A01: Validates visual-qa.json schema conformance and required scenario properties', () => {
    // 1. Missing route fails
    const missingRoute = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      scenarios: [
        {
          scenario_id: 'VQA-01',
          viewport: { width: 1920, height: 1080 }
          // route missing
        }
      ]
    };
    assert.throws(() => {
      validateVisualSchema(missingRoute);
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_MANIFEST');
      assert.match(err.message, /missing required "route"/i);
      return true;
    });

    // 2. Missing viewport fails
    const missingViewport = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      scenarios: [
        {
          scenario_id: 'VQA-01',
          route: '/dashboard'
          // viewport missing
        }
      ]
    };
    assert.throws(() => {
      validateVisualSchema(missingViewport);
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_MANIFEST');
      assert.match(err.message, /missing required "viewport"/i);
      return true;
    });

    // 3. Duplicate scenario IDs fail
    const duplicateScenarios = {
      version: '1.0.0',
      feature_id: '010-agent-swarm-visual-qa',
      scenarios: [
        { scenario_id: 'VQA-01', route: '/a', viewport: { width: 1920, height: 1080 } },
        { scenario_id: 'VQA-01', route: '/b', viewport: { width: 1920, height: 1080 } }
      ]
    };
    assert.throws(() => {
      validateVisualSchema(duplicateScenarios);
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_MANIFEST');
      assert.match(err.message, /duplicate scenario_id/i);
      return true;
    });
  });

  test('TEST-VISUAL-A02: Validates deterministic viewport specifications across standard profiles', () => {
    // 1. Valid viewport profiles
    assert.doesNotThrow(() => {
      validateViewport({ width: 1920, height: 1080, device_scale_factor: 1 });
      validateViewport({ width: 375, height: 667, device_scale_factor: 2 });
    });

    // 2. Negative height fails
    assert.throws(() => {
      validateViewport({ width: 1920, height: -100 });
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_VIEWPORT');
      assert.match(err.message, /positive integer/i);
      return true;
    });

    // 3. Zero width fails
    assert.throws(() => {
      validateViewport({ width: 0, height: 800 });
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_VIEWPORT');
      assert.match(err.message, /positive integer/i);
      return true;
    });

    // 4. Non-integer width fails
    assert.throws(() => {
      validateViewport({ width: 1920.5, height: 800 });
    }, (err) => {
      assert.equal(err.code, 'VQA_INVALID_VIEWPORT');
      return true;
    });
  });

  // --- CATEGORY B: Baseline Safety & Immutability ---

  test('TEST-VISUAL-B01: Verifies that baseline image files match their recorded SHA-256 hashes', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-vqa-test-'));
    try {
      const imgRelPath = 'baselines/login.png';
      const imgAbsPath = path.join(tempDir, imgRelPath);
      fs.mkdirSync(path.dirname(imgAbsPath), { recursive: true });

      const originalBytes = 'FAKE_PNG_BYTES_CANONICAL';
      fs.writeFileSync(imgAbsPath, originalBytes, 'utf8');

      const canonicalHash = hashContent(originalBytes);

      const scenario = {
        scenario_id: 'VQA-LOGIN-001',
        baseline: {
          image_path: imgRelPath,
          image_sha256: canonicalHash
        }
      };

      // 1. Untampered image validates cleanly
      const validCheck = validateBaselineIntegrity(scenario, tempDir);
      assert.equal(validCheck.valid, true);
      assert.equal(validCheck.findings.length, 0);

      // 2. Tampering bytes on disk triggers VQA_BASELINE_TAMPERED
      fs.writeFileSync(imgAbsPath, 'TAMPERED_PNG_BYTES_ANOMALY', 'utf8');
      const tamperedCheck = validateBaselineIntegrity(scenario, tempDir);
      assert.equal(tamperedCheck.valid, false);
      assert.equal(tamperedCheck.findings.length, 1);
      assert.equal(tamperedCheck.findings[0].code, 'VQA_BASELINE_TAMPERED');
      assert.equal(tamperedCheck.findings[0].contractId, 'baseline-explicit-update-only');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('TEST-VISUAL-B02: Proves baseline images are never silently modified during test execution or verification', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-vqa-test-'));
    try {
      const imgRelPath = 'baselines/card.png';
      const imgAbsPath = path.join(tempDir, imgRelPath);
      fs.mkdirSync(path.dirname(imgAbsPath), { recursive: true });

      const initialBytes = 'INITIAL_CARD_BASELINE';
      fs.writeFileSync(imgAbsPath, initialBytes, 'utf8');
      const initialHash = hashContent(initialBytes);

      const scenario = {
        scenario_id: 'VQA-CARD-001',
        baseline: {
          image_path: imgRelPath,
          image_sha256: initialHash
        }
      };

      // Perform validation check
      validateBaselineIntegrity(scenario, tempDir);

      // Verify file on disk is byte-identical
      const currentBytes = fs.readFileSync(imgAbsPath, 'utf8');
      assert.equal(hashContent(currentBytes), initialHash);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('Environment Metadata: Detects color scheme mismatch between scenario and evidence', () => {
    const scenario = {
      scenario_id: 'VQA-THEME-01',
      viewport: { color_scheme: 'light' }
    };
    const evidence = {
      environment: { color_scheme: 'dark' }
    };

    const envCheck = validateEnvironmentMetadata(scenario, evidence);
    assert.equal(envCheck.valid, false);
    assert.equal(envCheck.findings[0].code, 'VQA_ENVIRONMENT_MISMATCH');
  });

});
