# Implementation Plan: Gemstack 2.0 Sprint C — Adaptable SDD & Incremental Specs

**Feature ID:** `013-gemstack-2.0-adaptable-sdd`  
**Phase:** `plan`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Inherited Architecture Contracts

```gemstack-inherited-contracts
[
  {
    "id": "sdd-rigor-levels",
    "type": "ENUM_SET",
    "values": [
      "quick",
      "fix",
      "feature",
      "high-risk"
    ]
  },
  {
    "id": "incremental-spec-deltas",
    "type": "ENUM_SET",
    "values": [
      "added",
      "modified",
      "removed"
    ]
  },
  {
    "id": "spec-conflict-detector",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "formal-contract-amendment",
    "type": "ENUM_SET",
    "values": [
      "amendment-id",
      "contract-id",
      "version",
      "reason",
      "approved-by",
      "signature"
    ]
  }
]
```

---

## 2. Technical Architecture & Modules

### 2.1 Rigor Engine (`src/lib/sdd-rigor.js`)
- `detectRigorLevel(specContent)`: Extracts declared rigor level from frontmatter or document metadata (`rigor: quick | fix | feature | high-risk`, default: `feature`).
- `validateRigorRequirements(rigorLevel, context)`:
  - `quick`: Requires single valid artifact (`quick.md` or `spec.md`). Does not require `plan.md` or `tasks.md`.
  - `fix`: Requires test matrix with at least one regression test (`category: REGRESSION` or ID containing `REG`).
  - `feature`: Standard 3-phase SDD with full `plan.md`, `tasks.md`, and complete traceability.
  - `high-risk`: Must include explicit Threat Model, Rollback Plan, and 2 distinct human approval signatures in sidecar (`approvals: [{ approver, signature, timestamp }, ...]`).

### 2.2 Incremental Spec Engine (`src/lib/spec-delta.js`)
- `parseSpecDelta(deltaContent)`: Parses structured delta declarations containing `ADDED`, `MODIFIED`, and `REMOVED` sections for contracts, requirements, and test matrices.
- `applySpecDelta(baseSpec, delta)`: Applies diff onto base spec without clobbering unmentioned baseline requirements. Fails closed with `DELTA_TARGET_NOT_FOUND` if modifying a non-existent item.

### 2.3 Spec Conflict & Merge Engine (`src/lib/spec-merge.js`)
- `detectSpecConflicts(specA, specB)`:
  - Compares `gemstack-contracts` across both specs. Flags `CONTRACT_COLLISION` if the same contract ID exists with different types, values, or schemas.
  - Compares `gemstack-test-matrix`. Flags `DUPLICATE_TEST_ID` if identical test IDs exist across both specs with divergent descriptions or layers.
- `mergeSpecs(specA, specB)`: Produces merged spec when conflict checks pass cleanly.

### 2.4 Contract Amendment Engine (`src/lib/contract-amendments.js`)
- `computeAmendmentSignature(amendment, secret)`: Computes HMAC-SHA256 or SHA-256 over normalized amendment properties (`amendment_id`, `contract_id`, `version`, `reason`, `approved_by`).
- `validateContractAmendments(upstreamContracts, currentContracts, amendments, options)`:
  - Verifies that any contract modified or removed from upstream is justified by a valid, signed amendment record.
  - Rejects unapproved or signature-mismatched amendments (`AMENDMENT_SIGNATURE_INVALID`).

### 2.5 CLI Integration (`src/commands/spec.js` and `src/cli.js`)
- `gemstack spec merge <targetSpecDir>`: Merges another spec directory or branch into active spec with automated conflict detection.
- `gemstack spec validate`: Validates rigor compliance and amendment integrity.

---

## 3. Physical Test Bindings

```gemstack-test-bindings
[
  {
    "id": "TEST-RIGOR-A01",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Quick rigor level validates with single artifact without requiring plan/tasks"
  },
  {
    "id": "TEST-RIGOR-A02",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Fix rigor level enforces presence of linked regression test in test matrix"
  },
  {
    "id": "TEST-RIGOR-A03",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Feature rigor level enforces complete 3-phase SDD artifacts and closure manifest"
  },
  {
    "id": "TEST-RIGOR-A04",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "High-risk rigor level fails closed without Threat Model, Rollback Plan, and 2 approvals"
  },
  {
    "id": "TEST-DELTA-B01",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Parses and applies ADDED, MODIFIED, and REMOVED deltas onto a base spec"
  },
  {
    "id": "TEST-DELTA-B02",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Preserves untouched baseline requirements and contracts when applying deltas"
  },
  {
    "id": "TEST-DELTA-B03",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Fails closed when an incremental delta modifies or removes a non-existent item"
  },
  {
    "id": "TEST-MERGE-C01",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Spec merge detects colliding contract IDs with divergent values or schemas"
  },
  {
    "id": "TEST-MERGE-C02",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Spec merge detects colliding canonical test IDs declared across concurrent specs"
  },
  {
    "id": "TEST-MERGE-C03",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Spec merge succeeds cleanly when contract sets and test IDs are disjoint or identical"
  },
  {
    "id": "TEST-AMEND-D01",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Accepts contract modification only when accompanied by a valid formal amendment record"
  },
  {
    "id": "TEST-AMEND-D02",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Rejects contract amendments that are unapproved or have invalid signatures"
  },
  {
    "id": "TEST-AMEND-D03",
    "file": "tests/adaptable-sdd-p1.test.js",
    "symbol": "Verifies amendment integrity hash over amendment fields"
  }
]
```

---

## 4. Mandatory Package Script Closure Gates

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
