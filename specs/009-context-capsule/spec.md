# Especificación de Funcionalidad: Context Capsule / Context Compression (Upgrade D)

**Feature Branch**: `009-context-capsule`  
**Feature Directory**: `specs/009-context-capsule/`  
**Lifecycle Status**: `SPEC_COMPLETE`  
**Stop Reason**: `SPEC_COMPLETE_AWAITING_REVIEW`

---

## 1. Problem Statement

Large AI-assisted software engineering projects accumulate vast amounts of architectural, planning, task, and evidence context across multiple working sessions. This context spans accepted specifications, technical plans, task execution states, frozen architecture contracts, safety invariants, test closure evidence, and active constraints.

When engineering work continues in:
- A new AI chat session or fresh context window,
- An autonomous subagent or parallel coding worker,
- A different developer machine, OS, or fresh git clone,
- Another LLM model family or IDE toolchain,

replaying the entire historical conversation, raw test transcripts, or exhaustive repository diffs is impractical, cost-prohibitive, and context-polluting. Under current workflows, this context gap creates severe operational risks:
1. **Architectural Drift**: New sessions inadvertently alter settled design choices or reimplement existing subsystems.
2. **Invariant Amnesia**: Critical safety constraints (such as fail-closed cost policies, offline verification purity, and zero-dependency core) are forgotten or diluted.
3. **Re-Opening Closed Decisions**: Sessions spend tokens and time debating questions already decided in prior specifications.
4. **Frozen Contract Violations**: New code modifies interfaces protected by Upgrade A consistency checks without knowing they are frozen.
5. **Nondeterministic Memory Contamination**: Relying on free-form chat transcripts or ambient developer notes injects conversational ambiguity into formal requirements.
6. **Secret & Privacy Leakage**: Blindly aggregating project context risks ingesting local `.env` secrets, API keys, or machine-specific absolute paths.
7. **Oversized Context Payloads**: Ingesting raw logs, git history, or complete file trees exhausts model token limits and degrades reasoning quality.

Gemstack requires a canonical, deterministic, and auditable mechanism to extract a compact continuation artifact—the **Context Capsule**—derived strictly from authoritative repository state.

---

## 2. Goals & Non-Goals

### Goals
- **Deterministic Continuation Context**: Define a canonical machine-readable artifact (`context-capsule.json`) representing the exact minimal context required for a new agent or developer to continue project work safely.
- **Semantic Constraint Losslessness**: Compress context by stripping historical debate, conversational narrative, and redundant prose while preserving 100% of behavior-affecting constraints, invariants, frozen contracts, acceptance criteria, and active tasks.
- **Strict Derived-Artifact Model**: Enforce that the capsule is mechanically derived from authoritative sources. The capsule NEVER supersedes or replaces `spec.md`, `plan.md`, `tasks.md`, or `closure.json`.
- **Closed Work Summarization**: Condense completed upgrades (Upgrade A, B, C) into compact structural records with authoritative pointers rather than reproducing their exhaustive implementation history.
- **Strict Offline & Zero-Dependency Operation**: Generate and validate capsules using native Node.js standard library built-ins exclusively, requiring zero external npm packages, zero cloud services, and zero network calls.
- **Verification Purity (`VERIFY = VALIDATE`)**: Ensure `gemstack verify` inspects capsule schema, provenance, and freshness in read-only mode, never mutating or regenerating the capsule during verification.
- **Fail-Closed Freshness & Provenance**: Mechanically detect when authoritative sources have drifted, marking stale capsules explicitly and proving the origin of every retained fact.
- **Bounded Size Budget**: Establish deterministic size limits and priority ordering to guarantee compact context payloads without silent truncation of safety invariants.
- **Secret Prohibition**: Enforce non-waivable rejection of credential patterns, API keys, and environment secret values within capsule artifacts.

### Non-Goals
- Gemstack is **NOT** a vector database, embedding store, or semantic search service.
- Gemstack does **NOT** build a general-purpose agent memory server or multi-session chat archive.
- Gemstack does **NOT** perform lossy heuristic AI summarization as its canonical machine representation.
- Gemstack does **NOT** autonomously declare project closure through the capsule.
- Gemstack does **NOT** implement agent swarm orchestration, visual QA, screenshot review, or browser automation under Upgrade D.
- Gemstack does **NOT** replace or duplicate git version control or repository file trees.

---

## 3. Core Architectural Principles & Invariants

```text
================================================================================
                    UPGRADE D CANONICAL SAFETY INVARIANTS
================================================================================
1. context capsule           = derived continuation context
2. context capsule          ≠ canonical project authority
3. less text                ≠ less constraint
4. authoritative artifact   > derived capsule (source always wins)
5. chat transcript          ≠ project authority
6. verification             ≠ capsule regeneration (VERIFY = VALIDATE)
7. closed decision          ≠ open question
8. deferred work            ≠ forgotten scope
9. offline purity           = zero network / zero paid API calls
10. size pressure overflow   = FAIL-CLOSED (no silent invariant drops)
================================================================================
```

