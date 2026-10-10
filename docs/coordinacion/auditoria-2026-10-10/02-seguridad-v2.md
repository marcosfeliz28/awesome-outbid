# Auditoría de Seguridad v2 — Nexora POS (a12c980)

- **Rama/commit:** `origin/nexora-cloud` @ `a12c980` (worktree desacoplado `wt-v2-seguridad`; sin cambios de código ni push).
- **Fecha:** 2026-10-10. **Referencia:** `02-seguridad.md` (v1, commit `3e5521c`).
- **Alcance de cambios revisados:** migraciones `202610200001`..`202610210004` (las 26 aplican limpias con `prisma migrate deploy`), módulo Drive (`drive-backup.ts`, `drive-backup-core.ts`, `scripts/decrypt-backup.mjs`), bloqueo de login (`auth.ts`, `security.ts`), PIN de 6 dígitos, cola de escaneo y borrador de carrito (web), actualización PWA, índices, idempotencia (`operationId`), retención, nginx/IP real, Dockerfile.
- **Método:** lectura estática del diff `3e5521c..a12c980` + reproducción local: PostgreSQL 16 aislado (`/var/lib/postgresql/audsec3-23da`, puerto 55631, eliminado al terminar), API compilada `NODE_ENV=production` (puerto 55641), sembrada con datos sintéticos. Producción: solo GET públicos (`/api/health`, `/api/health/live`, `/api/backups/status`, `/api/backups/google/callback`, `/api/docs`). `pnpm audit --prod`: 0 vulnerabilidades.
- Cada hallazgo marca **VERIFICADO** (reproducido) o **NO VERIFICADO** (estático / depende de configuración no observable).

---

## 1. Tabla v1 → estado

