# Implementation Plan: Gemstack 2.0 Sprint B — Honest Evidence & Reliable Metrics

**Feature ID:** `012-gemstack-2.0-honest-evidence`  
**Phase:** `plan`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Inherited Architecture Contracts

```gemstack-inherited-contracts
[
  {
    "id": "gate-token-trusted-boundary",
    "type": "ENUM_SET",
    "values": [
      "signed-token",
      "positive-units",
      "cumulative-budget",
      "scope-binding",
      "expiration-check"
    ]
  },
  {
    "id": "vqa-computed-evidence",
    "type": "ENUM_SET",
    "values": [
      "disk-recomputed-hash",
      "real-image-adapter",
      "unverified-fallback",
      "immutable-baseline"
    ]
  },
  {
    "id": "vqa-pre-persistence-masking",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "truthful-documentation-table",
    "type": "ENUM_SET",
    "values": [
      "control",
      "scope",
      "test",
      "limit"
    ]
  },
  {
    "id": "workflow-least-privilege",
    "type": "ENUM_SET",
    "values": [
      "sha-pinned-actions",
      "permissions-least-privilege",
      "npm-ci"
    ]
  }
]
```

---

## 2. Technical Architecture & Component Changes

### Component 1: `src/lib/safety-gates.js`
- Export `issueSpendingToken({ secret, provider_id, action_id, max_budget_units, ttl_seconds })`: Generates a verifiable token containing `token_id`, `provider_id`, `action_id`, `max_budget_units`, `expires_at`, and HMAC-SHA256 signature using a boundary secret.
- Export `verifySpendingToken(token, secret)`: Validates format, signature, and expiration.
- Add in-memory cumulative spending tracking (`tokenSpendingLedger` or token tracking object) to record cumulative units spent per `token_id`.
- Update `evaluateBillableAction(request, ledger, options)`:
  1. Validate `requested_units`: must be finite positive number (`> 0`). Reject with `INVALID_REQUESTED_UNITS` otherwise.
  2. Validate `authorization_token`: must be present and verified by trusted boundary (`verifySpendingToken` or trusted authority). Reject unsigned/self-declared tokens with `BILLABLE_ACTION_UNAUTHORIZED`.
  3. Validate token scope: `token.provider_id` must match `request.provider_id` (or `'*'`), and `token.action_id` must match `request.action_id` (or `'*'`). Reject mismatches with `TOKEN_SCOPE_MISMATCH`.
  4. Validate expiration: `Date.now() <= Date.parse(token.expires_at)`. Reject expired tokens with `TOKEN_EXPIRED`.
  5. Validate cumulative budget: `(current_spent + estimatedTotalCost) <= token.max_budget_units`. Reject overages with `BUDGET_THRESHOLD_EXCEEDED`. On allow, update cumulative spent units.

### Component 2: `src/lib/visual-qa.js`
- Update `compareVisualEvidence(scenario, evidence, targetDir, options)`:
  1. Recompute `baseline` hash from `scenario.baseline.image_path` on disk using `resolveSafeStrict`. If file is missing or tampered, fail with `VQA_BASELINE_TAMPERED`.
  2. Locate `evidence.live_screenshot_path` on disk using `resolveSafeStrict`. If missing, return `VQA_IMAGE_NOT_FOUND`.
  3. Recompute live screenshot hash from disk. If `evidence.image_sha256` is provided and does not match disk hash, reject with `VQA_EVIDENCE_HASH_MISMATCH`.
  4. Compare disk hashes: If live hash === baseline hash, observed diff is `0.0%` (status `PASS`).
  5. If hashes differ: check if an image diff adapter (`options.diffAdapter`) is provided. If so, execute adapter to calculate mathematical diff. If no adapter is provided, return status `UNVERIFIED` with `passed: false` and finding `VQA_DIFF_ENGINE_UNAVAILABLE`.
- Add `maskSensitiveFieldsBeforeCapture(domTreeOrSelectors)`: sanitizes credential and sensitive fields prior to screenshot persistence.

### Component 3: Documentation & Rules Truthfulness
- `README.md`:
  - Replace "military-grade" badge and text with "Architecture Consistency & Security Gates".
  - Replace "physically prevented" with "Mechanically verified".
  - Add public table: `Control | Scope | Test Verification | Boundary Limit`.
- `.agents/rules/03-gemstack-security.md` & `template/.agents/rules/03-gemstack-security.md`:
  - Replace "mitigar el 99% de las vulnerabilidades comunes (OWASP)" with "Diseño sistemático de controles arquitectónicos y de seguridad verificables".
- `CONTRIBUTING.md`: Remove "military-grade".

### Component 4: GitHub Actions Hardening (`.github/workflows/*`)
- Pin all actions to 40-character commit SHAs:
  - `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2`
  - `actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0`
  - `actions/upload-artifact@4cec3d8aa04e39d1a68397de0c4cd6fb9dce8ec1 # v4.6.1`
- Add top-level `permissions: contents: read` across all workflows; only `publish.yml` gets `contents: write` on the release job.
- Standardize on `npm ci` where `package-lock.json` is present.

---

## 3. Canonical Test Bindings

```gemstack-test-bindings
[
  {
    "id": "TEST-EVID-A01",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-A01"
  },
  {
    "id": "TEST-EVID-A02",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-A02"
  },
  {
    "id": "TEST-EVID-A03",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-A03"
  },
  {
    "id": "TEST-EVID-A04",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-A04"
  },
  {
    "id": "TEST-EVID-B01",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-B01"
  },
  {
    "id": "TEST-EVID-B02",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-B02"
  },
  {
    "id": "TEST-EVID-B03",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-B03"
  },
  {
    "id": "TEST-EVID-B04",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-B04"
  },
  {
    "id": "TEST-EVID-C01",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-C01"
  },
  {
    "id": "TEST-EVID-C02",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-C02"
  },
  {
    "id": "TEST-EVID-C03",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-C03"
  },
  {
    "id": "TEST-EVID-D01",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-D01"
  },
  {
    "id": "TEST-EVID-D02",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-D02"
  },
  {
    "id": "TEST-EVID-D03",
    "file": "tests/honest-evidence-p1.test.js",
    "symbol": "TEST-EVID-D03"
  }
]
```

---

## 4. Mechanical Closure Gates

```gemstack-closure-gates
[
  {
    "id": "gate-test",
    "type": "PACKAGE_SCRIPT",
    "script": "test",
    "requirement": "REQUIRED",
    "waivable": false
  },
  {
    "id": "gate-ci-all",
    "type": "PACKAGE_SCRIPT",
    "script": "ci:all",
    "requirement": "REQUIRED",
    "waivable": false
  }
]
```
