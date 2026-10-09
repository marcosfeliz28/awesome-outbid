# Auditoría adversaria de seguridad y privacidad — Nexora POS

- **Repositorio:** `marcosfeliz28/awesome-outbid`
- **Rama auditada:** `origin/nexora-cloud` @ `ae765d1a83695a1cef57af8f1f204fbaece71fe2` (docs: órdenes v3 limpias)
- **Fecha:** 2026-10-09
- **Alcance:** solo lectura y pruebas locales. Base PostgreSQL aislada (puerto 55471), API compilada (`dist/main.js`) en modo `NODE_ENV=production`, y un Nginx local montado con la plantilla real `deploy/render/nginx.conf.template` + `deploy/render/security-headers.conf` para reproducir la frontera de confianza de Render.
- **Metodología:** revisión de los 21 módulos de `apps/api/src`, de `packages/shared`, del front (`apps/web/src`), del despliegue (`deploy/`, `render.yaml`) y pruebas dinámicas contra la API y el Nginx reproducido. Se distingue **VERIFICADO** (reproducido en esta auditoría) de **SOSPECHA** (solo análisis estático).

## Resumen ejecutivo

El sistema tiene una postura de seguridad madura: RBAC por decorador en todos los controladores, `safe()` que oculta costos/márgenes a roles sin `profit:read`, consultas crudas 100 % parametrizadas (sin inyección SQL), bloqueo por intentos con lock de PostgreSQL, rotación de refresh de un solo uso, anonimización de clientes conforme a la Ley 172-13 y saneamiento agresivo de Sentry en ambos SDK. No se hallaron secretos en el repositorio ni IDOR entre sucursales/cajas.

Los hallazgos relevantes son de **disponibilidad** y de un **supuesto roto por la topología de proxy**:

| ID | Sev | Estado | Título |
|----|-----|--------|--------|
| SEC-01 | **P1** | VERIFICADO | Bomba XLSX (descompresión/XML) agota la RAM del contenedor en los importadores |
| SEC-02 | **P2** | VERIFICADO | Bloqueo de cuenta dirigido: la IP compartida del borde colapsa el contador de intentos |
| SEC-03 | **P2** | VERIFICADO | Escalada a administrador vía PIN: `/api/staff` filtra el id de admin + `/api/auth/pin` |
| SEC-04 | **P3** | VERIFICADO | Los límites de login por IP se vuelven globales bajo el borde compartido (DoS de acceso) |
| SEC-05 | **P3** | VERIFICADO | PII de clientes (cédula/RNC, teléfono, gasto total) visible para toda vendedora |
| SEC-06 | **P3** | SOSPECHA | Facturas de proveedor (con RNC/PII) se envían a Anthropic sin aviso de transferencia |
| SEC-07 | **P3** | VERIFICADO | HSTS sin `includeSubDomains`; `AuditLog.ip` nunca se rellena |

### Verificado como NO vulnerable (controles que resisten)

- **Inyección SQL:** todos los `$queryRaw`/`Prisma.sql` usan plantillas etiquetadas con parámetros (`security.ts:230,253`, `common.ts:211`, `reports.ts:51`, `inventory.ts:326`, `cash.ts:265`). No hay `$queryRawUnsafe`, `$executeRawUnsafe` ni `Prisma.raw` con datos de usuario.
- **Evasión de límites por ruta:** probado contra `AuthenticatedRateLimitGuard` con `/API/SALES`, `/api/sales/`, `/api/./sales`, `/api/sales/../sales`, `/api/sales%2f`, `/api/%73ales`, `/api/sales;x`, IPv6 y mayúsculas. NestJS normaliza la ruta antes del guard: las variantes válidas quedan correctamente limitadas (429) y las inválidas dan 404. No se encontró bypass. El `requestPath()` de `rate-limit.ts:369` además colapsa `//` y barras finales.
- **Inyección de fórmulas en Excel:** ExcelJS escribe `=…`, `+…`, `@…`, `-…` como celdas de tipo string (type 3), no como fórmulas (verificado). No existe exportación CSV desde la API, así que no hay vector de fórmula. No explotable.
- **Sentry/datos personales:** API (`apps/api/src/monitoring.ts`) borra `request/user/extra/contexts/breadcrumbs/logentry` y reescribe mensaje y stack; web (`apps/web/src/monitoring.ts`) enmascara todo el texto e inputs del replay, `networkCaptureBodies:false`, borra cookies/headers/data y normaliza URLs con UUID. El DSN embebido es una clave de ingesta pública (normal para SDK de navegador).
- **IDOR entre sucursales/cajas:** scoping consistente por `branchId` y por propietario (`cashLock` en `sales.ts:257`, `ownSession` en `cash.ts:795`, `sale.sellerId` para no-gerentes en `sales.ts:1113` y `sales.ts:2058`). Un cajero no accede a la caja ni a las ventas de otro salvo con `sale:manage`.
- **Fuga de costos a vendedoras:** `safe()` elimina `costAvg/cost/unitCost/margin/grossProfit/...` (verificado: `/api/inventory/stock` no devuelve ningún campo de costo a la vendedora).
- **Secretos en repo/imágenes:** no hay claves embebidas; `Dockerfile` usa `--mount=type=secret`; `JWT_SECRET` se genera en Render (`render.yaml`); Swagger desactivado en producción (`main.ts:46`).

