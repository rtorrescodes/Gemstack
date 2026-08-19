# Plan de Implementación: App Demo "SecureDocs"

## 1. Arquitectura Propuesta
Para mantener la demo ligera pero realista respecto a las vulnerabilidades comunes de bases de datos relacionales, usaremos:
- **Backend**: Node.js + Express.js.
- **Base de Datos**: SQLite3 (en memoria o archivo local). Esto es crucial para generar IDs incrementales o UUIDs reales que puedan ser objeto de un ataque IDOR.
- **Frontend**: Vanilla HTML / JS / CSS servido estáticamente por Express. Sin frameworks complejos para reducir ruido.
- **Autenticación (Mock)**: Middleware en Express que lee un header `X-Mock-User-Id` enviado por el frontend.

## 2. Archivos a Crear
Se creará un directorio aislado `demo-app/` para no mezclar código con la estructura de Gemstack.
- `demo-app/package.json`: Dependencias (express, sqlite3).
- `demo-app/server.js`: Servidor Express, endpoints CRUD, y middleware de auth.
- `demo-app/database.js`: Inicialización de SQLite y tablas (`users`, `documents`).
- `demo-app/public/index.html`: UI principal.
- `demo-app/public/app.js`: Lógica del frontend (cambio de usuario, llamadas fetch).
- `demo-app/public/style.css`: Estilos básicos.
- `demo-app/README.md`: Instrucciones de ejecución.

## 3. Revisión de Seguridad (CSO View)
- **Riesgo Principal (IDOR)**: En cada endpoint (`GET /:id`, `PUT /:id`, `DELETE /:id`), la query SQL DEBE incluir `WHERE id = ? AND user_id = ?`. Confiar solo en el ID del documento es la vulnerabilidad exacta que esta demo busca prevenir y testear.
- **SQL Injection**: Todas las queries deben usar *Prepared Statements* de la librería sqlite3 (`db.run('...', [params])`).
- **XSS**: El frontend usará `textContent` en lugar de `innerHTML` al renderizar los documentos para prevenir ejecución de scripts almacenados.

## 4. Plan de QA
- Lanzar el servidor.
- Entrar como "Alice", crear "Doc de Alice". Tomar nota del ID (ej. ID=1).
- Cambiar a "Bob".
- Bob intenta abrir el ID=1 inyectándolo en la URL o vía `fetch`. Validar que recibe HTTP 403 Forbidden.
- Validar mitigación de XSS introduciendo `<script>alert(1)</script>` como título de un documento.

## 5. Plan de Release
- Consolidar la app.
- Ejecutar el skill `/cso` de Gemstack sobre `demo-app/` para ver si encuentra vulnerabilidades.
- Ejecutar `/qa` con los tests definidos.
- Actualizar `handoff.md` validando el fin del experimento.
