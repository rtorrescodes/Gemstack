# Changelog

All notable changes to this project will be documented in this file.

## [v0.3.0] - Unreleased
### Added
- GitHub Actions CI/CD workflows (`pr-ci.yml`, `main-ci.yml`, `release-readiness.yml`).
- Zero-dependency Node.js CI scripts (`check-frontmatter.js`, `check-template-clean.js`, `check-mojibake.js`, `check-package-contents.js`, `smoke-cli.js`).
- Strict repository hygiene validation ensuring `template/` cleanliness before any release.
- Tarball artifact generation workflow for manual validation.

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