---

## SEC-01 — P1 — Bomba XLSX agota la memoria del contenedor (DoS) — VERIFICADO

**Archivos:** `apps/api/src/invoice.ts:199-233` (`readInvoiceTable` → `workbook.xlsx.load`), `apps/api/src/merchandise.ts:160-228` (`/api/merchandise/import`), `apps/api/src/catalog.ts:451-466` (`/api/products/import`).

**Descripción.** Los importadores llaman a `workbook.xlsx.load(buffer)` y **después** validan `sheet.rowCount > MAX_ROWS`. El límite de filas (1000 para facturas, 501 para catálogo) no acota el número de **columnas/celdas**, y la validación corre cuando el archivo ya fue descomprimido y parseado en memoria. Un `.xlsx` es un ZIP: un atacante con `inventory:write` (gerente/almacén) o `catalog:write` sube un archivo de pocos cientos de KB cuyo `sheet1.xml` descomprime a cientos de MB con `rowCount` ≤ 1000 (muchas columnas por fila). ExcelJS carga todo antes de poder rechazarlo. Los endpoints de importación **no** están cubiertos por `AuthenticatedRateLimitGuard` (solo cubre pin/logout/sales), así que el ataque se repite sin fricción.

**Prueba reproducible (VERIFICADO).** Se construyó `bomb.xlsx` (1000 filas × 3000 columnas; `sheet1.xml` = 114 MB) comprimido a **337 KB** (ratio ~330×), por debajo del límite de 1 MB del importador de facturas.

```
# RSS del proceso API antes:  175 MB
node p6-bomb.mjs   # sube bomb.xlsx a POST /api/merchandise/import (rol almacén)
#   -> status 400 "No pudimos abrir el archivo..." tras 10.2 s
# RSS del proceso API después: 654 MB  (+480 MB por una sola petición de 337 KB)
```

En un contenedor Render `0.5c-512mb` (512 MB, ver `render.yaml`) esto provoca OOM-kill de la API con una sola subida; dos o tres concurrentes la tumban con certeza. La excepción se captura (HTTP 400), pero el daño de memoria/CPU ocurre durante `xlsx.load`, antes del guard de filas. El importador de catálogo tiene un presupuesto peor (5 MB).

