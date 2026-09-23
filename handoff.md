# Gemstack Handoff

## 1. Objetivo
Evolucionar Gemstack incorporando el feedback de producción real de proyectos activos:
1. Eliminar falsos positivos silenciosos en test runners en Windows/monorepos (Zero Silent Failures).
2. Ruteo semántico por intención (Intent-Based Routing) para interacción natural sin requerir `/comando`.
3. Sincronización automática del ciclo de vida en `.gemstack/state.json` al entregar (`/ship`) o documentar (`/handoff`).
4. Comando unificado `gemstack verify` (alias `audit`) para auditoría integral en un solo paso.

## 2. Estado actual
- **Upgrade A (Consistency Core & Phase Freezing)**: CERRADO Y PUBLICADO OFICIALMENTE en `v1.1.2`.
- **Upgrade B (Mechanical Test Matrix & Closure Evidence)**: CERRADO Y PUBLICADO OFICIALMENTE en `v1.2.0`.
- **Upgrade C (Cost & Provider Safety Gates)**: CERRADO Y VERIFICADO (`closure.json` status `VERIFIED`).
  - 20/20 pruebas canónicas P1 de Upgrade C pasando al 100% en 6 suites dedicadas.
  - Gates `ProviderCapabilityGate` y `BillableActionGate` implementados con fail-closed default deny.
  - Cost ledger (`cost-ledger.json`) validado, offline verification purity garantizada.
- **Upgrade D (Context Capsule / Context Compression)**: CERRADO Y VERIFICADO (`closure.json` status `VERIFIED`, capsule `VALID` y `FRESH`).
- **Upgrade E (Agent Swarm & Visual QA)**: CERRADO Y VERIFICADO (`v1.4.0`).
- **Gemstack 2.0 Sprint A (P0 Trust Boundaries & Hardening)**: CERRADO Y ENVIADO (commit `ba58055`).
  - Resolución de symlinks arbitrarios con `resolveSafeStrict` y denegación de rutas fuera de root.
  - Validación e integridad de skills remotos vía SHA-256 (`allowed_sources`).
  - Pre-commit hooks con bloqueo nativo de secretos.
  - Sanitización de variables de entorno y redacción estricta en logs.
- **Gemstack 2.0 Sprint B (P1 Honest Evidence & Reliable Metrics)**: CERRADO Y ENVIADO (commit `2bf9157`).
  - 14/14 pruebas canónicas aprobadas en `tests/honest-evidence-p1.test.js` (155 tests totales en 23 suites).
  - Tokens de gasto autenticados con HMAC y validación de presupuestos acumulativos en `BillableActionGate`.
  - Recálculo obligatorio de hashes de evidencia visual desde disco y degradación a `UNVERIFIED` en diff sin adaptador gráfico real.
  - Redacción previa de secretos y credenciales en evidencias antes de persistir en disco.
  - Eliminación de declaraciones superlativas sin evidencia; publicación de matriz 4-columnas `Control / Scope / Test / Limit` en README y reglas.
  - Pinned GitHub Actions a commit SHAs de 40 dígitos con least-privilege `contents: read`.
- **Gemstack 2.0 Sprint C (SDD Adaptable & Specs Incrementales)**: CERRADO Y ENVIADO (commit `443ae6c`).
  - 13/13 pruebas canónicas aprobadas en `tests/adaptable-sdd-p1.test.js`.
  - Cuatro niveles de rigor formalizados: `quick`, `fix`, `feature`, `high-risk`.
  - Declaración y aplicación de deltas incrementales `ADDED`, `MODIFIED`, `REMOVED`.
  - Detección offline de colisiones de contratos y duplicados de tests (`gemstack spec merge`).
  - Enmiendas auditables y firmadas criptográficamente para contratos congelados (`src/lib/contract-amendments.js`).
