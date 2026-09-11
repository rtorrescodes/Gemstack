# Especificación de Funcionalidad: Agent Swarm & Visual QA (Upgrade E)

**Feature Branch**: `010-agent-swarm-visual-qa`  
**Feature Directory**: `specs/010-agent-swarm-visual-qa/`  
**Lifecycle Status**: `SPEC_COMPLETE`  
**Stop Reason**: `SPEC_COMPLETE_AWAITING_REVIEW`

---

## 1. Problem Statement

Gemstack provides a rigorous, offline-first, deterministic foundation for specification-driven software engineering. Through closed Upgrades A, B, C, and D, the repository guarantees:
- Frozen contract integrity and feature state transitions (Upgrade A),
- Verification purity, offline enforcement, and clean CLI ergonomics (Upgrade B),
- Deterministic capability and cost safety gating for external and billable actions (Upgrade C),
- Bounded, lossless continuation context compression with cryptographic provenance (Upgrade D).

However, as software systems grow in complexity, modern engineering workflows increasingly demand:
1. **Parallel Execution via Multi-Agent Swarms**: Decomposing feature implementation into concurrent subtasks executed by bounded specialized agents (workers, researchers, security auditors).
2. **Visual Verification of User Interfaces**: Validating that frontend screens, responsive layouts, design token compliance, and visual user journeys match specifications across target viewports without manual human spot-checking.

Without explicit architectural controls, these two capabilities introduce catastrophic risks of system degradation:
- **Authority Inversion**: Autonomous agents or browser screenshot comparison tools attempt to declare themselves architectural authorities, overwriting specifications, bypassing frozen contracts, or claiming task completion based on subjective visual appeal.
- **Concurrent State Corruption & Write Collisions**: Multiple parallel workers modifying the same files concurrently without strict partition ownership, leading to race conditions, overwritten work, and untracked mutations.
- **Role Contamination & Self-Review**: The agent that authors code reviewing and approving its own implementation, bypassing the fundamental separation of duties (`AUTHOR = REVIEWER`).
- **Cost Runaway & Rate-Limit Exhaustion**: Swarms launching unbounded parallel API queries or billable tool actions, bypassing Upgrade C cost ledgers and spending limits.
- **Flaky Visual Diffing & Viewport Nondeterminism**: Pixel-diffing across dynamic animations, anti-aliased font rendering across OS platforms, or variable viewport sizes producing nondeterministic false positives in CI.
- **Runtime Bloat**: Introducing gigabyte-sized headless browser frameworks (e.g., full Chromium/Playwright binaries) into Gemstack's core runtime package, violating the permanent zero-runtime-dependency invariant.

Gemstack requires a deterministic, auditable, offline-verifiable architecture that coordinates multi-agent swarms and validates visual QA evidence while preserving the absolute authority of specifications, plans, tasks, and frozen contracts.

---

## 2. Goals & Non-Goals

### Goals
- **Deterministic Swarm Planning & Coordination**: Define formal data structures and rules for decomposing `tasks.md` into parallel, non-overlapping work packages assigned to bounded worker roles with explicit write-set partitions.
- **Strict Separation of Duties (`AUTHOR != REVIEWER`)**: Enforce that an agent or worker role assigned to implement code or visual artifacts cannot act as the final reviewer, security auditor, or closure verifier.
- **Provider & Cost Safety Integration**: Mandate that every billable or model invocation executed within a swarm passes through Upgrade C's `ProviderCapabilityGate` and `BillableActionGate`.
- **Context Projection Integration**: Require every swarm worker to receive its context strictly as a deterministic projection of Upgrade D's `context-capsule.json`, preventing conversational context pollution.
- **Structured Visual QA Evidence & Scenario Contracts**: Define a canonical schema (`visual-qa.json`) for declaring UI visual acceptance criteria, deterministic viewports, element selectors, and baseline evidence hashes.
- **Zero-Runtime-Dependency Core**: Ensure that Gemstack's core CLI, verification engine, and swarm/visual validators require zero external npm packages and zero bundled browser binaries.
- **Deterministic Baseline & Diffing Rules**: Establish strict criteria for visual evidence collection (fixed viewports, masked dynamic regions, explicit baseline update semantics) to prevent flaky nondeterministic verification.
- **Verification Purity (`VERIFY = VALIDATE`)**: Guarantee that `gemstack verify` inspects swarm schedules, write ownership, review attestations, and visual evidence manifests in pure read-only mode with zero file mutations and zero live browser invocations.
- **Fail-Closed Conflict Detection**: Mechanically reject any swarm plan or evidence submission where overlapping write permissions, unreviewed changes, gate bypasses, or visual regressions occur.
- **Legacy Compatibility**: Ensure existing projects without swarms or visual UI components verify cleanly with zero false blockers.

### Non-Goals
- Gemstack does **NOT** build a live autonomous multi-process daemon server or cluster orchestrator in its core runtime.
- Gemstack does **NOT** bundle Puppeteer, Playwright, or Chromium into its runtime npm dependencies.
- Gemstack does **NOT** perform fuzzy, subjective, or perceptual AI aesthetic grading as authoritative visual verification.
- Gemstack does **NOT** allow visual screenshots or worker logs to supersede or modify `spec.md`, `plan.md`, `tasks.md`, or `closure.json`.
- Gemstack does **NOT** allow automated visual diff tools to silently update visual baselines during verification.
- Gemstack does **NOT** manage real-time agent networking, socket protocols, or distributed consensus.

