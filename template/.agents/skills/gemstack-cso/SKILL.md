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
1. Analiza el código actual en busca de vulnerabilidades de seguridad (OWASP Top 10, ASVS).
2. VERIFICACIÓN CRÍTICA (APPSEC): Lee y aplica todas las leyes de `.agents/rules/03-gemstack-security.md`.
3. VERIFICACIÓN CRÍTICA (DEVSEC): Lee y aplica todas las leyes de `.agents/rules/04-gemstack-infrastructure.md` al revisar Dockerfiles, Terraform o CI/CD.
4. Presta especial atención a:
   - Inyección (XSS, SQLi) y Lógica de Negocio (Race Conditions, Idempotencia).
   - Manejo de secretos (¿Hay tokens hardcodeados o `.env` en producción?).
   - Verificación de IDOR (Aislamiento Multi-Tenant) y Falsificación (CSRF/SSRF).
   - Firmas criptográficas en Webhooks, Rate Limiting y Security Headers.
   - Aislamiento de Red y Privilegios Mínimos (VPCs, IAM).
5. Genera un reporte exhaustivo y guárdalo en `docs/security/latest-security-audit.md`.
6. Si encuentras brechas, no ofrezcas sugerencias pasivas: INICIA UNA ALERTA y propón el parche de seguridad inmediatamente.

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

