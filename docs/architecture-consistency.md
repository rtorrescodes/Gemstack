# Architecture Consistency & Phase Freezing

Gemstack includes a native, deterministic **Architecture Consistency Engine** and **Phase Freezing** protocol. It prevents AI agents from silently introducing contradictions, architectural drift, or unauthorized mutations across the Spec-Driven Development lifecycle.

---

## 1. The Architecture Consistency Problem

In complex AI coding projects, language models often agree to constraints in a specification (such as "zero external dependencies" or "single tenant isolation"), but later quietly contradict them in implementation or tasks (e.g. installing unauthorized packages). 

Gemstack solves this mechanically at the framework layer:
1. Architectural decisions are declared as formal, machine-verifiable **contracts**.
2. Upstream phases (`SPEC`, `PLAN`, `TASKS`) are cryptographically **frozen**.
3. Downstream phases inherit contracts and are mechanically compared for contradictions.
4. Any contradiction or mutation immediately halts execution as a deterministic blocker.

---

## 2. Canonical Contract Block Format

Contracts are declared inside phase markdown files (`spec.md`, `plan.md`, `tasks.md`) within a column-0 fenced code block:

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "database-engine",
    "type": "ENUM_SET",
    "values": ["sqlite", "postgres"]
  },
  {
    "id": "external-sync",
    "type": "BOUNDARY",
    "value": "FORBIDDEN"
  }
]
```

### Block Parsing Rules
- **Exactly One Block**: Each phase document may contain at most one `gemstack-contracts` block. Multiple blocks trigger a `CONTRACT_PARSE_ERROR`.
- **Legacy Mode**: Phase documents with 0 contract blocks operate in **LEGACY** mode without errors or blocking.
- **Strict Encoding**: UTF-8 without BOM is required; CRLF and LF line endings are canonically normalized to LF.

---

## 3. The Six Canonical Contract Types

Gemstack enforces six deterministic contract types:

| Contract Type | Value Shape | Description / Evaluation |
|---|---|---|
| `ENUM_SET` | `values: string[]` | Closed set of allowed identifiers. Order-insensitive. Downstream cannot add unapproved values. |
| `IDENTITY_TUPLE` | `tuple: string[]` | Immutable composite tuple. Order-insensitive, duplicate-sensitive, exact-member matching. |
| `PROVENANCE_RULE` | `source: string, rule: string` | Origin and lineage constraints. Downstream cannot omit or alter provenance. |
| `BOOLEAN_INVARIANT` | `value: boolean` | Strict binary invariant (e.g. `true` for zero-dependency). Downstream contradiction is blocked. |
| `BOUNDARY` | `value: "FORBIDDEN" | "REQUIRED"` | Hard system boundary. Only `FORBIDDEN` and `REQUIRED` are valid. |
| `ROADMAP_LIMIT` | `value: string | number` | Milestone or scope bound (e.g. max task count). Downstream cannot expand beyond the limit. |

---

## 4. Cross-Phase Contract Inheritance

Contracts follow a strict unidirectional inheritance hierarchy:

```
SPEC (declares base contracts)
  │
  ▼
PLAN (inherits SPEC contracts + may add technical contracts)
  │
  ▼
