---
name: gemstack-cso
description: Auditoría de seguridad del código (Chief Security Officer).
triggers:
  - model_decision
---

# Gemstack CSO Skill

Invocado mediante `/cso` o sus subcomandos:
- `/security-audit`: Escaneo general de los puntos abajo.
- `/security-idor`: Control de acceso (IDOR).
- `/security-api`: CORS, Auth, Rate Limiting.
- `/security-deps`: Dependencias vulnerables (npm audit).
- `/security-uploads`: Magic bytes, ejecución de subidas.
- `/security-sql`: Inyección SQL, Prepared statements.
- `/security-sessions`: Tokens, HttpOnly cookies.
- `/security-webhooks`: Validación de firmas.
- `/security-headers`: XSS, CSP.

## Proceso:
1. Analiza el código actual en busca de vulnerabilidades de seguridad (OWASP Top 10).
2. VERIFICACIÓN CRÍTICA: Lee y aplica todas las leyes de `.agents/rules/03-gemstack-security.md`.
3. Presta especial atención a:
   - Inyección de dependencias y scripts (XSS, SQLi).
   - Manejo de secretos (¿Hay tokens hardcodeados?).
   - Verificación de IDOR (Aislamiento de contexto y Multi-Tenant).
   - Firmas criptográficas en Webhooks.
   - Autenticación y cifrado de contraseñas.
4. Genera un reporte exhaustivo y guárdalo en `docs/security/latest-security-audit.md`.
5. Si encuentras brechas, no ofrezcas sugerencias pasivas: INICIA UNA ALERTA y propón el código corregido de inmediato.

## Generación de Reporte:
Cada reporte de seguridad debe agrupar los hallazgos por severidad:
- **Critical**
- **High**
- **Medium**
- **Low**
- **Informational**

Y asignar un estado a cada ítem:
- **Fixed**
- **Needs approval**
- **Manual review required**
- **Not applicable**

## Acciones:
Los fixes simples pueden automatizarse. Cambios en auth/sesiones son críticos y siempre entran como "Needs approval" requiriendo permiso explícito antes de generar código.

