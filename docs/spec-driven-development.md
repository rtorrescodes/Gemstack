# Spec-Driven Development (SDD) en Gemstack

Inspirado en Spec Kit, Gemstack obliga a pensar antes de teclear.

1. **El Qué (`spec.md`)**: Requisitos funcionales, criterios de aceptación (checkboxes) y casos límite. No tiene detalles de implementación.
2. **El Cómo (`plan.md`)**: Arquitectura, esquema de base de datos, rutas, y dependencias necesarias.
3. **El Cuándo (`tasks.md`)**: Pasos lógicos a seguir para construirlo.

Usa `/specify` para comenzar este ciclo.
Una vez que el spec esté aprobado por el usuario, usa `/plan` y luego `/tasks`.


---

## Mechanical Test Matrix & Closure Evidence (Upgrade B)

Gemstack complements Architecture Consistency with mechanical closure verification:

1. **Test Matrix in Spec (`spec.md`)**:
   Declared in a ```gemstack-test-matrix``` block. Defines canonical acceptance tests with unique IDs (`TEST-[FEATURE]-[CAT][NUM]`), verification layers (`UNIT`, `INTEGRATION`, `E2E`, `CLI`), and enforcement gates (`REQUIRED`, `SUPPLEMENTAL`). Produces an immutable `acceptanceSignature`.

2. **Physical Test Bindings in Plan (`plan.md`)**:
   Declared in ```gemstack-test-bindings``` block mapping each canonical test ID 1:1 to a physical runner file (e.g. `tests/example.test.js` with runner `node:test`).
   Also declares mandatory package script gates in ```gemstack-closure-gates```.

3. **Task Traceability in Tasks (`tasks.md`)**:
   Implementation tasks declare metadata:
   `<!-- gemstack:validation_required=true|false -->`
   `<!-- gemstack:tests=TEST-001,TEST-002 -->`
   `<!-- gemstack:files=src/module.js,tests/module.test.js -->`
   Ensures that every required canonical test is bound to at least one implementation task.

4. **Lifecycle: COLLECT vs VERIFY vs SHIP**:
   - `gemstack collect`: Mutating evidence collector. Executes test runners, evaluates package script gates, reconciles counts, computes `closureContextHash`, and generates feature-local `closure.json`.
   - `gemstack verify`: Strictly read-only validator (6 stages). Evaluates existing `closure.json` against in-memory fresh `closureContextHash`. Never writes to disk.
   - `gemstack ship`: Lifecycle gatekeeper. Enforces that `closure.json` is fresh and marked `VERIFIED` (or policy-waived `VERIFIED_WITH_EXCEPTIONS`) before transitioning state to `SHIPPED`.