| ID v1 | Sev. v1 | Estado v2 | Evidencia |
|---|---|---|---|
| S-01 Bloqueo dirigido de cuenta por IP de borde compartido | ALTO | **PARCIAL** (residual MEDIO, ver N-01) | `auth.ts:206-257` (`passwordAttempt`): clave propia por equipo aprobado `login:<cuenta>:<ver>:terminal:<id>`; para el resto, clave por IP + cupo de cuenta `login-account:` de 10 fallos/h (`security.ts:69,156-254`). `nginx.conf.template:10-19` recupera la IP real de `CF-Connecting-IP`. Repro local (VERIFICADO): 5 fallos desde IP A bloquean solo la IP A (víctima en IP B entra, 201); 10 fallos repartidos en IPs distintas agotan el cupo de cuenta y la víctima con clave correcta desde otra IP recibe "Cuenta bloqueada…" durante 1 h (fila `login-account:…` `lockedUntil` +1 h). Desde un equipo aprobado sigue entrando (diseño, `DECISIONES.md` punto 15). Tests: `tests/auth-lockout.test.ts`. |
| S-02 Límites de login globales tras el borde | MEDIO | **PARCIAL** (residual BAJO, ver N-02) | `auth.ts:132-175`: los cupos en memoria se cuentan por equipo aprobado en vez de IP. Pero el cubo global `auth-unknown` (120/min, `rate-limit.ts:32-35`) sigue compartido: VERIFICADO, 140 intentos con identidades inexistentes desde 7 IP → una clave equivocada de una cuenta real desde una IP nueva recibe 429; la clave correcta entra (201). Que la IP real se recupere en Render: NO VERIFICADO. |
| S-03 PIN de 4 dígitos; aprobaciones contra todos los gerentes | MEDIO | **PARCIAL** (mayormente corregido; residual BAJO, ver N-05) | Alta/edición exigen 6 dígitos: `admin.ts:186-187` (`newPinSchema`), VERIFICADO `POST /users` con PIN `1234` → 400 "El PIN debe tener 6 dígitos". Cupos: `pin-requester:` 10 fallos/h y `pin-short:<sucursal>` 10 fallos/h (`security.ts:259-334`); VERIFICADO 5 fallos → "PIN bloqueado… 15 minutos" y filas `switch:`, `pin-requester:`, `pin-short:main` con 5; auditoría `pin_locked`/`pin_short_used`. Siguen aceptándose 4-5 dígitos ya guardados (`auth.ts:715`, `cash.ts:590,743,862`, `offline-sale-review.ts:44`, `realtime.ts:271`) y `scripts/create-admin.ts:17` aún crea PIN de 4-6. |
| S-04 `AuditLog.ip` nunca se rellena | BAJO | **CORREGIDO** | `common.ts:324` (`ip: actor.ip`) y `common.ts:687` (`ip: clientIp(req)` en el guard); `auth.ts:239-254` audita `login_locked` con IP y ámbito. VERIFICADO: filas `login` y `login_locked` con `ip`. Retención 90 d: `security.ts:341-371` (`SecurityMaintenance`). Salvedad: si en prod la IP siguiera colapsada (N-04), el campo sería poco útil. |
| S-05 Facturas a Anthropic | BAJO | **ABIERTO** (aceptado y documentado, inactivo) | `invoice.ts` sin cambios. `render.yaml` no declara `ANTHROPIC_API_KEY`. Documentado en `docs/legal/REGISTRO_TERCEROS.md` fila 3 y `POLITICA_PRIVACIDAD.md:45`. Sin cambios de riesgo. |
| S-06 `/api/health` revela servicio y BD | BAJO | **CORREGIDO** | `app.ts:44-58` devuelve `{"status":"ok"}` (503 genérico). VERIFICADO local y en producción (`GET /api/health` → `{"status":"ok"}`; `/api/health/live` igual). |
| S-07 Dependencias de desarrollo con CVE | INFO | **SIN CAMBIO** | `pnpm audit --prod`: "No known vulnerabilities found". Dev no re-evaluado. |
| Previos SEC-01 (bomba XLSX), SEC-03 (escalada PIN), SEC-05 (PII), SEC-07 (HSTS) | — | **SIGUEN EFECTIVOS** | `xlsx-guard.ts`, `canSwitchUserTo`/`customerForActor` (`common.ts`) sin cambios en el diff; HSTS `max-age=31536000; includeSubDomains` + CSP estricta + `X-Frame-Options: DENY` confirmados en producción; `/api/docs` → 404; `/api/backups/status` sin token → 401. |

---

## 2. Hallazgos nuevos y residuales

Resumen: **0 críticos, 0 altos, 4 medios, 5 bajos, 1 info.**

### N-01 — MEDIO — VERIFICADO — El cupo de cuenta (10 fallos/h) sigue permitiendo dejar fuera a la cajera/gerente desde equipos no aprobados
- **Archivos:** `apps/api/src/auth.ts:206-257`, `apps/api/src/security.ts:69,156-254` (el cupo se evalúa antes de verificar, así que una clave correcta también se rechaza).
- **Escenario:** el atacante (o un empleado) conoce un identificador de cuenta (`admin@…`). Envía 10 logins con clave errónea desde IP distintas (o 5 desde una sola si la IP del borde sigue colapsada, N-04). Desde ese momento y hasta 1 h, esa cuenta no puede entrar desde ningún equipo **no aprobado**: celular del dueño, PC nueva, primer login de una empleada nueva, y también el cambio obligatorio de clave (`/auth/change-password` comparte los contadores). Repetible cada hora con 10 peticiones. Los equipos aprobados no se afectan. Repro local: ver fila S-01.
- **Impacto:** baja de ALTO (v1) a MEDIO: la caja registrada sigue vendiendo, pero la dueña fuera de la tienda y los altas de personal quedan sin acceso, y un `login_locked` (ámbito `account`) no avisa a nadie en tiempo real.
- **Arreglo mínimo:** (a) generar una alerta (`Alert` + Telegram) cuando un `login_locked` tenga ámbito `account` (el evento ya existe, `auth.ts:240`); (b) subir `LOGIN_ACCOUNT_FAILURES_PER_HOUR` a 30 (720 intentos/día contra una clave de ≥12 caracteres con 4 clases sigue siendo inviable) para que el atacante necesite mucho más tráfico; (c) documentar en el manual que la dueña/gerencia debe tener al menos un equipo aprobado propio.