### Central Invariant 1: Derived Continuation Context
The Context Capsule is a compiled projection of truth, never the source of truth:
```text
Authoritative Sources (spec.md, plan.md, tasks.md, contracts, closure.json)
                         │
                         ▼ (Deterministic Generation)
                  Context Capsule (context-capsule.json)
                         │
                         ▼ (Continuation Context)
               New AI Session / Developer Workflow
```
If any contradiction exists between `context-capsule.json` and an authoritative artifact, the **authoritative artifact unconditionally prevails**.

### Central Invariant 2: Semantic Constraint Losslessness
Compression means omitting redundant explanation, conversational padding, and transient execution traces. It **never** permits omitting, softening, or generalizing a normative requirement (`MUST`, `MUST NOT`, `REQUIRED`, `FORBIDDEN`).

---

## 4. Bootstrap Architecture Contracts

This specification declares its frozen architectural contracts under the Upgrade A `FrozenContractRegistry`:

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

---

## 5. Canonical Terminology

| Term | Canonical Meaning |
| :--- | :--- |
| **`ContextCapsule`** | The canonical, versioned, machine-readable JSON artifact (`context-capsule.json`) containing the minimal authoritative state needed to continue engineering work. |
| **`ContinuationContext`** | The structured payload consumed by a new agent, model, or human developer to resume a project without conversational history replay. |
| **`AuthoritativeSource`** | A primary, version-controlled project artifact (`spec.md`, `plan.md`, `tasks.md`, `state.json`, `closure.json`) whose contents define normative reality. |
| **`SemanticCompression`** | The deterministic process of eliminating structural redundancy, conversational narrative, and historical churn while retaining 100% of behavioral constraints. |
| **`ProvenanceDigest`** | A deterministic cryptographic record mapping every section and constraint in the capsule to the exact SHA-256 hash of its source artifact. |
| **`SourceSetHash`** | The aggregate SHA-256 digest of all authoritative input artifacts evaluated during capsule generation. |
| **`CapsuleFreshness`** | The Boolean condition indicating that the capsule's recorded `source_set_hash` exactly matches the current live state of authoritative sources. |
| **`SizeBudget`** | A deterministic byte boundary (default target: 32 KB, hard limit: 64 KB) guaranteeing bounded context ingestion without silent constraint omission. |
| **`DerivedNarrative`** | An optional human-readable markdown rendering (`context-capsule.md`) compiled strictly from the canonical JSON artifact. |

---

## 6. Authority Model & Source-of-Truth Hierarchy

Upgrade D establishes a non-circular, strictly ordered hierarchy of project authority:

```text
+-------------------------------------------------------------------------------+
|                            AUTHORITY HIERARCHY                                |
+-------------------------------------------------------------------------------+
| Level 1: Specification (spec.md)              --> Canonical Requirements      |
| Level 2: Technical Plan (plan.md)             --> Architecture & Gate Bindings|
| Level 3: Task Execution List (tasks.md)       --> Traceability & Tasks State  |
| Level 4: Project State (.gemstack/state.json) --> Lifecycle Phase & Hashes    |
| Level 5: Closure Evidence (closure.json)      --> Mechanical Proof (Not Auth) |
| Level 6: Implementation Source Files          --> Runtime Behavior            |
| Level 7: Context Capsule (context-capsule.json)--> DERIVED CONTINUATION ONLY  |
+-------------------------------------------------------------------------------+
```

### Precedence Rule
If a field in `context-capsule.json` asserts that a task is complete, but `tasks.md` indicates it is incomplete, **`tasks.md` governs**.  
If the capsule omits a safety invariant declared in `spec.md`, **`spec.md` governs**.  
Downstream tooling MUST NOT use the capsule to override or amend any Level 1–6 artifact.

---

## 7. Context Capsule Artifact Model

### 7.1 Location and Granularity
- **Active Feature Capsule**: Stored at `specs/<feature>/context-capsule.json`.
- **Project Root Capsule**: When all active specs are shipped, an aggregated root capsule may optionally reside at `.gemstack/context-capsule.json`.
- **Naming Rule**: Exactly one canonical machine artifact per active feature directory: `context-capsule.json`.
- **Human-Readable Companion**: A derived markdown file `specs/<feature>/context-capsule.md` may be generated purely as a read-only convenience for developers. It carries no independent authority.

### 7.2 Manual Mutation Protection
If a user or external script edits `context-capsule.json` directly:
1. The internal content digest will mismatch or the recorded `source_set_hash` will fail reconciliation against source files.
2. `gemstack verify` flags the anomaly as `CONTEXT_CAPSULE_STALE` or `CONTEXT_CAPSULE_INVALID`.
3. The capsule is regenerated exclusively through the explicit generation command.

---

## 8. Canonical Input Sources & Exclusions

