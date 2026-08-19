# Gemstack

**Gemstack** is a local-first, agent-centric software delivery framework for **Google Antigravity** and **Gemini Pro**.

It turns your AI coding environment into a structured product and engineering workflow with reusable roles, safety guardrails, spec-driven planning, practical security review, QA, release discipline, and clean handoffs between sessions.

Gemstack is conceptually inspired by the workflow philosophy of `gstack`, but it is **not a Claude Code port** and does not depend on `.claude/`, `CLAUDE.md`, or Claude-specific runtime behavior. It is built around Antigravity’s `.agents/rules/` and `.agents/skills/` model, with portable fallbacks through `.gemstack/`, `specs/`, `docs/`, and CLI scripts.

---

## Why Gemstack exists

AI coding assistants are powerful, but raw prompting often leads to messy outcomes:

- vague requirements,
- weak planning,
- repeated mistakes across sessions,
- unsafe changes,
- skipped security checks,
- untested UI flows,
- poor release discipline,
- and context decay over time.

Gemstack solves this by giving your agent a repeatable operating system:

```text
Office Hours → Specify → Plan → Tasks → Build → Review → Security → QA → Ship → Handoff
```

The goal is simple:

Make Gemini/Antigravity work more like a disciplined product engineering team, not just a code generator.

## Core workflow

Gemstack uses pseudo-commands that Antigravity routes through `.agents/rules/01-gemstack-core.md` into progressive skills stored in `.agents/skills/`.

Typical flow:

```text
/office-hours
/specify
/plan
/tasks
/review
/cso
/qa
/ship
/handoff
```

Recommended project lifecycle:

1. Clarify the idea with `/office-hours`
2. Write the spec with `/specify`
3. Create the technical plan with `/plan`
4. Break work into tasks with `/tasks`
5. Implement carefully
6. Review the diff with `/review`
7. Run security checks with `/cso` or `/security-audit`
8. QA with browser or manual flow using `/qa`
9. Prepare release with `/ship`
10. Close cleanly with `/handoff`

## Features

### Antigravity-native agent structure
Gemstack uses Antigravity’s local agent discovery model:

```text
.agents/
  rules/
    01-gemstack-core.md
  skills/
    gemstack-handoff/
    gemstack-resume/
    gemstack-office-hours/
    gemstack-spec/
    gemstack-plan/
    gemstack-tasks/
    gemstack-review/
    gemstack-investigate/
    gemstack-qa/
    gemstack-ship/
    gemstack-cso/
    gemstack-learn/
    gemstack-guard/
```
Each skill uses YAML frontmatter for progressive disclosure.

### Spec-Driven Development
Gemstack separates the what from the how:

```text
specs/current/spec.md
specs/current/plan.md
specs/current/tasks.md
```
This keeps the agent from jumping into implementation before the product intent, acceptance criteria, risks, and task sequence are clear.

### Handoff memory
Every session should end with:

```text
/handoff
```
This updates:

```text
handoff.md
```
with exactly five sections:

```text
# Handoff

## 1. Objetivo

## 2. Estado actual

## 3. Archivos y cambios

## 4. Intentos fallidos

## 5. Próximos pasos
```
The most important rule:

**Never delete the “Intentos fallidos” section.**

If it grows too large, old entries are moved non-destructively to:

```text
handoff_archive.md
```
This prevents future sessions from repeating known failed attempts.

### Clean session resume
When starting a new Antigravity session, use:

```text
Lee handoff.md y continúa desde los próximos pasos.
```
Or invoke:

```text
/resume
```
Gemstack will read the handoff, preserve context, avoid repeated mistakes, and continue from the next steps without dragging old conversation noise into the session.

### Security workflow
Gemstack includes a practical application-security checklist through:

```text
/cso
/security-audit
/security-idor
/security-api
/security-deps
/security-uploads
/security-sql
/security-sessions
/security-webhooks
/security-headers
```

Security modules cover:

| Module | Purpose |
|---|---|
| IDOR | Prevent users from accessing resources they do not own |
| API restrictions | Auth, authorization, CORS, and rate limiting |
| Dependencies | Audit vulnerable or outdated packages |
| Uploads | Validate file type, size, storage, and execution risk |
| SQL injection | Replace unsafe query construction with safe parameters |
| Sessions | Avoid unsafe token storage and prefer secure cookies where viable |
| Webhooks | Validate payment-provider signatures before processing |
| Headers/XSS | Add baseline security headers and avoid unsafe user-content rendering |

Findings are classified by severity:
`Critical`, `High`, `Medium`, `Low`, `Informational`

And by action state:
`Fixed`, `Needs approval`, `Manual review required`, `Not applicable`

