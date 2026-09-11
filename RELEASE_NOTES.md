# Gemstack Release Notes

# Gemstack v1.4.0 — Agent Swarm & Visual QA

## Highlights

### Upgrade E — Agent Swarm Planning & Validation
- **Deterministic Multi-Worker Planning**: Compiles parallelizable `tasks.md` items into deterministic, phased execution waves recorded in canonical `swarm.json`.
- **Task Ownership & Exclusive Write Boundaries**: Validates that concurrent tasks possess strictly disjoint file write partitions (`write_set(T1) ∩ write_set(T2) = ∅`), completely preventing parallel write collisions.
- **Automatic Collision Avoidance**: Automatically serializes conflicting tasks into sequential waves during planning (`SWARM_WRITE_COLLISION_PREVENTED`).
- **Separation of Duties Gate**: Non-waivable mechanical check enforcing `author != reviewer` on all task reviews (`SWARM_SELF_REVIEW_DETECTED`).
- **Task-Scoped Context Projections**: Projects minimal, structured context payloads derived from Upgrade D `context-capsule.json` with conversational narrative and raw chat transcripts strictly excluded.
- **Cryptographic Provenance & Freshness**: Pinned `source_capsule_hash` ensures workers operate against verified project state; flags drift fail-closed (`SWARM_CONTEXT_STALE`).
- **Provider & Budget Gating**: Intercepts model invocations via Upgrade C `ProviderCapabilityGate` and `BillableActionGate` to prevent runaway spending across concurrent workers.
- **Worker Limits**: Prevents recursive child agent spawning (`SWARM_RECURSIVE_SPAWN_DENIED`).
- **Explicit Invariant**: Gemstack core coordinates and validates; it does NOT execute autonomous coding agents.

### Upgrade E — Visual QA Evidence & Offline Verification
- **Canonical Visual QA Manifest (`visual-qa.json`)**: Declares explicit routes, deterministic viewports, selector masks, baseline references, and diff tolerances.
- **Deterministic Viewport Specifications**: Locks standardized viewport profiles (Desktop, Mobile, Tablet) with explicit width, height, and device scale factor.
- **Cryptographic Baseline Hashing**: Baselines are tracked and verified via canonical SHA-256 byte digests (`image_sha256`); flags disk tampering (`VQA_BASELINE_TAMPERED`).
- **Neutral & Secret Selector Masking**: Neutral masks (`[MASKED_NEUTRAL]`) eliminate font/timestamp flakiness; mandatory automatic masking replaces sensitive input fields (`type=password`) with `[MASKED_SECRET]`.
- **Structured Evidence Comparison**: Fast SHA-256 digest comparison with offline tolerance-bounded diffing (`max_diff_percentage`).
- **Explicit Baseline Promotion**: Baselines are NEVER mutated during verification; updates require explicit `gemstack vqa promote <scenario-id>`.
- **Pure Offline Verification (Stages 5.3 & 5.4)**: `gemstack verify` runs 100% offline with zero browser launches, zero network calls, and zero file mutations.
- **Explicit Invariant**: Gemstack core inspects evidence; it does NOT launch browsers or capture screenshots.

## Acceptance & Regression Baseline
- 25 Upgrade A canonical acceptance tests passing.
- 20 Upgrade B canonical acceptance tests passing.
- 20 Upgrade C canonical acceptance tests passing.
- 20 Upgrade D canonical acceptance tests passing.
- 20 Upgrade E canonical acceptance tests passing (`TEST-SWARM-A01`..`E02`, `TEST-VISUAL-A01`..`E02`).
- 10 Upgrade E bootstrap contracts passing.
- 26 Upgrade E adversarial cases passing.
- 105 total canonical acceptance tests passing.
- 126 total physical tests passing across 14 explicitly enumerated suites with 0 failures and 0 skipped.
- Full CI suite (`npm run ci:all`) passing cleanly.
- Upgrade E closed with closure status `VERIFIED`.

---

# Gemstack v1.3.0 — Cost & Provider Safety Gates + Context Capsule

## Highlights

