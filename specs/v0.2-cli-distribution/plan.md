# Plan Técnico: Gemstack v0.2 (CLI Distribution)

## 1. Arquitectura Propuesta
Gemstack se convertirá en una herramienta de CLI empaquetable vía NPM. El código se reestructurará aislando la lógica de la herramienta de CLI (`src/`) de los activos del framework (`template/`). Al instalarse e invocarse (`gemstack init`), el CLI usará la carpeta `template/` como fuente de verdad para inyectar los archivos de forma idempotente y segura en el repositorio destino.

## 2. Estructura de Carpetas
El repositorio Gemstack mutará a esta forma:
```text
src/
  cli.js
  commands/
    init.js
    update.js
    doctor.js
    list.js
    show.js
  lib/
    copy-template.js
    manifest.js
    backup.js
    filesystem-safe.js
    gitignore.js
    logger.js
    paths.js
template/
  .agents/
  .gemstack/
  specs/
  docs/
  handoff.md
  handoff_archive.md
package.json
```

## 3. Cambios al package.json
Se expondrá el ejecutable de forma global/local en NPM agregando:
```json
"bin": {
  "gemstack": "src/cli.js"
}
```

## 4. Comandos CLI
- `gemstack init [--dry-run] [--yes] [--target <path>]`: Inyecta la estructura base de Gemstack de forma segura sin borrar archivos custom.
- `gemstack update [--dry-run] [--yes] [--force]`: Sincroniza los archivos Gemstack-owned con la nueva versión del template local.
- `gemstack doctor`: Revisa la salud de la instalación actual usando `.gemstack/manifest.json`.
- `gemstack list`: Muestra los skills detectados en el repo destino.
- `gemstack show <skill>`: Imprime el contenido de un skill en pantalla.

## 5. Estrategia del Template
Todos los archivos nativos (skills, reglas, docs) se almacenarán internamente en la carpeta `template/`. Durante un comando `init` o `update`, la herramienta usará `fs` recursivo mapeando `template/` -> `<target-dir>/`.

## 6. Estrategia de Manifest
Para rastrear qué pertenece a Gemstack y qué es custom del usuario, existirá un archivo `.gemstack/manifest.json` en el repositorio destino:
```json
{
  "version": "0.2.0",
  "installedAt": "2026-08-19T12:00:00Z",
  "files": [
    { "path": ".agents/rules/01-gemstack-core.md", "checksum": "abc123hash" }
  ]
}
```

## 7. Estrategia de Backups
Toda operación destructiva o de overwrite sobre un archivo Gemstack-owned generará primero una copia en `.gemstack/backups/<timestamp>/`. Se acompañará con un `manifest.json` interno del backup indicando archivo original, comando que provocó el backup (`update` o `init --force`), fecha y motivo.

## 8. Algoritmo de Inicialización (`init`)
1. Determinar el directorio target (pwd o `--target`).
2. Iterar sobre los archivos en `template/`.
3. Si el archivo destino NO existe, copiarlo.
4. Si el archivo destino SÍ existe:
   - Si es `handoff.md`, `handoff_archive.md`, o `learnings.md`, ignorar (SKIP).
   - Si es un skill `.agents/skills/gemstack-*`, verificar checksums/conflictos. Pedir confirmación o respaldar, según flags.
5. Inyectar silenciosamente el manifiesto `.gemstack/manifest.json`.
6. Actualizar `.gitignore` leyendo bloques existentes. Si no está Gemstack, agregar marcador `# Gemstack` y las exclusiones (`.gemstack/state.json`, `.gemstack/backups/`).

## 9. Algoritmo de Actualización (`update`)
1. Leer `.gemstack/manifest.json` destino.
2. Comparar el checksum local vs el checksum del `template/` interno de Gemstack.
3. Si difiere:
   - **Gemstack-owned:** Preparar backup. Reemplazar.
   - **No-Gemstack (Modificado por User):** Alertar. Omitir, a menos que se use `--force`.
4. Mostrar listado pre-aplicación si está en `--dry-run`.
5. Si no es dry-run, ejecutar los Backups -> Copiar archivos -> Actualizar manifest.

## 10. Algoritmo de Doctor
1. Validar existencia del `manifest.json`.
2. Validar que los archivos marcados en el manifest existan realmente en disco.
3. Validar presencia de entradas Gemstack en `.gitignore`.
4. Emitir reportes `[OK]`, `[WARN]`, `[ERROR]`.

## 11. Seguridad y Path Safety
La función `filesystem-safe.js` usará `path.resolve` y `path.normalize` comparando siempre que el subdirectorio final inicie estrictamente con el `TARGET_DIR`. (Ej. `if (!resolvedPath.startsWith(targetDir)) throw Error("Path Traversal Bloqueado")`). Prohibida la ejecución de comandos externos (`exec`, `spawn` del SO). Todo debe ser `fs` en Node nativo.

## 12. Plan de Pruebas (Tests)
Usaremos el test-runner nativo de Node.js o Jest (si es permitido, sino zero-deps assertions).
- `init` en vacía y en carpeta con `.agents/` preexistente.
- `update` con y sin archivos modificados.
- Confirmación de generación correcta del `manifest.json` y `backups`.
- Bloqueo explícito de path traversal con payloads maliciosos (`../../`).

## 13. Migración v0.1 a v0.2
Usuarios que clonaron v0.1 pueden recibir v0.2 ejecutando `npx gemstack@latest update --force` que mapeará los archivos anteriores usando el nuevo sistema de manifiesto, sin tocar su `handoff.md`.

## 14. Riesgos
1. Desincronización del Manifest si el usuario modifica los archivos manualmente usando git o su IDE. (Se mitiga comparando checksum actual del archivo contra el checksum registrado en el manifest antes de hacer update).
2. Complejidad en la resolución de dependencias relativas si se ejecuta el CLI globalmente (`npm install -g gemstack`). Node debe poder encontrar `template/` relativo a `__dirname` del paquete global.

## 15. Decisiones Pendientes (Next Steps)
- Se requiere aprobación de la arquitectura y el algoritmo de overwrite/backup.
- Definir si se permitirá la adición de librerías de utilidad (ej. `commander` para los flags, `chalk` para colores) o si el CLI debe ser estricto "zero-dependencies".
