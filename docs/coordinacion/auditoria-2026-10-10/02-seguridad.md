# Auditoría de Seguridad y Control de Acceso — Nexora POS

- **Repositorio:** `marcosfeliz28/awesome-outbid`
- **Rama auditada:** `origin/nexora-cloud` @ `3e5521c` (worktree desacoplado de solo lectura)
- **Fecha:** 2026-10-10
- **Auditor:** independiente, solo lectura. No se modificó el repo ni producción.
- **Producción observada:** `https://nexora-pos-web.onrender.com` (cadena Cloudflare → borde Render → nginx → API privada).
- **Metodología:** revisión estática de los 24 módulos de `apps/api/src`, `packages/shared`, `deploy/` y `render.yaml`; peticiones GET inofensivas de solo lectura a la URL pública (cabeceras, 401/404, health); y **reproducción local** con PostgreSQL 16 aislado (`/var/lib/postgresql/audsec2-23da`, puerto 55611, eliminado al terminar) + API compilada (`dist/main.js`, `NODE_ENV=production`, puerto 55621) sembrada con datos sintéticos (`SEED_DEMO_PASSWORD`).
- **Auditorías previas consideradas:** `docs/AUDITORIA_FINAL_SEGURIDAD.md` (rama `claude/audit-sec`), `docs/DECISIONES.md`, `docs/AUDITORIA_RONDA9.md` (R9-A09). Se verifica cuáles correcciones siguen efectivas.

Cada hallazgo marca **VERIFICADO** (reproducido en esta auditoría) o **NO VERIFICADO** (solo análisis estático / depende de configuración no observable).

---

## Resumen ejecutivo

La postura de seguridad del núcleo es sólida y **la mayoría de las correcciones previas siguen efectivas y verificadas**: RBAC por decorador en todos los controladores; `safe()` oculta costos/márgenes a vendedoras; consultas crudas 100% parametrizadas (sin inyección SQL); rotación de refresh de un solo uso con `authVersion`; aprobación de terminales con secreto; saneamiento agresivo de Sentry; cabeceras de seguridad estrictas (CSP, HSTS con `includeSubDomains`, X-Frame DENY) confirmadas en producción; sin secretos en el repo; Swagger desactivado en producción; dotfiles y `.map` devuelven 404.

**Correcciones previas verificadas como EFECTIVAS hoy:**
- **SEC-01** (bomba XLSX): `xlsx-guard.ts` rechaza una bomba de 100 MB en 0–10 ms sin consumir memoria, incluso mintiendo el tamaño declarado. Más límite `import-session` 30/min. **Cerrado.**
- **SEC-03** (escalada por PIN): `/api/staff` ya no expone al admin a una vendedora; `/api/auth/pin` a un usuario de mayor privilegio devuelve 403 **antes** de comparar el PIN. **Cerrado.**
- **SEC-05** (PII de clientes): la vendedora recibe teléfono/cédula/correo enmascarados y sin gasto histórico; gerencia ve el dato completo. **Cerrado.**
- **SEC-07** (HSTS): producción emite `max-age=31536000; includeSubDomains`. **Cerrado.**

**Hallazgo principal: una corrección previa NO fue aplicada y el riesgo persiste.**

| ID | Severidad | Estado | Título |
|----|-----------|--------|--------|
| S-01 | **ALTO** | VERIFICADO | Bloqueo de cuenta dirigido: clave de intentos por IP colapsa tras el borde compartido (SEC-02 previo, no corregido) |
| S-02 | **MEDIO** | VERIFICADO | Límites de login por IP se vuelven globales tras el borde compartido (SEC-04 previo, no corregido) |
| S-03 | **MEDIO** | Parcial | PIN de gerente de 4 dígitos admitido; aprobaciones comparan contra todos los gerentes |
| S-04 | **BAJO** | VERIFICADO | `AuditLog.ip` nunca se rellena (sin correlación forense de origen) |
| S-05 | **BAJO** | NO VERIFICADO | Extracción IA de facturas envía el documento (con RNC) a Anthropic (SEC-06 previo; apagado en prod) |
| S-06 | **BAJO** | VERIFICADO | `/api/health` público revela nombre del servicio y estado de la base de datos |
| S-07 | **INFO** | VERIFICADO | Dependencias de desarrollo con CVE críticos (no se despliegan); prod limpio |