### Upgrade C — Cost & Provider Safety Gates
- **Deterministic Provider & Capability Validation (`ProviderCapabilityGate`)**: Validates requested provider capabilities ahead of invocation and fail-closes on undeclared or unsupported capabilities without network calls.
- **Spending Authorization Barrier (`BillableActionGate`)**: Enforces the central invariant "NO PROOF = NO EXECUTION"; commercial or billable actions are strictly blocked unless accompanied by valid explicit spending tokens.
- **Auditable Cost Ledger (`cost-ledger.json`)**: Machine-readable schema establishing strict freshness dates, provider cost classifications, and zero-secrets immunity.
- **Fail-Closed Unknown Cost Policy**: Unclassified or unknown operations are never assumed free; they are treated fail-closed as commercial risks.
- **Environment Safety & CI Isolation**: Prevents accidental commercial provider calls during tests and CI builds regardless of ambient developer credentials.
- **Trusted Mock Enforcement**: Verifies in-memory mocks remain isolated and fail-closed against external network socket leaks.
- **Re-Entrant Provider Fallback**: Fallback target providers trigger independent gate re-evaluation before execution.
- **Verification Purity**: Guarantees `gemstack verify` runs strictly offline with zero provider charges and zero file mutations.

### Upgrade D — Context Capsule / Context Compression
- **Deterministic Context Compression**: Compiles authoritative specification, plan, tasks, lifecycle, and closure artifacts into compact, machine-readable continuation context (`context-capsule.json`).
- **Constraint-Lossless Compression**: 100% of normative behavioral constraints (`MUST`, `MUST NOT`), frozen architectural contracts, and acceptance criteria survive compression without semantic loss.
- **Canonical Authority Precedence**: Authoritative repository artifacts unconditionally govern over derived capsule claims (`SPEC` > `PLAN` > `TASKS` > implementation).
- **Cryptographic Provenance & Drift Detection**: Live SHA-256 source digests detect artifact modifications or tampering immediately (`STALE` / `TAMPERED`).
- **Strict Secrets Barrier**: Automated regex scanner blocks credential properties (`apiKey`, `token`, `secret`, `clientSecret`), token patterns (`sk-...`, `AIza...`, `ghp_...`), private keys, and `.env` references.
- **Deterministic Size Budgeting**: 32 KB target budget with prioritized 3-tier condensation and a 64 KB hard fail-closed limit.
- **Read-Only Verification (Stage 5.2)**: `gemstack verify` inspects context capsule freshness without modifying or rewriting disk state.
- **CLI Commands**: `gemstack context generate`, `gemstack context show`, and `gemstack context verify`.
- **Zero Runtime Dependencies**: Native Node.js standard library implementation (`node:crypto`, `node:fs`, `node:path`, `node:test`).

## Acceptance & Regression Baseline
- 25 Upgrade A canonical acceptance tests passing (`TEST-CONSISTENCY-A01` through `H02`).
- 20 Upgrade B canonical acceptance tests passing (`TEST-CLOSURE-A01` through `H01`).
- 20 Upgrade C canonical acceptance tests passing (`TEST-COST-A01` through `H01`).
- 20 Upgrade D canonical acceptance tests passing (`TEST-CONTEXT-A01` through `H01`).
- 85 total canonical acceptance tests passing.
- 100 total physical tests passing across 25 explicitly enumerated suites.
- Full CI suite (`npm run ci:all`) passing with 0 warnings and 0 errors.
- Both Upgrade C and Upgrade D closed with closure status `VERIFIED`.

---

# Gemstack v1.2.0 — Mechanical Test Matrix & Closure Evidence

## Highlights
- **Mechanical Test Matrix & Closure Verification (Upgrade B)**: Eliminates false closure and test discovery hallucinations by introducing a deterministic verification pipeline from specification to shipment.
- **Canonical Test Matrix (`gemstack-test-matrix`)**: Explicit acceptance criteria defined in `spec.md` with deterministic `acceptanceSignature` (SHA-256) ensuring acceptance rules are immutable once approved.
- **Task ↔ Test Traceability**: Explicit bidirectional binding between implementation tasks in `tasks.md` and canonical acceptance tests.
- **Safe Zero-Shell Runners**: Pure Node.js `node:test` TAP runner adapter with suite container exclusion (`kind: 'SUITE'` vs `kind: 'TEST'`), ensuring TAP headers/containers are never counted as physical tests.
- **Exact Canonical Reconciliation Arithmetic**: Mechanical validation proving `canonical_required = canonical_passed + missing` and `physical_executed = canonical_executed + supporting_executed` with zero tolerance for phantoms or orphans.
- **Mutating Collector (`gemstack collect`)**: Executes bound test suites and required `PACKAGE_SCRIPT` gates to produce `specs/<feature>/closure.json`.
- **Dynamic Closure Context Freshness (`closureContextHash`)**: Cryptographically binds closure evidence to repository state (clean git, dirty git, or non-git), phase hashes, bound test files, and bounded implementation source files.
- **Read-Only Verification Pipeline (`gemstack verify`)**: Stage 5/6 inspects closure freshness and gate outcomes in memory with 0 disk mutations.
- **Ship Gatekeeper (`gemstack ship`)**: Strict gate requiring `status: "VERIFIED"` in `closure.json` before transitioning feature lifecycle to `SHIPPED`.
- **Progressive LEGACY Mode**: Full backward compatibility for features without test matrices or contract blocks.
- **Zero-Dependency Architecture**: 100% native Node.js standard library implementation with zero third-party production dependencies.

