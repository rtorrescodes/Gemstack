# Changelog

All notable changes to this project will be documented in this file.

## [v2.0.1] - 2026-09-23

### Security Closure & Hardening Checkpoint
Gemstack 2.0.1 closes verification gaps between announced security guarantees and permitted execution paths, hardening trust boundaries, skill provenance, contract amendment authorization, and CI/CD supply chain reproducibility.

### Security & Hardening
- **Spending Authorization Bypass Elimination (`src/lib/safety-gates.js`)**:
  - Eliminated unsigned token bypass (`token.granted === true` fallback without `boundarySecret`). Billable actions without verified cryptographic signatures are strictly denied (`DENIED`).
  - Removed hardcoded default signing secret (`'gemstack-boundary-internal-signing-secret'`). A trusted secret with a minimum length of 16 characters is now required; calls with missing or weak secrets throw `SECRET_CONFIGURATION_ERROR`.
  - Added strict validation of `max_budget_units` and `requested_units` to enforce positive finite numbers (`UNITS_MUST_BE_POSITIVE_FINITE`).
  - Documented in-process boundary model: `tokenSpendingLedger` operates in Node.js process memory for the active execution session rather than a global distributed quota system.
- **Remote Skill Ingestion Provenance & Overwrite Protection (`src/commands/install.js`)**:
  - Enforced mandatory `--sha256 <hash>` verification on `gemstack install <url>`. Installations lacking an expected checksum are blocked fail-closed (`MISSING_EXPECTED_CHECKSUM`).
  - Added safe inspection mode (`--inspect`) allowing developers to preview remote skill metadata, author, and checksum without touching disk.
  - Blocked embedded credentials in URLs (`https://user:pass@host/...`) to prevent credential exfiltration and SSRF bypass (`CREDENTIALS_IN_URL_BLOCKED`).
  - Extended SSRF protections: blocks RFC 1918/4193 private IPs, IPv4 representations in hex/octal/dword format, loopback addresses (`127.0.0.1`, `localhost`, `::1`), link-local, and zero addresses (`PRIVATE_IP_BLOCKED`).
  - Added whitelist enforcement against `DEFAULT_ALLOWED_SOURCES` (`raw.githubusercontent.com`, `gist.githubusercontent.com`), configurable via `--allowed-sources`.
  - Enforced overwrite protection: existing skills cannot be silently replaced. Overwriting requires `--update` (which creates an automatic timestamped backup in `.gemstack/backups/skills/`) or `--force`.
- **Contract Amendments Cryptographic Authorization (`src/lib/contract-amendments.js`)**:
  - Made HMAC secret configuration mandatory (minimum 16 characters) for approving and recording contract amendments (`AMENDMENT_SECRET_MISSING`).
  - Cryptographically bound the amendment signature payload to `feature_id + contract_id + version + previous_contract_sha256 + proposed_contract_sha256 + approved_by + reason`.
  - Enforced timing-safe signature comparison using `crypto.timingSafeEqual` against timing attacks.
  - Separated structural integrity hashing (`computeAmendmentIntegrityHash`) from human authorization signatures (`computeAmendmentSignature`), maintaining the core invariant: *integrity hash ≠ human approval*.
- **Reproducible CI/CD & Supply Chain Hardening**:
  - Generated and committed a root `package-lock.json` locking 0 runtime and 0 dev dependencies, enabling deterministic `npm ci`.
  - Optimized `.github/workflows/main-ci.yml` by migrating all matrix jobs to `npm ci` and deduplicating redundant test and demo runs.
  - Hardened `.github/workflows/publish.yml` with least-privilege token separation: split into `publish-npm` (`permissions: { contents: read, id-token: write }`) with fail-closed NPM registry verification, and `release-github` (`permissions: { contents: write }`).

### Validation
- 194 physical tests passing across 24 suites with 0 failures and 0 skipped (+14 new tests covering provenance, spend limits, and amendment binding).
- Full CI test suite (`npm run ci:all`) passing cleanly with exit code 0.
- Clean tarball package installation verified in isolated scratch environment.
- Zero runtime and zero dev npm dependencies maintained.

## [v2.0.0] - 2026-09-23

