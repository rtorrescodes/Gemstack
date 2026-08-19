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