### Permitted Authoritative Inputs
The capsule compiler ingests strictly the following artifacts:
1. **Active Spec**: `specs/<feature>/spec.md` (requirements, `gemstack-contracts`, `gemstack-test-matrix`).
2. **Active Plan**: `specs/<feature>/plan.md` (architectural boundaries, `gemstack-test-bindings`, `gemstack-closure-gates`).
3. **Active Tasks**: `specs/<feature>/tasks.md` (task statuses `T001`..`Tn`, validation flags, file targets).
4. **Project Lifecycle State**: `.gemstack/state.json` (current phase, active spec, phase hashes).
5. **Closure Evidence (if present)**: `specs/<feature>/closure.json` (status, verified test counts, gate results).
6. **Cost Ledger (if present)**: `cost-ledger.json` (provider types, cost classifications, currencies).
7. **Shipped Historical Features**: Digest summary of completed features from `.gemstack/state.json` (`last_completed_feature`).

### Strictly Excluded Inputs
The compiler MUST NOT ingest:
- Chat logs, IDE prompts, or conversational transcripts.
- Entire git commit histories, patch logs, or git blame records.
- Raw test runner standard output or verbose TAP traces (closure summary is used instead).
- Full source code trees or large module copies (file paths and interface signatures only).
- Temporary files, build outputs, or `node_modules`.
- Local configuration secrets, `.env` files, or shell credential variables.

---

## 9. Source-of-Truth Matrix

| Concept | Primary Authoritative Source | Secondary Source | Capsule Status |
| :--- | :--- | :--- | :--- |
| **Requirements & Invariants** | `spec.md` | N/A | Derived summary |
| **Architecture & Bindings** | `plan.md` | N/A | Derived summary |
| **Tasks & Completion Status** | `tasks.md` | N/A | Derived array |
| **Frozen Contracts** | `spec.md` / `plan.md` blocks | `.gemstack/state.json` | Derived IDs & hashes |
| **Acceptance Matrix** | `spec.md` (`gemstack-test-matrix`) | N/A | Derived ID list |
| **Closure Status & Evidence** | `closure.json` | N/A | Derived status |
| **Lifecycle Phase & State** | `.gemstack/state.json` | N/A | Derived field |
| **Provider & Cost Policies** | `cost-ledger.json` | `spec.md` | Derived classification |
| **Historical Upgrades** | Shipped spec directories | `.gemstack/state.json` | Compressed reference |

---

## 10. Context Capsule JSON Schema

The canonical artifact `context-capsule.json` conforms to version 1 of the Gemstack Context Capsule Schema:

```json
{
  "$schema": "https://gemstack.dev/schemas/context-capsule-v1.json",
  "schema_version": 1,
  "generated_at": "2026-09-11T18:00:00.000Z",
  "generator": {
    "name": "gemstack",
    "version": "1.2.0"
  },
  "provenance": {
    "source_set_hash": "a1b2c3d4e5f6...",
    "sources": [
      {
        "path": "specs/009-context-capsule/spec.md",
        "hash": "e3b0c44298fc...",
        "role": "SPECIFICATION"
      },
      {
        "path": "specs/009-context-capsule/plan.md",
        "hash": "f2ca1bb6c7e9...",
        "role": "PLAN"
      },
      {
        "path": "specs/009-context-capsule/tasks.md",
        "hash": "38b060a751ac...",
        "role": "TASKS"
      },
      {
        "path": ".gemstack/state.json",
        "hash": "7d9b5e82104f...",
        "role": "LIFECYCLE_STATE"
      }
    ]
  },
  "project": {
    "name": "gemstack-ai",
    "active_feature": "specs/009-context-capsule",
    "current_phase": "specification",
    "lifecycle_status": "SPEC_COMPLETE",
    "next_permitted_phase": "PLAN"
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
    },
    {
      "id": "INV-002",
      "rule": "Compression must preserve 100% of behavior-affecting constraints and frozen contracts",
      "normative": "MUST",
      "source_ref": "spec.md#3"
    },
    {
      "id": "INV-003",
      "rule": "gemstack verify must never regenerate or mutate context-capsule.json",
      "normative": "MUST_NOT",
      "source_ref": "spec.md#3"
    }
  ],
  "frozen_contracts": [
    {
      "id": "zero-dependency-core",
      "type": "BOOLEAN_INVARIANT",
      "value": true
    },
    {
      "id": "capsule-is-derived-not-authority",
      "type": "BOOLEAN_INVARIANT",
      "value": true
    }
  ],
  "acceptance_matrix": {
    "total_required": 20,
    "signature": "b4c8a2e190df...",
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
    "tests/context-capsule.test.js"
  ],
  "deferred_items": [
    "Autonomous cross-repo capsule federations (out of scope)",
    "LLM narrative fine-tuning (non-authoritative)"
  ],
  "unresolved_blockers": []
}
```

---

## 11. Required Semantic Content

