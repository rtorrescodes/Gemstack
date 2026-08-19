---
name: gemstack-guard
description: Activa y desactiva restricciones y protecciones de archivos y comandos.
triggers:
  - model_decision
---

# Gemstack Guard Skill

Gestiona los comandos `/careful`, `/freeze`, `/guard` y `/unfreeze` alterando `.gemstack/state.json`.

## Comandos:
- `/careful`: Advertir SIEMPRE al usuario antes de ejecutar cualquier comando destructivo o potencialmente riesgoso (rm, drop, format, etc.). Cambia `guard_mode.careful` a `true` en el state.json.
- `/freeze <paths>`: Limitar explícitamente los archivos editables a los paths definidos. Cambia `guard_mode.freeze` a `true` y añade a `allowed_paths`.
- `/guard`: Activa tanto `/careful` como `/freeze` simultáneamente.
- `/unfreeze`: Quita todas las restricciones de freeze y allowed_paths.

Debes actualizar `.gemstack/state.json` reflejando el cambio y confirmarlo al usuario.