### N-02 — BAJO — VERIFICADO — El cubo global de identidades desconocidas aún da 429 a toda la tienda durante un barrido
- **Archivos:** `apps/api/src/auth.ts:146-155` (`limitedShared("auth-unknown", 120)` se aplica también a equipos aprobados), `apps/api/src/rate-limit.ts:32-35`.
- **Escenario:** 140 logins con nombres inexistentes repartidos en ≥7 IP (o más IP falsificadas si N-04) llenan el cubo global; durante ese minuto cualquier clave errónea (error tipográfico) de una cuenta real recibe 429 aunque venga de un equipo aprobado. La clave correcta entra.
- **Arreglo mínimo:** no consultar `limitedShared` cuando `terminalId` es un equipo aprobado (`unknownFlooded` solo con `authIp` por origen), o subir `authUnknownGlobal`.

### N-03 — BAJO — VERIFICADO — Crecimiento de `AuthAttempt` por barrido de nombres: 2 filas por intento
- **Archivos:** `apps/api/src/auth.ts:68-71,226-238`, `apps/api/src/security.ts:156-254`, `apps/api/src/retention.ts:29,59`.
- **Escenario:** cada intento con identidad inexistente crea `login:missing:<hash>:<ip>` y `login-account:missing:<hash>`. Medido: 242 filas tras ~142 intentos. Techo 120/min global ⇒ hasta ~345 mil filas/día, retenidas 48 h (≈700 mil filas) más pico de escrituras con triggers `auth_attempt_touch`. Con IP falsificadas (N-04) se llega al techo global sin esfuerzo. Acotado (disco 5 GB) pero evitable.
- **Arreglo mínimo:** para identidades inexistentes, no crear `login-account:missing:*` (solo la clave por IP), o purgar `login:missing:%` a 6 h en lugar de 48 h.

### N-04 — MEDIO — NO VERIFICADO — Confianza en `CF-Connecting-IP` del borde: falsificable si el origen de Render se alcanza sin Cloudflare
- **Archivos:** `deploy/render/nginx.conf.template:10-19,115-118,146-149`, `deploy/render/render-trusted-edge.sh:12-33` (CIDR por defecto: 10/8, 172.16/12, 192.168/16, 100.64/10, fc00::/7), `apps/api/src/rate-limit.ts:137-150` (`trust proxy` = redes privadas), `apps/api/src/main.ts`.
- **Escenario:** nginx acepta la cabecera `CF-Connecting-IP` si `$remote_addr` está en el rango privado (el borde de Render). Cloudflare la sobrescribe, pero si un cliente llega al origen sin pasar por Cloudflare, o Render no la elimina, el cliente elige su IP. Efectos: (1) evade las claves por IP y los cubos por origen `auth-identifier`/`auth-unknown-ip` (60/min por [origen, cuenta] ⇒ ilimitado con IP falsas) ⇒ bcrypt coste 12 ilimitado: `bcryptjs` es JS puro en el hilo principal, así que una ráfaga con cuenta real satura la CPU de la API entera (ventas incluidas); (2) falsea `AuditLog.ip`. El cupo de cuenta (10/h) sigue acotando la adivinanza de claves. Además, `uniquelocal` en `trust proxy` hace que cualquier servicio de la misma red privada de Render pueda fijar su XFF (ya ocurría con `trust proxy = 1` en v1).
- **Cómo verificarlo (no hecho: exige POST a producción):** tras desplegar, revisar `SELECT DISTINCT ip FROM "AuditLog" WHERE action='login'`: si salen IP 10.x/100.64.x, la IP sigue colapsada; y probar desde una red conocida un login con `CF-Connecting-IP: 203.0.113.9` forzado y comprobar que el `AuditLog.ip` NO es esa.
- **Arreglo mínimo:** limitar `NEXORA_TRUSTED_EDGE_CIDRS` al rango exacto del proxy de Render una vez observado, y que el cupo de bcrypt (`auth-identifier`) además tenga un tope global por cuenta (p. ej. 30/min por `normalized` sin importar el origen) para que las IP falsas no lo evadan.