To guarantee that a downstream agent receives complete continuation guidance, the capsule MUST contain:
1. **Provenance & Source Digest**: Full array of source artifact paths and SHA-256 hashes.
2. **Project Lifecycle Snapshot**: Name, active spec, current phase, lifecycle status, next permitted phase.
3. **Closed Upgrades Summary**: 1-to-2 line summaries of prior closed features and their permanent invariants.
4. **Canonical Invariants**: All `MUST` and `MUST NOT` constraints with source cross-references.
5. **Frozen Contracts**: Canonical contract IDs, types, and values from active specs.
6. **Acceptance Matrix Summary**: Total required tests, acceptance signature, and canonical ID list.
7. **Task Inventory State**: Task counts, completion numbers, active task IDs.
8. **Relevant File Surface**: Explicit list of implementation and test files mapped in the plan.
9. **Explicit Deferred Scope**: What is deliberately delayed to prevent accidental re-implementation.
10. **Active Blockers Only**: Genuinely unresolved architectural questions or blocking issues (empty if none).

---

## 12. Semantic Compression vs Textual Losslessness

Context compression in Gemstack operates on the principle of **Semantic Constraint Losslessness**:
- **Discarded Without Loss**:
  - Conversational preamble, rhetorical explanations, and tutorials.
  - Multi-paragraph problem background already resolved in prior features.
  - Historical alternative approaches discarded during planning.
  - Intermediate test runner debug traces and raw stdout dumps.
- **Preserved with Mathematical Exactness**:
  - Exact canonical identifiers (`TEST-CONTEXT-A01`, `T001`, `zero-dependency-core`).
  - Strict normative rules containing `MUST`, `MUST NOT`, `REQUIRED`, `FORBIDDEN`.
  - Machine-readable enums, boolean invariants, and cryptographic hashes.
  - Exact file paths for implementation and test surfaces.

---

## 13. Closed Work Summarization vs Active Work Context

| Dimension | Active Feature (`specs/current/`) | Shipped / Closed Features |
| :--- | :--- | :--- |
| **Detail Level** | Granular tasks, exact canonical IDs, active files | High-level summary, key guarantees, status token |
| **Tasks State** | Itemized `T001`..`Tn` status and dependencies | Total task count only (e.g. `20/20 COMPLETE`) |
| **Acceptance Matrix**| Complete canonical test list and pass criteria | Count of passed tests and acceptance signature |
| **Invariants** | Full verbatim normative statements | Persistent architectural rules inherited by repo |
| **Primary Goal** | Direct execution and validation | Guard against architectural regressions |

---

## 14. Explicit Deferred Items vs Forgotten Scope

A recurring failure mode in AI-assisted coding is treating a deliberate deferral as forgotten work. The Context Capsule preserves an explicit `deferred_items` array:
- Entries are categorized as:
  1. `UPGRADE_DEFERRED`: Explicitly allocated to a future phase (e.g. Upgrade E).
  2. `NON_GOAL`: Explicitly out of scope for the framework.
- Any downstream agent consuming the capsule is explicitly forbidden from generating implementation tasks for items listed in `deferred_items`.

---

## 15. Provenance & Source Fingerprinting Model

To prove provenance, every Context Capsule embeds a `provenance` block:
```json
{
  "source_set_hash": "<canonical SHA-256>",
  "sources": [
    { "path": "specs/<feat>/spec.md", "hash": "<sha256>", "role": "SPECIFICATION" },
    { "path": "specs/<feat>/plan.md", "hash": "<sha256>", "role": "PLAN" },
    { "path": "specs/<feat>/tasks.md", "hash": "<sha256>", "role": "TASKS" },
    { "path": ".gemstack/state.json", "hash": "<sha256>", "role": "LIFECYCLE_STATE" }
  ]
}
```

### Provenance Verification Rule
`source_set_hash` is computed by hashing the UTF-16 code-unit sorted JSON serialization of all normalized `{ path, hash }` pairs.  
During verification, `gemstack verify` re-computes current file hashes on disk. If any current hash differs from the recorded source hash, the capsule is immediately declared **STALE**.

---

## 16. Deterministic Hashing & Serialization

To ensure that two runs over identical repository states produce byte-for-byte identical capsules:
1. **Key Sorting**: All JSON object keys are sorted recursively by UTF-16 code units (`(a < b ? -1 : (a > b ? 1 : 0))`).
2. **Array Normalization**: Array items with natural keys (`sources`, `canonical_invariants`, `frozen_contracts`, `canonical_ids`) are sorted deterministically by their primary identifier.
3. **Line Endings**: Formatted with standard POSIX newline (`\n`) indentation of 2 spaces.
4. **Volatile Field Exclusion**: Generation timestamps (`generated_at`) are excluded from semantic hash calculations.
5. **Path Normalization**: All paths are POSIX-normalized repository-relative strings without drive letters (`C:`) or backslashes (`\\`).

---

## 17. Freshness Lifecycle & Invalidation Rules

```text
[ Authoritative Sources Mutated ] ────► [ Source Set Hash Mismatch ]
                                                  │
                                                  ▼
                                      [ Capsule Becomes STALE ]
                                                  │
                                                  ▼
                                      [ Verification Emits Error ]
                                                  │
                                                  ▼
                                      [ Explicit "gemstack context generate" Required ]
```