---

## 3. Core Architectural Principles & Invariants

```text
================================================================================
                    UPGRADE E CANONICAL SAFETY INVARIANTS
================================================================================

1. SWARM_AUTHORITY_SUBORDINATE
   SPEC / PLAN / TASKS / FROZEN CONTRACTS = SOLE AUTHORITY.
   Worker agents produce PROPOSED WORK. Orchestrators produce PROPOSED SCHEDULES.
   Neither worker outputs nor orchestrator decisions can alter frozen contracts,
   bypass tasks, or declare closure autonomously.

2. AUTHOR_NOT_REVIEWER
   The entity, agent role, or worker ID that authors an implementation task
   MUST NOT serve as the reviewer, security auditor, or closure verifier for
   that task. Independent verification is non-waivable.

3. EXCLUSIVE_TASK_WRITE_OWNERSHIP
   Every active task in a swarm must have exactly one designated write owner.
   No two concurrently executing tasks may declare overlapping write scopes
   (file paths or directory trees). Conflicting writes produce fail-closed rejection.

4. SWARM_PROVIDER_SAFETY_GATED
   All model queries, tool executions, and external operations performed by
   swarm workers are subject to Upgrade C ProviderCapabilityGate and
   BillableActionGate policies. Offline and unknown-cost invariants apply.

5. SWARM_CONTEXT_PROJECTED
   All swarm worker context payloads MUST be deterministic projections of the
   authoritative Upgrade D Context Capsule. Workers must not receive raw chat
   histories or undeclared environment state.

6. VISUAL_EVIDENCE_SUBORDINATE
   Visual QA screenshots, DOM snapshots, and diff metrics represent EVIDENCE,
   never ARCHITECTURAL AUTHORITY. Visual evidence can prove failure of a visual
   acceptance criterion, but cannot waive functional, cost, or security gates.

7. DETERMINISTIC_VIEWPORTS_AND_ENVIRONMENT
   Visual verification criteria MUST explicitly declare deterministic viewport
   dimensions, device scale factors, and color scheme modes. Unspecified or
   ambient display properties are strictly forbidden.

8. BASELINE_EXPLICIT_UPDATE_ONLY
   Visual regression baselines MUST NOT be updated automatically or implicitly
   during verification. Baseline updates require an explicit, intentional command
   invoked by a human engineer or authenticated closure workflow.

9. VERIFY_PURITY_READ_ONLY
   `gemstack verify` operates strictly in read-only mode. It validates swarm
   manifests, write boundaries, review attestations, and visual QA evidence
   without spawning live workers, mutating files, or launching browsers.

10. ZERO_RUNTIME_DEPENDENCY_CORE
    Gemstack core maintains runtime dependency delta = 0. Swarm coordination
    and visual QA verification logic rely exclusively on Node.js built-ins.
    Browser automation occurs via external development adapters or environment tools.

================================================================================
```

---

## 4. Upgrade E Bootstrap Contracts

```gemstack-contracts
[
  {
    "id": "swarm-authority-subordinate",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Agent swarm orchestrators and workers are strictly subordinate to repository specifications, plans, tasks, and frozen contracts."
  },
  {
    "id": "author-not-reviewer",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Separation of duties requires that the author of a code or task change cannot review or approve their own work."
  },
  {
    "id": "exclusive-task-write-ownership",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Concurrent swarm tasks must declare disjoint, non-overlapping file write sets to prevent write collisions."
  },
  {
    "id": "swarm-provider-safety-gated",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "All worker operations must pass Upgrade C capability and billable action gates."
  },
  {
    "id": "swarm-context-projected",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Worker contexts must be deterministically projected from Upgrade D context capsule without chat history leakage."
  },
  {
    "id": "visual-evidence-subordinate",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Visual artifacts and screenshots are verification evidence only and cannot alter specifications or override gates."
  },
  {
    "id": "deterministic-viewports",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "All visual QA scenarios must specify explicit width, height, and device scale factor."
  },
  {
    "id": "baseline-explicit-update-only",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Visual reference baselines may only be modified through explicit, recorded update operations."
  },
  {
    "id": "verify-swarm-visual-offline",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "gemstack verify validates swarm manifests and visual evidence offline with zero network and zero browser spawns."
  },
  {
    "id": "legacy-swarm-visual-compatibility",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Repositories lacking swarm schedules or visual QA manifests operate cleanly without error."
  }
]
```

---

## 5. Canonical Terminology

| Term | Canonical Meaning |
| :--- | :--- |
| **`SwarmPlan`** | The deterministic schedule and partition graph assigning parallel tasks (`[P]`) to bounded worker roles with explicit write sets. |
| **`SwarmManifest`** | The machine-readable JSON artifact (`swarm.json`) tracking active workers, task assignments, write leases, and execution states. |
| **`WorkerRole`** | A bounded behavioral persona (e.g., `implementer`, `reviewer`, `researcher`, `security-auditor`) with constrained tool permissions. |
| **`WriteSetPartition`** | The strictly enumerated set of relative file paths that a specific worker or task is authorized to create or modify. |
| **`IndependentReview`** | A mandatory attestation by a distinct worker role proving verification of correctness, security, and contract compliance. |
| **`VisualQAScenario`** | A discrete UI test case declaring a target route/URL, viewport dimensions, user interaction steps, and expected visual outcomes. |
| **`VisualQAManifest`** | The canonical JSON artifact (`visual-qa.json`) defining all visual test scenarios, selectors, masks, and baseline hashes. |
| **`VisualEvidence`** | Structured output (screenshot files, DOM snapshots, bounding box hashes) generated during scenario execution. |
| **`VisualBaseline`** | An approved, canonical reference image or digest representing the authoritative visual acceptance standard for a scenario. |
| **`VisualDiffReport`** | The deterministic comparison result between live visual evidence and the recorded baseline, identifying pixel or layout deviations. |

