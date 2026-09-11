# Plan de Implementación: Context Capsule / Context Compression (Upgrade D)

**Feature Branch**: `009-context-capsule`  
**Feature Directory**: `specs/009-context-capsule/`  
**Spec**: [`specs/009-context-capsule/spec.md`](file:///c:/CODES/Gemstack/specs/009-context-capsule/spec.md)  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_REVIEW`

---

## 1. Architecture Mapping & Context

Upgrade D establishes a deterministic, auditable, and constraint-lossless architecture for generating compact continuation context (`context-capsule.json`). It solves the problem of cross-session and cross-agent context drift without chat transcripts, heuristic LLM summarization, or network calls.

It builds directly upon the cryptographic and mechanical guarantees of:
- **Upgrade A (Architecture Consistency Engine)**: Deterministic hashing (`src/lib/hasher.js`), canonical contracts (`src/lib/contracts.js`), findings and fingerprints (`src/lib/findings.js`), and atomic state persistence (`src/lib/state.js`).
- **Upgrade B (Mechanical Test Matrix & Closure Evidence)**: Test matrix validation, acceptance signatures (`src/lib/test-matrix.js`), closure context resolution (`src/lib/closure-context.js`), and strict `VERIFY = VALIDATE` read-only evaluation.
- **Upgrade C (Cost & Provider Safety Gates)**: Fail-closed gate evaluation, zero-network verification purity, and strict secret pattern prohibition.

### Architectural Flow:
```text
Authoritative Sources (spec.md, plan.md, tasks.md, .gemstack/state.json, closure.json)
                         │
                         ▼ (Deterministic Resolution & SHA-256 Digesting)
                Source Resolver & Provenance Engine
                         │
                         ▼ (Constraint Extraction: MUST/MUST NOT, Contracts, Matrix)
             Semantic Compression Engine (Zero Prose Scaffolding)
                         │
                         ▼ (Secret Scanner & Size Budget Gate: ≤32KB / 64KB Max)
                    Safety & Privacy Enforcement Barrier
                         │
                         ▼ (UTF-16 Sorted Key Serialization)
              Canonical JSON Generator (`context-capsule.json`)
                         │
         ┌───────────────┴───────────────┐
         ▼                               ▼
CLI Inspection & Verification     Verify Engine (Read-Only Audit)
`gemstack context show/verify`    `gemstack verify` (Stage 5.2)
```

### Central Invariants & Non-Negotiables:
1. `CONTEXT CAPSULE = DERIVED CONTINUATION CONTEXT, NOT CANONICAL PROJECT AUTHORITY`
2. `LESS TEXT ≠ LESS CONSTRAINT` (Semantic Constraint Losslessness: prose is stripped, but 100% of normative `MUST`/`MUST NOT` rules and frozen contracts are retained verbatim).
3. `AUTHORITATIVE ARTIFACT WINS` (If capsule diverges from `spec.md` or `tasks.md`, the source artifact unconditionally governs).
4. `chat transcript ≠ project authority` (Transcripts, conversation logs, and raw git diffs are strictly excluded).
5. `VERIFY = VALIDATE` (`gemstack verify` only validates schema and freshness; it **NEVER** regenerates or mutates capsules).
6. `Offline Purity`: 100% Node.js standard library built-ins (`node:fs`, `node:path`, `node:crypto`). Zero runtime npm dependencies, zero remote AI calls.
7. `Size Pressure Fail-Closed`: Exceeding hard limit (64 KB) throws `CONTEXT_CAPSULE_TOO_LARGE` rather than silently dropping constraints.

---

## 2. Canonical Artifact Placement & Scope

The canonical machine-readable capsule artifact is placed per active feature:
- **Active Feature Capsule**: `specs/<active-spec>/context-capsule.json` (e.g. `specs/009-context-capsule/context-capsule.json`).
- **Project Root Capsule (When No Active Feature)**: `.gemstack/context-capsule.json` is reserved strictly for fully shipped repositories to summarize completed upgrades across the entire project.
- **Canonical Feature Precedence**: When an active feature is present in `.gemstack/state.json` (`active_spec != null`), the feature-local capsule `specs/<active-spec>/context-capsule.json` is the sole canonical target. Dual authority is strictly forbidden.

---

## 3. Context Capsule JSON Schema (v1.0.0)

Conforms to schema version 1 defined in `specs/009-context-capsule/spec.md`:
```json
{
  "$schema": "https://gemstack.dev/schemas/context-capsule-v1.json",
  "schema_version": 1,
  "generated_at": "ISO8601 UTC timestamp",
  "generator": {
    "name": "gemstack",
    "version": "1.2.0"
  },
  "provenance": {
    "source_set_hash": "64-char lowercase hex SHA-256",
    "sources": [
      {
        "path": "specs/009-context-capsule/spec.md",
        "hash": "64-char lowercase hex SHA-256",
        "role": "SPECIFICATION"
      },
      {
        "path": "specs/009-context-capsule/plan.md",
        "hash": "64-char lowercase hex SHA-256",
        "role": "PLAN"
      },
      {
        "path": "specs/009-context-capsule/tasks.md",
        "hash": "64-char lowercase hex SHA-256",
        "role": "TASKS"
      },
      {
        "path": ".gemstack/state.json",
        "hash": "64-char lowercase hex SHA-256",
        "role": "LIFECYCLE_STATE"
      }
    ]
  },
  "project": {
    "name": "gemstack-ai",
    "active_feature": "specs/009-context-capsule",
    "current_phase": "plan",
    "lifecycle_status": "PLAN_COMPLETE",
    "next_permitted_phase": "TASKS"
  },
  "historical_context": [
    {
      "feature": "specs/006-architecture-consistency-engine",
      "status": "CLOSED",
      "key_guarantees": ["Frozen contracts", "Deterministic hashing", "Anti-loop findings"]
    },
    {
      "feature": "specs/007-mechanical-test-matrix-closure-evidence",
      "status": "CLOSED",
      "key_guarantees": ["Mechanical test matrix", "VERIFY = VALIDATE", "closure.json evidence"]
    },
    {
      "feature": "specs/008-cost-provider-safety-gates",
      "status": "CLOSED",
      "key_guarantees": ["NO PROOF = NO EXECUTION", "Fail-closed gates", "Zero network verify"]
    }
  ],
  "architecture_summary": {
    "core_purpose": "Deterministic context compression and safe continuation for AI-assisted engineering.",
    "critical_boundaries": [
      "Capsule is strictly derived, never authoritative",
      "Semantic constraint losslessness: MUST/MUST NOT survive compression",
      "Verification is read-only and never regenerates capsules"
    ]
  },
  "canonical_invariants": [
    {
      "id": "INV-001",
      "rule": "CONTEXT CAPSULE = DERIVED CONTINUATION CONTEXT, NOT CANONICAL AUTHORITY",
      "normative": "MUST",
      "source_ref": "spec.md#3"
    }
  ],
  "frozen_contracts": [
    {
      "id": "zero-dependency-core",
      "type": "BOOLEAN_INVARIANT",
      "value": true
    }
  ],
  "acceptance_matrix": {
    "total_required": 20,
    "signature": "64-char lowercase hex SHA-256",
    "canonical_ids": [
      "TEST-CONTEXT-A01",
      "TEST-CONTEXT-A02",
      "TEST-CONTEXT-H01"
    ]
  },
  "tasks_state": {
    "total": 20,
    "completed": 0,
    "in_progress": null,
    "active_task_ids": ["T001", "T002"]
  },
  "relevant_files": [
    "src/lib/context-capsule.js",
    "tests/context-capsule-determinism.test.js"
  ],
  "deferred_items": [
    "Autonomous cross-repo capsule federations (out of scope)",
    "LLM narrative fine-tuning (non-authoritative)"
  ],
  "unresolved_blockers": []
}
```

---

## 4. Exact Repository Change Map

```text
================================================================================
                          REPOSITORY CHANGE MAP
================================================================================
[NEW PRODUCTION MODULES]
- src/lib/context-capsule.js           : Core engine: source resolution, semantic
                                         compression, secret rejection, size budgeting,
                                         canonical serialization, atomic generation,
                                         and read-only validation.
- src/commands/context.js              : CLI command handler for `gemstack context`
                                         (subcommands: generate, show, verify).

[NEW TEST SUITES]
- tests/context-determinism.test.js    : TEST-CONTEXT-A01..A04 (byte identity, UTF-16 sorting,
                                         volatile timestamp exclusion, POSIX path normalization).
- tests/context-authority.test.js      : TEST-CONTEXT-B01..B04 (authority conflict rejection,
                                         source override, tampering detection, transcript exclusion).
- tests/context-freshness.test.js      : TEST-CONTEXT-C01..C03 (spec/tasks mutation staleness,
                                         unmodified valid state preservation).
- tests/context-constraints.test.js    : TEST-CONTEXT-D01..D02 (100% MUST/MUST NOT extraction,
                                         frozen contract & matrix signature preservation).
- tests/context-secrets.test.js        : TEST-CONTEXT-E01..E03 (forbidden properties, regex token
                                         patterns, .env exclusion fail-closed).
- tests/context-purity.test.js         : TEST-CONTEXT-F01..F02 (verify read-only zero-mutation,
                                         zero network socket execution).
- tests/context-size-budget.test.js    : TEST-CONTEXT-G01 (hard budget overflow fail-closed,
                                         target budget priority condensation).
- tests/context-legacy.test.js         : TEST-CONTEXT-H01 (legacy repository compatibility,
                                         zero blocker notice).

[MODIFIED EXISTING MODULES]
- src/cli.js                           : Register `context` command routing and help text.
- src/commands/verify.js               : Integrate Stage 5.2: Read-only Context Capsule audit
                                         (schema validation, freshness check, legacy notice).
- src/lib/closure-context.js           : Include `context-capsule.json` in relevant closure
                                         files resolution when present.
- package.json                         : Register 8 new test files in npm test script.

[FROZEN / UNTOUCHED]
- Upgrade A Core: src/lib/contracts.js, src/lib/hasher.js, src/lib/findings.js, src/lib/state.js
- Upgrade B Core: src/lib/test-matrix.js, src/lib/runner-adapters.js, src/commands/collect.js,
                  src/commands/ship.js
- Upgrade C Core: src/lib/cost-ledger.js, src/lib/provider-registry.js, src/lib/safety-gates.js,
                  src/lib/provider-boundary.js
- All 17 Historical Test Suites: tests/contracts.test.js through tests/verification-purity-cost.test.js
================================================================================
```

---

## 5. Frozen & Bootstrap Contracts Mapping (`gemstack-contracts`)

Inherits all 8 bootstrap contracts declared in `specs/009-context-capsule/spec.md`. Zero existing frozen contracts from Upgrade A, B, or C are modified.

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Upgrade D implementation must introduce zero external production npm dependencies, using Node.js built-ins exclusively."
  },
  {
    "id": "capsule-is-derived-not-authority",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "The context capsule is strictly a derived projection; authoritative artifacts always override capsule content in case of divergence."
  },
  {
    "id": "compression-preserves-semantic-constraints",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Context compression must never drop, weaken, or generalize normative MUST/MUST NOT behavioral constraints or frozen contracts."
  },
  {
    "id": "verify-never-regenerates-capsule",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "gemstack verify must operate in read-only mode, validating capsule freshness without silently regenerating or mutating files on disk."
  },
  {
    "id": "capsule-secrets-forbidden",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Context capsules must never contain credential tokens, private keys, API secrets, or ambient environment variable values."
  },
  {
    "id": "capsule-offline-deterministic",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Canonical context capsule generation and validation must execute completely offline with deterministic output given identical inputs."
  },
  {
    "id": "capsule-size-budget-fail-closed",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Exceeding the maximum capsule byte budget must fail closed with an explicit finding rather than silently dropping constraints."
  },
  {
    "id": "legacy-capsule-compatibility",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Existing repositories and features lacking context capsules operate cleanly with informational notices and zero false blockers."
  }
]
```

### Bootstrap Contracts Implementation & Validation Mapping:
| Contract ID | Implementation Surface | Validation Mechanism | Future Test File |
| :--- | :--- | :--- | :--- |
| `zero-dependency-core` | `package.json` | `check-package-contents.js` / node stdlib only | `tests/context-purity.test.js` |
| `capsule-is-derived-not-authority` | `src/lib/context-capsule.js` | Resolver priority check & source precedence | `tests/context-authority.test.js` |
| `compression-preserves-semantic-constraints` | `src/lib/context-capsule.js` | Invariant coverage & contract preservation | `tests/context-constraints.test.js` |
| `verify-never-regenerates-capsule` | `src/commands/verify.js` | Filesystem hash comparison before/after | `tests/context-purity.test.js` |
| `capsule-secrets-forbidden` | `src/lib/context-capsule.js` | Property & regex scan on payload | `tests/context-secrets.test.js` |
| `capsule-offline-deterministic` | `src/lib/context-capsule.js` | Multiple runs yield identical SHA-256 | `tests/context-determinism.test.js` |
| `capsule-size-budget-fail-closed` | `src/lib/context-capsule.js` | Serialized UTF-8 byte limit check (64KB) | `tests/context-size-budget.test.js` |
| `legacy-capsule-compatibility` | `src/commands/verify.js` | Graceful fallback & info notice | `tests/context-legacy.test.js` |

---

## 6. Detailed Subsystem Architecture

### 6.1 Source Resolution & Lifecycle Awareness
`resolveAuthoritativeSources(rootPath, featureDir, currentPhase)`:
- Ingests strictly:
  1. `spec.md` (mandatory once active spec exists).
  2. `plan.md` (mandatory in `plan`, `tasks`, `implementation`, `shipped` phases).
  3. `tasks.md` (mandatory in `tasks`, `implementation`, `shipped` phases).
  4. `.gemstack/state.json` (mandatory lifecycle status).
  5. `closure.json` (ingested if present).
  6. `cost-ledger.json` (ingested if present).
- Excludes completely: chat logs, `.git`, `node_modules`, `.env`, build artifacts.
- Computes SHA-256 for each source using `hasher.hashFile(absPath)` and repository-relative POSIX path via `hasher.normalizePath(absPath, rootPath)`.
- Calculates `source_set_hash` by hashing the UTF-16 sorted JSON string of normalized `{ path, hash }` objects.

### 6.2 Semantic Compression Engine
`extractSemanticConstraints(sourceFiles)`:
- Extracts structured blocks via existing parsers:
  - Contracts via `extractContractsBlock` in `src/lib/contracts.js`.
  - Test matrix via `extractTestMatrixBlock` and `validateTestMatrix` in `src/lib/test-matrix.js`.
  - Task metadata via `parseTaskMetadata` in `src/lib/closure-context.js`.
- Extracts normative constraints (`MUST`, `MUST NOT`, `REQUIRED`, `FORBIDDEN`):
  - Parses markdown text lines, extracts numbered rules, list items, and bullet points containing normative terms.
  - Links each extracted rule to its section reference (`source_ref: "spec.md#3"`).
  - Categorizes rules into `MUST` vs `MUST_NOT`.
- Omits background paragraphs, conversational explanations, tutorial prose, and rejected alternative approaches.

### 6.3 Canonical JSON Serialization
`serializeCanonicalJson(data)`:
- Recursively sorts all object keys by UTF-16 code units (`(a < b ? -1 : (a > b ? 1 : 0))`).
- Arrays with primary identifiers (`sources`, `canonical_invariants`, `frozen_contracts`, `canonical_ids`) are sorted deterministically.
- Serializes with 2-space indentation and standard POSIX newline (`\n`).
- Emits byte-identical output across OS environments.

### 6.4 Secret Defense Boundary
`assertSecretsForbidden(capsuleObj)`:
- Inspects property keys against forbidden list: `apiKey`, `api_key`, `token`, `accessToken`, `access_token`, `secret`, `clientSecret`, `password`, `credentials`.
- Scans all string values across the object hierarchy for pattern regexes:
  - AWS keys: `/AKIA[0-9A-Z]{16}/`
  - GitHub tokens: `/gh[pousr]_[A-Za-z0-9_]{36,}/`
  - OpenAI / AI tokens: `/sk-[A-Za-z0-9]{20,}/`
  - Google API keys: `/AIza[0-9A-Za-z-_]{35}/`
  - Bearer tokens: `/Bearer\s+[A-Za-z0-9\-._~+/]+=*/i`
  - Private key headers: `/-----BEGIN[ A-Z0-9_-]*PRIVATE KEY-----/`
- Throws `CONTEXT_CAPSULE_SECRET_DETECTED` fail-closed. Emits zero secret content in error details.

### 6.5 Size Budget & Priority Condensation
`enforceSizeBudget(capsuleObj)`:
- Target Budget: `32,768 bytes` (32 KB).
- Hard Upper Limit: `65,536 bytes` (64 KB).
- If serialized size > 32 KB:
  - Condenses Priority 3 (historical upgrade details condensed to ID and status token).
  - If still > 32 KB, condenses Priority 2 (condenses acceptance descriptions while retaining exact canonical IDs; condenses task descriptions while retaining status counts and active IDs).
- Priority 1 (Authority model, safety invariants, contracts, lifecycle state) is **NEVER** dropped or condensed.
- If serialized size > 64 KB after condensation, throws `CONTEXT_CAPSULE_TOO_LARGE` fail-closed.

### 6.6 Atomic Generation
`generateContextCapsule(rootPath, featureDir, options)`:
- Runs pipeline: Resolve Sources → Extract Constraints → Build Object → Scan Secrets → Enforce Budget → Canonicalize JSON.
- Writes atomically to temporary file `<target>.tmp.<pid>_<timestamp>` in destination directory and renames over destination using Windows-safe bounded retry (reusing `writeJsonAtomic` pattern from `src/lib/state.js`).

### 6.7 Read-Only Validation
`validateContextCapsule(rootPath, featureDir)`:
- Read-only inspection returning `{ valid: boolean, state: 'VALID'|'STALE'|'INVALID'|'MISSING', findings: [] }`.
- Validates:
  1. File existence (if missing: `MISSING`).
  2. Schema version and JSON validity (if malformed: `INVALID`).
  3. Re-computes SHA-256 for all recorded source files on disk. If any hash differs or file is missing, marks `STALE` with `CONTEXT_CAPSULE_STALE`.
  4. Checks for forbidden secrets (`CONTEXT_CAPSULE_SECRET_DETECTED`).
  5. Checks hard size budget (`CONTEXT_CAPSULE_TOO_LARGE`).
  6. Reconciles invariants against `spec.md` (`CONTEXT_CAPSULE_INVARIANT_DROPPED`).
  7. Checks for claims contradicting source (`CONTEXT_CAPSULE_AUTHORITY_CONFLICT`).
- **NEVER** mutates disk or regenerates the capsule.

---

## 7. Findings & Accepted Exceptions Taxonomy

| Finding Code | Severity | Trigger | Fingerprint Inputs | Exception Eligible? |
| :--- | :--- | :--- | :--- | :--- |
| `CONTEXT_CAPSULE_MISSING` | WARNING / BLOCKER | Capsule absent in active feature at ship | code, activeSpec, phase | **NO** |
| `CONTEXT_CAPSULE_INVALID` | BLOCKER | Malformed JSON or invalid schema | code, activeSpec, phase | **NO** |
| `CONTEXT_CAPSULE_STALE` | BLOCKER | Recorded source hash mismatches live file | code, sourcePath, phase | **NO** |
| `CONTEXT_CAPSULE_SOURCE_MISMATCH` | BLOCKER | File listed in sources does not exist | code, missingPath, phase | **NO** |
| `CONTEXT_CAPSULE_SECRET_DETECTED` | BLOCKER | Credential key or token pattern detected | code, fieldName, phase | **NO** |
| `CONTEXT_CAPSULE_INVARIANT_DROPPED`| BLOCKER | Normative rule missing from capsule | code, ruleId, phase | **NO** |
| `CONTEXT_CAPSULE_TOO_LARGE` | BLOCKER | Capsule exceeds 64 KB hard budget | code, byteSize, phase | **NO** |
| `CONTEXT_CAPSULE_AUTHORITY_CONFLICT`| BLOCKER | Capsule claims state contrary to source | code, conflictField, phase | **NO** |

**Zero Waivable Blocker Policy**: Stale, invalid, secret-bearing, or conflicting capsules cannot be waived. Remediation requires explicit regeneration (`gemstack context generate`).

---

## 8. CLI Surface Specification

```text
gemstack context generate [--target <dir>] [--feature <path>]
  --> Compiles authoritative sources into specs/<feature>/context-capsule.json atomically.

