# Latest QA Report
**Date:** 2026-08-19

## QA Flow: SecureDocs

### Entorno de Prueba
- Node.js (v18+)
- Automatizado vía `npm run smoke`

### Resultados de Smoke Tests
Los smoke tests ejecutaron exitosamente los siguientes escenarios:
- `[OK]` Users fetched correctly
- `[OK]` Alice created document
- `[OK]` Bob blocked from reading Alice's doc (Status 404)
- `[OK]` Bob blocked from deleting Alice's doc (Status 404)
- `[OK]` Bob created doc with malicious payload
- `[OK]` Malicious payload ignored: Doc does not belong to Alice
- `[OK]` Malicious payload ignored: Doc belongs to Bob safely

### Casos de Prueba Ejecutados Manualmente / API
1. **[PASS] Selección de Usuario:** Cambiar en el `<select>` entre Alice y Bob recarga exitosamente la lista de documentos (`loadDocs`).
2. **[PASS] Testing XSS Básico:** Se inyectó `<script>alert("Hacked")</script>` en el título. El documento se listó en la UI de Alice como un string literal gracias a la codificación DOM generada por `textContent`.

### Conclusión
- Todos los smoke tests pasan con exit code `0`. Sin bugs bloqueantes detectados. El QA confirma la mitigación de IDOR.
