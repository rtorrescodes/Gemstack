---
name: gemstack-plan
description: Convierte spec.md en un plan técnico.
triggers:
  - model_decision
---

# Gemstack Plan Skill

Invocado mediante `/plan`.

## Proceso:
1. Lee `specs/current/spec.md`.
2. Traduce esos requerimientos en un diseño técnico en `specs/current/plan.md` usando la plantilla `specs/templates/plan.md`.
3. Detalla: Cambios de arquitectura, modelos de datos, lista de archivos a crear/modificar y librerías.
4. Incluye consideraciones de seguridad.
5. Pide aprobación al usuario antes de generar código o ejecutar `/tasks`.

