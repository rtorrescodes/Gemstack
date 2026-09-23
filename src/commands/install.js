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

const DEFAULT_ALLOWED_SOURCES = ['https://raw.githubusercontent.com/'];

function isPrivateOrLoopbackHost(hostname) {
    const lower = (hostname || '').toLowerCase().trim();
    if (lower === 'localhost' || lower === '::1' || lower === '127.0.0.1' || lower === '0.0.0.0') {
        return true;
    }
    if (lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.lan')) {
        return true;
    }
    // Check decimal IP (dword format: e.g. 2130706433 = 127.0.0.1)
    if (/^\d+$/.test(lower)) {
        const num = Number(lower);
        if (num >= 0 && num <= 4294967295) {
            const b1 = (num >>> 24) & 255;
            const b2 = (num >>> 16) & 255;
            if (b1 === 10 || b1 === 127 || (b1 === 169 && b2 === 254) || (b1 === 172 && (b2 >= 16 && b2 <= 31)) || (b1 === 192 && b2 === 168) || b1 === 0) {
                return true;
            }
        }
    }
    // Check hex IP (e.g. 0x7f000001)
    if (/^0x[0-9a-f]+$/i.test(lower)) {
        const num = parseInt(lower, 16);
        if (num >= 0 && num <= 4294967295) {
            const b1 = (num >>> 24) & 255;
            const b2 = (num >>> 16) & 255;
            if (b1 === 10 || b1 === 127 || (b1 === 169 && b2 === 254) || (b1 === 172 && (b2 >= 16 && b2 <= 31)) || (b1 === 192 && b2 === 168) || b1 === 0) {
                return true;
            }
        }
    }
    const ipv4Match = lower.match(/^(\d{1,4})\.(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/);
    if (ipv4Match) {
        const o1 = ipv4Match[1].startsWith('0') && ipv4Match[1].length > 1 ? parseInt(ipv4Match[1], 8) : Number(ipv4Match[1]);
        const o2 = ipv4Match[2].startsWith('0') && ipv4Match[2].length > 1 ? parseInt(ipv4Match[2], 8) : Number(ipv4Match[2]);
        if (o1 === 10) return true;
        if (o1 === 127) return true;
        if (o1 === 0) return true;
        if (o1 === 169 && o2 === 254) return true;
        if (o1 === 172 && (o2 >= 16 && o2 <= 31)) return true;
        if (o1 === 192 && o2 === 168) return true;
    }
    if (lower.startsWith('fe80:') || lower.startsWith('fc00:') || lower.startsWith('fd00:')) {
        return true;
    }
    return false;
}

function checkAllowedSources(urlStr, allowedSources = DEFAULT_ALLOWED_SOURCES) {
    const list = Array.isArray(allowedSources) ? allowedSources : [allowedSources];
    const isAllowed = list.some(prefix => {
        const p = String(prefix).trim().toLowerCase();
        return urlStr.toLowerCase().startsWith(p);
    });
    if (!isAllowed) {
        const err = new Error(`Untrusted skill source: "${urlStr}". Must match allowed_sources whitelist (${list.join(', ')}).`);
        err.code = 'UNTRUSTED_SKILL_SOURCE';
        throw err;
    }
    return true;
}

async function verifyHostDnsNotPrivate(hostname) {
    if (isPrivateOrLoopbackHost(hostname)) {
        const err = new Error(`Access to private or loopback IP address blocked: ${hostname}`);
        err.code = 'PRIVATE_IP_BLOCKED';
        throw err;
    }
    const dns = require('dns');
    try {
        const addresses = await dns.promises.lookup(hostname, { all: true });
        for (const record of addresses) {
            if (isPrivateOrLoopbackHost(record.address)) {
                const err = new Error(`DNS rebinding blocked: ${hostname} resolves to private IP ${record.address}`);
                err.code = 'PRIVATE_IP_BLOCKED';
                throw err;
            }
        }
    } catch (err) {
        if (err.code === 'PRIVATE_IP_BLOCKED') throw err;
        const dnsErr = new Error(`DNS resolution failed for host "${hostname}": ${err.message}`);
        dnsErr.code = 'DNS_RESOLUTION_FAILED';
        throw dnsErr;
    }
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

    if (parsed.username || parsed.password) {
        const sanitized = new URL(parsed.toString());
        sanitized.username = '';
        sanitized.password = '';
        const err = new Error(`Credentials in URL are strictly blocked: ${sanitized.toString()}`);
        err.code = 'CREDENTIALS_IN_URL_BLOCKED';
        throw err;
    }

    if (isPrivateOrLoopbackHost(parsed.hostname)) {
        const err = new Error(`Access to private or loopback IP address blocked: ${parsed.hostname}`);
        err.code = 'PRIVATE_IP_BLOCKED';
        throw err;
    }

    if (!flags.skipAllowedSourcesCheck) {
        const allowed = flags.allowedSources || DEFAULT_ALLOWED_SOURCES;
        checkAllowedSources(urlStr, allowed);
    }

    return parsed;
}

async function fetchSkillUrl(url, flags = {}) {
    const parsed = validateUrlSafety(url, flags);

    if (!flags.skipDnsResolve) {
        await verifyHostDnsNotPrivate(parsed.hostname);
    }

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
        const err = new Error("Debe proporcionar una URL. Ejemplo: gemstack install https://raw.githubusercontent.com/.../SKILL.md --sha256 <hash>");
        err.code = 'MISSING_URL';
        throw err;
    }

    const targetDir = flags.target || process.cwd();

    // Validate URL safety BEFORE any logging to prevent credential leakage
    const parsedUrl = validateUrlSafety(url, flags);

    // Sanitize URL string for safe display in logs
    const safeLogUrl = new URL(url);
    safeLogUrl.username = '';
    safeLogUrl.password = '';
    logger.info(`Descargando skill desde: ${safeLogUrl.toString()}`);

    const rawContent = await fetchSkillUrl(url, flags);
    const inspected = inspectSkillContent(rawContent);

    const relativePath = `.agents/skills/${inspected.name}/SKILL.md`;

    // 1. Verify Expected SHA-256 before doing anything else
    const expectedChecksum = flags.sha256 || flags.expectedChecksum;
    if (expectedChecksum) {
        if (inspected.sha256.toLowerCase() !== String(expectedChecksum).toLowerCase().trim()) {
            const err = new Error(`Skill checksum mismatch! Expected SHA-256: ${expectedChecksum}, but downloaded payload has SHA-256: ${inspected.sha256}`);
            err.code = 'SKILL_CHECKSUM_MISMATCH';
            throw err;
        }
    } else if (!flags.dryRun && !flags.inspect) {
        const err = new Error(`Debe proporcionar el hash SHA-256 esperado con --sha256 <hash> para instalar. Use --inspect para revisar el contenido y fingerprint previo a la instalación.`);
        err.code = 'MISSING_EXPECTED_CHECKSUM';
        throw err;
    }

    // 2. Safe Inspection Flow
    if (flags.dryRun || flags.inspect) {
        logger.ok(`Inspect/Dry-run: Se verificó el skill "${inspected.name}" (SHA-256: ${inspected.sha256}). No se realizaron modificaciones en disco.`);
        return { name: inspected.name, path: relativePath, sha256: inspected.sha256, installed: false };
    }

    // 3. Resolve and validate target path strictly within project boundaries
    const safeTargetSkillPath = fssafe.resolveSafeStrict(targetDir, relativePath);

    // 4. Overwrite Protection & Backup Flow
    if (fs.existsSync(safeTargetSkillPath)) {
        if (!flags.update && !flags.force) {
            const err = new Error(`El skill "${inspected.name}" ya existe en ${relativePath}. Especifique --update para actualizar con respaldo o --force.`);
            err.code = 'SKILL_ALREADY_EXISTS';
            throw err;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupRelPath = `.gemstack/backups/skills/${inspected.name}_${timestamp}.bak`;
        const oldContent = fs.readFileSync(safeTargetSkillPath, 'utf8');
        fssafe.withConfinedAtomicWrite(targetDir, backupRelPath, (tempFile) => {
            fs.writeFileSync(tempFile, oldContent, 'utf8');
        });
        logger.info(`Respaldo de versión previa guardado en ${backupRelPath}`);
    }

    // 5. Atomic write inside project boundaries
    fssafe.withConfinedAtomicWrite(targetDir, relativePath, (tempFile) => {
        fs.writeFileSync(tempFile, rawContent, 'utf8');
    });

    // 5. Update manifest
    const manifest = manifestLib.loadManifest(targetDir);
    if (!manifest.files) manifest.files = [];
    
    const ex = manifest.files.find(f => f.path === relativePath);
    if (ex) ex.checksum = inspected.sha256;
    else manifest.files.push({ path: relativePath, checksum: inspected.sha256 });
    
    manifestLib.saveManifest(targetDir, manifest, false);

    logger.ok(`✅ Skill "${inspected.name}" instalado exitosamente en ${relativePath} (SHA-256: ${inspected.sha256.slice(0, 12)}...)`);
    return { name: inspected.name, path: relativePath, sha256: inspected.sha256, installed: true };
}

install.DEFAULT_ALLOWED_SOURCES = DEFAULT_ALLOWED_SOURCES;
install.validateSkillPayloadSize = validateSkillPayloadSize;
install.validateSkillSlug = validateSkillSlug;
install.validateUrlSafety = validateUrlSafety;
install.checkAllowedSources = checkAllowedSources;
install.isPrivateOrLoopbackHost = isPrivateOrLoopbackHost;
install.verifyHostDnsNotPrivate = verifyHostDnsNotPrivate;
install.inspectSkillContent = inspectSkillContent;

module.exports = install;
