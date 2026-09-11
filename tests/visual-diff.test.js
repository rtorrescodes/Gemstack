const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const {
  compareVisualEvidence,
  applySelectorMasks
} = require('../src/lib/visual-qa');

describe('Upgrade E: Visual Regression & Masking (TEST-VISUAL-C01 .. D02)', () => {

  // --- CATEGORY C: Regression Detection ---

  test('TEST-VISUAL-C01: Detects visual regression when live screenshot deviates from baseline beyond threshold', () => {
    const scenario = {
      scenario_id: 'VQA-BUTTON-001',
      tolerances: {
        max_diff_percentage: 0.01 // 1% allowed
      },
      baseline: {
        image_path: 'baselines/button.png',
        image_sha256: 'canonical_button_hash_1234567890abcdef'
      }
    };

    // Live evidence has diff_percentage of 5% (0.05 > 0.01)
    const regressionEvidence = {
      image_path: 'evidence/button.png',
      image_sha256: 'different_button_hash_9876543210fedcba',
      diff_percentage: 0.05
    };

    const res = compareVisualEvidence(scenario, regressionEvidence, process.cwd());
    assert.equal(res.passed, false);
    assert.equal(res.status, 'VISUAL_REGRESSION');
    assert.equal(res.findings.length, 1);
    assert.equal(res.findings[0].code, 'VQA_VISUAL_REGRESSION');
    assert.equal(res.findings[0].contractId, 'visual-evidence-subordinate');
  });

  test('TEST-VISUAL-C02: Passes comparison cleanly when image hashes match 100%', () => {
    const identicalHash = 'identical_sha256_hash_abcdef1234567890';
    const scenario = {
      scenario_id: 'VQA-HEADER-001',
      tolerances: { max_diff_percentage: 0.00 },
      baseline: {
        image_path: 'baselines/header.png',
        image_sha256: identicalHash
      }
    };

    const identicalEvidence = {
      image_path: 'evidence/header.png',
      image_sha256: identicalHash
    };

    const res = compareVisualEvidence(scenario, identicalEvidence, process.cwd());
    assert.equal(res.passed, true);
    assert.equal(res.status, 'PASS');
    assert.equal(res.diff_percentage, 0.0);
    assert.equal(res.findings.length, 0);
  });

  // --- CATEGORY D: Masking Protection ---

  test('TEST-VISUAL-D01: Applies deterministic neutral masking to dynamic selectors prior to diffing', () => {
    const rawDom = `
<div class="user-card">
  <span class="user-name">Rodrigo</span>
  <span class="dynamic-timestamp">2026-09-11 19:42:00 UTC</span>
  <span class="live-counter">42 requests</span>
</div>
`;
    const masked = applySelectorMasks(rawDom, ['.dynamic-timestamp', '.live-counter']);
    assert.ok(masked.includes('[MASKED_NEUTRAL]'));
    assert.ok(!masked.includes('2026-09-11 19:42:00 UTC'));
    assert.ok(!masked.includes('42 requests'));
    assert.ok(masked.includes('Rodrigo')); // static content remains unmasked
  });

  test('TEST-VISUAL-D02: Enforces mandatory automatic masking of password and sensitive credential fields', () => {
    const rawDom = `
<form id="login">
  <input type="text" name="username" value="admin" />
  <input type="password" name="password" value="SuperSecretPassword123!" />
  <div data-sensitive="true">sk-ant-secret-token-active</div>
</form>
`;
    const masked = applySelectorMasks(rawDom);
    assert.ok(!masked.includes('SuperSecretPassword123!'), 'Password value must not appear in masked DOM');
    assert.ok(!masked.includes('sk-ant-secret-token-active'), 'Sensitive token must not appear in masked DOM');
    assert.ok(masked.includes('[MASKED_SECRET]'));
  });

});
