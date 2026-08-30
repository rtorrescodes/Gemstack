---
name: gemstack-qa-visual
description: QA Visual Autónomo vía scripts de navegador.
triggers:
  - model_decision
---

# Gemstack QA Visual Skill

Invocado mediante `/qa-visual`.

## Proceso:
1. Analiza los Criterios de Aceptación del UI en el `spec.md` activo.
2. Si tienes la capacidad de interactuar con navegadores de forma nativa, utilízala. De lo contrario, crea un script efímero en la carpeta `.gemstack/scratch/` utilizando Node.js (Fetch/DOM parsing).
3. Si el usuario cuenta con Playwright/Puppeteer instalado, genera y ejecuta los scripts de UI de forma aislada.
4. Genera un reporte detallado con los hallazgos en `docs/qa/latest-visual-qa.md`.
5. Si encuentras un fallo crítico visual o de flujo, propón un fix inmediatamente.
