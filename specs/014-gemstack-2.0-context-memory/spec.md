# Specification: Gemstack 2.0 Sprint D — Efficient Context & Persistent Memory

**Feature ID:** `014-gemstack-2.0-context-memory`  
**Phase:** `spec`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Context & Objectives

As agents and humans collaborate across long-running projects, context management and memory persistence become critical failure points:
1. **Context Fatigue & Noise**: Agents accumulate thousands of tokens of ephemeral chatter, duplicate error logs, and redundant prompt iterations, degrading reasoning accuracy.
2. **Dependency Blindness**: Unused or missing dependencies slip into `package.json`, and circular imports create subtle runtime bugs that standard linters miss.
3. **Memory Drift & Forgotten Commits**: Features get committed to git without being recorded in `handoff.md`, causing context loss across session boundaries.

Sprint D resolves these challenges by introducing:
- **Context Fatigue Detector & Noise Pruner**: Alerts when context exceeds thresholds or exhibits high redundancy, with deterministic noise pruning.
- **Offline Dependency Auditor in `gemstack doctor`**: Detects orphan dependencies, undeclared imports, and circular dependencies without external network calls.
- **Memory Cross-Verification**: Reconciles recent git commits with `handoff.md` before session handoff or verify closure.
- **Compressed Context Capsule Guard**: Enforces strict exclusion of ephemeral conversation chatter from capsules.

---

## 2. Architecture Contracts

```gemstack-contracts
[
  {
    "id": "context-fatigue-guard",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Monitors accumulated tokens and flags warnings when redundancy ratio or token thresholds are exceeded."
  },
  {
    "id": "offline-dependency-audit",
    "type": "ENUM_SET",
    "values": [
      "orphan-detector",
      "undeclared-detector",
      "circular-cycle-detector",
      "offline-purity"
    ],
    "description": "Capabilities of the offline dependency auditor in gemstack doctor."
  },
  {
    "id": "memory-git-cross-audit",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Cross-verifies recent git commit activity against handoff.md before session close."
  },
  {
    "id": "capsule-noise-elimination",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Ensures context capsules strictly exclude chat history and ephemeral noise."
  }
]
```

---

## 3. Mechanical Acceptance Matrix

```gemstack-test-matrix
[
  {
    "id": "TEST-FATIGUE-A01",
    "category": "CONTEXT",
    "layer": "UNIT",
    "description": "Detects context fatigue when accumulated token count exceeds configurable threshold",
    "pass_criteria": "detectContextFatigue returns fatigue=true and alert message when tokens > limit",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-FATIGUE-A02",
    "category": "CONTEXT",
    "layer": "UNIT",
    "description": "Identifies repetitive context fragments and computes redundancy ratio accurately",
    "pass_criteria": "computeRedundancyRatio correctly calculates duplicate token ratio",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-FATIGUE-A03",
    "category": "CONTEXT",
    "layer": "UNIT",
    "description": "Deterministically prunes noise and duplicate chatter while preserving contracts and state",
    "pass_criteria": "pruneContextNoise reduces size while preserving all architectural contracts and state items",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DEP-B01",
    "category": "DEPENDENCY",
    "layer": "UNIT",
    "description": "Detects orphan dependencies declared in package.json but never imported in code",
    "pass_criteria": "auditDependencies reports orphan array containing unused dependencies",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DEP-B02",
    "category": "DEPENDENCY",
    "layer": "UNIT",
    "description": "Detects undeclared module dependencies imported in code but missing from package.json",
    "pass_criteria": "auditDependencies reports undeclared array containing missing packages",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DEP-B03",
    "category": "DEPENDENCY",
    "layer": "UNIT",
    "description": "Detects circular import cycles among local project modules",
    "pass_criteria": "auditDependencies flags circularCycles with the exact cycle path",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-DEP-B04",
    "category": "DEPENDENCY",
    "layer": "UNIT",
    "description": "Dependency auditor runs completely offline without spawning npm or network requests",
    "pass_criteria": "Runs in <100ms with zero network handles or subprocess calls",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MEM-C01",
    "category": "MEMORY",
    "layer": "UNIT",
    "description": "Detects discrepancies between recent git commit messages and handoff.md records",
    "pass_criteria": "crossAuditMemoryWithGit flags unrecorded_commits when commits are missing from handoff",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MEM-C02",
    "category": "MEMORY",
    "layer": "UNIT",
    "description": "Approves cleanly when all recent commits are accurately reflected in handoff.md",
    "pass_criteria": "Returns valid=true and empty unrecorded_commits when handoff reflects git log",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-MEM-C03",
    "category": "MEMORY",
    "layer": "UNIT",
    "description": "Preserves section 4 Intentos fallidos and flags any attempt to mutate or delete it",
    "pass_criteria": "Throws or flags error if section 4 is deleted or corrupted in handoff",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CAPSULE-D01",
    "category": "CAPSULE",
    "layer": "UNIT",
    "description": "Context capsule projection excludes ephemeral conversation logs and noise",
    "pass_criteria": "Generates capsule without any chat history or transient prompt messages",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-CAPSULE-D02",
    "category": "CAPSULE",
    "layer": "UNIT",
    "description": "Validates capsule determinism and size budget compliance (< 32KB)",
    "pass_criteria": "Capsule bytes <= 32768 and canonical hash is identical across successive runs",
    "gate": "REQUIRED"
  }
]
```
