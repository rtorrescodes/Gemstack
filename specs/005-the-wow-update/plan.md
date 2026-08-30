# Plan de Implementación: The "WOW" Update

**Feature Branch**: `005-the-wow-update` | **Spec**: `specs/005-the-wow-update/spec.md`

## 1. Summary & Technical Context
Se introducirán 4 nuevas capacidades de autonomía extrema en el motor de Gemstack: QA Visual (`/qa-visual`), Swarm Multiplexing (`/swarm`), Auto-Sanación CI/CD (`/heal`) y Seguridad de Contenedores (`/sandbox`). Esto se implementa añadiendo los SKILLs correspondientes.

- **Lenguaje/Versión**: Markdown + YAML (Arquitectura SDD nativa del agente).
- **Dependencias core**: Ninguna adicional localmente. (Docker, Playwright y CLI de GitHub se asumen como externos si la IA los necesita).

## 2. Constitution Check (Phase -1 Gates)
### Simplicity Gate (Article VII)
- [x] ¿Se usan el mínimo número de carpetas/archivos posibles? *(Sí, un archivo de skill MD por feature).*
### Anti-Abstraction Gate (Article VIII)
- [x] ¿Se usan las APIs nativas del framework sin wrappers innecesarios? *(Los skills orquestarán comandos nativos).*
### Test-First Imperative (Article III)
- [x] ¿El plan incluye la creación de tests antes que el código fuente? *(Como es configuración AI, el framework central verificará la inicialización de estos nuevos skills).*

## 3. Entregables Satélites a Generar
- No aplican modelos de datos nuevos.

## 4. Estructura de Archivos a Modificar / Crear
```text
.agents/rules/01-gemstack-core.md: [MODIFICADO] Añadir mapeo de nuevos comandos.
.agents/skills/gemstack-qa-visual/SKILL.md: [NUEVO] Skill.
.agents/skills/gemstack-swarm/SKILL.md: [NUEVO] Skill.
.agents/skills/gemstack-heal/SKILL.md: [NUEVO] Skill.
.agents/skills/gemstack-sandbox/SKILL.md: [NUEVO] Skill.
```
