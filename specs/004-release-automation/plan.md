# Plan de Implementación: Release Automation (NPM & GitHub)

**Feature Branch**: `004-release-automation` | **Spec**: `specs/004-release-automation/spec.md`

## 1. Summary & Technical Context
Se implementará un workflow automatizado de CI/CD para publicar Gemstack en NPM y generar un GitHub Release al hacer push de un tag (`v*`).

- **Lenguaje/Versión**: YAML (GitHub Actions), Node.js 18+ y 20+.
- **Dependencias core**: Acciones de GitHub `actions/checkout@v4`, `actions/setup-node@v4` y `softprops/action-gh-release@v1` (o usando `gh` CLI directo).
- **Restricciones**: Las publicaciones deben ser idempotentes, seguras (Zero dependencies externas en nuestro runtime local), y se debe proveer protección contra errores de publicación si los tests fallan antes.

## 2. Constitution Check (Phase -1 Gates)
<!-- VERIFICACIÓN DE REGLAS INMUTABLES -->
### Simplicity Gate (Article VII)
- [x] ¿Se usan el mínimo número de carpetas/archivos posibles? *(Sí, un solo archivo `.yml` de workflow)*
- [x] ¿No hay abstracciones prematuras (future-proofing)? *(Se usarán las herramientas directas de npm y gh-cli)*

### Anti-Abstraction Gate (Article VIII)
- [x] ¿Se usan las APIs nativas del framework sin wrappers innecesarios? *(Usaremos `npm publish` nativo)*

### Test-First Imperative (Article III)
- [x] ¿El plan incluye la creación de tests antes que el código fuente? *(Como es automatización YAML, el test será probar con `--dry-run` o validar el parsing antes de la publicación real)*

## 3. Entregables Satélites a Generar
- `research.md`: [Opcional] No aplica (la tecnología de actions ya fue definida y documentada).
- `data-model.md`: No aplica.
- `contracts/`: No aplica.
- `quickstart.md`: No aplica.

## 4. Estructura de Archivos a Modificar / Crear
```text
.github/workflows/publish.yml: [NUEVO] Workflow para automatizar la publicación tras push de un tag.
package.json: [MODIFICAR] Opcional, configuración extra si necesitamos scripts de validación pre-publicación.
```

### Flujo Técnico en `publish.yml`
1. **Trigger**: `on: push: tags: - 'v*'`
2. **Setup**: Checkout del código, Setup de Node.js.
3. **CI Gate**: Ejecutar `npm run ci:all` para evitar publicar versiones defectuosas.
4. **NPM Publish**: 
   - Ejecutar `npm pack` (opcionalmente guardar el .tgz en var temporal).
   - Configurar registry a `registry.npmjs.org` con `NODE_AUTH_TOKEN`.
   - Ejecutar `npm publish --access public`.
5. **GitHub Release**:
   - Usar comando `gh release create` o la acción oficial para crear el release.
   - Apuntar el `body` (notas) a `RELEASE_NOTES.md`.
   - Adjuntar el artefacto `.tgz` generado en el paso 4.

## 5. Complexity Tracking
| Violación de Regla | Por qué es necesario | Alternativa simple rechazada por |
|--------------------|----------------------|-----------------------------------|
| Ninguna            | N/A                  | N/A                               |
