# Especificación de Funcionalidad: Cost & Provider Safety Gates (Upgrade C)

**Feature Branch**: `008-cost-provider-safety-gates`  
**Feature Directory**: `specs/008-cost-provider-safety-gates/`  
**Lifecycle Status**: `SPEC_COMPLETE`  
**Stop Reason**: `SPEC_COMPLETE_AWAITING_REVIEW`

---

## 1. Problem Statement

Gemstack v1.2.0 establishes mathematical and mechanical certainty for architectural consistency (Upgrade A) and implementation test closure (Upgrade B). However, modern agentic software development and automated coding pipelines increasingly interface with external commercial, remote, or paid providers:
- Large Language Models (LLMs) and inference APIs (e.g., OpenAI, Anthropic, Gemini, local Ollama vs remote cloud endpoints).
- Vector databases, hosted embeddings, and paid semantic search platforms.
- Image, audio, multimodal generation and processing APIs.
- Cloud deployment and ephemeral infrastructure providers (e.g., Cloud Run, AWS, Vercel, Fly.io).
- External transactional SaaS (e.g., email, SMS, notification dispatchers, third-party payment gateways).

Under existing framework capabilities, a local tool execution, test suite run, or AI agent workflow that appears completely harmless on disk can silently trigger:
1. **Unintended Financial Charges**: Incurring commercial costs or exhausting paid developer quotas/credits without explicit spending authorization.
2. **Test & CI Contamination**: Automated unit test suites, integration passes, or CI runners invoking live remote billable APIs simply because credentials/tokens exist in the ambient shell environment.
3. **Provider Fallback Blindspots**: A requested provider failing and silently falling back to a vastly more expensive or unvetted secondary provider without re-evaluating cost policy.
4. **Capability Mismatches**: Requesting operations that a provider cannot fulfill or is not configured to provide, causing non-deterministic runtime failures or silent mock deceptions.
5. **False Closure via Live Network Couplings**: Verification workflows (`gemstack verify`) accidentally attempting remote queries or mutating external provider states rather than validating local declared evidence.

Gemstack requires a fail-closed, deterministic safety gate framework that verifies provider authorization, capability claims, and cost policies **before** any billable or external provider action can execute.

---

## 2. Goals & Non-Goals

### Goals
- **Fail-Closed Gate Architecture**: Establish two canonical safety gates: `BillableActionGate` and `ProviderCapabilityGate`. If authorization or capability cannot be proven deterministically, execution is strictly blocked.
- **Provider Cost Validation Ledger**: Establish a machine-readable, deterministic ledger artifact (`cost-ledger.json`) making billing classifications, unit pricing assumptions, and estimation policies auditable without turning Gemstack into an invoice processor.
- **Strict Separation of Validation and Execution**: Preserve the Upgrade B invariant (`VERIFY = VALIDATE`). Neither `gemstack verify` nor safety gates ever call remote billing endpoints, mutate provider state, or require network access to validate policy.
- **Ambient Credential Distrust**: Reject commercial execution even when valid API tokens, environment variables, or SDK packages are present, unless an explicit authorization policy permits the action.
- **Environment Safety Isolation**: Deterministically isolate environments (`test`, `ci`, `development`, `production`), prohibiting commercial actions in automated test/CI contexts by default.
- **Re-entrant Fallback Validation**: Enforce that any provider switch, fallback chain, or dynamic adapter selection re-evaluates all gates independently.
- **Backward Compatibility & Legacy Mode**: Ensure projects with zero external providers or existing features continue without friction or errors under progressive Legacy Mode.
- **Zero External Dependencies**: Implement the entire Upgrade C safety engine using native Node.js standard library built-ins exclusively.

### Non-Goals
- Gemstack is **NOT** an accounting system, payment processor, or invoice reconciler.
- Gemstack does **NOT** scrape real-time dynamic pricing from provider websites or APIs.
- Gemstack does **NOT** manage provider secrets, API keys, or credentials.
- Gemstack is **NOT** a general-purpose network firewall or operating system sandboxing tool.
- Gemstack does **NOT** perform autonomous provider purchasing, automated account creation, or dynamic bidding.
- Gemstack does **NOT** claim to prevent hostile code from directly importing third-party SDKs outside the Gemstack provider abstraction.