A capsule is invalidated and becomes `STALE` if:
1. `spec.md` is edited or amended.
2. `plan.md` architectural bindings change.
3. `tasks.md` task list or completion checkboxes are updated.
4. `.gemstack/state.json` lifecycle phase or active spec transitions.
5. `closure.json` is regenerated or collected.

---

## 18. Capsule Validity States

| State | Definition | Verification Behavior |
| :--- | :--- | :--- |
| **`VALID`** | Schema matches, all source hashes match disk, size within budget, zero secrets. | Passes with exit code 0. |
| **`STALE`** | One or more authoritative source hashes on disk differ from `provenance.sources`. | Emits `CONTEXT_CAPSULE_STALE` blocker. |
| **`INVALID`** | JSON malformed, schema version unsupported, or required invariant missing. | Emits `CONTEXT_CAPSULE_INVALID` blocker. |
| **`MISSING`** | Capsule artifact not found in an active feature requiring continuation context. | Emits `CONTEXT_CAPSULE_MISSING` (warning in dev, blocker at ship). |

---

## 19. Size Budget, Thresholds & Overflow Behavior

### Size Parameters
- **Target Budget**: `≤ 32,768 bytes` (32 KB) serialized JSON.
- **Hard Upper Limit**: `65,536 bytes` (64 KB).

### Deterministic Priority Model Under Pressure
If content exceeds the target budget, non-normative sections are condensed according to strict priority order:
1. **Priority 1 (IMMUTABLE - NEVER CONDENSED)**:
   - Authority model & source references.
   - Core safety invariants and `MUST` / `MUST NOT` constraints.
   - Frozen architecture contracts.
   - Current lifecycle phase and status.
2. **Priority 2 (STRUCTURAL SUMMARY)**:
   - Acceptance IDs (condense descriptions, keep exact IDs).
   - Task inventory (keep counts and active IDs, omit completed descriptions).
   - Implementation file list.
3. **Priority 3 (TRUNCATION PERMITTED)**:
   - Historical feature narratives (reduce to ID and status token).
   - Optional human notes.

### Overflow Fail-Closed Rule
If Priority 1 and Priority 2 contents alone exceed the hard limit of 64 KB, the generator **MUST NOT** drop constraints. It halts with error:
`CONTEXT_CAPSULE_TOO_LARGE: Critical invariants exceed capsule size budget (65536 bytes).`

---

## 20. Secrets & Privacy Protection Boundary

Context capsules must never leak credentials:
- **Forbidden Properties**: Same strict list as Upgrade C: `apiKey`, `api_key`, `token`, `accessToken`, `access_token`, `secret`, `clientSecret`, `password`, `credentials`.
- **Forbidden Patterns**: Regex detection for API keys (`sk-...`, `ghp_...`, `AIza...`, private keys).
- **Environment Exclusions**: Never inspect or serialize `.env` file contents into the capsule.
- **Fail-Closed Rejection**: Detecting any secret pattern emits non-waivable blocker `CONTEXT_CAPSULE_SECRET_DETECTED`.

---

## 21. Generation Semantics

### Explicit Generation Operation
Capsules are generated exclusively via an explicit command (e.g. `gemstack context generate`):
1. Loads active `spec.md`, `plan.md`, `tasks.md`, and `.gemstack/state.json`.
2. Evaluates and extracts structured invariants, contracts, acceptance IDs, and tasks.
3. Computes exact SHA-256 hashes of all ingested files.
4. Constructs canonical JSON object and validates against schema.
5. Scans generated object for forbidden secret patterns.
6. Enforces size budget limits.
7. Writes `context-capsule.json` atomically.

### Non-Interference
The generation command:
- Does NOT mutate `spec.md`, `plan.md`, or `tasks.md`.
- Does NOT change project lifecycle phases.
- Does NOT execute test suites or make network calls.

---

## 22. Verification Semantics (`VERIFY = VALIDATE`)

In strict accordance with Upgrade B and C invariants:
- `gemstack verify` evaluates existing `context-capsule.json` in **READ-ONLY** mode.
- `gemstack verify` **NEVER**:
  1. Regenerates `context-capsule.json`.
  2. Updates source hashes to mask file drift.
  3. Executes remote AI calls to summarize missing text.
  4. Writes or mutates any file on disk.

---

## 23. Consumer Trust & Continuation Workflow

Downstream AI agents and tools must adhere to the following consumer protocol:

```text
[ Start Continuation Session ]
             │
             ▼
1. Does context-capsule.json exist and pass verify?
    ├─► (NO / STALE) ──► DO NOT TRUST CAPSULE.
    │                    Read authoritative spec.md, plan.md, tasks.md directly.
    │
    └─► (YES: VALID) ──► Load context-capsule.json into memory.
                         │
                         ▼
2. Check "current_phase" and "next_permitted_phase".
   Adhere strictly to permitted actions (e.g. do not implement if in PLAN phase).
                         │
                         ▼
3. Enforce all "canonical_invariants" and "frozen_contracts".
   Never propose designs contradicting listed invariants.
                         │
                         ▼
4. If deep implementation details are needed, consult "relevant_files"
   or reference "source_ref" pointers directly.
```

