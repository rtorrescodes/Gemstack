const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const fssafe = require('../lib/filesystem-safe');
const logger = require('../lib/logger');
const manifestLib = require('../lib/manifest');

const MAX_SKILL_PAYLOAD_BYTES = 262144; // 256 KB
const FETCH_TIMEOUT_MS = 8000;
const SKILL_SLUG_REGEX = /^[a-z0-9][a-z0-9-_]{1,63}$/;

function validateSkillPayloadSize(sizeBytes) {
    if (sizeBytes > MAX_SKILL_PAYLOAD_BYTES) {
        const err = new Error(`Skill payload too large: ${sizeBytes} bytes exceeds maximum limit of ${MAX_SKILL_PAYLOAD_BYTES} bytes`);
        err.code = 'SKILL_PAYLOAD_TOO_LARGE';
        throw err;
    }
    return true;
}

function validateSkillSlug(slug) {
    if (!slug || typeof slug !== 'string' || !SKILL_SLUG_REGEX.test(slug)) {
        const err = new Error(`Invalid skill slug "${slug}". Must match ${SKILL_SLUG_REGEX}`);
        err.code = 'INVALID_SKILL_SLUG';
        throw err;
    }
    return true;
}

function isPrivateOrLoopbackHost(hostname) {
    const lower = (hostname || '').toLowerCase().trim();
    if (lower === 'localhost' || lower === '::1' || lower === '127.0.0.1') {
        return true;
    }
    const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
        const o1 = Number(ipv4Match[1]);
        const o2 = Number(ipv4Match[2]);
        if (o1 === 10) return true;
        if (o1 === 127) return true;
        if (o1 === 169 && o2 === 254) return true;
        if (o1 === 172 && (o2 >= 16 && o2 <= 31)) return true;
        if (o1 === 192 && o2 === 168) return true;
    }
    return false;
}

function validateUrlSafety(urlStr, flags = {}) {
    let parsed;
    try {
        parsed = new URL(urlStr);
    } catch (e) {
        const err = new Error(`Malformed URL: ${urlStr}`);
        err.code = 'MALFORMED_URL';
        throw err;
    }

    if (parsed.protocol !== 'https:' && !flags.allowInsecureHttp) {
        const err = new Error(`Insecure HTTP protocol blocked. HTTPS is required: ${urlStr}`);
        err.code = 'INSECURE_HTTP_BLOCKED';
        throw err;
    }

    if (isPrivateOrLoopbackHost(parsed.hostname)) {
        const err = new Error(`Access to private or loopback IP address blocked: ${parsed.hostname}`);
        err.code = 'PRIVATE_IP_BLOCKED';
        throw err;
    }

    return parsed;
}

async function fetchSkillUrl(url, flags = {}) {
    validateUrlSafety(url, flags);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const response = await fetch(url, { signal: controller.signal, redirect: 'error' });
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
        }

        const contentLength = response.headers.get('content-length');
        if (contentLength) {
            validateSkillPayloadSize(Number(contentLength));
        }

        const buffer = await response.arrayBuffer();
        validateSkillPayloadSize(buffer.byteLength);

        return Buffer.from(buffer).toString('utf8');
    } catch (e) {
        if (e.name === 'AbortError') {
            const err = new Error(`Download timed out after ${FETCH_TIMEOUT_MS}ms`);
            err.code = 'FETCH_TIMEOUT';
            throw err;
        }
        throw e;
    } finally {
        clearTimeout(timer);
    }
}

function inspectSkillContent(content) {
    if (!content || typeof content !== 'string') {
        const err = new Error('Skill content is empty or invalid');
        err.code = 'INVALID_SKILL_FRONTMATTER';
        throw err;
    }

    const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!frontmatterMatch) {
        const err = new Error('El archivo descargado no parece un SKILL válido (no tiene frontmatter delimitado por ---).');
        err.code = 'INVALID_SKILL_FRONTMATTER';
        throw err;
    }

    const frontmatterBody = frontmatterMatch[1];
    const nameMatch = frontmatterBody.match(/^name:\s*(.+)$/m);
    if (!nameMatch || !nameMatch[1].trim()) {
        const err = new Error('No se encontró "name: <nombre>" en el frontmatter del SKILL.');
        err.code = 'INVALID_SKILL_FRONTMATTER';
        throw err;
    }

    const rawName = nameMatch[1].trim();
    validateSkillSlug(rawName);

    const sha256 = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

    return {
        name: rawName,
        sha256,
        content
    };
}

async function install(arg1, arg2) {
    let url;
    let flags = {};

    if (typeof arg1 === 'string') {
        url = arg1;
        flags = arg2 || {};
    } else if (arg1 && typeof arg1 === 'object') {
        flags = arg1;
        url = flags.url;
    } else {
        flags = arg2 || {};
    }

    if (!url) {
        const err = new Error("Debe proporcionar una URL. Ejemplo: gemstack install https://raw.githubusercontent.com/.../SKILL.md");
        err.code = 'MISSING_URL';
        throw err;
    }

    const targetDir = flags.target || process.cwd();
    logger.info(`Descargando skill desde: ${url}`);

    const rawContent = await fetchSkillUrl(url, flags);
    const inspected = inspectSkillContent(rawContent);

    const relativePath = `.agents/skills/${inspected.name}/SKILL.md`;

    if (flags.dryRun) {
        logger.ok(`Dry run: Se instalaría el skill "${inspected.name}" (SHA-256: ${inspected.sha256.slice(0, 16)}...) en ${relativePath}`);
        return { name: inspected.name, path: relativePath, sha256: inspected.sha256, installed: false };
    }

    // Atomic write inside project boundaries
    fssafe.withConfinedAtomicWrite(targetDir, relativePath, (tempFile) => {
        fs.writeFileSync(tempFile, rawContent, 'utf8');
    });

    // Update manifest
    const manifest = manifestLib.loadManifest(targetDir);
    if (!manifest.files) manifest.files = [];
    
    const ex = manifest.files.find(f => f.path === relativePath);
    if (ex) ex.checksum = inspected.sha256;
    else manifest.files.push({ path: relativePath, checksum: inspected.sha256 });
    
    manifestLib.saveManifest(targetDir, manifest, false);

    logger.ok(`✅ Skill "${inspected.name}" instalado exitosamente en ${relativePath} (SHA-256: ${inspected.sha256.slice(0, 12)}...)`);
    return { name: inspected.name, path: relativePath, sha256: inspected.sha256, installed: true };
}

install.validateSkillPayloadSize = validateSkillPayloadSize;
install.validateSkillSlug = validateSkillSlug;
install.validateUrlSafety = validateUrlSafety;
install.inspectSkillContent = inspectSkillContent;

module.exports = install;
