# Gemstack Release Notes

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
