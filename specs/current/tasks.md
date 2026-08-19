# Tareas de Implementación: App Demo "SecureDocs"

Basado en `plan.md`, aquí están las tareas para ejecutar el ciclo `/build`.

- [ ] **Tarea 1: Inicialización**
  - Crear carpeta `demo-app`.
  - Crear `package.json` base con dependencias `express` y `sqlite3`.
  - Crear estructura de carpetas (`demo-app/public`).

- [ ] **Tarea 2: Base de Datos**
  - Crear `demo-app/database.js`.
  - Configurar SQLite3.
  - Crear tabla `users` (id, name) e insertar usuarios mock (Alice, Bob).
  - Crear tabla `documents` (id, user_id, title, content).

- [ ] **Tarea 3: Backend & Middlewares**
  - Crear `demo-app/server.js`.
  - Añadir middleware estático para `/public`.
  - Añadir middleware de mock auth (lee header `X-Mock-User-Id` y añade `req.user`).

- [ ] **Tarea 4: Endpoints CRUD (Con protección IDOR)**
  - `GET /api/users` (Para llenar el selector del frontend).
  - `POST /api/docs` (Crear documento ligado a `req.user.id`).
  - `GET /api/docs` (Listar documentos WHERE user_id = req.user.id).
  - `GET /api/docs/:id` (Lectura de doc individual con chequeo IDOR).
  - `PUT /api/docs/:id` (Actualización con chequeo IDOR).
  - `DELETE /api/docs/:id` (Borrado con chequeo IDOR).

- [ ] **Tarea 5: Frontend**
  - Crear `index.html` (Selector de usuarios, formulario de creación, lista de documentos).
  - Crear `app.js` (Lógica de fetch, pasando `X-Mock-User-Id` en los headers, manipulación DOM segura contra XSS).
  - Crear `style.css`.

- [ ] **Tarea 6: Documentación local**
  - Crear `demo-app/README.md` con instrucciones `npm install` y `npm start`.
