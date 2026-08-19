# Seguridad Práctica en Gemstack (CSO)

Gemstack incluye el skill `gemstack-cso`, que actúa como tu Chief Security Officer virtual.

Invócalo mediante `/cso` (para una revisión general) o mediante sus sub-comandos para revisiones específicas.

## Módulos de Revisión:
1. `/security-idor`: Control de acceso y pertenencia de recursos.
2. `/security-api`: CORS, Rate Limiting, y autenticación.
3. `/security-deps`: Análisis de `package.json` o `requirements.txt`.
4. `/security-uploads`: Validación rigurosa de magic bytes en subidas.
5. `/security-sql`: Prevención de Inyección SQL.
6. `/security-sessions`: Revisión de estrategias de tokens y cookies.
7. `/security-webhooks`: Verificación de firmas de Stripe/PayPal.
8. `/security-headers`: CSP y protección XSS.

**Guardrail:** El CSO puede corregir código trivial de seguridad, pero cambios mayores (migraciones, auth) requieren un Plan de Seguridad y tu aprobación explícita.