---

## S-01 — ALTO — Bloqueo de cuenta dirigido por IP de borde compartido (SEC-02 previo: NO corregido) — VERIFICADO

**Archivos:** `apps/api/src/auth.ts:244-246` (clave `login:${credentialAttemptIdentity(user,...)}:${credentialLimit.ip}`) y `auth.ts:314-316` (idéntico en `change-password`); `apps/api/src/security.ts:88-120` (`verifyAttempt`: 5 fallos → bloqueo 15 min, consultado **antes** de verificar la clave); `deploy/render/nginx.conf.template:1-3,100-115` (`X-Real-IP`/`X-Forwarded-For` ← `$nexora_client_ip` = `$remote_addr`); `apps/api/src/main.ts:36` (`trust proxy = 1`).

**Descripción.** El contador persistente de intentos fallidos se indexa por `(usuario, authVersion, IP)`. El comentario en `auth.ts:240-243` afirma que "quien prueba contraseñas ajenas sólo se bloquea a sí mismo, no a la vendedora". **Ese supuesto depende de que cada cliente tenga una IP distinta.** En producción la cadena es Cloudflare → borde Render → nginx → API; nginx reescribe `X-Forwarded-For`/`X-Real-IP` con `$remote_addr` (la IP del salto inmediato = el borde interno de Render) y la API confía en un salto (`trust proxy = 1`). Resultado: **`req.ip` es la misma IP de borde para todos los clientes de la tienda**. La clave `(usuario, IP)` degenera en `(usuario)` global.

La auditoría previa (`docs/AUDITORIA_FINAL_SEGURIDAD.md`, SEC-02, P2 VERIFICADO) recomendó quitar la IP de la clave (`login:${user.id}:${user.authVersion}`). El historial de `nexora-cloud` corrigió SEC-01, SEC-03, SEC-05, SEC-07 y E1, **pero no SEC-02/SEC-04**: la clave en el código sigue incluyendo `:${credentialLimit.ip}` y el comentario erróneo permanece intacto.

**Escenario de explotación (pasos):**
1. El atacante conoce o adivina un identificador de cuenta (correo del admin, p. ej. `admin@...`, o el usuario de una cajera; un empleado malicioso los conoce). `/api/auth/login` es público.
2. Envía 5 intentos de login con contraseña incorrecta para esa cuenta (muy por debajo del cupo `auth-identifier` de 60/min).
3. La cuenta queda bloqueada 15 minutos. El usuario legítimo, aunque escriba la contraseña correcta desde cualquier dispositivo, recibe "Cuenta bloqueada temporalmente".
4. El atacante repite cada 15 minutos indefinidamente → la dueña/cajera no puede entrar → **la tienda no puede vender**.

**Reproducción local (VERIFICADO):** API en modo producción. Para modelar el borde (nginx fija el XFF, el atacante no influye en `req.ip`) se enviaron las peticiones sin XFF, de modo que `req.ip` fue constante para todos:
```
Atacante: 5 × POST /api/auth/login {login:"admin@fitstore.demo", password:"wrong-N"} → 400 "Usuario o contraseña incorrectos."
Víctima (admin real): POST /api/auth/login {login:"admin@fitstore.demo", password:"<correcta>"}
  → 400 "Cuenta bloqueada temporalmente. Espera 15 minutos..."
AuthAttempt: login:<admin-uuid>:0:127.0.0.1  failedAttempts=5  lockedUntil=+15min
```
(Confirmado además que el XFF falsificado NO funciona cuando nginx lo reescribe: en conexión directa cada XFF crea su propia clave; detrás del borde todas colapsan a una.)

