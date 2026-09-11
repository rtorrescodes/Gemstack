---
name: gemstack-review
description: Revisa el código recién escrito antes de confirmarlo o enviarlo.
triggers:
  - model_decision
---

# Gemstack Review Skill

Invocado mediante `/review`.

## Proceso:
1. Analiza el código modificado (git diff, o archivos editados).
2. **Validación Determinista Primero (Upgrade A)**: Ejecuta `node src/cli.js verify` o comprueba contratos congelados, hashes de fase y bloqueadores antes de proceder a la revisión semántica.
3. Proporciona al revisor la lista de contratos efectivos, hashes de fase y hallazgos deterministas para no forzarlo a redescubrir desviaciones mecánicas.
4. Verifica que las convenciones arquitectónicas del proyecto se respeten.
5. VERIFICACIÓN DE SEGURIDAD: Revisa obligatoriamente `.agents/rules/03-gemstack-security.md` para garantizar que el código propuesto no introduzca brechas de seguridad (IDOR, XSS, tokens expuestos).
6. Verifica que los tests cubran adecuadamente los cambios.
7. Emite sugerencias o aplica correcciones automáticas si son triviales.
8. Si el código está listo, sugiere `/qa` o `/ship`.
