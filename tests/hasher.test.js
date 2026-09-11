const test = require('node:test');
const describe = test.describe;
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {
  normalizeContent,
  hashContent,
  hashFile,
  normalizePath
} = require('../src/lib/hasher');

describe('Wave 1 / Suite 2: Deterministic Hasher & Platform Invariance (P1-C & P1-G)', () => {

  test('TEST-CONSISTENCY-C01: Generates canonical 64-character lowercase hexadecimal SHA-256 digest', () => {
    const content = '# Spec content\n\nSome text';
    const digest = hashContent(content);
    assert.equal(digest.length, 64);
    assert.match(digest, /^[0-9a-f]{64}$/);
  });

  test('TEST-CONSISTENCY-C02: Mutation of frozen artifact yields different hash (FROZEN_ARTIFACT_CHANGED)', () => {
    const original = '# Spec\n\nInitial approved draft';
    const mutated = '# Spec\n\nInitial approved draft with sneaky edit';
    const hash1 = hashContent(original);
    const hash2 = hashContent(mutated);
    assert.notEqual(hash1, hash2);
  });

  test('TEST-CONSISTENCY-C04: CRLF and lone CR normalized to LF producing identical canonical SHA-256; BOM throws CONTRACT_PARSE_ERROR', () => {
    const unix = 'Line 1\nLine 2\nLine 3\n';
    const win = 'Line 1\r\nLine 2\r\nLine 3\r\n';
    const macClassic = 'Line 1\rLine 2\rLine 3\r';

    const hashUnix = hashContent(unix);
    const hashWin = hashContent(win);
    const hashMac = hashContent(macClassic);

    assert.equal(hashUnix, hashWin);
    assert.equal(hashUnix, hashMac);

    // BOM test in hasher
    const bomString = '\uFEFFLine 1\nLine 2';
    assert.throws(() => {
      normalizeContent(bomString);
    }, (err) => {
      assert.equal(err.code, 'CONTRACT_PARSE_ERROR');
      assert.match(err.message, /UTF-8 BOM is forbidden in phase artifacts/i);
      return true;
    });
  });

  test('TEST-CONSISTENCY-G01: Resolves Windows backslashes to normalized POSIX relative path', () => {
    const winPath = 'specs\\006-architecture\\spec.md';
    const normalized = normalizePath(winPath);
    assert.equal(normalized, 'specs/006-architecture/spec.md');

    // Also handles root relative normalization
    const fakeRoot = 'C:/CODES/Gemstack';
    const fullFakePath = 'C:\\CODES\\Gemstack\\specs\\006-architecture\\spec.md';
    const relNormalized = normalizePath(fullFakePath, fakeRoot);
    assert.equal(relNormalized, 'specs/006-architecture/spec.md');
  });

});
