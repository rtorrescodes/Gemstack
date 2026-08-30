<div align="center">
  <img src="https://via.placeholder.com/150x150/1a1a2e/ffffff?text=GS" alt="Gemstack Logo" width="120" height="120" />
  <h1>Gemstack</h1>
  <p><b>The Local-First Agentic Framework for Spec-Driven Development</b></p>

  [![npm version](https://img.shields.io/npm/v/gemstack.svg?style=flat-square)](https://www.npmjs.com/package/gemstack)
  [![CI Build](https://img.shields.io/github/actions/workflow/status/rtorrescodes/Gemstack/main-ci.yml?style=flat-square&branch=main)](https://github.com/rtorrescodes/Gemstack/actions)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
  [![Security Shield](https://img.shields.io/badge/Security-Military--Grade-red.svg?style=flat-square)](#military-grade-security-shield)
</div>

---

Gemstack is a zero-dependency, local-first framework designed to supercharge your AI Coding Agents (like Google Antigravity, Claude, Cursor, or Aider). 

Instead of letting AI write code blindly in a chaotic chat window, Gemstack installs a "Brain" directly into your repository. It enforces **Spec-Driven Development (SDD)**, injecting strict rules, autonomous skills, and military-grade security into the AI's context.

## ✨ Features

- 🧠 **Spec-Driven Development (SDD)**: The AI is physically prevented from hallucinating code without writing and getting approval for a `spec.md`, `plan.md`, and `tasks.md` first.
- 🛡️ **Military-Grade Security**: Includes a built-in Chief Security Officer (`gemstack-cso`) and immutable Constitution Rules that force the AI to respect OWASP, zero-trust secrets, and multi-tenant isolation.
- 🐝 **Swarm Architecture**: Tag tasks with `[P]` and invoke `/swarm` to watch the AI spawn parallel subagents to code your app simultaneously.
- 🏥 **Self-Healing CI/CD**: Run `/heal` when GitHub Actions fails. The AI will autonomously read the CI logs, write the patch, and push the fix.
- 👁️ **Visual QA Automation**: The `/qa-visual` skill instructs the agent to write and execute ephemeral Playwright scripts in an isolated sandbox to visually verify UI criteria.
- 📦 **Zero Dependencies**: Gemstack's footprint is just standard Markdown and JSON files. No heavy NPM packages polluting your production bundle.

## 🚀 Quickstart

Start a new project or upgrade an existing one in seconds:

```bash
# Initialize Gemstack in your current repository
npx gemstack init
```

This will generate the `.agents/`, `.gemstack/`, and `specs/` directories.

To ensure your framework is healthy or to check for manual tampering:
```bash
npx gemstack doctor
```

To update your project when Gemstack releases new Agent Skills:
```bash
npx gemstack update
```

## 🧠 How it Works

Gemstack works by providing an **Operating System** for your LLM via markdown files. When you chat with your agent, you use "Slash Commands" that map to specific files in your `.agents/skills/` directory.

### The SDD Workflow
1. `/specify I want to build a real-time chat app` -> The AI creates `specs/[feature]/spec.md`.
2. `/plan` -> The AI reads the spec and writes technical architecture in `plan.md`.
3. `/tasks` -> The AI breaks the plan into an actionable, parallelizable checklist.
4. **Code!** -> The AI executes the tasks.
5. `/review` -> The AI reviews the diffs against the `03-gemstack-security.md` rules.
6. `/handoff` -> The AI saves its memory to `handoff.md` so you can close your laptop and resume flawlessly tomorrow.

## 🛡️ Military-Grade Security Shield

Gemstack ships with `03-gemstack-security.md` and `04-gemstack-infrastructure.md`, rulebooks extracted from high-compliance SaaS and Cloud Native environments (OWASP, NIST). When you run `/cso` or `/review`, the AI strictly checks for:
- **AppSec (Level 2)**: IDOR Protection, Race Condition prevention, CSRF/SSRF blocking, Rate Limiting, and Audit Trails.
- **Zero Trust Secrets**: Hardcoded keys are blocked.
- **DevSecOps & Infra**: Enforces Immutable Infrastructure (Docker/Terraform), Private Subnets (VPC), IAM Least Privilege, and Cloud Secret Managers.
- **Server-Side Validation**: Complete distrust of frontend state.

## 🐝 Advanced Autonomy (The WOW Update)

Gemstack isn't just passive documents; it actively orchestrates agentic capabilities:

| Command | Action |
|---------|--------|
| `/swarm` | Orchestrates parallel subagents for tasks marked `[P]` |
| `/qa-visual` | Spawns sandbox browsers to visually assert Acceptance Criteria |
| `/heal` | Hooks into GitHub CLI (`gh`) to read failing CI logs and auto-push fixes |
| `/sandbox` | Wraps risky AI execution inside an ephemeral Docker container |

## 📚 Documentation

Dive deeper into the Gemstack architecture:
- [Spec-Driven Development](docs/spec-driven-development.md)
- [Available Skills](docs/skills.md)
- [Security Model](docs/security.md)
- [Handoff Protocol](docs/handoff.md)

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](CONTRIBUTING.md) to learn how to add new agentic skills, improve the Node CLI, or enhance the SDD Constitution.

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