gemstack context show [--target <dir>] [--json]
  --> Reads specs/<feature>/context-capsule.json and displays structured summary or formatted JSON.

gemstack context verify [--target <dir>]
  --> Runs standalone read-only validation of context-capsule.json and reports status.
```

### Integration into `gemstack verify`:
In `src/commands/verify.js`, add Stage 5.2 (following closure evidence and cost ledger audits):
```javascript
// 5.2 Verificación de Context Capsule (Upgrade D - Read-Only)
logger.info('--- 5.2 Verificación de Context Capsule (Read-Only) ---');
// Audits active_spec context-capsule.json. Logs legacy notice if absent in legacy feature.
// Emits blocker findings if STALE, INVALID, TOO_LARGE, or SECRET_DETECTED.
// ZERO disk writes, ZERO network requests.
```

---

## 9. Canonical Acceptance Test Bindings (`gemstack-test-bindings`)

The 20 canonical acceptance tests from `specs/009-context-capsule/spec.md` are bound 1:1 to 8 physical test suites:

```gemstack-test-bindings
[
  {
    "test_id": "TEST-CONTEXT-A01",
    "runner": "node:test",
    "file": "tests/context-determinism.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-A02",
    "runner": "node:test",
    "file": "tests/context-determinism.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-A03",
    "runner": "node:test",
    "file": "tests/context-determinism.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-A04",
    "runner": "node:test",
    "file": "tests/context-determinism.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-B01",
    "runner": "node:test",
    "file": "tests/context-authority.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-B02",
    "runner": "node:test",
    "file": "tests/context-authority.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-B03",
    "runner": "node:test",
    "file": "tests/context-authority.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-B04",
    "runner": "node:test",
    "file": "tests/context-authority.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-C01",
    "runner": "node:test",
    "file": "tests/context-freshness.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-C02",
    "runner": "node:test",
    "file": "tests/context-freshness.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-C03",
    "runner": "node:test",
    "file": "tests/context-freshness.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-D01",
    "runner": "node:test",
    "file": "tests/context-constraints.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-D02",
    "runner": "node:test",
    "file": "tests/context-constraints.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-E01",
    "runner": "node:test",
    "file": "tests/context-secrets.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-E02",
    "runner": "node:test",
    "file": "tests/context-secrets.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-E03",
    "runner": "node:test",
    "file": "tests/context-secrets.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-F01",
    "runner": "node:test",
    "file": "tests/context-purity.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-F02",
    "runner": "node:test",
    "file": "tests/context-purity.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-G01",
    "runner": "node:test",
    "file": "tests/context-size-budget.test.js"
  },
  {
    "test_id": "TEST-CONTEXT-H01",
    "runner": "node:test",
    "file": "tests/context-legacy.test.js"
  }
]
```

---

## 10. Project Closure Gates (`gemstack-closure-gates`)

Preserves mandatory project closure gates:

```gemstack-closure-gates
[
  {
    "id": "project-tests",
    "type": "PACKAGE_SCRIPT",
    "script": "test",
    "requirement": "REQUIRED",
    "waivable": false
  },
  {
    "id": "gate-ci-frontmatter",
    "type": "PACKAGE_SCRIPT",
    "script": "ci:frontmatter",
    "requirement": "REQUIRED",
    "waivable": false
  },
  {
    "id": "gate-ci-mojibake",
    "type": "PACKAGE_SCRIPT",
    "script": "ci:mojibake",
    "requirement": "REQUIRED",
    "waivable": false
  }
]
```

---

## 11. Implementation Phasing

```text
Phase 1: Foundation — Serialization, Schema & Secrets Guard
  - Implement src/lib/context-capsule.js core utilities:
    * canonical JSON serializer (UTF-16 sorted keys, array order, 2-space indentation).
    * secret detection scanner (forbidden property names and token regex patterns).
    * size budget counter and priority condensation.
  - Tests: tests/context-determinism.test.js (TEST-CONTEXT-A01..A04),
           tests/context-secrets.test.js (TEST-CONTEXT-E01..E03),
           tests/context-size-budget.test.js (TEST-CONTEXT-G01).

