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
2. Verifica que las convenciones arquitectónicas del proyecto se respeten.
3. VERIFICACIÓN DE SEGURIDAD: Revisa obligatoriamente `.agents/rules/03-gemstack-security.md` para garantizar que el código propuesto no introduzca brechas de seguridad (IDOR, XSS, tokens expuestos).
4. Verifica que los tests cubran adecuadamente los cambios.
5. Emite sugerencias o aplica correcciones automáticas si son triviales.
6. Si el código está listo, sugiere `/qa` o `/ship`.
