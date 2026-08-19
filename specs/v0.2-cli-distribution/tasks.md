# Tareas de Implementación: Gemstack v0.2 (CLI Distribution)

Este documento contiene el plan de ejecución ejecutable (checklist) para el ciclo v0.2.

---

### Fase 0: Safeguards y Preparación
- [ ] **T0.1: Asegurar Entorno Base**
  - **Descripción:** Verificar el estado de git (working tree clean), confirmar que Node 18+ está disponible, y configurar el `package.json` con `"engines": { "node": ">=18.18.0" }`. Asegurar estatus No-Publish/No-Tag.
  - **Archivos:** `package.json`
  - **Criterio de Aceptación:** Configurado sin dependencias externas en `dependencies`, versión 0.2.0-draft u omitida.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 1: Estructura `template/`
- [ ] **T1.1: Crear Carpeta Template**
  - **Descripción:** Crear directorio `template/` y poblarlo con los skills y reglas estándar de `.agents/` del repositorio, omitiendo contenido custom o contexto privado de esta sesión.
  - **Archivos:** `template/.agents/*`
  - **Criterio de Aceptación:** Estructura clonada limpiamente sin borrar los `.agents` de la raíz del repo original.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.
- [ ] **T1.2: Inicializar Placeholders**
  - **Descripción:** Crear versiones limpias (placeholders) de `handoff.md`, `handoff_archive.md`, `.gemstack/learnings.md`, `.gemstack/state.json`, `specs/current/` (vacíos o con base) dentro de `template/`.
  - **Archivos:** `template/handoff.md`, etc.
  - **Criterio de Aceptación:** Los archivos reflejan estados "zero" sin historial privado del repo `Gemstack`.
  - **Riesgo:** Moderado (riesgo de fugas de privacidad si se copia el handoff real).
  - **Requiere Aprobación Humana:** No.

### Fase 2: CLI Core Zero-Deps
- [ ] **T2.1: Entrypoint y Parser**
  - **Descripción:** Crear `src/cli.js` y parsear manualmente `process.argv` para soportar flags como `--dry-run`, `--yes`, `--target`, `--force`. Añadir un logger seguro (ASCII, sin moijibakes).
  - **Archivos:** `src/cli.js`, `src/lib/logger.js`, `src/lib/parser.js`
  - **Criterio de Aceptación:** Parser soporta los flags requeridos sin arrojar errores o requerir paquetes externos. Logger imprime `[OK]`, `[INFO]`, `[FAIL]`.
  - **Riesgo:** Moderado (bugs de parsing de CLI manuales son comunes).
  - **Requiere Aprobación Humana:** No.

### Fase 3: Filesystem Safety
- [ ] **T3.1: Path Safety**
  - **Descripción:** Desarrollar librería nativa para prevenir directory traversals y operaciones inseguras (symlinks peligrosos).
  - **Archivos:** `src/lib/filesystem-safe.js`
  - **Criterio de Aceptación:** Toda escritura es analizada usando `path.resolve` e interrumpe con error si sale del target. No hay usos de `child_process.exec` para I/O.
  - **Riesgo:** Crítico (Riesgo de seguridad para el host).
  - **Requiere Aprobación Humana:** No.

### Fase 4: Manifest
- [ ] **T4.1: Mecanismo de Ownership**
  - **Descripción:** Desarrollar generador de `.gemstack/manifest.json`. Rastrear archivos Gemstack-owned y generar un checksum (MD5 o SHA256 usando el módulo nativo `crypto`).
  - **Archivos:** `src/lib/manifest.js`
  - **Criterio de Aceptación:** Puede parsear manifiestos existentes, generar nuevos y evaluar si un archivo mutó desde la última ejecución. Solo marca los propios.
  - **Riesgo:** Alto (Falsa detección de mutaciones puede asustar al usuario).
  - **Requiere Aprobación Humana:** No.

