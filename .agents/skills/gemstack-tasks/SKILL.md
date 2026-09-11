---
name: gemstack-tasks
description: Convierte un plan.md en tareas ejecutables.
triggers:
  - model_decision
---

# Gemstack Tasks Skill

Invocado mediante `/tasks`.

## Proceso:
1. Lee `specs/[nombre-feature]/plan.md` y, si existen, `data-model.md` y la carpeta `contracts/`.
2. Convierte los contratos, entidades y el plan en una lista estricta de ejecución en `specs/[nombre-feature]/tasks.md` usando la plantilla `specs/templates/tasks.md`.
3. **Herencia de Contratos (Upgrade A)**: TASKS hereda automáticamente los contratos consolidados de SPEC y PLAN. No se requiere declarar un bloque de contratos propio salvo que se agreguen contratos operacionales específicos de tareas.
4. Aplica Test-First: Las tareas de escribir pruebas (y validarlas) deben ir ANTES que la implementación de código.
5. Usa el marcador `[P]` para tareas independientes que se puedan paralelizar.
6. Ofrece al usuario comenzar automáticamente con la primera tarea o delegar a subagentes paralelos si hay múltiples `[P]`.

