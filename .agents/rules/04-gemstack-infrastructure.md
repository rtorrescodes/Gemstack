# Gemstack Cloud & Infrastructure Security (DevOps)

## Propósito
Esta regla aplica a todo diseño de arquitectura, scripts de despliegue (Docker, Terraform, CI/CD) o configuración de servidores generada por la IA. El objetivo es asegurar que la infraestructura que aloja la aplicación sea un búnker impenetrable.

## 1. Principio de Menor Privilegio (IAM)
- **Regla Estricta:** Ningún servidor, contenedor o pipeline de CI debe operar con credenciales de administrador global.
- **Implementación:** Crea "Roles" o "Service Accounts" con permisos granulares. Por ejemplo, la instancia EC2/CloudRun solo debe tener permisos para leer el bucket S3 específico que necesita, y nada más. Evita los permisos tipo wildcard (`*`).

## 2. Aislamiento de Red (VPC & Bases de Datos Invisibles)
- **Regla Estricta:** Las bases de datos, cachés (Redis) y colas de mensajes JAMÁS deben ser accesibles desde el internet público.
- **Implementación:** Despliega los recursos de datos en "Private Subnets" sin direcciones IP públicas. La aplicación backend se comunica internamente. Para mantenimiento, se debe usar un "Bastion Host" o túneles cifrados (ej. AWS Systems Manager o Cloud IAP).

## 3. Infraestructura Inmutable (No a los Servidores "Mascota")
- **Regla Estricta:** La infraestructura debe ser "Ganado, no Mascotas" (Cattle, not pets). Queda prohibido sugerir flujos donde un humano deba entrar por SSH a instalar cosas a mano en producción.
- **Implementación:** Todo debe ser contenerizado (Docker) o gestionado por Infrastructure as Code (Terraform, Pulumi). Si un servidor es comprometido o falla, se debe poder destruir y recrear automáticamente sin pérdida de estado.

## 4. Gestión de Secretos en Nube (Vault / Secret Manager)
- **Regla Estricta:** Los archivos `.env` solo sirven para desarrollo local. En producción, la infraestructura no debe contener secretos quemados en disco.
- **Implementación:** La infraestructura debe inyectar secretos en tiempo de ejecución o extraerlos de sistemas encriptados como AWS Secrets Manager, GCP Secret Manager o HashiCorp Vault.

## 5. Protección de Perímetro (WAF & DDoS)
- **Regla Estricta:** Ningún tráfico debe golpear la aplicación directamente sin ser filtrado por la capa Edge.
- **Implementación:** Configura (o sugiere) la implementación de un WAF (Web Application Firewall) como Cloudflare, AWS WAF o Google Cloud Armor para filtrar bots maliciosos, DDoS y ataques OWASP a nivel de red antes de que toquen tus servidores Node/Python/Go.

## 6. Encriptación Obligatoria (Transit & Rest)
- **Regla Estricta:** Todo byte viaja y duerme encriptado.
- **Implementación:** Fuerza HTTPS en los Load Balancers con terminación SSL. Todas las bases de datos y volúmenes de almacenamiento (S3, EBS) deben tener la encriptación en reposo activada (`encryption-at-rest`).
