# Especificación de Funcionalidad: App Demo "SecureDocs"

## 1. Idea / Requerimiento
Construir una aplicación de demostración llamada "SecureDocs" diseñada específicamente para testear el workflow de Gemstack (especialmente los controles de seguridad contra IDOR). 
La aplicación permitirá a los usuarios (mockeados) iniciar sesión, crear documentos, y realizar operaciones CRUD (Create, Read, Update, Delete) estrictamente aisladas. Un usuario no debe poder interactuar con los documentos de otro usuario bajo ninguna circunstancia.

## 2. Criterios de Aceptación
- [ ] **Autenticación Simple**: La UI debe permitir seleccionar un "Usuario Activo" de una lista predefinida (ej. Alice, Bob) para simular sesiones.
- [ ] **Creación**: Un usuario autenticado puede crear un documento (título y contenido).
- [ ] **Listado**: Un usuario solo ve sus propios documentos en la lista principal.
- [ ] **Lectura**: Al acceder a un documento específico, el backend debe verificar que el usuario sea el propietario.
- [ ] **Actualización y Borrado**: El backend debe impedir modificaciones o borrados si el usuario no es el dueño (prevención IDOR).
- [ ] **Feedback UI**: La interfaz debe mostrar errores claros (ej. "403 Forbidden") si se intenta un acceso no autorizado de forma manual.
- [ ] **Documentación**: Debe incluir un `README.md` dentro de la carpeta de la demo explicando cómo arrancarla.

## 3. Casos Extremos (Edge Cases) a probar en /qa
- [ ] **Intento IDOR directo**: El Usuario A obtiene el ID de un documento del Usuario B e intenta hacer un `GET /api/docs/{id_de_B}`. Debe fallar con 403.
- [ ] **Intento IDOR en modificación**: El Usuario A intenta hacer `PUT /api/docs/{id_de_B}` o `DELETE`. Debe fallar con 403.
- [ ] **Usuario Inexistente/No autenticado**: Intentar crear un documento sin usuario activo debe fallar con 401.
- [ ] **Documento inexistente**: Acceder a un ID que no existe debe retornar 404, independientemente de quién pregunte.