---

## 3. Core Safety Principle & Architectural Invariants

The fundamental axiom of Upgrade C is:

> **NO BILLABLE OR COMMERCIAL PROVIDER ACTION MAY EXECUTE UNLESS GEMSTACK CAN PROVE THAT THE ACTION IS DECLARED, THE PROVIDER IS ALLOWED, THE REQUIRED CAPABILITY IS AVAILABLE, AND THE APPLICABLE COST POLICY AUTHORIZES EXECUTION.**

```text
================================================================================
                    UPGRADE C CANONICAL SAFETY INVARIANTS
================================================================================
1. credentials present       ≠ authorization
2. provider available        ≠ provider allowed
3. capability implemented    ≠ capability authorized
4. known price               ≠ permission to spend
5. unknown cost              ≠ free
6. fallback provider         ≠ inherited authorization
7. verification              ≠ provider execution
8. evidence                  ≠ authority
9. mock label                ≠ trusted mock
10. commercial action        ≠ implicit permission
================================================================================
```

Failure to prove authorization MUST resolve deterministically to: **DO NOT EXECUTE**.

---

## 4. Bootstrap Architecture Contracts

This specification declares its frozen architectural contracts under the Upgrade A `FrozenContractRegistry`:

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

## 5. Canonical Terminology

| Term | Canonical Meaning |
| :--- | :--- |
| **`BillableAction`** | An atomic logical operation requested against an external or commercial provider that is capable of incurring financial cost, consuming quota, or debiting developer credits. |
| **`BillableActionGate`** | A fail-closed authorization filter that intercepts billable action execution requests and evaluates cost policy, environment tiers, and spending allowances. |
| **`ProviderCapabilityGate`** | A fail-closed compatibility filter that validates whether a designated provider is explicitly permitted, declared, and capable of executing a specific operation. |
| **`CostValidationLedger`** | A versioned, declarative repository ledger (`cost-ledger.json`) documenting known pricing models, unit estimates, and billing classifications for declared actions. |
| **`ProviderIdentity`** | An immutable canonical identifier (`provider_id`) distinguishing unique provider endpoints, accounts, and execution adapters (e.g. `gemini-cloud`, `ollama-local`, `mock-test`). |
| **`CapabilityID`** | A dot-delimited hierarchical token defining an atomic provider capability (e.g. `inference.generate_text`, `storage.upload_artifact`). |
| **`CommercialAdapter`** | An execution adapter that interacts with a third-party or remote provider involving financial metering, remote service accounts, or live external mutations. |
| **`MockProvider`** | A local-only, synthetic adapter explicitly declared for test execution that guarantees zero remote network invocations and zero credit consumption. |
| **`CostState`** | One of the four canonical states: `FREE`, `BILLABLE`, `POTENTIALLY_BILLABLE`, or `UNKNOWN`. |
| **`SideEffectClassification`** | An orthogonality classification distinguishing reading, local mutating, or remote infrastructure mutating actions independent of billing. |

---

## 6. Architecture & Sources of Truth

Upgrade C establishes a single authoritative source for every safety concept to avoid split-brain states:

```text
+-------------------------------------------------------------------------------+
|                             SOURCES OF TRUTH                                  |
+-------------------------------------------------------------------------------+
| 1. Provider Registry & Capabilities  --> specs/<feature>/plan.md OR           |
|                                         .gemstack/providers.json              |
| 2. Billable Action Declarations      --> specs/<feature>/spec.md              |
| 3. Cost Assumptions Ledger           --> specs/<feature>/cost-ledger.json OR   |
|                                         .gemstack/cost-ledger.json            |
| 4. Environment Safety Policy         --> .gemstack/state.json / environment   |
| 5. Runtime Gate Authorization        --> Evaluated in-memory (Side-Effect Free)|
| 6. Verification Findings             --> Derived deterministically            |
+-------------------------------------------------------------------------------+
```