**Impacto.** DoS de disponibilidad dirigido contra cuentas nombradas (admin/gerente/cajera) de un POS expuesto a internet, repetible y persistente. Sin fuerza bruta ni carga.

**Arreglo propuesto (diff mínimo):**
```diff
--- a/apps/api/src/auth.ts
+++ b/apps/api/src/auth.ts
@@ login()
-    await verifyAttempt(
-      this.db,
-      `login:${credentialAttemptIdentity(user, credentialLimit.normalized)}:${credentialLimit.ip}`,
+    // El candado persistente cuenta por cuenta (no por IP): detrás de un borde
+    // compartido la IP es idéntica para todos y un atacante no debe poder
+    // bloquear a la cajera. El abuso por volumen lo frena el limitador en
+    // memoria por (IP, cuenta) de limitPublicCredentials.
+    await verifyAttempt(
+      this.db,
+      `login:${credentialAttemptIdentity(user, credentialLimit.normalized)}`,
```
Aplicar lo mismo en `change-password` (`auth.ts:316`). Recomendado además: desbloqueo automático tras una autenticación correcta (para que el candado por cuenta no sea otro DoS) y, a nivel de despliegue, declarar la cadena de proxies de confianza real para recuperar la IP de cliente (resuelve también S-02).

---

## S-02 — MEDIO — Límites de login globales tras el borde compartido (SEC-04 previo: NO corregido) — VERIFICADO

**Archivos:** `apps/api/src/auth.ts:95-134` (`limitPublicCredentials`: cubos `auth-unknown-ip` por `req.ip` y `auth-identifier` por `[ip, cuenta]`); `apps/api/src/rate-limit.ts:36-41` (`authIp`=20/min, `authUnknownGlobal`=120/min).

**Descripción.** Misma causa raíz que S-01: con `req.ip` colapsada al borde, el cubo `auth-unknown-ip` (identidades inexistentes, 20/min por IP) se comparte entre toda la tienda. Un cliente ruidoso o un atacante que barre nombres inexistentes agota ese cupo y provoca 429 en el login para **todos** los dispositivos de la sucursal (la ruta `limitPublicCredentials` marca `unknownFlooded` y una clave incorrecta de cuenta real también recibe 429). Es un DoS de acceso por minuto (no persiste), menos severo que S-01. Las cuentas reales conservan su cupo `auth-identifier` propio, así que un login con clave correcta sigue entrando salvo durante la ráfaga.

**Impacto.** Degradación temporal del login de toda la tienda durante una ráfaga de barrido de nombres.

**Arreglo propuesto.** La corrección de despliegue de S-01 (cadena de proxies de confianza que recupere la IP de cliente real) separa de nuevo los cupos por cliente y resuelve S-02. Mientras tanto, el `authIp`=20/min por una sola IP de borde es bajo para una tienda entera; considerar subirlo o derivar la identidad del cubo "unknown" de un hash del identificador + la IP real de Cloudflare (`CF-Connecting-IP`), no de `req.ip`.

---

## S-03 — MEDIO — PIN de gerente de 4 dígitos admitido; aprobaciones comparan contra todos los gerentes — Parcial / análisis estático

**Archivos:** `apps/api/src/auth.ts:448` y `admin.ts:846,906` (`pin: z.string().regex(/^\d{4,6}$/)`); aprobaciones por PIN en bucle sobre todos los gerentes: `cash.ts:535-546` (apertura con fondo bajo), `cash.ts:664-674` (salida de efectivo), `cash.ts:747-758` (traslado), `sales.ts:410-416` (descuento/crédito), `realtime.ts:278-286` (aprobar terminal). Freno: `verifyPinAttempt` con clave `approval:<actor.id>` o `switch:<actor.id>` → 5 fallos/15 min sobre el **atacante**.

