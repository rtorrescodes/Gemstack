# Gemstack Security Core (Military-Grade Shielding)

## Propósito
Esta es la Ley de "Seguridad por Diseño". Todo código escrito, planificado o revisado por la IA bajo el marco Gemstack DEBE adherirse a estos principios de blindaje, independientemente del stack tecnológico utilizado. El objetivo es mitigar el 99% de las vulnerabilidades comunes (OWASP) desde el momento de la concepción del código.

## 1. Cero Exposición de Credenciales (Zero Trust Secrets)
- **Regla Estricta:** JAMÁS hardcodees contraseñas, llaves de API, secrets de Webhooks o URIs de bases de datos en el código fuente.
- **Implementación:** Utiliza siempre variables de entorno (`.env`).
- **Filtrado Frontend:** Asegúrate de que las variables sensibles nunca se empaqueten ni se envíen al lado del cliente (Navegador/App Móvil). Limpia los objetos antes de serializarlos.

## 2. Aislamiento de Contexto (Prevención IDOR y Multi-Tenant)
- **Regla Estricta:** Todo query de base de datos o mutación debe verificar la propiedad del recurso. Un Usuario A no puede acceder a los datos del Usuario B.
- **Implementación:** Si el sistema es Multi-Tenant, todas las consultas DEBEN incluir el filtro del contexto (ej. `WHERE tenant_id = X AND user_id = Y`). Jamás confíes en un ID proporcionado en el payload sin validar que pertenece al usuario autenticado.

## 3. Desconfianza Total del Cliente (Server-Side Validation)
- **Regla Estricta:** "El frontend es solo una ilusión". Jamás confíes en validaciones, estados o permisos que vengan del cliente.
- **Implementación:** Toda acción destructiva, de pago o acceso a datos debe ser re-validada en el backend (Server Actions / APIs). Verifica permisos de autorización en CADA endpoint.

## 4. Protección contra Inyecciones (SQLi & XSS)
- **Regla Estricta:** Queda prohibido concatenar strings para formar consultas a bases de datos.
- **Implementación:** Utiliza siempre ORMs (ej. Prisma, Drizzle) o consultas parametrizadas puras. Para evitar XSS, sanitiza cualquier HTML o texto proveniente de los usuarios antes de renderizarlo.

## 5. Integridad Financiera y Webhooks Criptográficos
- **Regla Estricta:** Si el sistema procesa pagos, la IA NO debe diseñar tablas para almacenar tarjetas de crédito (PCI-DSS Mindset). Usa tokens delegados a proveedores seguros (Stripe, MercadoPago, etc.).
- **Implementación:** Todo Webhook entrante que modifique estados financieros o de membresía DEBE verificar la firma criptográfica (Webhook Secret) provista por el servicio externo antes de ejecutar cualquier lógica.

## 6. Ciclo de Vida de los Datos (Privacidad por Diseño)
- **Regla Estricta:** Diseña con el "Derecho al Olvido" en mente.
- **Implementación:** Almacena contraseñas usando hashes unidireccionales fuertes (ej. `bcrypt`, `argon2`). Sugiere implementaciones de borrado lógico (soft deletes) o retención efímera para datos altamente sensibles.
