# Gemstack Handoff

## 1. Objetivo
Evolucionar Gemstack incorporando el feedback de producción real de proyectos activos:
1. Eliminar falsos positivos silenciosos en test runners en Windows/monorepos (Zero Silent Failures).
2. Ruteo semántico por intención (Intent-Based Routing) para interacción natural sin requerir `/comando`.
3. Sincronización automática del ciclo de vida en `.gemstack/state.json` al entregar (`/ship`) o documentar (`/handoff`).
4. Comando unificado `gemstack verify` (alias `audit`) para auditoría integral en un solo paso.

## 2. Estado actual
- **Upgrade A (Consistency Core & Phase Freezing)**: CERRADO Y PUBLICADO OFICIALMENTE como `gemstack-ai@1.1.2` en npm y GitHub Release (`GEMSTACK v1.1.2 RELEASED — GITHUB + NPM VERIFIED`).
- Historial de release:
  - `v1.1.0`: Release automation falló antes de publicar debido a glob recursivo no portable en runner Linux (`tests/**/*.test.js`).
  - `v1.1.1`: Comando de testing explicitado para portabilidad; detectó fallo en `TEST-CONSISTENCY-G01` en Linux por dependencia de host en `path.relative()`.
  - `v1.1.2`: Corrección definitiva de canonicalización con detección de flavor (`path.win32` vs `path.posix`); CI pasó al 100%, npm publish exitoso y GitHub Release creado.
- 17/17 tareas completadas, 25/25 tests canónicos P1 pasando (33/33 físicos), 0 bloqueadores.

## 3. Archivos y cambios
- `src/lib/hasher.js`: Detección estructural de path-flavor (`path.win32` vs `path.posix`) para canonicalización multiplataforma inmune al SO host.
- `tests/hasher.test.js`: Suite G01 ampliada con pruebas de paths Windows y POSIX ejecutables en cualquier sistema operativo.
- `src/lib/contracts.js`: Parser column-0 fenced, esquemas de 6 contratos, resolución de herencia y detección de contradicciones.
- `src/lib/findings.js`: Fingerprints canónicos SHA-256 de 64 caracteres, display token de 12 caracteres y excepciones con `contextHash`.
- `src/lib/state.js`: Persistencia atómica de `state.json` (solo operativo) y sidecar histórico `.gemstack.json`.
- `src/commands/verify.js`: Paso 4/5 de consistencia arquitectónica y hashes congelados.
- `tests/`: 5 suites unitarias con comando de test explícito y determinista en `package.json`.
- `docs/architecture-consistency.md`: Referencia técnica integral de consistencia y congelamiento de fases.
- `CHANGELOG.md`, `README.md`, `RELEASE_NOTES.md`, `package.json`: Actualizados a v1.1.2.

## 4. Intentos fallidos
- Se confirmó en proyectos reales que scripts de prueba con sintaxis `2>nul` en `package.json` provocan que PowerShell/Bash enmascaren errores y retornen código de salida 0 con 0 tests ejecutados. Ahora esto es detectado como error por `gemstack verify` y prohibido en la Constitución.
- **2026-09-11**: En el reporte de Upgrade A, se produjo un drift en la nomenclatura y categorización de la matriz P1 canónica (mencionando A04-A06, D03-D04, E03 y sugiriendo incorrectamente merge de múltiples bloques). Se restauró la correlación canónica estricta de 25 tests P1 aprobados (A=3, B=8, C=4, D=2, E=2, F=2, G=2, H=2) y la regla estricta de parser de 2+ bloques -> CONTRACT_PARSE_ERROR.

## 5. Próximos pasos
1. Validar el nuevo ruteo semántico en sesiones de desarrollo reales.
2. Considerar `npx gemstack verify` en los hooks o pipelines de CI de proyectos que consumen Gemstack.
