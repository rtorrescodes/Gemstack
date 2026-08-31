# 📖 Manual Oficial de Gemstack (La Guía Definitiva)

¡Bienvenido a **Gemstack**! Si estás leyendo esto, probablemente sientes curiosidad sobre cómo programar mejor con Inteligencia Artificial. Este manual está diseñado para explicarte qué es este proyecto, por qué existe y cómo usarlo paso a paso, de manera sencilla.

---

## 1. ¿Qué es Gemstack?

Hoy en día, herramientas como Copilot, Cursor, o Antigravity son increíbles escribiendo código, pero **tienen un problema**: son caóticas. Si les pides un sistema complejo, a menudo olvidan requerimientos, introducen vulnerabilidades de seguridad y pierden el hilo del proyecto.

**Gemstack NO es un framework de código** (no compite con React, Django o Laravel). 
Gemstack es un **"Sistema Operativo para Inteligencias Artificiales"**. 

Es una herramienta de cero dependencias (funciona en cualquier lenguaje y computadora) que inyecta un "cerebro", disciplina y reglas militares en tu repositorio. Cuando instalas Gemstack, obligas a la IA a dejar de improvisar y comenzar a trabajar como un Ingeniero Senior de Software bajo procesos estrictos.

---

## 2. Instalación: Tu Primer Paso

No necesitas instalar librerías pesadas. En cualquier proyecto (sea nuevo o uno que ya lleve meses de desarrollo), abre tu terminal y ejecuta:

```bash
npx gemstack-ai init
```

**¿Qué hace esto?**
No tocará tu código fuente. Creará silenciosamente carpetas ocultas (`.agents/`, `specs/`, `docs/`) que contienen las reglas, habilidades y flujos de trabajo que la IA debe leer antes de ayudarte a programar. ¡Y listo! Tu proyecto ahora tiene un "cerebro" estructurado.

---

## 3. El Flujo de Trabajo (Spec-Driven Development)

Para usar Gemstack, no programas directamente. Escribes **especificaciones** en tu chat de IA y dejas que los agentes sigan un proceso ordenado. Así es como se construye una funcionalidad:

### Paso A: Ideación (`/spec`)
Abre tu chat con la IA (Cursor, Antigravity, Claude) y dile:
> *"Quiero crear un sistema de login. Ejecuta `/spec`"*

El agente **Product Manager** analizará tu idea, te hará preguntas clave y escribirá un documento Markdown (`specs/current/spec.md`) detallando exactamente cómo debe funcionar, sin escribir ni una línea de código aún.

### Paso B: Planificación (`/plan`)
Una vez que apruebes el Spec, dile a la IA:
> *"Perfecto, ejecuta `/plan`"*

El agente **Arquitecto** leerá el Spec y decidirá qué archivos hay que crear, qué base de datos usar y cómo estructurarlo técnicamente (`specs/current/plan.md`).

### Paso C: Ejecución (`/tasks`)
Dile a la IA:
> *"Haz el desglose, `/tasks`"*

Se generará una lista de tareas (`[ ]`, `[/]`, `[x]`). Ahora simplemente dile a la IA: *"Empieza a ejecutar la tarea 1"*. La IA escribirá el código de forma ordenada y controlada.

---

## 4. Los Súper Poderes de Gemstack

Gemstack viene con funcionalidades avanzadas (Skills) que puedes invocar como comandos en tu chat:

### 🛡️ Seguridad Militar (`/cso`)
Dile a la IA: *"Ejecuta `/cso`"*. El Chief Security Officer auditará tu código. Gemstack tiene leyes estrictas implantadas en su núcleo (AppSec Nivel 2 y DevOps). Si tienes una contraseña expuesta, o tu base de datos es vulnerable a un ataque de fuerza bruta, el agente detendrá todo y te obligará a parcharlo.

### 🪝 Prevención Activa (Git Hooks)
Gemstack se asegura de que tú, como humano, tampoco cometas errores. Al hacer `npx gemstack-ai init`, se instala un guardián invisible. Si intentas hacer un `git commit` y por error incluiste una llave de Amazon Web Services (AWS) o un archivo `.env`, Gemstack bloqueará el commit en tu terminal y te regañará.

### 📊 Dashboard Interactivo (`/dashboard`)
¿Perdido en el código? Dile a tu chat de IA (si usas Antigravity):
> *"Ejecuta `/dashboard`"*

La IA leerá tu lista de tareas y generará una interfaz gráfica incrustada en tu chat mostrándote una barra de progreso, el estado de tu seguridad y las tareas pendientes.

### 🔌 Instalación de Skills Externos
Gemstack es extensible. Si alguien en internet creó un súper agente especialista en Python, puedes descargarlo a tu proyecto directamente desde la terminal:
```bash
npx gemstack-ai install https://raw.githubusercontent.com/usuario/repo/main/SKILL.md
```

### 🤖 Servidor MCP (Para IAs Externas)
Si usas Claude Desktop u otro cliente que soporte **Model Context Protocol (MCP)**, puedes configurar Gemstack como una de sus herramientas nativas. Simplemente configura el servidor ejecutando en tu cliente: `npx gemstack-ai mcp`. La IA podrá "llamar" a Gemstack directamente por debajo de la mesa para preguntarle cuáles son tus tareas actuales y reglas de seguridad sin que tengas que decirle nada.

---

## 5. Terminando tu Día (`/handoff`)

Cuando termines de trabajar, dile a la IA:
> *"He terminado por hoy. Ejecuta `/handoff`"*

La IA escribirá un archivo `handoff.md` resumiendo exactamente en qué te quedaste, qué bugs hay pendientes y qué debes hacer mañana. 

Al día siguiente (o si otro desarrollador toma tu proyecto), el primer mensaje al chat debe ser:
> *"Hola, soy nuevo aquí. Ejecuta `/resume`"*

La IA leerá el Handoff y te pondrá al día instantáneamente.

---

## Resumen Final
Gemstack te convierte en un Director de Orquesta. En lugar de pelear con el código línea por línea, tú diriges a los agentes (Product Manager, CSO, QA) utilizando comandos simples (`/spec`, `/plan`, `/cso`, `/dashboard`). 

¡Disfruta construyendo software de grado empresarial a la velocidad de la luz!
