# Especificación de Funcionalidad: Gemstack v0.2 (Distribución)

## 1. Idea / Requerimiento
Evolucionar Gemstack de un repositorio "copiable" (template) a una herramienta distribuible e instalable de manera sencilla en cualquier proyecto existente. El objetivo principal es proveer un comando (`gemstack init`) que aplique el scaffolding de `.agents`, `specs`, `docs` y CLI helpers sin destruir configuraciones previas del usuario.

## 2. Estrategia de Distribución Evaluada
1. **Paquete NPM (`npx gemstack init`)**: Ideal, ya que el ecosistema Antigravity y gran parte de los usuarios usan Node.js. Permite empaquetar assets fácilmente y manejar el binario de forma nativa en Windows y Unix.
2. **Scripts Nativos (`curl` / `Invoke-WebRequest`)**: Para proyectos no-Node (ej. Python, Go). Descarga un archivo `.tar.gz` de la release de GitHub y lo extrae.
*Decisión recomendada:* Priorizar NPM (`npx gemstack@latest init`) como vía principal y mantener un script `install.ps1/sh` como fallback.

## 3. Criterios de Aceptación
- [ ] **Empaquetado Seguro**: El CLI de distribución contiene una carpeta `templates/` con los 13 skills, reglas y docs.
- [ ] **Comando `init` Inteligente**: Al ejecutar `gemstack init` en un proyecto nuevo, se copia la estructura base.
- [ ] **Protección de Overwrite (Idempotencia)**: Si el proyecto ya tiene `.agents/`, `handoff.md` o `specs/`:
  - No sobrescribir nunca `handoff.md` o `handoff_archive.md`.
  - Crear backups de archivos colisionantes (ej. `01-gemstack-core.md.bak`) o tener una política de `skip` por defecto con flag `--force`.
- [ ] **CLI Unificado**: Mantener soporte para Windows (`.ps1`) y Unix (`bash`), gestionado preferiblemente por el engine binario de NPM o instaladores binarios.
- [ ] **Nuevos Comandos CLI**: Añadir comando `update` para actualizar los skills locales a la última versión del framework.

## 4. Tests y QA
- [ ] **Unit Tests del CLI**: Tests locales usando `fs` (ej. en un entorno virtual) para validar que `init` no borra archivos, crea directorios faltantes, y hace los backups correctos.
- [ ] **Routing Tests**: Scripts que simulan los prompts de Antigravity para verificar que la regla `01-gemstack-core.md` sigue matcheando los 26 comandos correctamente.

## 5. Riesgos y Seguridad
- **Pérdida de Datos:** Un bug en el comando `init` que sobrescriba el código fuente o los prompts customizados del usuario dentro de `.agents/`.
- **Supply Chain:** Publicar un paquete en NPM conlleva el riesgo de compromiso de cuenta.
- **Rutas Relativas:** Bugs en la resolución de directorios (ej. crear los archivos en el global de la máquina en lugar de la raíz del proyecto).
