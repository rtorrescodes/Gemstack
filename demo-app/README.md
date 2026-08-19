# SecureDocs Demo App

SecureDocs es una aplicación de prueba mínima diseñada para auditar el workflow de **Gemstack**.

## Instrucciones de Instalación
```bash
npm install
npm start
```
El servidor escuchará en `http://localhost:3000`.

## Endpoints
- `GET /api/users`: Lista de usuarios de prueba.
- `GET /api/docs`: Lista de documentos del usuario actual.
- `POST /api/docs`: Crear documento.
- `GET|PUT|DELETE /api/docs/:id`: Modificar o leer documento por ID.

## Testing de Vulnerabilidades
Todos los endpoints están protegidos contra **IDOR** (Insecure Direct Object Reference) ya que validan `user_id = ?` contra el header `X-Mock-User-Id`.

Para probar la protección:
1. Entra como Alice. La consola cargará sus documentos (ej. ID 1 y 2).
2. Entra como Bob. La consola cargará sus documentos (ej. ID 3 y 4).
3. Estando como Bob, escribe el ID "1" en la sección **Test Direct Access (IDOR QA)** y dale a "Read" o "Delete".
4. Recibirás un error `404 Not found or forbidden`.

Para probar la prevención **XSS**:
Crea un documento con título `<script>alert(1)</script>`. Al renderizarse, el navegador lo mostrará como texto y no lo ejecutará, dado que usamos `textContent` en lugar de `innerHTML`.

## Gemstack Workflows
Puedes usar esta demo para probar:
- `/review`: Revisa la calidad de `server.js` y `app.js`.
- `/cso`: El Agente te dará el visto bueno o reportará hallazgos en headers e inyecciones.
- `/qa`: Validará el formulario y los controles.
