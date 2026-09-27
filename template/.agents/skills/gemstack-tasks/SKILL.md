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
4. **Referencias a Invariantes (v2.0.3)**: Utiliza identificadores inmutables de invariantes (`INV-<MILESTONE>-<NUM>`) en lugar de copiar bloques arquitectónicos de prosa.
5. **Cápsulas de Contexto de Tarea (v2.0.3)**: Cada tarea ejecutable genera su cápsula individual en `.gemstack/task-context/<TASK-ID>.json` con:
   - `objective`, `module`, `invariants`, `readFiles`, `writeFiles`, `contracts`, `dependencies`, `forbiddenScope`, `tests`, `scopedTestCommand`, `testImpact`, `acceptanceCriteria`, `stopConditions`.
   - Huellas criptográficas de dependencias (`freshness` con selector de tarea, invariantes de SPEC, secciones de PLAN y módulo).
6. Aplica Test-First: Las tareas de escribir pruebas (y validarlas) deben ir ANTES que la implementación de código.
7. Usa el marcador `[P]` para tareas independientes que se puedan paralelizar.
8. Actualiza el puntero de frontera en `.gemstack/state.json` (`activeMilestone`, `activeTaskId`, `nextTaskId`).
9. Ofrece al usuario comenzar automáticamente con la primera tarea o delegar a subagentes paralelos si hay múltiples `[P]`.

