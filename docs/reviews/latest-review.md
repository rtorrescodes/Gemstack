# Última Revisión de Gemstack (Auto-Review)
**Fecha:** 2026-08-19
**Tipo:** Dogfooding /review

## Consistencia de Nombres
- ✅ Todos los skills siguen el formato `gemstack-<nombre>`.
- ✅ Los comandos del CLI coinciden con la documentación (`init`, `list`, `show`, `doctor`, `handoff`, `security-audit`).

## Documentación vs Skills
- ✅ `docs/skills.md` lista todos los 26 pseudo-comandos y los enruta correctamente.
- ✅ Los comandos en el README coinciden con los disponibles.

## Errores Obvios Corregidos
- **YAML Frontmatter:** Se corrigió el key de `trigger` a `triggers` como array en todos los archivos `.agents/skills/*/SKILL.md` y `01-gemstack-core.md`.
- **Bash Scripts en Windows:** Al ejecutar `bin/gemstack-doctor` a través de WSL, el entorno actual arroja un error (`execvpe failed`). Se documenta que en Windows nativo sin WSL se debe depender de PowerShell o inspección manual por ahora, pero la lógica del script está saneada para prevenir falsos positivos (ej. "✅ Git no instalado").

## Gaps para v0.2
- Añadir versiones en PowerShell (`.ps1`) para los scripts de inicialización nativos en Windows.
- Tests automatizados del ruteador de Antigravity.
