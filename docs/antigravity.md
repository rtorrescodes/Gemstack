# Integración con Google Antigravity

Gemstack aprovecha el ecosistema nativo de Antigravity:
- **Rules (`.agents/rules/`)**: Mapea pseudo-comandos (ej. `/handoff`) para guiar a Gemini.
- **Skills (`.agents/skills/`)**: Utiliza *Progressive Disclosure* mediante validaciones de frontmatter `triggers`.
- **Compatibilidad Dual**: Scripts integrados garantizan que puedes testear el contexto y estado tanto desde Unix (`./bin/gemstack`) como de Windows de forma nativa (`.\bin\gemstack.ps1`).
