# Plan Técnico de Implementación: Gemstack 2.0 Hardening (Sprint A)

**Feature Branch**: `011-gemstack-2.0-hardening`  
**Feature Directory**: `specs/011-gemstack-2.0-hardening/`  
**Lifecycle Status**: `PLAN_COMPLETE`  
**Stop Reason**: `PLAN_COMPLETE_AWAITING_TASKS`

---

## 1. Arquitectura Técnica y Módulos Afectados

Sprint A implementa el endurecimiento de fronteras de confianza sobre los siguientes subsistemas:

1. **`src/lib/filesystem-safe.js`**:
   - Incorpora función `resolveSafeStrict(rootDir, targetPath, options = { allowCreate: false })`.
   - Resuelve el camino físico real de `rootDir` y de los componentes existentes de `targetPath` usando `fs.realpathSync`.
   - Si cualquier componente intermedio existente o el destino resuelve fuera del límite canónico de `rootDir`, lanza un error con código `SYMLINK_ESCAPE_DETECTED`.
   - Incorpora `withConfinedAtomicWrite(rootDir, targetPath, writeFn)`:
     - Asegura que el archivo temporal se aloje dentro de `path.join(rootDir, '.gemstack', 'tmp')`.
     - Ejecuta la escritura y renombra atómicamente al destino verificado (`fs.renameSync`).

2. **`src/commands/install.js`**:
   - Valida el esquema URL: rechaza todo lo que no sea `https:` (`INSECURE_HTTP_BLOCKED`).
   - Resuelve hostname e IP antes de conectar o rechaza hostnames literales/IPs privadas (`127.0.0.1`, `localhost`, `::1`, `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`, `169.254.0.0/16`) con `PRIVATE_IP_BLOCKED`.
   - Aplica timeout estricto de 8000ms mediante `AbortController`.
   - Controla el tamaño en streaming: acumula hasta 262,144 bytes; si se excede, aborta inmediatamente con `SKILL_PAYLOAD_TOO_LARGE`.
   - Valida el slug del skill mediante regex `^[a-z0-9][a-z0-9-_]{1,63}$` (`INVALID_SKILL_SLUG`).
   - Extrae frontmatter y calcula digest SHA-256 en memoria antes de persistir.

3. **`src/commands/hooks.js`**:
   - Inspecciona `.git/hooks/pre-commit`.
   - Si ya existe y no tiene la firma de Gemstack, renombra el hook existente a `.git/hooks/pre-commit.gemstack-wrapped` y crea un dispatcher que ejecuta secuencialmente el hook del usuario y la validación de Gemstack.
   - Si falla el hook del usuario, el commit se detiene; si pasa, se ejecuta el escáner de Gemstack.
   - Expande los patrones de detección de secretos a:
     - Google Gemini: `AIza[0-9A-Za-z-_]{35}`
     - OpenAI: `sk-[a-zA-Z0-9]{20,}` y `sk-proj-[a-zA-Z0-9_-]{20,}`
     - Anthropic: `sk-ant-[a-zA-Z0-9_-]{20,}`
     - GitHub PAT: `ghp_[0-9a-zA-Z]{36}`, `github_pat_[0-9a-zA-Z_]{22,}`
     - Slack: `xox[baprs]-[0-9a-zA-Z-]{10,}`
     - Claves privadas: `-----BEGIN [A-Z ]*PRIVATE KEY-----`

4. **`scripts/ci/check-secrets.js`**:
   - Nuevo script CLI de CI que escanea archivos rastreados por git (o recursivo si no es git) omitiendo `node_modules`, `.git`, fixtures de prueba controlados (`tests/fixtures/secrets/`), y reporta con código de salida 1 si encuentra secretos activos.
   - Añadido a `npm run ci:all` en `package.json`.

---

## 2. Contratos Heredados de Arquitectura

```gemstack-contracts
[
  {
    "id": "zero-dependency-core",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "https-only-skills",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "allowed-skill-schemes",
    "type": "ENUM_SET",
    "values": [
      "https"
    ]
  },
  {
    "id": "skill-max-payload-bytes",
    "type": "ROADMAP_LIMIT",
    "value": 262144
  },
  {
    "id": "skill-slug-identity",
    "type": "IDENTITY_TUPLE",
    "values": [
      "namespace",
      "slug"
    ]
  },
  {
    "id": "symlink-out-of-bounds",
    "type": "BOUNDARY",
    "value": "FORBIDDEN"
  },
  {
    "id": "existing-hook-destruction",
    "type": "BOUNDARY",
    "value": "FORBIDDEN"
  },
  {
    "id": "secret-scanning-ci",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  },
  {
    "id": "atomic-writes-confined",
    "type": "BOOLEAN_INVARIANT",
    "value": true
  }
]
```

---

## 3. Mapeo Canónico de Pruebas (Test Bindings)

```gemstack-test-bindings
[
  {
    "id": "TEST-HARDEN-A01",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-A01"
  },
  {
    "id": "TEST-HARDEN-A02",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-A02"
  },
  {
    "id": "TEST-HARDEN-A03",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-A03"
  },
  {
    "id": "TEST-HARDEN-A04",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-A04"
  },
  {
    "id": "TEST-HARDEN-A05",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-A05"
  },
  {
    "id": "TEST-HARDEN-B01",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-B01"
  },
  {
    "id": "TEST-HARDEN-B02",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-B02"
  },
  {
    "id": "TEST-HARDEN-B03",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-B03"
  },
  {
    "id": "TEST-HARDEN-B04",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-B04"
  },
  {
    "id": "TEST-HARDEN-C01",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C01"
  },
  {
    "id": "TEST-HARDEN-C02",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C02"
  },
  {
    "id": "TEST-HARDEN-C03",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C03"
  },
  {
    "id": "TEST-HARDEN-C04",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C04"
  },
  {
    "id": "TEST-HARDEN-C05",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C05"
  },
  {
    "id": "TEST-HARDEN-C06",
    "file": "tests/security-p0-hardening.test.js",
    "symbol": "TEST-HARDEN-C06"
  }
]
```

---

## 4. Portones de Cierre (Closure Gates)

```gemstack-closure-gates
[
  {
    "id": "gate-test",
    "type": "PACKAGE_SCRIPT",
    "script": "test",
    "requirement": "REQUIRED",
    "waivable": false
  },
  {
    "id": "gate-ci-all",
    "type": "PACKAGE_SCRIPT",
    "script": "ci:all",
    "requirement": "REQUIRED",
    "waivable": false
  }
]
```