### N-05 — BAJO — VERIFICADO (estático + repro parcial) — PIN corto residual
- **Archivos:** `apps/api/scripts/create-admin.ts:17` (`^\d{4,6}$`), `apps/api/src/auth.ts:715`, `cash.ts:590,743,862`, `offline-sale-review.ts:44`, `realtime.ts:271`, `security.ts:285-295`.
- **Escenario:** (a) un administrador creado con `admin:create` puede quedar con PIN de 4 dígitos; (b) los PIN cortos ya guardados nunca se rotan (no hay marca ni migración; solo `pin_short_used` en bitácora). Su protección es el cupo `pin-short:<sucursal>` de 10 fallos/h (≈500 h de fuerza bruta para 10 000 combinaciones): suficiente. Efecto lateral: cualquier cajera con 10 PIN de 4 dígitos erróneos bloquea 1 h las aprobaciones con PIN corto de toda la sucursal (los PIN de 6 dígitos no se afectan).
- **Arreglo mínimo:** `create-admin.ts:17` → `/^\d{6}$/`; convertir el primer `pin_short_used` de cada gerente en una `Alert` ("cambia tu PIN a 6 dígitos") para que se rote.

### N-06 — BAJO — NO VERIFICADO — `BACKUP_ENCRYPTION_KEY` solo exige ≥24 caracteres, sin entropía
- **Archivos:** `apps/api/src/drive-backup-core.ts:51`, `apps/api/src/drive-backup.ts:102-103`; scrypt fijo N=2^15 (`drive-backup-core.ts:48`).
- **Escenario:** el volcado contiene toda la base (clientes con cédula/teléfono, hashes bcrypt de clave y PIN). Quien obtenga el `.dump.enc` de Drive (cuenta de Google comprometida, enlace compartido por error) ataca la frase fuera de línea. A diferencia de `JWT_SECRET` (`security.ts:12-50`, entropía ≥3,5, ≥12 símbolos), una frase como `aaaaaaaaaaaaaaaaaaaaaaaa` o una oración corta en minúsculas se acepta. El formato (cifrado AES-256-GCM por bloques, AAD con cabecera, nonce único, etiqueta por bloque, marca de último bloque) es sólido; la debilidad es la frase.
- **Arreglo mínimo:** reutilizar el chequeo de entropía de `validateSecret` para la frase (o exigir generarla con `randomBytes`), y subir `SCRYPT.log2N` a 17 (la cabecera ya la lleva y el descifrador acepta 14..20, retrocompatible).

### N-07 — BAJO — Endpoints de Google configurables por entorno también en producción
- **Archivos:** `apps/api/src/drive-backup.ts:105-128` (`GOOGLE_OAUTH_BASE`, `GOOGLE_DRIVE_BASE`, `GOOGLE_OAUTH_REDIRECT_URI` solo pasan por `strip`, no por `test()` que sí se ignora en producción).
- **Escenario:** quien pueda cambiar variables de la API en Render (error o cuenta comprometida) redirige `client_secret`, refresh token, access token y la subida del volcado cifrado a un servidor propio. El volcado sigue cifrado, pero la `client_secret` y el token de Drive se exponen. Requiere acceso de operador, por eso BAJO.
- **Arreglo mínimo:** en producción ignorar las tres variables (usar `test()`), o validar que el host sea `*.googleapis.com`/`accounts.google.com`.