Phase 2: Source Resolution, Provenance & Constraint Compression
  - Implement source ingestion, hashing, and constraint extraction:
    * resolveAuthoritativeSources, source_set_hash calculation.
    * extractSemanticConstraints: normative MUST/MUST NOT extraction, contract preservation.
  - Tests: tests/context-constraints.test.js (TEST-CONTEXT-D01..D02),
           tests/context-authority.test.js (TEST-CONTEXT-B01..B04).

Phase 3: Generator & Validator Engines
  - Implement generateContextCapsule and validateContextCapsule in src/lib/context-capsule.js:
    * atomic file writing.
    * read-only freshness evaluation and state mapping (VALID, STALE, INVALID, MISSING).
  - Tests: tests/context-freshness.test.js (TEST-CONTEXT-C01..C03).

Phase 4: CLI Surface & Verify Read-Only Integration
  - Implement src/commands/context.js and connect to src/cli.js router.
  - Integrate Stage 5.2 Context Capsule audit in src/commands/verify.js.
  - Update src/lib/closure-context.js relevant files resolution.
  - Tests: tests/context-purity.test.js (TEST-CONTEXT-F01..F02),
           tests/context-legacy.test.js (TEST-CONTEXT-H01).

Phase 5: Package Registration & Verification Hardening
  - Register all 8 test files in package.json test script.
  - Execute full test suite (`npm test`), verify passes 0 errors, run CI gates.
