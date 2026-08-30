# Plan de Implementación: [FEATURE]

**Feature Branch**: `[###-feature-name]` | **Spec**: [ruta al spec.md]

## 1. Summary & Technical Context
- **Lenguaje/Versión**: [Ej. Node 18+ o NEEDS CLARIFICATION]
- **Dependencias core**: [Ej. Express o NEEDS CLARIFICATION]
- **Restricciones**: [Ej. Zero-deps en runtime]

## 2. Constitution Check (Phase -1 Gates)
<!-- VERIFICACIÓN DE REGLAS INMUTABLES -->
### Simplicity Gate (Article VII)
- [ ] ¿Se usan el mínimo número de carpetas/archivos posibles?
- [ ] ¿No hay abstracciones prematuras (future-proofing)?

### Anti-Abstraction Gate (Article VIII)
- [ ] ¿Se usan las APIs nativas del framework sin wrappers innecesarios?

### Test-First Imperative (Article III)
- [ ] ¿El plan incluye la creación de tests antes que el código fuente?

## 3. Entregables Satélites a Generar
<!-- Además de este plan y las tareas, se deben documentar los siguientes si aplica: -->
- `research.md`: [Opcional - Análisis de herramientas]
- `data-model.md`: [Esquemas de datos y entidades]
- `contracts/`: [Documentación de APIs y contratos (REST/Interfaces)]
- `quickstart.md`: [Guía rápida de validación manual]

## 4. Estructura de Archivos a Modificar / Crear
```text
ruta/archivo: [Razón]
```

## 5. Complexity Tracking
<!-- Llenar SÓLO si las Gates de la Constitución fallan y se requiere justificar complejidad -->
| Violación de Regla | Por qué es necesario | Alternativa simple rechazada por |
|--------------------|----------------------|-----------------------------------|
| [Ej. Wrapper]      | [Razón]              | [Razón]                           |