---

## 6. Architecture & System Overview

```
+---------------------------------------------------------------------------------------------------+
|                                 GEMSTACK ARCHITECTURAL CORE                                       |
|                                                                                                   |
|   +-------------------------------------------------------------------------------------------+   |
|   |                       AUTHORITATIVE SPECIFICATION & CONTRACT LAYER                        |   |
|   |   spec.md  |  plan.md  |  tasks.md  |  frozen-contracts.json  |  context-capsule.json         |   |
|   +---------------------------------------------+---------------------------------------------+   |
|                                                 |                                                 |
|                                                 v                                                 |
|   +-------------------------------------------------------------------------------------------+   |
|   |                              SWARM ORCHESTRATION SUBSYSTEM                                |   |
|   |                                                                                           |   |
|   |   [tasks.md [P] Tasks] ----> [Swarm Partition Planner] ----> [swarm.json (Manifest)]      |   |
|   |                                         |                                                 |   |
|   |                                         v                                                 |   |
|   |                 +-----------------------------------------------+                         |   |
|   |                 | Concurrency & Write Set Conflict Engine       |                         |   |
|   |                 | - Exclusive File Leases                       |                         |   |
|   |                 | - Author != Reviewer Enforcement              |                         |   |
|   |                 | - Capsule Context Projection Provider         |                         |   |
|   |                 | - Upgrade C Safety Gate Interceptor           |                         |   |
|   |                 +-----------------------------------------------+                         |   |
|   +---------------------------------------------+---------------------------------------------+   |
|                                                 |                                                 |
|                                                 v                                                 |
|   +-------------------------------------------------------------------------------------------+   |
|   |                                 VISUAL QA SUBSYSTEM                                       |   |
|   |                                                                                           |   |
|   |   [UI Acceptance Criteria] -> [visual-qa.json Manifest]                                   |   |
|   |                                         |                                                 |   |
|   |                                         v                                                 |   |
|   |                 +-----------------------------------------------+                         |   |
|   |                 | Scenario & Viewport Matrix Validator          |                         |   |
|   |                 | - Deterministic Resolution (WxH, Scale)       |                         |   |
|   |                 | - Dynamic Region Masking (Timestamps, Avatars)|                         |   |
|   |                 | - Offline Evidence Hash & Digest Comparator   |                         |   |
|   |                 | - Explicit Baseline Lifecycle Enforcer        |                         |   |
|   |                 +-----------------------------------------------+                         |   |
|   +---------------------------------------------+---------------------------------------------+   |
|                                                 |                                                 |
|                                                 v                                                 |
|   +-------------------------------------------------------------------------------------------+   |
|   |                           UNIFIED OFFLINE VERIFICATION ENGINE                             |   |
|   |                                                                                           |   |
|   |   gemstack verify (Read-Only)                                                             |   |
|   |   - Validates swarm task integrity & review separation                                    |   |
|   |   - Validates visual-qa.json schema & evidence completeness                               |   |
|   |   - Validates baseline cryptographic hashes                                               |   |
|   |   - Emits fail-closed findings on regressions, collisions, or unauthorized mutations      |   |
|   +-------------------------------------------------------------------------------------------+   |
+---------------------------------------------------------------------------------------------------+
```

---

## 7. Major Decision 1: Swarm Architecture — Deterministic Planning & Evidence Contracts

### Evaluation of Alternatives
- **Alternative 1: Live Process Daemon / Long-Running Cluster**. Gemstack embeds an active background process manager that launches child processes, manages worker heartbeats, and orchestrates live IPC.
  - *Drawbacks*: Severe violation of zero-dependency invariant; platform inconsistencies between Windows, Linux, and macOS; process lifecycle flakiness in headless CI; high cognitive and computational overhead.
- **Alternative 2: Deterministic Swarm Planning, Partitioning, and Evidence Contracts (Selected)**. Gemstack acts as the architectural coordination, write-set guard, dependency enforcer, and evidence validator. The core engine compiles tasks into deterministic swarm execution graphs (`swarm.json`), enforces exclusive file partitions, validates context projections, intercepts billable actions, and requires independent review attestations. Worker execution is performed by external agent runners (IDE subagents, CI scripts, or human engineers) who submit structured evidence.
  - *Advantages*: 100% deterministic, offline-verifiable, cross-platform, zero runtime dependencies, robust against process crashes, and preserves strict separation of authority.

### Resolution
Gemstack adopts **Alternative 2: Deterministic Planning, Partitioning, and Evidence Contracts**. Gemstack core governs the *rules of engagement*, *partition boundaries*, and *acceptance validation*, while remaining agnostic to the specific subagent runner implementation.

---

## 8. Major Decision 2: Visual QA Architecture — Structured Evidence & Deterministic Offline Validation

