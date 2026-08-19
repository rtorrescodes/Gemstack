---
name: gemstack-learn
description: Memoria a largo plazo del agente. Añade, busca o depreca aprendizajes.
triggers:
  - model_decision
---

# Gemstack Learn Skill

Se invoca mediante `/learn`.

## Proceso:
1. El usuario indicará qué aprendizaje debe registrar o si desea listar/buscar.
2. Todo el conocimiento se gestiona en el archivo `.gemstack/learnings.md`.
3. Para **agregar**: Pon el nuevo aprendizaje bajo "## Aprendizajes Activos".
4. Para **buscar/listar**: Lee el archivo e informa al usuario.
5. Para **marcar obsoleto**: Mueve el aprendizaje de "Activos" a "## Aprendizajes Obsoletos".