### Authority Hierarchy
1. **Specification (`spec.md`)**: Defines the canonical business requirements and declares expected `gemstack-billable-actions` and `gemstack-capabilities`.
2. **Technical Plan (`plan.md`)**: Binds actions to concrete provider identities and maps capability requirements.
3. **Cost Ledger (`cost-ledger.json`)**: Houses declared pricing models, cost units, and approval thresholds.
4. **Safety Gates (Runtime Interceptor)**: Evaluates requests against the above authoritative sources. It **never** mutates declarations to force an authorization pass.

---

## 7. Action & Cost Classification Model

### 7.1 Billable Action Categories
Every provider action requested by an agent, tool, or CLI runner is classified into one of five operational categories:
1. **DEFINITELY_BILLABLE**: Incurs explicit metering or invoice charges upon invocation (e.g., commercial LLM tokens, cloud GPU runtime, paid SMS).
2. **POTENTIALLY_BILLABLE**: Operations that may be billable depending on account tiers, free quota exhaustion, or request volume (e.g., cloud storage transfers, search API tiers).
3. **NON_BILLABLE_LOCAL**: Local synthetic execution, deterministic hash calculation, in-memory mocks, or local Ollama executions on developer hardware.
4. **EXTERNALLY_MUTATING**: Operations that modify remote infrastructure or external database states (e.g. creating a cloud deployment or deleting remote records) regardless of financial fee.
5. **METERED_READ**: Pure read-only queries that nevertheless incur provider charges (e.g., vector database retrieval queries, paid credit searches).

### 7.2 Cost State Model
The gate evaluates the action's cost status into one of four states:
- **`FREE`**: Proven to have zero monetary cost (e.g., approved local mock). Permitted under all valid environment policies.
- **`BILLABLE`**: Explicitly declared as billable with known pricing classification in the ledger. Permitted **only** when explicit spending authorization exists.
- **`POTENTIALLY_BILLABLE`**: May incur costs. Treated as `BILLABLE` under strict and standard environments; fail-closed by default.
- **`UNKNOWN`**: Missing cost metadata or unclassified action. **Strictly forbidden from execution.** Never degrades to `FREE`.

---

## 8. Safety Gates Contract & Lifecycle

### 8.1 BillableActionGate Lifecycle

```text
[Action Request] 
      │
      ▼
1. Is Environment Permitted? ────(NO)───► [DENY: ENV_COMMERCIAL_DENIED]
      │ (YES)
      ▼
2. Is Action Declared in Spec? ──(NO)───► [DENY: UNDECLARED_BILLABLE_ACTION]
      │ (YES)
      ▼
3. Is Cost Classification Known? ─(UNKNOWN)─► [DENY: UNKNOWN_COST_CLASSIFICATION]
      │ (KNOWN)
      ▼
4. Is Action Cost Free? ─────────(YES)──► [ALLOW: ACTION_AUTHORIZED_FREE]
      │ (BILLABLE)
      ▼
5. Is Explicit Spending Authorized? ─(NO)──► [DENY: BILLABLE_ACTION_UNAUTHORIZED]
      │ (YES)
      ▼
6. Within Budget / Unit Threshold? ──(NO)──► [DENY: BUDGET_THRESHOLD_EXCEEDED]
      │ (YES)
      ▼
[ALLOW: ACTION_AUTHORIZED]
```

#### Gate Input Schema
```json
{
  "action_id": "generate-summary",
  "provider_id": "anthropic-cloud",
  "capability_id": "inference.generate_text",
  "environment": "development",
  "requested_units": 1,
  "authorization_token": {
    "source": "CLI_FLAG",
    "granted_by": "developer",
    "max_budget_units": 5.00,
    "currency": "USD"
  }
}
```

#### Gate Decision Output Schema
```json
{
  "authorized": false,
  "decision": "DENY",
  "reason_code": "BILLABLE_ACTION_UNAUTHORIZED",
  "message": "Action \"generate-summary\" on provider \"anthropic-cloud\" requires explicit spending authorization in development environment.",
  "context": {
    "provider_id": "anthropic-cloud",
    "capability_id": "inference.generate_text",
    "cost_state": "BILLABLE",
    "environment": "development"
  }
}
```