TASKS (inherits consolidated SPEC + PLAN contracts)
```

- **Inheritance**: Downstream phases automatically inherit all upstream contracts. An inherited contract does not need to be re-declared downstream unless adding specific attributes.
- **Equivalence**: Redeclaring an inherited contract with identical semantics passes validation.
- **Contradiction**: Redeclaring an inherited contract with contradictory values triggers `FROZEN_CONTRACT_VIOLATION` and blocks execution.
- **Additive Extension**: Downstream phases may introduce new contract IDs as long as they do not conflict with existing contracts.

---

## 5. Phase Freezing & Mutation Detection

When a phase is completed and approved by the human supervisor, its artifact is cryptographically sealed:
- **Canonical Hash**: Normalized SHA-256 (64 lowercase hexadecimal characters).
- **CRLF Normalization**: All line breaks are normalized to LF (`\n`) prior to hashing, ensuring identical digests across Windows, macOS, and Linux.
- **UTF-8 BOM Forbidden**: Leading Byte Order Marks trigger `CONTRACT_PARSE_ERROR`.
- **Mutation Detection**: If an upstream artifact (`spec.md` or `plan.md`) is modified after approval, `gemstack verify` detects the hash mismatch and halts with `FROZEN_ARTIFACT_CHANGED`.

> **VERIFY != FREEZE**: `gemstack verify`, `gemstack doctor`, and agent reviews are strictly read-only and **never** overwrite or mutate accepted phase hashes.

---

## 6. Findings & Anti-Loop Lifecycle

When a consistency rule is violated, Gemstack generates a structured **Finding**:
- **Canonical Fingerprint**: Full 64-character lowercase SHA-256 digest computed over `{ code, contractId, phase, location }`.
- **Display Token**: First 12 characters of the fingerprint for human-readable CLI display.
- **Finding Lifecycle**:
  - `OPEN`: Active blocker preventing shipping.
  - `RESOLVED`: Violation was corrected in artifacts.
  - `ACCEPTED_EXCEPTION`: Formally approved human exception.
  - `SUPERSEDED`: Replaced by a subsequent finding.
- **Anti-Loop Protection**: If a previously `RESOLVED` defect re-appears in subsequent runs, it is immediately re-opened to `OPEN`.

---

## 7. Accepted Exceptions & Context Hash

When an architectural deviation is intentionally approved by a human supervisor, it is recorded in the feature sidecar with a cryptographic `contextHash`:

`contextHash = SHA-256(upstreamAcceptedHash + currentComparedHash + normalizedContract)`

If the upstream phase artifact, compared phase artifact, or contract representation changes, the suppression is automatically invalidated and the violation re-opens as a blocking finding.

---

## 8. State & Persistence Boundary

Gemstack strictly separates operational state from historical audit trails:
- **`.gemstack/state.json`**: Lightweight operational state only (active feature, completed phases, guard mode, verification summary). Historical finding arrays are forbidden in this file.
- **`specs/<feature>/.gemstack.json`**: Per-feature sidecar hosting the complete audit log, phase hash history, finding fingerprints, and accepted exceptions.
- **Atomic Operations**: All state writes use temporary file creation and atomic file renaming to prevent corruption during unexpected shutdowns or process kills.

---

## 9. Verification Integration (`gemstack verify`)

Architectural consistency is embedded as **Step 4/6** in the unified `gemstack verify` command:

```text
[INFO] --- 4/6 Verificación de Consistencia de Arquitectura y Hashes de Fase ---
[OK] [STRUCTURED] 5 contrato(s) base declarados en spec.md.
[OK] Hash congelado de spec.md verificado: f5d423eaf508...
[OK] Hash congelado de plan.md verificado: 1ce0e5886342...
[OK] Hash congelado de tasks.md verificado: dfad2484ad11...
[OK] Verificación de consistencia arquitectónica aprobada (0 bloqueadores).
```

If any contracts contradict, artifacts mutate, or unapproved blockers exist, `gemstack verify` exits with code 1, halting CI/CD pipelines.

---

## 10. Mechanical Test Matrix & Closure Evidence (Upgrade B)

Beyond static contract consistency across phase files, Gemstack Upgrade B validates execution evidence against declared requirements:

- **`acceptanceSignature`**: Full semantic record SHA-256 digest of the canonical test matrix in `spec.md`.
- **Authoritative Execution**: Native test runners (such as `node:test`) execute bound tests without shell intermediaries. TAP output is parsed to extract executed canonical test tokens.
- **Reconciliation & Set Equality**: Proves that all declared required canonical tests were physically executed and passed (`PASS + FAIL + SKIP + TODO + CANCELLED == TOTAL_PHYSICAL`). Detects `PHANTOM_TEST` (claimed but unexecuted) and `ORPHAN_TEST` (executed with unregistered canonical ID).
- **`closureContextHash`**: Deterministic SHA-256 fingerprint binding repository state, phase hashes, test files, implementation files, and gate definitions. Prevents whole-repository scanning while detecting stale evidence.
- **Progressive Legacy Compatibility**: Specifications lacking a test matrix operate seamlessly in legacy mode with an informational notice, preserving 100% backward compatibility.
