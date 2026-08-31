const fs = require('fs');
const path = require('path');
const logger = require('../lib/logger');

const PRE_COMMIT_HOOK = `#!/bin/sh
# Gemstack - Git Pre-commit Hook
# Este hook previene que subas secretos o rompas la Ley de Seguridad (Rule 03).

echo "[Gemstack] Ejecutando análisis de seguridad local..."

# 1. Evitar que se suban archivos .env
if git diff --cached --name-only | grep -E "^\\.env|\\.env\\.local|\\.env\\.production" > /dev/null; then
    echo "❌ ERROR (Gemstack): Estás intentando hacer commit de un archivo .env"
    echo "Regla 03: Gestión de Secretos. Remuévelo usando 'git reset HEAD <archivo>' y añádelo al .gitignore."
    exit 1
fi

# 2. Buscar marcadores de conflicto de merge olvidados
if git diff --cached -S"<<<<<<< HEAD" --quiet; then
    # -quiet retorna 0 si encuentra coincidencias (no output)
    :
else
    # Si git diff encuenta "<<<<<<<"
    if git diff --cached | grep -E "^\\+<<<<<<<" > /dev/null; then
        echo "❌ ERROR (Gemstack): Hay marcadores de conflicto de git (<<<<<<<) en tus archivos."
        echo "Resuélvelos antes de hacer commit."
        exit 1
    fi
fi

# 3. Buscar posibles llaves expuestas (Stripe, AWS, JWT genéricos) en código agregado
# Extrae las líneas añadidas y busca patrones peligrosos
if git diff --cached | grep -E "^\\+.*(sk_live_|sk_test_|AKIA[0-9A-Z]{16}|xoxb-|ghp_)" > /dev/null; then
    echo "❌ ERROR (Gemstack/CSO): ¡Posible llave secreta detectada en el código!"
    echo "Regla 03: Cero Exposición de Credenciales. Extrae el secreto a una variable de entorno."
    exit 1
fi

echo "✅ [Gemstack] Código limpio. Committing..."
exit 0
`;

function installHooks(targetDir) {
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

        fs.writeFileSync(preCommitPath, PRE_COMMIT_HOOK, { mode: 0o755 });
        logger.ok('Git hooks (pre-commit) instalados exitosamente.');
        return true;
    } catch (err) {
        logger.error(`Error instalando git hooks: ${err.message}`);
        return false;
    }
}

module.exports = { installHooks };