### Evaluation of Alternatives
- **Alternative 1: Bundled Heavy Browser Runtime**. Include Playwright/Puppeteer and Chromium binaries directly inside Gemstack's production npm package dependencies.
  - *Drawbacks*: Adds hundreds of megabytes to package size; violates the zero-runtime-dependency invariant; causes brittle native binary installation failures across varied developer environments; fails on offline/air-gapped machines.
- **Alternative 2: Structured Visual Evidence & Deterministic Offline Validation with Adapter-Based Capture (Selected)**. Gemstack defines canonical visual scenario manifests (`visual-qa.json`) and validates visual evidence (screenshots, DOM trees, layout geometry hashes) offline using pure Node.js standard libraries. Capture execution is decoupled into optional dev-adapters or lightweight user-space test scripts that execute in environments where browser runtimes exist.
  - *Advantages*: Preserves zero runtime dependencies in core; guarantees offline verification purity in CI; allows flexible capture mechanisms (Puppeteer, Playwright, MCP browser tools, or synthetic mock harnesses); provides deterministic regression detection via cryptographic baseline hashing.

### Resolution
Gemstack adopts **Alternative 2: Structured Visual Evidence & Deterministic Offline Validation with Adapter-Based Capture**. Core Gemstack inspects, validates, diffs, and gates visual evidence offline without requiring a bundled browser binary.

---

## 9. Authority & Subordination Hierarchy

To eliminate any ambiguity regarding who commands the system:
1. **Primary Authority**: `spec.md`, `plan.md`, `tasks.md`, and frozen architectural contracts.
2. **Derived Invariants**: Upgrade D `context-capsule.json`.
3. **Execution Manifests**: `swarm.json` and `visual-qa.json` (compiled from and validated against primary authority).
4. **Execution Evidence**: Worker diffs, agent messages, visual screenshots, and DOM captures.
5. **Non-Authoritative Status**: Neither an agent's reasoning trace, nor an LLM's opinion, nor a screenshot comparison tool has the authority to alter specifications, declare a task complete without passing tests, or waive a frozen contract.

---

## 10. Swarm Subsystem: Lifecycle & Execution Model

The swarm coordination lifecycle consists of five discrete states:

```
+--------------+       +----------------+       +-------------------+
|  DISCOVER    | ----> |    SCHEDULE    | ----> |     EXECUTE       |
| Read [P] in  |       | Compile write  |       | Workers perform   |
| tasks.md     |       | partitions     |       | bounded changes   |
+--------------+       +----------------+       +-------------------+
                                                          |
                                                          v
                       +----------------+       +-------------------+
                       |    CLOSURE     | <---- |     VALIDATE      |
                       | Merge evidence |       | Independent review|
                       | and reconcile  |       | & gate check      |
                       +----------------+       +-------------------+
```

1. **Discover**: The swarm planner scans the active feature's `tasks.md` for tasks annotated with the parallel marker `[P]`.
2. **Schedule**: The planner generates a deterministic `swarm.json` execution plan, grouping independent tasks into concurrent waves and calculating the explicit file write-set for each task.
3. **Execute**: Worker agents execute assigned tasks within their exclusive write-set boundary, referencing only their projected context capsule.
4. **Validate**: Each completed task is submitted for independent review. The reviewer role validates test passage, contract compliance, and write-set boundaries.
5. **Closure**: Once all wave tasks and reviews pass, task checkmarks are reconciled into `tasks.md`.

---

## 11. Swarm Worker Roles & Separation of Duties (`AUTHOR != REVIEWER`)

Upgrade E defines four canonical, bounded worker roles:

| Role Name | Permitted Capabilities | Forbidden Actions |
| :--- | :--- | :--- |
| **`implementer`** | Create and edit source files within assigned write-set partition; run local tests. | Cannot approve own PR/task; cannot review own work; cannot modify spec or plan. |
| **`reviewer`** | Read code diffs; execute verification tests; inspect style and contract compliance; sign review attestation. | Cannot author production code for the task under review; cannot bypass failing tests. |
| **`security-auditor`** | Inspect code and dependencies for secret leakage, injection flaws, and gate compliance. | Cannot author implementation code; cannot alter security contracts. |
| **`coordinator`** | Parse `tasks.md`; compile `swarm.json`; monitor wave completion; reconcile task checkmarks. | Cannot implement code; cannot approve reviews; cannot bypass task dependencies. |

### Separation of Duties Invariant
For any task ( T ):
$$\text{Author}(T) \neq \text{Reviewer}(T)$$
If (\text{Author}(T) == \text{Reviewer}(T)\), the verification engine emits `SWARM_SELF_REVIEW_DETECTED` and halts verification fail-closed.

---

## 12. Write-Set Partitioning & Concurrency Safety

To prevent write collisions and merge conflicts during parallel execution:
1. **Explicit Declaration**: Every parallel task must declare a `write_set` containing exact POSIX-relative file paths or directory globs.
2. **Disjoint Intersection**: For any two tasks ( T_A ) and ( T_B ) scheduled in the same concurrent wave:
$$\text{WriteSet}(T_A) \cap \text{WriteSet}(T_B) = \emptyset$$
3. **Shared Read Access**: Multiple workers may concurrently read common files, but write access is strictly exclusive.
4. **Collision Detection**: If two concurrent tasks attempt to declare or modify overlapping paths, the planner refuses to schedule them in parallel, serializing them into sequential waves and emitting `SWARM_WRITE_COLLISION_PREVENTED`.

---

## 13. Swarm Context Projection (Upgrade D Integration)

