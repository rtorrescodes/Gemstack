const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const SECRET_PATTERNS = [
    { type: 'GOOGLE_AI_KEY', regex: new RegExp('AIza[0-9A-Za-z_-]{35}'), description: 'Google AI / Gemini API Key' },
    { type: 'OPENAI_KEY', regex: new RegExp('sk-(?:proj-)?[a-zA-Z0-9_-]{20,}'), description: 'OpenAI API Key' },
    { type: 'ANTHROPIC_KEY', regex: new RegExp('sk-ant-[a-zA-Z0-9_-]{20,}'), description: 'Anthropic API Key' },
    { type: 'GITHUB_PAT', regex: new RegExp('(?:' + 'ghp_' + '[0-9a-zA-Z]{36}|' + 'github_pat_' + '[0-9a-zA-Z_]{22,})'), description: 'GitHub Personal Access Token' },
    { type: 'SLACK_TOKEN', regex: new RegExp('xox' + '[baprs]-[0-9a-zA-Z-]{10,}'), description: 'Slack Token' },
    { type: 'STRIPE_KEY', regex: new RegExp('sk_' + '(?:live|test)_[0-9a-zA-Z]{24}'), description: 'Stripe Secret Key' },
    { type: 'AWS_KEY', regex: new RegExp('AK' + 'IA[0-9A-Z]{16}'), description: 'AWS Access Key' },
    { type: 'PRIVATE_KEY', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, description: 'Private Cryptographic Key' }
];

function detectSecrets(content) {
    if (!content || typeof content !== 'string') return [];
    const results = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('gemstack:allow-secret') || line.includes('NOOP_TEST_FIXTURE')) {
            continue;
        }
        for (const pattern of SECRET_PATTERNS) {
            const match = line.match(pattern.regex);
            if (match) {
                results.push({
                    type: pattern.type,
                    description: pattern.description,
                    match: match[0],
                    lineNumber: i + 1,
                    lineSnippet: line.trim()
                });
            }
        }
    }
    return results;
}

const BASH_PATTERNS = [
    'AIza[0-9A-Za-z_-]{35}',
    'sk-(proj-)?[a-zA-Z0-9_-]{20,}',
    'sk-ant-',
    'gh' + 'p_',
    'github_' + 'pat_',
    'xox' + '[baprs]-',
    'sk_' + 'live_',
    'sk_' + 'test_',
    'AK' + 'IA[0-9A-Z]{16}',
    '-----BEGIN [A-Z ]*PRIVATE KEY-----'
].join('|');

const GEMSTACK_SECURITY_BLOCK = `
# --- [Gemstack] Active Security Scanner ---
echo "[Gemstack] Ejecutando análisis de seguridad local..."

# 1. Evitar que se suban archivos .env
if git diff --cached --name-only | grep -E "^\\.env|\\.env\\.local|\\.env\\.production" > /dev/null; then
    echo "❌ ERROR (Gemstack): Estás intentando hacer commit de un archivo .env"
    echo "Regla 03: Gestión de Secretos. Remuévelo usando 'git reset HEAD <archivo>' y añádelo al .gitignore."
    exit 1
fi

# 2. Buscar marcadores de conflicto de merge olvidados
if git diff --cached -S"<<<<<<< HEAD" --quiet; then
    :
else
    if git diff --cached | grep -E "^\\+<<<<<<<" > /dev/null; then
        echo "❌ ERROR (Gemstack): Hay marcadores de conflicto de git (<<<<<<<) en tus archivos."
        echo "Resuélvelos antes de hacer commit."
        exit 1
    fi
fi

# 3. Buscar llaves y credenciales expuestas en código agregado (excluyendo tests y specs)
if git diff --cached -- . ':!tests' ':!specs' | grep -E "^\\+.*(${BASH_PATTERNS})" > /dev/null; then
    echo "❌ ERROR (Gemstack/CSO): ¡Posible llave secreta detectada en el código agregado!"
    echo "Regla 03: Cero Exposición de Credenciales. Extrae el secreto a una variable de entorno."
    exit 1
fi

echo "✅ [Gemstack] Código limpio. Committing..."
# --- End [Gemstack] ---
`;

function generateChainedHook(hasWrappedHook) {
    let script = '#!/bin/sh\n';
    if (hasWrappedHook) {
        script += `# Gemstack Hook Dispatcher with Preserved User Hook\n\n`;
        script += `WRAPPED_HOOK="$(dirname "$0")/pre-commit.gemstack-wrapped"\n`;
        script += `if [ -f "$WRAPPED_HOOK" ]; then\n`;
        script += `    if ! "$WRAPPED_HOOK"; then\n`;
        script += `        echo "❌ ERROR: El pre-commit hook previo del usuario falló."\n`;
        script += `        exit 1\n`;
        script += `    fi\n`;
        script += `fi\n\n`;
    }
    script += GEMSTACK_SECURITY_BLOCK;
    script += '\nexit 0\n';
    return script;
}

function installHooks(targetDir = process.cwd()) {
    const gitDir = path.join(targetDir, '.git');
    const hooksDir = path.join(gitDir, 'hooks');
    const preCommitPath = path.join(hooksDir, 'pre-commit');

    if (!fs.existsSync(gitDir)) {
        logger.info('No se detectó un repositorio git. Omitiendo instalación de hooks.');
        return false;
    }

    try {
        if (!fs.existsSync(hooksDir)) {
            fs.mkdirSync(hooksDir, { recursive: true });
        }

        let hasWrappedHook = false;
        if (fs.existsSync(preCommitPath)) {
            const existingContent = fs.readFileSync(preCommitPath, 'utf8');
            if (!existingContent.includes('[Gemstack]')) {
                // Preserve user hook by renaming to wrapped script
                const wrappedPath = path.join(hooksDir, 'pre-commit.gemstack-wrapped');
                fs.writeFileSync(wrappedPath, existingContent, { mode: 0o755 });
                hasWrappedHook = true;
                logger.info('Pre-commit hook previo detectado: preservado como pre-commit.gemstack-wrapped.');
            }
        }

        const newHookContent = generateChainedHook(hasWrappedHook);
        fs.writeFileSync(preCommitPath, newHookContent, { mode: 0o755 });
        logger.ok('Git hooks (pre-commit) instalados exitosamente con encadenamiento seguro.');
        return true;
    } catch (err) {
        logger.error(`Error instalando git hooks: ${err.message}`);
        return false;
    }
}

async function hooksCommand(flags = {}) {
    const targetDir = typeof flags === 'string' ? flags : (flags.target || process.cwd());
    return installHooks(targetDir);
}

hooksCommand.installHooks = installHooks;
hooksCommand.detectSecrets = detectSecrets;
hooksCommand.SECRET_PATTERNS = SECRET_PATTERNS;

module.exports = hooksCommand;
