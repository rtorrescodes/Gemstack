# Plan de Implementación: Cost & Provider Safety Gates (Upgrade C)

**Feature Branch**: `008-cost-provider-safety-gates`  
**Feature Directory**: `specs/008-cost-provider-safety-gates/`  
**Spec**: [`specs/008-cost-provider-safety-gates/spec.md`](file:///c:/CODES/Gemstack/specs/008-cost-provider-safety-gates/spec.md)  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_REVIEW`

---

## 1. Architecture Mapping & Context

Upgrade C establishes a deterministic, fail-closed safety and cost verification framework for external and commercial provider interactions.
It builds directly upon the cryptographic and mechanical guarantees of Upgrade A (Architecture Consistency Engine) and Upgrade B (Mechanical Test Matrix & Closure Evidence):
```text
SPEC (gemstack-test-matrix: canonical criteria TEST-COST-A01..H01)
  → PLAN (gemstack-test-bindings: physical suite mapping & gemstack-closure-gates)
    → PROVIDER REGISTRY & COST LEDGER (.gemstack/providers.json & cost-ledger.json)
      → GATES (ProviderCapabilityGate & BillableActionGate)
        → BOUNDARY INTERCEPTOR (Safe Provider Execution Target)
          → VERIFY (Stage 5/6: Read-only ledger & gate verification; zero network)
            → CLOSURE (closure.json: fresh mechanical evidence & gatekeeper)
```

### Central Invariant & Non-Negotiables:
1. **Central Invariant**: `NO PROOF OF AUTHORIZATION = NO COMMERCIAL EXECUTION`.
2. **Ambient Credential Distrust**: `credentials present ≠ authorization`. Presence of API keys or environment variables in shell/CI never bypasses policy.
3. **Environment Safety**: Commercial provider operations are strictly **DENIED** in `test` and `ci` environments.
4. **Re-entrant Fallbacks**: Switching providers during fallback re-evaluates all gates independently.
5. **VERIFY is ALWAYS Read-Only**: `gemstack verify` inspects declarations and ledgers with **zero** network requests, zero billing API calls, and zero file mutations.
6. **Zero External Runtime Dependencies**: Standard Node.js library exclusively (`node:fs`, `node:path`, `node:crypto`).

---

## 2. Exact Repository Change Map

```text
================================================================================
                          REPOSITORY CHANGE MAP
================================================================================
[NEW MODULES]
- src/lib/cost-ledger.js              : Parser, validator, schema checker, and serializer
                                        for cost-ledger.json (forbidding secrets, detecting staleness).
- src/lib/provider-registry.js        : Provider registration, capability declarations,
                                        environment tier resolution, and mock boundary validation.
- src/lib/safety-gates.js             : Fail-closed implementation of ProviderCapabilityGate
                                        and BillableActionGate, with structured decision objects.
- src/lib/provider-boundary.js        : High-integrity execution interceptor binding authorization
                                        tokens to target providers and re-evaluating fallback chains.

[NEW TEST SUITES]
- tests/billable-action-gate.test.js  : Physical tests for TEST-COST-A01..A04, G01 (20 canonical tests).
- tests/provider-capability-gate.test.js : Physical tests for TEST-COST-B01..B04.
- tests/environment-provider-safety.test.js : Physical tests for TEST-COST-C01..C03.
- tests/provider-fallback.test.js     : Physical tests for TEST-COST-D01..D02.
- tests/cost-ledger.test.js           : Physical tests for TEST-COST-E01..E03.
- tests/verification-purity-cost.test.js : Physical tests for TEST-COST-F01..F02, H01.

[MODIFIED EXISTING MODULES]
- src/commands/verify.js              : Integrate Stage 5/6 extension for cost ledger validation,
                                        secrets prohibition in safety files, and commercial adapter gating checks.
- src/lib/closure-context.js          : Include cost-ledger.json in RelevantClosureFiles and
                                        aggregate hash computations when present.

[FROZEN / UNTOUCHED]
- Upgrade A Core (src/lib/contracts.js, src/lib/findings.js, src/lib/hasher.js, src/lib/state.js)
- Upgrade B Core (src/lib/test-matrix.js, src/lib/runner-adapters.js, src/commands/collect.js, src/commands/ship.js)
- Historical Test Suites (tests/contracts.test.js, tests/hasher.test.js, tests/findings.test.js,
                          tests/init.test.js, tests/verify.test.js, tests/test-matrix.test.js,
                          tests/reconciliation.test.js, tests/runner-adapter.test.js,
                          tests/traceability.test.js, tests/closure-manifest.test.js,
                          tests/closure-gates.test.js)
================================================================================
```

---

## 3. Contratos Aditivos del Plan (`gemstack-contracts`)

Inherits all 9 contracts from `specs/008-cost-provider-safety-gates/spec.md`. No new contracts are required:

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Upgrade C implementation must introduce zero external production npm dependencies, using Node.js built-ins exclusively."
  },
  {
    "id": "upgrade-c-cost-states",
    "type": "ENUM_SET",
    "values": [
      "FREE",
      "BILLABLE",
      "POTENTIALLY_BILLABLE",
      "UNKNOWN"
    ],
    "description": "Canonical cost-state classifications for provider actions."
  },
  {
    "id": "upgrade-c-environment-types",
    "type": "ENUM_SET",
    "values": [
      "test",
      "ci",
      "development",
      "staging",
      "production"
    ],
    "description": "Deterministic environment tiers recognized by provider safety gates."
  },
  {
    "id": "unknown-cost-never-free",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Cost classification UNKNOWN must never evaluate or degrade silently to FREE."
  },
  {
    "id": "provider-gate-fail-closed",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Any gate evaluation error, missing declaration, or ambiguous policy must result in DENY."
  },
  {
    "id": "verify-performs-zero-provider-calls",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "gemstack verify must never execute network requests or invoke remote providers during verification."
  },
  {
    "id": "fallback-requires-revalidation",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Provider fallback chains must independently evaluate all capability and cost gates for each candidate."
  },
  {
    "id": "secrets-forbidden-in-safety-artifacts",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "API keys, tokens, or credential secrets must never be stored, hashed, or checked into safety manifests or ledgers."
  },
  {
    "id": "legacy-provider-compatibility",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Features without declared provider blocks or provider-free repositories operate cleanly in legacy mode."
  }
]
```

---

## 4. Provider Registry Architecture (`src/lib/provider-registry.js`)

- **Authoritative Source**: Declarations in `plan.md` (or `.gemstack/providers.json` at repository root).
- **Public API**:
  - `loadProviderRegistry(rootPath, featureDir)`: Loads and validates provider declarations.
  - `resolveEnvironmentTier(options)`: Resolves environment tier (`test`, `ci`, `development`, `staging`, `production`) using explicit flags and deterministic system indicators (`process.env.CI`). Never trusts ambient credentials.
  - `validateMockIntegrity(providerConfig)`: Verifies mock provider declarations are strictly local.
- **Provider Shape**:
  ```json
  {
    "provider_id": "gemini-cloud",
    "type": "COMMERCIAL",
    "allowed_environments": ["development", "staging", "production"],
    "capabilities": ["inference.generate_text", "inference.embeddings"]
  }
  ```

---

## 5. Cost Ledger Architecture (`src/lib/cost-ledger.js`)

- **Authoritative Artifact**: `cost-ledger.json` (feature-local or `.gemstack/cost-ledger.json`).
- **Public API**:
  - `loadCostLedger(filePath)`: Reads, parses, and validates ledger schema.
  - `validateLedgerSchema(data)`: Validates schema version 1, code units sorting, and data integrity.
  - `auditSecretsForbidden(data)`: Strictly scans for forbidden keys (`api_key`, `token`, `secret`, `authorization`, `private_key`) and credential patterns.
  - `checkStaleness(entry, maxAgeDays)`: Compares `freshness_date` against threshold; emits `STALE_PROVIDER_COST_ASSUMPTION` warning if expired.
- **Pure Serialization**: Deterministic code-unit sorted JSON serializer without formatting drift.

---

## 6. Safety Gates Architecture (`src/lib/safety-gates.js`)

### 6.1 `ProviderCapabilityGate`
- **Inputs**: `{ providerId, capabilityId, environment, registry }`
- **Order of Evaluation**:
  1. `UNKNOWN_PROVIDER_IDENTITY`: Provider must exist in registry.
  2. `ENV_COMMERCIAL_DENIED`: Commercial provider disallowed in `test` / `ci`.
  3. `PROVIDER_CAPABILITY_UNDECLARED`: Capability must be listed in provider declaration.
  4. `PROVIDER_CAPABILITY_UNSUPPORTED`: Adapter must support capability.
- **Output**: `{ authorized: boolean, decision: 'ALLOW'|'DENY', reasonCode: string, message: string, context: object }`

### 6.2 `BillableActionGate`
- **Inputs**: `{ actionId, providerId, capabilityId, environment, requestedUnits, authorizationToken, ledger }`
- **Order of Evaluation**:
  1. `ENV_COMMERCIAL_DENIED`: Fail-closed check on environment tier.
  2. `UNDECLARED_BILLABLE_ACTION`: Action must be declared in specification/plan.
  3. `UNKNOWN_COST_CLASSIFICATION`: Cost state must be resolved in ledger (`UNKNOWN` strictly fails closed).
  4. `FREE`: If cost state is `FREE` and provider is local/mock, returns `ALLOW`.
  5. `BILLABLE_ACTION_UNAUTHORIZED`: If cost is `BILLABLE` or `POTENTIALLY_BILLABLE`, explicit authorization token is required.
  6. `BUDGET_THRESHOLD_EXCEEDED`: Evaluates estimated units against `max_budget_units` in authorization token.
- **Output**: Structured decision object identical in shape to `ProviderCapabilityGate`.

---

## 7. Execution Boundary & Fallback Safety (`src/lib/provider-boundary.js`)

- **Execution Interceptor**: Wraps adapter invocations in a strict 2-stage verification barrier:
  ```text
  executeProviderAction(actionRequest, adapter, fallbackChain)
    1. ProviderCapabilityGate.evaluate(...) -> If DENY, halt with Error(reasonCode)
    2. BillableActionGate.evaluate(...)    -> If DENY, halt with Error(reasonCode)
    3. Bind authorization token cryptographically to providerId & capabilityId
    4. Invoke adapter.execute(...)
    5. On adapter failure -> If fallbackChain exists:
       For each candidate in fallbackChain:
         RE-EVALUATE ProviderCapabilityGate & BillableActionGate INDEPENDENTLY!
         If authorized -> execute candidate
         If denied     -> emit PROVIDER_FALLBACK_UNAUTHORIZED and halt
  ```
- **Anti-TOCTOU Guarantee**: Authorization tokens are non-transferable between provider IDs.

---

## 8. Findings & Accepted Exceptions Integration

Upgrade C findings map 1:1 into `src/lib/findings.js` via `createFinding`:
- **Finding Codes**:
  - `UNDECLARED_BILLABLE_ACTION`
  - `BILLABLE_ACTION_UNAUTHORIZED`
  - `UNKNOWN_COST_CLASSIFICATION`
  - `UNKNOWN_PROVIDER_IDENTITY`
  - `PROVIDER_CAPABILITY_UNDECLARED`
  - `PROVIDER_CAPABILITY_UNSUPPORTED`
  - `ENV_COMMERCIAL_DENIED`
  - `PROVIDER_FALLBACK_UNAUTHORIZED`
  - `STALE_PROVIDER_COST_ASSUMPTION` (Severity: `WARNING`, Exception-eligible)
  - `BUDGET_THRESHOLD_EXCEEDED`
  - `MOCK_PROVIDER_ESCAPE_VIOLATION`
  - `COST_LEDGER_INVALID`
- **Waiver Policy**:
  - Only `STALE_PROVIDER_COST_ASSUMPTION` is eligible for human-approved exception bound to `contextHash`.
  - All other safety and authorization blockers are **STRICTLY NON-WAIVABLE**.

---

## 9. Verification Purity & Offline Proof (`gemstack verify`)

- **Audit Integration**: Extend `src/commands/verify.js` (Stage 5/6):
  - Validates `cost-ledger.json` syntax and schema.
  - Verifies zero secrets present in safety ledgers.
  - Verifies that declared commercial adapters implement canonical gate calls.
  - Verifies legacy mode passes cleanly if no providers are declared.
- **Network Purity Test**: `tests/verification-purity-cost.test.js` wraps Node's `net.Socket` and `http/https.request` with throwing mocks to mechanically prove that running `gemstack verify` generates zero network connections.

---

## 10. Canonical Test Bindings (`gemstack-test-bindings`)

The 20 canonical acceptance tests from `specs/008-cost-provider-safety-gates/spec.md` are mapped 1:1 to 6 physical test suites:

```gemstack-test-bindings
[
  {
    "test_id": "TEST-COST-A01",
    "runner": "node:test",
    "file": "tests/billable-action-gate.test.js"
  },
  {
    "test_id": "TEST-COST-A02",
    "runner": "node:test",
    "file": "tests/billable-action-gate.test.js"
  },
  {
    "test_id": "TEST-COST-A03",
    "runner": "node:test",
    "file": "tests/billable-action-gate.test.js"
  },
  {
    "test_id": "TEST-COST-A04",
    "runner": "node:test",
    "file": "tests/billable-action-gate.test.js"
  },
  {
    "test_id": "TEST-COST-B01",
    "runner": "node:test",
    "file": "tests/provider-capability-gate.test.js"
  },
  {
    "test_id": "TEST-COST-B02",
    "runner": "node:test",
    "file": "tests/provider-capability-gate.test.js"
  },
  {
    "test_id": "TEST-COST-B03",
    "runner": "node:test",
    "file": "tests/provider-capability-gate.test.js"
  },
  {
    "test_id": "TEST-COST-B04",
    "runner": "node:test",
    "file": "tests/provider-capability-gate.test.js"
  },
  {
    "test_id": "TEST-COST-C01",
    "runner": "node:test",
    "file": "tests/environment-provider-safety.test.js"
  },
  {
    "test_id": "TEST-COST-C02",
    "runner": "node:test",
    "file": "tests/environment-provider-safety.test.js"
  },
  {
    "test_id": "TEST-COST-C03",
    "runner": "node:test",
    "file": "tests/environment-provider-safety.test.js"
  },
  {
    "test_id": "TEST-COST-D01",
    "runner": "node:test",
    "file": "tests/provider-fallback.test.js"
  },
  {
    "test_id": "TEST-COST-D02",
    "runner": "node:test",
    "file": "tests/provider-fallback.test.js"
  },
  {
    "test_id": "TEST-COST-E01",
    "runner": "node:test",
    "file": "tests/cost-ledger.test.js"
  },
  {
    "test_id": "TEST-COST-E02",
    "runner": "node:test",
    "file": "tests/cost-ledger.test.js"
  },
  {
    "test_id": "TEST-COST-E03",
    "runner": "node:test",
    "file": "tests/cost-ledger.test.js"
  },
  {
    "test_id": "TEST-COST-F01",
    "runner": "node:test",
    "file": "tests/verification-purity-cost.test.js"
  },
  {
    "test_id": "TEST-COST-F02",
    "runner": "node:test",
    "file": "tests/verification-purity-cost.test.js"
  },
  {
    "test_id": "TEST-COST-G01",
    "runner": "node:test",
    "file": "tests/billable-action-gate.test.js"
  },
  {
    "test_id": "TEST-COST-H01",
    "runner": "node:test",
    "file": "tests/verification-purity-cost.test.js"
  }
]
```

---

## 11. Project Closure Gates (`gemstack-closure-gates`)

Upgrade C preserves all established project closure gates:

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

## 12. Implementation Phasing

```text
Phase 1: Schemas & Ledger Foundation
  - Implement src/lib/cost-ledger.js (schema validation, secret prohibition, staleness checks).
  - Test suites: tests/cost-ledger.test.js (TEST-COST-E01..E03).