Swarm workers must never be initialized with unbounded chat history or raw conversational logs. Gemstack enforces deterministic context projection:
1. **Capsule Extraction**: The swarm coordinator reads the active `context-capsule.json`.
2. **Role-Specific Projection**: A lightweight, role-tailored projection is compiled:
   - **Implementer Projection**: Target task description, acceptance criteria, explicit write-set boundary, relevant interface contracts.
   - **Reviewer Projection**: Task description, acceptance criteria, author identity, diff of modified files, test matrix criteria.
3. **Immutability & Provenance**: The projected context carries the `source_set_hash` of the parent capsule, ensuring workers operate against an identical, verified version of project reality.

---

## 14. Swarm Cost & Safety Gating (Upgrade C Integration)

All worker activities that interact with external services or AI model providers are governed by Upgrade C gates:
1. **Model Invocation Gate**: When a worker invokes an LLM API, the call is intercepted by `ProviderCapabilityGate`.
2. **Billable Action Gate**: The estimated token consumption and provider tier are evaluated by `BillableActionGate`.
3. **Ledger Recording**: Successful actions are logged into `cost-ledger.json`.
4. **Fail-Closed Budget Cap**: If a swarm wave exceeds the allocated feature token budget or encounters an `UNKNOWN` provider cost classification, execution halts immediately fail-closed with `SWARM_COST_LIMIT_EXCEEDED`.

---

## 15. Swarm Manifest Schema (`swarm.json`)

The canonical swarm plan and evidence tracking artifact is located at:
`specs/<feature-id>/swarm.json`

```json
{
  "$schema": "https://gemstack.dev/schemas/v1/swarm.json",
  "version": "1.0.0",
  "feature_id": "010-agent-swarm-visual-qa",
  "source_capsule_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
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
            "src/lib/swarm-planner.js"
          ],
          "status": "COMPLETED",
          "review": {
            "reviewer_role": "reviewer",
            "reviewer_id": "worker-rev-beta",
            "status": "APPROVED",
            "reviewed_commit_hash": "a1b2c3d4e5f6...",
            "review_timestamp": "2026-09-11T19:00:00Z",
            "attestation": "All acceptance criteria verified; write-set strictly adhered to."
          }
        }
      ]
    }
  ]
}
```

---

## 16. Visual QA Subsystem: Architecture & Principles

Visual QA verifies the visual integrity and layout conformance of user interfaces. It is founded on three principles:
1. **Specification Subordination**: Visual criteria originate from `spec.md` acceptance criteria. A visual test cannot test arbitrary layout properties not grounded in specifications.
2. **Deterministic Capture Parameters**: Screen resolution, color depth, browser rendering flags, and device scaling must be explicitly locked.
3. **Cryptographic Baseline Hashing**: Visual state is tracked via canonical SHA-256 hashes of standardized image data and DOM structure trees, enabling fast, offline, deterministic verification.

---

## 17. Visual QA Manifest Schema (`visual-qa.json`)

The canonical visual QA configuration and evidence artifact is located at:
`specs/<feature-id>/visual-qa.json`

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
        "approved_by": "human-engineer-lead",
        "approved_at": "2026-09-11T18:00:00Z"
      }
    }
  ]
}
```

---

## 18. Viewport Resolution & Determinism Matrix

Visual testing requires standardized, repeatable viewport configurations. Gemstack recognizes four canonical viewport profiles:

| Viewport Profile | Width (px) | Height (px) | Scale Factor | Intended Form Factor |
| :--- | :--- | :--- | :--- | :--- |
| **`desktop-standard`** | 1920 | 1080 | 1 | Standard 1080p desktop / laptop |
| **`desktop-compact`** | 1280 | 800 | 1 | Small laptop / compact window |
| **`tablet-portrait`** | 768 | 1024 | 2 | Medium tablet display |
| **`mobile-portrait`** | 375 | 667 | 2 | Standard mobile smartphone display |

Any scenario omitting viewport parameters or specifying zero/negative dimensions fails closed with `VQA_INVALID_VIEWPORT_SPECIFICATION`.

---

## 19. Dynamic Region Masking & Anti-Flake Protections

Visual tests often suffer from false-positive diffs caused by non-deterministic content. Gemstack provides deterministic masking rules:
1. **Mask Selectors**: Elements matching selectors declared in `selectors.mask` are deterministically masked with a solid neutral fill (`#808080`) prior to hash generation.
2. **Animation Freezing**: Scenarios mandate CSS animation disabling (`prefers-reduced-motion: reduce` and zero-duration CSS transitions).
3. **Caret & Font Smoothing**: Text cursors/carets are explicitly hidden; web fonts must complete layout before snapshot capture.
4. **Anti-Aliasing Threshold**: Diffs within configurable color-distance tolerances (`anti_aliasing_threshold`) are filtered to prevent cross-OS font smoothing noise.

---

## 20. Baseline Lifecycle Management & Update Semantics

Visual baselines represent authoritative visual standards:
1. **Explicit Initial Approval**: New scenarios lack baselines until captured evidence is reviewed and explicitly promoted by an engineer.
2. **Explicit Promotion Command**: Baselines are NEVER auto-updated during test execution or verification. They can only be updated via an explicit command (e.g., `gemstack vqa promote <scenario-id>`).
3. **Audit Trail**: Every baseline entry in `visual-qa.json` records `image_sha256`, `approved_by`, and `approved_at`.
4. **Tampering Detection**: If a baseline image on disk does not match its recorded `image_sha256`, verification halts with `VQA_BASELINE_TAMPERED`.

