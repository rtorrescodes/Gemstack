# Gemstack v0.1

Gemstack es un framework agent-centric y local-first para **Google Antigravity y Gemini Pro**. Está inspirado en metodologías de Spec-Driven Development, auditorías de seguridad prácticas y handoffs estructurados.

## Instalación

**Unix / Git Bash:**
```bash
./bin/gemstack init
```

**Windows / PowerShell:**
```powershell
.\bin\gemstack.ps1 init
```

## CLI Básico

**Unix / Git Bash:**
```bash
./bin/gemstack doctor
./bin/gemstack list
./bin/gemstack show gemstack-handoff
./bin/gemstack security-audit
./bin/gemstack handoff
```

**Windows / PowerShell:**
```powershell
.\bin\gemstack-doctor.ps1
.\bin\gemstack.ps1 list
.\bin\gemstack.ps1 show gemstack-handoff
.\bin\gemstack.ps1 security-audit
.\bin\gemstack.ps1 handoff
```
*(Nota: Si obtienes un error de ExecutionPolicy en Windows, ejecuta: `powershell -ExecutionPolicy Bypass -File .\bin\gemstack-doctor.ps1`)*

## Flujo Recomendado (Pseudo-comandos)
Inicia un chat con Antigravity y utiliza la siguiente secuencia natural:
1. `/office-hours` (Alineación de arquitectura)
2. `/specify` (Definición formal)
3. `/plan` (Diseño técnico)
4. `/tasks` (Desglose ejecutable)
5. `/review` (Revisión de código)
6. `/cso` (Auditoría de seguridad)
7. `/qa` (Pruebas)
8. `/ship` (Preparación para release)
9. `/handoff` (Guardado de memoria)

## Cómo Retomar una Sesión
Abre una sesión limpia (o usa `/clear`) y escribe:
> "Lee handoff.md y continúa desde los próximos pasos"