### Fase 5: Backup
- [ ] **T5.1: Gestor de Respaldo Seguro**
  - **Descripción:** Desarrollar creador automático de `.gemstack/backups/<timestamp>/manifest.json` y carpetas de copia física antes de sobrescribir. Evitar logging del contenido en pantalla.
  - **Archivos:** `src/lib/backup.js`
  - **Criterio de Aceptación:** Las colisiones previas a un over-write terminan copiadas intactas aquí. El log en consola solo menciona el PATH.
  - **Riesgo:** Alto (Errores aquí conllevan data loss irrecuperable).
  - **Requiere Aprobación Humana:** No.

### Fase 6: Comando `init`
- [ ] **T6.1: Lógica de Inicialización**
  - **Descripción:** Crear `src/commands/init.js`. Copia el framework desde `template/` usando la safety layer. Responde dinámicamente a `--dry-run` y `--target`. Patch a `.gitignore` sin duplicar.
  - **Archivos:** `src/commands/init.js`, `src/lib/gitignore.js`
  - **Criterio de Aceptación:** No sobrescribe NADA custom. Evita `handoff.md` si ya existe. Marca bloques `# Gemstack` en `gitignore`.
  - **Riesgo:** Alto.
  - **Requiere Aprobación Humana:** No.

### Fase 7: Comando `update`
- [ ] **T7.1: Lógica de Sincronización Segura**
  - **Descripción:** Crear `src/commands/update.js`. Usa el manifest para sincronizar. Fuerza backup antes de reemplazar. Protege `handoff.md` explícitamente. Usa `--force` para saltarse rechazos en archivos drifteados.
  - **Archivos:** `src/commands/update.js`
  - **Criterio de Aceptación:** Nunca reemplaza código ajeno al manifest. Maneja bien `--dry-run`.
  - **Riesgo:** Alto (Destructivo si el safety falla).
  - **Requiere Aprobación Humana:** No.

### Fase 8: Comandos Auxiliares
- [ ] **T8.1: Portar Scripts Bash/PS a Node.js**
  - **Descripción:** Recrear `list.js`, `show.js` y `doctor.js` de la v0.1 leyendo los archivos instalados localmente.
  - **Archivos:** `src/commands/list.js`, `src/commands/show.js`, `src/commands/doctor.js`
  - **Criterio de Aceptación:** Operan de manera cross-platform 100% nativa.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 9: Pruebas `node:test`
- [ ] **T9.1: Testing Exhaustivo (Zero Deps)**
  - **Descripción:** Implementar suite en `tests/`. Cubrir todos los requerimientos críticos (Path Traversal Bloqueado, Init idempotente, Backup existoso, Dry-Run no muta).
  - **Archivos:** `tests/init.test.js`, `tests/update.test.js`, `tests/safety.test.js`
  - **Criterio de Aceptación:** 100% Passing tests.
  - **Riesgo:** Medio (Asegurar que los mocks de fs temp sean limpios).
  - **Requiere Aprobación Humana:** No.

### Fase 10: Documentación
- [ ] **T10.1: Actualizar Docs de Distribución**
  - **Descripción:** Documentar uso vía NPM (Link/Pack). Escribir Draft de Release Notes para futura v0.2.
  - **Archivos:** `README.md`, `docs/release.md`
  - **Criterio de Aceptación:** Instrucciones claras advirtiendo que `npm publish` no está habilitado todavía, pero puede usarse `npm pack`.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** No.

### Fase 11: Validation
- [ ] **T11.1: Verificación End-to-End Local**
  - **Descripción:** Correr `npm test`. Usar `npm pack` y luego instalar ese pack local en una carpeta temporal con un dummy. Validar el CLI desde fuera.
  - **Archivos:** Ninguno
  - **Criterio de Aceptación:** Empaquetado Node funciona sin emitir warnings de symlinks rotos, todos los tests pasan local.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** **SÍ (Aprobación del dev sobre el resultado reportado).**

### Fase 12: Commit, Push y Handoff
- [ ] **T12.1: Finalización Segura**
  - **Descripción:** Validar `git status` (no logs, node_modules ni tarballs), hacer Commit, Push y actualizar Handoff Final de Sesión.
  - **Archivos:** `handoff.md`
  - **Criterio de Aceptación:** Working tree limpio, versionado correcto.
  - **Riesgo:** Bajo.
  - **Requiere Aprobación Humana:** **SÍ (Se requiere confirmación para commit y fin).**
