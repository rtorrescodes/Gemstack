# Release Flow (Ship)

El flujo de liberación `/ship` se asegura de que todo esté en orden:

1. **Tests**: El agente valida que se pasen las pruebas.
2. **Review**: Ejecución de linting, typechecking y revisión humana de las especificaciones de `specs/current/`.
3. **Doctor Check**: Antes de preparar un release local, se debe validar el entorno con al menos uno de estos caminos:
   - **Unix/Git Bash:** `./bin/gemstack-doctor`
   - **PowerShell:** `.\bin\gemstack-doctor.ps1`
4. **Deploy**: **Regla estricta:** el agente JAMÁS hará un `git push`, merge o lanzará un script de deploy sin explícita aprobación humana.
