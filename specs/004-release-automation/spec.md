# Especificación de Funcionalidad: Release Automation (NPM & GitHub)

**Feature Branch**: `004-release-automation`

## 1. User Scenarios & Testing (MVP)
<!--
  IMPORTANTE: Las historias de usuario deben estar PRIORIZADAS (P1, P2...).
  Cada historia debe ser INDEPENDIENTEMENTE TESTEABLE, aportando un fragmento de valor MVP.
-->
### User Story 1 - Publicación Automatizada en NPM (Prioridad: P1)
Como mantenedor del framework Gemstack, quiero que el sistema publique automáticamente el paquete en el registro público de NPM cuando se apruebe una nueva versión.
**Por qué esta prioridad:** Reduce el error humano, estandariza los empaquetados y evita la necesidad de credenciales locales en las máquinas de los desarrolladores.
**Test Independiente:** Ejecutar el flujo de publicación con un flag dry-run (o hacia un registry de pruebas/local) y verificar que el paquete se empaqueta y publica correctamente.

**Escenarios de Aceptación:**
1. **Dado** que se ha configurado un token de NPM válido, **Cuando** se dispara el proceso de release, **Entonces** el paquete se publica en npmjs.com bajo el nombre correcto.

### User Story 2 - Generación de GitHub Releases (Prioridad: P2)
Como mantenedor del framework, quiero que el sistema cree automáticamente un "GitHub Release" formal asociado al tag de la versión, incluyendo las notas de lanzamiento y el artefacto (`tarball`).
**Por qué esta prioridad:** Mantiene a los usuarios informados sobre los cambios (Changelog) y centraliza la distribución segura de binarios o empaquetados históricos.
**Test Independiente:** Disparar la acción y validar que aparece un Release en la pestaña de Releases de GitHub con el texto correcto extraído de las notas.

**Escenarios de Aceptación:**
1. **Dado** un nuevo tag de versión en el repositorio, **Cuando** se ejecuta la automatización, **Entonces** se crea un Release en GitHub adjuntando el `gemstack-x.y.z.tgz`.

## 2. Requerimientos Funcionales
<!--
  Anota requerimientos explícitos.
  SI HAY AMBIGÜEDAD, NO ADIVINES. Usa: [NEEDS CLARIFICATION: tu pregunta]
-->
- **FR-001**: El sistema DEBE empaquetar el framework de forma limpia y publicarlo en NPM.
- **FR-002**: El sistema DEBE generar un GitHub Release adjuntando el código fuente y el `tarball` empaquetado.
- **FR-003**: El flujo DEBE dispararse automáticamente cuando se empuja al repositorio un tag semántico de Git (ej. `git push origin v0.4.0`).
- **FR-004**: El GitHub Release DEBE crearse en estado de Publicado (Published) inmediatamente para maximizar la automatización.
- **FR-005**: Se DEBE utilizar el contenido del archivo `RELEASE_NOTES.md` como cuerpo (body) del GitHub Release.

## 3. Criterios de Éxito (Measurable Outcomes)
<!-- Definir métricas que no dependan de la tecnología -->
- **SC-001**: El proceso de release completo requiere cero comandos manuales de `npm publish` en las computadoras de los desarrolladores.
- **SC-002**: El tiempo desde la aprobación del release hasta la disponibilidad pública en NPM y GitHub es inferior a 5 minutos.

## 4. Casos Extremos (Edge Cases)
- ¿Qué pasa si la versión declarada en `package.json` ya existe en el registro público de NPM (colisión de versiones)?
- ¿Qué pasa si el NPM_TOKEN ha expirado o no tiene permisos de publicación?
- ¿Qué pasa si las pruebas de integración (`ci:all`) fallan justo antes de intentar publicar?

## 5. Entidades Clave (Data / Models)
- **[NPM Registry]**: Sistema de distribución público donde vivirá el paquete.
- **[GitHub Release]**: Entidad oficial del repositorio que enlaza un tag, un commit, notas de texto y archivos (assets).