**Descripción.** El esquema admite PIN de **4 dígitos** (espacio 10 000). Las aprobaciones de gerente iteran el PIN enviado contra el `pinHash` de **todos** los gerentes activos de la sucursal: adivinar el PIN de **cualquier** gerente basta para autorizar la acción, lo que amplía la superficie. Una cajera maliciosa puede intentar aprobar sus propias salidas de efectivo por encima del límite, aperturas con fondo bajo o descuentos. El bloqueo recae sobre la cajera (clave por actor), no sobre el gerente, y no genera alerta de auditoría ante fallos repetidos de `approval:`. SEC-03 cerró la escalada a una **sesión** de mayor privilegio (`canSwitchUserTo`), pero las aprobaciones puntuales de acción siguen aceptando 4 dígitos.

**Impacto.** Fuerza bruta lenta (≈20 intentos/hora por actor, throttled) de un PIN de 4 dígitos que concede acciones privilegiadas puntuales. Riesgo real pero acotado; principalmente desde dentro (cajera).

**Arreglo propuesto (diff mínimo):**
```diff
-        pin: z.string().regex(/^\d{4,6}$/),
+        pin: z.string().regex(/^\d{6}$/),
```
en la creación/edición de usuario (`admin.ts`) y en todos los `managerPin`/`pin`. Añadir una alerta de auditoría ante N fallos de `approval:`/`switch:` para detectar el barrido. El seed ya usa PIN de 6 dígitos; el cambio solo cierra la puerta de los 4 dígitos.

---

## S-04 — BAJO — `AuditLog.ip` nunca se rellena — VERIFICADO (estático)

**Archivos:** `apps/api/src/common.ts:272-292` (`audit()` no escribe `ip`), `Actor` (`common.ts:30-41`) no transporta la IP. La columna existe en `schema.prisma`.

**Descripción.** La bitácora no registra el origen de red de ninguna acción, pese a existir la columna. Impide correlacionar una acción sospechosa (anulación, cambio de permisos, aprobación) con un origen. Ya anotado en `docs/legal/DATOS_PERSONALES_INVENTARIO.md`. Decisión pendiente: rellenar con la IP real (de Cloudflare) y plazo de retención corto, o eliminar la columna.

**Impacto.** Completitud forense reducida. No habilita por sí mismo ninguna explotación.

---

## S-05 — BAJO — Transferencia de facturas a Anthropic (SEC-06 previo) — NO VERIFICADO

**Archivos:** `apps/api/src/invoice.ts:364-430` (`extractAnthropic` envía el PDF/imagen del proveedor en base64 a `client.beta.messages.create`), `apps/api/src/merchandise.ts:225-231`.

**Descripción.** La ruta de extracción por IA (solo cuando `ANTHROPIC_API_KEY` está configurada) envía el documento completo del proveedor —que puede incluir RNC, nombres, contactos— al servicio de Anthropic (tercero, fuera del país). `render.yaml` **no** declara `ANTHROPIC_API_KEY` (solo el modelo), por lo que la ruta está **apagada en producción** y el flujo Excel/CSV cubre la importación. No verificable sin acceso a las variables de Render. Recomendación (Ley 172-13): si se activa, documentar la transferencia y asegurar base de legitimación; ya hay texto previsto en `docs/coordinacion/INSTRUCCIONES_ACTUALES.md` (P5). El `system` prompt ya mitiga inyección de instrucciones del documento (`invoice.ts:341-343`).

---

## S-06 — BAJO — `/api/health` público revela servicio y estado de BD — VERIFICADO

**Archivos:** `apps/api/src/app.ts:30-48` (`@Public() GET health`/`health/ready`).

**Descripción.** Sin autenticación, `https://nexora-pos-web.onrender.com/api/health` responde `{"status":"ok","service":"Nexora POS","database":"ok"}`. Revela el nombre del producto y la disponibilidad de la base de datos a cualquier observador. Es común para un health check, pero el estado de la BD podría restringirse a `/healthz/deep` interno. Impacto mínimo (información).

**Arreglo propuesto.** Que `GET /api/health` público devuelva solo `{status:"ok"}` y el campo `database` quede en la ruta profunda interna de nginx (`/healthz/deep`, ya existente y sin cuerpo).

---

## S-07 — INFO — Dependencias de desarrollo con CVE; producción limpia — VERIFICADO