### Guardrails
Gemstack is designed to be conservative by default.
It should not:
- run destructive commands without approval,
- push, merge, deploy, or publish without approval,
- change auth architecture without approval,
- run destructive migrations without approval,
- delete handoff history,
- install global dependencies without approval,
- or silently ignore failed checks.

Guardrail commands:

```text
/careful
/freeze
/guard
/unfreeze
```
State is stored in:
`.gemstack/state.json`

## Installed skills

| Command | Skill | Purpose |
|---|---|---|
| `/handoff` | gemstack-handoff | Close the session with a clean handoff |
| `/resume` | gemstack-resume | Continue from handoff.md |
| `/office-hours` | gemstack-office-hours | Validate idea, user, pain, wedge, and MVP |
| `/specify` | gemstack-spec | Create specs/current/spec.md |
| `/plan` | gemstack-plan | Create specs/current/plan.md |
| `/tasks` | gemstack-tasks | Create specs/current/tasks.md |
| `/review` | gemstack-review | Review current diff like a staff engineer |
| `/investigate` | gemstack-investigate | Debug with “no fixes before investigation” |
| `/qa` | gemstack-qa | QA with browser or manual flow |
| `/qa-only` | gemstack-qa | Report QA issues without applying fixes |
| `/ship` | gemstack-ship | Prepare release checklist and PR summary |
| `/cso` | gemstack-cso | Run security review |
| `/security-audit` | gemstack-cso | Run full security audit |
| `/security-idor` | gemstack-cso | Check access control and ownership |
| `/security-api` | gemstack-cso | Check auth, CORS, and rate limiting |
| `/security-deps` | gemstack-cso | Check vulnerable dependencies |
| `/security-uploads` | gemstack-cso | Check file upload safety |
| `/security-sql` | gemstack-cso | Check SQL injection risks |
| `/security-sessions` | gemstack-cso | Check token/session handling |
| `/security-webhooks` | gemstack-cso | Check payment webhook verification |
| `/security-headers` | gemstack-cso | Check headers and XSS basics |
| `/learn` | gemstack-learn | Store local project learnings |
| `/careful` | gemstack-guard | Warn before risky commands |
| `/freeze` | gemstack-guard | Restrict edits to approved paths |
| `/guard` | gemstack-guard | Enable careful + freeze |
| `/unfreeze` | gemstack-guard | Remove path restrictions |

## Directory structure

```text
.
├── .agents/
│   ├── rules/
│   │   └── 01-gemstack-core.md
│   └── skills/
│       ├── gemstack-cso/
│       ├── gemstack-guard/
│       ├── gemstack-handoff/
│       ├── gemstack-investigate/
│       ├── gemstack-learn/
│       ├── gemstack-office-hours/
│       ├── gemstack-plan/
│       ├── gemstack-qa/
│       ├── gemstack-resume/
│       ├── gemstack-review/
│       ├── gemstack-ship/
│       ├── gemstack-spec/
│       └── gemstack-tasks/
├── .gemstack/
│   ├── learnings.md
│   └── state.json
├── bin/
│   ├── gemstack
│   ├── gemstack-doctor
│   ├── gemstack.ps1
│   └── gemstack-doctor.ps1
├── docs/
│   ├── antigravity.md
│   ├── handoff.md
│   ├── qa-browser.md
│   ├── quickstart.md
│   ├── release.md
│   ├── security.md
│   ├── skills.md
│   └── spec-driven-development.md
├── specs/
│   ├── current/
│   │   ├── plan.md
│   │   ├── spec.md
│   │   └── tasks.md
│   ├── templates/
│   │   ├── plan.md
│   │   ├── spec.md
│   │   └── tasks.md
│   └── README.md
├── handoff.md
├── handoff_archive.md
├── CHANGELOG.md
├── LICENSE
└── README.md
```

## Quickstart

### 1. Clone or copy Gemstack into a project
Gemstack v0.1 is currently local-first. Use the included files inside your project or adapt them into your Antigravity workspace.

### 2. Run doctor

**PowerShell:**
```powershell
.\bin\gemstack-doctor.ps1
```
If PowerShell blocks script execution:
```powershell
powershell -ExecutionPolicy Bypass -File .\bin\gemstack-doctor.ps1
```

**Unix, macOS, Linux, Git Bash, or WSL:**
```bash
./bin/gemstack-doctor
```
If needed:
```bash
chmod +x bin/gemstack bin/gemstack-doctor
```

### 3. List installed skills

**PowerShell:**
```powershell
.\bin\gemstack.ps1 list
```

**Unix/Git Bash:**
```bash
./bin/gemstack list
```

### 4. Show a skill

**PowerShell:**
```powershell
.\bin\gemstack.ps1 show gemstack-handoff
```