## Acceptance & Regression Baseline
- 25 Upgrade A canonical acceptance tests passing (`TEST-CONSISTENCY-A01` through `H02`).
- 20 Upgrade B canonical acceptance tests passing (`TEST-CLOSURE-A01` through `H01`).
- 45 total canonical acceptance tests passing.
- 53 total physical tests passing with 0 regressions.
- 11 physical test suites explicitly enumerated for cross-platform reliability.

---

# Gemstack v1.1.2 — Architecture Consistency & Phase Freezing

## Recovery Release Note
v1.1.2 is the release-recovery patch for Upgrade A. v1.1.1 resolved cross-platform test discovery, exposing a host-dependent path canonicalization defect in `TEST-CONSISTENCY-G01` when simulating Windows paths on Linux runners. v1.1.2 fixes that canonicalization using explicit path-flavor-aware Node.js path semantics (`path.win32` vs `path.posix`). No product architecture, contract semantics, or canonical P1 criteria were altered.

## Highlights
- **Architecture Consistency Engine**: Mechanically prevents AI models from hallucinating or introducing silent architectural contradictions downstream through 6 canonical contract types (`ENUM_SET`, `IDENTITY_TUPLE`, `PROVENANCE_RULE`, `BOOLEAN_INVARIANT`, `BOUNDARY`, `ROADMAP_LIMIT`).
- **Cryptographic Phase Freezing**: SHA-256 canonical hashing of phase artifacts (`spec.md`, `plan.md`, `tasks.md`) with automatic mutation detection (`FROZEN_ARTIFACT_CHANGED`).
- **Deterministic-First Validation**: Automated cross-phase inheritance (`SPEC` -> `PLAN` -> `TASKS`) resolving contradictions before human review.
- **Canonical Finding Fingerprints**: Full 64-character lowercase SHA-256 digests with anti-loop lifecycle management (`OPEN`, `RESOLVED`, `ACCEPTED_EXCEPTION`, `SUPERSEDED`).
- **Accepted Exceptions Bound to Context**: Exceptions require cryptographic `contextHash` binding; any change to compared artifacts or contracts invalidates suppression.
- **Progressive LEGACY Mode**: Features without contracts continue without disruption or breaking changes.
- **Zero-Dependency Core**: Pure Node.js standard library implementation (`node:crypto`, `node:fs`, `node:path`, `node:test`).

## Compatibility
- 100% backward compatible with existing Gemstack repositories.
- Zero external runtime dependencies added.

## Validation
- 17/17 Upgrade A implementation tasks complete.
- 25/25 canonical P1 acceptance tests passing.
- 33/33 physical test suite passing.
- `npm test` exit code 0.
- `gemstack verify` exit code 0 with 0 open blockers.
- Self-dogfooded on `specs/006-architecture-consistency-engine/`.

## Upgrade Notes
- Run `npx gemstack-ai update` to pull the latest agent skills and templates into your existing project.

---

# Gemstack v1.1.1 — Architecture Consistency & Phase Freezing

## Recovery Release Note
v1.1.1 is the publishable recovery release for Upgrade A. The original v1.1.0 tag completed development and closure, but its release CI workflow stopped prior to npm publication because the test command relied on shell-dependent recursive glob resolution on Linux runners. In v1.1.1, test execution is made strictly portable across all operating systems. No product architecture or contract semantics changed.

## Highlights
- **Architecture Consistency Engine**: Mechanically prevents AI models from hallucinating or introducing silent architectural contradictions downstream through 6 canonical contract types (`ENUM_SET`, `IDENTITY_TUPLE`, `PROVENANCE_RULE`, `BOOLEAN_INVARIANT`, `BOUNDARY`, `ROADMAP_LIMIT`).
- **Cryptographic Phase Freezing**: SHA-256 canonical hashing of phase artifacts (`spec.md`, `plan.md`, `tasks.md`) with automatic mutation detection (`FROZEN_ARTIFACT_CHANGED`).
- **Deterministic-First Validation**: Automated cross-phase inheritance (`SPEC` -> `PLAN` -> `TASKS`) resolving contradictions before human review.
- **Canonical Finding Fingerprints**: Full 64-character lowercase SHA-256 digests with anti-loop lifecycle management (`OPEN`, `RESOLVED`, `ACCEPTED_EXCEPTION`, `SUPERSEDED`).
- **Accepted Exceptions Bound to Context**: Exceptions require cryptographic `contextHash` binding; any change to compared artifacts or contracts invalidates suppression.
- **Progressive LEGACY Mode**: Features without contracts continue without disruption or breaking changes.
- **Zero-Dependency Core**: Pure Node.js standard library implementation (`node:crypto`, `node:fs`, `node:path`, `node:test`).

