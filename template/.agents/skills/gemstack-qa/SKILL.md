---
name: gemstack-qa
description: Pruebas funcionales de los requerimientos implementados.
triggers:
  - model_decision
---

# Gemstack QA Skill

Invocado mediante `/qa` o `/qa-only`.

## Proceso:
1. Identifica la funcionalidad actual y lee los Criterios de Aceptación en `specs/[nombre-feature]/spec.md`.
2. Revisa el código o instruye la ejecución de tests si existen.
3. Si la aplicación es visual, recomienda `/browser` o correr tests de Playwright para verificar manualmente la UI.
4. Genera un breve reporte indicando si cada Criterio pasó o falló.

