---
name: gemstack-resume
description: Procedimiento para retomar una sesión de trabajo usando handoff.md.
triggers:
  - model_decision
---

# Gemstack Resume Skill

Esta habilidad se ejecuta cuando el usuario inicia una sesión y escribe `/resume`.

## Instrucciones:
1. Lee `handoff.md` (máximo 100 líneas). **PROHIBIDO** leer `handoff_archive.md` durante la reanudación normal.
2. Lee `.gemstack/state.json` para restaurar la frontera activa (`activeMilestone`, `activeTaskId`, `nextTaskId`, `guard_mode`).
3. Si existe `activeTaskId`, ejecuta la verificación de contexto: `gemstack context <activeTaskId>`.
4. Haz un breve resumen de 2-3 líneas para el usuario con el objetivo de la tarea activa y los archivos de alcance.
5. Si hay "Intentos fallidos" relevantes en `handoff.md`, menciónalos brevemente.
6. Pregunta al usuario si debes proceder con la tarea activa acotada.