### 8.2 ProviderCapabilityGate Lifecycle

```text
[Capability Request]
      │
      ▼
1. Is Provider Registered? ───────(NO)───► [DENY: UNKNOWN_PROVIDER_IDENTITY]
      │ (YES)
      ▼
2. Is Provider Allowed in Env? ───(NO)───► [DENY: PROVIDER_DISALLOWED_IN_ENV]
      │ (YES)
      ▼
3. Is Capability Declared? ───────(NO)───► [DENY: PROVIDER_CAPABILITY_UNDECLARED]
      │ (YES)
      ▼
4. Does Adapter Support Capability? ─(NO)──► [DENY: PROVIDER_CAPABILITY_UNSUPPORTED]
      │ (YES)
      ▼
[ALLOW: CAPABILITY_VERIFIED]
```

---

## 9. Provider Cost Validation Ledger

The Provider Cost Validation Ledger (`cost-ledger.json`) is a declarative artifact recording pricing models, unit estimates, and authorization constraints.

### 9.1 Ledger Artifact Schema
```json
{
  "$schema": "https://gemstack.dev/schemas/cost-ledger-v1.json",
  "version": 1,
  "updated_at": "2026-09-11T17:00:00.000Z",
  "currency": "USD",
  "providers": {
    "gemini-cloud": {
      "type": "COMMERCIAL",
      "pricing_model": "PER_1K_TOKENS",
      "capabilities": {
        "inference.generate_text": {
          "cost_state": "BILLABLE",
          "estimated_unit_cost": 0.0005,
          "assumption_source": "google-cloud-pricing-2026-08",
          "freshness_date": "2026-08-31",
          "requires_human_approval": false
        }
      }
    },
    "mock-local": {
      "type": "MOCK",
      "pricing_model": "NONE",
      "capabilities": {
        "inference.generate_text": {
          "cost_state": "FREE",
          "estimated_unit_cost": 0.0,
          "assumption_source": "local-synthetic-inmemory",
          "freshness_date": "2026-09-11",
          "requires_human_approval": false
        }
      }
    }
  }
}
```

### 9.2 Stale Assumptions Policy
Pricing assumptions in the ledger are informative baselines, not authoritative real-time quotes. The gate enforces:
- **Price Knowledge ≠ Spending Permission**: Even a fresh, valid entry in the ledger does **not** grant permission to spend unless the active environment policy and authorization token authorize execution.
- If a ledger entry's `freshness_date` is beyond the configured maximum age (e.g. > 90 days), the gate emits finding `STALE_PROVIDER_COST_ASSUMPTION`.

---

## 10. Provider Identity & Fallback Chain Safety

### 10.1 Multi-Account & Alias Isolation
Providers must be registered with unambiguous identifiers. Aliasing or wrapping a commercial provider under an innocuous name (e.g., labeling an OpenAI cloud proxy as `local-helper`) is strictly forbidden.
- `type: "MOCK"` adapters must prove local-only in-memory execution. Any mock adapter opening outbound HTTP sockets to commercial domains is treated as a security violation (`MOCK_PROVIDER_ESCAPE_VIOLATION`).

### 10.2 Re-entrant Fallback Invariant
If an application or agent configures a fallback chain (e.g., Primary: `local-inference`, Secondary: `cloud-inference`):
```text
Primary (local-inference) FAILS
      │
      ▼
Switching to Secondary (cloud-inference)
      │
      ▼
[RE-ENTER GATES] ──► Must pass BillableActionGate & ProviderCapabilityGate
                     for cloud-inference INDEPENDENTLY!
```
Fallback from a free or local provider to a paid provider **never** inherits authorization. The secondary provider must independently obtain explicit spending permission.

---

## 11. Environment Safety Tiers & Non-Interactive Semantics

