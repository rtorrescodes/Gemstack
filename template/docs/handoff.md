# El Sistema Handoff

El archivo `handoff.md` es la memoria de tu proyecto. 

## Reglas
1. Siempre se genera o actualiza al final de la sesión.
2. Contiene 5 partes: Objetivo, Estado actual, Archivos tocados, Intentos fallidos y Próximos pasos.
3. **Intentos Fallidos NUNCA se borran**: Previenen que Gemini cometa el mismo error (loops de debugging).
4. **Archive**: Para evitar que consuma toda la ventana de contexto, el agente mueve las entradas antiguas a `handoff_archive.md` cuando la lista crece demasiado, pero mantiene siempre viva la referencia.