---

## 21. Visual Diffing & Regression Detection Engine

The offline diffing engine inspects live evidence against recorded baselines:
1. **Byte-for-Byte Digest Check**: Fast path: if live screenshot SHA-256 matches baseline `image_sha256`, the scenario immediately passes.
2. **Structural DOM Hash Check**: Compares normalized DOM tree hash; flags structural DOM shifts even when pixel diffs appear subtle.
3. **Offline Pixel Comparison**: If digests differ, the engine calculates the percentage of mismatched non-masked pixels.
4. **Tolerance Evaluation**: If `diff_percentage > max_diff_percentage`, the test fails closed with `VQA_VISUAL_REGRESSION_DETECTED`.

---

## 22. Interaction Between Swarm & Visual QA

Swarm workers and Visual QA interact under strict boundaries:
- **Worker Execution of Visual Tests**: An `implementer` worker can invoke the visual test adapter to check UI changes locally.
- **Evidence Submission**: The worker commits generated visual evidence to the feature's evidence directory.
- **Reviewer Inspection**: The independent `reviewer` worker inspects the generated visual diff report alongside the code changes.
- **No Baseline Promotion by Workers**: Swarm worker agents are STRICTLY FORBIDDEN from promoting baselines. Baseline approval is reserved for human developers or designated lead roles.

---

## 23. Verification Engine Integration (`gemstack verify`)

`gemstack verify` enforces Upgrade E validation in pure read-only mode:
1. **Swarm Verification**:
   - Validates `swarm.json` schema and syntax.
   - Verifies all parallel tasks possess disjoint write-sets.
   - Verifies `AUTHOR != REVIEWER` separation on all approved tasks.
   - Proves no closed task lacks an independent review attestation.
2. **Visual QA Verification**:
   - Validates `visual-qa.json` schema and scenario definitions.
   - Validates that every baseline image exists and matches its recorded SHA-256 hash.
   - Verifies visual evidence completeness for all declared scenarios.
   - Ensures no baseline images were mutated during the verify run.
3. **Offline Purity**: The entire verification process executes offline with zero socket calls, zero child process spawns, and zero browser launches.

---

## 24. Determinism & Cryptographic Provenance

Determinism is guaranteed across all Upgrade E artifacts:
- **Canonical Object Key Ordering**: All JSON serialization strictly orders keys using UTF-16 code units.
- **POSIX Path Normalization**: File paths in write sets and image locations are stored as POSIX-relative strings without drive letters or trailing slashes.
- **Image Hash Standards**: Screenshot files are hashed using SHA-256 over raw image bytes.
- **DOM Normalization**: DOM snapshots strip ephemeral session IDs, formatting attributes deterministically before hashing.

---

## 25. Security & Isolation Architecture

Upgrade E protects repository security through:
- **File System Boundary Enforcement**: Swarm write-sets are restricted to repository-relative paths. Attempts to write to system directories, parent directories (`../`), or git internals (`.git/`) are strictly blocked.
- **Secret Masking & Exclusion**: Visual QA captures are forbidden from screenshotting or logging sensitive input fields (password inputs, authorization tokens). Elements with `type="password"` or `data-sensitive="true"` are automatically masked.
- **No Untrusted Code Execution in Verify**: Verification reads data manifests and hashes; it never evaluates dynamic JavaScript or arbitrary plugins.

---

## 26. Performance & Scalability Targets

- **Swarm Schedule Validation**: Validating a 50-task swarm partition graph takes under 100ms.
- **Visual Manifest Verification**: Verifying 100 visual scenarios and baseline hashes takes under 500ms offline.
- **Memory Footprint**: Validation runs within standard Node.js process limits (<128MB RAM).
- **Core Package Size**: Zero bytes added for browser engines; zero external runtime dependencies added to `package.json`.

---

## 27. Error Codes & Diagnostic Catalog

| Code | Severity | Trigger Condition |
| :--- | :--- | :--- |
| **`SWARM_WRITE_COLLISION`** | FATAL | Two concurrent tasks declare overlapping write-set file paths. |
| **`SWARM_SELF_REVIEW_DETECTED`** | FATAL | The author of a task is recorded as its reviewer. |
| **`SWARM_MISSING_REVIEW`** | ERROR | A completed task lacks an approved independent review attestation. |
| **`SWARM_WRITE_SET_VIOLATION`** | FATAL | A worker modified files outside its declared write-set partition. |
| **`SWARM_CONTEXT_UNPROJECTED`** | ERROR | A worker context payload was generated without capsule provenance. |
| **`VQA_INVALID_VIEWPORT`** | ERROR | Scenario viewport specification is missing or invalid. |
| **`VQA_BASELINE_TAMPERED`** | FATAL | Baseline image file hash does not match recorded `image_sha256`. |
| **`VQA_VISUAL_REGRESSION`** | ERROR | Live visual evidence deviates from baseline beyond allowed tolerance. |
| **`VQA_UNAUTHORIZED_PROMOTION`** | FATAL | An unauthorized worker role attempted to promote a visual baseline. |
| **`VQA_MASK_FAILURE`** | WARNING | Declared mask selector did not match any element in captured DOM. |

---

## 28. Comprehensive Threat Model & Adversarial Vectors