| Environment | Default Policy | Commercial Allowed? | Mock Required? |
| :--- | :--- | :--- | :--- |
| **`test`** | STRICT_ISOLATION | **DENIED** (Fail-Closed) | **YES** |
| **`ci`** | HEADLESS_GATE | **DENIED** unless secret-free signed waiver | **YES** |
| **`development`** | EXPLICIT_AUTHORIZATION | **DENIED** without `--allow-billable` flag | **OPTIONAL** |
| **`staging`** | BOUNDED_QUOTA | Allowed within declared session budget | **NO** |
| **`production`** | BOUNDED_QUOTA | Allowed with registered service accounts | **NO** |

### Automated Agent & Headless Semantics
In non-interactive environments (CI, autonomous subagents, background jobs):
- Interactive prompts (`Are you sure? [y/N]`) are **strictly disabled**.
- If explicit authorization is not pre-configured via command flags (`--allow-billable`) or policy artifacts, the gate **fails immediately with exit code 1** and structured JSON denial output.

---

## 12. Read-Only Verification Purity & Offline Verification

Preserving the Upgrade B invariant (`VERIFY = VALIDATE`):
- `gemstack verify` inspects declarations in `spec.md`, mappings in `plan.md`, and ledger entries in `cost-ledger.json`.
- `gemstack verify` **NEVER**:
  1. Contacts remote provider APIs or balance endpoints.
  2. Executes billable actions.
  3. Mutates or updates ledger pricing.
  4. Requires network connectivity to validate safety configurations.
- Offline verification is 100% supported: safety gates evaluate static configuration, hashes, and declarations deterministically without internet access.

---

## 13. Threat Model & Policy Bypass Analysis

| Threat / Bypass Vector | Mitigation Architecture |
| :--- | :--- |
| **Ambient Credential Leakage** (Dev has `OPENAI_API_KEY` set in shell during `npm test`) | Gates check active environment policy first. In `test` and `ci`, commercial execution is denied regardless of ambient environment variables. |
| **Stealth Provider Fallback** (Free local model fails, library falls back to paid API) | Re-entrant gate enforcement intercepting adapter calls; each provider candidate evaluated separately. |
| **Mock Impersonation** (Developer labels commercial adapter as `type: MOCK`) | Mocks audited for external network descriptors; unit tests run in zero-network sandboxes. |
| **TOCTOU Disconnect** (Gate authorizes Provider A, runtime executes Provider B) | The authorization token is cryptographically bound to `provider_id`, `capability_id`, and execution hash. |
| **Silent Unknown Cost Degradation** (Unmetered action treated as free) | Invariant: `UNKNOWN` fails closed; requires explicit classification before execution. |
| **Ledger Tampering to Bypass Verification** | Ledger is hashed in `closureContextHash` (Upgrade B); unauthorized mutations invalidate closure evidence. |

---

## 14. Canonical Finding Taxonomy (Upgrade C)

All safety findings use canonical uppercase finding codes and 64-character lowercase SHA-256 fingerprints:

| Finding Code | Severity | Description | Waivable via Exception? |
| :--- | :--- | :--- | :--- |
| **`UNDECLARED_BILLABLE_ACTION`** | BLOCKER | An executed or planned provider action is not declared in `spec.md`. | **NO** |
| **`BILLABLE_ACTION_UNAUTHORIZED`** | BLOCKER | Action requires spending authorization that was not granted. | **NO** |
| **`UNKNOWN_COST_CLASSIFICATION`** | BLOCKER | Cost state is `UNKNOWN` or missing in ledger. | **NO** |
| **`UNKNOWN_PROVIDER_IDENTITY`** | BLOCKER | Action references an unregistered or ambiguous provider ID. | **NO** |
| **`PROVIDER_CAPABILITY_UNDECLARED`**| BLOCKER | Capability requested is not declared in specification or plan. | **NO** |
| **`PROVIDER_CAPABILITY_UNSUPPORTED`**| BLOCKER | Adapter is missing declared implementation support for capability. | **NO** |
| **`ENV_COMMERCIAL_DENIED`** | BLOCKER | Commercial provider action attempted in `test` or `ci` environment. | **NO** |
| **`PROVIDER_FALLBACK_UNAUTHORIZED`** | BLOCKER | Fallback provider failed secondary gate authorization. | **NO** |
| **`STALE_PROVIDER_COST_ASSUMPTION`** | WARNING | Ledger cost estimate is older than maximum freshness threshold. | **YES** |
| **`BUDGET_THRESHOLD_EXCEEDED`** | BLOCKER | Estimated action cost exceeds configured spending limit. | **NO** |
| **`MOCK_PROVIDER_ESCAPE_VIOLATION`** | BLOCKER | Provider declared as MOCK attempted remote network socket invocation. | **NO** |
| **`COST_LEDGER_INVALID`** | BLOCKER | `cost-ledger.json` schema or JSON syntax validation failed. | **NO** |

