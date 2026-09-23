# Especificación de Funcionalidad: Gemstack 2.0 Hardening (Sprint A)

**Feature Branch**: `011-gemstack-2.0-hardening`  
**Feature Directory**: `specs/011-gemstack-2.0-hardening/`  
**Lifecycle Status**: `SPEC_COMPLETE`  
**Stop Reason**: `SPEC_COMPLETE_AWAITING_PLAN`

---

## 1. Problem Statement

Gemstack v1.4.0 establishes declarative Spec-Driven Development, phase contracts, closure evidence, provider safety gates, context capsules, and visual QA manifests. However, a security and reliability audit of the v1.4.0 codebase reveals three critical trust boundary vulnerabilities:

1. **Unbounded Remote Skill Fetching (`src/commands/install.js`)**:
   - `fetch(url)` accepts arbitrary origins including cleartext HTTP, localhost, and private intranet IPs (SSRF).
   - No network timeouts or byte limits exist, creating vulnerability to unbounded streaming or memory exhaustion.
   - Skill names are not strictly validated as canonical slugs, creating path traversal risks.
   - Remote code is downloaded and written without content pre-inspection or cryptographic fingerprint display.

2. **Filesystem Traversal via Symlink Resolution (`src/lib/filesystem-safe.js`)**:
   - Current path safety checks rely solely on lexical path containment (`path.relative`).
   - If an existing or intermediate directory component is a symbolic link pointing outside the repository tree, writes or reads escape project boundaries.
   - Atomic writes using OS temporary directories can cross filesystem mount points and risk symlink attacks.

3. **Destructive Git Hook Replacement & Narrow Secret Detection (`src/commands/hooks.js`)**:
   - `gemstack hooks` unconditionally overwrites `.git/hooks/pre-commit`, silently destroying existing user hooks (Husky, linters, formatters).
   - Secret scanning covers only 3 basic patterns, completely ignoring modern AI API keys (Google Gemini, OpenAI, Anthropic), GitHub PATs, Slack tokens, and private SSH/RSA keys.
   - CI does not enforce zero-secrets validation on the codebase.

Gemstack 2.0 Sprint A implements mechanical, fail-closed trust boundaries for remote skill installation, filesystem containment with realpath resolution, safe git hook chaining, and comprehensive multi-provider secret detection.

---

## 2. Goals & Non-Goals

### Goals
- **Strict HTTPS & SSRF Defense**: Enforce HTTPS for remote skill installation. Block all loopback, link-local, and RFC 1918 private IP addresses.
- **Bounded Remote Downloads**: Enforce maximum payload size (256 KB) and strict network timeout (8000ms).
- **Canonical Skill Slugs**: Enforce strict alphanumeric regex on skill names (`^[a-z0-9][a-z0-9-_]{1,63}$`).
- **Cryptographic Preview**: Compute SHA-256 fingerprint and validate frontmatter before disk persistence.
- **Physical Filesystem Containment**: Implement `resolveSafeStrict` using canonical `realpathSync` to reject symlinks escaping repository root.
- **Confined Atomic Writes**: Stage temporary writes within `.gemstack/tmp/` inside project boundaries.
- **Git Hook Preservation & Chaining**: Detect existing `.git/hooks/pre-commit` scripts and chain execution without clobbering.
- **Comprehensive Secret Detection**: Detect Google Gemini, OpenAI, Anthropic, GitHub PAT, Slack tokens, and private keys in both git hooks and CI.
- **Zero Runtime Dependencies**: Implement all hardening using pure Node.js standard library.

### Non-Goals
- Gemstack does NOT implement an arbitrary remote package manager or NPM registry substitute.
- Gemstack does NOT resolve external symlinks outside the repository root.
- Gemstack does NOT replace dedicated enterprise SAST scanning tools; it enforces local-first pre-commit and CI hygiene.

---

## 3. Core Architectural Principles & Invariants

```text
remote input ≠ trusted code
lexical containment ≠ physical containment
symlink escape = security violation
install skill ≠ execute code
preserve user hooks > overwrite user hooks
credentials in repo = immediate blocker
zero runtime dependencies = permanent invariant
```

