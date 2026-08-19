---
name: gemstack-resume
description: Procedimiento para retomar una sesión de trabajo usando handoff.md.
triggers:
  - model_decision
---

# Gemstack Resume Skill

Esta habilidad se ejecuta cuando el usuario inicia una sesión y escribe `/resume`.

## Instrucciones:
1. Lee `handoff.md`.
2. Lee `.gemstack/state.json` para restaurar el estado, el spec activo y si hay guard/freeze activado.
3. Haz un breve resumen de 2-3 líneas para el usuario.
4. Si hay "Intentos fallidos" relevantes en `handoff.md`, menciónalos brevemente.
5. Pregunta al usuario si debes proceder con el primer paso o si hay algún cambio de prioridad.

