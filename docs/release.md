# Gemstack Release Process

Gemstack is protected by a multi-stage CI/CD pipeline using GitHub Actions. No release process is entirely automated for NPM publishing (for security reasons), so all `npm publish` executions are strictly manual post-verification.

## CI Workflows

1. **`pr-ci.yml`**: Runs on `pull_request` to `main`. This is a fast verification matrix running strictly on `ubuntu-latest` with Node 18.x and 20.x. It executes all unit tests, CLI smoke tests, and cleanliness verifications.
2. **`main-ci.yml`**: Runs on `push` to `main`. Full multi-OS matrix (`ubuntu-latest`, `windows-latest`, `macos-latest`) verifying absolute cross-platform integrity.
3. **`release-readiness.yml`**: A `workflow_dispatch` manual action. It tests the creation of a `.tgz` via `npm pack`, installs it in a dummy project to guarantee tarball structure, and exposes the `gemstack-npm-tarball` as a downloadable GitHub Artifact. Note: GitHub zips this artifact, so you will extract it to get the inner `.tgz`.

## Local Verifications

Before merging or triggering release readiness, you can test everything locally using:

```bash
# Run unit tests
npm test

# Run all zero-deps CI validators
npm run ci:all

# Run Demo-App smoke tests (IDOR validation)
npm run ci:demo

# Validate tarball contents
npm run pack:dry
```

*(Note: We never automatically tag or publish to NPM via CI. The framework focuses entirely on robust local-first scaffolding).*
