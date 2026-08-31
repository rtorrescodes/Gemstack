---
name: gemstack-dashboard
description: Genera una interfaz gráfica (Generative UI) interactiva para visualizar el progreso del proyecto, las tareas pendientes y el estado del CI/CD.
triggers:
  - model_decision
---

# Gemstack Dashboard Skill

Invocado mediante `/dashboard` o `/ui`.

## Proceso:
1. Analiza el estado actual del proyecto leyendo los siguientes archivos (si existen):
   - `specs/current/tasks.md` (Para calcular el % de progreso y tareas `[ ]`, `[/]`, `[x]`).
   - `.gemstack/state.json` (Para ver en qué fase nos encontramos).
   - `docs/security/latest-security-audit.md` (Para extraer el último reporte de seguridad).
2. Genera un archivo HTML utilizando **Generative UI**. El archivo debe llamarse `gemstack-dashboard.html` y guardarse en el directorio de artefactos usando la herramienta `write_to_file` con `UserFacing: true`.
3. El HTML DEBE usar TailwindCSS (vía el CDN autorizado de Antigravity) y variables semánticas (`var(--background)`, `var(--foreground)`, `var(--card)`, etc.).
4. El HTML debe incluir:
   - Una barra de progreso hermosa basada en el % de tareas completadas.
   - Una lista visual de las tareas pendientes y completadas.
   - Un panel resumen del estado de seguridad y fase del proyecto.
   - Una estética premium, limpia y moderna.
5. Embebe el widget en tu respuesta de chat utilizando:
   `<agent-embed src="file:///<artifact_path>/gemstack-dashboard.html"></agent-embed>`

## Reglas de Diseño de Interfaz:
- `<body class="bg-transparent text-[var(--foreground)] antialiased p-5">`
- Contenedores principales: `class="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm"`
- Mantén el diseño compacto para que quepa cómodamente en el chat (menos de 500px de altura si es posible).
- Usa JavaScript embebido si necesitas procesar datos estáticos pasados al HTML en el momento de generación.
