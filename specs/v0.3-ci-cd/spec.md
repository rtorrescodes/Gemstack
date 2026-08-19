# Spec: Gemstack v0.3 (CI/CD & Release Automation)

## 1. Goal
Diseñar e implementar un sistema robusto de integración y entrega continua (CI/CD) utilizando GitHub Actions para validar y proteger la calidad de Gemstack en cada cambio, asegurando compatibilidad multiplataforma y previniendo el filtrado accidental de secretos o contextos privados, todo esto sin habilitar despliegues automatizados no supervisados (ej. `npm publish`).

## 2. Core Requirements

### 2.1. Workflows
Se dividirán las responsabilidades lógicas en, idealmente, dos flujos:
1. **CI Normal (Push / PR):** Validaciones exhaustivas que bloquean la integración de código roto o contaminado.
2. **Release Readiness (Workflow Dispatch):** Flujo de preparación manual que empaca el proyecto y potencialmente crea un GitHub Release, pero que bajo ninguna circunstancia ejecuta `npm publish`.

### 2.2. Matrix Testing
- **Sistemas Operativos:** `ubuntu-latest`, `windows-latest`, `macos-latest`.
- **Node.js Versions:** `18.18.0` (mínimo exigido) y `20.x` (LTS actual) / `22.x` (Latest).

### 2.3. CI Validation Steps (Checks)
- **Unit & Packaging Tests:**
  - `npm test` (pruebas nativas).
  - `npm run pack:dry` (validación del bundle).
- **CLI Smoke Tests (Cross-platform):**
  - `node src/cli.js --help`
  - `node src/cli.js list`
  - `node src/cli.js show gemstack-handoff`
  - `node src/cli.js init --dry-run --target <temp-dir>`
  - `node src/cli.js init --yes --target <temp-dir>`
  - `node src/cli.js update --dry-run --target <temp-dir>`
- **Demo App Verification:**
  - `cd demo-app && npm install`
  - `npm run smoke` (valida defensas anti-IDOR).
- **Cleanliness & Integrity Assertions:**
  - **No Forbidden Files:** Asegurar que el repo (y el paquete) no contengan `node_modules`, `*.sqlite`, `*.tgz`, backups (`.gemstack/backups/`) o archivos temporales no ignorados.
  - **Package Contents:** Analizar la salida del tarball para confirmar ausencia de assets restringidos.
  - **YAML Frontmatter:** Analizar todos los `.agents/skills/*/SKILL.md` asegurando que el YAML inicial es sintácticamente válido.
  - **Template Sandbox:** Comprobar que `template/handoff.md`, `template/handoff_archive.md` y `template/.gemstack/state.json` contengan estados limpios y no el texto real de la memoria de Gemstack.
  - **No Mojibake:** Búsqueda simple de caracteres rotos (ej. `Ã³`) en docs/scripts que indican falla de encoding.

### 2.4. Seguridad y Caching
- Configurar cachés seguros para Node Modules de la `demo-app` (`actions/cache`).
- Activar enmascaramiento automático de salidas y uso estricto de secretos (`${{ secrets.GITHUB_TOKEN }}`).
- Deshabilitar triggers automáticos de publicación en NPM.

### 2.5. Artifacts y Badges
- **Artifacts:** Se subirá el archivo `gemstack-*.tgz` resultante de un `npm pack` como un Build Artifact para ser descargable desde la tab de Actions.
- **Badges:** Se añadirá el Badge dinámico de GitHub Actions en el `README.md`.

## 3. Edge Cases & Risks
- **Diferencias de File System (Windows vs Unix):** El manejo de rutas relativas y saltos de línea (CRLF vs LF) puede fallar las validaciones de checksum en Git o CI si no están configurados los `.gitattributes`.
- **Rutas Largas en Windows:** `npm` a veces sufre en Windows con anidamientos profundos, los paths de los tests temporales deben ser cortos.
- **Falsos Positivos en la Verificación de "Mojibake":** Restringir la validación de encoding a patrones conocidos (`Ã`, ``) sin bloquear caracteres legítimos en UTF-8 o en español.

## 4. Acceptance Criteria
- Todos los Pull Requests hacia `main` disparan el flujo CI.
- Los tests corren en las 3 plataformas y 2 versiones de Node de forma paralela.
- Cualquier detección de un archivo `.sqlite` o `handoff.md` sucio en la carpeta `template/` rompe automáticamente el build.
- Existe un trigger manual que genera un `.tgz` y lo adjunta como Release Draft en GitHub.
- NPM Publish no está configurado de forma autónoma.
