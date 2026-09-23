# Tasks Breakdown: Gemstack 2.0 Sprint B — Honest Evidence & Reliable Metrics

**Feature ID:** `012-gemstack-2.0-honest-evidence`  
**Phase:** `tasks`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Inherited Architecture Contracts

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

## 2. Task Inventory

- [x] **TASK-001: Author adversarial test suite reproducing 1.4.0 vulnerabilities**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-A01, TEST-EVID-A02, TEST-EVID-A03, TEST-EVID-A04, TEST-EVID-B01, TEST-EVID-B02, TEST-EVID-B03, TEST-EVID-B04, TEST-EVID-C01, TEST-EVID-C02, TEST-EVID-C03, TEST-EVID-D01, TEST-EVID-D02, TEST-EVID-D03 -->
  <!-- gemstack:files=tests/honest-evidence-p1.test.js -->
  <!-- gemstack:depends= -->

- [x] **TASK-002: Harden BillableActionGate with trusted boundary tokens and cumulative tracking**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-A01, TEST-EVID-A02, TEST-EVID-A03, TEST-EVID-A04 -->
  <!-- gemstack:files=src/lib/safety-gates.js, src/lib/provider-boundary.js -->
  <!-- gemstack:depends=TASK-001 -->

- [x] **TASK-003: Harden Visual QA with disk-recomputed evidence, adapter diffing, and masking**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-B01, TEST-EVID-B02, TEST-EVID-B03, TEST-EVID-B04 -->
  <!-- gemstack:files=src/lib/visual-qa.js -->
  <!-- gemstack:depends=TASK-001 -->

- [x] **TASK-004: Truthfulness audit: Control matrix and superlative removal in docs & rules**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-C01, TEST-EVID-C02, TEST-EVID-C03 -->
  <!-- gemstack:files=README.md, CONTRIBUTING.md, .agents/rules/03-gemstack-security.md, template/.agents/rules/03-gemstack-security.md -->
  <!-- gemstack:depends=TASK-001 -->

- [x] **TASK-005: Harden GitHub Actions workflows with pinned commit SHAs and least privilege**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-D01, TEST-EVID-D02, TEST-EVID-D03 -->
  <!-- gemstack:files=.github/workflows/main-ci.yml, .github/workflows/pr-ci.yml, .github/workflows/publish.yml, .github/workflows/release-readiness.yml -->
  <!-- gemstack:depends=TASK-001 -->

- [x] **TASK-006: Verify test suite, execute full CI suite, and collect closure evidence**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-EVID-A01, TEST-EVID-A02, TEST-EVID-A03, TEST-EVID-A04, TEST-EVID-B01, TEST-EVID-B02, TEST-EVID-B03, TEST-EVID-B04, TEST-EVID-C01, TEST-EVID-C02, TEST-EVID-C03, TEST-EVID-D01, TEST-EVID-D02, TEST-EVID-D03 -->
  <!-- gemstack:files=tests/honest-evidence-p1.test.js, src/commands/collect.js -->
  <!-- gemstack:depends=TASK-002, TASK-003, TASK-004, TASK-005 -->
