# Changelog

All notable changes to this project will be documented in this file.

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