### N-08 — BAJO — Contraseña temporal sin vencimiento; política sin lista de claves débiles
- **Archivos:** `apps/api/src/admin.ts:1160-1196` (`resetPassword`), `apps/api/src/password-policy.ts:9-18`.
- **Escenario:** una clave temporal (`mustChangePassword`) sigue válida indefinidamente si la persona no entra; la política (≥12, 4 clases) admite `Password1234!`. Con el cupo de cuenta el riesgo es bajo.
- **Arreglo mínimo:** vencer la temporal a las 72 h (campo de fecha en `User` o en `AuthAttempt`) y rechazar claves que contengan el usuario o estén en una lista corta de comunes.

### N-09 — BAJO — OAuth de Drive: `state` reutilizable 10 min y no se revalida la inactividad de la sesión
- **Archivos:** `apps/api/src/drive-backup.ts` (`callback`, validación de `state`/cookie), `drive-backup-core.ts` (`verifyState`).
- **Escenario:** el `state` firmado (HMAC-HKDF del `JWT_SECRET`, TTL 10 min, atado a usuario+sesión y a cookie `HttpOnly; SameSite=Lax; Path=/api/backups/google`, PKCE derivado) es correcto contra CSRF; no es de un solo uso y `callback` solo exige que la fila `AuthSession` exista, no que no esté vencida por inactividad. Para explotarlo hace falta además cookie y un `code` válido de Google ⇒ impacto práctico nulo.
- **Arreglo mínimo:** guardar el nonce usado (o borrar la cookie en el cliente tras el primer uso, ya se hace con `clearCookie`) y comparar `lastActivityAt` con el plazo en `callback`.

### N-10 — INFO — Pendientes de verificación en producción
- Que `ALTER ROLE … SET plan_cache_mode` (migración `202610200001`) y los disparadores de `AuthAttempt.updatedAt` (`202610210003`) existan en producción (migración idempotente, no aborta; si falla solo emite `NOTICE`): confirmar con `\d "AuthAttempt"` que el trigger `auth_attempt_touch` está; sin él la purga de `retention.ts` no borra por `updatedAt`.

---

## 3. Controles nuevos revisados sin hallazgos

