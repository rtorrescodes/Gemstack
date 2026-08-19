# SecureDocs Demo App

SecureDocs es una aplicación de prueba mínima diseñada para auditar el workflow de **Gemstack**.

## Instrucciones de Instalación
```bash
npm install
```

## Ejecución de Smoke Tests (Automático)
Incluye una suite de validación zero-dependency que levanta el server, testea la seguridad anti-IDOR y finaliza:
```bash
npm run smoke
```

## Ejecución (Manual)
```bash
npm start
```
El servidor escuchará en `http://localhost:3000`. Abre en tu navegador nativo o vía `/browser`.

## Probando IDOR
Todos los endpoints están protegidos contra **IDOR** ya que validan `user_id = ?` contra el header `X-Mock-User-Id`.
Para probar la protección manualmente:
1. Selecciona a **Alice** en la UI.
2. Fíjate en el ID de un documento suyo (ej. ID = 1).
3. Selecciona a **Bob**.
4. Escribe el ID `1` en la sección **Test Direct Access (IDOR QA)** y haz click en "Read".
5. Recibirás un error `Not found or forbidden`.

## Gemstack Workflows Compatibles
- `/review`
- `/cso`
- `/security-idor`
- `/security-sql`
- `/security-headers`
- `/qa`
- `/ship`