| Threat Vector | Vulnerability Description | Mitigation Architecture |
| :--- | :--- | :--- |
| **1. Rogue Swarm Worker** | Worker attempts to edit `package.json` or security gates. | Write-set partitioning strictly limits worker write lease; verify detects out-of-bounds diffs. |
| **2. Self-Approving Agent** | Agent implements a flaw and signs off its own review. | Fail-closed `AUTHOR != REVIEWER` check rejects identical author/reviewer IDs. |
| **3. Flaky Font CI Diff** | Cross-platform font rendering causes 0.05% pixel shift. | Configurable anti-aliasing threshold and neutral mask filters eliminate subpixel noise. |
| **4. Silent Baseline Overwrite**| Automated tool overwrites baseline images during test run. | Verify enforces read-only purity; baseline files are cryptographically pinned in manifest. |
| **5. Password Leak in Screenshot** | Login visual QA captures user credentials in screenshot. | Sensitive inputs (`type=password`) are automatically masked with solid fill before capture. |
| **6. Token Runaway in Swarm** | Parallel workers enter infinite retry loop consuming tokens. | Upgrade C BillableActionGate intercepts all calls and halts execution on budget breach. |
| **7. Context Smuggling** | Worker ingests private developer prompts or uncommitted keys. | Swarm context is strictly projected from validated, secret-scanned Context Capsule. |
| **8. Parallel Race Condition** | Two workers modify the same module simultaneously. | Concurrency planner enforces mutually exclusive disjoint write sets per wave. |
| **9. Verify Browser Hang** | `gemstack verify` hangs in CI waiting for headless Chrome. | Verify does not launch browsers; it validates evidence, manifests, and hashes offline. |
| **10. Spec Overwrite by Visual QA** | Agent attempts to alter spec criteria because screenshot failed. | Spec authority is supreme; visual evidence is subordinate; spec edits require human review. |

---

## 29. Canonical Acceptance Matrix (TEST-SWARM-A01 .. E02 & TEST-VISUAL-A01 .. E02)

Upgrade E establishes exactly 20 canonical acceptance test requirements:

```gemstack-test-matrix
[
  {
    "id": "TEST-SWARM-A01",
    "category": "SWARM_PARTITIONING",
    "layer": "UNIT",
    "description": "Validates that parallel tasks with disjoint write sets schedule cleanly in concurrent waves.",
    "pass_criteria": "Planner assigns tasks to same wave when write sets share zero common files.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-A02",
    "category": "SWARM_PARTITIONING",
    "layer": "UNIT",
    "description": "Detects overlapping write sets between parallel tasks and serializes them into sequential waves.",
    "pass_criteria": "Emits SWARM_WRITE_COLLISION_PREVENTED and separates conflicting tasks into wave N and N+1.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-B01",
    "category": "SEPARATION_OF_DUTIES",
    "layer": "UNIT",
    "description": "Rejects task review attestation when author ID matches reviewer ID.",
    "pass_criteria": "Emits SWARM_SELF_REVIEW_DETECTED and fails validation closed.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-B02",
    "category": "SEPARATION_OF_DUTIES",
    "layer": "UNIT",
    "description": "Accepts task review when performed by a distinct, authorized reviewer role.",
    "pass_criteria": "Review status validates as APPROVED with verified reviewer signature.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-C01",
    "category": "GATE_INTEGRATION",
    "layer": "INTEGRATION",
    "description": "Proves swarm worker model invocation is intercepted by Upgrade C ProviderCapabilityGate.",
    "pass_criteria": "Invocation fails closed when provider capability is undeclared or missing.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-C02",
    "category": "GATE_INTEGRATION",
    "layer": "INTEGRATION",
    "description": "Enforces budget limits across concurrent swarm workers via BillableActionGate.",
    "pass_criteria": "Halted with SWARM_COST_LIMIT_EXCEEDED when cumulative wave tokens exceed budget.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-D01",
    "category": "CONTEXT_PROJECTION",
    "layer": "UNIT",
    "description": "Validates that worker context projection matches authoritative context-capsule hash.",
    "pass_criteria": "Projection source_capsule_hash matches active capsule digest 100%.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-D02",
    "category": "CONTEXT_PROJECTION",
    "layer": "UNIT",
    "description": "Excludes historical chat transcripts and conversational narrative from worker payloads.",
    "pass_criteria": "Projected payload contains only structured task, spec, and contract data.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-E01",
    "category": "SWARM_VERIFY_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves gemstack verify checks swarm.json manifest in pure read-only mode.",
    "pass_criteria": "Zero file mutations and zero process spawns during verification.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-SWARM-E02",
    "category": "SWARM_LEGACY",
    "layer": "UNIT",
    "description": "Preserves backward compatibility for repositories lacking swarm schedules.",
    "pass_criteria": "Verification passes with exit code 0 when swarm.json is absent.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-A01",
    "category": "VISUAL_MANIFEST",
    "layer": "UNIT",
    "description": "Validates visual-qa.json schema conformance and required scenario properties.",
    "pass_criteria": "Rejects manifests missing route, viewport, or baseline references.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-A02",
    "category": "VISUAL_MANIFEST",
    "layer": "UNIT",
    "description": "Validates deterministic viewport specifications across standard profiles.",
    "pass_criteria": "Passes valid profiles; fails invalid or negative width/height dimensions.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-B01",
    "category": "BASELINE_SAFETY",
    "layer": "UNIT",
    "description": "Verifies that baseline image files match their recorded SHA-256 hashes.",
    "pass_criteria": "Emits VQA_BASELINE_TAMPERED if an image file is modified on disk.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-B02",
    "category": "BASELINE_SAFETY",
    "layer": "INTEGRATION",
    "description": "Proves baseline images are never silently modified during test execution or verification.",
    "pass_criteria": "Baseline image file timestamps and hashes remain unchanged after test run.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-C01",
    "category": "REGRESSION_DETECTION",
    "layer": "UNIT",
    "description": "Detects visual regression when live screenshot deviates from baseline beyond threshold.",
    "pass_criteria": "Fails validation with VQA_VISUAL_REGRESSION_DETECTED and diff metrics.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-C02",
    "category": "REGRESSION_DETECTION",
    "layer": "UNIT",
    "description": "Passes comparison cleanly when image hashes match 100%.",
    "pass_criteria": "Immediate pass without pixel diffing overhead when SHA-256 matches.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-D01",
    "category": "MASKING_PROTECTION",
    "layer": "UNIT",
    "description": "Applies deterministic neutral masking to dynamic selectors prior to diffing.",
    "pass_criteria": "Dynamic text variations within masked bounding boxes do not trigger diff failure.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-D02",
    "category": "MASKING_PROTECTION",
    "layer": "UNIT",
    "description": "Enforces mandatory automatic masking of password and sensitive credential fields.",
    "pass_criteria": "Password inputs are replaced with neutral mask fill in all evidence captures.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-E01",
    "category": "VISUAL_VERIFY_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves gemstack verify validates visual evidence offline with zero browser spawns.",
    "pass_criteria": "Verification passes completely offline with network sockets and child processes mocked to throw.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-VISUAL-E02",
    "category": "VISUAL_LEGACY",
    "layer": "UNIT",
    "description": "Preserves clean verification for backend or headless projects lacking visual QA manifests.",
    "pass_criteria": "Verification passes with exit code 0 when visual-qa.json is absent.",
    "gate": "REQUIRED"
  }
]
```