- **Módulo Drive (permisos):** todas las rutas `@Permit("*")` (admin) salvo `google/callback`, que es `@Public` pero no hace nada sin `state` firmado + cookie. VERIFICADO: vendedora → 403 en `status`, `connect`, `run`; admin sin configurar → 409; callback sin token → 302 a `/?drive=unconfigured`; producción `/api/backups/status` sin token → 401.
- **Alcance OAuth:** solo `drive.file` (la app no ve otros archivos del Drive); `include_granted_scopes=false`; si Google no concede el alcance, se revoca (`drive-backup.ts` rama `scope`).
- **Secretos del módulo:** refresh token cifrado AES-256-GCM (clave HKDF separada de la de archivos); nunca se devuelve ni se registra; `sanitizeBackupError` elimina URLs, tokens `ya29.`/`1//`, cadenas largas y correos; `pg_dump` recibe la conexión por variables de entorno (no argv); archivo temporal `0600` en directorio `mkdtemp` solo con contenido cifrado; la subida valida que la URL de sesión tenga el mismo origen que Drive; retención mueve a la Papelera (no borra) y solo toca archivos con `appProperties.nexoraBackup=1` y nombre canónico; no se borra nada si la verificación de tamaño/hash falla.
- **Descifrado offline (`scripts/decrypt-backup.mjs`):** escribe el volcado con modo `0600` y bandera `wx`, valida cabecera `PGDMP` y etiquetas GCM, no admite salida = entrada.
- **Idempotencia (`operationId`, migración `202610210004`):** `admin.ts:192-205` y `cash.ts:778-795` validan rama, creador, cuenta/proveedor, monto, método y concepto antes de devolver la fila existente ("otro pago/gasto/movimiento" si no coincide); el índice único es global pero el UUID no es adivinable y no devuelve datos ajenos (sin IDOR).
- **Idempotencia de tablas (`202610200001`, `202610210001..3`):** solo índices, restricciones `NOT VALID` y un disparador; sin cambios de privilegios ni datos expuestos. `202610210003` además limpia fotos de comprobantes de la bitácora.
- **Cola de escaneo y borrador de carrito (web):** la cola es memoria (`POS.tsx:701-836`); el borrador va a IndexedDB por usuario (`cartDraft.ts`), sin costo ni lotes (`lean()`), y `forgetSessionData` (`api.ts:296`) vacía la tabla `cache` al cerrar sesión. El `managerPin` nunca se persiste (`POS.tsx:1881` lo descarta antes de guardar la venta pendiente).
- **Actualización PWA (`pwaUpdate.ts`, `vite.config.ts`):** `registerType: "prompt"`; `runtimeCaching: []` y `navigateFallbackDenylist` para `/api` y `/healthz`: ninguna respuesta de la API (con PII/tokens) queda en Cache Storage; el banner usa `textContent` (sin XSS); no hay `innerHTML`/`dangerouslySetInnerHTML`/`eval` en el web.
- **Descarte de ventas offline (`offline-sale-review.ts`):** `sale:write` + terminal aprobado; la cajera necesita PIN de gerente con los cupos de S-03 y solo descarta lo suyo (`userId`), gerencia lo de su sucursal; sin sobrescribir ventas ya registradas.
- **Inyección SQL:** los nuevos `$queryRaw`/`Prisma.sql` (`reports.ts`, `retention.ts`, `security.ts`, `drive-backup.ts`) son etiquetados y parametrizados; el único `Prisma.raw(INVENTORY_LOSS_SQL)` (`reports.ts:381`) es una constante del servidor; `$queryRawUnsafe` en `inventory.ts:369` (ya existente) no recibe datos de usuario sin parametrizar (no re-auditado a fondo en esta pasada).
- **Despliegue:** `Dockerfile.api` fija por SHA-256 la clave PGDG y ejecuta como `node` (no root); `with-cloud-env.mjs` borra `RENDER_DATABASE_URL`, oculta la URL en errores y añade `lock_timeout`/`statement_timeout` solo a migraciones; CSP sin Sentry salvo `VITE_SENTRY_DSN` válido (`render-security-headers.sh` valida el host); sin secretos en el diff (solo fixtures de pruebas).
- **Sesiones:** `session-activity.ts` (escritura de actividad ≤1/min) concede 60 s de margen a toda comprobación de inactividad (guard, refresh, SSE); verificado en `common.ts:636-663` y `realtime.ts:509-520`; el margen es 0 con plazos <10 min. Sin regresión de sesiones robadas/expiradas.

---

## 4. Orden de arreglo sugerido

1. **N-04** (confirmar en producción que la IP real se recupera y que `CF-Connecting-IP` no es falsificable) — condiciona N-01, N-02, N-03 y S-04.
2. **N-01** (alerta de bloqueo por cuenta + subir cupo a 30/h + equipo aprobado para la dueña).
3. **N-06** y **N-07** (endurecer frase de respaldo y fijar hosts de Google en producción).
4. **N-05**, **N-02**, **N-03** (cambios de 1-3 líneas).
5. **N-08**, **N-09** (higiene).

## 5. Entorno de prueba y limpieza

PostgreSQL 16 en `127.0.0.1:55631` y API en `:55641` detenidos; directorio `/var/lib/postgresql/audsec3-23da` y socket `/tmp/pg3sock` eliminados. No se tocó producción más que con GET públicos. El worktree `wt-v2-seguridad` queda en el scratchpad (con `node_modules` y `dist/` ignorados por git); no se modificó ningún archivo versionado.
