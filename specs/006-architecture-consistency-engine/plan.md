# Plan de Implementación: Architecture Consistency Engine & Phase Freezing (Upgrade A)

**Feature Branch**: `006-architecture-consistency-engine`  
**Spec**: [`specs/006-architecture-consistency-engine/spec.md`](file:///c:/CODES/Gemstack/specs/006-architecture-consistency-engine/spec.md)  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_REVIEW`

---

## 1. Resumen y Contexto Técnico

El objetivo de este plan es diseñar la arquitectura técnica para **Upgrade A**, transformando la especificación congelada en módulos de Node.js nativos sin dependencias externas (*Zero-Dependency Core*).

### Restricciones Arquitectónicas Inmutables
- **Runtime**: Node.js >= 18.18.0 nativo.
- **Dependencias**: Cero paquetes npm de terceros (uso exclusivo de `crypto`, `fs`, `path`, `assert`, `node:test`).
- **Compatibilidad**: Modo `LEGACY` transparente para specs previas (001 a 005) y retrocompatibilidad binaria de `.gemstack/state.json`.
- **Multiplataforma**: Soporte idéntico en Windows (CRLF, backslashes), Linux y macOS.

---

## 2. Constitution Check (Phase -1 Gates)

### Simplicity Gate (Article VII)
- [x] **¿Se usan el mínimo número de carpetas/archivos posibles?** Sí: 4 librerías modulares en `src/lib/` (`hasher.js`, `contracts.js`, `findings.js`, `state.js`) y extensión quirúrgica de `src/commands/verify.js`.
- [x] **¿No hay abstracciones prematuras?** Sí: No se crea un framework de AST ni compiladores genéricos; parsing directo de bloques JSON delimitados.

### Anti-Abstraction Gate (Article VIII)
- [x] **¿Se usan las APIs nativas del framework sin wrappers innecesarios?** Sí: `crypto.createHash('sha256')`, `fs.writeFileSync`, `path.relative`.

### Test-First Imperative & Zero Silent Failures (Article III)
- [x] **¿El plan incluye la creación de tests antes que el código fuente?** Sí: Matriz P1 de 25 tests estructurados en `tests/contracts.test.js`, `tests/hasher.test.js`, `tests/findings.test.js` y regresión en `tests/verify.test.js`.
- [x] **¿Cero falsos positivos silenciosos?** Sí: Pruebas unitarias nativas sin `2>nul`.

---

## 3. Diseño Detallado de Arquitectura y Módulos

```text
c:\CODES\Gemstack\
├── src\
│   ├── lib\
│   │   ├── hasher.js          <-- [NUEVO] Normalización LF, detección BOM y SHA-256
│   │   ├── contracts.js       <-- [NUEVO] Parser ```gemstack-contracts, normalizador, comparador
│   │   ├── findings.js        <-- [NUEVO] Fingerprints, deltas consolidados y anti-loop
│   │   └── state.js           <-- [NUEVO] Lector/escritor atómico (tmp + rename) para state.json
│   └── commands\
│       └── verify.js          <-- [MODIFICAR] Incorporar paso 4: Consistencia y Hashes de Fase
├── tests\
│   ├── contracts.test.js      <-- [NUEVO] Tests categorías A y B (Parsing, Enums, Identity, Boundary, Herencia)
│   ├── hasher.test.js         <-- [NUEVO] Tests categoría C (Freeze, CRLF/LF, Detección de mutación)
│   └── findings.test.js       <-- [NUEVO] Tests categorías D, E, F y G (Fingerprints, Anti-loop, Legacy, Windows)
```

---

### 3.1 Módulo `src/lib/hasher.js`

#### Responsabilidad
Calcular hashes deterministas de artefactos markdown garantizando invariancia de plataforma (Windows vs POSIX).

#### Algoritmo de Hashing
1. Leer buffer o string UTF-8.
2. Comprobar presencia de UTF-8 BOM (`0xEF, 0xBB, 0xBF` o `\uFEFF`). Si existe, rechazar con error `CONTRACT_PARSE_ERROR: BOM detected in phase artifact`.
3. Normalizar saltos de línea: reemplazar `\r\n` por `\n` y cualquier `\r` suelto por `\n`.
4. Calcular SHA-256 sobre los bytes UTF-8 resultantes.
5. Retornar digest hexadecimal en minúsculas (64 caracteres).

#### Funciones Exportadas
- `normalizeContent(content: string): string`
- `hashArtifact(content: string): string`
- `hashFile(filePath: string): string`

---

### 3.2 Módulo `src/lib/contracts.js`

#### Responsabilidad
Localizar, extraer, validar, normalizar y comparar contratos declarados en artefactos de fase.

#### Delimitador Canónico y Reglas de Parsing
- **Delimitador**:
  ````markdown
  ```gemstack-contracts
  [
    ...
  ]
  ```
  ````
- **Regla de Bloque Único**: Se permite **exactamente un bloque** `gemstack-contracts` por artefacto. Si se detectan dos o más bloques, emite `CONTRACT_PARSE_ERROR: Multiple gemstack-contracts blocks detected`.
- **Bloque Vacío**: `[]` es válido y representa 0 contratos declarados.
- **Sin Bloque**: Retorna `null` (activa modo `LEGACY`).

#### Esquemas Exactos de Contratos

1. **`ENUM_SET`**:
   ```json
   {
     "id": "job-status",
     "type": "ENUM_SET",
     "values": ["QUEUED", "PROCESSING", "COMPLETED", "FAILED"],
     "description": "Opcional"
   }
   ```
   *Normalización:* Trim a cada string; rechazar miembros vacíos o duplicados. Comparación insensible al orden (`values.slice().sort()`).

2. **`IDENTITY_TUPLE`**:
   ```json
   {
     "id": "publication-identity",
     "type": "IDENTITY_TUPLE",
     "values": ["workspaceId", "recordingId", "languageTag", "kind"]
   }
   ```
   *Normalización:* Trim a cada string; rechazar duplicados. Comparación es un conjunto semántico de miembros exactos (`order-insensitive`, `duplicate-sensitive`, `exact-member-sensitive`).

3. **`PROVENANCE_RULE`**:
   ```json
   {
     "id": "caption-provenance",
     "type": "PROVENANCE_RULE",
     "entity": "CaptionAsset",
     "values": ["parentRecordingAssetId", "sourceMediaAssetType", "sourceRecordingExportAssetId"]
   }
   ```
   *Normalización:* Requiere `entity` (string no vacío) y lista de campos requeridos exactos.

4. **`BOOLEAN_INVARIANT`**:
   ```json
   {
     "id": "zero-dependency-core",
     "type": "BOOLEAN_INVARIANT",
     "value": true
   }
   ```
   *Normalización:* `value` debe ser estrictamente tipo booleano (`typeof value === 'boolean'`). Se rechazan `"true"` o `"false"` como strings.

5. **`BOUNDARY`**:
   ```json
   {
     "id": "eventalus-sync-dependency",
     "type": "BOUNDARY",
     "value": "FORBIDDEN"
   }
   ```
   *Valores permitidos:* Exclusivamente `"FORBIDDEN"` y `"REQUIRED"`. Comparación estricta de string (`FORBIDDEN` vs `FORBIDDEN` ➔ `PASS`; `REQUIRED` vs `REQUIRED` ➔ `PASS`; `FORBIDDEN` vs `REQUIRED` o viceversa ➔ `FROZEN_CONTRACT_VIOLATION`).

6. **`ROADMAP_LIMIT`**:
   ```json
   {
     "id": "final-planned-mvp",
     "type": "ROADMAP_LIMIT",
     "value": 18
   }
   ```
   *Normalización:* Escalar JSON (`number` o `string`). No hay coerción de tipo.

#### Algoritmo de Herencia y Comparación
```text
effectiveSpecRegistry = spec contracts
effectivePlanRegistry = effectiveSpecRegistry + additive plan contracts
effectiveTasksRegistry = effectivePlanRegistry + additive tasks contracts
```
- Si un contrato de `spec.md` no se repite en `plan.md` ➔ `PASS` (heredado implícitamente, no requiere duplicación).
- Si se re-declara con valor normalizado idéntico ➔ `PASS`.
- Si se re-declara con valor diferente ➔ emite `FROZEN_CONTRACT_VIOLATION` (`BLOCKER`).
- Si `plan.md` introduce un ID nuevo ➔ clasificado como aditivo ➔ `PASS`.

---

### 3.3 Módulo `src/lib/findings.js`

#### Responsabilidad
Gestión determinista de hallazgos, generación de huellas digitales (*fingerprints*), cálculo de deltas consolidados y supresión anti-loop.

#### Granularidad de Hallazgos
Para cada comparación de contrato, se genera **un único hallazgo consolidado** por `(contractId, phase, violationType)`.
El payload del hallazgo incluye:
```json
{
  "fingerprint": "c1f...",
  "code": "FROZEN_CONTRACT_VIOLATION",
  "severity": "BLOCKER",
  "contractId": "transcription-job-status",
  "phase": "plan",
  "location": "specs/006-architecture-consistency-engine/plan.md",
  "delta": {
    "expected": ["COMPLETED", "FAILED", "PROCESSING", "QUEUED"],
    "observed": ["CANCELLED", "COMPLETED", "FAILED", "PROCESSING", "QUEUED"],
    "missing": [],
    "added": ["CANCELLED"]
  },
  "status": "OPEN"
}
```

#### Huella Digital (*Fingerprint*) Canónica vs Display
```javascript
function createFingerprint(finding) {
    const raw = JSON.stringify({
        code: finding.code,
        contractId: finding.contractId ?? null,
        phase: finding.phase,
        location: finding.location ? finding.location.replace(/\\/g, '/') : null
    });
    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}
```
- **Fingerprint Canónico (Identidad)**: Digest SHA-256 completo en hexadecimal en minúsculas de **64 caracteres**. Es la clave inmutable utilizada para persistencia, seguimiento de excepciones y motor anti-loop. **Nunca se trunca** en el almacenamiento.
- **Display Fingerprint (Cosmético)**: Si se requiere para legibilidad en salida CLI, se puede derivar una representación corta visual (`displayFingerprint = fingerprint.slice(0, 12)`), pero jamás se usa como identidad ni como clave en `.gemstack.json`.

#### Context Hash y Anti-Loop
```javascript
function computeContextHash(upstreamHash, currentHash, contractNormalized) {
    return crypto.createHash('sha256')
        .update(`${upstreamHash || ''}:${currentHash || ''}:${JSON.stringify(contractNormalized || {})}`)
        .digest('hex');
}
```
- **`RESOLVED`**: Significa que el defecto fue corregido en el código/artefacto. Si el validador vuelve a correr y la violación persiste, el hallazgo se reactiva automáticamente.
- **`ACCEPTED_EXCEPTION`**: Requiere `approvedByHuman = true`. Suprime el bloqueo si `contextHash` permanece idéntico. Si el artefacto involucrado cambia, la excepción vuelve a requerir revisión.
- **`SUPERSEDED`**: Ocurre cuando una enmienda oficial a la especificación vuelve obsoleto un hallazgo previo.

#### Almacenamiento Persistente
Para evitar sobrecargar `state.json` con listas ilimitadas de hallazgos, se almacenan en un sidecar por feature:
`specs/<feature>/.gemstack.json`
Contiene:
```json
{
  "feature": "006-architecture-consistency-engine",
  "phase_hashes": { "spec": "...", "plan": "...", "tasks": "..." },
  "accepted_exceptions": [],
  "resolved_findings": []
}
```

---

### 3.4 Módulo `src/lib/state.js`

#### Responsabilidad
Operaciones de lectura y escritura atómica sobre `.gemstack/state.json`.

#### Algoritmo de Escritura Atómica (Planificado para `src/lib/state.js`)
1. Resolver ruta absoluta con `fssafe.resolveSafe(targetDir, '.gemstack/state.json')`.
2. Escribir primero en archivo temporal adyacente: `.gemstack/state.json.tmp.<pid>.<timestamp>`.
3. Renombrar atómicamente (`fs.renameSync`) sobre `.gemstack/state.json`.
4. En Windows, si existe bloqueo temporal transitorio, realizar reintento controlado (3 intentos con backoff de 50ms).

---

## 4. Integración en `src/commands/verify.js`

El verificador actual de 4 pasos se expande a 5 pasos limpios:

```text
[INFO] --- 1/5 Verificación Estructural (Archivos Base) ---
[INFO] --- 2/5 Verificación de Memoria e Integridad de Handoff ---
[INFO] --- 3/5 Verificación de Estado Local (.gemstack/state.json) ---
[INFO] --- 4/5 Consistencia Arquitectónica y Hashes de Fase (Upgrade A) ---
[INFO] --- 5/5 Verificación de Seguridad y Test Runners ---
```

### Lógica del Paso 4 en `verify.js`
1. Leer `.gemstack/state.json`. Obtener `active_spec`.
2. Si `active_spec` es nulo o no existe: reportar `[OK] Sin spec activa (verificación de contratos omitida)` y continuar.
3. Si `specs/<active_spec>/spec.md` existe:
   - Extraer bloques `gemstack-contracts`. Si no tiene bloques, marcar `[INFO] Modo LEGACY (sin contratos estructurados)` y continuar.
   - Si tiene `phase_hashes.spec` en `state.json` o sidecar:
     - Calcular hash actual de `spec.md`.
     - Si difiere del hash congelado: emitir error crítico `FROZEN_ARTIFACT_CHANGED`.
4. Si existe `plan.md`:
   - Validar herencia de contratos de `spec.md` contra `plan.md`.
   - Reportar hallazgos de contradicciones (`ENUM_SET`, `IDENTITY_TUPLE`, `PROVENANCE_RULE`, `BOUNDARY`, `BOOLEAN_INVARIANT`, `ROADMAP_LIMIT`).
   - Aplicar supresión anti-loop sobre hallazgos con `ACCEPTED_EXCEPTION` válidos.
5. Si hay bloqueadores abiertos (`open_blockers > 0`): incrementar `totalErrors`.

---

## 5. Mapeo de Trazabilidad de Pruebas P1 (Exact Mechanical Total = 25)

| ID | Categoría | Módulo Responsable | Aserción Técnica |
|---|---|---|---|
| `TEST-CONSISTENCY-A01` | Parsing | `src/lib/contracts.js` | Extracción correcta de array JSON dentro de ````gemstack-contracts. |
| `TEST-CONSISTENCY-A02` | Parsing | `src/lib/contracts.js` | Emisión de `CONTRACT_PARSE_ERROR` ante JSON malformado o múltiples bloques. |
| `TEST-CONSISTENCY-A03` | Parsing | `src/lib/contracts.js` | Emisión de `CONTRACT_DUPLICATE_ID` si dos contratos repiten `id`. |
| `TEST-CONSISTENCY-B01` | Cross-Phase | `src/lib/contracts.js` | `ENUM_SET`: detecta miembro extra no aprobado (ej. `PURGED`) ➔ `BLOCKED`. |
| `TEST-CONSISTENCY-B02` | Cross-Phase | `src/lib/contracts.js` | `ENUM_SET`: valida ordenación normalizada (`[A,B,C]` == `[C,B,A]`) ➔ `PASS`. |
| `TEST-CONSISTENCY-B03` | Cross-Phase | `src/lib/contracts.js` | `IDENTITY_TUPLE`: detecta dimensión faltante (omite `kind`) ➔ `BLOCKED`. |
| `TEST-CONSISTENCY-B04` | Cross-Phase | `src/lib/contracts.js` | `IDENTITY_TUPLE`: valida permutación de dimensiones idénticas ➔ `PASS`. |
| `TEST-CONSISTENCY-B05` | Cross-Phase | `src/lib/contracts.js` | `PROVENANCE_RULE`: bloquea si entidad pierde campo de procedencia ➔ `BLOCKED`. |
| `TEST-CONSISTENCY-B06` | Cross-Phase | `src/lib/contracts.js` | `BOOLEAN_INVARIANT` & `ROADMAP_LIMIT`: contradicciones directas ➔ `BLOCKED`. |
| `TEST-CONSISTENCY-B07` | Cross-Phase | `src/lib/contracts.js` | `BOUNDARY`: valores estrictos `FORBIDDEN` y `REQUIRED`; detecta contradicción explícita (`FORBIDDEN` vs `REQUIRED` ➔ `BLOCKED`) y valida equivalencia como `PASS`. |
| `TEST-CONSISTENCY-B08` | Cross-Phase | `src/lib/contracts.js` | Herencia: PLAN hereda SPEC y agrega compatibles sin duplicación ➔ `PASS`. |
| `TEST-CONSISTENCY-C01` | Hashes | `src/lib/hasher.js` | Genera SHA-256 de 64 caracteres de `spec.md`. |
| `TEST-CONSISTENCY-C02` | Hashes | `src/lib/hasher.js` | Detecta mutación no autorizada de artefacto congelado ➔ `FROZEN_ARTIFACT_CHANGED`. |
| `TEST-CONSISTENCY-C03` | Hashes | `src/commands/verify.js`| Comprueba que `verify` valida contra hashes guardados sin mutarlos. |
| `TEST-CONSISTENCY-C04` | Hashes | `src/lib/hasher.js` | Normalización CRLF a LF produce idéntico hash en Windows y POSIX. |
| `TEST-CONSISTENCY-D01` | Fingerprints | `src/lib/findings.js` | Genera fingerprint determinista canónico de 64 caracteres hex SHA-256 con location relativa (/) inmune a colisiones; valida formato de display separado. |
| `TEST-CONSISTENCY-D02` | Anti-Loop | `src/lib/findings.js` | Si el defecto persiste, no se suprime como RESOLVED; si se arregla, queda limpio. |
| `TEST-CONSISTENCY-E01` | Excepciones | `src/lib/findings.js` | `ACCEPTED_EXCEPTION` suprime el bloqueo en `verify` si contextHash coincide. |
| `TEST-CONSISTENCY-E02` | Excepciones | `src/lib/findings.js` | Mutación de artefacto relevante reactiva la excepción para re-evaluación. |
| `TEST-CONSISTENCY-F01` | Legacy | `src/commands/verify.js`| Feature sin bloques de contratos opera en modo `LEGACY` sin errores. |
| `TEST-CONSISTENCY-F02` | Legacy | `src/lib/state.js` | `state.json` versión 0.1 sin campos de Upgrade A se lee sin fallas. |
| `TEST-CONSISTENCY-G01` | Windows | `src/lib/hasher.js` | Resuelve rutas con separadores `\` y normaliza internamente a `/`. |
| `TEST-CONSISTENCY-G02` | Windows | `src/lib/state.js` | Escritura atómica previene corrupción de archivos en Windows. |
| `TEST-CONSISTENCY-H01` | Regresión | Integration | `npm run gemstack:verify` mantiene todas las validaciones de salud intactas. |
| `TEST-CONSISTENCY-H02` | Regresión | Integration | Las suites previas (`tests/init.test.js`, `tests/verify.test.js`) pasan al 100%. |

**Total Mecánico de Tests P1**: **25**

---

## 6. Procedimiento de Dogfooding y Bootstrap

Dado que la especificación `specs/006-architecture-consistency-engine/spec.md` ya declaró formalmente sus 5 contratos congelados (`zero-dependency-core`, `upgrade-a-contract-types`, etc.), el procedimiento de validación interna se ejecutará en 3 etapas:
1. **Fase Bootstrap**: Los nuevos módulos `contracts.js`, `hasher.js`, `findings.js` se implementan y prueban con `node --test`.
2. **Auto-Freeze de Feature 006**: Se congela el hash formal de `specs/006-architecture-consistency-engine/spec.md` en `.gemstack/state.json`.
3. **Auto-Verificación**: Se ejecuta `node src/cli.js verify` contra el propio repositorio de Gemstack para certificar que el motor parsea y valida sus propios contratos con `PASS`.
