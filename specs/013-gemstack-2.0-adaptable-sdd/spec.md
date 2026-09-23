# Specification: Gemstack 2.0 Sprint C — Adaptable SDD & Incremental Specs

**Feature ID:** `013-gemstack-2.0-adaptable-sdd`  
**Phase:** `spec`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Context & Objectives

Gemstack's core strength is Spec-Driven Development (SDD) with strict frozen contracts. However, real-world development highlighted key friction points:
1. **One-size-fits-all overhead**: A one-line cosmetic fix or documentation update required the full overhead of 3 separate artifacts (`spec.md` -> `plan.md` -> `tasks.md`).
2. **High-risk blindness**: Critical architectural changes or auth refactors were treated with the same validation depth as regular features, lacking mandatory threat models or dual human sign-off.
3. **Destructive spec overwrites in concurrent features**: Parallel branches modifying specs routinely clobbered baseline requirements instead of declaring incremental diffs (`ADDED`, `MODIFIED`, `REMOVED`).
4. **Silent contract tampering vs. Audited amendments**: Contracts were either completely immutable or subject to uncontrolled modification without auditable justification and cryptographic approval.

Sprint C resolves these challenges by introducing:
- **Four Rigor Levels**: `quick`, `fix`, `feature`, and `high-risk`.
- **Incremental Spec Deltas**: Structured `ADDED`, `MODIFIED`, and `REMOVED` declarations.
- **Spec Merge & Conflict Detector**: `gemstack spec merge` to detect colliding contract IDs and canonical test IDs across branches.
- **Auditable Contract Amendments**: Formal versioned amendments replacing silent mutations.

---

## 2. User Scenarios & Acceptance Criteria

### User Story 1 — Flexible Rigor Levels (Priority: P1)
As an engineer making a minor tweak or bugfix, I want an appropriate SDD rigor level so I can deliver safe code without unnecessary bureaucracy, while critical changes enforce maximum scrutiny.
- **Scenario 1.1 (quick)**: A cosmetic change with `rigor: quick` is verified with a single concise artifact without blocking on missing `plan.md` or `tasks.md`.
- **Scenario 1.2 (fix)**: A bugfix with `rigor: fix` requires a linked regression test (`REGRESSION` category or `REG` ID) that validates the fix.
- **Scenario 1.3 (feature)**: A standard feature enforces the full 3-phase lifecycle.
- **Scenario 1.4 (high-risk)**: A critical change fails closed unless it contains an explicit Threat Model, Rollback Plan, and 2 distinct human approval signatures.

### User Story 2 — Incremental Spec Deltas (Priority: P1)
As an agent or engineer building on an existing feature, I want to declare spec deltas (`ADDED`, `MODIFIED`, `REMOVED`) so that concurrent work doesn't clobber baseline requirements.
- **Scenario 2.1**: An incremental delta successfully parses and overlays onto the base specification.
- **Scenario 2.2**: Unmodified baseline requirements are preserved intact in the effective merged specification.
- **Scenario 2.3**: Unmatched modifications fail closed with clear error messaging.

### User Story 3 — Offline Spec Conflict & Collision Detection (Priority: P1)
As a lead architect merging feature branches, I want `gemstack spec merge` to mechanically detect contract and test ID collisions before merging.
- **Scenario 3.1**: Identifies colliding contract IDs with divergent values or schemas across branches and aborts.
- **Scenario 3.2**: Detects duplicate canonical test IDs declared across concurrent specs.
- **Scenario 3.3**: Merges cleanly when contract and test sets are disjoint or mutually consistent.

### User Story 4 — Formal Contract Amendments (Priority: P1)
As a security auditor, I want any change to a frozen architectural contract to require a formal, signed amendment record so that contract evolution is auditable and non-repudiable.
- **Scenario 4.1**: Contract changes accompanied by a valid, approved amendment record pass verification.
- **Scenario 4.2**: Unapproved, missing, or signature-mismatched amendments fail closed.
- **Scenario 4.3**: Amendment integrity hash validates against canonical amendment fields.

---

## 3. Architecture Contracts

