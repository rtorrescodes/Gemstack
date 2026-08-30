---
name: gemstack-sandbox
description: Ejecución segura de código dentro de contenedores efímeros Docker.
triggers:
  - model_decision
---

# Gemstack Sandbox Skill

Invocado mediante `/sandbox`.

## Proceso:
1. Asegúrate de que `docker` esté disponible en el entorno del usuario (`docker --version`).
2. Recibe el comando o script que el usuario (o tú mismo) desea probar (por ejemplo, una instalación de dependencias no confiables, o una validación CSO).
3. Construye el comando de ejecución envuelto en docker: `docker run --rm -v $(pwd):/app -w /app node:20 <comando>`.
   *(Nota: en entornos Windows PowerShell ajusta la ruta del volumen a `${PWD}`)*
4. Ejecuta el contenedor, captura los logs de stdout y stderr.
5. Limpia los contenedores residuales si el script falla críticamente.
6. Presenta los resultados de la ejecución segura al usuario sin haber alterado el entorno nativo.