---

## 15. Canonical Acceptance Matrix (TEST-COST-A01 through TEST-COST-H01)

Upgrade C establishes 20 canonical acceptance test requirements:

```gemstack-test-matrix
[
  {
    "id": "TEST-COST-A01",
    "category": "ACTION_GATE",
    "layer": "UNIT",
    "description": "Rejects execution when billable action is not declared in spec.md.",
    "pass_criteria": "Emits UNDECLARED_BILLABLE_ACTION and halts execution with exit code 1.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-A02",
    "category": "ACTION_GATE",
    "layer": "UNIT",
    "description": "Rejects billable action when explicit spending authorization is missing.",
    "pass_criteria": "Emits BILLABLE_ACTION_UNAUTHORIZED when authorization token is absent.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-A03",
    "category": "ACTION_GATE",
    "layer": "UNIT",
    "description": "Authorizes billable action when explicit valid spending token is supplied.",
    "pass_criteria": "Gate returns authorized: true with zero blockers.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-A04",
    "category": "ACTION_GATE",
    "layer": "UNIT",
    "description": "Rejects action when cost state is UNKNOWN without falling back to FREE.",
    "pass_criteria": "Emits UNKNOWN_COST_CLASSIFICATION and blocks execution fail-closed.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-B01",
    "category": "CAPABILITY_GATE",
    "layer": "UNIT",
    "description": "Blocks execution when capability is not declared in plan or provider registry.",
    "pass_criteria": "Emits PROVIDER_CAPABILITY_UNDECLARED with deterministic denial result.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-B02",
    "category": "CAPABILITY_GATE",
    "layer": "UNIT",
    "description": "Blocks execution when adapter does not implement requested capability.",
    "pass_criteria": "Emits PROVIDER_CAPABILITY_UNSUPPORTED without attempting network invocation.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-B03",
    "category": "CAPABILITY_GATE",
    "layer": "UNIT",
    "description": "Blocks execution when provider identity is unknown or unregistered.",
    "pass_criteria": "Emits UNKNOWN_PROVIDER_IDENTITY for unregistered provider strings.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-B04",
    "category": "CAPABILITY_GATE",
    "layer": "UNIT",
    "description": "Allows execution when provider and capability are declared and supported.",
    "pass_criteria": "Returns authorized: true when provider capability contract is fully satisfied.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-C01",
    "category": "ENVIRONMENT",
    "layer": "INTEGRATION",
    "description": "Blocks commercial provider invocation in test environment despite ambient credentials.",
    "pass_criteria": "Emits ENV_COMMERCIAL_DENIED during test run when commercial provider is requested.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-C02",
    "category": "ENVIRONMENT",
    "layer": "INTEGRATION",
    "description": "Blocks commercial provider invocation in CI environment without explicit signed waiver.",
    "pass_criteria": "Emits ENV_COMMERCIAL_DENIED in CI environment.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-C03",
    "category": "ENVIRONMENT",
    "layer": "UNIT",
    "description": "Allows verified MOCK providers to execute cleanly in test environment.",
    "pass_criteria": "Returns authorized: true for declared MOCK provider in test environment.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-D01",
    "category": "FALLBACK",
    "layer": "INTEGRATION",
    "description": "Re-evaluates safety gates when switching from primary to fallback provider.",
    "pass_criteria": "Fallback candidate triggers independent gate evaluation before execution.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-D02",
    "category": "FALLBACK",
    "layer": "INTEGRATION",
    "description": "Blocks fallback when secondary provider does not satisfy cost authorization policy.",
    "pass_criteria": "Emits PROVIDER_FALLBACK_UNAUTHORIZED when fallback target lacks spending permission.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-E01",
    "category": "LEDGER",
    "layer": "UNIT",
    "description": "Validates syntax and schema structure of cost-ledger.json.",
    "pass_criteria": "Rejects malformed ledger with COST_LEDGER_INVALID finding.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-E02",
    "category": "LEDGER",
    "layer": "UNIT",
    "description": "Emits warning finding when pricing assumption freshness date exceeds threshold.",
    "pass_criteria": "Emits STALE_PROVIDER_COST_ASSUMPTION without crashing gate evaluation.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-E03",
    "category": "LEDGER",
    "layer": "UNIT",
    "description": "Enforces that cost ledger never contains credential secrets or authentication tokens.",
    "pass_criteria": "Rejects ledger containing API keys or private tokens with non-waivable blocker.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-F01",
    "category": "VERIFICATION_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves gemstack verify executes zero outbound network or provider requests.",
    "pass_criteria": "Verify command completes with exit 0 with all network sockets mocked to throw.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-F02",
    "category": "VERIFICATION_PURITY",
    "layer": "INTEGRATION",
    "description": "Proves gemstack verify does not mutate cost ledger or state files on disk.",
    "pass_criteria": "Before and after SHA-256 file hashes match 100% (0 mutations).",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-G01",
    "category": "BUDGET",
    "layer": "UNIT",
    "description": "Blocks action execution when estimated unit cost exceeds granted budget limit.",
    "pass_criteria": "Emits BUDGET_THRESHOLD_EXCEEDED when requested cost exceeds token limit.",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-COST-H01",
    "category": "LEGACY",
    "layer": "UNIT",
    "description": "Preserves backward compatibility for provider-free projects in legacy mode.",
    "pass_criteria": "Legacy project verify passes with zero errors and informational legacy notice.",
    "gate": "REQUIRED"
  }
]
```

