# Tareas de Implementación: Gemstack 2.0 Hardening (Sprint A)

**Feature Branch**: `011-gemstack-2.0-hardening`  
**Feature Directory**: `specs/011-gemstack-2.0-hardening/`  
**Lifecycle Status**: `TASKS_COMPLETE`  
**Stop Reason**: `TASKS_COMPLETE_AWAITING_IMPLEMENTATION`

---

## Inventario de Tareas

- [ ] **TASK-001: Implementar suite adversarial P0 reproduciendo vulnerabilidades de base 1.4.0**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-A01, TEST-HARDEN-A02, TEST-HARDEN-A03, TEST-HARDEN-A04, TEST-HARDEN-A05, TEST-HARDEN-B01, TEST-HARDEN-B02, TEST-HARDEN-B03, TEST-HARDEN-B04, TEST-HARDEN-C01, TEST-HARDEN-C02, TEST-HARDEN-C03, TEST-HARDEN-C04, TEST-HARDEN-C05, TEST-HARDEN-C06 -->
  <!-- gemstack:files=tests/security-p0-hardening.test.js -->
  <!-- gemstack:depends= -->
  Crear la suite de pruebas `tests/security-p0-hardening.test.js` que ejercita ataques adversariales contra skills remotos (HTTP, SSRF, payload gigante, slugs maliciosos), symlinks saliendo de raíz, destrucción de pre-commit existente y evasión de escaneo de secretos.

- [ ] **TASK-002: Contención estricta de filesystem y resolución realpath en filesystem-safe.js**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-B01, TEST-HARDEN-B02, TEST-HARDEN-B03, TEST-HARDEN-B04 -->
  <!-- gemstack:files=src/lib/filesystem-safe.js -->
  <!-- gemstack:depends=TASK-001 -->
  Implementar `resolveSafeStrict` usando `fs.realpathSync` para verificar que ningún enlace simbólico existente ni componente intermedio escape de la raíz del proyecto. Confinar escrituras temporales atómicas a `.gemstack/tmp/`.

- [ ] **TASK-003: Blindar descarga e instalación de skills remotos en install.js**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-A01, TEST-HARDEN-A02, TEST-HARDEN-A03, TEST-HARDEN-A04, TEST-HARDEN-A05 -->
  <!-- gemstack:files=src/commands/install.js -->
  <!-- gemstack:depends=TASK-001, TASK-002 -->
  Implementar política HTTPS obligatoria, bloqueo de IPs privadas/loopback (SSRF), timeout de 8000ms, límite de 256 KB en streaming, validación estricta de slug (`^[a-z0-9][a-z0-9-_]{1,63}$`) y pre-inspección de fingerprint SHA-256 antes de persistir en disco.

- [ ] **TASK-004: Preservación de git hooks existentes y escaneo ampliado de secretos en hooks.js**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-C01, TEST-HARDEN-C02, TEST-HARDEN-C03, TEST-HARDEN-C04, TEST-HARDEN-C05 -->
  <!-- gemstack:files=src/commands/hooks.js -->
  <!-- gemstack:depends=TASK-001 -->
  Modificar el instalador de hooks para preservar y encadenar hooks preexistentes del usuario. Ampliar el escáner a Google Gemini, OpenAI, Anthropic, GitHub PAT, Slack y claves privadas RSA/SSH.

- [ ] **TASK-005: Script de verificación de secretos en CI e integración con ci:all**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-C06 -->
  <!-- gemstack:files=scripts/ci/check-secrets.js, package.json -->
  <!-- gemstack:depends=TASK-004 -->
  Crear `scripts/ci/check-secrets.js` con cero dependencias externas y conectarlo en el script `ci:all` de `package.json`.

- [ ] **TASK-006: Auditoría de contención en call sites CLI (init, update, install, backup, vqa)**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-B04 -->
  <!-- gemstack:files=src/commands/init.js, src/commands/update.js, src/commands/install.js, src/lib/backup.js, src/commands/visual.js -->
  <!-- gemstack:depends=TASK-002, TASK-003 -->
  Auditar y conectar `resolveSafeStrict` en todos los comandos para garantizar que ninguna operación pueda crear, modificar o leer archivos fuera de los límites del repositorio.

- [ ] **TASK-007: Cierre mecánico, ejecución de matriz completa y generación de closure.json**
  <!-- gemstack:validation_required=true -->
  <!-- gemstack:tests=TEST-HARDEN-A01, TEST-HARDEN-A02, TEST-HARDEN-A03, TEST-HARDEN-A04, TEST-HARDEN-A05, TEST-HARDEN-B01, TEST-HARDEN-B02, TEST-HARDEN-B03, TEST-HARDEN-B04, TEST-HARDEN-C01, TEST-HARDEN-C02, TEST-HARDEN-C03, TEST-HARDEN-C04, TEST-HARDEN-C05, TEST-HARDEN-C06 -->
  <!-- gemstack:files=specs/011-gemstack-2.0-hardening/closure.json -->
  <!-- gemstack:depends=TASK-001, TASK-002, TASK-003, TASK-004, TASK-005, TASK-006 -->
  Ejecutar `gemstack collect` para correr toda la matriz de pruebas unitarias, de integración y CI, verificar status VERIFIED y dejar la evidencia de cierre lista.
