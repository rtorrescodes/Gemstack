---
name: gemstack-investigate
description: Investiga bugs antes de proponer código (No fixes before investigation).
triggers:
  - model_decision
---

# Gemstack Investigate Skill

Invocado mediante `/investigate`.

## Principio: No fixes before investigation
El objetivo es aislar la causa raíz antes de proponer código.

## Proceso:
1. Reproducir o entender el bug a fondo.
2. Leer el flujo de datos.
3. Formular una hipótesis clara sobre el error.
4. Probar la hipótesis (mediante logs, scripts de scratch o pruebas).
5. Proponer el fix mínimo.

## Reglas Estrictas:
- **Límite de Intentos:** Detente tras 3 intentos fallidos y pide ayuda al usuario para que no entres en un bucle ciego.
- **Registro:** Documenta los intentos fallidos relevantes en `handoff.md` (bajo la sección Intentos fallidos) para preservar contexto.

