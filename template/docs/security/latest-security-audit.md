# Latest Security Audit
**Date:** 2026-08-19

## CSO Report: SecureDocs Demo

### 1. IDOR (Insecure Direct Object Reference)
- **Status:** [Fixed]
- **Severity:** Critical
- **Detail:** Verificado por test automatizado `smoke-test.js`. Endpoint `/api/docs/:id` devuelve 404 al intentar cruzar scopes. Además, se validó que inyectar explícitamente `{"user_id": 1}` en el body de POST `/api/docs` es ignorado a favor del user extraído del header mock.

### 2. SQL Injection
- **Status:** [Fixed]
- **Severity:** High
- **Detail:** Se utilizan sentencias preparadas de `sqlite3` (`db.run(..., [params])`).

### 3. Headers & XSS
- **Status:** [Fixed]
- **Severity:** Medium
- **Detail:** Middleware in-line aplica `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, y `Content-Security-Policy`. Uso de `textContent` en Vanilla JS neutraliza XSS reflejado/almacenado probado.

### 4. Database File Handling
- **Status:** [Fixed]
- **Severity:** High
- **Detail:** `securedocs.sqlite` explícitamente añadido a `.gitignore`. Previene fuga de datos en Git.

### 5. Authentication Mock
- **Status:** [Manual review required]
- **Severity:** Informational
- **Detail:** Se usa un header `X-Mock-User-Id` en texto plano.
- **Decisión:** Riesgo documentado y aceptado (by design) en el alcance de la demo.

### 6. CORS / Rate Limiting
- **Status:** [Not applicable]
- **Severity:** Low
- **Detail:** No hay librerías de CORS habilitadas lo cual restringe el dominio cruzado por defecto a *same-origin*. No hay Rate Limiting pero siendo una demo local no presenta superficie de ataque expuesta a internet.

**Decisión General**: APPROVED. Smoke tests automatizados garantizan mitigación de los riesgos top reportados.
