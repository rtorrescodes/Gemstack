# Plan de Implementación: Agent Swarm & Visual QA (Upgrade E)

**Feature Branch**: `010-agent-swarm-visual-qa`  
**Feature Directory**: `specs/010-agent-swarm-visual-qa/`  
**Spec**: [`specs/010-agent-swarm-visual-qa/spec.md`](file:///c:/CODES/Gemstack/specs/010-agent-swarm-visual-qa/spec.md)  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_REVIEW`

---

## 1. Architecture Mapping & Context

Upgrade E establishes a deterministic, auditable, offline-verifiable architecture for coordinating multi-agent engineering swarms and validating visual user interface outcomes without compromising Gemstack's fundamental authority model.

It directly builds upon the cumulative guarantees of:
- **Upgrade A (Architecture Consistency Engine)**: Deterministic cryptographic hashing (`src/lib/hasher.js`), canonical contracts (`src/lib/contracts.js`), findings and fingerprints (`src/lib/findings.js`), and atomic state persistence (`src/lib/state.js`).
- **Upgrade B (Mechanical Test Matrix & Closure Evidence)**: Test matrix validation, acceptance signatures (`src/lib/test-matrix.js`), closure context resolution (`src/lib/closure-context.js`), and strict `VERIFY = VALIDATE` read-only evaluation.
- **Upgrade C (Cost & Provider Safety Gates)**: Provider capability evaluation (`ProviderCapabilityGate`), fail-closed billable action authorization (`BillableActionGate`), cost ledger validation (`src/lib/cost-ledger.js`), and secret pattern prohibition.
- **Upgrade D (Context Capsule & Compression)**: Lossless continuation context compression (`context-capsule.json`), provenance hashing, and role-based context projection.

### Architectural Flow:
```text
[spec.md / tasks.md ([P] tasks) / context-capsule.json]
                         │
                         ▼
        +----------------------------------+
        | Swarm Orchestration Subsystem    |
        | - Partition Planner (Disjoint)   |
        | - Role & Task Ownership          |
        | - Author != Reviewer Gate        |
        | - Context Projection Engine      |
        | - Upgrade C Safety Interceptor   |
        +-----------------+----------------+
                          │
                          ▼
            [swarm.json (Manifest)]
                          │
                          ▼ (Worker Evidence Submission)
        +----------------------------------+
        | Visual QA Subsystem              |
        | - Scenario & Viewport Matrix     |
        | - Neutral Dynamic Masking        |
        | - Offline Baseline Digest Hash   |
        | - Explicit Promotion Barrier     |
        +-----------------+----------------+
                          │
                          ▼
          [visual-qa.json (Manifest)]
                          │
                          ▼
        +----------------------------------+
        | Read-Only Verification Engine    |
        | gemstack verify (Stages 5.3/5.4) |
        | - Zero process spawns            |
        | - Zero live browser invocations  |
        | - Zero file mutations            |
        +----------------------------------+
```

### Central Authority Model & Invariants:
1. `SPEC / PLAN / TASKS / FROZEN CONTRACTS = SOLE AUTHORITY`.
2. `AGENT OUTPUT = PROPOSED WORK`.
3. `VISUAL EVIDENCE = EVIDENCE`.
4. `AUTHOR != REVIEWER` (Separation of duties is non-waivable).
5. `EXCLUSIVE_TASK_WRITE_OWNERSHIP` (Disjoint write-set partitions per concurrent wave; zero overlapping writes).
6. `VERIFY = VALIDATE` (Verification inspects manifests and evidence offline in read-only mode).
7. `ZERO RUNTIME DEPENDENCIES` (Node.js standard library built-ins exclusively; runtime dependency delta = 0).
8. `BASELINE EXPLICIT UPDATE ONLY` (Baselines are never auto-updated or healed during verification).

---

## 2. Exact Repository Change Map

### NEW Production Modules:
- `src/lib/swarm.js`: Core swarm partition planner, write-scope validator, review independence gate, and context projection resolver.
- `src/lib/visual-qa.js`: Core visual QA scenario validator, deterministic viewport resolver, dynamic masking rules, and offline baseline hash comparator.
- `src/commands/swarm.js`: CLI command handler for `gemstack swarm [plan|validate]`.
- `src/commands/visual.js`: CLI command handler for `gemstack vqa [validate|promote]`.

### NEW Test Suites (20 Canonical Acceptance Tests across 5 suites):
- `tests/swarm-partitioning.test.js` (`TEST-SWARM-A01`, `TEST-SWARM-A02`)
- `tests/swarm-review.test.js` (`TEST-SWARM-B01`, `TEST-SWARM-B02`, `TEST-SWARM-C01`, `TEST-SWARM-C02`, `TEST-SWARM-D01`, `TEST-SWARM-D02`, `TEST-SWARM-E01`, `TEST-SWARM-E02`)
- `tests/visual-manifest.test.js` (`TEST-VISUAL-A01`, `TEST-VISUAL-A02`, `TEST-VISUAL-B01`, `TEST-VISUAL-B02`)
- `tests/visual-diff.test.js` (`TEST-VISUAL-C01`, `TEST-VISUAL-C02`, `TEST-VISUAL-D01`, `TEST-VISUAL-D02`)
- `tests/swarm-visual-purity.test.js` (`TEST-VISUAL-E01`, `TEST-VISUAL-E02`)

### MODIFIED Existing Modules:
- `src/cli.js`: Register `swarm` and `vqa` commands in parser and help text.
- `src/commands/verify.js`: Add Stage 5.3 (Swarm Manifest & Partition Audit) and Stage 5.4 (Visual QA Evidence & Baseline Audit) in pure read-only mode.
- `src/lib/closure-context.js`: Include `swarm.json` and `visual-qa.json` in implementation context tracking when present.
- `package.json`: Register the 5 new test suites into `npm test` script. Zero runtime and zero dev dependencies added.

### UNCHANGED / FROZEN Files:
- `src/lib/contracts.js` (Upgrade A frozen contract mechanics)
- `src/lib/hasher.js` (Upgrade A deterministic hasher)
- `src/lib/findings.js` (Upgrade A findings framework)
- `src/lib/cost-ledger.js` & `src/lib/provider/` (Upgrade C cost and provider safety gates)
- `src/lib/context-capsule.js` (Upgrade D continuation context capsule)
- `specs/006-architecture-consistency/` (Upgrade A)
- `specs/007-mechanical-test-matrix/` (Upgrade B)
- `specs/008-cost-provider-safety-gates/` (Upgrade C)
- `specs/009-context-capsule/` (Upgrade D)

---

## 3. Canonical Artifact Decisions

The canonical Upgrade E artifacts are feature-scoped, living in the active feature directory:
- `specs/<active-spec>/swarm.json`: Swarm plan, wave partitions, task assignments, and review attestations.
- `specs/<active-spec>/visual-qa.json`: Visual test scenarios, viewport matrix, selector masks, and baseline hashes.
- `specs/<active-spec>/baselines/`: Canonical approved reference images (.png) tracked via SHA-256 hashes in `visual-qa.json`.

| Property | `swarm.json` | `visual-qa.json` |
| :--- | :--- | :--- |
| **Authority Status** | Derived coordination & evidence manifest | Derived scenario & visual evidence manifest |
| **Generation Method** | `gemstack swarm plan` (from `tasks.md`) | Manual declaration or `gemstack vqa init` |
| **Validation Method** | `gemstack swarm validate` & `gemstack verify` (5.3) | `gemstack vqa validate` & `gemstack verify` (5.4) |
| **Freshness Inputs** | `tasks.md` hash, `context-capsule.json` hash | Live screenshot hashes, `spec.md` acceptance IDs |
| **Mutation Rules** | Updated on wave transitions / review signs | Updated only on explicit promotion (`vqa promote`) |
| **Package Exclusion**| Excluded from npm tarball (specs dir excluded) | Excluded from npm tarball (specs dir excluded) |
| **Closure Relation** | Verified evidence attached to `closure.json` | Verified evidence attached to `closure.json` |

---

## 4. Swarm Core Architecture (`src/lib/swarm.js`)

`src/lib/swarm.js` is a zero-runtime-dependency pure Node.js module responsible for:
1. **Manifest Parsing & Validation**: Validating `swarm.json` against schema v1.0.0.
2. **Partition & Concurrency Planning**: Compiling `tasks.md` parallel tasks (`[P]`) into concurrent waves where write sets are strictly disjoint.
3. **Write-Set Guarding**: Ensuring no two concurrent tasks claim overlapping file paths.
4. **Separation of Duties Gate**: Asserting `author != reviewer` across all reviewed tasks.
5. **Context Projection**: Compiling minimal, task-scoped context projections derived from `context-capsule.json`.
6. **Provider Policy Linking**: Ensuring worker billable actions reference Upgrade C capability and cost gates.

---

## 5. Swarm Manifest Schema (v1.0.0)

```json
{
  "$schema": "https://gemstack.dev/schemas/v1/swarm.json",
  "version": "1.0.0",
  "feature_id": "010-agent-swarm-visual-qa",
  "source_capsule_hash": "64-char lowercase hex SHA-256",
  "max_workers": 4,
  "waves": [
    {
      "wave_index": 1,
      "status": "COMPLETED",
      "tasks": [
        {
          "task_id": "TASK-SWARM-01",
          "description": "Implement swarm partition validator",
          "assigned_role": "implementer",
          "worker_id": "worker-impl-alpha",
          "write_set": [
            "src/lib/swarm.js"
          ],
          "read_set": [
            "specs/010-agent-swarm-visual-qa/spec.md"
          ],
          "status": "COMPLETED",
          "review": {
            "reviewer_role": "reviewer",
            "reviewer_id": "worker-rev-beta",
            "status": "APPROVED",
            "reviewed_commit_hash": "a1b2c3d4e5f6...",
            "review_timestamp": "2026-09-11T19:00:00Z",
            "attestation": "All criteria verified; write-set strictly adhered to."
          }
        }
      ]
    }
  ]
}
```

---

## 6. Worker Identity Model

Worker identities must be deterministic, explicit, and auditable strings:
- **Format**: `worker-<role>-<explicit-suffix>` (e.g., `worker-impl-alpha`, `worker-rev-beta`, `lead-engineer`).
- **Forbidden Identifiers**: Dynamic machine hostnames, transient process IDs, random unseeded UUIDs, or LLM model strings (`gpt-4o`, `gemini-1.5-pro`).
- **Uniqueness**: Each active worker within a concurrent wave must possess a distinct, stable identifier to guarantee unambiguous ownership and review auditing.

---

## 7. Mechanical Role Model

Upgrade E defines four mechanical roles with strict operational capabilities:

| Role | Permitted Write Scope | Permitted Tooling | Review Authority |
| :--- | :--- | :--- | :--- |
| **`implementer`** | Declared task `write_set` only | Code edit, local test run | Cannot review or approve tasks |
| **`reviewer`** | Read-only across repository | Read, diff, test execution | Can approve tasks where `author != reviewer` |
| **`security-auditor`** | Read-only across repository | Read, secret scan, gate check | Can approve security/provider safety gates |
| **`coordinator`** | `swarm.json` only | Read `tasks.md`, plan schedule | Can organize waves; cannot review code |

---

## 8. Task Ownership & Exclusive Write Boundaries

### Task Ownership:
- Every entry in `swarm.json` must reference a valid, existing `task_id` declared in the feature's `tasks.md`.
- Unknown, orphaned, or unassigned tasks fail closed with `SWARM_TASK_ORPHANED`.

### Exclusive Write Boundaries:
- For any concurrent wave ( W ), and any two tasks ( T_1, T_2 in W ):
$$\text{write\_set}(T_1) \cap \text{write\_set}(T_2) = \emptyset$$
- If an overlap is detected during scheduling, the planner serializes ( T_2 ) into wave ( W+1 ) and records `SWARM_WRITE_COLLISION_PREVENTED`.
- If an overlap occurs in an executed manifest, validation fails closed with `SWARM_WRITE_COLLISION`.

---

## 9. Write-Scope Validation

Write-scope validation is performed by comparing worker git diffs or file mutation records against declared `write_set`:
1. Paths in `write_set` must be POSIX-normalized relative paths.
2. Parent directory traversal (`../`), root escapes, and protected paths (`.git/`, `package.json`, `specs/*`) are strictly forbidden unless explicitly authorized in the task specification.
3. If files outside `write_set` are modified, validation fails closed with `SWARM_WRITE_SET_VIOLATION`.

---

## 10. Dependency Graph & Wave Scheduling

Swarm scheduling preserves task dependency semantics from `tasks.md`:
- Prerequisite tasks marked in `tasks.md` must be placed in strictly earlier waves ((\text{wave}(T_{\text{dep}}) < \text{wave}(T))).
- Blocked prerequisites prevent subsequent wave execution.
- Cycle detection executes during `gemstack swarm plan`, rejecting circular dependencies with `SWARM_DEPENDENCY_CYCLE`.

---

## 11. Context Projection & Freshness (Upgrade D Integration)

Workers receive task-scoped context projections deterministically compiled from `context-capsule.json`:
1. **Projection Payload**: Contains feature metadata, target task description, relevant frozen contracts, explicit write set, and acceptance IDs.
2. **Provenance Pinned**: Each projection embeds `source_capsule_hash`.
3. **Freshness Invalidation**: If the live hash of `context-capsule.json` does not match `source_capsule_hash`, the projection is marked stale and fails verification with `SWARM_CONTEXT_STALE`.
4. **Chat History Exclusion**: Raw prompts, chat logs, and conversation transcripts are strictly excluded from worker payloads.

---

## 12. Worker Output Evidence & Completion Proof

A task is not complete merely because an agent claims it is. Proof requires:
1. **Structured Completion Claim**: Worker records files modified, tests executed, and exit codes.
2. **Review Attestation**: An independent reviewer role verifies code and tests, recording `status: APPROVED`, reviewer ID, timestamp, and review commit hash.
3. **Mechanical Test Proof**: Acceptance test IDs mapped to the task pass cleanly in CI.
4. **Closure Reconciled**: Only tasks satisfying all three criteria can be marked `[x]` in `tasks.md` and verified by `gemstack verify`.

---

## 13. Review Independence Gate (`AUTHOR != REVIEWER`)

Separation of duties is mechanically enforced on every task review:
$$\text{worker\_id}(\text{implementer}) \neq \text{reviewer\_id}(\text{reviewer})$$
- If the reviewer ID matches the author/implementer ID, validation immediately halts fail-closed with `SWARM_SELF_REVIEW_DETECTED`.
- Changing roles within the same session does not bypass the gate; worker identity strings are compared directly.
- Reviews must be signed by an authorized `reviewer` or `security-auditor` role.

---

## 14. Reviewer & Visual QA Write Policy

- **Reviewer Write Policy**: Reviewers operate in strictly read-only mode across the codebase. A review failure must return structured correction findings to the coordinator. Reviewers are forbidden from "fixing while reviewing" to prevent unreviewed self-commits.
- **Visual QA Write Policy**: Visual QA workers operate in read-only mode for application code; write access is strictly limited to generated visual evidence directories (`specs/<feature>/evidence/`).

---

## 15. Attempt History & Retry Model

To prevent unbounded retries and trace debugging efforts:
- Failed tasks record an `attempt_count` and structured `failure_reason` in the task review block.
- Maximum attempts per task: 3. Exceeding 3 attempts marks the task `BLOCKED_AWAITING_HUMAN`.
- History is kept minimal and structured, avoiding large log dumps.

---

## 16. Worker Limits & Anti-Spawning Policy

- **Static Declaration**: Total concurrent workers is bounded by `max_workers` declared in `swarm.json` (default: 4, hard cap: 8).
- **Anti-Spawning Policy**: Worker agents are strictly forbidden from spawning child workers, subagents, or dynamic background jobs. Manifest validation rejects undeclared child worker claims.

---

## 17. Provider Safety & Budget Integration (Upgrade C)

- **Provider Gate Linking**: Every model invocation in a swarm workflow must reference a declared provider policy.
- **Billable Action Interception**: External model calls pass through `ProviderCapabilityGate` and `BillableActionGate`.
- **Aggregate Budget Cap**: Swarm waves declare token limits. If cumulative wave usage exceeds the allocated feature token budget, execution halts fail-closed with `SWARM_COST_LIMIT_EXCEEDED`.

---

## 18. Visual QA Core Architecture (`src/lib/visual-qa.js`)

`src/lib/visual-qa.js` is a zero-runtime-dependency pure Node.js module responsible for:
1. **Manifest Validation**: Parsing `visual-qa.json` against schema v1.0.0.
2. **Scenario & Viewport Conformance**: Validating deterministic viewport dimensions, scale factors, and color schemes.
3. **Dynamic Region Masking**: Applying solid neutral masks (`#808080`) over dynamic selectors (timestamps, counters, avatars) prior to diffing.
4. **Offline Baseline Comparison**: Verifying baseline image files against pinned SHA-256 hashes and calculating pixel/DOM diff metrics.
5. **Explicit Baseline Promotion Barrier**: Enforcing that baselines are never auto-updated during test runs.

---

## 19. Visual QA Manifest Schema (v1.0.0)

```json
{
  "$schema": "https://gemstack.dev/schemas/v1/visual-qa.json",
  "version": "1.0.0",
  "feature_id": "010-agent-swarm-visual-qa",
  "target_base_url": "http://localhost:3000",
  "scenarios": [
    {
      "scenario_id": "VQA-LOGIN-001",
      "description": "Login screen renders correctly on mobile viewport",
      "route": "/login",
      "acceptance_ids": [
        "TEST-VISUAL-A01"
      ],
      "viewport": {
        "name": "mobile-portrait",
        "width": 375,
        "height": 667,
        "device_scale_factor": 2,
        "color_scheme": "light"
      },
      "selectors": {
        "root": "#login-card",
        "mask": [
          ".dynamic-timestamp",
          ".live-avatar"
        ]
      },
      "tolerances": {
        "max_diff_percentage": 0.00,
        "anti_aliasing_threshold": 0.1
      },
      "baseline": {
        "image_path": "specs/010-agent-swarm-visual-qa/baselines/vqa-login-001-mobile.png",
        "image_sha256": "8f4e2b...",
        "dom_hash": "c5d6e7...",
        "approved_by": "human-lead",
        "approved_at": "2026-09-11T18:00:00Z"
      }
    }
  ]
}
```

---

## 20. Viewport Model & Deterministic Profiles

| Profile Name | Width (px) | Height (px) | Device Scale Factor | Intended Platform |
| :--- | :--- | :--- | :--- | :--- |
| **`desktop-standard`** | 1920 | 1080 | 1 | Full HD Desktop / CI |
| **`desktop-compact`** | 1280 | 800 | 1 | Compact Laptop Display |
| **`tablet-portrait`** | 768 | 1024 | 2 | Tablet Portrait Display |
| **`mobile-portrait`** | 375 | 667 | 2 | Mobile Smartphone Display |

Dimensions must be positive integers. Any omitted or invalid viewport parameter fails with `VQA_INVALID_VIEWPORT`.

---

## 21. Dynamic Region Masking & Anti-Flake Protections

1. **Deterministic Solid Masking**: Elements matching selectors declared in `selectors.mask` are covered with a neutral gray fill (`#808080`) before computing evidence digests.
2. **Animation & Caret Disabling**: Scenarios mandate zero CSS transitions and hidden carets during capture.
3. **Anti-Aliasing Tolerance**: Diffs within configurable color-distance thresholds (`anti_aliasing_threshold`) are filtered to prevent subpixel font smoothing false positives across Windows, Linux, and macOS.
4. **Credential Auto-Masking**: Password inputs (`input[type="password"]`) and `data-sensitive="true"` elements are automatically masked fail-closed.

---

## 22. Baseline Lifecycle Management (`baseline-explicit-update-only`)

- **Strict Immutability**: Verification and test execution NEVER overwrite baseline images.
- **Explicit Promotion Command**: A baseline can only be updated or initialized via the explicit CLI command:
  `gemstack vqa promote <scenario-id>`
- **Tampering Detection**: If a baseline image on disk deviates from the recorded `image_sha256` in `visual-qa.json`, verification halts fail-closed with `VQA_BASELINE_TAMPERED`.

---

## 23. Visual Diffing & Failure Classification

Results are classified deterministically:
- **`PASS`**: Live screenshot SHA-256 matches baseline `image_sha256` 100%, or non-masked pixel diff is within `max_diff_percentage`.
- **`VISUAL_REGRESSION`**: Unmasked pixels differ beyond threshold.
- **`BASELINE_MISSING`**: Declared scenario lacks an approved baseline image.
- **`BASELINE_TAMPERED`**: Baseline image hash on disk differs from recorded manifest hash.
- **`EVIDENCE_MISSING`**: No live evidence submitted for declared scenario.
- **`MASK_FAILURE`**: Mandatory sensitive selector failed to resolve in DOM.

---

## 24. External Capture Adapter Contract

Because browser capture is decoupled from Gemstack core, external runners (Playwright scripts, Puppeteer adapters, or MCP tools) interface via a clean JSON evidence contract:
- **Input Contract**: External runner reads `visual-qa.json` scenario definitions.
- **Output Contract**: External runner writes screenshot PNG and DOM snapshot to `specs/<feature>/evidence/<scenario-id>.png` and records execution metadata.
- **Core Role**: Core Gemstack inspects, hashes, masks, diffs, and validates the evidence offline. Core never spawns browser processes.

---

## 25. CLI & Developer Ergonomics (`src/commands/swarm.js` & `src/commands/visual.js`)

```text
gemstack swarm plan [--json]             Compile tasks.md [P] tasks into deterministic swarm.json waves
gemstack swarm validate [--json]         Validate write-set partitions and review attestations
gemstack vqa validate [--json]           Validate visual-qa.json schema, baselines, and evidence offline
gemstack vqa promote <scenario-id>       Promote live evidence to approved canonical baseline
```

Both commands support `--json` for CI consumption and run strictly read-only validation operations (except `promote`, which is explicitly mutating).

---

## 26. Verification Engine Integration (`gemstack verify`)

`gemstack verify` adds two read-only audit stages:

### Stage 5.3: Swarm Coordination Audit (Read-Only)
- Validates `swarm.json` schema and task wave partitions.
- Verifies all concurrent tasks have mutually disjoint write sets.
- Enforces `author != reviewer` across all approved reviews.
- Checks context projection freshness against active `context-capsule.json`.
- Operates in legacy mode if `swarm.json` is absent (exit 0).

### Stage 5.4: Visual QA Evidence Audit (Read-Only)
- Validates `visual-qa.json` schema and scenario viewport definitions.
- Verifies all baseline images exist and match recorded SHA-256 hashes.
- Inspects submitted evidence completeness for required scenarios.
- Ensures zero file mutations and zero browser launches occur during verify.
- Operates in legacy mode if `visual-qa.json` is absent (exit 0).

---

## 27. Closure Integration (`gemstack ship`)

- Swarm and Visual QA evidence link directly into Upgrade B closure machinery via `closure.json`.
- `gemstack ship` verifies that:
  - All swarm tasks in active waves are `COMPLETED` and independently `APPROVED`.
  - All visual QA scenarios have passing evidence matching baselines.
  - Zero unreviewed changes, write collisions, or visual regressions remain.
- Swarm and Visual QA artifacts remain strictly evidence; they do not alter closure invariants or supersede specifications.

---

## 28. Legacy & Multi-Mode Compatibility

- **Legacy Mode**: Repositories or features without `swarm.json` and `visual-qa.json` run cleanly with informational notices and exit code 0.
- **Backend / Headless Mode**: Projects with no UI components declare no visual scenarios; visual audit is cleanly skipped.
- **Single-Agent Mode**: Tasks executed sequentially without parallel swarms omit `swarm.json` without penalty.

---

## 29. Bootstrap Contracts Mapping (10 / 10 Mapped)

| Contract ID | Implementation Surface | Validator Function | Emitted Finding | Acceptance Test |
| :--- | :--- | :--- | :--- | :--- |
| **`swarm-authority-subordinate`** | `src/lib/swarm.js` | `validateSwarmAuthority()` | `SWARM_AUTHORITY_CONFLICT` | `TEST-SWARM-A01` |
| **`author-not-reviewer`** | `src/lib/swarm.js` | `validateReviewSeparation()` | `SWARM_SELF_REVIEW_DETECTED`| `TEST-SWARM-B01` |
| **`exclusive-task-write-ownership`**| `src/lib/swarm.js` | `validateWritePartitions()` | `SWARM_WRITE_COLLISION` | `TEST-SWARM-A02` |
| **`swarm-provider-safety-gated`** | `src/lib/swarm.js` | `validateProviderSafety()` | `SWARM_PROVIDER_UNAUTHORIZED`| `TEST-SWARM-C01` |
| **`swarm-context-projected`** | `src/lib/swarm.js` | `validateContextProjection()`| `SWARM_CONTEXT_STALE` | `TEST-SWARM-D01` |
| **`visual-evidence-subordinate`** | `src/lib/visual-qa.js` | `validateEvidenceSubordination()`| `VQA_AUTHORITY_CONFLICT` | `TEST-VISUAL-A01` |
| **`deterministic-viewports`** | `src/lib/visual-qa.js` | `validateViewports()` | `VQA_INVALID_VIEWPORT` | `TEST-VISUAL-A02` |
| **`baseline-explicit-update-only`**| `src/lib/visual-qa.js` | `validateBaselineImmutability()`| `VQA_BASELINE_TAMPERED` | `TEST-VISUAL-B01` |
| **`verify-swarm-visual-offline`** | `src/commands/verify.js`| `verify()` (Stages 5.3/5.4) | `VERIFY_NETWORK_DETECTED` | `TEST-SWARM-E01` / `TEST-VISUAL-E01` |
| **`legacy-swarm-visual-compatibility`**| `src/commands/verify.js`| `verify()` legacy fallback | None (passes exit 0) | `TEST-SWARM-E02` / `TEST-VISUAL-E02` |

---

## 30. Canonical Acceptance Matrix Mapping (20 / 20 Mapped)

| Acceptance ID | Category | Implementation Surface | Test File | Mechanical Proof |
| :--- | :--- | :--- | :--- | :--- |
| **`TEST-SWARM-A01`** | Partitioning | `src/lib/swarm.js` | `tests/swarm-partitioning.test.js` | Disjoint write sets schedule into same concurrent wave |
| **`TEST-SWARM-A02`** | Partitioning | `src/lib/swarm.js` | `tests/swarm-partitioning.test.js` | Overlapping write sets serialize into sequential waves |
| **`TEST-SWARM-B01`** | Separation of Duties | `src/lib/swarm.js` | `tests/swarm-review.test.js` | `author == reviewer` fails closed with self-review error |
| **`TEST-SWARM-B02`** | Separation of Duties | `src/lib/swarm.js` | `tests/swarm-review.test.js` | Distinct reviewer role validates review attestation |
| **`TEST-SWARM-C01`** | Gate Integration | `src/lib/swarm.js` | `tests/swarm-review.test.js` | Intercepts undeclared provider call via ProviderCapabilityGate |
| **`TEST-SWARM-C02`** | Gate Integration | `src/lib/swarm.js` | `tests/swarm-review.test.js` | Cumulative wave token usage halts on budget breach |
| **`TEST-SWARM-D01`** | Context Projection | `src/lib/swarm.js` | `tests/swarm-review.test.js` | Projection hash matches active context-capsule digest |
| **`TEST-SWARM-D02`** | Context Projection | `src/lib/swarm.js` | `tests/swarm-review.test.js` | Ingestion of raw chat transcripts is rejected |
| **`TEST-SWARM-E01`** | Verify Purity | `src/commands/verify.js`| `tests/swarm-visual-purity.test.js`| `verify` runs with 0 file mutations and 0 process spawns |
| **`TEST-SWARM-E02`** | Legacy Compatibility | `src/commands/verify.js`| `tests/swarm-visual-purity.test.js`| Absent `swarm.json` exits 0 in legacy mode |
| **`TEST-VISUAL-A01`** | Visual Manifest | `src/lib/visual-qa.js` | `tests/visual-manifest.test.js` | Rejects manifest missing route, viewport, or baseline |
| **`TEST-VISUAL-A02`** | Visual Manifest | `src/lib/visual-qa.js` | `tests/visual-manifest.test.js` | Rejects invalid or negative viewport dimensions |
| **`TEST-VISUAL-B01`** | Baseline Safety | `src/lib/visual-qa.js` | `tests/visual-manifest.test.js` | Modified baseline image on disk triggers tampered error |
| **`TEST-VISUAL-B02`** | Baseline Safety | `src/lib/visual-qa.js` | `tests/visual-manifest.test.js` | Baseline file hashes remain unchanged after test run |
| **`TEST-VISUAL-C01`** | Regression Detection | `src/lib/visual-qa.js` | `tests/visual-diff.test.js` | Screenshot deviating beyond threshold triggers regression |
| **`TEST-VISUAL-C02`** | Regression Detection | `src/lib/visual-qa.js` | `tests/visual-diff.test.js` | Matching SHA-256 image hashes pass immediately |
| **`TEST-VISUAL-D01`** | Masking Protection | `src/lib/visual-qa.js` | `tests/visual-diff.test.js` | Dynamic text variation in masked selector does not fail |
| **`TEST-VISUAL-D02`** | Masking Protection | `src/lib/visual-qa.js` | `tests/visual-diff.test.js` | Password input fields are masked automatically |
| **`TEST-VISUAL-E01`** | Verify Purity | `src/commands/verify.js`| `tests/swarm-visual-purity.test.js`| Verification passes offline with mocked network/process |
| **`TEST-VISUAL-E02`** | Legacy Compatibility | `src/commands/verify.js`| `tests/swarm-visual-purity.test.js`| Absent `visual-qa.json` exits 0 in legacy mode |

### Mechanical Test Bindings (`gemstack-test-bindings`)

```gemstack-test-bindings
[
  {
    "test_id": "TEST-SWARM-A01",
    "runner": "node:test",
    "file": "tests/swarm-partitioning.test.js"
  },
  {
    "test_id": "TEST-SWARM-A02",
    "runner": "node:test",
    "file": "tests/swarm-partitioning.test.js"
  },
  {
    "test_id": "TEST-SWARM-B01",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-B02",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-C01",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-C02",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-D01",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-D02",
    "runner": "node:test",
    "file": "tests/swarm-review.test.js"
  },
  {
    "test_id": "TEST-SWARM-E01",
    "runner": "node:test",
    "file": "tests/swarm-visual-purity.test.js"
  },
  {
    "test_id": "TEST-SWARM-E02",
    "runner": "node:test",
    "file": "tests/swarm-visual-purity.test.js"
  },
  {
    "test_id": "TEST-VISUAL-A01",
    "runner": "node:test",
    "file": "tests/visual-manifest.test.js"
  },
  {
    "test_id": "TEST-VISUAL-A02",
    "runner": "node:test",
    "file": "tests/visual-manifest.test.js"
  },
  {
    "test_id": "TEST-VISUAL-B01",
    "runner": "node:test",
    "file": "tests/visual-manifest.test.js"
  },
  {
    "test_id": "TEST-VISUAL-B02",
    "runner": "node:test",
    "file": "tests/visual-manifest.test.js"
  },
  {
    "test_id": "TEST-VISUAL-C01",
    "runner": "node:test",
    "file": "tests/visual-diff.test.js"
  },
  {
    "test_id": "TEST-VISUAL-C02",
    "runner": "node:test",
    "file": "tests/visual-diff.test.js"
  },
  {
    "test_id": "TEST-VISUAL-D01",
    "runner": "node:test",
    "file": "tests/visual-diff.test.js"
  },
  {
    "test_id": "TEST-VISUAL-D02",
    "runner": "node:test",
    "file": "tests/visual-diff.test.js"
  },
  {
    "test_id": "TEST-VISUAL-E01",
    "runner": "node:test",
    "file": "tests/swarm-visual-purity.test.js"
  },
  {
    "test_id": "TEST-VISUAL-E02",
    "runner": "node:test",
    "file": "tests/swarm-visual-purity.test.js"
  }
]
```

### Project Closure Gates (`gemstack-closure-gates`)

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

## 31. Comprehensive Threat Model Mapping

| Threat Vector | Preventive Validation Surface | Emitted Finding | Mechanical Test |
| :--- | :--- | :--- | :--- |
| **1. Write Collision** | `validateWritePartitions()` | `SWARM_WRITE_COLLISION` | `TEST-SWARM-A02` |
| **2. Self-Review Bypass** | `validateReviewSeparation()` | `SWARM_SELF_REVIEW_DETECTED` | `TEST-SWARM-B01` |
| **3. Token Runaway** | `validateProviderSafety()` | `SWARM_COST_LIMIT_EXCEEDED` | `TEST-SWARM-C02` |
| **4. Context Drift / Stale Projection** | `validateContextProjection()` | `SWARM_CONTEXT_STALE` | `TEST-SWARM-D01` |
| **5. Subagent Recursive Spawning** | `validateWorkerLimits()` | `SWARM_RECURSIVE_SPAWN_DENIED`| `TEST-SWARM-A01` |
| **6. Silent Baseline Overwrite** | `validateBaselineImmutability()`| `VQA_BASELINE_TAMPERED` | `TEST-VISUAL-B02` |
| **7. Flaky Subpixel Font Diffs** | `anti_aliasing_threshold` & masks| `VQA_VISUAL_REGRESSION` | `TEST-VISUAL-D01` |
| **8. Credential Leak in Screenshot**| Auto-masking password fields | `VQA_MASK_FAILURE` | `TEST-VISUAL-D02` |
| **9. Verify Browser Hang in CI** | Read-only offline manifest check | `VERIFY_NETWORK_DETECTED` | `TEST-VISUAL-E01` |
| **10. Spec Overwrite by Visual QA**| Authority hierarchy check | `VQA_AUTHORITY_CONFLICT` | `TEST-VISUAL-A01` |

---

## 32. Implementation Phases

```text
================================================================================
                    UPGRADE E IMPLEMENTATION PHASES
================================================================================

Phase 1 — Swarm Core Contracts & Partition Planner
  - Implement src/lib/swarm.js (parsing, wave scheduling, disjoint write sets).
  - Register bootstrap contracts and findings.
  - Tests: tests/swarm-partitioning.test.js (TEST-SWARM-A01, TEST-SWARM-A02).

Phase 2 — Review Independence, Safety Gates & Context Projection
  - Implement author != reviewer gate, Upgrade C interceptor, and Upgrade D projection.
  - Tests: tests/swarm-review.test.js (TEST-SWARM-B01..B02, C01..C02, D01..D02, E01..E02).

Phase 3 — Visual QA Manifest, Viewports & Baseline Safety
  - Implement src/lib/visual-qa.js (schema validation, viewport profiles, baseline SHA-256).
  - Tests: tests/visual-manifest.test.js (TEST-VISUAL-A01..A02, B01..B02).

Phase 4 — Visual Regression Detection, Masking & CLI Ergonomics
  - Implement diff engine, neutral selector masking, password auto-masking.
  - Implement src/commands/swarm.js and src/commands/visual.js; register in src/cli.js.
  - Tests: tests/visual-diff.test.js (TEST-VISUAL-C01..C02, D01..D02).

Phase 5 — Verify Purity Integration, Closure Machinery & Hardening
  - Integrate Stage 5.3 and 5.4 in src/commands/verify.js.
  - Update src/lib/closure-context.js.
  - Register 5 test suites in package.json test script.
  - Tests: tests/swarm-visual-purity.test.js (TEST-VISUAL-E01, TEST-VISUAL-E02).
  - Full suite run (npm test, ci:all).

================================================================================
```

---

## 33. Dependency Graph

```text
Schema Definitions & Canonical Types
                │
                ▼
Swarm Partition & Write-Set Planner (src/lib/swarm.js)
                │
                ▼
Review Independence & Context Projection Engine
                │
                ▼
Visual QA Manifest & Viewport Matrix (src/lib/visual-qa.js)
                │
                ▼
Offline Baseline Hasher & Neutral Masking Comparator
                │
                ▼
CLI Command Handlers (src/commands/swarm.js, src/commands/visual.js)
                │
       ┌────────┴────────┐
       ▼                 ▼
CLI Registration   Verify Engine Integration (Stages 5.3/5.4)
 (src/cli.js)      (src/commands/verify.js)
       │                 │
       └────────┬────────┘
                ▼
Canonical Acceptance Test Suites (20 Tests / 5 Files)
                │
                ▼
Closure Evidence Integration & Final CI Validation
```

---

## 34. Risk Register

| Risk | Impact | Mitigation Strategy | Mechanical Proof |
| :--- | :--- | :--- | :--- |
| **Authority Inversion** | Agent outputs overwrite spec | Invariant 1: Spec is supreme; verify rejects unbacked changes | `TEST-SWARM-A01` |
| **Write Collision** | Lost work / corrupted files | Disjoint write set validation per wave fail-closed | `TEST-SWARM-A02` |
| **Self-Review Bypass** | Flawed code merged uninspected| Non-waivable `author != reviewer` identity comparison | `TEST-SWARM-B01` |
| **Token Runaway** | Financial waste | Interception by Upgrade C BillableActionGate | `TEST-SWARM-C02` |
| **Stale Context** | Invariant amnesia | Pinned capsule SHA-256 hash comparison against disk | `TEST-SWARM-D01` |
| **Silent Baseline Mutate**| Regressions masked as passes | `gemstack verify` runs pure read-only; image hashes pinned | `TEST-VISUAL-B02` |
| **Secret Leak in Capture**| Credentials committed | Mandatory automatic masking on password/auth fields | `TEST-VISUAL-D02` |
| **CI Browser Hang** | Blocked pipelines | Verify evaluates manifests/evidence offline without browsers | `TEST-VISUAL-E01` |
| **Legacy Breakage** | Existing projects fail | Missing manifests trigger graceful legacy mode (exit 0) | `TEST-SWARM-E02` / `TEST-VISUAL-E02` |

---

## 35. Frozen Contract Review

- **Upgrade A Contracts**: Zero conflicts. Reuses `hasher.js`, `contracts.js`, and `findings.js` without altering interfaces.
- **Upgrade B Semantics**: Zero conflicts. `VERIFY = VALIDATE` preserved; `closure.json` evidence collection remains intact.
- **Upgrade C Safety**: Zero conflicts. `ProviderCapabilityGate` and `BillableActionGate` are integrated and respected.
- **Upgrade D Context**: Zero conflicts. Swarm context derives strictly from `context-capsule.json` without re-implementation.
- **Frozen Contracts Affected**: **`NONE`**.

---

## 36. Explicit Deferred Items

The following items are explicitly deferred from Upgrade E:
1. **Live Multi-Process Supervisor / Agent Daemon**: Background process clusters or socket servers (non-goal).
2. **Bundled Headless Browser Binaries**: Heavy Chromium/Playwright binaries inside npm package dependencies (non-goal).
3. **Fuzzy AI Aesthetic Grading**: Subjective LLM opinions on UI aesthetics or beauty (non-goal).
4. **Distributed Swarm Consensus**: Multi-node network consensus protocols (out of scope).
5. **Package Version Bump / Release**: Version bumping and npm publishing (strictly deferred to release phase).
