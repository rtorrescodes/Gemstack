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
  - 20/20 pruebas canónicas de Upgrade D pasando al 100% en 8 suites dedicadas.
  - Serializador canónico determinista, defensa de secretos fail-closed, presupuesto 32KB/64KB.
  - Comandos CLI `gemstack context` y etapa 5.2 en `gemstack verify`.
  - 100/100 pruebas físicas totales pasando en 25 suites sin dependencias externas.
  - Preparado para release estable `v1.3.0`.

## 3. Archivos y cambios
- `src/lib/test-matrix.js`: Parser de `gemstack-test-matrix`, validación de esquema de 20 tests canónicos y cálculo de `acceptanceSignature` canónico SHA-256.
- `src/lib/closure-context.js`: Parser de bindings y gates de `plan.md`, metadatos de `tasks.md`, trazabilidad bidireccional, resolución de `RelevantClosureFiles`, `computeContentAggregateHash` y cálculo de `closureContextHash`.
- `src/lib/runner-adapters.js`: Adaptador nativo seguro de runner `node:test`, parser TAP de resultados, motor de reconciliación aritmética canónica, ejecutor seguro de compuertas `PACKAGE_SCRIPT` y serializador atómico de `closure.json`.
- `src/commands/collect.js`: Comando mutador dedicado que ejecuta tests y gates para generar `specs/<feature>/closure.json`.
- `src/commands/ship.js`: Compuerta de transición a `SHIPPED` que exige evidencia de cierre fresca y verificada.
- `src/commands/verify.js`: Etapa 5/6 agregada de verificación de evidencia mecánica de cierre en modo estrictamente de solo lectura (0 mutaciones en disco).
- `src/cli.js`: Registro de comandos `collect` y `ship`.
- `specs/007-mechanical-test-matrix-closure-evidence/`: Artefactos congelados `spec.md`, `plan.md`, `tasks.md` y evidencia de cierre generada `closure.json`.
- `tests/`: 6 nuevas suites de prueba (`test-matrix.test.js`, `reconciliation.test.js`, `runner-adapter.test.js`, `traceability.test.js`, `closure-manifest.test.js`, `closure-gates.test.js`).
- `specs/templates/`: Actualizadas plantillas de `spec.md`, `plan.md` y `tasks.md` con bloques canónicos de Upgrade B.
- `.agents/skills/`: Actualizados skills (`gemstack-spec`, `gemstack-plan`, `gemstack-tasks`, `gemstack-qa`, `gemstack-ship`).
- `docs/`, `README.md`, `package.json`: Documentación técnica y script de test con enumeración explícita de las 11 suites físicas.

## 4. Intentos fallidos
- Se confirmó en proyectos reales que scripts de prueba con sintaxis `2>nul` en `package.json` provocan que PowerShell/Bash enmascaren errores y retornen código de salida 0 con 0 tests ejecutados. Ahora esto es detectado como error por `gemstack verify` y prohibido en la Constitución.
- **2026-09-11**: En el reporte de Upgrade A, se produjo un drift en la nomenclatura y categorización de la matriz P1 canónica. Se restauró la correlación canónica estricta de 25 tests P1 aprobados y la regla estricta de parser de 2+ bloques -> CONTRACT_PARSE_ERROR.
- **Node 20+ Subprocess Recursion**: Al ejecutar `node --test` como subproceso desde un proceso de test runner, `process.env.NODE_TEST_CONTEXT` suprimía la ejecución de archivos hijos con warning de recursión. Se resolvió sanitizando las variables `NODE_TEST_CONTEXT` y `NODE_TEST_WORKER_ID` en el entorno del proceso hijo.
- **Windows spawn 'npm.cmd' EINVAL**: Node 22+ en Windows genera `EINVAL` al invocar `spawn('npm.cmd', ..., { shell: false })`. Se resolvió ejecutando directamente el binario `npm-cli.js` vía `process.execPath` cuando se detecta en Windows, respetando la regla constitucional de `shell: false`.
- **Closure Manifest Self-Reference**: Al incluir `specs/<feature>/closure.json` en los archivos de implementación de `tasks.md`, `closureContextHash` cambiaba cada vez que `closure.json` era escrito, provocando que la evidencia se marcara como `STALE` inmediatamente después de recolectarse. Se resolvió excluyendo explícitamente `closure.json` de la agregación de hashes de contexto de implementación (`implementationContextHash`).

## 5. Próximos pasos
1. Completar la publicación y git tag de la versión minor `v1.3.0`.
2. Proceder a Upgrade E (SPEC ONLY) una vez autorizada la fase siguiente.
