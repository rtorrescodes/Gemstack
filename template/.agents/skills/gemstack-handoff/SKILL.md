---
name: gemstack-handoff
description: Procedimiento estricto para crear o actualizar el handoff al final de la sesión.
triggers:
  - model_decision
---

# Gemstack Handoff Skill

Esta habilidad se ejecuta cuando el usuario pide terminar la sesión, invoca `/handoff` o pide preparar el handoff.

## Instrucciones Estrictas:
1. Lee el archivo `handoff.md` actual en la raíz del proyecto.
2. Actualiza las secciones "1. Objetivo" y "2. Estado actual" basado en lo logrado en esta sesión.
3. Enumera en "3. Archivos y cambios" los archivos modificados.
4. **CRÍTICO:** NO borres las entradas existentes bajo "4. Intentos fallidos". Si hiciste nuevos descubrimientos de enfoques que no funcionan, añádelos.
5. **ARCHIVADO SEGURO:** Si "Intentos fallidos" en `handoff.md` tiene demasiados puntos (más de 10-15), CORTA los elementos más antiguos y pégalos en `handoff_archive.md` bajo su lista, conservando solo los 3-5 intentos recientes en `handoff.md`.
6. Define los "5. Próximos pasos" exactos para la próxima sesión.
7. Guarda los cambios en `handoff.md` (y `handoff_archive.md` si fue necesario).
8. Despídete del usuario indicando que el handoff está listo.