---

## 4. Base Architectural Contracts

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "https-only-skills",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "allowed-skill-schemes",
    "type": "ENUM_SET",
    "values": [
      "https"
    ]
  },
  {
    "id": "skill-max-payload-bytes",
    "type": "ROADMAP_LIMIT",
    "value": 262144
  },
  {
    "id": "skill-slug-identity",
    "type": "IDENTITY_TUPLE",
    "values": [
      "namespace",
      "slug"
    ]
  },
  {
    "id": "symlink-out-of-bounds",
    "type": "BOUNDARY",
    "value": "FORBIDDEN"
  },
  {
    "id": "existing-hook-destruction",
    "type": "BOUNDARY",
    "value": "FORBIDDEN"
  },
  {
    "id": "secret-scanning-ci",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "atomic-writes-confined",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  }
]
```

---

## 5. Canonical Acceptance Requirements

### Group A: Remote Skills Installation Hardening
- **TEST-HARDEN-A01**: Rejects non-HTTPS remote URLs by default with `INSECURE_HTTP_BLOCKED`.
- **TEST-HARDEN-A02**: Rejects private and loopback IP addresses (127.0.0.1, localhost, 10.x, 192.168.x, 172.16-31.x, 169.254.x) with `PRIVATE_IP_BLOCKED`.
- **TEST-HARDEN-A03**: Rejects payload exceeding 256 KB with `SKILL_PAYLOAD_TOO_LARGE`.
- **TEST-HARDEN-A04**: Rejects invalid skill names (path traversal, separators, symbols) with `INVALID_SKILL_SLUG`.
- **TEST-HARDEN-A05**: Computes SHA-256 fingerprint before writing and validates frontmatter integrity.

### Group B: Filesystem Containment & Realpath Hardening
- **TEST-HARDEN-B01**: `resolveSafeStrict` detects and blocks symlinks pointing outside the repository root (`SYMLINK_ESCAPE_DETECTED`).
- **TEST-HARDEN-B02**: `resolveSafeStrict` detects and blocks intermediate symlink path traversal escaping repository root.
- **TEST-HARDEN-B03**: Confines atomic file staging writes within `.gemstack/tmp/` inside project boundaries.
- **TEST-HARDEN-B04**: Verifies all critical CLI call sites (init, update, install, backup, vqa) enforce containment with zero out-of-boundary mutations.

### Group C: Git Hooks Preservation & Secret Detection
- **TEST-HARDEN-C01**: `gemstack hooks` detects pre-existing user hooks and preserves them via executable delegation/chaining without data loss.
- **TEST-HARDEN-C02**: Detects Google AI / Gemini API keys (`AIza[0-9A-Za-z-_]{35}`).
- **TEST-HARDEN-C03**: Detects OpenAI and Anthropic API keys (`sk-[a-zA-Z0-9]{20,}`, `sk-ant-`).
- **TEST-HARDEN-C04**: Detects GitHub PATs and Slack tokens (`ghp_`, `github_pat_`, `xox[baprs]-`).
- **TEST-HARDEN-C05**: Detects private RSA/EC/OPENSSH keys (`-----BEGIN [A-Z ]*PRIVATE KEY-----`).
- **TEST-HARDEN-C06**: Integrates zero-dependency secret scanner script `scripts/ci/check-secrets.js` into `ci:all` to verify repository cleanliness.

---

## 6. Canonical Test Matrix

```gemstack-test-matrix
[
  {
    "id": "TEST-HARDEN-A01",
    "category": "REMOTE_SKILLS",
    "layer": "UNIT",
    "description": "Rejects non-HTTPS remote URLs by default with INSECURE_HTTP_BLOCKED",
    "pass_criteria": "Throws or returns error with code INSECURE_HTTP_BLOCKED when URL protocol is http:",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-A02",
    "category": "REMOTE_SKILLS",
    "layer": "UNIT",
    "description": "Rejects private and loopback IP addresses (SSRF defense) with PRIVATE_IP_BLOCKED",
    "pass_criteria": "Blocks connections to loopback (127.0.0.1, ::1, localhost), link-local (169.254.x), and private RFC1918 subnets",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-A03",
    "category": "REMOTE_SKILLS",
    "layer": "UNIT",
    "description": "Rejects payload exceeding 256 KB with SKILL_PAYLOAD_TOO_LARGE",
    "pass_criteria": "Aborts stream download and throws SKILL_PAYLOAD_TOO_LARGE when response body exceeds 262144 bytes",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-A04",
    "category": "REMOTE_SKILLS",
    "layer": "UNIT",
    "description": "Rejects invalid skill names with INVALID_SKILL_SLUG",
    "pass_criteria": "Fails when skill name contains directory separators, path traversal (..), or forbidden characters",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-A05",
    "category": "REMOTE_SKILLS",
    "layer": "INTEGRATION",
    "description": "Computes SHA-256 fingerprint before writing and validates frontmatter integrity",
    "pass_criteria": "Calculates content digest in memory and verifies valid SKILL.md frontmatter prior to filesystem persistence",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-B01",
    "category": "FILESYSTEM",
    "layer": "UNIT",
    "description": "Detects and blocks symlinks pointing outside repository root with SYMLINK_ESCAPE_DETECTED",
    "pass_criteria": "Resolves real physical path and throws SYMLINK_ESCAPE_DETECTED when symlink destination escapes root",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-B02",
    "category": "FILESYSTEM",
    "layer": "UNIT",
    "description": "Detects and blocks intermediate symlink path traversal escaping repository root",
    "pass_criteria": "Throws SYMLINK_ESCAPE_DETECTED when any intermediate path component resolves outside repository root",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-B03",
    "category": "FILESYSTEM",
    "layer": "UNIT",
    "description": "Confines atomic staging writes within .gemstack/tmp/ inside project boundaries",
    "pass_criteria": "Staging file is written inside repository .gemstack/tmp/ and atomically renamed to final target",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-B04",
    "category": "FILESYSTEM",
    "layer": "INTEGRATION",
    "description": "Verifies all CLI call sites enforce containment with zero out-of-boundary mutations",
    "pass_criteria": "Audits init, update, install, backup, and vqa call sites verifying no file is read or written outside target root",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C01",
    "category": "GIT_HOOKS",
    "layer": "INTEGRATION",
    "description": "Preserves pre-existing user hooks via executable delegation without data loss",
    "pass_criteria": "Detects non-Gemstack pre-commit hook and preserves execution of both user hook and Gemstack validator",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C02",
    "category": "SECRET_SCAN",
    "layer": "UNIT",
    "description": "Detects Google AI / Gemini API keys",
    "pass_criteria": "Regex pattern matches AIza[0-9A-Za-z-_]{35} and blocks commit or CI execution",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C03",
    "category": "SECRET_SCAN",
    "layer": "UNIT",
    "description": "Detects OpenAI and Anthropic API keys",
    "pass_criteria": "Regex patterns match sk-[a-zA-Z0-9]{20,} and sk-ant- and block commit or CI execution",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C04",
    "category": "SECRET_SCAN",
    "layer": "UNIT",
    "description": "Detects GitHub PATs and Slack tokens",
    "pass_criteria": "Regex patterns match ghp_, github_pat_, and xox[baprs]- and block commit or CI execution",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C05",
    "category": "SECRET_SCAN",
    "layer": "UNIT",
    "description": "Detects private RSA/EC/OPENSSH keys",
    "pass_criteria": "Regex pattern matches -----BEGIN [A-Z ]*PRIVATE KEY----- and blocks commit or CI execution",
    "gate": "REQUIRED"
  },
  {
    "id": "TEST-HARDEN-C06",
    "category": "CI_INTEGRATION",
    "layer": "CLI",
    "description": "Integrates zero-dependency secret scanner script into ci:all",
    "pass_criteria": "scripts/ci/check-secrets.js executes in ci:all and returns exit code 1 on detected secrets",
    "gate": "REQUIRED"
  }
]
```
