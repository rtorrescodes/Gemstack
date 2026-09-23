# Feature Specification: Gemstack 2.0 Sprint B — Honest Evidence & Reliable Metrics

**Feature ID:** `012-gemstack-2.0-honest-evidence`  
**Phase:** `spec`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`  
**Sprint:** Sprint B (P1 — Honest Gates, Real Visual Diff, Release Hygiene & Docs Truthfulness)

---

## 1. Context & Business Intent

Gemstack 1.4.0 introduced spending safety gates (`safety-gates.js`), visual QA validation (`visual-qa.js`), and pre-commit hooks. However, an architectural audit revealed trust boundary weaknesses:
1. `safety-gates.js`: Caller-supplied authorization tokens with `max_budget_units` or `source: CLI_FLAG` passed validation without trusted boundary verification; negative unit requests (`requested_units = -1`) could bypass cost ceilings; spending was not tracked cumulatively across calls; tokens lacked cryptographic scope and expiration checks.
2. `visual-qa.js`: Visual comparison blindly accepted caller-supplied `image_sha256` and `diff_percentage` without recomputing hashes from disk or running a real image diff engine. If no diff engine was present, callers could falsely declare `0.0%` diff and achieve `PASS`.
3. Documentation: Unmeasured marketing claims ("military-grade", "physically prevented", "99% OWASP mitigation") did not reflect mechanical reality or acknowledge boundaries between agent guidance, CLI verification, CI enforcement, and human review.
4. GitHub Actions: Actions were referenced via mutable version tags (`@v4`) and workflows lacked explicit least-privilege permission isolation.

Sprint B replaces self-declarations with verifiable, independent evidence, enforces cryptographic and cumulative token authorization, mandates real disk-computed visual evidence with `UNVERIFIED` fallback, establishes a truthful public `Control / Scope / Test / Limit` specification table, and hardens CI/CD workflows to pinned commit SHAs.

---

## 2. User Stories & Acceptance Criteria

### User Story 1: Cryptographic & Cumulative Spending Gate Authorization
**As a** repository administrator or team lead,  
**I want** cost and spending gates to reject self-declared tokens, validate token scope and expiration, check positive unit bounds, and enforce cumulative budget accounting,  
**So that** rogue or buggy agents cannot bypass billable action controls by forging tokens or passing negative units.

### User Story 2: Honest Disk-Computed Visual QA Evidence
**As a** frontend engineer or QA lead,  
**I want** visual comparison to compute image hashes directly from files on disk, calculate real diffs via an adapter, and return `UNVERIFIED` if no diff engine is available,  
**So that** automated visual test suites cannot be fooled by synthetic evidence objects claiming false zero diffs.

### User Story 3: Pre-Persistence Sensitive Data Protection
**As a** Chief Security Officer (CSO),  
**I want** visual capture workflows to sanitize and mask sensitive input fields before writing screenshots to disk,  
**So that** credentials, tokens, and personal data are never persisted in the test evidence directory.

### User Story 4: Truthful Documentation & Control Scope Table
**As an** open-source user or auditor,  
**I want** Gemstack documentation to replace ungrounded marketing claims with an honest `Control / Scope / Test / Limit` matrix,  
**So that** engineering teams understand exactly what Gemstack mechanically enforces versus what requires CI or human review.

### User Story 5: Hardened Least-Privilege GitHub Actions
**As a** DevSecOps engineer,  
**I want** GitHub Actions workflows to pin actions to immutable commit SHAs and specify explicit least-privilege job permissions,  
**So that** the supply chain is protected against tag poisoning and unauthorized token escalation.

---

## 3. Architecture Consistency Contracts

```gemstack-contracts
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

## 4. Canonical Acceptance Test Matrix