### Major Architecture Milestone: Gemstack 2.0
Gemstack 2.0 elevates the framework from declarative agent guidance to reproducible cryptographic and runtime guarantees.

### Added
- **P0 Trust Boundaries & Hardening (Sprint A)**:
  - `resolveSafeStrict`: Enforces realpath resolution to permanently eliminate arbitrary symlink path traversal outside project roots.
  - Remote Skill Provenance: Verifies remote skills against `allowed_sources` and validates SHA-256 content checksums prior to installation.
  - Native Secret Blocking in Git Hooks: Local pre-commit hook automatically scans for and rejects commits containing API keys (GitHub PATs, OpenAI/Anthropic/Stripe tokens), private keys, or `.env` files.
  - Environment & Log Sanitization: Eliminates credential leakage by redacting sensitive values across all CLI logs.
- **P1 Honest Evidence & Reliable Metrics (Sprint B)**:
  - Authenticated Billable Action Tokens: Implemented HMAC-SHA256 authenticated spending tokens, cumulative budget accounting, and positive unit enforcement (`src/lib/safety-gates.js`).
  - Disk-Recomputed Visual Evidence: Screenshots must be verified by recomputing SHA-256 hashes from disk; rejects self-declared diffs without a registered visual diff adapter (`UNVERIFIED`).
  - Pre-Persistence Secret Masking: Sensitive inputs and credentials are redacted prior to persisting visual evidence on disk.
  - Public Control Matrix: Public `Control / Scope / Test / Limit` 4-column matrix in `README.md` and rules, eliminating unverified marketing claims.
  - Pinned CI Workflows: GitHub Actions pinned to 40-character commit SHAs with explicit least-privilege `permissions: contents: read`.
- **P2 Adaptable SDD & Incremental Specs (Sprint C)**:
  - Four Rigor Levels: `quick` (single-artifact lightweight mode), `fix` (enforces linked regression test), `feature` (standard 3-phase SDD), and `high-risk` (threat model, rollback plan, and dual human approvals).
  - Incremental Spec Deltas: Structured `ADDED`, `MODIFIED`, and `REMOVED` declarations preventing destructive overwriting of base specifications by concurrent agents.
  - Offline Spec Merge: `gemstack spec merge` detects colliding contracts and duplicate canonical test IDs before merging branches.
  - Formal Contract Amendments: Replaces silent contract mutations with signed, auditable amendment records (`src/lib/contract-amendments.js`).
- **P3 Efficient Context & Persistent Memory (Sprint D)**:
  - Context Fatigue Detector & Noise Pruning: Flags warnings when accumulated token load or redundancy ratios exceed thresholds; deterministically prunes ephemeral chatter while preserving contracts and state.
  - Offline Dependency Auditor in `gemstack doctor`: Analyzes orphan dependencies, undeclared imports, and local circular cycles in <10ms without invoking external network requests.
  - Memory Cross-Verification in `gemstack verify`: Reconciles recent git commit log against `handoff.md` to prevent unrecorded work from being lost across sessions.

### Validation
- 180 physical tests passing across 23 test suites with 0 failures and 0 skipped.
- Full CI test suite (`npm run ci:all`) passing cleanly.
- `gemstack verify` passing with 0 errors and 0 open blockers.
- Zero runtime npm dependencies maintained (`dependencies: {}`).

## [v1.4.0] - 2026-09-11

### Added
- **Agent Swarm Planning & Validation (Upgrade E)**: Deterministic multi-worker wave planning and coordination verification framework.
  - Deterministic swarm planning contracts and canonical `swarm.json` manifest schema.
  - Task ownership and write-set partitioning: enforces disjoint write boundaries per wave (`write_set(T1) ∩ write_set(T2) = ∅`).
  - Write-collision detection: automatically detects overlapping write sets and serializes conflicting tasks into sequential waves.
  - Dependency wave scheduling: preserves task prerequisite graphs and rejects circular dependencies (`SWARM_DEPENDENCY_CYCLE`).
  - Task-scoped context projections: compiles minimal, role-tailored contexts derived from `context-capsule.json`.
  - Context freshness validation: verifies live capsule hash against `source_capsule_hash` to reject stale projections (`SWARM_CONTEXT_STALE`).
  - Separation of duties gate: mechanically enforces `AUTHOR != REVIEWER` (`SWARM_SELF_REVIEW_DETECTED`).
  - Provider policy and budget gating: integrates with Upgrade C `ProviderCapabilityGate` and `BillableActionGate` to prevent budget runaway.
  - Subagent limits enforcement: strictly blocks unauthorized recursive worker spawning.
  - Pure offline read-only verification (Stage 5.3 in `gemstack verify`): validates swarm manifests without worker or agent execution.
  - Explicit non-execution invariant: Gemstack core does NOT execute autonomous coding agents.
