# Latest Security Audit
**Date:** 2026-08-19

## CSO Report: SecureDocs Demo

### 1. IDOR (Insecure Direct Object Reference)
- **Status:** [Fixed]
- **Detail:** Verificado en `demo-app/server.js`. Los endpoints `/api/docs/:id` (GET, PUT, DELETE) incluyen la restricción `AND user_id = ?` usando `req.user.id`. El servidor interceptará cualquier intento de acceso cruzado entre Alice y Bob devolviendo HTTP 404.

### 2. SQL Injection
- **Status:** [Fixed]
- **Detail:** Se utilizan sentencias preparadas de `sqlite3` (`db.run(..., [params])`). Los datos del usuario nunca se concatenan directamente en la query.

### 3. Headers
- **Status:** [Fixed]
- **Detail:** Se implementó middleware in-line que aplica cabeceras clave: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, y un `Content-Security-Policy` básico que solo permite self-source. 

### 4. XSS (Cross-Site Scripting)
- **Status:** [Fixed]
- **Detail:** En el frontend (`demo-app/public/app.js`), los valores se inyectan en el DOM usando la propiedad `textContent` durante la iteración en `loadDocs()` y `document.createElement()`. Esto neutraliza ataques de script almacenado.

### 5. Falta de Auth Real
- **Status:** [Manual review required]
- **Detail:** Se usa un header `X-Mock-User-Id` en texto plano sin validación de firma o criptografía (ej. JWT o Sessions).
- **Decisión:** Riesgo documentado y aceptado en el alcance de la demo para aislar pruebas exclusivas de IDOR. 

**Decisión General**: APPROVED. La demo cuenta con estándares superiores a la media de PoCs y el código vulnerable ha sido blindado intencionalmente.
