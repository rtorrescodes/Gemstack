# Plan Técnico: Gemstack v0.3 (CI/CD & Release Automation)

## 1. Arquitectura de Workflows
El sistema de CI/CD constará de dos archivos YAML independientes en `.github/workflows/`:
1. `ci.yml`: Encargado de la validación continua para proteger la rama principal (`main`).
2. `release.yml`: Encargado del empaquetado, pruebas reales sobre el tarball y preparación de release artifacts (solo manual).

## 2. Jobs, Triggers y Matrix Strategy

### A. CI Workflow (`ci.yml`)
- **Triggers:** `push` a ramas (idealmente con target main) y `pull_request`.
- **Estrategia Matrix Condicional:**
  - **Quick-CI Job:** Se dispara en `pull_request` y `push` normal. Matrix: `ubuntu-latest`, Node `[18.x, 20.x]`.
  - **Full-CI Job:** Se dispara solo en `push` directo a `main`. Matrix: `[ubuntu-latest, windows-latest, macos-latest]`, Node `[18.x, 20.x]`.
- **Pasos:** Checkout -> Setup Node -> Run CI Scripts -> Run Native Tests -> Run Demo App Smoke.

### B. Release Readiness Workflow (`release.yml`)
- **Trigger:** `workflow_dispatch` (Manual).
- **Matrix:** `[ubuntu-latest, windows-latest]`, Node `[20.x]`.
- **Pasos:** Checkout -> Setup Node -> Tests & CI Scripts -> `npm pack` -> Test Dummy Tarball -> Upload Artifact (`gemstack-*.tgz`).
- **Restricción Estricta:** NO habrá paso de `npm publish` ni tag automation.

## 3. Scripts CI Propuestos (`scripts/ci/`)
Se implementarán 5 scripts Zero-Deps nativos de Node.js que fallarán la ejecución (`process.exit(1)`) si se violan las reglas:

1. **`check-frontmatter.js`**: Lee `.agents/skills/*/SKILL.md`. Parsea el bloque YAML superior delimitado por `---`. Valida propiedades requeridas (`name`, `description`, `triggers` como array no vacío) y que el `name` coincida con el nombre del directorio padre.
2. **`check-template-clean.js`**: Revisa recursivamente `template/`. Valida que `handoff.md` tenga las 5 secciones, `state.json` no tenga flags privadas. Asegura la total ausencia de `node_modules`, `sqlite`, `tgz`, `.gemstack/backups/` o archivos ajenos.
3. **`check-mojibake.js`**: Analiza todos los textos y scripts en búsqueda exclusiva de cadenas asociadas a error UTF-8 como `Ã`, `Â`, `âœ`, `ðŸ`, y el replacement character ``. Permite acentos normativos en español (`áéíóúñ`).
4. **`check-package-contents.js`**: Llama a `npm pack --dry-run --json` o parsea la salida de consola, garantizando la inclusión de `src/`, `template/`, `README.md`, `LICENSE`, `CHANGELOG.md`, `package.json`, y la omisión estricta de bases de datos de la demo o configuraciones de github.
5. **`smoke-cli.js`**: Recrea programáticamente el uso real. Crea un temp dir con `fs.mkdtempSync`, ejecuta llamadas a `node src/cli.js` probando `--help`, `list`, `show`, `doctor`, `init --dry-run`, `init --yes` y `update --dry-run`.

## 4. Manejo de Line Endings
Se añadirá un `.gitattributes` conservador para forzar terminaciones en el checkout y commit, protegiendo los hashes SHA-256 de ser adulterados por Git en Windows:
```text
* text=auto
*.js text eol=lf
*.json text eol=lf
*.md text eol=lf
*.yml text eol=lf
*.yaml text eol=lf
*.sh text eol=lf
*.ps1 text eol=crlf
*.bat text eol=crlf
*.cmd text eol=crlf

*.png binary
*.jpg binary
*.jpeg binary
*.gif binary
*.ico binary
*.sqlite binary
*.db binary
*.tgz binary
*.zip binary
```

## 5. Tarball Validation (`release.yml`)
1. Generar `.tgz` con `npm pack`.
2. Crear un temp dir (fuera del workspace de github).
3. `cd temp-dir && npm init -y && npm install <path-to-tgz>`.
4. Ejecutar comandos `npx gemstack` (`--help`, `init`, `doctor`, `update`).
5. Tras el test exitoso, subir el `.tgz` con la acción `actions/upload-artifact`.

## 6. Demo-app Smoke Strategy
Un job independiente o un step correrá:
`cd demo-app && npm install && npm run smoke`. Confirmará la salida exitosa del servidor y su bloqueo IDOR, validando que cambios genéricos en el framework no han roto la app de referencia.

## 7. README Badge Strategy
Se ubicará un badge oficial estándar en `README.md`, inmediatamente debajo del título principal, enrutado al action de CI de `main`.

## 8. Seguridad, Secrets y Logging
- Se forzará la asignación de permisos `permissions: contents: read` en los Workflows para prevenir writes accidentales al repositorio por cuenta del GITHUB_TOKEN.
- Los logs limitarán las salidas de variables de entorno u operacionales. No se invocarán scripts que tiren volcados de memoria masivos.

## 9. Test Plan
- Se creará un branch temporal para probar empíricamente los flujos de GitHub actions (`ci.yml`) insertando fallos intencionales (ej. introducir un mojibake adrede) y observando el bloqueo, para finalmente revertir y subir limpio.

## 10. Riesgos Principales
1. **Conflicto Line Endings Activos:** Instaurar un `.gitattributes` retrospectivo forzará la re-normalización del repo si hay archivos existentes en CRLF. Esto podría generar diffs falsos la próxima vez que se haga checkout.
2. **Dependencias del Smoke CLI:** El script de humo interactuando con procesos hijos en Windows puede quedar huérfano (zombie) si los subprocesos de Node no se terminan limpiamente tras error.

## 11. Decisiones Pendientes antes de /tasks
- **Implementación Matrix Condicional:** En GitHub Actions no se puede tener un array matricial "dinámico" trivial. Lo más limpio es dividir `ci.yml` en dos flujos/jobs explícitos: un Workflow para PRs (Ubuntu) y otro Workflow para Pushes (Full Matrix). ¿Autorizas crear dos YAMLs (`pr-ci.yml` y `main-ci.yml`) o mantenemos un solo YAML con jobs condicionados mediante `if: github.event_name == 'pull_request'`?