**Evidencia:** `pnpm audit --prod` → **0 vulnerabilidades**. `pnpm audit` (incl. dev) → 3 críticas y 2 moderadas, todas en cadena de **herramientas de prueba** (`vitest`, `@vitest/mocker`, `tinypool`, `shell-quote`) que **no se empaquetan ni despliegan** (los `Dockerfile` instalan con `--filter @fitstore/api...` y compilan; vitest/playwright no entran al runtime). No afecta al POS en producción. Conviene actualizarlas igualmente para la higiene de CI.

---

## Verificado como NO vulnerable (controles que resisten)

- **Inyección SQL:** todos los `$queryRaw`/`$executeRaw` son plantillas etiquetadas con parámetros, con `branchId` escopado (`reports.ts:224-290`, `security.ts:112`, `common.ts:219`, `notifications.ts:785-850`, `catalog.ts:90`, `alerts.ts:71`). **No existe** `$queryRawUnsafe`, `$executeRawUnsafe` ni `Prisma.raw` con datos de usuario. `GET /api/reports/:name` usa `:name` para ramificar lógica/whitelist, nunca en SQL.
- **Bomba XLSX (SEC-01):** `xlsx-guard.ts` valida el ZIP (EOCD, directorio central, sin ZIP64/multivolumen), descomprime cada entrada con `maxOutputLength` = presupuesto restante y cuenta elementos XML, **antes** de ExcelJS. Reproducido: bomba de 100 MB (99.7 KB comprimida) rechazada en 0 ms por tamaño declarado y en 10 ms (ΔRSS 2.6 MB) aun mintiendo el tamaño. Más límite de filas×columnas tras parsear y `import-session` 30/min.
- **Escalada por PIN (SEC-03):** `/api/staff` como vendedora devuelve solo a sí misma; `POST /api/auth/pin` vendedora→admin con el PIN correcto → **403** (rechazo antes de comparar; sin oráculo). `canSwitchUserTo` exige que cada permiso del destino ya lo tenga quien cambia.
- **PII de clientes (SEC-05):** vendedora recibe `phone`/`legalId`/`email` enmascarados y sin `totalSpent`/`purchases`; gerente ve completo. `customerForActor()` es el único punto de salida. El PATCH no sobrescribe con valores enmascarados (`isMaskedPii`).
- **IDOR entre sucursales/usuarios:** escopado consistente por `branchId` en todas las consultas; `cashLock` valida propiedad o `sale:manage`; ventas de no-gerentes filtradas por `sellerId` (`sales.ts:1189`, `:2206`); pagos (`verify`/`reject`/`proof`) y recibos validan `branchId` y UUID. No se halló acceso cruzado.
- **Sesiones/JWT:** access 15 min, refresh 7 d de un solo uso (`deleteMany` atómico), `authVersion` invalida sesiones al cambiar clave/rol/desactivar; timeout por inactividad; terminal debe estar aprobado y no revocado (`AuthGuard`).
- **Terminales:** registro fija secreto (hash), equipo nuevo de no-gerente queda pendiente; aprobación por PIN exige ser el propio equipo; revocar borra sesiones. Comparación de secreto con `timingSafeEqual`.
- **CORS/CSRF/cookies:** CORS a `WEB_ORIGIN` exacto con `credentials`; cookie refresh `httpOnly`, `secure` en prod, `sameSite:strict`, `path:/api/auth`. El resto de endpoints usa Bearer (no cookie) → sin CSRF. Cuerpo JSON limitado a 100 KB.
- **SSRF:** no hay fetch saliente con URL controlable por el usuario. Telegram usa `api.telegram.org` (base solo alterable por variable de operador); Anthropic usa el SDK oficial.
- **Secretos/Sentry:** sin claves en el repo; `Dockerfile.api` usa build sin secretos embebidos; `JWT_SECRET` con `generateValue:true` y `validateSecret` exige ≥32 chars, entropía ≥3.5 y rechaza patrones. Sentry API borra request/user/extra/contexts/breadcrumbs y reescribe mensaje/stack; `sanitizeError` quita token/URLs de los avisos.
- **Enumeración de usuarios:** login con usuario inexistente compara contra `DUMMY_PASSWORD_HASH` (coste 12) y devuelve el mismo mensaje; verificado en vivo ("Usuario o contraseña incorrectos.").
- **Cabeceras/exposición:** en producción (verificado) CSP estricta (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), HSTS `includeSubDomains`, `X-Frame-Options: DENY`, sin `X-Powered-By`; `/.env`, `/.git/config`, `*.map` → 404; Swagger `/api/docs` → 404 (desactivado en prod).
- **Validación de entrada:** Zod en todos los cuerpos vía `parse()`; UUID validado antes de cada consulta por id; montos con `moneyAmount` acotado; subidas con tipo real por bytes mágicos (`imageType`) y tamaños (logo 200 KB, evidencia 2 MB, import 1 MB Excel/CSV + guard 8 MB).
- **Configuración Render:** `WEB_ORIGIN` obligatorio en prod; `NODE_ENV=production`; `ENABLE_SWAGGER=false`; BD con `ipAllowList: []` y `sslmode=require`; API es `pserv` privado (no expuesto directo).

