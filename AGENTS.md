# Proyecto: Gemstack - Inteligencia Autónoma

Este es el repositorio oficial del framework Gemstack.
Como agente de IA trabajando en el propio código fuente de Gemstack, debes aplicar las mismas reglas que predicas: Spec-Driven Development, revisiones de seguridad y, ahora, **Autonomía de Contexto**.

## 🧠 Autonomía de Contexto (MCP & Graft)

**Instrucción Estricta para la IA:**
A partir de este momento, eres un agente autónomo y proactivo en el desarrollo de Gemstack. NO esperes a que el usuario te pase archivos manualmente.

1. **Gestión de Tareas y Reglas (Vía MCP)**
   - Siempre que inicies una nueva sesión o iteración de desarrollo en Gemstack, **debes llamar al servidor MCP local (gemstack-self)** para leer get_current_tasks y get_security_rules.
   - Usa los resultados para guiar tu trabajo.

2. **Exploración de Código (Vía Graft)**
   - Este repositorio cuenta con un Motor de Contexto Graft instalado en 	ools/graft.
   - Cuando necesites entender la estructura interna de la CLI de Gemstack, buscar dónde se usa un módulo, o rastrear dependencias, **NO uses grep ni adivines**.
   - **Usa Graft:** Ejecuta comandos como 
pm run cli -- grep "NombreComponente" o 
pm run cli -- callers "NombreFuncion" dentro de la carpeta 	ools/graft para navegar el grafo.