Phase 2: Provider Registry & Environment Safety
  - Implement src/lib/provider-registry.js (registry loading, environment tier resolution, mock verification).
  - Test suites: tests/environment-provider-safety.test.js (TEST-COST-C01..C03).

Phase 3: Capability & Billable Action Safety Gates
  - Implement src/lib/safety-gates.js (ProviderCapabilityGate and BillableActionGate).
  - Test suites: tests/provider-capability-gate.test.js (TEST-COST-B01..B04),
                 tests/billable-action-gate.test.js (TEST-COST-A01..A04, G01).

Phase 4: Execution Boundary & Fallback Chains
  - Implement src/lib/provider-boundary.js (re-entrant fallback validation, token binding).
  - Test suites: tests/provider-fallback.test.js (TEST-COST-D01..D02).

Phase 5: Verify & Closure Integration
  - Extend src/commands/verify.js and src/lib/closure-context.js.
  - Test suites: tests/verification-purity-cost.test.js (TEST-COST-F01..F02, H01).
  - Validate gemstack collect, gemstack verify, and closure.json generation.
```

---

## 13. Risk Register

| Implementation Risk | Impact | Mitigation Strategy | Mechanical Proof |
| :--- | :--- | :--- | :--- |
| **Accidental Network Call in Verify** | False closure via remote coupling | Throwing socket mock in verification purity tests | `TEST-COST-F01` passes with net/http disabled |
| **Fallback Authorization Leakage** | Expensive fallback invoked without spending permission | Re-entrant gate check required per candidate | `TEST-COST-D02` asserts denial on unapproved secondary |
| **Secret Leakage in Ledger** | Committed API tokens in repo | Strict key-name regex audit on ledger serialization | `TEST-COST-E03` fails closed on credential tokens |
| **Silent UNKNOWN Cost Degradation** | Unexpected cloud charges | Hardcoded invariant: `UNKNOWN` never evaluates to `FREE` | `TEST-COST-A04` asserts fail-closed behavior |
| **Legacy Project Breakage** | Regression in provider-free repos | Progressive legacy bypass notice without errors | `TEST-COST-H01` completes with exit code 0 |

---

## 14. Frozen Contract Compatibility Review

- **Upgrade A Contracts**: Zero contract conflicts. Reuses `FrozenContractRegistry`, findings, fingerprints, and atomic state writers byte-for-byte.
- **Upgrade B Semantics**: Zero semantic conflicts. Test matrix syntax, acceptance signature hashing, runner adapters, exact arithmetic, and read-only verification remain 100% intact.
- **Frozen Hashes Check**: No historical test files or previous feature artifacts are modified.

---

## 15. Explicit Deferred Items

- Dynamic real-time provider balance queries (out of scope, non-goal).
- Payment provider webhook handlers (out of scope, non-goal).
- Context compression algorithms (strictly reserved for Upgrade D).
