const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const safetyGates = require('../src/lib/safety-gates');
const visualQa = require('../src/lib/visual-qa');

describe('Gemstack 2.0 Sprint B: Honest Evidence & Reliable Metrics (P1)', () => {

  // --- Group A: Honest Spending Gates (TEST-EVID-A01 .. A04) ---
  describe('Group A: Honest Spending Gates (TEST-EVID-A01 .. A04)', () => {
    const mockLedger = {
      providers: {
        commercial_llm: {
          id: 'commercial_llm',
          type: 'COMMERCIAL',
          capabilities: {
            text_generation: {
              cost_state: 'BILLABLE',
              estimated_unit_cost: 2
            }
          }
        },
        free_mock: {
          id: 'free_mock',
          type: 'LOCAL_MOCK',
          capabilities: {
            mock_generate: {
              cost_state: 'FREE',
              estimated_unit_cost: 0
            }
          }
        }
      }
    };

    const trustedSecret = 'gemstack-boundary-test-secret-32b!';

    it('TEST-EVID-A01: Rejects self-declared or unsigned authorization tokens with BILLABLE_ACTION_UNAUTHORIZED', () => {
      // 1. Self-declared legacy token claiming granted=true
      const selfDeclaredToken = {
        granted: true,
        max_budget_units: 50,
        source: 'CLI_FLAG'
      };

      const request1 = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 5,
        authorization_token: selfDeclaredToken
      };

      const decision1 = safetyGates.evaluateBillableAction(request1, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decision1.authorized, false);
      assert.strictEqual(decision1.decision, 'DENY');
      assert.strictEqual(decision1.reasonCode, 'BILLABLE_ACTION_UNAUTHORIZED');

      // 2. Properly issued token from trusted boundary passes
      if (typeof safetyGates.issueSpendingToken === 'function') {
        const validToken = safetyGates.issueSpendingToken({
          secret: trustedSecret,
          provider_id: 'commercial_llm',
          action_id: 'generate_summary',
          max_budget_units: 50,
          ttl_seconds: 300
        });

        const request2 = {
          ...request1,
          authorization_token: validToken
        };

        const decision2 = safetyGates.evaluateBillableAction(request2, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
        assert.strictEqual(decision2.authorized, true);
        assert.strictEqual(decision2.decision, 'ALLOW');
      } else {
        assert.fail('safetyGates.issueSpendingToken not implemented');
      }
    });

    it('TEST-EVID-A02: Rejects non-positive or negative requested units (requested_units <= 0)', () => {
      let token = { granted: true };
      if (typeof safetyGates.issueSpendingToken === 'function') {
        token = safetyGates.issueSpendingToken({
          secret: trustedSecret,
          provider_id: 'commercial_llm',
          action_id: 'generate_summary',
          max_budget_units: 50,
          ttl_seconds: 300
        });
      }

      // Negative units attempt (1.4.0 bypass)
      const negativeRequest = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: -10,
        authorization_token: token
      };

      const decisionNegative = safetyGates.evaluateBillableAction(negativeRequest, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decisionNegative.authorized, false);
      assert.strictEqual(decisionNegative.decision, 'DENY');
      assert.strictEqual(decisionNegative.reasonCode, 'INVALID_REQUESTED_UNITS');

      // Zero units attempt
      const zeroRequest = {
        ...negativeRequest,
        requested_units: 0
      };
      const decisionZero = safetyGates.evaluateBillableAction(zeroRequest, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decisionZero.authorized, false);
      assert.strictEqual(decisionZero.reasonCode, 'INVALID_REQUESTED_UNITS');
    });

    it('TEST-EVID-A03: Rejects token when provider or action does not match token scope', () => {
      if (typeof safetyGates.issueSpendingToken !== 'function') {
        assert.fail('safetyGates.issueSpendingToken not implemented');
      }

      // Token scoped for provider "other_provider"
      const mismatchedProviderToken = safetyGates.issueSpendingToken({
        secret: trustedSecret,
        provider_id: 'other_provider',
        action_id: 'generate_summary',
        max_budget_units: 50,
        ttl_seconds: 300
      });

      const reqMismatchedProvider = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 2,
        authorization_token: mismatchedProviderToken
      };

      const decProvider = safetyGates.evaluateBillableAction(reqMismatchedProvider, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decProvider.authorized, false);
      assert.strictEqual(decProvider.reasonCode, 'TOKEN_SCOPE_MISMATCH');

      // Token scoped for action "other_action"
      const mismatchedActionToken = safetyGates.issueSpendingToken({
        secret: trustedSecret,
        provider_id: 'commercial_llm',
        action_id: 'other_action',
        max_budget_units: 50,
        ttl_seconds: 300
      });

      const reqMismatchedAction = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 2,
        authorization_token: mismatchedActionToken
      };

      const decAction = safetyGates.evaluateBillableAction(reqMismatchedAction, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decAction.authorized, false);
      assert.strictEqual(decAction.reasonCode, 'TOKEN_SCOPE_MISMATCH');
    });

    it('TEST-EVID-A04: Rejects expired tokens and tracks cumulative spending against budget limits', () => {
      if (typeof safetyGates.issueSpendingToken !== 'function') {
        assert.fail('safetyGates.issueSpendingToken not implemented');
      }

      // 1. Expired token
      const expiredToken = safetyGates.issueSpendingToken({
        secret: trustedSecret,
        provider_id: 'commercial_llm',
        action_id: 'generate_summary',
        max_budget_units: 50,
        ttl_seconds: -10 // expired in the past
      });

      const reqExpired = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 2,
        authorization_token: expiredToken
      };

      const decExpired = safetyGates.evaluateBillableAction(reqExpired, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(decExpired.authorized, false);
      assert.strictEqual(decExpired.reasonCode, 'TOKEN_EXPIRED');

      // 2. Cumulative spending tracking
      // Unit cost is 2, budget is 10 units max -> exactly 5 requested_units total.
      const cumulativeToken = safetyGates.issueSpendingToken({
        secret: trustedSecret,
        provider_id: 'commercial_llm',
        action_id: 'generate_summary',
        max_budget_units: 10,
        ttl_seconds: 300
      });

      const reqCall1 = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 3, // 3 * 2 = 6 units spent
        authorization_token: cumulativeToken
      };

      const dec1 = safetyGates.evaluateBillableAction(reqCall1, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(dec1.authorized, true);

      // Call 2: requests 3 units (3 * 2 = 6). Cumulative spent would be 6 + 6 = 12 > 10!
      const reqCall2 = {
        action_id: 'generate_summary',
        provider_id: 'commercial_llm',
        capability_id: 'text_generation',
        environment: 'DEVELOPMENT',
        requested_units: 3,
        authorization_token: cumulativeToken
      };

      const dec2 = safetyGates.evaluateBillableAction(reqCall2, mockLedger, { allowBillable: true, boundarySecret: trustedSecret });
      assert.strictEqual(dec2.authorized, false);
      assert.strictEqual(dec2.reasonCode, 'BUDGET_THRESHOLD_EXCEEDED');
    });

  });

  // --- Group B: Honest Visual QA & Evidence Calculation (TEST-EVID-B01 .. B04) ---
  describe('Group B: Honest Visual QA (TEST-EVID-B01 .. B04)', () => {
    let tempDir;
    let baselineRelPath;
    let liveRelPath;
    let baselineHash;
    let liveHash;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-vqa-test-'));
      const baselinesDir = path.join(tempDir, 'specs/010-feature/baselines');
      const evidenceDir = path.join(tempDir, 'specs/010-feature/evidence');
      fs.mkdirSync(baselinesDir, { recursive: true });
      fs.mkdirSync(evidenceDir, { recursive: true });

      const baselineImgContent = Buffer.from('FAKE_PNG_BASELINE_DATA_1111');
      const liveImgContent = Buffer.from('FAKE_PNG_LIVE_DATA_2222_DIFFERENT');

      baselineRelPath = 'specs/010-feature/baselines/login.png';
      liveRelPath = 'specs/010-feature/evidence/login-live.png';

      fs.writeFileSync(path.join(tempDir, baselineRelPath), baselineImgContent);
      fs.writeFileSync(path.join(tempDir, liveRelPath), liveImgContent);

      baselineHash = crypto.createHash('sha256').update(baselineImgContent).digest('hex');
      liveHash = crypto.createHash('sha256').update(liveImgContent).digest('hex');
    });

    afterEach(() => {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-EVID-B01: Recomputes image SHA-256 directly from disk and rejects falsified caller-supplied hashes', () => {
      const scenario = {
        scenario_id: 'login-page',
        route: '/login',
        baseline: {
          image_path: baselineRelPath,
          image_sha256: baselineHash
        }
      };

      // Attacker claims live image hash equals baselineHash, but disk has different file
      const spoofedEvidence = {
        live_screenshot_path: liveRelPath,
        image_sha256: baselineHash // Spoofed!
      };

      const result = visualQa.compareVisualEvidence(scenario, spoofedEvidence, tempDir);
      assert.strictEqual(result.passed, false);
      assert.ok(
        result.status === 'EVIDENCE_HASH_MISMATCH' ||
        result.findings.some(f => f.code === 'VQA_EVIDENCE_HASH_MISMATCH'),
        'Failed to detect spoofed evidence hash'
      );
    });

    it('TEST-EVID-B02: Rejects falsified zero diff percentages and returns UNVERIFIED when no visual diff adapter is present', () => {
      const scenario = {
        scenario_id: 'login-page',
        route: '/login',
        baseline: {
          image_path: baselineRelPath,
          image_sha256: baselineHash
        },
        tolerances: { max_diff_percentage: 0.05 }
      };

      // Attacker claims 0% diff without adapter when hashes differ
      const spoofedDiffEvidence = {
        live_screenshot_path: liveRelPath,
        image_sha256: liveHash,
        diff_percentage: 0.0 // Caller claims 0% diff!
      };

      // Call without diff adapter
      const result = visualQa.compareVisualEvidence(scenario, spoofedDiffEvidence, tempDir);
      assert.strictEqual(result.passed, false);
      assert.strictEqual(result.status, 'UNVERIFIED');
      assert.ok(result.findings.some(f => f.code === 'VQA_DIFF_ENGINE_UNAVAILABLE'));
    });

    it('TEST-EVID-B03: Computes real pixel diff via pluggable image adapter and evaluates against scenario threshold', () => {
      const scenario = {
        scenario_id: 'login-page',
        route: '/login',
        baseline: {
          image_path: baselineRelPath,
          image_sha256: baselineHash
        },
        tolerances: { max_diff_percentage: 0.05 }
      };

      const validEvidence = {
        live_screenshot_path: liveRelPath,
        image_sha256: liveHash
      };

      // Pluggable adapter returning measured diff 0.02 (within 0.05 tolerance)
      const passingAdapter = {
        computeDiff: (baselineBuf, liveBuf) => {
          assert.ok(Buffer.isBuffer(baselineBuf));
          assert.ok(Buffer.isBuffer(liveBuf));
          return { diff_percentage: 0.02, total_pixels: 1000, mismatched_pixels: 20 };
        }
      };

      const resultPass = visualQa.compareVisualEvidence(scenario, validEvidence, tempDir, { diffAdapter: passingAdapter });
      assert.strictEqual(resultPass.passed, true);
      assert.strictEqual(resultPass.status, 'PASS');
      assert.strictEqual(resultPass.diff_percentage, 0.02);

      // Pluggable adapter returning measured diff 0.12 (exceeds 0.05 tolerance)
      const failingAdapter = {
        computeDiff: () => ({ diff_percentage: 0.12, total_pixels: 1000, mismatched_pixels: 120 })
      };

      const resultFail = visualQa.compareVisualEvidence(scenario, validEvidence, tempDir, { diffAdapter: failingAdapter });
      assert.strictEqual(resultFail.passed, false);
      assert.strictEqual(resultFail.status, 'VISUAL_REGRESSION');
      assert.strictEqual(resultFail.diff_percentage, 0.12);
    });

    it('TEST-EVID-B04: Enforces pre-persistence masking on credential and sensitive fields before writing capture to disk', () => {
      if (typeof visualQa.maskSensitiveFieldsBeforeCapture !== 'function') {
        assert.fail('visualQa.maskSensitiveFieldsBeforeCapture not implemented');
      }

      const sampleHtml = `
        <form>
          <input type="text" id="username" value="alice" />
          <input type="password" id="password" value="SuperSecretPassword123" />
          <input type="text" id="api_key" value="sk-live_1234567890abcdef" />
          <input type="text" id="credit_card" value="4111222233334444" />
        </form>
      `;

      const maskedHtml = visualQa.maskSensitiveFieldsBeforeCapture(sampleHtml);
      assert.ok(!maskedHtml.includes('SuperSecretPassword123'), 'Password was not masked');
      assert.ok(!maskedHtml.includes('sk-live_1234567890abcdef'), 'API key was not masked');
      assert.ok(!maskedHtml.includes('4111222233334444'), 'Credit card was not masked');
      assert.ok(maskedHtml.includes('alice'), 'Non-sensitive field should remain intact');
    });

  });

  // --- Group C: Documentation Truthfulness & Control Matrix (TEST-EVID-C01 .. C03) ---
  describe('Group C: Documentation Truthfulness & Control Matrix (TEST-EVID-C01 .. C03)', () => {

    it('TEST-EVID-C01: README.md and documentation contain public Control / Scope / Test / Limit matrix with zero claims of military-grade or physically prevented', () => {
      const readmePath = path.resolve('README.md');
      const readme = fs.readFileSync(readmePath, 'utf8');

      // Verify removal of superlative claims
      assert.ok(!readme.toLowerCase().includes('military-grade'), 'README.md still contains "military-grade" claim');
      assert.ok(!readme.toLowerCase().includes('physically prevented'), 'README.md still contains "physically prevented" claim');

      // Verify presence of Control / Scope / Test / Limit table
      assert.ok(readme.includes('Control'), 'README.md missing Control column');
      assert.ok(readme.includes('Scope'), 'README.md missing Scope column');
      assert.ok(readme.includes('Test Verification') || readme.includes('Prueba'), 'README.md missing Test column');
      assert.ok(readme.includes('Boundary Limit') || readme.includes('Límite'), 'README.md missing Limit column');
    });

    it('TEST-EVID-C02: Rule 03 and template Rule 03 contain zero unmeasured 99% OWASP claims and define explicit verification boundaries', () => {
      const rulePaths = [
        path.resolve('.agents/rules/03-gemstack-security.md'),
        path.resolve('template/.agents/rules/03-gemstack-security.md')
      ];

      for (const p of rulePaths) {
        if (fs.existsSync(p)) {
          const content = fs.readFileSync(p, 'utf8');
          assert.ok(!content.includes('99%'), `${p} still contains unmeasured "99%" claim`);
          assert.ok(!content.toLowerCase().includes('military-grade'), `${p} still contains "military-grade"`);
        }
      }
    });

    it('TEST-EVID-C03: Package tarball contents verify clean documentation without unsubstantiated claims', () => {
      const contributingPath = path.resolve('CONTRIBUTING.md');
      if (fs.existsSync(contributingPath)) {
        const content = fs.readFileSync(contributingPath, 'utf8');
        assert.ok(!content.toLowerCase().includes('military-grade'), 'CONTRIBUTING.md still contains "military-grade"');
      }
    });

  });

  // --- Group D: CI/CD Workflow Hardening & Least Privilege (TEST-EVID-D01 .. D03) ---
  describe('Group D: CI/CD Workflow Hardening (TEST-EVID-D01 .. D03)', () => {
    const workflowsDir = path.resolve('.github/workflows');

    it('TEST-EVID-D01: GitHub Actions workflows pin external actions to immutable commit SHAs', () => {
      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
      assert.ok(files.length > 0, 'No workflow files found');

      const actionRegex = /uses:\s+(actions\/[a-zA-Z0-9_-]+)@([a-zA-Z0-9._-]+)/g;

      for (const file of files) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        let match;
        while ((match = actionRegex.exec(content)) !== null) {
          const action = match[1];
          const ref = match[2];
          // Must be 40-hex commit SHA
          assert.match(
            ref,
            /^[a-f0-9]{40}$/,
            `Workflow ${file} uses unpinned ref "${ref}" for ${action}. Must use 40-character commit SHA.`
          );
        }
      }
    });

    it('TEST-EVID-D02: GitHub Actions workflows enforce explicit least-privilege job permissions', () => {
      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        assert.ok(
          content.includes('permissions:'),
          `Workflow ${file} does not declare explicit permissions`
        );
        // Only publish.yml is permitted to have write permissions for contents
        if (file !== 'publish.yml') {
          assert.ok(!content.includes('contents: write'), `Workflow ${file} has unauthorized contents: write permission`);
        }
      }
    });

    it('TEST-EVID-D03: Workflows utilize clean lockfile installation without redundant runs', () => {
      const files = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

      for (const file of files) {
        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf8');
        // If npm install is called, it should be conditioned on package-lock or use npm ci
        if (content.includes('npm install') && !content.includes('demo-app')) {
          assert.ok(
            content.includes('npm ci') || content.includes('package-lock.json'),
            `Workflow ${file} should prefer npm ci or lockfile check`
          );
        }
      }
    });

  });

});