- **Visual QA Evidence (Upgrade E)**: Mechanical, offline visual verification architecture based on cryptographic digests and neutral masking.
  - Canonical `visual-qa.json` manifest schema declaring route, deterministic viewport dimensions, and approved baseline references.
  - Deterministic viewport specifications: standard profiles with explicit width, height, and device scale factor.
  - Cryptographic baseline pinning: baseline images tracked via canonical SHA-256 byte digests (`image_sha256`).
  - Tampering detection: flags baseline image mutations on disk (`VQA_BASELINE_TAMPERED`).
  - Neutral selector masking: masks dynamic elements (`[MASKED_NEUTRAL]`) to prevent flaky subpixel and timestamp diffs.
  - Mandatory automatic password & credential masking: automatically replaces sensitive input fields (`type=password`, `data-sensitive=true`) with `[MASKED_SECRET]`.
  - Structured visual evidence comparison: fast SHA-256 digest match path with offline tolerance-bounded diffing (`max_diff_percentage`).
  - Explicit baseline promotion: baselines are NEVER auto-updated or healed during test or verify; requires explicit `gemstack vqa promote <scenario-id>`.
  - Pure offline read-only verification (Stage 5.4 in `gemstack verify`): zero browser launches, zero network calls, zero file mutations.
  - Explicit non-execution invariant: Gemstack core does NOT launch browsers and does NOT capture screenshots automatically.
- **New CLI Surfaces**:
  - `gemstack swarm plan [--json]`: compiles `tasks.md` into deterministic concurrent waves.
  - `gemstack swarm validate [--json]`: validates write partitions, review separation, and context freshness.
  - `gemstack vqa validate [--json]` (or `gemstack visual validate`): validates visual QA manifests, viewports, baselines, and evidence offline.
  - `gemstack vqa promote <scenario-id>` (or `gemstack visual promote`): explicitly promotes live evidence to approved canonical baseline.

### Changed
- `gemstack verify` extended with Stage 5.3 (Swarm Audit) and Stage 5.4 (Visual QA Audit) running in pure read-only mode.
- `src/lib/closure-context.js` updated to track `swarm.json` and `visual-qa.json` in closure context hashing, and support alphanumeric task IDs (`UE-T001`..`T029`).
- `package.json` test script updated to register the 5 new Upgrade E test suites.

### Compatibility
- 100% backward compatible with existing Gemstack repositories and frozen contracts from Upgrades A, B, C, and D.
- Zero external runtime npm dependencies added (`package.json` dependencies remain `{}`).
- Zero external development npm dependencies added (`package.json` devDependencies remain `{}`).

### Validation
- 29/29 Upgrade E tasks COMPLETE.
- 20/20 Upgrade E canonical acceptance tests passing (`TEST-SWARM-A01`..`E02`, `TEST-VISUAL-A01`..`E02`).
- 10/10 Upgrade E bootstrap contracts passing.
- 26/26 adversarial test cases passing.
- 126/126 physical tests passing across 14 suites with 0 failures and 0 skipped.
- Full CI test matrix (`npm run ci:all`) passing cleanly.
- `gemstack verify` exit code 0 with 0 errors and 0 open blockers.
- Swarm manifest verified: `VALID` and `FRESH`.
- Visual QA manifest verified: `VALID` and `FRESH`.
- Closure evidence: `specs/010-agent-swarm-visual-qa/closure.json` status `VERIFIED`.

## [v1.3.0] - 2026-09-11