**Diff mínimo (acotar el tamaño descomprimido antes de parsear).**
```diff
--- a/apps/api/src/invoice.ts
+++ b/apps/api/src/invoice.ts
@@
 const MAX_ROWS = 1000;
+// Un sheet de factura legítimo pesa pocos KB descomprimido. Un ZIP cuyo XML
+// descomprime a decenas de MB es una bomba: se rechaza ANTES de parsear para
+// no cargar millones de celdas en un contenedor de 512 MB.
+const MAX_SHEET_UNCOMPRESSED = 8 * 1024 * 1024;
+function assertNotZipBomb(buffer: Buffer) {
+  // Lee el tamaño descomprimido de cada entrada del directorio central del ZIP
+  // (campo de 4 bytes) sin descomprimir el contenido.
+  let total = 0;
+  for (let i = 0; i + 4 <= buffer.length; i++) {
+    if (buffer.readUInt32LE(i) === 0x02014b50) {
+      total += buffer.readUInt32LE(i + 24);
+      if (total > MAX_SHEET_UNCOMPRESSED)
+        bad("El archivo es demasiado grande al descomprimirse. Envía solo la factura.");
+    }
+  }
+}
 export async function readInvoiceTable(
   buffer: Buffer,
   format: "csv" | "xlsx",
   mapping: Record<string, string>,
 ) {
   const workbook = new ExcelJS.Workbook();
   let tooLong = false;
   let decimal: "," | undefined;
   try {
     if (format === "csv") {
       ...
-    } else await workbook.xlsx.load(buffer as any);
+    } else {
+      assertNotZipBomb(buffer as Buffer);
+      await workbook.xlsx.load(buffer as any);
+    }
```
Aplicar el mismo `assertNotZipBomb(file.buffer)` en `catalog.ts` antes de `workbook.xlsx.load(file.buffer)` (línea 459). Además, añadir un límite de peticiones por sesión para `*/import` en `AuthenticatedRateLimitGuard` y, como defensa en profundidad, considerar `ExcelJS.stream.xlsx.WorkbookReader` con un contador de celdas que aborte al superar el presupuesto.

---

## SEC-02 — P2 — Bloqueo de cuenta dirigido por IP de borde compartida — VERIFICADO

**Archivos:** `apps/api/src/auth.ts:214-229` (clave `login:${user.id}:${user.authVersion}:${ip}`), `apps/api/src/security.ts:221-264` (`verifyAttempt`, 5 fallos → 15 min), `deploy/render/nginx.conf.template:1-3,85-87` (reemplaza `X-Forwarded-For`/`X-Real-IP` por `$remote_addr`), `apps/api/src/main.ts:36` (`trust proxy = 1`).

**Descripción.** El contador de intentos fallidos se indexa por `(usuario, authVersion, IP)`. El comentario del código afirma que «quien prueba contraseñas ajenas solo se bloquea a sí mismo, no a la vendedora» — ese supuesto **depende de que cada cliente tenga una IP distinta**. En la topología de Render documentada, el Nginx de la app reescribe `X-Forwarded-For`/`X-Real-IP` con `$remote_addr` (la IP del salto inmediato = el borde de Render), y la API confía en un salto. Resultado: **todos los usuarios de la tienda llegan con la misma `req.ip`**. El contador `(usuario, IP)` se vuelve efectivamente `(usuario)` global: cualquiera que envíe 5 contraseñas incorrectas de una cuenta conocida la bloquea 15 minutos para la persona legítima. Es un DoS dirigido contra cuentas nombradas (gerente, admin), repetible indefinidamente. La auditoría previa anotó la colisión de IP como R9-A09/P3, pero no la conectó con este bloqueo de disponibilidad.

**Prueba reproducible (VERIFICADO)** — a través del Nginx real (plantilla de Render):

```
# 5 intentos del atacante con IP y CF-Connecting-IP falsificadas distintas:
atacante intento 1..5  -> 400 "Usuario o contraseña incorrectos."
# La víctima, desde OTRA IP falsificada y con la CLAVE CORRECTA:
víctima -> 400 "Cuenta bloqueada temporalmente. Espera 15 minutos..."
# AuthAttempt: login:<gerente>:0:127.0.0.1  failedAttempts=5  lockedUntil=+15min
```

Las IP falsificadas no tienen efecto (bien: Nginx las descarta), pero precisamente porque todas colapsan a la misma IP de borde, el bloqueo es compartido.

**Diff mínimo (desacoplar el candado de la IP; contar por cuenta y conservar un freno de IP aparte).**
```diff
--- a/apps/api/src/auth.ts
+++ b/apps/api/src/auth.ts
@@ login()
-    await verifyAttempt(
-      this.db,
-      `login:${user.id}:${user.authVersion}:${credentialLimit.ip}`,
+    // El candado persistente cuenta por cuenta (no por IP): detrás de un borde
+    // compartido la IP es idéntica para todos y un atacante no debe poder
+    // bloquear a la cajera. El abuso por volumen lo frena el limitador en
+    // memoria por (IP, cuenta) de limitPublicCredentials, que no deja sesión.
+    await verifyAttempt(
+      this.db,
+      `login:${user.id}:${user.authVersion}`,
```
(aplicar también en `change-password`, `auth.ts:294`). Alternativa más robusta: desbloqueo automático tras una autenticación correcta y un segundo factor de «tiempo desde el último éxito» para no convertir el candado por cuenta en otro DoS; y, a nivel de despliegue, declarar la cadena de proxies de confianza real para recuperar la IP de cliente (resuelve también SEC-04).