```

---

## 12. Dependency Graph

```text
Schema Definition & Canonical Serializer
                  │
                  ▼
Secret Defense & Size Budget Guards
                  │
                  ▼
Source Resolver & Provenance Hasher
                  │
                  ▼
Semantic Constraint Extractor (Normative MUST/MUST NOT)
                  │
                  ▼
Capsule Generator (Atomic Write)
                  │
                  ▼
Capsule Validator (Read-Only Freshness & Schema Audit)
                  │
         ┌────────┴────────┐
         ▼                 ▼
CLI Commands       Verify Command Integration
(`gemstack context`)  (`gemstack verify` Stage 5.2)
         │                 │
         └────────┬────────┘
                  ▼
Canonical Acceptance Test Suite (20 Tests / 8 Files)
                  │
                  ▼
Closure Evidence Collection (`gemstack collect`)
```

---

## 13. Risk Register

| Risk | Impact | Mitigation Strategy | Mechanical Proof |
| :--- | :--- | :--- | :--- |
| **Semantic Constraint Loss** | Agent ignores safety rules | Priority 1 rules immutable; extraction tests verify 100% rule retention | `TEST-CONTEXT-D01` fails if any MUST rule omitted |
| **Capsule Becomes Accidental Authority** | Outdated capsule overrides source | Precedence hierarchy: Authoritative artifact always wins; verify rejects conflicts | `TEST-CONTEXT-B01` asserts authority conflict |
| **False Freshness / Silent Drift** | Stale capsule trusted by agent | Live SHA-256 hash comparison against disk state on every validation | `TEST-CONTEXT-C01` transitions to STALE on edit |
| **Nondeterministic Serialization** | Git noise / hash flapping | Strict UTF-16 code-unit key sorting and stable array ordering | `TEST-CONTEXT-A01` generates byte-identical files |
| **Secret Leakage in Capsule** | Exposed credentials | Strict forbidden keys list and credential regex scanner fail-closed | `TEST-CONTEXT-E01` fails closed on tokens |
| **Oversized Capsule** | Context window exhaustion | 32KB target / 64KB hard limit; fail-closed rejection on overflow | `TEST-CONTEXT-G01` halts with error |
| **Verify Accidentally Regenerating** | Violation of `VERIFY = VALIDATE` | Read-only verify implementation; socket and file mutation mocks | `TEST-CONTEXT-F01` checks 0-byte file diff |
| **Legacy Project Breakage** | Errors in existing repos | Progressive adoption; missing capsule logs info notice and exits 0 | `TEST-CONTEXT-H01` exits with code 0 |

---

## 14. Frozen Contract Compatibility Review

- **Upgrade A Contracts**: Zero conflicts. Reuses `hasher.js`, `contracts.js`, and `findings.js` without modifying existing behavior.
- **Upgrade B Semantics**: Zero conflicts. `VERIFY = VALIDATE` invariant is strictly preserved; `closure.json` evidence collection remains intact.
- **Upgrade C Safety**: Zero conflicts. Provider safety gates and cost ledger validation remain untouched.
- **Frozen Contracts Affected**: **`NONE`**.

---

## 15. Explicit Deferred Work

- Multi-repository capsule federation and aggregation (non-goal).
- Semantic vector embeddings or vector store integration (non-goal).
- Autonomous agent swarms and work-stealing queues (non-goal).
- Visual QA and automated browser capture (non-goal).
- Package version bumping or release publishing (strictly post-closure).