---

## 24. LLM Involvement Policy & Offline Guarantees

- **Canonical Machine Artifact**: `context-capsule.json` is generated **100% algorithmically** via deterministic parsing of structured Gemstack markdown blocks and JSON state files. It requires **zero LLM invocation**.
- **Offline Guarantee**: Generation and verification execute 100% offline without internet access, external APIs, or local model daemons.
- **Optional Narrative Helper**: If an optional human-readable prose summary is requested via an AI adapter:
  - It MUST pass through Upgrade C `ProviderCapabilityGate` and `BillableActionGate`.
  - It is saved strictly as an advisory companion (`context-capsule.md`).
  - It carries zero verification authority.

---

## 25. Planned CLI Surface (Specification Only)

*Note: This section defines the target interface for future planning and implementation. No CLI code is created during this SPEC phase.*

```text
gemstack context generate [--target <dir>] [--feature <path>]
  --> Compiles authoritative sources into context-capsule.json atomically.

gemstack context show [--target <dir>] [--json]
  --> Displays structured continuation summary or raw JSON.

gemstack context verify [--target <dir>]
  --> Performs read-only validation of capsule schema, provenance, and freshness.
```

Integration into existing commands:
- `gemstack verify`: Automatically audits `context-capsule.json` freshness and integrity in Stage 5/6.

---

## 26. Legacy Compatibility & Progressive Adoption

- **Legacy Mode**: Projects lacking `context-capsule.json` log an informational notice:  
  `[INFO] [LEGACY] No se detectó context-capsule.json (Modo Legacy Context-Free).`
- **Zero Blocker Guarantee**: An unconfigured or legacy repository without capsules exits `gemstack verify` with code 0 and 0 errors.
- **Feature Opt-In**: A feature explicitly declaring Upgrade D contracts enforces capsule freshness at closure verification.

---

## 27. Relationship with Prior Upgrades

- **Upgrade A (Architecture Consistency Engine)**:
  - Upgrade D uses `src/lib/hasher.js` for deterministic SHA-256 computation.
  - Upgrade D findings use `src/lib/findings.js` for 64-char lowercase fingerprints.
  - Frozen contracts from Upgrade A remain byte-for-byte untouched and are summarized in the capsule.
- **Upgrade B (Mechanical Test Matrix & Closure Evidence)**:
  - Upgrade D preserves `VERIFY = VALIDATE`.
  - Capsule freshness is checked during verification, but `closure.json` remains the sole evidence artifact for test closure.
  - `context-capsule.json` is added to `resolveRelevantFiles` in closure context.
- **Upgrade C (Cost & Provider Safety Gates)**:
  - Capsule generation is 100% offline and deterministic.
  - If optional future AI summarization is invoked, it is strictly governed by `BillableActionGate` and `ProviderCapabilityGate`.
  - Zero commercial provider calls permitted during verification or canonical generation.

---

## 28. Canonical Findings Taxonomy (Upgrade D)

All findings follow the canonical uppercase format with 64-character lowercase SHA-256 fingerprints:

| Finding Code | Severity | Description | Waivable via Exception? |
| :--- | :--- | :--- | :--- |
| **`CONTEXT_CAPSULE_MISSING`** | WARNING / BLOCKER | Capsule absent when required for closure. | **NO** |
| **`CONTEXT_CAPSULE_INVALID`** | BLOCKER | Schema validation or JSON parsing failed. | **NO** |
| **`CONTEXT_CAPSULE_STALE`** | BLOCKER | Authoritative sources modified since generation. | **NO** |
| **`CONTEXT_CAPSULE_SOURCE_MISMATCH`** | BLOCKER | Ingested file hash does not match disk hash. | **NO** |
| **`CONTEXT_CAPSULE_SECRET_DETECTED`** | BLOCKER | Forbidden credential key or secret pattern found. | **NO** |
| **`CONTEXT_CAPSULE_INVARIANT_DROPPED`** | BLOCKER | Normative MUST/MUST NOT constraint missing. | **NO** |
| **`CONTEXT_CAPSULE_TOO_LARGE`** | BLOCKER | Content exceeds hard size limit (64 KB). | **NO** |
| **`CONTEXT_CAPSULE_AUTHORITY_CONFLICT`** | BLOCKER | Capsule asserts state conflicting with source. | **NO** |

---

## 29. Accepted Exceptions Policy

Context capsules represent compiled truth. Suppressing a stale, conflicting, or secret-bearing capsule with an exception would create false architectural certainty.  
Therefore:
- **Zero Waivable Blocker Policy**: Findings indicating authority conflicts, secret leakage, or stale sources are **STRICTLY NON-WAIVABLE**.
- The only permissible remediation for a `STALE` or `INVALID` capsule is explicit regeneration from authoritative sources.

---

## 30. Comprehensive Threat Model & Adversarial Vectors

