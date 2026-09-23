const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const install = require('../src/commands/install');

describe('Skill Installation Provenance & Safe Inspection (Gemstack v2.0.1)', () => {

  it('TEST-PROV-01: Rejects untrusted sources outside allowed_sources whitelist with UNTRUSTED_SKILL_SOURCE', () => {
    assert.throws(
      () => install.validateUrlSafety('https://attacker.evil.com/repo/SKILL.md'),
      (err) => {
        assert.strictEqual(err.code, 'UNTRUSTED_SKILL_SOURCE');
        return true;
      }
    );

    // Custom allowed source passes
    assert.doesNotThrow(() => {
      install.validateUrlSafety('https://mycorp.internal-cdn.com/skills/SKILL.md', {
        allowedSources: ['https://mycorp.internal-cdn.com/']
      });
    });
  });

  it('TEST-PROV-02: Rejects URLs containing credentials with CREDENTIALS_IN_URL_BLOCKED', () => {
    const maliciousUrls = [
      'https://user:pass@raw.githubusercontent.com/org/repo/SKILL.md',
      'https://api_key:@raw.githubusercontent.com/org/repo/SKILL.md',
      'https://:secret_token@raw.githubusercontent.com/org/repo/SKILL.md'
    ];

    for (const u of maliciousUrls) {
      assert.throws(
        () => install.validateUrlSafety(u),
        (err) => {
          assert.strictEqual(err.code, 'CREDENTIALS_IN_URL_BLOCKED');
          return true;
        }
      );
    }
  });

  it('TEST-PROV-03: Rejects encoded and non-standard private/loopback host notations (SSRF)', () => {
    // Decimal IP (2130706433 = 127.0.0.1)
    assert.strictEqual(install.isPrivateOrLoopbackHost('2130706433'), true);
    // Hex IP (0x7f000001 = 127.0.0.1)
    assert.strictEqual(install.isPrivateOrLoopbackHost('0x7f000001'), true);
    // Octal IP (0177.0.0.1)
    assert.strictEqual(install.isPrivateOrLoopbackHost('0177.0.0.1'), true);
    // Internal TLDs
    assert.strictEqual(install.isPrivateOrLoopbackHost('metadata.local'), true);
    assert.strictEqual(install.isPrivateOrLoopbackHost('service.internal'), true);
    assert.strictEqual(install.isPrivateOrLoopbackHost('router.lan'), true);
    // Public host returns false
    assert.strictEqual(install.isPrivateOrLoopbackHost('raw.githubusercontent.com'), false);
  });

  it('TEST-PROV-04: Rejects installation without expected SHA-256 with MISSING_EXPECTED_CHECKSUM', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-prov-04-'));
    try {
      // Mock global fetch
      const validMd = '---\nname: safe-skill\ndescription: A safe skill\n---\n# Safe Skill';
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        headers: new Headers({ 'content-length': String(Buffer.byteLength(validMd)) }),
        arrayBuffer: async () => Buffer.from(validMd)
      });

      try {
        await assert.rejects(
          async () => {
            await install('https://raw.githubusercontent.com/org/repo/SKILL.md', {
              target: tempDir,
              skipDnsResolve: true
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'MISSING_EXPECTED_CHECKSUM');
            return true;
          }
        );
      } finally {
        global.fetch = originalFetch;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TEST-PROV-05: Rejects installation when payload does not match expected SHA-256 with SKILL_CHECKSUM_MISMATCH', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-prov-05-'));
    try {
      const validMd = '---\nname: safe-skill\ndescription: A safe skill\n---\n# Safe Skill';
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        headers: new Headers({ 'content-length': String(Buffer.byteLength(validMd)) }),
        arrayBuffer: async () => Buffer.from(validMd)
      });

      try {
        await assert.rejects(
          async () => {
            await install('https://raw.githubusercontent.com/org/repo/SKILL.md', {
              target: tempDir,
              sha256: '0000000000000000000000000000000000000000000000000000000000000000',
              skipDnsResolve: true
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'SKILL_CHECKSUM_MISMATCH');
            return true;
          }
        );
      } finally {
        global.fetch = originalFetch;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TEST-PROV-06: Inspect mode allows checking metadata and SHA-256 without modifying disk', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-prov-06-'));
    try {
      const validMd = '---\nname: inspectable-skill\ndescription: Inspect me\n---\n# Content';
      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        headers: new Headers({ 'content-length': String(Buffer.byteLength(validMd)) }),
        arrayBuffer: async () => Buffer.from(validMd)
      });

      try {
        const result = await install('https://raw.githubusercontent.com/org/repo/SKILL.md', {
          target: tempDir,
          inspect: true,
          skipDnsResolve: true
        });

        assert.strictEqual(result.installed, false);
        assert.strictEqual(result.name, 'inspectable-skill');
        assert.ok(result.sha256);

        // Verify no file written to disk
        const targetSkillFile = path.join(tempDir, '.agents/skills/inspectable-skill/SKILL.md');
        assert.strictEqual(fs.existsSync(targetSkillFile), false);
      } finally {
        global.fetch = originalFetch;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('TEST-PROV-07: Prevents overwriting existing skill without --update or --force, and creates backup on update', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemstack-test-prov-07-'));
    try {
      const existingSkillDir = path.join(tempDir, '.agents/skills/existing-skill');
      fs.mkdirSync(existingSkillDir, { recursive: true });
      fs.writeFileSync(path.join(existingSkillDir, 'SKILL.md'), '---\nname: existing-skill\n---\n# V1 Original Content', 'utf8');

      const v2Content = '---\nname: existing-skill\ndescription: Updated\n---\n# V2 Updated Content';
      const crypto = require('crypto');
      const v2Sha256 = crypto.createHash('sha256').update(v2Content, 'utf8').digest('hex');

      const originalFetch = global.fetch;
      global.fetch = async () => ({
        ok: true,
        headers: new Headers({ 'content-length': String(Buffer.byteLength(v2Content)) }),
        arrayBuffer: async () => Buffer.from(v2Content)
      });

      try {
        // Attempt install without update flag -> SKILL_ALREADY_EXISTS
        await assert.rejects(
          async () => {
            await install('https://raw.githubusercontent.com/org/repo/SKILL.md', {
              target: tempDir,
              sha256: v2Sha256,
              skipDnsResolve: true
            });
          },
          (err) => {
            assert.strictEqual(err.code, 'SKILL_ALREADY_EXISTS');
            return true;
          }
        );

        // Install with --update -> creates backup and succeeds
        const updateResult = await install('https://raw.githubusercontent.com/org/repo/SKILL.md', {
          target: tempDir,
          sha256: v2Sha256,
          update: true,
          skipDnsResolve: true
        });

        assert.strictEqual(updateResult.installed, true);

        // Verify updated file content
        const currentContent = fs.readFileSync(path.join(existingSkillDir, 'SKILL.md'), 'utf8');
        assert.strictEqual(currentContent, v2Content);

        // Verify backup was created
        const backupDir = path.join(tempDir, '.gemstack/backups/skills');
        assert.ok(fs.existsSync(backupDir));
        const backups = fs.readdirSync(backupDir).filter(f => f.startsWith('existing-skill_'));
        assert.strictEqual(backups.length, 1);
        const backupContent = fs.readFileSync(path.join(backupDir, backups[0]), 'utf8');
        assert.ok(backupContent.includes('V1 Original Content'));
      } finally {
        global.fetch = originalFetch;
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
