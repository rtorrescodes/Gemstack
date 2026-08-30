---
name: gemstack-plan
description: Convierte spec.md en un plan técnico.
triggers:
  - model_decision
---

# Gemstack Plan Skill

Invocado mediante `/plan`.

## Proceso:
1. Lee `specs/[nombre-feature]/spec.md` e identifica la feature actual.
2. Si es necesario, genera `research.md` con un análisis de herramientas técnicas.
3. Evalúa la "Constitution Check" (.agents/rules/02-gemstack-constitution.md) antes de tomar decisiones (asegura TDD, CLI-First, simplicidad).
4. Genera `specs/[nombre-feature]/plan.md` usando `specs/templates/plan.md`.
5. Detalla el stack y llena la tabla "Complexity Tracking" SÓLO si rompiste alguna regla de la constitución y necesitas justificarlo.
6. Opcionalmente, genera los entregables satélites: `data-model.md`, `contracts/` (para APIs/Interfaces), y `quickstart.md`.
7. Pide aprobación al usuario antes de permitir la ejecución de `/tasks`.