---

## SEC-03 — P2 — Escalada a administrador mediante PIN — VERIFICADO

**Archivos:** `apps/api/src/admin.ts:742-751` (`GET /api/staff`, `@Permit("sale:write")`), `apps/api/src/auth.ts:411-433` (`POST /api/auth/pin`), `apps/api/src/realtime.ts:262-290` (`approve-with-pin`).

**Descripción.** `GET /api/staff` está permitido a cualquier rol con `sale:write` (incluida la vendedora) y devuelve el `id`, nombre y rol de **todos** los usuarios de la sucursal, incluido el administrador. `POST /api/auth/pin` acepta `{ userId, pin }` con `pin` de **4 a 6 dígitos** y, si coincide, **emite una sesión completa con el rol y permisos del usuario destino** (`this.issue(user)`), es decir, una sesión de administrador (`*`). El freno de fuerza bruta (`verifyPinAttempt`, clave `switch:<actor.id>`, 5 fallos → 15 min) **bloquea al atacante, no alerta ni bloquea al admin**, de modo que un PIN de 4 dígitos (espacio 10 000) es adivinable a ~5 intentos/15 min sin levantar ninguna alarma sobre la cuenta objetivo. `approve-with-pin` agrava el patrón: compara el PIN enviado contra el `pinHash` de **todos** los gerentes de la sucursal en bucle, ampliando la superficie.

**Prueba reproducible (VERIFICADO)** — un único intento con el PIN correcto de la semilla confirma el alcance del privilegio (no es fuerza bruta):

```
vendedora -> GET /api/staff : obtiene id de admin = 514a8623-...
vendedora -> POST /api/auth/pin { userId: <admin>, pin: "123456" }
  -> 201  rol emitido: admin  permisos: [ "*" ]
```

**Diff mínimo (no exponer el id de admin a vendedoras + restringir el switch).**
```diff
--- a/apps/api/src/admin.ts
+++ b/apps/api/src/admin.ts
@@
-  @Get("staff") @Permit("sale:write") staff(@CurrentUser() actor: Actor) {
-    return this.db.user.findMany({
-      where: { branchId: actor.branchId, active: true },
+  @Get("staff") @Permit("sale:write") async staff(@CurrentUser() actor: Actor) {
+    // El cambio rápido de operador solo necesita cajeros/vendedores, no las
+    // cuentas con permisos de gerencia/administración.
+    const users = await this.db.user.findMany({
+      where: { branchId: actor.branchId, active: true },
       select: {
         id: true, name: true, cashierNumber: true,
         role: { select: { name: true } },
       },
     });
+    return can(actor.permissions, "sale:manage")
+      ? users
+      : users.filter((u) => !can((u as any).role?.permissions ?? [], "sale:manage"));
   }
```
Además: en `/api/auth/pin`, rechazar el cambio hacia un usuario con mayores permisos que el solicitante (o exigir que el PIN solo permita bajar o mantener privilegios), y exigir PIN de 6 dígitos (`apps/api/src/auth.ts:420` ya acepta `\d{4,6}`; subir a `\d{6}`). Considerar alerta de auditoría ante fallos repetidos de `switch:`.

---

## SEC-04 — P3 — Límites de login globales bajo borde compartido — VERIFICADO

**Archivos:** `apps/api/src/auth.ts:78-102` (`limitPublicCredentials`, cubos `auth-unknown-ip` y `auth-identifier` por `req.ip`), `apps/api/src/rate-limit.ts:288-295`.