### Added
- **Cost & Provider Safety Gates (Upgrade C)**: Deterministic, fail-closed safety and cost verification framework for commercial, external, and AI provider interactions.
  - `ProviderCapabilityGate`: validates that requested capabilities are declared and supported by the active provider adapter before invocation.
  - `BillableActionGate`: blocks billable actions unless explicit spending authorization tokens are granted.
  - Provider Registry: canonical provider directory with declared capability contracts and deterministic rejection of unknown providers.
  - Cost Ledger (`cost-ledger.json`): auditable schema validating provider cost assumptions, freshness thresholds, and currency units.
  - Fail-Closed Unknown Cost Policy: unclassified or ambiguous operations are strictly treated as commercial rather than defaulted to free.
  - Environment Safety Isolation: prevents accidental commercial provider invocations in `test` and `ci` environments even if ambient credentials exist.
  - Trusted Mock Boundaries: enforces that test mocks execute strictly in memory with zero network escapes.
  - Re-Entrant Fallback Authorization: secondary fallback providers trigger independent gate re-evaluation before execution.
  - Verification Purity: guarantees `gemstack verify` executes offline with zero network sockets and zero ledger file mutations.
- **Context Capsule / Context Compression (Upgrade D)**: Deterministic, auditable, constraint-lossless context compression architecture for cross-session AI continuation.
  - Deterministic Context Capsule Generation: compiles authoritative sources (`spec.md`, `plan.md`, `tasks.md`, `.gemstack/state.json`, `closure.json`) into `context-capsule.json`.
  - Constraint-Lossless Compression: 100% of normative `MUST` and `MUST NOT` constraints, frozen contracts, and acceptance signatures survive compression.
  - Canonical Authority Precedence: authoritative repository sources unconditionally govern over derived capsule claims (`SPEC` > `PLAN` > `TASKS` > implementation).
  - Provenance & Freshness Hashing: live SHA-256 source digests detect drift or manual tampering immediately (`STALE` / `TAMPERED`).
  - Strict Secrets Defense: automatic regex and property pattern scanner rejects tokens, API keys, private keys, and `.env` references fail-closed.
  - Size Budget Enforcement: 32 KB target budget with deterministic 3-tier condensation and 64 KB fail-closed hard limit.
  - Pure Offline & Atomic Writing: generation and validation execute 100% offline with atomic write semantics (`.tmp` + rename).
  - Read-Only Verification (Stage 5.2): `gemstack verify` inspects context capsule freshness without disk writes or file mutation.
  - New CLI Surface: `gemstack context generate`, `gemstack context show`, and `gemstack context verify`.
  - Progressive Legacy Support: repositories or features lacking capsules operate cleanly with informational notices and zero blockers.

### Changed
- `gemstack verify` pipeline extended to include Stage 5.2 Context Capsule read-only audit.
- `package.json` test script updated to explicitly enumerate all 25 physical test suites across Upgrades A, B, C, and D.
- Closure context resolution (`src/lib/closure-context.js`) incorporates `context-capsule.json` in relevant files hashing.

### Compatibility
- 100% backward compatible with existing Gemstack repositories and frozen contracts from Upgrades A, B, and C.
- Zero external runtime npm dependencies added (`package.json` dependencies remain `{}`).

### Validation
- 20/20 Upgrade C canonical acceptance tests passing (`TEST-COST-A01` through `H01`).
- 20/20 Upgrade D canonical acceptance tests passing (`TEST-CONTEXT-A01` through `H01`).
- 85/85 combined canonical acceptance tests passing (25 Upgrade A + 20 Upgrade B + 20 Upgrade C + 20 Upgrade D).
- 100/100 physical tests passing with 0 failures and 0 regressions.
- Full CI test matrix (`npm run ci:all`) passing cleanly.
- `gemstack verify` exit code 0 with 0 errors and 0 open blockers.
- Context capsule verified: `VALID` and `FRESH` (11,873 bytes < 32 KB budget).