| Threat Vector | Vulnerability Description | Mitigation Architecture |
| :--- | :--- | :--- |
| **1. Phantom Task Closure** | Capsule claims a task is complete that `tasks.md` shows unchecked. | Consumer trust rule: Authoritative artifact unconditionally wins; verification detects state mismatch. |
| **2. Stale Context Drift** | Agent resumes work using capsule generated before major spec refactor. | Provenance digest check compares live SHA-256 hashes on disk; flags `CONTEXT_CAPSULE_STALE`. |
| **3. Manual Capsule Spoofing** | Developer manually edits capsule to bypass a frozen contract. | Verification compares capsule contracts against source contract blocks; emits `CONTEXT_CAPSULE_AUTHORITY_CONFLICT`. |
| **4. Silent Invariant Truncation** | Generator drops safety rules to satisfy a byte budget. | Hard failure `CONTEXT_CAPSULE_TOO_LARGE` triggered if Priority 1 constraints exceed budget. |
| **5. Ambient Secret Exfiltration** | Generator scans `.env` and embeds active tokens into capsule. | Strict input whitelist excludes `.env`; regex scanner rejects secret fields fail-closed. |
| **6. Verification Side-Effect** | Verify command silently rewrites capsule during CI check. | Verify runs pure read-only checks; zero file writes or mutations permitted. |
| **7. Conversational Contamination** | Agent prompts or chat transcripts ingested as formal authority. | Strict exclusion of chat logs; only structured markdown and JSON state files ingested. |
| **8. Machine-Specific Coupling** | Capsule embeds local Windows paths (`C:\\CODES\\...`) breaking Linux CI. | Path normalizer converts all references to POSIX repository-relative paths. |
| **9. Closed Work Amnesia** | Agent reopens closed Upgrade A architecture discussion. | Closed feature records explicitly enumerate frozen status and permanent invariants. |
| **10. Deferred Work Misinterpretation**| Agent assumes deferred item is a bug or missing requirement. | `deferred_items` explicitly distinguishes deliberate delay from active tasks. |

---

## 31. Canonical Acceptance Matrix (TEST-CONTEXT-A01 through TEST-CONTEXT-H01)

Upgrade D establishes 20 canonical acceptance test requirements:

```gemstack-test-matrix
[
  {
    "id": "TEST-CONTEXT-A01",
    "category": "DETERMINISM",
    "layer": "UNIT",
    "description": "Generates byte-for-byte identical context-capsule.json across repeated runs on identical repository state.",
    "pass_criteria": "SHA-256 content hashes of two independent generations match 100%.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-A02",
    "category": "DETERMINISM",
    "layer": "UNIT",
    "description": "Enforces strict UTF-16 code-unit key ordering across all JSON objects in generated capsule.",
    "pass_criteria": "Serialized keys match code-unit sorted order deterministically.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-A03",
    "category": "DETERMINISM",
    "layer": "UNIT",
    "description": "Excludes volatile execution timestamps from semantic content hash computation.",
    "pass_criteria": "Modifying generated_at does not alter semantic provenance hash.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-A04",
    "category": "DETERMINISM",
    "layer": "UNIT",
    "description": "Normalizes all file paths to POSIX repository-relative strings without drive letters.",
    "pass_criteria": "No backslashes or absolute drive prefixes present in path properties.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-B01",
    "category": "AUTHORITY",
    "layer": "UNIT",
    "description": "Rejects capsule assertion when it conflicts with authoritative spec.md or plan.md content.",
    "pass_criteria": "Emits CONTEXT_CAPSULE_AUTHORITY_CONFLICT when capsule diverges from source.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-B02",
    "category": "AUTHORITY",
    "layer": "UNIT",
    "description": "Enforces that authoritative artifacts unconditionally override capsule claims in consumer resolver.",
    "pass_criteria": "Resolver returns source artifact value when conflict is detected.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-B03",
    "category": "AUTHORITY",
    "layer": "UNIT",
    "description": "Rejects manually edited capsule whose content hash does not reconcile with source digest.",
    "pass_criteria": "Emits CONTEXT_CAPSULE_STALE upon manual tampering.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-B04",
    "category": "AUTHORITY",
    "layer": "UNIT",
    "description": "Proves chat transcripts and conversational logs are never ingested into capsule sources.",
    "pass_criteria": "Source list contains exclusively structured markdown and JSON state files.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-C01",
    "category": "FRESHNESS",
    "layer": "INTEGRATION",
    "description": "Detects modification of spec.md and marks capsule STALE immediately.",
    "pass_criteria": "Verification fails with CONTEXT_CAPSULE_STALE after touching spec.md.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-C02",
    "category": "FRESHNESS",
    "layer": "INTEGRATION",
    "description": "Detects task status mutation in tasks.md and invalidates capsule freshness.",
    "pass_criteria": "Verification fails with CONTEXT_CAPSULE_STALE after checking a task box.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-C03",
    "category": "FRESHNESS",
    "layer": "UNIT",
    "description": "Preserves VALID status when all authoritative sources match recorded source_set_hash.",
    "pass_criteria": "Verification passes with status VALID when files are untouched.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-D01",
    "category": "CONSTRAINTS",
    "layer": "UNIT",
    "description": "Preserves 100% of MUST and MUST NOT normative constraints from spec.md in canonical_invariants.",
    "pass_criteria": "All normative statements from spec.md exist in capsule without omission.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-D02",
    "category": "CONSTRAINTS",
    "layer": "UNIT",
    "description": "Preserves frozen contracts and closure acceptance IDs across context compression.",
    "pass_criteria": "Exact contract IDs and acceptance signature match source blocks 100%.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-E01",
    "category": "SECURITY",
    "layer": "UNIT",
    "description": "Rejects capsule generation if forbidden credential property is detected.",
    "pass_criteria": "Emits CONTEXT_CAPSULE_SECRET_DETECTED and halts generation fail-closed.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-E02",
    "category": "SECURITY",
    "layer": "UNIT",
    "description": "Rejects capsule containing API key value patterns (sk-..., ghp_..., Bearer tokens).",
    "pass_criteria": "Emits CONTEXT_CAPSULE_SECRET_DETECTED on synthetic token values.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-E03",
    "category": "SECURITY",
    "layer": "UNIT",
    "description": "Proves local .env files and process environment secrets are excluded from capsule inputs.",
    "pass_criteria": "Capsule contains zero references or values from .env files.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-F01",
    "category": "VERIFICATION_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves gemstack verify evaluates context capsule in read-only mode with zero file mutations.",
    "pass_criteria": "File hash tree before and after verify matches 100% (0 bytes modified).",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-F02",
    "category": "VERIFICATION_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves context capsule verification executes completely offline with zero network requests.",
    "pass_criteria": "Verification passes exit 0 with all network sockets mocked to throw.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-G01",
    "category": "SIZE_SAFETY",
    "layer": "UNIT",
    "description": "Fails closed with CONTEXT_CAPSULE_TOO_LARGE if critical invariants exceed hard budget.",
    "pass_criteria": "Halts with explicit error rather than silently omitting safety rules.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CONTEXT-H01",
    "category": "LEGACY",
    "layer": "UNIT",
    "description": "Preserves backward compatibility for legacy projects lacking context capsules.",
    "pass_criteria": "Verify passes with exit code 0 and informational legacy notice.",
    "gate": "REQUIRED"
  }
]
```

