# Plan de Implementación: Mechanical Test Matrix & Closure Evidence (Upgrade B)

**Feature Branch**: `007-mechanical-test-matrix-closure-evidence`  
**Spec**: [`specs/007-mechanical-test-matrix-closure-evidence/spec.md`](file:///c:/CODES/Gemstack/specs/007-mechanical-test-matrix-closure-evidence/spec.md)  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_REVIEW`

---

## 1. Primary Objective & Context

Upgrade B upgrades Gemstack from an *Architecture Consistency Engine* to an **Architecture Consistency and Mechanical Implementation Closure Engine**.
It eliminates false closure by establishing an empirical, deterministic chain of verification custody:
```text
SPEC (gemstack-test-matrix: canonical identity & criteria)
  → PLAN (gemstack-test-bindings & gemstack-closure-gates: execution & physical mapping)
    → TASKS (TASK → TEST IDs & file bindings: execution tracking)
      → COLLECT (gemstack collect: native execution & structured closure.json generation)
        → VERIFY (gemstack verify: strictly read-only validation & staleness detection)
          → SHIP (gemstack ship: fresh evidence gatekeeper & lifecycle closure)
```

### Invariants & Non-Negotiable Rules:
1. **Zero External Runtime Dependencies**: Standard Node.js library exclusively (`node:fs`, `node:path`, `node:crypto`, `node:child_process`).
2. **VERIFY is ALWAYS Read-Only**: `gemstack verify` validates existing evidence, computes in-memory status, and NEVER writes to disk, regenerates evidence, or mutates `closure.json`, `state.json`, or sidecars. There is NO `--collect` flag on verify.
3. **Dedicated COLLECT Command**: `gemstack collect` is the explicit, mutating evidence collection action.
4. **Git is Strictly Optional**: Non-Git repositories and dirty working trees are fully supported.
5. **No Shell Execution**: Subprocesses execute with `shell: false` and explicit argv arrays.
6. **Strict Roadmap Scope Isolation**:
   - **Upgrade C (Cost & Provider Safety Gates)**: Billable-action protection, provider approval gates, cost-awareness before paid validations, and human approval before billable actions. Excluded from Upgrade B.
   - **Upgrade D (Context Capsule / Context Compression)**: Compact deterministic project context, handoff/context efficiency, and reduced repeated reconstruction. Excluded from Upgrade B.

---

## 2. Constitution & Simplicity Check

- [x] **Simplicity Gate**: Minimal module footprint (3 new libraries in `src/lib/`, 1 new command in `src/commands/`, extension of `verify.js` and `cli.js`).
- [x] **Anti-Abstraction Gate**: Direct use of Node.js built-ins. No AST parsers, no external test frameworks.
- [x] **Test-First Imperative**: All 20 canonical P1 tests defined, mapped, and verified in TDD waves before implementation.
- [x] **Zero Silent Failures**: Explicit error codes, exact mathematical reconciliation equations, and strict exit code propagation.

---

## 3. Module Architecture & Boundaries

```text
c:\CODES\Gemstack\
├── src\
│   ├── lib\
│   │   ├── hasher.js              <-- [REUSE] normalizeContent, hashFile, normalizePath
│   │   ├── contracts.js           <-- [REUSE] column-0 fenced block parsing architecture
│   │   ├── findings.js            <-- [REUSE] computeFindingFingerprint, createFinding, exceptions
│   │   ├── state.js               <-- [REUSE] readState, writeStateAtomic, readSidecar, writeSidecarAtomic
│   │   ├── test-matrix.js         <-- [NEW] Parser and validator for test matrix & acceptanceSignature
│   │   ├── closure-context.js     <-- [NEW] RelevantClosureFiles, content digests, and closureContextHash
│   │   └── runner-adapters.js     <-- [NEW] Native runner execution, TAP ingestion, and reconciliation
│   └── commands\
│       ├── collect.js             <-- [NEW] Mutating evidence collector: runs tests and writes specs/<feature>/closure.json
│       └── verify.js              <-- [EXTEND] Stage 5: Read-only closure evidence validation; Stage 6: Security and Test Runners
├── specs\
│   └── 007-mechanical-test-matrix-closure-evidence\
│       ├── spec.md                <-- [FROZEN]
│       ├── plan.md                <-- [THIS DOCUMENT]
│       ├── tasks.md               <-- [NEXT PHASE]
│       └── closure.json           <-- [GENERATED SNAPSHOT ON COLLECT: specs/<feature>/closure.json]
└── tests\
    ├── test-matrix.test.js        <-- [NEW] P1 Categories A & B (Parsing, Duplicates, Signature Digest)
    ├── reconciliation.test.js     <-- [NEW] P1 Category C (Exact Math, Phantoms, Orphans, Missing Tests)
    ├── runner-adapter.test.js     <-- [NEW] P1 Category D (node:test execution, title token extraction)
    ├── traceability.test.js       <-- [NEW] P1 Category E (TASK -> TEST bindings, validation_required)
    ├── closure-manifest.test.js   <-- [NEW] P1 Category F (closure.json schema, context hashing, stale detection)
    └── closure-gates.test.js      <-- [NEW] P1 Categories G & H (Ship gate blocking, verified states, legacy mode)
```

### Module Specifications:

#### 3.1 `src/lib/test-matrix.js`
- **Purpose**: Extract, parse, and validate `gemstack-test-matrix` column-0 fenced blocks and compute the deterministic `acceptanceSignature`.
- **Public Functions**:
  - `extractTestMatrixBlock(content: string): { matrix: object[]|null, isLegacy: boolean }`
  - `validateTestMatrix(matrix: any): object[]` (returns validated array or throws specific errors)
  - `computeAcceptanceSignature(matrix: object[]): string` (64-char lowercase SHA-256)
- **Errors**: `TEST_MATRIX_PARSE_ERROR`, `TEST_MATRIX_DUPLICATE_ID`, `TEST_MATRIX_INVALID_SHAPE`.
- **Dependencies**: `node:crypto`, `src/lib/hasher.js` (`normalizeContent`).
- **Side Effects**: None (pure functional).

#### 3.2 `src/lib/closure-context.js`
- **Purpose**: Compute deterministic repository context, identify relevant bound closure files without whole-repo scanning, and compute `closureContextHash`.
- **Public Functions**:
  - `resolveRepositoryContext(rootPath: string): { type: 'git'|'non-git', commit: string|null, workingTreeClean: boolean|null }`
  - `resolveRelevantFiles(featureDir: string, taskBindings: object, runnerFiles: string[]): string[]`
  - `computeContentAggregateHash(rootPath: string, filePaths: string[]): string`
  - `computeClosureContextHash(contextObj: object): string`
- **Dependencies**: `node:fs`, `node:path`, `node:crypto`, `node:child_process`, `src/lib/hasher.js`.
- **Side Effects**: Reads disk files and executes read-only git status queries if git is present.

#### 3.3 `src/lib/runner-adapters.js`
- **Purpose**: Execute native test runners safely without `shell: true`, parse machine-readable test outputs, and perform mathematical reconciliation.
- **Public Functions**:
  - `executeRunner(command: string, args: string[], options: object): Promise<{ exitCode: number, stdout: string, stderr: string, durationMs: number }>`
  - `parseNodeTestTap(tapOutput: string): { physicalTotal: number, passed: number, failed: number, skipped: number, tests: object[] }`
  - `reconcileTestRun(canonicalMatrix: object[], runnerResults: object): { mathValid: boolean, phantoms: string[], orphans: string[], missing: string[], reconciliation: object }`
  - `generateClosureManifest(params: object): object`
- **Dependencies**: `node:child_process`, `node:path`, `src/lib/hasher.js`.
- **Side Effects**: Spawns test runner subprocesses (during COLLECT only).

---

## 4. Test Matrix Parsing & Schema Validation

### 4.1 Block Rules
- Only column-0 ````gemstack-test-matrix blocks are matched.
- 0 blocks: triggers `LEGACY` mode.
- 1 block: parses strict JSON.
- 2+ blocks: throws `TEST_MATRIX_PARSE_ERROR` (Upgrade A consistency model: exactly one structured block allowed).

### 4.2 Strict Schema Validation
Each item in the array must be an object with exact fields:
- `id` (string): Must match `^TEST-[A-Z0-9]+-[A-Z0-9]+$`. Duplicate IDs trigger `TEST_MATRIX_DUPLICATE_ID`.
- `category` (string): Non-empty string.
- `layer` (enum): Must be one of `["UNIT", "INTEGRATION", "E2E", "CLI"]`.
- `description` (string): Non-empty string.
- `pass_criteria` (string): Non-empty string.
- `gate` (enum): Must be one of `["REQUIRED", "SUPPLEMENTAL"]`.
Any missing, unknown, or empty fields trigger `TEST_MATRIX_INVALID_SHAPE`.

---

## 5. Acceptance Signature (`acceptanceSignature`)

### Canonical Serialization Algorithm:
1. Sort canonical test objects by ASCII/code-unit ordering of `id`: `(a.id < b.id ? -1 : (a.id > b.id ? 1 : 0))`.
2. Construct objects with ASCII-sorted keys: `["category", "description", "gate", "id", "layer", "pass_criteria"]`.
3. Preserve semantic string values (`description`, `pass_criteria`, `category`) exactly without trimming or case-folding.
4. Serialize to compact canonical JSON (no insignificant whitespace).
5. Hash using SHA-256: 64-character lowercase hexadecimal digest.

---

## 6. Physical Test Bindings & Authoring Schema (`gemstack-test-bindings`)

PLAN defines deterministic physical execution mappings using a column-0 fenced block `gemstack-test-bindings`:

```gemstack-test-bindings
[
  {
    "test_id": "TEST-CLOSURE-A01",
    "runner": "node:test",
    "file": "tests/test-matrix.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-A02",
    "runner": "node:test",
    "file": "tests/test-matrix.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-A03",
    "runner": "node:test",
    "file": "tests/test-matrix.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-B01",
    "runner": "node:test",
    "file": "tests/test-matrix.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-B02",
    "runner": "node:test",
    "file": "tests/test-matrix.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-C01",
    "runner": "node:test",
    "file": "tests/reconciliation.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-C02",
    "runner": "node:test",
    "file": "tests/reconciliation.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-C03",
    "runner": "node:test",
    "file": "tests/reconciliation.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-C04",
    "runner": "node:test",
    "file": "tests/reconciliation.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-D01",
    "runner": "node:test",
    "file": "tests/runner-adapter.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-D02",
    "runner": "node:test",
    "file": "tests/runner-adapter.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-D03",
    "runner": "node:test",
    "file": "tests/runner-adapter.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-E01",
    "runner": "node:test",
    "file": "tests/traceability.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-E02",
    "runner": "node:test",
    "file": "tests/traceability.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-F01",
    "runner": "node:test",
    "file": "tests/closure-manifest.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-F02",
    "runner": "node:test",
    "file": "tests/closure-manifest.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-F03",
    "runner": "node:test",
    "file": "tests/closure-manifest.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-G01",
    "runner": "node:test",
    "file": "tests/closure-gates.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-G02",
    "runner": "node:test",
    "file": "tests/closure-gates.test.js"
  },
  {
    "test_id": "TEST-CLOSURE-H01",
    "runner": "node:test",
    "file": "tests/closure-gates.test.js"
  }
]
```

### Binding Validation Rules:
- Every `test_id` must exist in `gemstack-test-matrix`.
- Exactly one physical binding is allowed per canonical test ID (no duplicates).
- `runner` must be supported (`node:test`).
- `file` must be a repository-relative normalized POSIX path pointing inside the repository.

### Physical Test Identification & Runner Execution:
- Title Token Extraction: Tests in bound runner files match `\b(TEST-[A-Z0-9]+-[A-Z0-9]+)\b` (e.g. `TEST-CLOSURE-A01: Description`).
- Any test claiming a canonical ID not in `gemstack-test-matrix`: emits **`ORPHAN_TEST`**.
- Any test executed without a canonical token: classified as **`SUPPORTING_TEST`**.

---

## 7. Project Closure Gates (`gemstack-closure-gates`)

Project closure gates are declared in `plan.md` using column-0 fenced block `gemstack-closure-gates`:

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

### Safe Zero-Shell Package Script Execution:
- Direct Node execution: uses `process.execPath`.
- Package manager (npm): resolved platform-safely without `shell: true`.
  - On Windows: locates `npm.cmd` via `path.join(path.dirname(process.execPath), 'npm.cmd')` or standard system PATH.
  - On POSIX: locates `npm` binary.
  - Invokes: `spawn(npmExec, ['run', script], { shell: false, stdio: 'pipe' })`.
- No shell string interpolation, no cmd/bash wrapper scripts.

---

## 8. Canonical Set Equality & Terminal State Arithmetic

### 8.1 Authoritative Runner Terminal State Arithmetic
Native runners expose multiple terminal states. Reconciliation enforces exact equation:
$$\text{PASS} + \text{FAIL} + \text{SKIP} + \text{TODO} + \text{CANCELLED} == \text{TOTAL PHYSICAL EXECUTED}$$
- For required canonical tests: `TODO` and `CANCELLED` are normalized as `REQUIRED_TEST_SKIPPED` (unfulfilled requirement, blocker).
- Formula: $\text{Executed Canonical} + \text{Executed Supporting} == \text{Total Physical Executed}$.

### 8.2 Set Semantics: Clean VERIFIED vs. VERIFIED_WITH_EXCEPTIONS
- **Clean VERIFIED**:
  $$\text{EXPECTED\_REQUIRED\_CANONICAL\_IDS} == \text{PASSED\_REQUIRED\_CANONICAL\_IDS}$$
  $$\text{FAILED\_REQUIRED} = \emptyset, \quad \text{SKIPPED\_REQUIRED} = \emptyset, \quad \text{NOT\_EXECUTED\_REQUIRED} = \emptyset, \quad \text{MISSING\_REQUIRED} = \emptyset$$
- **VERIFIED_WITH_EXCEPTIONS**:
  $$\text{EXPECTED\_REQUIRED\_CANONICAL\_IDS} == \text{PASSED\_REQUIRED\_CANONICAL\_IDS} \cup \text{ACCEPTED\_REQUIRED\_DEVIATIONS}$$
  The sets must be mutually disjoint. Deviations are never rewritten as PASS in the manifest; true outcomes (`SKIPPED`, `FAILED_GATE`) remain transparently recorded.

### 8.3 Waiver & Non-Waivable Policy
- **`REQUIRED_TEST_FAILED`**: **STRICTLY NON-WAIVABLE**. A failing canonical test can never be waived into eligibility.
- **`REQUIRED_TEST_SKIPPED`**: Potentially waivable with explicit human exception bound to `closureContextHash`.
- **`REQUIRED_GATE_FAILED`**: Waivable ONLY if the gate declaration explicitly specifies `waivable: true`.

---

## 9. Physical Test Missing vs. Not Executed

Upgrade B avoids AST scanning by using the structured physical bindings:
1. **`REQUIRED_TEST_MISSING`**: A required canonical ID has no valid binding entry in `gemstack-test-bindings`.
2. **`REQUIRED_TEST_NOT_EXECUTED`**: A required canonical ID is bound in `gemstack-test-bindings`, but no matching execution event was emitted in the runner's TAP output during the test run.

---

## 10. Closure Context Object & Context Hash

Deterministic object structure:
```json
{
  "version": 1,
  "repository": {
    "type": "git",
    "commit": "26db5c93c39aa2b5a1df97906eb46bc37894c214",
    "working_tree_clean": true
  },
  "phase_hashes": {
    "spec": "75f7b5aee9a7d45836128f619ba67d0870c9be3a2634d9152b01c6501faa513d",
    "plan": "...",
    "tasks": "..."
  },
  "acceptance_signature": "...",
  "test_files_hash": "...",
  "implementation_context_hash": "...",
  "required_gate_definition_hash": "..."
}
```
### Relevant File Scope & Deterministic Invariant (`RelevantClosureFiles`):
`closureContextHash` never scans the entire repository. The relevant file scope is strictly derived as follows:
- **Phase Artifacts**: `spec.md`, `plan.md` (and `tasks.md` once created).
- **Test Matrix Acceptance Signature**: Deterministic SHA-256 digest of canonical test matrix in `spec.md`.
- **Physical Test Files**: Unique file paths extracted from `gemstack-test-bindings` in `plan.md`.
- **Implementation Files**: Unique file paths bound to implementation tasks in `tasks.md`.
- **Referenced Package Scripts Source**: `package.json` when a closure gate references a `PACKAGE_SCRIPT`.
- **Gate Definitions**: Bound via the `plan.md` phase hash (`gemstack-closure-gates`). Machine sidecar `specs/<feature>/.gemstack.json` is machine-owned audit/history only and is NEVER an author-owned gate configuration source.
All file paths are normalized to POSIX format, sorted by ASCII code units, and hashed deterministically.

---

## 11. Lifecycle Architecture: COLLECT → VERIFY → SHIP

1. **`gemstack collect` (Mutating Evidence Collector)**:
   - Command: `node src/cli.js collect` (or `gemstack collect`).
   - Action: Resolves active feature directory (`specs/<active-feature>`), executes declared test runners and required project gates, parses TAP outputs, computes `closureContextHash`, evaluates gates, and atomically writes the feature-local manifest: `specs/<feature>/closure.json`. Never writes a global `.gemstack/closure.json`.
2. **`gemstack verify` (Strictly Read-Only Validator)**:
   - Command: `node src/cli.js verify`.
   - Action: Read-only verification executing in 6 distinct stages:
     1. Stage 1/6: Structural Verification (Base files & Manifest)
     2. Stage 2/6: Memory & Handoff Integrity
     3. Stage 3/6: Local State Integrity (`.gemstack/state.json`)
     4. Stage 4/6: Architecture Consistency & Phase Hashes
     5. Stage 5/6: Mechanical Closure Evidence Validation (reads `specs/<feature>/closure.json`, validates gates, checks freshness against in-memory `closureContextHash`; strictly zero disk writes)
     6. Stage 6/6: Security and Test Runners (script audit, anti-silent-failure checks)
   - Zero disk writes, zero evidence collection, zero mutation of `closure.json`.
3. **`gemstack ship` (Gatekeeper)**:
   - Command: `gemstack ship`.
   - Action: Enforces that feature-local `specs/<feature>/closure.json` exists, is fresh, has status `VERIFIED` or policy-permitted `VERIFIED_WITH_EXCEPTIONS`, confirms architecture consistency passes, and awaits explicit human confirmation before lifecycle transition to `SHIPPED`.

---

## 12. Closure Manifest Schema (`closure.json`)

```json
{
  "schema": "gemstack-closure",
  "version": 1,
  "feature": "specs/007-mechanical-test-matrix-closure-evidence/",
  "generated_at": "2026-09-11T12:00:00.000Z",
  "status": "VERIFIED",
  "closure_context": {
    "closure_context_hash": "...",
    "repository_type": "git",
    "git_commit": "26db5c93c39aa2b5a1df97906eb46bc37894c214",
    "working_tree_clean": true,
    "relevant_files_digest": "..."
  },
  "acceptance_signature": "...",
  "canonical_summary": { "required_total": 20, "required_passed": 20, "supplemental_total": 0, "supplemental_passed": 0 },
  "physical_summary": { "supporting_total": 5, "supporting_passed": 5, "total_executed": 25, "total_passed": 25, "total_failed": 0, "total_skipped": 0 },
  "reconciliation": { "math_valid": true, "phantoms_detected": 0, "orphans_detected": 0, "missing_canonical_ids": [] },
  "task_traceability_summary": { "tasks_total": 17, "tasks_with_validation": 15, "tasks_documentation_only": 2, "unmapped_canonical_tests": [] },
  "required_gates": {
    "project-tests": "PASS",
    "gate-ci-frontmatter": "PASS",
    "gate-ci-mojibake": "PASS"
  },
  "supplemental_gates": {},
  "exceptions": [],
  "evidence_sources": [
    {
      "type": "PACKAGE_SCRIPT",
      "script": "test",
      "runner": "node:test",
      "exit_code": 0,
      "duration_ms": 420
    }
  ],
  "blockers": [],
  "warnings": []
}
```

---

## 13. P1 Canonical Test Matrix Mapping (20 Tests)

| Canonical Test ID | Category | Layer | Target Test Suite | Exercised Modules | Expected Result / Finding |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TEST-CLOSURE-A01** | PARSING | UNIT | `tests/test-matrix.test.js` | `test-matrix.js` | Valid block returns CanonicalTest[] array |
| **TEST-CLOSURE-A02** | PARSING | UNIT | `tests/test-matrix.test.js` | `test-matrix.js` | Emits `TEST_MATRIX_PARSE_ERROR` / `TEST_MATRIX_DUPLICATE_ID` |
| **TEST-CLOSURE-A03** | PARSING | UNIT | `tests/test-matrix.test.js` | `test-matrix.js` | Cleanly ignores non-column-0 blocks without throwing |
| **TEST-CLOSURE-B01** | SIGNATURE | UNIT | `tests/test-matrix.test.js` | `test-matrix.js` | Deterministic SHA-256 invariant to JSON key order |
| **TEST-CLOSURE-B02** | SIGNATURE | UNIT | `tests/test-matrix.test.js` | `test-matrix.js` | Emits `ACCEPTANCE_SIGNATURE_MISMATCH` distinct from artifact change |
| **TEST-CLOSURE-C01** | RECONCILIATION | UNIT | `tests/reconciliation.test.js` | `runner-adapters.js` | Validates formula including all terminal states |
| **TEST-CLOSURE-C02** | RECONCILIATION | UNIT | `tests/reconciliation.test.js` | `runner-adapters.js` | Distinguishes `REQUIRED_TEST_MISSING` vs `REQUIRED_TEST_NOT_EXECUTED` |
| **TEST-CLOSURE-C03** | RECONCILIATION | UNIT | `tests/reconciliation.test.js` | `runner-adapters.js` | Emits non-waivable `PHANTOM_TEST` on runner mismatch |
| **TEST-CLOSURE-C04** | RECONCILIATION | UNIT | `tests/reconciliation.test.js` | `runner-adapters.js` | Emits `ORPHAN_TEST` for physical tests claiming unapproved IDs |
| **TEST-CLOSURE-D01** | RUNNER_ADAPTER | INTEGRATION | `tests/runner-adapter.test.js` | `runner-adapters.js` | Spawns `node:test` with `shell:false`, parses counts from TAP |
| **TEST-CLOSURE-D02** | RUNNER_ADAPTER | INTEGRATION | `tests/runner-adapter.test.js` | `runner-adapters.js` | Extracts `[TEST-CLOSURE-xxx]` from test titles accurately |
| **TEST-CLOSURE-D03** | RUNNER_ADAPTER | UNIT | `tests/runner-adapter.test.js` | `runner-adapters.js` | Handles non-zero exit codes gracefully without crashing |
| **TEST-CLOSURE-E01** | TRACEABILITY | UNIT | `tests/traceability.test.js` | `closure-context.js` | Validates `TASK -> TEST` direction; emits `TASK_VALIDATION_MISSING` |
| **TEST-CLOSURE-E02** | TRACEABILITY | UNIT | `tests/traceability.test.js` | `closure-context.js` | Emits `UNMAPPED_CANONICAL_TEST` if canonical test has no task |
| **TEST-CLOSURE-F01** | MANIFEST & CONTEXT | UNIT | `tests/closure-manifest.test.js`| `runner-adapters.js` | Serializes valid `closure.json` schema with nullable Git fields |
| **TEST-CLOSURE-F02** | MANIFEST & CONTEXT | UNIT | `tests/closure-manifest.test.js`| `closure-context.js` | Computes deterministic `closureContextHash` (clean, dirty, non-git) |
| **TEST-CLOSURE-F03** | MANIFEST & CONTEXT | UNIT | `tests/closure-manifest.test.js`| `closure-context.js` | Read-only detection of stale evidence (`CLOSURE_EVIDENCE_STALE`) |
| **TEST-CLOSURE-G01** | GATES | INTEGRATION | `tests/closure-gates.test.js` | `commands/verify.js` | Blocks closure when gate fails; `REQUIRED_TEST_FAILED` non-waivable |
| **TEST-CLOSURE-G02** | GATES | INTEGRATION | `tests/closure-gates.test.js` | `commands/verify.js` | Permits shipping when status is `VERIFIED` or `VERIFIED_WITH_EXCEPTIONS`|
| **TEST-CLOSURE-H01** | LEGACY | UNIT | `tests/closure-gates.test.js` | `commands/verify.js` | Specs without test matrix run in legacy mode with exit code 0 |

---

## 14. File Impact Map

### New Files:
- `src/lib/test-matrix.js`: Matrix parser and signature calculator.
- `src/lib/closure-context.js`: Context resolution and file hashing.
- `src/lib/runner-adapters.js`: Subprocess runner and TAP reconciliation.
- `src/commands/collect.js`: Dedicated mutating evidence collection command.
- `tests/test-matrix.test.js`: P1 suites A & B.
- `tests/reconciliation.test.js`: P1 suite C.
- `tests/runner-adapter.test.js`: P1 suite D.
- `tests/traceability.test.js`: P1 suite E.
- `tests/closure-manifest.test.js`: P1 suite F.
- `tests/closure-gates.test.js`: P1 suites G & H.

### Modified Files:
- `src/commands/verify.js`: Add Stage 5 of 6 (Mechanical Closure Evidence Validation, strictly read-only, reading `specs/<feature>/closure.json`) and advance Security & Test Runners to Stage 6 of 6. Strictly zero disk writes.
- `src/commands/ship.js`: Enforce that feature-local `specs/<feature>/closure.json` is fresh and `VERIFIED` before allowing lifecycle closure.
- `src/cli.js`: Register dedicated `collect` command.
- `package.json`: Update test script to include the 6 new test files while preserving all 5 existing test files.

### Unchanged Critical Files:
- `src/lib/contracts.js`
- `src/lib/hasher.js`
- `src/lib/findings.js`
- `src/lib/state.js`
- Existing test suites: `tests/contracts.test.js`, `tests/hasher.test.js`, `tests/findings.test.js`, `tests/init.test.js`, `tests/verify.test.js`.