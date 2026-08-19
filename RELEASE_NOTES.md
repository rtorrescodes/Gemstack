# Gemstack v0.1.0

## Highlights
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