## Compatibility
- 100% backward compatible with existing Gemstack repositories.
- Zero external runtime dependencies added.

## Validation
- 17/17 Upgrade A implementation tasks complete.
- 25/25 canonical P1 acceptance tests passing.
- 33/33 physical test suite passing.
- `npm test` exit code 0.
- `gemstack verify` exit code 0 with 0 open blockers.
- Self-dogfooded on `specs/006-architecture-consistency-engine/`.

## Upgrade Notes
- Run `npx gemstack-ai update` to pull the latest agent skills and templates into your existing project.

---

# Gemstack v1.1.0 — Architecture Consistency & Phase Freezing

## Highlights
- **Architecture Consistency Engine**: Mechanically prevents AI models from hallucinating or introducing silent architectural contradictions downstream through 6 canonical contract types (`ENUM_SET`, `IDENTITY_TUPLE`, `PROVENANCE_RULE`, `BOOLEAN_INVARIANT`, `BOUNDARY`, `ROADMAP_LIMIT`).
- **Cryptographic Phase Freezing**: SHA-256 canonical hashing of phase artifacts (`spec.md`, `plan.md`, `tasks.md`) with automatic mutation detection (`FROZEN_ARTIFACT_CHANGED`).
- **Deterministic-First Validation**: Automated cross-phase inheritance (`SPEC` -> `PLAN` -> `TASKS`) resolving contradictions before human review.
- **Canonical Finding Fingerprints**: Full 64-character lowercase SHA-256 digests with anti-loop lifecycle management (`OPEN`, `RESOLVED`, `ACCEPTED_EXCEPTION`, `SUPERSEDED`).
- **Accepted Exceptions Bound to Context**: Exceptions require cryptographic `contextHash` binding; any change to compared artifacts or contracts invalidates suppression.
- **Progressive LEGACY Mode**: Features without contracts continue without disruption or breaking changes.
- **Zero-Dependency Core**: Pure Node.js standard library implementation (`node:crypto`, `node:fs`, `node:path`, `node:test`).

## Compatibility
- 100% backward compatible with existing Gemstack repositories.
- Zero external runtime dependencies added.

## Validation
- 17/17 Upgrade A implementation tasks complete.
- 25/25 canonical P1 acceptance tests passing.
- 33/33 physical test suite passing.
- `npm test` exit code 0.
- `gemstack verify` exit code 0 with 0 open blockers.
- Self-dogfooded on `specs/006-architecture-consistency-engine/`.

## Upgrade Notes
- Run `npx gemstack-ai update` to pull the latest agent skills and templates into your existing project.

---

# Gemstack v1.0.2

## Highlights
- **Zero Silent Failures**: Actualización al Article III de la Constitución prohibiendo `2>nul` y operadores de supresión de fallos en scripts de testing multiplataforma.
- **Intent-Based Routing**: Detección semántica de intenciones en lenguaje natural en `01-gemstack-core.md`, auto-activando `gemstack-spec`, `gemstack-qa`, `gemstack-investigate` y `gemstack-handoff` sin requerir estrictamente `/comando`.
- **Auto State Sync**: Sincronización automática de `.gemstack/state.json` en `gemstack-spec`, `gemstack-ship` y `gemstack-handoff` con control de ciclo de vida (`current_phase`, `active_spec`, `last_completed_feature`).
- **Unified Health & Security Auditor (`gemstack verify`)**: Nuevo comando CLI y script `pnpm/npm run gemstack:verify` para validar en un solo paso archivos base, integridad de memoria (5 secciones de `handoff.md`), estado local y seguridad de scripts.

## Validation
- `npm test`: 8 tests unitarios pasando al 100%.
- `npm run gemstack:verify`: Éxito total.
- CI Scripts: frontmatter, template clean, mojibake, package contents y smoke CLI validados.

---

# Gemstack v0.3.0