**Unix/Git Bash:**
```bash
./bin/gemstack show gemstack-handoff
```

### 5. Start using Gemstack in Antigravity
In Antigravity, try:
```text
/office-hours I want to build a small app to test Gemstack.
```
Then continue:
```text
/specify
/plan
/tasks
```
Before ending:
```text
/handoff
```
Next session:
```text
Lee handoff.md y continúa desde los próximos pasos.
```

## CLI commands
Gemstack includes lightweight CLI helpers.

**PowerShell:**
```powershell
.\bin\gemstack.ps1 list
.\bin\gemstack.ps1 show gemstack-cso
.\bin\gemstack.ps1 doctor
.\bin\gemstack.ps1 handoff
.\bin\gemstack.ps1 security-audit
```

**Unix/Git Bash:**
```bash
./bin/gemstack list
./bin/gemstack show gemstack-cso
./bin/gemstack doctor
./bin/gemstack handoff
./bin/gemstack security-audit
```
The CLI is intentionally simple in v0.1. If a command does not execute a full agent workflow directly, it prints the relevant skill instructions so you can use them inside Antigravity.

## Working with specs
Gemstack keeps the active feature spec here:
```text
specs/current/spec.md
specs/current/plan.md
specs/current/tasks.md
```
Recommended flow:
```text
/specify Build a minimal demo app that proves Gemstack works.
/plan
/tasks
```
Do not start implementation until the spec, plan, and tasks are clear.

## Working with security
Run the general security review:
```text
/cso
```
Or a specific module:
```text
/security-idor
/security-api
/security-deps
/security-uploads
/security-sql
/security-sessions
/security-webhooks
/security-headers
```
Security outputs should go to:
```text
docs/security/latest-security-audit.md
```
Gemstack should only auto-fix when the project’s pattern is clear and the change is safe. Otherwise, it must produce a plan and ask for approval.

## Working with QA
Use:
```text
/qa
```
or:
```text
/qa-only
```
If a URL is available, Gemstack should use Antigravity’s native browser capability:
```text
/browser
```
or a Playwright-based flow if configured.

QA reports should go to:
```text
docs/qa/latest-qa.md
```

## Release workflow
Use:
```text
/ship
```
Gemstack should check:
- git status
- tests
- lint/typecheck if available
- docs updates
- specs updates
- security review
- QA status
- PR summary

Gemstack must not push, merge, deploy, or publish without explicit approval.

## Windows and PowerShell
Gemstack includes PowerShell-compatible scripts:
```text
bin/gemstack.ps1
bin/gemstack-doctor.ps1
```
Recommended Windows checks:
```powershell
.\bin\gemstack-doctor.ps1
.\bin\gemstack.ps1 list
.\bin\gemstack.ps1 show gemstack-handoff
```
If script execution is blocked:
```powershell
powershell -ExecutionPolicy Bypass -File .\bin\gemstack-doctor.ps1
```
Do not change global PowerShell execution policy unless you understand the security impact.

## Unix, macOS, Linux, Git Bash, and WSL
Gemstack also includes shell scripts:
```text
bin/gemstack
bin/gemstack-doctor
```
Recommended checks:
```bash
./bin/gemstack-doctor
./bin/gemstack list
./bin/gemstack show gemstack-handoff
```
If needed:
```bash
chmod +x bin/gemstack bin/gemstack-doctor
```

## Local memory
Project memory lives in:
```text
.gemstack/learnings.md
```
Use:
```text
/learn
```
to add, list, search, or mark learnings as obsolete.

State lives in:
```text
.gemstack/state.json
```
This stores guard mode, freeze paths, and session metadata.

## Philosophy
Gemstack follows these principles:

- **Local-first** Your project owns its rules, skills, specs, and handoffs.
- **Spec before build** Do not let the agent code before it understands what it is building.
- **Safety over speed** Destructive actions require explicit approval.
- **Security is part of the workflow** Security is not an afterthought before deploy.
- **Clean context beats long context** Use handoff.md instead of dragging stale chat history forever.
- **Failed attempts are valuable** Keep track of what did not work so the agent does not repeat loops.
- **Portable by design** Antigravity is the primary environment, but the structure remains readable and reusable.

## Current status
Gemstack v0.1 includes:
- Antigravity rules
- Antigravity skills
- Spec-Driven Development workflow
- handoff memory
- security audit skills
- QA and release workflows
- guardrails
- local learnings
- PowerShell scripts
- Unix/Git Bash scripts
- documentation

Planned for v0.2:
- automated tests for routing and CLI
- stronger PowerShell/Unix parity tests
- richer browser QA examples
- demo app workflow
- optional package distribution
- better archive management for long handoffs
- deeper static-analysis integrations

## License
MIT.
