---
name: gemstack-tasks
description: Convierte un plan.md en tareas ejecutables.
triggers:
  - model_decision
---

# Gemstack Tasks Skill

Invocado mediante `/tasks`.

## Proceso:
1. Lee `specs/current/plan.md`.
2. Genera una lista de tareas en `specs/current/tasks.md` usando la plantilla `specs/templates/tasks.md`.
3. Ofrece al usuario comenzar automáticamente con la primera tarea o esperar instrucción.