```gemstack-contracts
[
  {
    "id": "sdd-rigor-levels",
    "type": "ENUM_SET",
    "values": [
      "quick",
      "fix",
      "feature",
      "high-risk"
    ],
    "description": "Supported SDD rigor levels defining required artifacts, testing depth, and review requirements."
  },
  {
    "id": "incremental-spec-deltas",
    "type": "ENUM_SET",
    "values": [
      "added",
      "modified",
      "removed"
    ],
    "description": "Allowed delta actions for incremental spec declarations."
  },
  {
    "id": "spec-conflict-detector",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Offline conflict detection detects colliding contract IDs and duplicate test IDs across branches or spec directories."
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
    ],
    "description": "Mandatory fields for formal contract amendment records."
  }
]
```

---

## 4. Mechanical Acceptance Matrix

```gemstack-test-matrix
[
  {
    "id": "TEST-RIGOR-A01",
    "category": "RIGOR",
    "layer": "UNIT",
    "description": "Quick rigor level validates with single artifact without requiring plan/tasks when verified",
    "pass_criteria": "validateRigorRequirements returns valid=true for quick spec with 1 artifact",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-RIGOR-A02",
    "category": "RIGOR",
    "layer": "UNIT",
    "description": "Fix rigor level enforces presence of linked regression test in test matrix",
    "pass_criteria": "Fails closed when fix spec has no regression test; passes when regression test is bound",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-RIGOR-A03",
    "category": "RIGOR",
    "layer": "UNIT",
    "description": "Feature rigor level enforces complete 3-phase SDD artifacts and closure manifest",
    "pass_criteria": "Rejects missing plan/tasks in feature mode; passes when full lifecycle is present",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-RIGOR-A04",
    "category": "RIGOR",
    "layer": "UNIT",
    "description": "High-risk rigor level fails closed without Threat Model, Rollback Plan, and 2 distinct human approvals",
    "pass_criteria": "Rejects high-risk spec missing threat model, rollback plan, or dual human signatures",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DELTA-B01",
    "category": "DELTA",
    "layer": "UNIT",
    "description": "Parses and applies ADDED, MODIFIED, and REMOVED deltas onto a base spec",
    "pass_criteria": "Merged specification accurately reflects additions, modifications, and removals",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DELTA-B02",
    "category": "DELTA",
    "layer": "UNIT",
    "description": "Preserves untouched baseline requirements and contracts when applying incremental deltas",
    "pass_criteria": "Baseline items not mentioned in delta remain intact in effective merged spec",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DELTA-B03",
    "category": "DELTA",
    "layer": "UNIT",
    "description": "Fails closed when an incremental delta modifies or removes a non-existent item",
    "pass_criteria": "Throws DELTA_TARGET_NOT_FOUND error when target item does not exist in base",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MERGE-C01",
    "category": "MERGE",
    "layer": "UNIT",
    "description": "Spec merge detects colliding contract IDs with divergent values or schemas across branches",
    "pass_criteria": "detectSpecConflicts flags CONTRACT_COLLISION with conflicting values",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MERGE-C02",
    "category": "MERGE",
    "layer": "UNIT",
    "description": "Spec merge detects colliding canonical test IDs declared across concurrent specs",
    "pass_criteria": "detectSpecConflicts flags DUPLICATE_TEST_ID across merged specs",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MERGE-C03",
    "category": "MERGE",
    "layer": "UNIT",
    "description": "Spec merge succeeds cleanly when contract sets and test IDs are disjoint or identical",
    "pass_criteria": "detectSpecConflicts returns conflicts=[] and valid=true for clean specs",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-AMEND-D01",
    "category": "AMENDMENT",
    "layer": "UNIT",
    "description": "Accepts contract modification only when accompanied by a valid formal amendment record",
    "pass_criteria": "validateContractAmendments approves modification with valid amendment; fails without it",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-AMEND-D02",
    "category": "AMENDMENT",
    "layer": "UNIT",
    "description": "Rejects contract amendments that are unapproved or have invalid cryptographic signatures",
    "pass_criteria": "Fails closed with AMENDMENT_SIGNATURE_INVALID on tampered signature",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-AMEND-D03",
    "category": "AMENDMENT",
    "layer": "UNIT",
    "description": "Verifies amendment integrity hash over amendment fields (amendment_id, contract_id, reason)",
    "pass_criteria": "computeAmendmentSignature matches expected SHA-256 digest over normalized fields",
    "gate": "REQUIRED"
  }
]
```