## [v1.2.0] - 2026-09-11
### Added
- **Mechanical Test Matrix & Closure Evidence (Upgrade B)**: Full mechanical closure verification framework eliminating false closure and test discovery hallucinations.
- Canonical fenced `gemstack-test-matrix` blocks in `spec.md` with 20 canonical acceptance test criteria (`TEST-CLOSURE-A01` through `H01`).
- Deterministic Acceptance Signature (`acceptanceSignature`): SHA-256 digest calculated across all canonical test definitions ensuring immutable acceptance criteria.
- Bidirectional Task <-> Test Traceability: strict mapping between `tasks.md` validation blocks and canonical acceptance tests.
- Zero-Shell Test Runner Adapters: safe, cross-platform `node:test` TAP runner adapter with suite container detection (`kind: 'SUITE'` vs `kind: 'TEST'`).
- Exact Canonical Reconciliation Arithmetic: verifies `canonical_required = canonical_passed + missing`, `physical_executed = canonical_executed + supporting_executed`, and prevents phantoms and orphans.
- Mutating Evidence Collector (`gemstack collect`): executes bound test files and required `PACKAGE_SCRIPT` gates to produce `specs/<feature>/closure.json`.
- Dynamic Closure Context Freshness (`closureContextHash`): binds closure evidence to the repository state (clean/dirty git or non-git), phase hashes, test files, and bounded implementation code.
- Read-Only Closure Gate in `gemstack verify`: stage 5/6 verifies `closure.json` freshness and acceptance criteria without writing or mutating any files on disk.
- Lifecycle Ship Enforcement (`gemstack ship`): requires status `VERIFIED` in `closure.json` before transitioning feature lifecycle to `SHIPPED`.
- Progressive `LEGACY` mode support: features lacking test matrix blocks continue without friction or errors.

### Changed
- `gemstack verify` upgraded to a 6-stage deterministic verification pipeline with zero-mutation read-only verification.
- `package.json` test script explicitly enumerates all 11 physical test suites for portable cross-platform execution.
- Agent skills (`gemstack-spec`, `gemstack-plan`, `gemstack-tasks`, `gemstack-qa`, `gemstack-ship`) and templates updated with Upgrade B canonical workflows.

### Compatibility
- 100% backward compatible with existing Gemstack repositories and Upgrade A contract blocks.
- Zero external runtime or development npm dependencies added (`package.json` dependencies remain `{}`).

### Validation
- 22/22 Upgrade B implementation tasks complete (T001–T022).
- 20/20 canonical P1 acceptance tests passing.
- 45/45 combined canonical acceptance tests passing (25 Upgrade A + 20 Upgrade B).
- 53/53 physical tests passing with 0 regressions.
- `npm test` exit code 0.
- `gemstack verify` exit code 0 with 0 open blockers.
- Self-dogfooded on `specs/007-mechanical-test-matrix-closure-evidence/` with closure status `VERIFIED`.

## [v1.1.2] - 2026-09-11
### Fixed
- Fixed host-dependent normalization of simulated Windows paths in the Architecture Consistency Engine.
- Canonical repository-relative locations now use explicit win32/posix path semantics based on input path flavor.
- Restored TEST-CONSISTENCY-G01 on Linux CI without changing Upgrade A architecture or acceptance semantics.

## [v1.1.1] - 2026-09-11
### Fixed
- Fixed cross-platform CI test discovery for Node's built-in test runner.
- Replaced shell-dependent recursive glob invocation with deterministic explicit test-file execution (`node --test tests/contracts.test.js tests/hasher.test.js tests/findings.test.js tests/init.test.js tests/verify.test.js`).
- No Upgrade A architecture or acceptance semantics changed.

## [v1.1.0] - 2026-09-11
### Added
- `FrozenContractRegistry`: deterministic architectural contract engine supporting 6 canonical types (`ENUM_SET`, `IDENTITY_TUPLE`, `PROVENANCE_RULE`, `BOOLEAN_INVARIANT`, `BOUNDARY`, `ROADMAP_LIMIT`).
- Canonical fenced `gemstack-contracts` blocks in phase artifacts (`spec.md`, `plan.md`, `tasks.md`).
- Cross-phase contract inheritance (`SPEC` -> `PLAN` -> `TASKS`) and deterministic contradiction detection (`FROZEN_CONTRACT_VIOLATION`).
- Phase artifact SHA-256 freezing and mutation detection (`FROZEN_ARTIFACT_CHANGED`).
- Canonical 64-character lowercase SHA-256 finding fingerprints with 12-character cosmetic display tokens.
- Anti-loop finding lifecycle reconciliation (`OPEN`, `RESOLVED`, `ACCEPTED_EXCEPTION`, `SUPERSEDED`).
- Formal accepted exception suppression bound to deterministic 3-tuple `contextHash`.
- Per-feature `.gemstack.json` historical metadata sidecar preserving phase hash and finding audit trails.
- Atomic state and sidecar persistence with temporary file write and atomic rename with bounded retry for cross-platform file locking.
- Progressive `LEGACY` mode ensuring features without contract blocks continue without friction or errors.
- Integrated Stage 4/5 Architectural Consistency verification into `gemstack verify` (alias `audit`).

