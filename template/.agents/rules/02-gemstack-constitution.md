---
name: gemstack-constitution
description: La Constitución de Gemstack (The 9 Articles of Development) para aplicar principios SDD.
triggers:
  - always_on
---
# Gemstack Constitution (Spec-Driven Development)

Estas son las reglas inmutables de arquitectura y desarrollo de la Inteligencia Artificial bajo el framework Gemstack, inspiradas en Spec-Driven Development.

## Article I: Library-First Principle
Toda nueva funcionalidad DEBE nacer y estar estructurada preferentemente como una librería o módulo aislado y reutilizable. No implementes lógica compleja directamente en la capa de la aplicación/UI sin antes abstraerla.

## Article II: CLI / Interface Mandate
Cada módulo o librería clave debe tener una forma de probarse e interactuar textualmente (CLI, scripts independientes, peticiones directas de texto o JSON). Evita componentes opacos que solo puedan probarse levantando interfaces gráficas complejas.

## Article III: Test-First Imperative (NON-NEGOTIABLE)
NUNCA escribas el código de implementación antes que los tests (TDD).
1. Escribe los tests (unitarios, de integración o contratos) basándote en la especificación.
2. Si es posible, demuestra que fallan.
3. Solo entonces, escribe la implementación real.

## Article IV: Zero Assumptions (No Hallucinations)
Si un requerimiento del humano es vago, la IA NO debe adivinar. 
Debes usar el marcador literal `[NEEDS CLARIFICATION: <tu duda específica>]` en las especificaciones para forzar la clarificación humana (por ejemplo, al hablar de stacks, tipos de auth, retención de datos, etc.).

## Article V: State & Guard Awareness
Todo skill o agente DEBE verificar el estado local en `.gemstack/state.json` (incluyendo la spec activa y posibles `freeze` paths de `gemstack-guard`) antes de comenzar a ejecutar acciones destructivas o escrituras en el proyecto.

## Article VI: [Project-Defined Governance]
(Reservados para reglas específicas que el proyecto pueda inyectar en un futuro sobre versionamiento, observabilidad, etc.)

## Article VII: Simplicity Gate
Evita la sobreingeniería (over-engineering). 
- No implementes abstracciones prematuras ni "future-proofing".
- Usa la menor cantidad de proyectos/carpetas/herramientas posibles para satisfacer el MVP.
Si debes romper esto, debes documentarlo en un "Complexity Tracking" en el plan.

## Article VIII: Anti-Abstraction Gate
Confía en el framework base. 
Usa las funciones del framework y librerías estándar nativamente en lugar de crear tus propios wrappers o capas de abstracción innecesarias (ej. no hagas un wrapper sobre Node.js `fs` si no es crítico).

## Article IX: Integration-First Testing
Prioriza el testing realista. Si puedes probar el contrato real o la base de datos local real (con un entorno temporal) por encima de mocks complejos, hazlo. El código generado debe funcionar en la práctica.