---

## 30. CLI & Developer Ergonomics (Design Only)

Upgrade E introduces dedicated subcommands under the `gemstack` CLI:

```text
gemstack swarm plan               Compile tasks.md into deterministic swarm.json waves
gemstack swarm validate           Validate write-set partitions and review attestations
gemstack vqa validate             Validate visual-qa.json schema, baselines, and evidence
gemstack vqa promote <scenario>   Explicitly promote live evidence to approved baseline
```

All subcommands maintain strict argument validation, JSON output formatting with `--json`, and zero file modifications during validation operations.

---

## 31. Future Test Strategy (Design Only)

*Note: Tests are NOT implemented during this specification phase. This strategy defines the mechanical requirements for future implementation.*

1. **Swarm Partitioning Suite (`tests/swarm-partitioning.test.js`)**:
   - Asserts non-overlapping write sets schedule concurrently.
   - Injects colliding paths; verifies sequential wave placement and warning emission.
2. **Separation of Duties Suite (`tests/swarm-review.test.js`)**:
   - Asserts `AUTHOR == REVIEWER` triggers fail-closed error `SWARM_SELF_REVIEW_DETECTED`.
   - Validates valid multi-agent review attestation structure.
3. **Visual QA Manifest Suite (`tests/visual-manifest.test.js`)**:
   - Tests viewport validation (positive integers, standard aspect ratios).
   - Validates baseline cryptographic hash integrity checks.
4. **Visual Regression & Masking Suite (`tests/visual-diff.test.js`)**:
   - Injects modified pixels outside mask; asserts `VQA_VISUAL_REGRESSION_DETECTED`.
   - Injects dynamic text inside mask; asserts clean pass.
5. **Verification Purity Suite (`tests/swarm-visual-purity.test.js`)**:
   - Runs `gemstack verify` with network sockets disabled and child process spawns mocked to throw.
   - Proves zero file mutations (hash tree comparison before and after verify).

---

## 32. Migration & Backward Compatibility Considerations

- **No Breaking Changes**: Existing repositories built with Gemstack v1.0, v1.1, v1.2, or v1.3 operate without modification.
- **Optional Adoption**: Projects that do not use multi-agent swarms or visual UI components omit `swarm.json` and `visual-qa.json`; verification treats their absence as valid legacy state.
- **Sidecar Non-Interference**: Swarm and visual metadata do not interfere with feature state sidecars (`.gemstack/state.json`) or context capsules.

---

## 33. Explicit Deferred Items

The following concepts are explicitly deferred and out of scope for Upgrade E:
1. **Live Process Daemon / Cluster Management**: Embedded background process supervisors or socket servers (non-goal).
2. **Bundled Browser Binaries**: Heavy Chromium/Playwright binaries inside npm package dependencies (non-goal).
3. **Fuzzy AI Aesthetic Grading**: Subjective LLM opinions on UI beauty or styling quality (non-goal).
4. **Distributed Swarm Consensus**: Multi-node consensus protocols or cross-network swarm federation (out of scope).
5. **Package Version Bump / Release**: Version bumping and npm publishing (strictly deferred to release phase).

---

## 34. Open Questions

**NONE.**  
Both architectural decisions (Swarm planning & evidence contracts, decoupled offline visual evidence validation) are fully resolved. Invariants, schemas, review boundaries, and acceptance matrices are completely defined with zero ambiguity.
