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
4. **CRÍTICO:** NO borres las entradas recientes de "4. Intentos fallidos". Mantén solo los 3-5 intentos más recientes en `handoff.md`.
5. **ARCHIVADO Y COMPACTACIÓN OBLIGATORIA (v2.0.3):**
   - El archivo `handoff.md` debe mantenerse estrictamente en **<= 100 líneas** (preferiblemente `<1,500 tokens`).
   - Mueve todo el histórico de intentos fallidos antiguos, bitácoras extensas y cambios anteriores a `handoff_archive.md`.
   - `handoff.md` representa ÚNICAMENTE la frontera activa: hito, fase, última tarea, siguiente tarea, bloqueos, rama y comando exacto para retomar (`gemstack context <TASK-ID>`).
6. Define los "5. Próximos pasos" exactos para la próxima sesión con el comando preciso de reanudación.
7. Guarda los cambios en `handoff.md` (y `handoff_archive.md` si fue necesario).
8. **Sincronización de Estado:** Verifica `.gemstack/state.json` asegurando que `schemaVersion` sea `0.3.0`, `current_phase`, `activeMilestone`, `activeTaskId` y `nextTaskId` reflejen la frontera.
9. Despídete del usuario indicando que el handoff está listo.

