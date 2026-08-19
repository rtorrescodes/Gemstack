# Latest QA Report
**Date:** 2026-08-19

## QA Flow: SecureDocs

### Entorno de Prueba
- Localhost, Node 20+
- `npm start` sobre `demo-app/`

### Casos de Prueba Ejecutados Manualmente / API
1. **[PASS] Selección de Usuario:** Cambiar en el `<select>` entre Alice y Bob recarga exitosamente la lista de documentos (`loadDocs`).
2. **[PASS] Creación de Documento:** Crear un documento siendo Alice con contenido válido retorna HTTP 201 y un ID autoincremental. Se renderiza en pantalla al instante.
3. **[PASS] Testing Anti-IDOR Directo:** Al loguearse como Bob e intentar hacer READ o DELETE sobre el documento nuevo de Alice mediante el campo manual de "Test IDOR QA", se recibe un status `404` y mensaje `error: Not found or forbidden`.
4. **[PASS] Testing XSS Básico:** Se inyectó `<script>alert("Hacked")</script>` en el título. El documento se listó en la UI de Alice como un string literal gracias a la codificación DOM generada por `textContent`.

### Conclusión
- Criterios de aceptación de la Especificación cumplidos al 100%. No hay bloqueos.