- **Gemstack 2.0 Sprint D (Contexto Eficiente y Memoria Persistente)**: CERRADO Y VERIFICADO.
  - 12/12 pruebas canónicas aprobadas en `tests/context-memory-p1.test.js` (180 tests totales en 23 suites).
  - Detección de fatiga de contexto y poda determinista de ruido (`src/lib/context-fatigue.js`).
  - Auditoría offline de dependencias huérfanas, no declaradas y ciclos circulares en `gemstack doctor` (`src/lib/dependency-audit.js`).
  - Verificación cruzada entre commits de Git y secciones de `handoff.md` en `gemstack verify` (`src/lib/memory-audit.js`).
  - Eliminación estricta de ruido conversacional y presupuesto determinista (< 32KB) en context capsules.

## 3. Archivos y cambios
- `src/lib/sdd-rigor.js`, `src/lib/spec-delta.js`, `src/lib/spec-merge.js`, `src/lib/contract-amendments.js`, `src/commands/spec.js`: Motores de rigor adaptable, deltas incrementales, fusión de especificaciones y enmiendas de contratos.
- `src/lib/context-fatigue.js`, `src/lib/dependency-audit.js`, `src/lib/memory-audit.js`: Motores de fatiga de contexto, auditoría offline de dependencias y auditoría cruzada de memoria con Git.
- `src/commands/doctor.js`, `src/commands/verify.js`, `src/cli.js`: Integración de auditoría offline de dependencias, verificación de memoria y registro de CLI `spec`.
- `tests/adaptable-sdd-p1.test.js`, `tests/context-memory-p1.test.js`: Suites de prueba canónicas P1 para Sprint C y Sprint D.
- `specs/013-gemstack-2.0-adaptable-sdd/`, `specs/014-gemstack-2.0-context-memory/`: Especificaciones formales, planes, tareas y manifiestos de cierre verificados mecánicamente.

## 4. Intentos fallidos
- Se confirmó en proyectos reales que scripts de prueba con sintaxis `2>nul` en `package.json` provocan que PowerShell/Bash enmascaren errores y retornen código de salida 0 con 0 tests ejecutados. Ahora esto es detectado como error por `gemstack verify` y prohibido en la Constitución.
- **2026-09-11**: En el reporte de Upgrade A, se produjo un drift en la nomenclatura y categorización de la matriz P1 canónica. Se restauró la correlación canónica estricta de 25 tests P1 aprobados y la regla estricta de parser de 2+ bloques -> CONTRACT_PARSE_ERROR.
- **Node 20+ Subprocess Recursion**: Al ejecutar `node --test` como subproceso desde un proceso de test runner, `process.env.NODE_TEST_CONTEXT` suprimía la ejecución de archivos hijos con warning de recursión. Se resolvió sanitizando las variables `NODE_TEST_CONTEXT` y `NODE_TEST_WORKER_ID` en el entorno del proceso hijo.
- **Windows spawn 'npm.cmd' EINVAL**: Node 22+ en Windows genera `EINVAL` al invocar `spawn('npm.cmd', ..., { shell: false })`. Se resolvió ejecutando directamente el binario `npm-cli.js` vía `process.execPath` cuando se detecta en Windows, respetando la regla constitucional de `shell: false`.
- **Closure Manifest Self-Reference**: Al incluir `specs/<feature>/closure.json` en los archivos de implementación de `tasks.md`, `closureContextHash` cambiaba cada vez que `closure.json` era escrito, provocando que la evidencia se marcara como `STALE` inmediatamente después de recolectarse. Se resolvió excluyendo explícitamente `closure.json` de la agregación de hashes de contexto de implementación (`implementationContextHash`).
- **Memory Cross-Audit Missing Section Handling**: En `crossAuditMemoryWithGit`, lanzar un `Error` no capturado interrumpía la secuencia de verificación de `verify.js`. Se resolvió retornando un objeto de resultado `{ valid: false, handoff_intact: false, error }`, permitiendo que el framework acumule los fallos según el protocolo constitucional sin abortar abruptamente.

## 5. Próximos pasos
1. Preparar la release `v2.0.0-alpha` unificando las 4 etapas de hardening de Gemstack 2.0 (Sprints A, B, C, D).
2. Publicación de notas de release destacando las nuevas garantías de seguridad, rigores adaptables y auditorías offline.
