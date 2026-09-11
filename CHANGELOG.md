# Changelog

All notable changes to this project will be documented in this file.

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
