# Tareas de Implementación

<!--
  Instrucciones:
  - Marca con `[P]` las tareas que sean seguras de paralelizar (por ej. si usas múltiples subagentes).
  - Incluye la redacción y validación de TESTS ANTES de la implementación real.
-->

## Fase 1: Pruebas y Validación (Test-First Imperative)
- [x] 1.1 Redactar prueba de validación sintáctica YAML para el nuevo workflow (`publish.yml`) usando `actionlint` o similar, o al menos validar la estructura estáticamente.
- [x] 1.2 [P] Validar localmente (dry-run) que `npm pack` genera el empaquetado esperado sin errores antes de la publicación remota.
- [x] 1.3 Comprobar que los tests fallen (Fase Roja) - en este contexto, asegurarse de que sin el YAML, el CI no reacciona a los tags.

## Fase 2: Implementación
- [x] 2.1 Crear archivo `.github/workflows/publish.yml`.
- [x] 2.2 Configurar el trigger para `on: push: tags: ['v*']`.
- [x] 2.3 Añadir trabajo `publish` que ejecute `actions/checkout` y configure Node.js usando la caché de NPM.
- [x] 2.4 Añadir paso de compuerta de seguridad: ejecución de `npm run ci:all`.
- [x] 2.5 Añadir paso para ejecutar `npm publish --access public` usando `NODE_AUTH_TOKEN`.
- [x] 2.6 Añadir paso para capturar el nombre del `.tgz` empaquetado y ejecutar `gh release create` usando el CLI nativo, adjuntando el changelog desde `RELEASE_NOTES.md`.

## Fase 3: Integración y Validación
- [x] 3.1 Revisar permisos del token de GitHub (asegurar que el GITHUB_TOKEN tenga permisos de escritura `contents: write` para crear releases).
- [ ] 3.2 Marcar los cambios, hacer commit bajo la rama actual y fusionar a main.
- [ ] 3.3 Revisión de seguridad y dependencias (CSO).