---

## 32. Future Test Strategy (Design Only)

*Note: Tests are NOT implemented during this specification phase. This strategy defines the mechanical requirements for future implementation.*

1. **Determinism Suite (`tests/context-determinism.test.js`)**:
   - Executes generation twice over identical mock repositories; verifies SHA-256 match.
   - Tests key sorting, code-unit ordering, and path normalization across Windows/Linux.
2. **Authority & Provenance Suite (`tests/context-authority.test.js`)**:
   - Injects falsified task completions into capsule; asserts resolver rejects them in favor of `tasks.md`.
   - Tests source hash verification and tampering detection.
3. **Freshness & Mutation Suite (`tests/context-freshness.test.js`)**:
   - Modifies `spec.md`, `plan.md`, or `tasks.md`; asserts verify transitions capsule to `STALE`.
4. **Constraint Losslessness Suite (`tests/context-constraints.test.js`)**:
   - Asserts 100% extraction of `MUST` and `MUST NOT` statements into `canonical_invariants`.
   - Verifies frozen contracts and test matrix signatures are fully preserved.
5. **Security & Secrets Suite (`tests/context-secrets.test.js`)**:
   - Injects dummy API keys and `.env` variables; asserts fail-closed rejection.
6. **Verification Purity Suite (`tests/context-purity.test.js`)**:
   - Intercepts network sockets during verify; proves zero network traffic and zero file mutations.

---

## 33. Migration Considerations

- **No Breaking Changes**: Existing Gemstack projects initialized under v1.0, v1.1, or v1.2 continue without modification.
- **Progressive Upgrade**: When a project initiates Upgrade D, `gemstack context generate` creates `context-capsule.json` in the active feature directory.
- **Sidecar Compatibility**: Capsule metadata does not interfere with Upgrade A feature sidecars (`.gemstack/state.json`).

---

## 34. Explicit Deferred Items

The following concepts are explicitly deferred and out of scope for Upgrade D:
1. **Multi-Repository Federation**: Cross-repo capsule aggregation (strictly reserved for future ecosystem upgrades).
2. **Vector Database / Embedding Storage**: RAG platforms and semantic vector stores (non-goal).
3. **Autonomous Agent Swarms**: Multi-agent orchestration, swarm coordinators, and subagent work queues (non-goal).
4. **Visual QA / Browser Capture**: Automated screenshot diffing or browser automation (non-goal).
5. **Package Version Bump / Release**: Version bumping and npm publishing (handled strictly post-closure).

---

## 35. Open Questions

**NONE.**  
Repository inspection and architectural invariants provide unambiguous answers for all design choices. The Context Capsule is strictly derived, fully deterministic, offline, constraint-lossless, and fail-closed.
