# Especificación de Funcionalidad: The "WOW" Update (Autonomía Avanzada)

**Feature Branch**: `005-the-wow-update`

## 1. User Scenarios & Testing (MVP)

### User Story 1 - QA Visual Autónomo (P1)
Como desarrollador, quiero invocar `/qa-visual` para que la IA genere y ejecute scripts de UI testing en un sandbox, verificando visualmente los Criterios de Aceptación.
**Test Independiente**: Ejecutar `/qa-visual` en un proyecto con frontend simulado y obtener un reporte de QA basado en interacción DOM.

### User Story 2 - Enjambre de Subagentes (Swarm) (P1)
Como líder técnico, quiero que el comando `/tasks` delegue automáticamente las tareas marcadas con `[P]` a múltiples subagentes paralelos para reducir el tiempo de implementación.
**Test Independiente**: Procesar un `tasks.md` con 2 tareas `[P]`, verificando que se invocan subagentes en paralelo.

### User Story 3 - Auto-Sanación de CI/CD (P2)
Como mantenedor, quiero invocar `/heal` cuando un workflow de GitHub falle, para que el agente lea los logs, repare el código y haga un push automáticamente.
**Test Independiente**: Romper un test a propósito, subirlo, esperar que falle CI y correr `/heal` para ver cómo se auto-repara.

### User Story 4 - Ejecución Segura en Sandbox (P2)
Como ingeniero de seguridad, quiero usar `/sandbox` para aislar pruebas de dependencias dudosas dentro de un contenedor Docker efímero.
**Test Independiente**: Ejecutar un test con `/sandbox` y confirmar que corre dentro de un contenedor de Node.js sin acceso al host raíz.

## 2. Requerimientos Funcionales
- **FR-001**: Añadir skill `gemstack-qa-visual`.
- **FR-002**: Añadir skill `gemstack-swarm` y actualizar `gemstack-tasks` para orquestar `invoke_subagent`.
- **FR-003**: Añadir skill `gemstack-heal` que consuma logs vía CLI (`gh run view`).
- **FR-004**: Añadir skill `gemstack-sandbox` que use `docker run`.
- **FR-005**: Registrar todos los comandos en `01-gemstack-core.md`.

## 3. Criterios de Éxito (Measurable Outcomes)
- **SC-001**: El framework soporta delegación multiproceso nativa.
- **SC-002**: El flujo de resolución de bugs de CI pasa de requerir intervención humana a requerir solo 1 comando (`/heal`).
