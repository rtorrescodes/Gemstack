# Seguridad y Modelo de Confianza en Gemstack

Gemstack es un framework de desarrollo guiado por especificaciones (SDD) que opera de forma local y sin dependencias externas en tiempo de ejecución. La arquitectura de seguridad se estructura en defensas mecánicas deterministas dentro del CLI y guías operativas para agentes de IA.

---

## 1. Modelo de Fronteras y Garantías

Gemstack opera bajo el principio de **Fail-Closed** y honestidad arquitectónica: una comprobación es una garantía únicamente dentro del perímetro donde tiene control mecánico ejecutable.

| Control | Perímetro de Aplicación | Verificación Mecánica | Límite del Perímetro |
|---|---|---|---|
| **Spec-Driven Development (SDD)** | Alineación de arquitectura y congelamiento de fases | Hashes SHA-256 canónicos (`gemstack verify`) | No impide commits manuales externos fuera del CLI |
| **Defensa contra Symlinks y Path Traversal** | Scaffolding, backups, instalación y artefactos visuales | Resolución con `fs.realpathSync` y escrituras atómicas confinadas (`tests/security-p0-hardening.test.js`) | Procesos del SO con permisos elevados fuera del proceso del CLI |
| **Escaneo de Secretos y Hooks Git** | Commits locales y pipelines CI | Expresiones regulares multiproveedor y preservación de hooks existentes (`scripts/ci/check-secrets.js`) | Solo inspecciona archivos de texto en staging/repo; no inspecciona blobs binarios ni redes |
| **Spending & Cost Safety Gates** | Ejecución de modelos y llamadas a APIs facturables | Verificación HMAC de tokens (mín. 16 caracteres), contabilidad acumulativa en proceso, validación de unidades positivas (`src/lib/safety-gates.js`) | Opera en la memoria del proceso Node (`tokenSpendingLedger`); no intercepta procesos de red externos o llamadas curl directas |
| **Procedencia de Skills Remotos** | Ingestión de skills vía HTTPS (`gemstack install`) | Verificación estricta de hash (`--sha256`), bloqueo de credenciales en URL, filtro de IPs privadas/loopback, modo `--inspect` (`tests/skill-install-provenance.test.js`) | Requiere que el usuario verifique el hash esperado; `--inspect` permite previsualizar sin escribir |
| **Autorización de Enmiendas a Contratos** | Modificaciones a contratos en fases congeladas | Firma HMAC obligatoria (mín. 16 caracteres) sobre el payload criptográfico (`src/lib/contract-amendments.js`) | El hash de integridad valida completitud estructural; la autorización mecánica requiere clave secreta |
| **Evidencia de QA Visual** | Capturas de pantalla y regresión visual | Recomputación de SHA-256 desde disco, diff acotado por tolerancia y neutral masking (`src/lib/visual-qa.js`) | La precisión depende del motor de diff; los hashes estáticos solo detectan mutación de archivo |
| **Reglas para Agentes (CSO)** | Contexto y prompts durante revisión y planificación | Auditorías CSO y reglas en `.agents/rules/03-gemstack-security.md` | La guía al agente es consultiva; la garantía mecánica reside en los comandos del CLI y CI |

---

## 2. Puertas de Gasto (`BillableActionGate`) y Límites de Memoria

Para proteger contra ejecuciones comerciales imprevistas o bucles descontrolados de agentes:
1. **Sin autorización = Sin ejecución comercial**: En entornos `test` o `ci`, los proveedores comerciales están estrictamente prohibidos.
2. **Tokens autenticados obligatorios**: Cualquier acción facturable requiere un token con firma criptográfica HMAC-SHA256 válida. No existen tokens autodeclarados (`granted: true` sin firma es rechazado `DENIED`).
3. **Secreto de frontera obligatorio**: `issueSpendingToken` y `verifySpendingToken` exigen un secreto confiable de al menos 16 caracteres. No existen secretos por defecto embebidos en el código.
4. **Presupuestos y Unidades Finitas**: Las peticiones de gasto deben especificar unidades positivas y finitas (`requested_units > 0`).
5. **Límite de la frontera en memoria**: El seguimiento acumulativo de gasto (`tokenSpendingLedger`) se mantiene en la memoria del proceso Node en ejecución. Protege la sesión actual contra rebasamiento de presupuesto del token, pero no constituye un sistema de cuota distribuida entre múltiples procesos independientes del sistema operativo.