**Descripción.** Misma causa raíz que SEC-02: con `req.ip` colapsada al borde, los cubos `auth-unknown-ip` (por IP, `AUTH_IP_RATE_LIMIT`=600/min) y `auth-identifier` (por IP+cuenta, 60/min) se comparten entre toda la tienda. Un cliente ruidoso (o un atacante) agota el cubo de IP y provoca 429 en el login para **todos** los dispositivos de la sucursal. Es un DoS de acceso, menos severo que SEC-02 porque es por minuto y no persiste. La corrección de despliegue (cadena de proxies de confianza que recupere la IP de cliente real) lo resuelve junto con SEC-02.

---

## SEC-05 — P3 — PII de clientes expuesta a toda vendedora — VERIFICADO

**Archivos:** `apps/api/src/admin.ts:164-187` (`GET /api/customers`, `@Permit("customers:write")`; el rol `seller` tiene `customers:write`, ver `packages/shared/src/index.ts:620`).

**Descripción.** Cualquier vendedora obtiene la lista completa de clientes con `legalId` (cédula/RNC), `phone`, `email`, `creditLimit` y el **gasto histórico** (`totalSpent`, `purchases`, `lastPurchase`). Verificado:

```
customers[0] -> {name, phone:18095550010, email, legalId:DEMO-0010, totalSpent:136050, purchases:46, ...}
```

Bajo la Ley 172-13 esto excede la minimización de datos: una vendedora necesita seleccionar un cliente para facturar, no ver cédula/RNC ni el historial de gasto de toda la cartera. Recomendación: devolver a `seller` solo `{id, name}` (y teléfono si es imprescindible para el POS), reservando `legalId`/`totalSpent` a roles con `sale:manage`/`reports:read`. No es un fallo de control de acceso (el permiso está concedido a propósito), sino de alcance del dato.

---

## SEC-06 — P3 — Transferencia de facturas a Anthropic sin aviso — SOSPECHA

**Archivos:** `apps/api/src/invoice.ts:360-425` (`extractAnthropic` envía el PDF/imagen en base64 a `client.beta.messages.create`), `apps/api/src/merchandise.ts:220-227`.

**Descripción.** La ruta de extracción por IA (cuando `ANTHROPIC_API_KEY` está configurada) envía el documento del proveedor completo —que puede incluir RNC, nombres y datos de contacto— al servicio de Anthropic. Es una transferencia a un tercero fuera del país. No se verificó en producción si la clave está activa (`render.yaml` no fija `ANTHROPIC_API_KEY`, solo el modelo), por eso es **SOSPECHA**. Recomendación legal (Ley 172-13): documentar la transferencia, asegurar base de legitimación y, si no es imprescindible, mantener la IA desactivada (el flujo Excel/CSV ya cubre la importación).

---

## SEC-07 — P3 — Endurecimientos menores — VERIFICADO

- **HSTS incompleto:** `deploy/render/security-headers.conf:2` emite `Strict-Transport-Security "max-age=31536000"` sin `includeSubDomains` ni `preload`. Diff:
  ```diff
  -add_header Strict-Transport-Security "max-age=31536000" always;
  +add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  ```
  (Nota: en las respuestas de la API, Helmet ya añade HSTS con `includeSubDomains`; el gap es solo en los recursos estáticos servidos por Nginx.)
- **`AuditLog.ip` nunca se rellena:** `apps/api/src/common.ts:225-245` (`audit()`) no escribe `ip`, pese a existir la columna (`schema.prisma`). La bitácora no permite correlacionar acciones con origen de red. Añadir la IP del actor al registro de auditoría (completitud forense).
- **CSP:** correcta y estricta (`script-src 'self'`, sin `unsafe-inline` en scripts; `object-src 'none'`, `frame-ancestors 'none'`). `style-src 'unsafe-inline'` es el único relajamiento y es aceptable para la PWA. Sin cambios requeridos.

---

## Entorno de prueba y limpieza

- PostgreSQL privado: `127.0.0.1:55471` (datos en `/var/lib/postgresql/audsec-23da`), base `audsec` sembrada con datos sintéticos (`SEED_DEMO_PASSWORD`). No se tocaron las bases de otros agentes.
- API compilada corriendo en `:55481` (producción) y `:55483` (límites bajos para pruebas de rate limit); Nginx local en `:55482` con la plantilla real de Render.
- Todos los procesos y bases creados por esta auditoría se detienen y eliminan al cerrar (ver sección de limpieza en la nota de entrega). No se modificó ningún archivo de implementación; solo se añadió este informe.