### Changed
- `gemstack verify` upgraded from 4-stage to 5-stage deterministic verification pipeline.
- Agent skills (`gemstack-spec`, `gemstack-plan`, `gemstack-tasks`, `gemstack-review`) and phase templates updated to generate and validate frozen architectural contracts.
- Gemstack Constitution strengthened to forbid silent downstream contradictions of frozen contracts.

### Compatibility
- Existing projects without `gemstack-contracts` blocks remain 100% supported through progressive LEGACY mode.
- No mandatory migration is required.
- Zero external runtime or development npm dependencies added (`package.json` dependencies remain `{}`).

### Validation
- 17 / 17 Upgrade A implementation tasks complete.
- 25 / 25 canonical P1 acceptance tests passing (Categories A–H).
- 33 / 33 physical test cases passing across 5 test suites.
- `npm test` exit code 0.
- `gemstack verify` exit code 0 with 0 open blockers.
- Self-dogfooded on `specs/006-architecture-consistency-engine/` with 5 base contracts passing and 0 contradictions.

## [v1.0.2] - 2026-09-03
### Added
- Intent-Based Routing in `01-gemstack-core.md`: semantic intent detection for natural language interactions without mandatory slash prefixes.
- Zero Silent Failures clause in Article III of `02-gemstack-constitution.md`: bans `2>nul` and error-suppressing shell operators in test runners.
- `gemstack verify` (alias `audit`): full-stack CLI auditor validating structure, memory integrity, state consistency, and security flags.
- Auto State Sync across `gemstack-spec`, `gemstack-ship`, and `gemstack-handoff` keeping `.gemstack/state.json` synchronized with the active feature lifecycle.
- Unit tests for verify command in `tests/verify.test.js`.

## [v0.3.0] - 2026-08-19
### Added
- GitHub Actions CI/CD workflows (`pr-ci.yml`, `main-ci.yml`, `release-readiness.yml`).
- Zero-dependency Node.js CI scripts under `scripts/ci/` (`check-frontmatter.js`, `check-template-clean.js`, `check-mojibake.js`, `check-package-contents.js`, `smoke-cli.js`).
- Strict repository hygiene validation ensuring `template/` cleanliness before any release.
- Tarball artifact generation workflow for manual validation.
- SecureDocs smoke testing embedded in CI (`ci:demo`).
- `.gitattributes` to enforce consistent EOL globally.
- README CI badge.
- Added package artifact validation ensuring no publish secrets.
- explicitly prevented any npm publish automation for safety.

## [Unreleased]
### Added
- Zero-dependency Node.js CLI (`src/cli.js`) to install and update Gemstack via `npx gemstack init` or `gemstack update`.
- `template/` directory structure separating core framework from source code.
- Idempotent updates with mandatory `.gemstack/backups` via `src/lib/backup.js`.
- Manifest tracking (`.gemstack/manifest.json`) using crypto checksums.
- `gemstack doctor`, `list`, and `show` ported to cross-platform JS.
- Native unit tests via `node:test`.

## [v0.1.0] - 2026-08-19
### Added
- framework Gemstack base (local-first, agent-centric).
- Antigravity-native `.agents/rules` and `.agents/skills` structure.
- Spec-Driven Development workflow templates (`specs/current`).
- Handoff and resume memory system (`handoff.md`).
- Security/CSO checklist and workflows.
- SecureDocs demo app (`demo-app/`) to test methodologies.
- Anti-IDOR smoke tests via `npm run smoke`.
- PowerShell encoding fix and robust cross-platform CLI helpers (`bin/gemstack`, `bin/gemstack.ps1`).
