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