---

## 16. Future Test Strategy (Design Only)

Implementation testing will be organized into dedicated physical test suites:
1. `tests/billable-action-gate.test.js`: Unit tests for `BillableActionGate` authorization logic, state transitions, and spending token verification (`TEST-COST-A01` to `A04`, `G01`).
2. `tests/provider-capability-gate.test.js`: Unit tests for capability discovery, adapter compatibility validation, and unknown provider rejection (`TEST-COST-B01` to `B04`).
3. `tests/environment-provider-safety.test.js`: Integration tests proving test/CI isolation against ambient developer credentials (`TEST-COST-C01` to `C03`).
4. `tests/provider-fallback.test.js`: Multi-adapter switching tests verifying re-entrant gate validation on fallback chains (`TEST-COST-D01`, `D02`).
5. `tests/cost-ledger.test.js`: Schema validation, freshness checks, and secret leakage audits for `cost-ledger.json` (`TEST-COST-E01` to `E03`).
6. `tests/verification-purity-cost.test.js`: Network isolation assertions ensuring `gemstack verify` operates strictly offline without disk mutations or provider API calls (`TEST-COST-F01`, `F02`, `H01`).

All test suites will run strictly offline using pure Node.js in-memory mocks without commercial charges or real credentials.

---

## 17. Compatibility & Legacy Migration

- **Existing Projects**: Projects without `cost-ledger.json` or provider definitions operate under **Legacy Progressive Mode** (`LEGACY_NO_PROVIDERS_DECLARED`). Verification passes with zero errors.
- **Upgrades A & B Alignment**: No Upgrade A frozen contracts or Upgrade B closure semantics are modified. Upgrade C artifacts (`cost-ledger.json`) will be incorporated into Upgrade B's `RelevantClosureFiles` during plan phase.
- **Zero Runtime Dependencies**: Fully built on Node.js core modules (`node:fs`, `node:path`, `node:crypto`).

---

## 18. Open Questions

**NONE.** The architecture, gate lifecycles, cost classification model, fallback re-entrancy rules, and acceptance criteria are fully resolved and aligned with existing repository primitives.
