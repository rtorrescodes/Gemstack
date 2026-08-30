# Contributing to Gemstack

First off, thank you for considering contributing to Gemstack! Gemstack is an open-source, local-first framework designed to supercharge AI coding agents with Spec-Driven Development (SDD) and military-grade security out of the box.

## Code of Conduct
By participating in this project, you agree to abide by our [Code of Conduct](./CODE_OF_CONDUCT.md).

## How Can I Contribute?

### Reporting Bugs
If you find a bug, please create an issue on GitHub with:
- The OS and Node.js version.
- The AI Agent you are using (e.g., Antigravity, Claude, Cursor).
- Steps to reproduce the behavior.
- Expected behavior vs actual behavior.

### Suggesting Enhancements
We love new skills and rules! If you have an idea for a new agentic capability (like our `/qa-visual` or `/swarm`), open a discussion or issue describing:
- The problem it solves.
- The proposed `SKILL.md` or `RULE.md` format.

### Pull Requests
1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed the agent skills in `template/`, make sure you run `npm run ci:all` to verify that `gemstack update` logic remains intact.
4. Ensure the test suite passes (`npm test`).
5. Issue that pull request!

## Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rtorrescodes/Gemstack.git
   cd Gemstack
   ```

2. **Install dependencies:**
   Gemstack is zero-dependencies for the end-user, but we use native Node `test` runner and some standard scripts for development.
   ```bash
   npm install
   ```

3. **Testing CLI changes locally:**
   Link the package globally to test it on your system:
   ```bash
   npm link
   ```
   Now you can run `gemstack init` in any dummy directory to test scaffolding.

4. **Running the CI suite:**
   Before committing, always run:
   ```bash
   npm run ci:all
   ```
   This will run our full suite of syntax checks, mojibake prevention, frontmatter validation, and CLI smoke tests.

## Architecture Guidelines
- **Zero-Dependency Core**: The end-user's `template/` output must never require `package.json` dependencies unless explicitly requested by the user.
- **Language Agnostic**: Agent skills must work regardless of whether the user writes in Python, Node, Go, or Rust.
- **Security First**: Any new feature must respect the `03-gemstack-security.md` rules.

Welcome to the team!
