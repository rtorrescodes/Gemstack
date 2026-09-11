# Especificación de Funcionalidad: Architecture Consistency Engine & Phase Freezing (Upgrade A)

**Feature Branch**: `006-architecture-consistency-engine`  
**Feature Slug**: `specs/006-architecture-consistency-engine/`  
**Lifecycle Status**: `SPEC_COMPLETE`  
**Stop Reason**: `SPEC_COMPLETE_AWAITING_REVIEW`

---

## 1. Contexto y Objetivos (Upgrade A)

El framework Gemstack opera como un motor de disciplina para desarrollo con IA basado en Spec-Driven Development (SDD):
`SPEC → PLAN → TASKS → IMPLEMENT → QA / REVIEW → SHIP → HANDOFF`.

El objetivo de **Upgrade A** es incorporar una capa determinista de **detección de desviaciones arquitectónicas (Architecture Drift)** y **congelamiento de fases (Phase Freezing)** sin alterar el flujo existente, sin rediseñar el core y sin agregar dependencias externas (preservando el principio Zero-Dependency Node.js).

### Dogfooding & Bootstrap Contracts
Esta especificación define formalmente sus propios contratos congelados (`gemstack-contracts`), los cuales operan en modo auto-hospedado (*bootstrap mode*) y serán validados por el propio motor una vez implementado:

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "El runtime de Gemstack debe mantener cero dependencias externas de producción en Node.js."
  },
  {
    "id": "upgrade-a-contract-types",
    "type": "ENUM_SET",
    "values": [
      "ENUM_SET",
      "IDENTITY_TUPLE",
      "PROVENANCE_RULE",
      "BOOLEAN_INVARIANT",
      "BOUNDARY",
      "ROADMAP_LIMIT"
    ],
    "description": "Tipos de contrato deterministas soportados canónicamente en Upgrade A."
  },
  {
    "id": "verify-does-not-mutate-hashes",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "El comando gemstack verify valida contra hashes congelados pero nunca actualiza ni sobreescribe los hashes de fase."
  },
  {
    "id": "contract-amendment-requires-human-approval",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Cualquier enmienda a un contrato congelado o artefacto inmutable requiere aprobación humana explícita."
  },
  {
    "id": "legacy-mode-supported",
    "type": "BOOLEAN_INVARIANT",
    "value": true,
    "description": "Features sin bloques de contratos operan en modo legacy sin romper compatibilidad ni generar falsos bloqueos."
  }
]
```

---

## 2. User Scenarios & Testing (MVP)

### User Story 1 — Detección Determinista de Contradicciones Arquitectónicas (P1)
Como desarrollador o revisor técnico, quiero que Gemstack bloquee el avance de fase si un PLAN o TASKS introduce valores en enums no aprobados, altera tuplas de identidad o descarta campos de procedencia definidos en SPEC.  
**Test Independiente**: `TEST-CONSISTENCY-B01`, `TEST-CONSISTENCY-B02`, `TEST-CONSISTENCY-B03`.

### User Story 2 — Congelamiento y Detección de Mutación de Artefactos (P1)
Como arquitecto de software, quiero que cada artefacto aprobado (`spec.md`, `plan.md`, `tasks.md`) quede sellado con un hash criptográfico SHA-256 en `.gemstack/state.json`, de modo que cualquier mutación posterior sin enmienda formal detenga el avance con `FROZEN_ARTIFACT_CHANGED`.  
**Test Independiente**: `TEST-CONSISTENCY-C01`, `TEST-CONSISTENCY-C02`, `TEST-CONSISTENCY-C03`.

### User Story 3 — Anti-Loop y Huella Digital de Hallazgos (P1)
Como agente de IA y usuario humano, quiero que los hallazgos tengan una huella determinista (*fingerprint*) y que las observaciones resueltas o aceptadas como excepción no se reabran indefinidamente si el artefacto no ha mutado.  
**Test Independiente**: `TEST-CONSISTENCY-D01`, `TEST-CONSISTENCY-E01`.

### User Story 4 — Compatibilidad Transparente con Proyectos Legados (P1)
Como usuario con especificaciones existentes (001 a 005), quiero que `gemstack verify` y el flujo SDD sigan funcionando con total normalidad sin requerir migración obligatoria.  
**Test Independiente**: `TEST-CONSISTENCY-F01`.

---

## 3. Requerimientos Funcionales

### RF-001: Sintaxis Canónica de Declaración (`gemstack-contracts`)
- Los contratos congelados se declaran exclusivamente dentro de bloques delimitados ````gemstack-contracts ... ```` en formato JSON en el artefacto de fase (`spec.md` o `plan.md`).
- La prosa libre fuera del bloque NO se convierte implícitamente en contrato determinista.

### RF-002: Tipos de Contrato Soportados en Upgrade A
1. **`ENUM_SET`**: Conjunto de valores discretos. La comparación es insensible al orden (`normalizeSort`). Los duplicados son inválidos. Bloquea si aparecen miembros nuevos o faltan miembros aprobados.
2. **`IDENTITY_TUPLE`**: Conjunto semántico de dimensiones de identidad (*semantic set of identity dimensions*). La comparación es insensible al orden (*order-insensitive*), sensible a duplicados (*duplicate-sensitive*) y sensible a miembros exactos (*exact-member-sensitive*). Por ejemplo, `[w, r, l, k]` vs `[k, l, r, w]` ➔ `PASS`; `[w, r, l, k]` vs `[w, r, l]` ➔ `BLOCKED`; `[w, r, l, k]` vs `[w, r, l, k, x]` ➔ `BLOCKED`. El orden original de declaración se preserva exclusivamente para renderizado, visualización de diffs y legibilidad humana, no como semántica arquitectónica de orden en Upgrade A.
3. **`PROVENANCE_RULE`**: Lista de campos obligatorios para trazabilidad/linaje entre entidades. Bloquea si una entidad posterior omite un campo de procedencia congelado.
4. **`BOOLEAN_INVARIANT`**: Invariante booleano estricto (`true`/`false`). Bloquea cualquier contradicción directa.
5. **`BOUNDARY`**: Límites de aislamiento o dependencias arquitectónicas explícitas (ej. `FORBIDDEN` vs `REQUIRED`). Bloquea deterministamente contradicciones explícitas (ej. SPEC declara `FORBIDDEN` y PLAN declara `REQUIRED` ➔ `FROZEN_CONTRACT_VIOLATION`), mientras que declaraciones equivalentes resultan en `PASS`.
6. **`ROADMAP_LIMIT`**: Límite numérico o escalar inmutable (ej. `FINAL_PLANNED_MVP = 18`).

### RF-003: Modelo de Herencia de Contratos y Extensión Aditiva
- `spec.md` es la raíz y declara los contratos base.
- `plan.md` hereda automáticamente todos los contratos de `spec.md` y puede añadir nuevos contratos aditivos y compatibles específicos de arquitectura técnica sin requerir duplicar los bloques de contratos heredados.
- `tasks.md` hereda el registro consolidado (`spec.md` + `plan.md`).
- El validador distingue extensiones **aditivas no conflictivas** (`PASS`) de **contradicciones o mutaciones no aprobadas** (`BLOCKED`).

### RF-004: Hashing Determinista y Normalización CRLF/LF
- El hash de fase (`specHash`, `planHash`, `tasksHash`) se calcula usando SHA-256 sobre el contenido del archivo con saltos de línea normalizados a LF (`\r\n` ➔ `\n`) y codificación UTF-8.
- Esto garantiza idéntico hash en Windows, macOS y Linux.
- `gemstack verify` NUNCA actualiza los hashes de fase; solo la acción formal de freeze/aprobación lo hace.

### RF-005: Enmienda Formal de Contratos (`ContractAmendment`)
- Si la arquitectura cambia legítimamente, se requiere aprobación humana explícita.
- Al aprobar una enmienda en `spec.md`, el hash de `spec.md` se actualiza y las fases subsiguientes (`plan.md`, `tasks.md`) se marcan como `REQUIRES_REVIEW`.

### RF-006: Huellas Digitales (*Fingerprints*), Granularidad y Anti-Loop
- **Regla de granularidad de hallazgos:** Para una comparación de contratos se genera un único hallazgo consolidado por `contractId + phase + violationType`, conteniendo el delta normalizado completo (ej. miembros faltantes y agregados consolidados en un único hallazgo).
- **Huella determinista (*fingerprint*):** Cada hallazgo genera un hash: `SHA256(violationType + contractId + phase + normalizedLocation)`. No incluye texto volátil ni timestamps.
- **Anti-Loop:** Si un hallazgo tiene estado `RESOLVED` o `ACCEPTED_EXCEPTION` y el hash del artefacto no ha cambiado, no se vuelve a generar el bloqueo.

### RF-007: Extensiones Aditivas a `.gemstack/state.json`
- Se preservan todos los campos existentes de `state.json`.
- Se añade opcionalmente la sección de hashes y consistencia:
  ```json
  {
    "phase_hashes": {
      "spec": "<sha256-or-null>",
      "plan": "<sha256-or-null>",
      "tasks": "<sha256-or-null>"
    },
    "consistency": {
      "status": "PASS | BLOCKED | LEGACY",
      "open_blockers": 0
    }
  }
  ```

---

## 4. Criterios de Éxito y Matriz de Aceptación P1 (Exact Mechanical Count = 25)

| ID de Prueba | Categoría | Capa de Ejecución | Aserción de Aceptación |
|---|---|---|---|
| `TEST-CONSISTENCY-A01` | A — Parsing | Unit (Node) | Parsea correctamente bloques válidos `gemstack-contracts` en JSON. |
| `TEST-CONSISTENCY-A02` | A — Parsing | Unit (Node) | Emite `CONTRACT_PARSE_ERROR` si el bloque JSON es sintácticamente inválido. |
| `TEST-CONSISTENCY-A03` | A — Parsing | Unit (Node) | Bloquea con `CONTRACT_DUPLICATE_ID` si dos contratos comparten el mismo `id`. |
| `TEST-CONSISTENCY-B01` | B — Cross-Phase | Unit (Node) | `ENUM_SET`: detecta adición no aprobada (ej. `PURGED`) y emite `BLOCKED`. |
| `TEST-CONSISTENCY-B02` | B — Cross-Phase | Unit (Node) | `ENUM_SET`: valida ordenación normalizada (`[A,B,C]` == `[C,B,A]`) como `PASS`. |
| `TEST-CONSISTENCY-B03` | B — Cross-Phase | Unit (Node) | `IDENTITY_TUPLE`: detecta dimensión faltante (omisión de `kind`) y emite `BLOCKED`. |
| `TEST-CONSISTENCY-B04` | B — Cross-Phase | Unit (Node) | `IDENTITY_TUPLE`: valida tupla equivalente en orden permutado como `PASS`. |
| `TEST-CONSISTENCY-B05` | B — Cross-Phase | Unit (Node) | `PROVENANCE_RULE`: bloquea si entidad posterior omite campo de procedencia requerido. |
| `TEST-CONSISTENCY-B06` | B — Cross-Phase | Unit (Node) | `BOOLEAN_INVARIANT` & `ROADMAP_LIMIT`: bloquea contradicción directa (`true` vs `false`, `18` vs `20`). |
| `TEST-CONSISTENCY-B07` | B — Cross-Phase | Unit (Node) | `BOUNDARY`: valores estrictos `FORBIDDEN` y `REQUIRED`; detecta contradicción explícita (`FORBIDDEN` vs `REQUIRED` ➔ `BLOCKED`) y valida equivalencia como `PASS`. |
| `TEST-CONSISTENCY-B08` | B — Cross-Phase | Unit (Node) | Herencia y extensión aditiva: PLAN hereda contratos de SPEC y agrega compatibles sin duplicación; TASKS hereda SPEC + PLAN como `PASS`. |
| `TEST-CONSISTENCY-C01` | C — Freeze & Hashes | Unit (Node) | Almacena `specHash` SHA-256 al congelar la fase SPEC. |
| `TEST-CONSISTENCY-C02` | C — Freeze & Hashes | Unit (Node) | Detecta mutación no autorizada de `spec.md` con `FROZEN_ARTIFACT_CHANGED`. |
| `TEST-CONSISTENCY-C03` | C — Freeze & Hashes | Unit (Node) | `verify` valida contra hashes almacenados y NO los reescribe silenciosamente. |
| `TEST-CONSISTENCY-C04` | C — Freeze & Hashes | Unit (Node) | Normalización CRLF/LF produce idéntico hash en Windows y POSIX. |
| `TEST-CONSISTENCY-D01` | D — Fingerprints | Unit (Node) | Genera fingerprint determinista canónico de 64 caracteres hex SHA-256 con location relativa (/) inmune a colisiones; valida formato de display separado. |
| `TEST-CONSISTENCY-D02` | D — Anti-Loop | Unit (Node) | Hallazgo en estado `RESOLVED` con hash de artefacto sin cambios no se reabre. |
| `TEST-CONSISTENCY-E01` | E — Excepciones | Unit (Node) | `ACCEPTED_EXCEPTION` aprobado por humano suprime el bloqueo en `verify`. |
| `TEST-CONSISTENCY-E02` | E — Excepciones | Unit (Node) | Modificación del artefacto relevante reabre la excepción para nueva revisión. |
| `TEST-CONSISTENCY-F01` | F — Legacy | Unit (Node) | Feature sin bloque `gemstack-contracts` opera en modo `LEGACY` sin error. |
| `TEST-CONSISTENCY-F02` | F — Legacy | Unit (Node) | Proyecto con `state.json` versión previa inicializa campos faltantes de forma segura. |
| `TEST-CONSISTENCY-G01` | G — Windows | Unit (Node) | Manejo de rutas con barras invertidas (`\`) normalizadas de forma segura en Windows. |
| `TEST-CONSISTENCY-G02` | G — Windows | Unit (Node) | Operaciones de lectura y hashing atómicas sin colisión de descriptores de archivo. |
| `TEST-CONSISTENCY-H01` | H — Regression | Integration | `npm run gemstack:verify` mantiene todas las validaciones estructurales existentes intactas. |
| `TEST-CONSISTENCY-H02` | H — Regression | Integration | Las suites previas (`tests/init.test.js`, `tests/verify.test.js`) continúan pasando al 100%. |

---

## 5. Non-Goals Explícitos (Fuera de Alcance en Upgrade A)

- **NO** cálculo mecánico de matrices de prueba P1 ni conteo aritmético de tests (Upgrade B).
- **NO** trazabilidad tarea ↔ test (Upgrade B).
- **NO** manifiesto `closure.json` ni puertas de comandos canónicos (Upgrade B).
- **NO** `BillableActionGate` ni libro de costos de proveedores (Upgrade C).
- **NO** `ProviderCapabilityGate` ni adaptadores fail-closed (Upgrade C).
- **NO** generador de cápsulas de contexto (`context-capsule.json`) (Upgrade D).
- **NO** ejecutores de bases de datos o runners de migraciones.
- **NO** frameworks de AST o paquetes npm externos (Zero-Dependency estricto).
- **NO** herramientas de gestión de proyectos genéricos (Kanban, time tracking).