---

## 3. Procedencia e Instalación Segura de Skills Remotos

El comando `gemstack install <url>` incorpora controles estrictos para prevenir inyección de código y SSRF:
- **Hash SHA-256 Obligatorio**: No se permite escribir ningún skill en disco sin verificar `--sha256 <hash>`.
- **Modo Inspección Seguro (`--inspect`)**: Permite previsualizar el autor, versión, descripción y hash del skill remoto sin escribir archivos en el repositorio.
- **Bloqueo de Credenciales en URL**: URLs con formato `https://usuario:password@host/...` son rechazadas de inmediato (`CREDENTIALS_IN_URL_BLOCKED`).
- **Defensa SSRF y Filtrado de Red**: Se rechazan esquemas inseguros (`http://`), hosts loopback (`localhost`, `127.0.0.1`), direcciones privadas RFC 1918 / RFC 4193, direcciones link-local, y representaciones ofuscadas (hexadecimal, octal, dword, IPv6 mapping).
- **Lista Blanca de Fuentes**: Por defecto solo se permiten fuentes públicas seguras (`raw.githubusercontent.com`, `gist.githubusercontent.com`), configurable mediante `--allowed-sources`.
- **Protección contra Sobrescritura**: Si el skill ya existe en el proyecto, `gemstack install` se detiene salvo que se especifique `--update` (creando un respaldo automático con timestamp en `.gemstack/backups/skills/`) o `--force`.

---

## 4. Enmiendas Formales a Contratos Arquitectónicos

Cuando un cambio arquitectónico requiere modificar un contrato congelado:
- **No a la manipulación silenciosa**: Modificar un contrato sin registro de enmienda resulta en `FROZEN_CONTRACT_VIOLATION`.
- **Firma Criptográfica HMAC**: Toda enmienda (`recordAmendment`) requiere un secreto HMAC de al menos 16 caracteres configurado en el entorno o pasado explícitamente.
- **Vinculación Criptográfica Completa**: La firma HMAC vincula:
  `feature_id + contract_id + version + previous_contract_sha256 + proposed_contract_sha256 + approved_by + reason`.
- **Integridad vs. Autorización**: `computeAmendmentIntegrityHash` genera un identificador canónico de la estructura de la enmienda, mientras que `computeAmendmentSignature` genera la firma de autorización humana. Ambas funciones operan de forma separada y complementaria.
- **Prevención de Replay y Sustitución**: Modificar el contrato propuesto o intentar reusar la firma en otra característica/versión invalida la firma mediante comparación en tiempo constante (`crypto.timingSafeEqual`).

---

## 5. Chief Security Officer Virtual (`gemstack-cso`)

Gemstack incluye el skill `gemstack-cso` para auditorías continuas de código asistidas por IA.

Invócalo mediante `/cso` (para una revisión general) o mediante sus sub-comandos:
1. `/security-idor`: Control de acceso y pertenencia de recursos.
2. `/security-api`: CORS, Rate Limiting y autenticación.
3. `/security-deps`: Análisis de dependencias locales (`package.json`, etc.).
4. `/security-uploads`: Validación rigurosa de magic bytes en archivos recibidos.
5. `/security-sql`: Prevención de inyecciones SQL / NoSQL.
6. `/security-sessions`: Revisión de tokens, JWTs y directivas de cookies.
7. `/security-webhooks`: Verificación de firmas criptográficas (Stripe, GitHub, etc.).
8. `/security-headers`: CSP, HSTS, X-Frame-Options y protección XSS.

**Guardrail CSO:** El CSO puede sugerir correcciones directas en código trivial, pero cualquier cambio en modelos de autenticación, migraciones de base de datos o permisos requiere un Plan de Seguridad formal y aprobación humana explícita.
