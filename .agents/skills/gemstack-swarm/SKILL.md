---
name: gemstack-swarm
description: Orquestador de enjambre de subagentes para tareas paralelas.
triggers:
  - model_decision
---

# Gemstack Swarm Skill

Invocado mediante `/swarm` o cuando el plan contenga tareas `[P]`.

## Proceso:
1. Lee `tasks.md` y recolecta todas las tareas etiquetadas con `[P]`.
2. Utiliza tu capacidad de `invoke_subagent` (si está disponible en tu runtime) para lanzar un subagente paralelo por cada tarea `[P]`.
3. Asigna a cada subagente un contexto claro (el `spec.md`, el `plan.md` y la tarea específica).
4. Usa `send_message` para coordinar el trabajo si los subagentes necesitan unirse o dependen de una interfaz común.
5. Espera a que todos los subagentes terminen, evalúa sus respuestas y haz merge de los resultados.
6. Actualiza `tasks.md` marcando las tareas `[x]` a medida que los subagentes las completen.
