---
name: gemstack-heal
description: Auto-Sanación de CI/CD leyendo logs y resolviendo errores.
triggers:
  - model_decision
---

# Gemstack Heal Skill

Invocado mediante `/heal`.

## Proceso:
1. Utiliza el CLI de GitHub (`gh run list --limit 1` y `gh run view --log-failed`) o pide al usuario que te pegue los logs del CI fallido.
2. Analiza los logs para encontrar la causa raíz (Errores de Sintaxis, Pruebas Fallidas, Problemas de Dependencias).
3. Utiliza la directiva "No Fixes Before Investigation" de Gemstack. Lee los archivos afectados.
4. Redacta la solución, modifica los archivos localmente.
5. Ejecuta las pruebas locales relevantes (ej. `npm run ci:all`).
6. Si pasan las pruebas, realiza un commit `fix(ci): auto-healing build failure` y haz `git push` automáticamente (si el usuario lo permite).
7. Reporta la sanación completada.
