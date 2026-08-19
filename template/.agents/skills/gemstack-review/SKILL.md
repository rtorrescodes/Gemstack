---
name: gemstack-review
description: Revisa el código recién escrito antes de confirmarlo o enviarlo.
triggers:
  - model_decision
---

# Gemstack Review Skill

Invocado mediante `/review`.

## Proceso:
1. Analiza los archivos modificados recientemente en la sesión.
2. Evalúa la calidad del código, nomenclatura, memory leaks y cobertura de casos extremos.
3. Emite sugerencias o aplica correcciones automáticas si son triviales.
4. Si el código está listo, sugiere `/qa` o `/ship`.