---

## Matriz de endpoints

Permisos efectivos (`@Permit`): `admin=["*"]`, `manager` incluye `sale:manage`/`profit:read`/`customers:erase`, `seller=[catalog:read, sale:write, cash:write, customers:write]`, `warehouse=[catalog:read, inventory:write, purchase:write]`. `authenticated` = autenticado, autorización por recurso dentro del controlador. TERMINAL = exige equipo aprobado.

| Ruta | Método | Permiso | Observaciones |
|------|--------|---------|---------------|
| /api/health, /api/health/ready | GET | PUBLIC | S-06: revela service + database |
| /api/health/live | GET | PUBLIC | liveness |
| /api/auth/login | POST | PUBLIC | S-01/S-02 (lockout/límites tras borde) |
| /api/auth/change-password | POST | PUBLIC | verifica clave antes de revelar estado (E1) |
| /api/auth/refresh | POST | PUBLIC | rotación de un solo uso, cookie |
| /api/auth/logout | POST | authenticated | |
| /api/auth/me | GET | authenticated | |
| /api/auth/pin | POST | authenticated | canSwitchUserTo (SEC-03 OK); S-03 PIN 4 díg. |
| /api/customers | GET/POST | customers:write | SEC-05: PII enmascarada a seller |
| /api/customers/:id | PATCH | customers:write | no sobrescribe PII enmascarada |
| /api/customers/:id/anonymize | POST | customers:erase | Ley 172-13, redacción en auditoría |
| /api/suppliers | GET/POST | purchase:write | branchId |
| /api/supplier-payments | POST | purchase:write | monto acotado |
| /api/expense-categories(/:id) | GET/POST/PATCH | expense:write | |
| /api/expenses(/:id/void) | GET/POST/POST | expense:write | branchId |
| /api/quotes(/:id/convert) | GET/POST/POST | sale:write | scope userId/branchId |
| /api/settings | GET / PUT | catalog:read / `*` | escritura solo admin |
| /api/settings/logo | POST | `*` | tipo por bytes mágicos, 200 KB |
| /api/terminals/:id/register | PATCH | `*` | |
| /api/staff | GET | sale:write | SEC-03: filtra por canSwitchUserTo |
| /api/users(/:id) | GET/POST/PATCH | `*` | no auto-degradarse; S-03 PIN 4 díg. |
| /api/roles(/:id) | GET/PUT | `*` | admin conserva `*` |
| /api/audit-log | GET | `*` | branchId, 300 |
| /api/promotions(/:id) | GET/POST/PATCH | catalog:read / promotions:write | |
| /api/alerts(/:id) | GET/PATCH | alerts:write | |
| /api/alert-rules | GET/PUT | `*` | |
| /api/alerts/evaluate | POST | alerts:write | |
| /api/promotions/clearance-candidates | GET | promotions:write | |
| /api/catalog-template.xlsx | GET | catalog:write | |
| /api/categories, /api/brands | GET/POST | catalog:read / catalog:write | |
| /api/products(/:id)(/variants) | GET/POST/PATCH | catalog:read / catalog:write | |
| /api/variants/:id | PATCH | catalog:write | |
| /api/products/import | POST | catalog:write | SEC-01 guard + 5 MB + import-session |
| /api/kits | POST | catalog:write | |
| /api/incentives, /rates | GET/PUT | sale:manage / `*` | grupo de administración |
| /api/incentives/me | GET | sale:write | propio |
| /api/incentives/close, /export.xlsx, /receipt.pdf | POST/GET | `*` / sale:manage | |
| /api/inventory/stock, /movements | GET | catalog:read | safe() oculta costo a seller |
| /api/inventory/adjustments | POST | inventory:write | TERMINAL |
| /api/purchase-orders(/:id/document,/receive) | GET/POST/PATCH | purchase:write | receive TERMINAL |
| /api/goods-receipts(/:id)(/document) | GET/PATCH | catalog:read | |
| /api/goods-receipts/export | GET | reports:read | |
| /api/inventory/counts(/:id/apply) | GET/POST/POST | inventory:write / sale:manage | apply TERMINAL |
| /api/merchandise/* (options, profiles, attachments, operations) | GET/POST | inventory:write | operations TERMINAL |
| /api/merchandise/import | POST | inventory:write | SEC-01 guard; AI apagada (S-05) |
| /api/notifications/telegram/test, /status | POST/GET | `*` | nunca devuelve token/chat |
| /api/sales/offline-resolution | POST | sale:write | TERMINAL; discard exige sale:manage + propiedad |
| /api/terminals/register | POST | authenticated | pendiente de aprobación si no-gerente |
| /api/terminals/:id/approve | POST | sale:manage | |
| /api/terminals/:id/approve-with-pin | POST | authenticated | propio equipo + PIN gerente (S-03) |
| /api/terminals/:id/rename | POST | authenticated | propio o sale:manage |
| /api/terminals/current | GET | authenticated | |
| /api/terminals | GET | sale:manage | |
| /api/terminals/:id/revoke | POST | sale:manage | borra sesiones |
| /api/events | GET | catalog:read | SSE, límite de streams por sesión/usuario |
| /api/dashboard/summary | GET | reports:read | safe() |
| /api/reports/:name | GET | reports:read | profit/cash/by-payment regateados por profit:read/canViewCashExpected |
| /api/sales, /sales/sync | POST | sale:write | TERMINAL |
| /api/sales | GET | sale:write | no-gerente filtrado por sellerId |
| /api/sales/:id/void | POST | `*` | branchId |
| /api/payments/:id/verify, /reject | POST | `*` | TERMINAL, branchId, UUID |
| /api/returns | POST | sale:manage | TERMINAL |
| /api/credit-notes | GET | sale:write | redemptionCode solo a gerente; código exige 32 hex |
| /api/returns/:id/credit-note.pdf | GET | sale:manage | |
| /api/sales/:id/installments, /cod-collections | POST | `*` | TERMINAL |
| /api/payments/:id/proof | POST/GET | authenticated | propio (cashSession) o sale:manage |
| /api/cod/pending | GET | `*` | |
| /api/sales/:id/receipt.pdf | GET | sale:write | no-gerente por sellerId; PII enmascarada |

---

## Entorno de prueba y limpieza

- PostgreSQL 16 aislado en `127.0.0.1:55611` (datos en `/var/lib/postgresql/audsec2-23da`), base `audsec` sembrada con datos sintéticos. No se tocaron bases de otros agentes ni producción.
- API compilada (`dist/main.js`) en `:55621`, `NODE_ENV=production`, `JWT_SECRET` aleatorio de 32 bytes.
- Todo lo creado por esta auditoría (API, PostgreSQL, worktree desacoplado) se detiene y elimina al cerrar. No se modificó ningún archivo de implementación.
