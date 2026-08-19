# Tareas de Implementación: Gemstack v0.3 (CI/CD & Release Automation)

Este documento contiene el plan de ejecución ejectuable (checklist) para el ciclo v0.3.

---

### Fase 0: Preflight
- [ ] **T0.1: Asegurar Entorno Limpio**
  - **Descripción:** Verificar con `git status` que no existan implementaciones previas, archivos colgados, etiquetas recién creadas ni subidas a NPM publicadas.
  - **Archivos:** Ninguno
  - **Criterio de Aceptación:** Working tree clean.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 1: `.gitattributes`
- [ ] **T1.1: Estandarización de Line Endings**
  - **Descripción:** Crear `.gitattributes` conservador para prevenir fallos de SHA-256 cross-platform. Ejecutar `git status` y pausar si se normaliza excesivamente.
  - **Archivos:** `.gitattributes`
  - **Criterio de Aceptación:** Archivo creado. El Churn de EOL no debe romper archivos binarios.
  - **Riesgo:** Alto (Normalización masiva o corrupción de binarios si las reglas son muy globales).
  - **Requiere Aprobación Humana:** **SÍ** (Si `git status` muestra más de 10 archivos modificados únicamente por EOL).

### Fase 2: `scripts/ci/`
- [ ] **T2.1: Validadores Nativos Zero-Deps**
  - **Descripción:** Implementar validadores de calidad.
    1. `check-frontmatter.js`: Revisa formato YAML en `.agents/skills/*/SKILL.md`.
    2. `check-template-clean.js`: Revisa ausencia de contexto privado y secretos en `template/`.
    3. `check-mojibake.js`: Busca caracteres rotos en UTF-8 (ej: `Ã`).
    4. `check-package-contents.js`: Realiza inspección tras `npm pack --dry-run`.
    5. `smoke-cli.js`: Prueba programática (e2e) en directorios temporales de todas las ramas del CLI (`help`, `doctor`, `init`, `update`).
  - **Archivos:** `scripts/ci/*.js`
  - **Criterio de Aceptación:** Cross-platform (Win/Mac/Linux), cero dependencias externas de npm.
  - **Riesgo:** Moderado (Incompatibilidad en spawns de child processes en Windows vs Unix).
  - **Requiere Aprobación Humana:** No.

### Fase 3: Package Scripts
- [ ] **T3.1: Configuración de npm run alias**
  - **Descripción:** Extender el bloque `scripts` en `package.json` insertando `ci:frontmatter`, `ci:template`, `ci:mojibake`, `ci:package`, `ci:smoke` y un atajo `ci:all`.
  - **Archivos:** `package.json`
  - **Criterio de Aceptación:** Ejecutar `npm run ci:all` lanza secuencialmente la batería de checks.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 4: Workflow `pr-ci.yml`
- [ ] **T4.1: CI Eficiente para Pull Requests**
  - **Descripción:** Workflow rápido basado en Ubuntu con Matrix en Node 18 y 20. Ejecuta las validaciones `ci:all`, `npm test` y el smoke test de la `demo-app`.
  - **Archivos:** `.github/workflows/pr-ci.yml`
  - **Criterio de Aceptación:** El YAML es sintácticamente válido para Actions y optimiza el uso de CPU.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 5: Workflow `main-ci.yml`
- [ ] **T5.1: CI Exhaustivo para la Rama Principal**
  - **Descripción:** Se lanza tras merges y pushes a `main`. Emplea una Matrix completa (Windows, macOS, Ubuntu) en Node 18 y 20.
  - **Archivos:** `.github/workflows/main-ci.yml`
  - **Criterio de Aceptación:** Todos los tests y utilidades CI se mapean multiplataforma de forma estricta.
  - **Riesgo:** Medio (Desviación en OS, comandos bash que fallen en el runner de Windows).
  - **Requiere Aprobación Humana:** No.

### Fase 6: Workflow `release-readiness.yml`
- [ ] **T6.1: Generación y Validación de Tarball Manual**
  - **Descripción:** Trigger exclusivo `workflow_dispatch`. Realiza un test cross-platform donde genera un `.tgz`, levanta un proyecto vacío en otra carpeta temporal, lo instala con NPM y realiza comprobaciones unitarias `npx gemstack` reales de punta a punta. Sube el `.tgz` como artefacto final.
  - **Archivos:** `.github/workflows/release-readiness.yml`
  - **Criterio de Aceptación:** NO efectúa tags, NPM publish, ni GitHub Releases automáticamente.
  - **Riesgo:** Medio (Estructura de logs pesada o fallo en instalación del paquete local del tarball).
  - **Requiere Aprobación Humana:** No.

### Fase 7: Documentación
- [ ] **T7.1: Badge CI y Notas**
  - **Descripción:** Agregar badge de CI a la cabecera de `README.md`. Preparar borrador de notas en `RELEASE_NOTES.md` o `CHANGELOG.md` describiendo la infraestructura CI.
  - **Archivos:** `README.md`, `CHANGELOG.md`, `docs/release.md`
  - **Criterio de Aceptación:** Información asertiva y documentada.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 8: Validación Local
- [ ] **T8.1: Prueba del Suite Completo Local**
  - **Descripción:** Correr `npm test`, `npm run ci:all`, comprobar si `demo-app` no sufre regresiones.
  - **Archivos:** Ninguno.
  - **Criterio de Aceptación:** Todos los scripts retornan un exit code `0`. Sin archivos `temp` huérfanos residuales.
  - **Riesgo:** Medio (Tiempos de ejecución o errores no controlados si fallan limpiezas `tmp`).
  - **Requiere Aprobación Humana:** **SÍ** (Aprobación si se detectan anomalías de basura en disco).

### Fase 9: Revisión de Seguridad y QA Agentic
- [ ] **T9.1: Emulación de Audits `/review` y `/cso`**
  - **Descripción:** Evaluar los workflows implementados contra vulnerabilidades (Supply Chain, Secret Leaks, Privilegios del GITHUB_TOKEN). Actualizar los docs.
  - **Archivos:** `docs/reviews/latest-review.md`, `docs/security/latest-security-audit.md`
  - **Criterio de Aceptación:** Análisis honesto registrando deficiencias o limitantes de la CI.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 10: Commit, Push y Handoff
- [ ] **T10.1: Integración Final**
  - **Descripción:** Confirmar árbol limpio mediante `git status -u`. Efectuar commit, push e incorporar memoria al `handoff.md`. Push final.
  - **Archivos:** `handoff.md`
  - **Criterio de Aceptación:** Sin rastros de builds. Versionado estable listo para activar en GitHub Actions.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** **SÍ** (Confirmar antes de commit y push).
