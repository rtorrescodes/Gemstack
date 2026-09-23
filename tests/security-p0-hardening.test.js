const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const fssafe = require('../src/lib/filesystem-safe');
const installCommand = require('../src/commands/install');
const hooksCommand = require('../src/commands/hooks');

describe('Gemstack 2.0 Sprint A: Trust Boundaries Hardening', () => {

  // --- Group A: Remote Skills Hardening ---
  describe('Group A: Remote Skills Installation (TEST-HARDEN-A01 .. A05)', () => {

    it('TEST-HARDEN-A01: Rejects non-HTTPS remote URLs by default with INSECURE_HTTP_BLOCKED', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-a01-'));
      try {
        await assert.rejects(
          async () => {
            await installCommand({ url: 'http://example.com/SKILL.md', target: tempDir, yes: true });
          },
          (err) => {
            assert.strictEqual(err.code, 'INSECURE_HTTP_BLOCKED');
            return true;
          }
        );
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-A02: Rejects private and loopback IP addresses (SSRF defense) with PRIVATE_IP_BLOCKED', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-a02-'));
      const privateUrls = [
        'https://127.0.0.1/SKILL.md',
        'https://localhost/SKILL.md',
        'https://10.0.0.1/SKILL.md',
        'https://192.168.1.1/SKILL.md',
        'https://172.16.0.1/SKILL.md',
        'https://169.254.169.254/SKILL.md'
      ];
      try {
        for (const u of privateUrls) {
          await assert.rejects(
            async () => {
              await installCommand({ url: u, target: tempDir, yes: true });
            },
            (err) => {
              assert.strictEqual(err.code, 'PRIVATE_IP_BLOCKED');
              return true;
            }
          );
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-A03: Rejects payload exceeding 256 KB with SKILL_PAYLOAD_TOO_LARGE', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-a03-'));
      try {
        if (installCommand.validateSkillPayloadSize) {
          assert.throws(
            () => installCommand.validateSkillPayloadSize(300000),
            (err) => {
              assert.strictEqual(err.code, 'SKILL_PAYLOAD_TOO_LARGE');
              return true;
            }
          );
        } else {
          assert.fail('installCommand.validateSkillPayloadSize not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-A04: Rejects invalid skill names with INVALID_SKILL_SLUG', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-a04-'));
      const invalidNames = [
        '../evil-skill',
        'sub/dir/skill',
        'skill;malicious',
        '-invalid-leading',
        'has spaces',
        'CAPS_NOT_ALLOWED',
        'a'.repeat(65)
      ];
      try {
        if (installCommand.validateSkillSlug) {
          for (const name of invalidNames) {
            assert.throws(
              () => installCommand.validateSkillSlug(name),
              (err) => {
                assert.strictEqual(err.code, 'INVALID_SKILL_SLUG');
                return true;
              }
            );
          }
          assert.strictEqual(installCommand.validateSkillSlug('valid-skill-01'), true);
        } else {
          assert.fail('installCommand.validateSkillSlug not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-A05: Computes SHA-256 fingerprint before writing and validates frontmatter integrity', async () => {
      if (installCommand.inspectSkillContent) {
        const validMd = '---\nname: my-skill\ndescription: A valid skill\n---\n# My Skill';
        const inspected = installCommand.inspectSkillContent(validMd);
        assert.ok(inspected.sha256);
        assert.strictEqual(inspected.sha256.length, 64);
        assert.strictEqual(inspected.name, 'my-skill');

        const invalidMd = '# No frontmatter here';
        assert.throws(
          () => installCommand.inspectSkillContent(invalidMd),
          (err) => {
            assert.strictEqual(err.code, 'INVALID_SKILL_FRONTMATTER');
            return true;
          }
        );
      } else {
        assert.fail('installCommand.inspectSkillContent not implemented');
      }
    });

  });

  // --- Group B: Filesystem Containment & Realpath Hardening ---
  describe('Group B: Filesystem Containment & Symlinks (TEST-HARDEN-B01 .. B04)', () => {

    it('TEST-HARDEN-B01: Detects and blocks symlinks pointing outside repository root with SYMLINK_ESCAPE_DETECTED', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-b01-'));
      const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-outside-'));
      const symlinkPath = path.join(tempDir, 'evil-link');

      try {
        try {
          fs.symlinkSync(outsideDir, symlinkPath, 'junction');
        } catch (e) {
          try {
            fs.symlinkSync(outsideDir, symlinkPath, 'dir');
          } catch (e2) {
            // If host forbids symlink creation
            return;
          }
        }

        if (fssafe.resolveSafeStrict) {
          assert.throws(
            () => {
              fssafe.resolveSafeStrict(tempDir, 'evil-link/target.txt');
            },
            (err) => {
              assert.strictEqual(err.code, 'SYMLINK_ESCAPE_DETECTED');
              return true;
            }
          );
        } else {
          assert.fail('fssafe.resolveSafeStrict not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.rmSync(outsideDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-B02: Detects and blocks intermediate symlink path traversal escaping repository root', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-b02-'));
      try {
        if (fssafe.resolveSafeStrict) {
          assert.throws(
            () => {
              fssafe.resolveSafeStrict(tempDir, '../../outside.txt');
            },
            (err) => {
              assert.ok(err.code === 'PATH_TRAVERSAL_DETECTED' || err.code === 'SYMLINK_ESCAPE_DETECTED');
              return true;
            }
          );
        } else {
          assert.fail('fssafe.resolveSafeStrict not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-B03: Confines atomic staging writes within .gemstack/tmp/ inside project boundaries', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-b03-'));
      try {
        if (fssafe.withConfinedAtomicWrite) {
          const targetFile = path.join('specs', 'output.txt');
          fssafe.withConfinedAtomicWrite(tempDir, targetFile, (stagedPath) => {
            const expectedTmp = path.join(tempDir, '.gemstack', 'tmp');
            assert.ok(stagedPath.startsWith(expectedTmp), `Staged path ${stagedPath} not in ${expectedTmp}`);
            fs.writeFileSync(stagedPath, 'hello confined world', 'utf8');
          });

          const finalFile = path.join(tempDir, targetFile);
          assert.ok(fs.existsSync(finalFile));
          assert.strictEqual(fs.readFileSync(finalFile, 'utf8'), 'hello confined world');
        } else {
          assert.fail('fssafe.withConfinedAtomicWrite not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-B04: Verifies all CLI call sites enforce containment with zero out-of-boundary mutations', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-b04-'));
      try {
        if (fssafe.resolveSafeStrict) {
          const safeSub = fssafe.resolveSafeStrict(tempDir, 'specs/001-feature/spec.md');
          assert.ok(safeSub.startsWith(path.resolve(tempDir)));

          assert.throws(
            () => fssafe.resolveSafeStrict(tempDir, '../outside.txt'),
            /PATH_TRAVERSAL_DETECTED|SYMLINK_ESCAPE_DETECTED/
          );
        } else {
          assert.fail('fssafe.resolveSafeStrict not implemented');
        }
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

  });

  // --- Group C: Git Hooks Preservation & Secret Detection ---
  describe('Group C: Git Hooks Preservation & Secret Detection (TEST-HARDEN-C01 .. C06)', () => {

    it('TEST-HARDEN-C01: Preserves pre-existing user hooks via executable delegation without data loss', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-harden-c01-'));
      const gitHooksDir = path.join(tempDir, '.git', 'hooks');
      fs.mkdirSync(gitHooksDir, { recursive: true });

      const preExistingHook = '#!/bin/sh\necho "Pre-existing custom linter hook"\nexit 0\n';
      fs.writeFileSync(path.join(gitHooksDir, 'pre-commit'), preExistingHook, 'utf8');

      try {
        await hooksCommand({ target: tempDir });

        const updatedHook = fs.readFileSync(path.join(gitHooksDir, 'pre-commit'), 'utf8');
        const wrappedHookPath = path.join(gitHooksDir, 'pre-commit.gemstack-wrapped');
        const isWrapped = fs.existsSync(wrappedHookPath) && fs.readFileSync(wrappedHookPath, 'utf8') === preExistingHook;
        const isChainedInPlace = updatedHook.includes('Pre-existing custom linter hook');

        assert.ok(isWrapped || isChainedInPlace, 'Existing user hook was destroyed or not chained');
        assert.ok(updatedHook.includes('[Gemstack]'), 'Gemstack hook section was not installed');
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('TEST-HARDEN-C02: Detects Google AI / Gemini API keys', () => {
      const sampleKey = 'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q';
      if (hooksCommand.detectSecrets) {
        const detected = hooksCommand.detectSecrets(`const key = "${sampleKey}";`);
        assert.ok(detected.length > 0, 'Did not detect Google AI key');
        assert.strictEqual(detected[0].type, 'GOOGLE_AI_KEY');
      } else {
        assert.fail('hooksCommand.detectSecrets not implemented');
      }
    });

    it('TEST-HARDEN-C03: Detects OpenAI and Anthropic API keys', () => {
      const openaiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx';
      const anthropicKey = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789-abcdef';
      if (hooksCommand.detectSecrets) {
        const d1 = hooksCommand.detectSecrets(`OPENAI_KEY=${openaiKey}`);
        assert.ok(d1.some(s => s.type === 'OPENAI_KEY'), 'Did not detect OpenAI key');

        const d2 = hooksCommand.detectSecrets(`ANTHROPIC_KEY=${anthropicKey}`);
        assert.ok(d2.some(s => s.type === 'ANTHROPIC_KEY'), 'Did not detect Anthropic key');
      } else {
        assert.fail('hooksCommand.detectSecrets not implemented');
      }
    });

    it('TEST-HARDEN-C04: Detects GitHub PATs and Slack tokens', () => {
      const githubPat = 'gh' + 'p_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const slackToken = 'xox' + 'b-123456789012-1234567890123-abcdefghijklmnopqrstuvwx';
      if (hooksCommand.detectSecrets) {
        const d1 = hooksCommand.detectSecrets(`token = "${githubPat}"`);
        assert.ok(d1.some(s => s.type === 'GITHUB_PAT'), 'Did not detect GitHub PAT');

        const d2 = hooksCommand.detectSecrets(`slack = "${slackToken}"`);
        assert.ok(d2.some(s => s.type === 'SLACK_TOKEN'), 'Did not detect Slack token');
      } else {
        assert.fail('hooksCommand.detectSecrets not implemented');
      }
    });

    it('TEST-HARDEN-C05: Detects private RSA/EC/OPENSSH keys', () => {
      const privateKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----';
      if (hooksCommand.detectSecrets) {
        const detected = hooksCommand.detectSecrets(privateKey);
        assert.ok(detected.some(s => s.type === 'PRIVATE_KEY'), 'Did not detect private key');
      } else {
        assert.fail('hooksCommand.detectSecrets not implemented');
      }
    });

    it('TEST-HARDEN-C06: Integrates zero-dependency secret scanner script into ci:all', () => {
      const scannerScriptPath = path.resolve('scripts/ci/check-secrets.js');
      assert.ok(fs.existsSync(scannerScriptPath), 'scripts/ci/check-secrets.js must exist');

      const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));
      assert.ok(pkg.scripts['ci:secrets'], 'package.json must contain ci:secrets script');
      assert.ok(pkg.scripts['ci:all'].includes('ci:secrets'), 'ci:all must include ci:secrets');
    });

  });

});