## Highlights
- GitHub Actions CI
- PR CI on Ubuntu with Node 18/20
- Main CI cross-platform matrix on Ubuntu, Windows, macOS with Node 18/20
- Manual release-readiness workflow
- Zero-dependency CI scripts under scripts/ci/
- Frontmatter validation
- Template cleanliness validation
- Mojibake detection
- Package content validation
- CLI smoke tests
- SecureDocs smoke tests
- Artifact generation for npm tarball
- No npm publish automation

## Validation
- `npm test`: PASS
- `npm run ci:all`: PASS
- `npm run ci:demo`: PASS
- `npm run pack:dry`: PASS
- `main-ci` result: SUCCESS (expected)
- `release-readiness` result: SUCCESS (expected)
- artifact generated: `gemstack-npm-tarball`

## Safety
- no npm publish
- no automatic GitHub Release
- no automatic tag creation by workflow
- no secrets printed in logs
- package contents checked
- template cleanliness checked

## Known limitations
- npm publish still manual/future
- GitHub Release still manual/future
- CI scripts are custom zero-deps, not full linters
- release artifact downloads from GitHub UI may be zipped by GitHub

## Next
- v0.4 or future: npm publish planning
- GitHub Release automation planning
- better update diff UX
- deeper symlink/path tests
- optional browser QA automation

---

# Gemstack v0.2.0

## Highlights
- **Zero-dependency Node CLI**: `gemstack init` and `gemstack update` for easy local-first scaffolding.
- **Installable Scaffold**: Separation of codebase in `src/` and cleanly replicable agents/skills in `template/`.
- **Manifest & Safety**: Idempotent installation managed via `.gemstack/manifest.json` ensuring no overwritten custom files.
- **Backups System**: Mandatory automatic rollback copy placed in `.gemstack/backups/<timestamp>/` when force updating Gemstack-owned files.
- **Cryptography Checksums**: Used `crypto` module (SHA-256) to ensure template vs user-drift.
- **Path Traversal Guard**: Deep node.js native hardening mapping absolute resolution strings `path.relative()` blocking malicious escalations.
- **Node:Test**: Comprehensive local `node:test` suite for the `cli.js` installer without needing Jest or third party supply-chain vectors.
- **Tested Packaging**: Verified local compatibility via `npm link` and `npm pack`.

## Safety
- No destructive overwrite by default.
- No `stdin` blocking prompts in `v0.2.0` (fail-fast with `--yes` suggestion).
- No `npm publish` executed yet.
- Backups execute silently before replacement (no leaking secrets to stdout).
- `handoff.md` and user files are strictly skipped.

## Validation
- `npm test` 100% passes native tests.
- `npm run pack:dry` generated correct package structure strictly ignoring temporary dumps.
- `npm link` tested efficiently.
- `npm pack` (tarball) fully tested inside isolated dummy-project folder via `npx gemstack init --dry-run`.

## Known limitations
- Not published to npm yet.
- No GitHub Actions yet.
- Update conflict UX can be improved to feature rich diffs.
- Symlink hardening may need more tests in v0.3.
- Browser QA still manual/documented.

---

# Gemstack v0.1.0
- Antigravity-native `.agents/rules` and `.agents/skills` structure
- Spec-Driven Development workflow
- Handoff memory system
- Security/CSO checklist
- SecureDocs demo app
- Anti-IDOR smoke tests
- PowerShell and Unix/Git Bash CLI helpers

## Included Skills
- gemstack-handoff
- gemstack-resume
- gemstack-office-hours
- gemstack-spec
- gemstack-plan
- gemstack-tasks
- gemstack-review
- gemstack-investigate
- gemstack-qa
- gemstack-ship
- gemstack-cso
- gemstack-learn
- gemstack-guard

## Demo
SecureDocs is included in `demo-app/` to validate the framework. Features:
- Express + SQLite + Vanilla JS
- CRUD de documentos
- `X-Mock-User-Id` como mock auth
- smoke tests anti-IDOR automáticos
- `npm run smoke`

## How to try
**PowerShell:**
```powershell
.\bin\gemstack-doctor.ps1
.\bin\gemstack.ps1 list
cd demo-app
npm install
npm run smoke
```

**Unix/Git Bash:**
```bash
./bin/gemstack-doctor
./bin/gemstack list
cd demo-app
npm install
npm run smoke
```

## Known limitations
- No npm package yet
- Mock auth only in demo
- No full automated routing tests yet
- Browser QA is documented but not fully automated
- No GitHub Actions yet

## Next
- v0.2 specs
- installer/package distribution
- GitHub Actions
- more robust QA/browser automation
- richer security checks
