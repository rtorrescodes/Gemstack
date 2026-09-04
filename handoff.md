# Gemstack Handoff

## 1. Objetivo
Evolucionar Gemstack incorporando el feedback de producción real de proyectos activos:
1. Eliminar falsos positivos silenciosos en test runners en Windows/monorepos (Zero Silent Failures).
2. Ruteo semántico por intención (Intent-Based Routing) para interacción natural sin requerir `/comando`.
3. Sincronización automática del ciclo de vida en `.gemstack/state.json` al entregar (`/ship`) o documentar (`/handoff`).
4. Comando unificado `gemstack verify` (alias `audit`) para auditoría integral en un solo paso.

## 2. Estado actual
- Reglas `01-gemstack-core.md` y `02-gemstack-constitution.md` actualizadas con ruteo por intención y Article III Zero Silent Failures (tanto en `.agents/` como en `template/.agents/`).
- Skills `gemstack-spec`, `gemstack-ship` y `gemstack-handoff` actualizadas con sincronización automática de estado.
- Comando `gemstack verify` implementado en `src/commands/verify.js`, registrado en `src/cli.js` y expuesto en `package.json` mediante `pnpm/npm run gemstack:verify`.
- Suite de pruebas ampliada con `tests/verify.test.js` (8/8 tests pasando).
- Validaciones de CI completas (`ci:frontmatter`, `ci:template`, `ci:mojibake`, `ci:package`, `ci:smoke`) pasando al 100%.

## 3. Archivos y cambios
- `.agents/rules/01-gemstack-core.md` y `template/...`: Sección de Intent-Based Routing añadida.
- `.agents/rules/02-gemstack-constitution.md` y `template/...`: Cláusula Zero Silent Failures en Article III.
- `.agents/skills/gemstack-spec/SKILL.md` y template: Sincronización de `active_spec`, `current_phase: "spec"` y timestamp.
- `.agents/skills/gemstack-ship/SKILL.md` y template: Cierre de `active_spec: null`, registro de `last_completed_feature` y `current_phase: "shipped"`.
- `.agents/skills/gemstack-handoff/SKILL.md` y template: Verificación y sincronización de fase y timestamp en `state.json`.
- `src/commands/verify.js`: Nuevo comando de auditoría integral.
- `src/cli.js`: Enrutador para `verify` y `audit`.
- `package.json`: Inclusión de script `gemstack:verify` y runner `tests/**/*.test.js`.
- `tests/verify.test.js`: Suite de pruebas para `verify`.
- `scripts/ci/smoke-cli.js`: Smoke test con `verify`.

## 4. Intentos fallidos
- Se confirmó en proyectos reales que scripts de prueba con sintaxis `2>nul` en `package.json` provocan que PowerShell/Bash enmascaren errores y retornen código de salida 0 con 0 tests ejecutados. Ahora esto es detectado como error por `gemstack verify` y prohibido en la Constitución.

## 5. Próximos pasos
1. Validar el nuevo ruteo semántico en sesiones de desarrollo reales.
2. Considerar `npx gemstack verify` en los hooks o pipelines de CI de proyectos que consumen Gemstack.
