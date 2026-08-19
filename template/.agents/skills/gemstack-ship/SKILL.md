---
name: gemstack-ship
description: Procedimiento de cierre, limpieza y despliegue opcional de la funcionalidad.
triggers:
  - model_decision
---

# Gemstack Ship Skill

Invocado mediante `/ship`.

## Proceso:
1. Verifica revisión (`/review`) y validación (`/qa`).
2. Confirma validación de seguridad (`/cso`).
3. Comprueba si los specs se cumplieron.
4. Genera un PR summary si se pide.
5. NO hagas push, merge o deploy sin aprobación explícita.
6. Sugiere ejecutar `/handoff` para documentar la entrega en la memoria del proyecto.

