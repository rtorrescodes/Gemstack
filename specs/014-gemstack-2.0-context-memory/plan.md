# Implementation Plan: Gemstack 2.0 Sprint D — Efficient Context & Persistent Memory

**Feature ID:** `014-gemstack-2.0-context-memory`  
**Phase:** `plan`  
**Parent Release:** `gemstack-ai@2.0.0-alpha`

---

## 1. Inherited Architecture Contracts

```gemstack-inherited-contracts
[
  {
    "id": "context-fatigue-guard",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "offline-dependency-audit",
    "type": "ENUM_SET",
    "values": [
      "orphan-detector",
      "undeclared-detector",
      "circular-cycle-detector",
      "offline-purity"
    ]
  },
  {
    "id": "memory-git-cross-audit",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "capsule-noise-elimination",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  }
]
```

---

## 2. Technical Architecture & Modules

### 2.1 Context Fatigue & Noise Pruning (`src/lib/context-fatigue.js`)
- `detectContextFatigue(messages, options)`: Estimates token load, checks against threshold (default 16,000 tokens), computes redundancy ratio, and flags alert.
- `computeRedundancyRatio(messages)`: Detects duplicate substrings / repetitive prompt outputs.
- `pruneContextNoise(messages, options)`: Prunes duplicate tool outputs and ephemeral chit-chat while strictly retaining architectural decisions, contract declarations, and active tasks.

### 2.2 Offline Dependency Auditor (`src/lib/dependency-audit.js`)
- `auditDependencies(targetDir)`:
  - Scans `package.json` dependencies and devDependencies.
  - Scans `src/` and other source directories for Node.js `require()` and `import` patterns.
  - Identifies:
    - `orphans`: Declared dependencies that are never referenced in code.
    - `undeclared`: Non-built-in packages imported in code that are missing from `package.json`.
    - `circularCycles`: Dependency graph cycles using Tarjan's or DFS cycle detection.
  - 100% offline, zero subprocess execution, zero network requests.

### 2.3 Memory Cross-Audit (`src/lib/memory-audit.js`)
- `crossAuditMemoryWithGit(targetDir, options)`:
  - Reads `handoff.md` sections (ensuring Section 4 "Intentos fallidos" is intact).
  - Fetches recent git log commits (`git log -n 10 --oneline`).
  - Cross-references commit hashes or keywords against `handoff.md`.
  - Flags `unrecorded_commits` when recent commits are completely missing from handoff notes.

### 2.4 CLI Integrations
- Integrate `dependency-audit` into `gemstack doctor` (`src/commands/doctor.js`).
- Integrate `memory-audit` into `gemstack verify` (`src/commands/verify.js`).

---

## 3. Physical Test Bindings

```gemstack-test-bindings
[
  {
    "id": "TEST-FATIGUE-A01",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Detects context fatigue when accumulated token count exceeds configurable threshold"
  },
  {
    "id": "TEST-FATIGUE-A02",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Identifies repetitive context fragments and computes redundancy ratio accurately"
  },
  {
    "id": "TEST-FATIGUE-A03",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Deterministically prunes noise and duplicate chatter while preserving contracts and state"
  },
  {
    "id": "TEST-DEP-B01",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Detects orphan dependencies declared in package.json but never imported in code"
  },
  {
    "id": "TEST-DEP-B02",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Detects undeclared module dependencies imported in code but missing from package.json"
  },
  {
    "id": "TEST-DEP-B03",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Detects circular import cycles among local project modules"
  },
  {
    "id": "TEST-DEP-B04",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Dependency auditor runs completely offline without spawning npm or network requests"
  },
  {
    "id": "TEST-MEM-C01",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Detects discrepancies between recent git commit messages and handoff.md records"
  },
  {
    "id": "TEST-MEM-C02",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Approves cleanly when all recent commits are accurately reflected in handoff.md"
  },
  {
    "id": "TEST-MEM-C03",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Preserves section 4 Intentos fallidos and flags any attempt to mutate or delete it"
  },
  {
    "id": "TEST-CAPSULE-D01",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Context capsule projection excludes ephemeral conversation logs and noise"
  },
  {
    "id": "TEST-CAPSULE-D02",
    "file": "tests/context-memory-p1.test.js",
    "symbol": "Validates capsule determinism and size budget compliance (< 32KB)"
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