```gemstack-test-matrix
[
  {
    "id": "TEST-EVID-A01",
    "category": "SAFETY_GATES",
    "layer": "UNIT",
    "description": "Rejects self-declared or unsigned authorization tokens with BILLABLE_ACTION_UNAUTHORIZED",
    "pass_criteria": "evaluateBillableAction returns DENY with reasonCode BILLABLE_ACTION_UNAUTHORIZED when token is unsigned or self-declared",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-A02",
    "category": "SAFETY_GATES",
    "layer": "UNIT",
    "description": "Rejects non-positive or negative requested units (requested_units <= 0)",
    "pass_criteria": "evaluateBillableAction returns DENY with reasonCode INVALID_REQUESTED_UNITS when requested_units is <= 0 or non-numeric",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-A03",
    "category": "SAFETY_GATES",
    "layer": "UNIT",
    "description": "Rejects token when provider or action does not match token scope",
    "pass_criteria": "evaluateBillableAction returns DENY with reasonCode TOKEN_SCOPE_MISMATCH when token scope does not match action or provider",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-A04",
    "category": "SAFETY_GATES",
    "layer": "UNIT",
    "description": "Rejects expired tokens and tracks cumulative spending against budget limits",
    "pass_criteria": "evaluateBillableAction returns DENY with TOKEN_EXPIRED if past expires_at, and cumulative requests exceeding budget return BUDGET_THRESHOLD_EXCEEDED",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-B01",
    "category": "VISUAL_QA",
    "layer": "INTEGRATION",
    "description": "Recomputes image SHA-256 directly from disk and rejects falsified caller-supplied hashes",
    "pass_criteria": "compareVisualEvidence computes disk hash and rejects spoofed evidence.image_sha256 with VQA_EVIDENCE_HASH_MISMATCH",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-B02",
    "category": "VISUAL_QA",
    "layer": "INTEGRATION",
    "description": "Rejects falsified zero diff percentages and returns UNVERIFIED when no visual diff adapter engine is present",
    "pass_criteria": "When baseline and live hashes differ and no adapter is configured, compareVisualEvidence returns status UNVERIFIED with passed=false",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-B03",
    "category": "VISUAL_QA",
    "layer": "INTEGRATION",
    "description": "Computes real pixel diff via pluggable image adapter and evaluates against scenario threshold",
    "pass_criteria": "With a configured diff adapter, compareVisualEvidence calculates exact mathematical diff and applies tolerance thresholds",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-B04",
    "category": "VISUAL_QA",
    "layer": "UNIT",
    "description": "Enforces pre-persistence masking on credential and sensitive fields before writing capture to disk",
    "pass_criteria": "maskSensitiveFieldsBeforeCapture sanitizes password, secret, and token input nodes in visual capture workflow",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-C01",
    "category": "DOCS_TRUTHFULNESS",
    "layer": "E2E",
    "description": "README.md and documentation contain public Control / Scope / Test / Limit matrix with zero claims of military-grade or physically prevented",
    "pass_criteria": "README.md contains the 4-column matrix and 0 occurrences of military-grade or physically prevented",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-C02",
    "category": "DOCS_TRUTHFULNESS",
    "layer": "E2E",
    "description": "Rule 03 and template Rule 03 contain zero unmeasured 99% OWASP claims and define explicit verification boundaries",
    "pass_criteria": "Both 03-gemstack-security.md files contain zero occurrences of 99% and document verification boundaries",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-C03",
    "category": "DOCS_TRUTHFULNESS",
    "layer": "E2E",
    "description": "Package tarball contents verify clean documentation without unsubstantiated claims",
    "pass_criteria": "npm run ci:all and check-package-contents.js pass with 100% clean documentation",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-D01",
    "category": "CI_HARDENING",
    "layer": "E2E",
    "description": "GitHub Actions workflows pin external actions to immutable commit SHAs",
    "pass_criteria": "actions/checkout, actions/setup-node, and actions/upload-artifact are pinned to 40-character commit SHAs across all workflow YAML files",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-D02",
    "category": "CI_HARDENING",
    "layer": "E2E",
    "description": "GitHub Actions workflows enforce explicit least-privilege job permissions",
    "pass_criteria": "Workflows specify top-level permissions: contents: read, restricting contents: write strictly to release publish job",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-EVID-D03",
    "category": "CI_HARDENING",
    "layer": "E2E",
    "description": "Workflows utilize clean lockfile installation without redundant runs",
    "pass_criteria": "Workflows use npm ci where package-lock.json exists, maintaining zero installation divergence",
    "gate": "REQUIRED"
  }
]
```
