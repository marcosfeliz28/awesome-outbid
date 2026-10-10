# Preparación de Nexora POS para Render

**Estado:** código preparado y validable; no se ha creado, comprado ni desplegado ningún recurso.

Este documento acompaña `render.yaml`. El Blueprint describe una web pública,
una API privada y PostgreSQL sin acceso público. Los nombres internos
`fitstore` de la base, el usuario y los paquetes se conservan deliberadamente:
son identificadores técnicos existentes, no la marca visible.

## Arquitectura declarada

```text
Internet -> HTTPS de Render -> nexora-pos-web (Nginx + PWA)
                                  |
                                  | /api/* por red privada
                                  v
                              nexora-pos-api
                                  |
                                  | URL interna + TLS
                                  v
                              nexora-pos-db
```

- Sólo `nexora-pos-web` es un servicio público.
- `nexora-pos-api` es `pserv`; no recibe subdominio público.
- `nexora-pos-db` tiene `ipAllowList: []`, por lo que no acepta conexiones
  desde Internet.
- Los tres recursos están fijados en `virginia` y usan una sola instancia para
  el piloto.
- `autoDeployTrigger: off` evita que web, API y migraciones se publiquen en un
  orden accidental. Cada liberación debe iniciarse de forma controlada.

## Archivos de despliegue

| Archivo                               | Función                                                                                                                     |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `render.yaml`                         | Blueprint reproducible, tamaños, región, conexiones y secretos generados.                                                   |
| `deploy/render/Dockerfile.web`        | Construye la PWA y la sirve con Nginx 1.30.5.                                                                               |
| `deploy/render/nginx.conf.template`   | Publica la web, cabeceras de seguridad y `/api` a la red privada.                                                           |
| `deploy/render/security-headers.conf` | CSP/PWA, cámara y cabeceras HTTP defensivas.                                                                                |
| `deploy/render/start-nginx.sh`        | Valida el destino privado y re-resuelve la API cada 10 s (recarga Nginx).                                                   |
| `deploy/render/Dockerfile.api`        | Construye y ejecuta exclusivamente la API.                                                                                  |
| `deploy/render/post-deploy-check.mjs` | Tras desplegar: `node deploy/render/post-deploy-check.mjs <URL_WEB> [URL_API]` falla si `/api/health` no da `status: "ok"`. |
| `deploy/render/with-cloud-env.mjs`    | Forma `DATABASE_URL` con TLS y UTC sin revelar credenciales; con un script `.js` lo carga en el mismo proceso.              |
| `tests/cloud-deploy.test.ts`          | Comprueba las reglas de aislamiento y configuración anteriores.                                                             |

## Variables y secretos

El repositorio no contiene valores secretos.

- `JWT_SECRET` se crea con `generateValue: true`. Render genera 256 bits una
  sola vez y conserva el valor en futuras sincronizaciones del Blueprint.
- `RENDER_DATABASE_URL` llega desde `fromDatabase.connectionString`. El
  lanzador la convierte dentro del proceso a `DATABASE_URL`, añade
  `sslmode=require` y `options=-c TimeZone=UTC`, elimina la variable intermedia
  del entorno del proceso hijo y nunca imprime la URL.
- `WEB_ORIGIN` se copia de `RENDER_EXTERNAL_URL` de la web. Así el primer piloto
  usa automáticamente su dirección `https://…onrender.com` real.
- `ANTHROPIC_API_KEY` no está declarada. La lectura con IA permanece apagada
  hasta que el negocio decida activarla como secreto separado.
- Swagger queda apagado en producción.
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y
  `BACKUP_ENCRYPTION_KEY` (respaldo diario a Google Drive) no están
  declaradas: se añaden a mano como secretos cuando la dueña active el
  respaldo (ver «Respaldo diario a Google Drive»).

Cuando se apruebe un dominio propio, cambiar en `render.yaml` la entrada de
`WEB_ORIGIN` de la API por el origen exacto, sin barra final:

```yaml
- key: WEB_ORIGIN
  value: https://pos.dominio-elegido.com
```

Ese cambio y el dominio se deben aplicar juntos. La PWA instalada desde la URL
provisional se reinstala desde el dominio definitivo.

## Avisos por Telegram

Opcional. Cada factura (efectivo, tarjeta, transferencia, crédito,
contraentrega), anulación, devolución, cobro de contraentrega o abono y cada
cierre de caja llega como mensaje a un grupo privado de Telegram. El aviso
lleva número, fecha y hora, caja, cajera, formas de pago, total, ITBIS, el
nombre del cliente (nunca su cédula/RNC, teléfono, correo ni dirección) y los
primeros artículos; sin costos ni márgenes. El esperado y lo contado sólo van
en el aviso de cierre.

1. En Telegram, habla con **@BotFather**, envía `/newbot` y guarda el token.
2. Crea el grupo privado de la administración y agrega el bot. Escribe un
   mensaje en el grupo y abre
   `https://api.telegram.org/bot<TOKEN>/getUpdates`: el `chat.id` del grupo
   (empieza con `-100…` en supergrupos) es el chat.
3. En Render, servicio `nexora-pos-api` › _Environment_, añade como secretos
   `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` y vuelve a desplegar. En la web,
   Configuración › Negocio y reglas › «Avisos de facturas por Telegram» ›
   «Enviar mensaje de prueba».

Sin las dos variables la función queda apagada: no se guarda ni se envía nada
y las ventas no cambian. Con ellas, la venta nunca espera a Telegram: el texto
se guarda en la tabla `NotificationOutbox` y un trabajador de la API lo envía
(un mensaje por segundo, 8 s de espera máxima, reintentos a los 30 s, 1, 2, 5,
15 min… hasta 12 intentos, respeta los 429). Al reiniciar retoma lo pendiente;
los enviados se borran a los 30 días. El estado (pendientes, enviados,
fallidos y último error, sin el token) está en `GET /api/notifications/status`.
`TELEGRAM_API_BASE` sólo se usa en pruebas; no se declara en Render. Si el
token se filtra, revócalo con `/revoke` en @BotFather y cambia la variable.

## Respaldo diario a Google Drive

Opcional y recomendado. Guía paso a paso para la dueña (proyecto de Google
Cloud, pantalla de consentimiento **publicada «En producción»**, credenciales
«Aplicación web», variables y prueba): [`docs/RESPALDO_DRIVE.md`](RESPALDO_DRIVE.md).

- Cada madrugada (03:30, Santo Domingo) la propia API ejecuta `pg_dump -Fc`,
  cifra la copia con `BACKUP_ENCRYPTION_KEY` (AES-256-GCM, formato NXBK v1) y
  la sube a la carpeta «Nexora POS respaldos» del Drive de la dueña;
  conserva 30 diarias y 12 mensuales. Sin servicio extra en Render.
- En Render, servicio `nexora-pos-api` › _Environment_, como secretos:
  `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` y
  `BACKUP_ENCRYPTION_KEY` (frase de 24 caracteres o más; sin ella las copias
  no se pueden abrir: guardarla fuera de Render). Sin las tres, la función
  queda apagada y la tarjeta dice «No configurado».
- URI de redirección autorizada en Google:
  `https://<WEB_ORIGIN>/api/backups/google/callback` (la web la reenvía a la
  API por `/api/`). La PWA no la intercepta (`navigateFallbackDenylist`).
- La imagen de la API incluye `pg_dump` 17 del repositorio PGDG
  (`PG_DUMP_BIN`); un servidor 17 no se puede respaldar con el cliente 15 de
  Debian.
- Migración `202610200101_drive_backup`: sólo crea la tabla `DriveBackup`
  (`IF NOT EXISTS`). El permiso de Google se guarda cifrado ahí.
- Estado: Configuración › Negocio y reglas › «Respaldo diario a Google Drive»
  o `GET /api/backups/status` (administración). Si falla 3 veces seguidas o
  pasan 36 h sin éxito, aviso por Telegram (si está activado).
- Restaurar: `node scripts/decrypt-backup.mjs <archivo>.dump.enc` y después
  `scripts/restore.mjs` sobre una base nueva (ver «Respaldo y recuperación de
  Render» más abajo).
- `GOOGLE_OAUTH_BASE`, `GOOGLE_DRIVE_BASE` y las variables `DRIVE_BACKUP_*`
  sólo se usan en pruebas; no se declaran en Render.

## DNS privado y cabeceras del cliente

Render inyecta `API_UPSTREAM` mediante `fromService.hostport`. `start-nginx.sh`
resuelve el nombre con el resolvedor del sistema, guarda la IP en un snippet
incluido por Nginx y la vuelve a resolver cada diez segundos (recarga Nginx sólo
si cambió). Esto evita conservar una IP antigua cuando Render reemplaza la API.

El Nginx cloud no usa como fuente de identidad ninguna cabecera de IP que pueda
mandar el cliente. El mapa toma únicamente `$remote_addr` y reemplaza
`X-Real-IP` y `X-Forwarded-For` con ese valor; la API confía en el salto Nginx
(`trust proxy = 1`). La documentación publicada por Render recomienda leer
`X-Forwarded-For` para obtener la IP real y señala que `CF-Ray` se reenvía, pero
no especifica que Render sobrescriba siempre `CF-Connecting-IP` o elimine las
partes falsificables de `X-Forwarded-For`. Por eso no usamos esas cabeceras para
autorización ni límites de seguridad hasta que Render confirme formalmente una
frontera de confianza. Como consecuencia, `$remote_addr` puede ser la IP del
proxy inmediato y no la del cliente; no se presenta como identificación
individual fiable. La regresión envía `CF-Ray`, `CF-Connecting-IP` y
`X-Forwarded-For` falsificados a la vez y comprueba que ninguno se reenvía. La
prueba dinámica con Nginx/Render queda pendiente si no se dispone del binario o
del entorno aislado. El Compose local sigue usando `deploy/nginx.conf`.

Fuente: [Render, How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks)
(consulta del 8-oct-2026). Esa guía recomienda `X-Forwarded-For`, pero no
declara que el borde lo sobrescriba siempre ante valores enviados por el
cliente.

El snippet de seguridad instala CSP, HSTS (`max-age=31536000;
includeSubDomains`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
y `Referrer-Policy`. La CSP permite módulos
locales, workers `blob:` usados por la PWA y peticiones al mismo origen; la
política de permisos conserva cámara sólo en el mismo origen para el lector.

Sentry de la web está apagado por defecto y la CSP no lo menciona. El archivo
`deploy/render/security-headers.conf` es una plantilla con el marcador
`${NEXORA_CSP_SENTRY_SRC}` en `connect-src`; al arrancar, `start-nginx.sh`
ejecuta `render-security-headers.sh`, que genera
`/etc/nginx/snippets/nexora-security-headers.conf`:

- Sin `VITE_SENTRY_DSN` (o vacía): `connect-src 'self'`.
- Con `VITE_SENTRY_DSN=https://<clave>@<host>/<proyecto>`: se añade sólo
  `https://<host>` (sin clave ni proyecto). Es la misma variable con la que se
  compila la web y Render la entrega también al arrancar, así que basta con
  definirla una vez en el servicio `nexora-pos-web` y redesplegar.
- Con un valor que no tenga esa forma (otro esquema, comillas, espacios...):
  se escribe un aviso en el log, la CSP queda en `'self'` y Nginx arranca igual.

Para comprobarlo tras un despliegue: `curl -sI <URL_WEB>/ | grep -i
content-security-policy` debe mostrar el host de Sentry sólo si hay DSN. La cámara requiere HTTPS (o localhost). Las cabeceras y
reglas de rutas se comprobaron con un Nginx 1.24 real (no con la imagen
`nginx:1.30.5-alpine3.24`); el recorrido visual/offline de la cámara y la
imagen Docker siguen pendientes porque Docker no está disponible en el equipo
de revisión.

### Cabeceras en `/api`

Nginx es la única fuente de cabeceras de seguridad también para `/api`. La API
usa Helmet, cuyos valores chocaban con los de Nginx (`X-Frame-Options`
`SAMEORIGIN` frente a `DENY`, `Referrer-Policy` distinta, dos CSP y dos HSTS),
así que `/api/` y `/api/events` descartan con `proxy_hide_header` las cabeceras
de seguridad de la API y aplican las del snippet. Para no debilitar nada, en
`/api` el `Referrer-Policy` sigue siendo `no-referrer` (la política más estricta
que ya enviaba la API; la web usa `strict-origin-when-cross-origin`) mediante un
`map` por ruta. Las cabeceras de Helmet sin equivalente en Nginx
(`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`, etc.) siguen
llegando tal cual. La CSP de Nginx es la de la web; si algún día se activa
Swagger en producción (`ENABLE_SWAGGER=true`), su interfaz queda sujeta a ella.

### Archivos estáticos y caché

- `/assets/*` (Vite los nombra con hash) se sirve con
  `Cache-Control: public, max-age=31536000, immutable`. La cabecera no lleva
  `always`, así que un 404 (hash antiguo tras un despliegue) no se cachea.
- `index.html`, `sw.js` y `runtime-config.js` siguen con
  `no-cache, no-store, must-revalidate`: el navegador revalida siempre el
  service worker y por tanto detecta versiones nuevas. El fallback de la SPA
  llega a `index.html` por redirección interna, con esa misma cabecera.
- `/manifest.webmanifest` se sirve como `application/manifest+json`
  (`types {}` + `default_type`, sin depender del `mime.types` de la imagen) con
  `no-cache`. El resto de archivos con extensión (`icon.svg`, `registerSW.js`,
  `workbox-*.js`, `products/*.svg`) llevan `no-cache` (revalidan).
- `/licencias.txt` (y cualquier `.txt`) se sirve como
  `text/plain; charset=utf-8`, con la misma caché `no-cache` y las mismas
  cabeceras de seguridad; el `charset` sólo se aplica a esa ubicación.
- Dotfiles (`/.env`, `/.git/config`...), `*.map` y cualquier ruta con extensión
  que no exista devuelven `404`; sólo las rutas sin extensión caen en
  `index.html` (SPA). Una ruta de la SPA no debe terminar en `.algo`. Un
  directorio como `/products/` ya no devuelve 403 sino la SPA.
- `server_tokens off` oculta la versión de Nginx.
- Compresión `gzip` (nivel 5, desde 1 KB, `Vary: Accept-Encoding`) para HTML,
  texto, CSS, JS, SVG, manifiesto y JSON de la API (también lo que viene del
  proxy): el JS principal baja de ~1 MB a ~320 KB y el catálogo de la API a una
  décima parte. Las imágenes y fuentes ya comprimidas no se tocan y
  `/api/events` (SSE) lleva `gzip off`. No cambia las cabeceras de seguridad ni
  `Cache-Control`; el `ETag` pasa a débil (`W/`), que sigue sirviendo para
  revalidar. La API autentica con `Authorization: Bearer` y la cookie de
  renovación es `SameSite=Strict`, así que comprimir respuestas no abre un
  oráculo de tamaño tipo BREACH desde otro sitio.

## Memoria de la API

El plan `0.5c-512mb` mata el contenedor si pasa de 512 MB. La imagen arranca un
solo proceso:

```text
node --max-old-space-size=256 deploy/render/with-cloud-env.mjs apps/api/dist/main.js
```

- `with-cloud-env.mjs` forma `DATABASE_URL` y, cuando recibe un script `.js`
  (sin `node` delante), lo carga en el mismo proceso. Antes lanzaba un segundo
  `node` que quedaba residente toda la vida de la API (~46 MB). Las señales de
  Render (`SIGTERM`) llegan directamente a la API, que cierra con sus
  `shutdown hooks`. Con `node <script>` (pre-deploy de Prisma, tareas puntuales
  con `tsx`) sigue lanzando un proceso aparte que termina, como antes.
- El montón de V8 queda en 256 MB: con el motor de Prisma, el código y los
  búferes (~130 MB fuera del montón) la API queda holgada bajo 512 MB y el
  recolector trabaja antes de acercarse al límite. Si alguna vez aparece
  `JavaScript heap out of memory` en el registro, subirlo con prudencia
  (máximo ~320) en `deploy/render/Dockerfile.api`; nunca quitarlo.
- Medición (API compilada, 0,5 CPU y 512 MB; PostgreSQL 0,1 CPU y 256 MB; un
  año de historial, ~110 000 ventas):

  | Escenario                                              | Antes (envoltorio + API)                   | Ahora (un proceso) |
  | ------------------------------------------------------ | ------------------------------------------ | ------------------ |
  | Prueba R3b (4 cajas + gerente, 4 min)                  | 46 + 221 = 267 MB                          | 239 MB             |
  | Lectura intensa (900 peticiones, 12 a la vez, sin CPU) | 304 MB (2 procesos); 383 × 401 y 178 × 500 | 262 MB; 900 × 200  |

- **Riesgo conocido, no resuelto aquí:** `GET /reports/sales` sin paginar
  carga todas las ventas del período. Con ~300 ventas al día, el informe del
  mes en curso que abre por defecto la pantalla Reportes pasa de 512 MB hacia
  el día 20 del mes, con o sin límite de montón (con 14 días llega a ~480 MB).
  Hay que paginarlo o agregarlo en SQL antes de que la tienda acumule ese
  volumen.

## Salud y preparación

- Render consulta `GET /healthz` en la web. Devuelve `204` aunque PostgreSQL
  esté temporalmente caído, por lo que una avería de datos no reinicia una web
  sana. Es liveness sólo de Nginx y no depende de la API, para que redesplegar
  la API no reinicie la web en bucle.
- `GET /healthz/deep` comprueba además que la API y su base responden
  (`/api/health/ready`; `204` o `503`, sin detalles). Es para uso manual o
  externo; Render no debe usarlo como `healthCheckPath`.
- Render sólo realiza comprobación TCP nativa al servicio privado.
- `GET /api/health/live` confirma que el proceso de la API vive.
- `GET /api/health` y `GET /api/health/ready` consultan PostgreSQL y devuelven
  `503` si la base no está disponible. Son públicas y sólo responden
  `{"status":"ok"}`: ni el nombre del servicio ni el detalle de la base.
- Después de cada publicación, la comprobación funcional obligatoria es
  `https://URL-DE-LA-WEB/api/health`. Recorre web, DNS privado, API y base.

El `HEALTHCHECK` de cada imagen también sirve para pruebas con Docker, pero no
sustituye las reglas anteriores de Render.

## Migraciones

Antes de poner en servicio una nueva API, Render ejecuta:

```text
node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma
```

Si la migración falla, el despliegue se detiene. No se ejecuta `prisma db push`
ni el seed de demostración. Las migraciones nuevas deben seguir el patrón
“ampliar y luego retirar”:

1. Añadir tablas, columnas o índices de forma compatible.
2. Publicar una API que entienda la estructura vieja y la nueva.
3. Publicar la web y comprobar una venta controlada.
4. Retirar estructuras antiguas sólo en una liberación posterior y después de
   un respaldo verificable.

Volver al contenedor anterior no revierte una migración de datos.

### Índices de enlace y `plan_cache_mode` (202610200001_perf_indexes_links)

Una prueba de carga con un año de historial (~110 000 ventas, 4 cajas y un
gerente, con los tamaños de este Blueprint) mostró que faltaban índices en las
columnas que enlazan tablas y que, con sentencias preparadas, PostgreSQL acaba
usando un plan genérico malo para la suma de pagos por método. La migración:

- crea con `CREATE INDEX IF NOT EXISTS` `Payment(saleId)`,
  `Payment(cashSessionId)`, `SaleItem(saleId)`, `Sale(cashSessionId)`,
  `SaleReturn(saleId)`, `SaleReturn(cashSessionId)`,
  `CashMovement(sessionId)` y `Variant(productId)` (mismos nombres que los
  `@@index` de `schema.prisma`). El esperado de una caja pasó de 203 ms a
  0,14 ms;
- fija `plan_cache_mode = force_custom_plan` para el rol que migra
  (`ALTER ROLE CURRENT_USER`) y para la base (`ALTER DATABASE`). La suma de
  pagos por método (dashboard y `reports/by-payment`) pasó de 2 s a 2 ms. Sólo
  afecta a conexiones nuevas: la API se reinicia en cada despliegue.

**Nunca aborta un despliegue.** Cada índice y cada `ALTER` van en su propio
bloque `DO` con `EXCEPTION WHEN OTHERS THEN RAISE NOTICE`: si el rol no tiene
permiso, o una escritura retiene la tabla más de 15 s (`lock_timeout`), ese paso
se omite con un aviso `PERF: …` en el registro del pre-deploy y el despliegue
sigue. Un índice inválido con el mismo nombre se rehace. Con las tablas de hoy
cada índice se crea en milisegundos; el bloqueo de escritura dura eso.

Comprobar después de desplegar (Render › nexora-pos-db › Shell o `psql` con la
URL interna):

```sql
SELECT indexname FROM pg_indexes WHERE indexname IN (
  'Payment_saleId_idx','Payment_cashSessionId_idx','SaleItem_saleId_idx',
  'Sale_cashSessionId_idx','SaleReturn_saleId_idx','SaleReturn_cashSessionId_idx',
  'CashMovement_sessionId_idx','Variant_productId_idx');   -- 8 filas
SHOW plan_cache_mode;                                       -- force_custom_plan
```

Si el registro del pre-deploy mostró un aviso `PERF:` o faltan filas, la
migración es idempotente: se puede volver a ejecutar tal cual con
`psql "$URL" -f apps/api/prisma/migrations/202610200001_perf_indexes_links/migration.sql`
(sólo crea lo que falte) y reiniciar la API para que tome `plan_cache_mode`.
Prueba: `tests/perf-indexes-postgres.test.ts` (base vacía, base con datos, dos
ejecuciones seguidas, índice inválido y rol sin permisos).

### Contraseñas temporales de cajero

La migración `202610130001_password_change_required` agrega una marca por
usuario. La pantalla de entrada la activa cuando la API detecta esa marca; el
servidor no emite sesión normal hasta completar el cambio. La clave nueva debe
tener 12–72 bytes UTF-8 (límite de bcrypt), mayúscula, minúscula, número y
símbolo. Las cuentas temporales ya existentes se marcan mediante una tarea
puntual, después de desplegar API/migración. Configura sólo los nombres reales
que correspondan en variables temporales de la tarea, sin agregar nombres ni
contraseñas al repositorio:

```text
PASSWORD_CHANGE_CONFIRM=ROTATE_TEMPORARY_PASSWORDS
PASSWORD_CHANGE_USERNAMES=<lista de nombres separados por coma>
node deploy/render/with-cloud-env.mjs node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/require-password-change.ts
```

El comando valida que todas las cuentas indicadas existan y estén activas antes
de modificar ninguna, invalida sesiones y tokens previos y registra una acción
de auditoría. Ejecutarlo sólo como proceso puntual dentro del servicio API
correcto; no usarlo en una copia de producción desde una laptop. Los nuevos
usuarios creados por la pantalla de administración y los cambios de contraseña
hechos por un administrador quedan marcados para que la persona cambie la clave
en su primer acceso.

## Validación local sin desplegar

Desde la raíz del proyecto:

```text
pnpm cloud:validate
pnpm typecheck
pnpm build
```

Si Docker está disponible, construir ambas imágenes sin iniciarlas:

```text
docker build -f deploy/render/Dockerfile.api -t nexora-api:verify .
docker build -f deploy/render/Dockerfile.web -t nexora-web:verify .
```

Cuando el código esté en un repositorio privado conectado a Render, validar el
Blueprint antes de sincronizarlo:

```text
render blueprints validate render.yaml
```

La validación del CLI no compra ni crea recursos. La sincronización del
Blueprint sí los crea y sólo debe hacerse después de aprobar el gasto.

## Secuencia del primer piloto

1. Subir esta carpeta a un repositorio Git privado de la empresa.
2. Confirmar en el panel de Render el precio vigente de los dos planes
   `0.5c-512mb`, PostgreSQL `0.1c-256mb` y 1 GB. No aceptar el Blueprint si el
   total supera el presupuesto aprobado.
3. Validar `render.yaml` y revisar que PostgreSQL muestre cero reglas de entrada
   pública.
4. Crear los recursos desde el Blueprint. No cargar todavía datos reales.
5. Esperar que termine la migración previa de la API.
6. Abrir `/healthz`, luego `/api/health`; ambos deben responder correctamente.
7. Crear el administrador mediante una tarea puntual de la imagen de la API.
   Configurar temporalmente `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`,
   `ADMIN_NAME` y `ADMIN_MODE=bootstrap`, y ejecutar exactamente:

   ```text
   node deploy/render/with-cloud-env.mjs node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/create-admin.ts
   ```

   `bootstrap` es el modo de primera instalación; `repair` queda reservado para
   reparar una cuenta administradora ya existente. Retirar inmediatamente las
   cinco variables temporales cuando el comando confirme la verificación.

8. Cargar sólo los datos autorizados y ejecutar las pruebas del piloto descritas
   en el plan maestro externo `../../outputs/cloud/PLAN-NEXORA-CLOUD.md` de esta
   entrega.

## Publicaciones posteriores

1. Confirmar un respaldo recuperable.
2. Publicar primero la API; su `preDeployCommand` aplica la migración.
3. Verificar `/api/health` y una transacción controlada.
4. Publicar la web.
5. Verificar inicio de sesión, venta, SSE, impresión y cola offline.
6. Observar errores antes de declarar finalizada la liberación.

Los disparadores automáticos permanecen apagados para conservar este orden.

## Informes con historial y memoria de la API

Ningún informe carga en memoria todas las ventas del período (PERF-informes,
`apps/api/src/reports.ts`). Antes, el informe de ventas del mes en curso, el
que abre la pantalla Reportes, leía cada venta con sus líneas, producto,
categoría y pagos (también el comprobante de transferencia en base64) y la
API caía con unas 9 000 ventas.

- **Sumas en PostgreSQL:** consumo mensual, por vendedor, por método de
  pago, clientes y la venta diaria por producto de la tienda.
- **Por lotes, sólo con las columnas necesarias:** utilidad y ABC (2 000
  ventas por lote; el costo contabilizado se sigue calculando en la API) y
  las devoluciones del período (300 por lote) del dashboard, por vendedor y
  por método de pago.
- **Listados que crecen con el historial** (ventas detalladas, kardex,
  devoluciones y descuentos): el JSON llega por páginas (`page`, `limit`; 500
  por defecto, 2 000 como máximo) con `total` aparte, y la pantalla Reportes
  navega entre páginas. Excel y PDF se generan en flujo, por lotes de 1 000.
- **Topes con aviso** (400 con el motivo, antes de empezar): Excel hasta
  50 000 filas, PDF hasta 10 000; utilidad y ABC hasta 40 000 facturas (un
  año tardaba 30-45 s con 0,5 CPU, cerca del plazo de 60 s de Nginx); venta
  por forma de pago de la tienda hasta 10 000 facturas. El kardex en JSON ya
  no se corta en silencio a los 10 000 movimientos.

Medición (API compilada con `--max-old-space-size=256`, 0,5 CPU y 512 MB;
base con 110 376 ventas en un año, 2 969 devoluciones, 1 080 comprobantes de
80 KB y 29 521 movimientos de kardex; RSS máximo del proceso y tiempo de la
petición; «sin RAM» = el montón de V8 se agotó o el contenedor mató el
proceso):

| Informe (mes completo, ~9 000 ventas) | Antes           | Ahora                     |
| ------------------------------------- | --------------- | ------------------------- |
| Ventas detalladas (JSON)              | sin RAM, 12,8 s | 176 MB, 0,2 s             |
| Ventas en Excel / PDF                 | sin RAM         | 214 / 210 MB, 4,3 / 8,5 s |
| Consumo mensual                       | sin RAM         | 163 MB, 0,1 s             |
| Utilidad por producto / ABC           | sin RAM         | 204 MB, 2,4 s             |
| Por vendedor / por método de pago     | sin RAM         | 165 MB, 0,2 s             |
| Clientes / devoluciones y descuentos  | sin RAM         | 174 MB, 0,1 s             |
| Kardex (JSON / Excel)                 | sin RAM         | 176 / 223 MB, 0,3 / 8,8 s |
| Venta diaria por producto (tienda)    | sin RAM         | 166 MB, 0,2 s             |
| Venta por forma de pago (tienda)      | sin RAM         | 190 MB, 5,0 s             |
| Dashboard / estado de resultados      | 173-179 MB, 1 s | 173 MB, 0,5 s             |

| Informe (un año, ~110 000 ventas)     | Antes                 | Ahora                 |
| ------------------------------------- | --------------------- | --------------------- |
| Ventas detalladas (JSON, 1.ª página)  | 400 (>10 000)         | 177 MB, 0,2 s         |
| Consumo mensual / por vendedor / pago | 400 (>10 000)         | 176-181 MB, 1,2-1,8 s |
| Kardex en Excel                       | 400 (>10 000)         | 225 MB, 14,9 s        |
| Venta diaria por producto (tienda)    | sin RAM (contenedor)  | 166 MB, 0,6 s         |
| Venta por forma de pago (tienda)      | sin RAM (contenedor)  | 400 con aviso (tope)  |
| Utilidad / ABC                        | 400 (>10 000)         | 400 con aviso (tope)  |
| Dashboard / estado de resultados      | 286-288 MB, 2,4-2,9 s | 233-234 MB, 2,5-2,7 s |

Con los índices de enlace (`202610200001_perf_indexes_links`) la memoria es
la misma; la venta por forma de pago del mes baja de 5,0 a 1,7 s.

Resultados idénticos: con la misma base, las versiones anterior y nueva
devolvieron el mismo JSON (y las mismas celdas en Excel) en 282
comparaciones (262 respuestas y 20 rechazos 403/400 iguales): un día, una
semana, el mes, un período entre febrero y marzo, el mes en curso con una
caja abierta y los últimos 30 días; administración,
gerencia y un rol sólo con `reports:read` (sin costos ni formas de pago de
cajas abiertas); filtros por vendedor, método y categoría; reportes de la
tienda por caja y por usuaria. Lo único distinto es lo que antes fallaba
(400 o sin memoria) y el kardex de más de 10 000 movimientos, que antes se
cortaba (todas sus filas están en el listado nuevo). El orden de las filas
empatadas (mismo importe o misma fecha) no estaba definido y tampoco ahora.

La prueba `tests/reports-memory-postgres.test.ts` (PostgreSQL embebido, 3 000
ventas) falla si una consulta de cualquier informe trae más de 5 000 objetos
o un comprobante.

## Respaldo y recuperación de Render

`render.yaml` configura PostgreSQL pagado `0.1c-256mb`, pero no permite inferir
el plan del workspace Render. El panel de facturación verificó el plan Hobby
para este workspace el 8 de octubre de 2026: Render publica
PITR continuo con ventana de 3 días en Hobby y 7 días en Pro o superior; los
exports lógicos iniciados desde el Dashboard se conservan 7 días. PITR y los
exports lógicos no están disponibles para bases Free. Fuente y fecha de
consulta: [documentación oficial de Render](https://render.com/docs/postgresql-backups),
consultada el 8 de octubre de 2026. Esta ventana depende del workspace, no del
tamaño `0.1c-256mb` del servicio.

**Procedimiento recomendado de recuperación Render (sin sobrescribir la base
fuente):**

1. En el Dashboard de la base, abrir Recovery → Point-in-Time Recovery → Restore
   Database. Render crea una instancia nueva; elegir un nombre distinto y la
   hora de recuperación. No apuntar la aplicación a ella todavía.
2. Comprobar que la instancia recuperada está disponible. Conectar un cliente
   autorizado de forma temporal y verificar salud, migraciones, conteos de datos
   y una operación de lectura. No ejecutar una restauración destructiva sobre
   la base original.
3. Si se usa un export lógico `.dir.tar.gz`, descargarlo y extraerlo en un
   equipo controlado. Crear una base vacía aislada, y usar PostgreSQL 17:

   Antes de restaurar, comprobar la integridad. Para un respaldo propio
   (`.dump` con su `.sha256` y `.json`; `pg_restore --list` no detecta un dump
   truncado, el SHA-256 sí), desde el directorio del respaldo:

   ```text
   sha256sum -c <archivo>.dump.sha256
   ```

   Si no devuelve `OK`, no restaurar. Con un export de Render (`.dir.tar.gz`),
   comparar el SHA-256 del archivo descargado con el que se anotó al
   descargarlo. Después, restaurar de forma atómica:

   ```text
   pg_restore --format=directory --single-transaction --exit-on-error --no-owner --no-privileges --dbname=<URL_DE_BASE_NUEVA_VACIA> <directorio_extraido>
   ```

   `--single-transaction` hace que un fallo no deje tablas parciales en la
   base. No es compatible con `--jobs`: usar `--jobs N` (sin
   `--single-transaction`) sólo para bases grandes y siempre en una base nueva
   que se elimina si falla. Para un `.dump` propio, `scripts/restore.mjs`
   (`RESTORE_DATABASE_URL=... node scripts/restore.mjs <archivo>.dump`) verifica
   el SHA-256 y aplica estas opciones. Un respaldo de Google Drive
   (`.dump.enc`) se descifra antes con `node scripts/decrypt-backup.mjs
<archivo>.dump.enc`, que deja el `.dump` con su `.sha256` y su `.json`
   (`docs/RESPALDO_DRIVE.md`).

   El procedimiento de Render documenta este formato y recomienda no restaurar
   sobre un esquema con datos importantes. La contraseña/URL se proporciona
   mediante el gestor de secretos del cliente, nunca en el historial o como
   argumento literal.

4. Sólo después de validar la instancia recuperada, cambiar `RENDER_DATABASE_URL`
   en el servicio API al connection string de esa nueva base, revisar el
   despliegue y validar `/api/health` y operaciones de lectura/escritura
   controladas. Mantener la instancia anterior intacta hasta completar la
   verificación y decisión del negocio.

No se ejecutó PITR ni una restauración lógica en Render: todavía no se ha
confirmado la cuenta/plan del workspace y no se debe ensayar sobre datos reales.
La fault-injection local del instalador no sustituye la prueba de restauración
cloud. Un ensayo real requiere una base descartable y Docker/`pg_restore`, que
no están disponibles en este equipo durante esta revisión.

## Trabajo que sigue pendiente

Esta preparación no incluye ni autoriza:

- compra, cuenta, repositorio, dominio o despliegue;
- importación del inventario real;
- activar y programar el pipeline privado de Render a S3 y de S3 a la laptop.
  Diseño, fragmento de cron no activo, cliente local y límites: [Respaldo cloud
  de Render](./RESPALDO_CLOUD_RENDER.md);
- monitor externo y alertas operativas;
- ensayo de restauración con base descartable en Render;
- pruebas reales con dos laptops, celular, impresora, lector y cortes de red;
- aceptación del riesgo de una sola instancia.

Tampoco se añadió `ANTHROPIC_API_KEY` ni se cambió el instalador Windows.

## Referencias de plataforma verificadas

- Blueprint: <https://render.com/docs/blueprint-spec>
- Red privada: <https://render.com/docs/private-network>
- Servicios privados: <https://render.com/docs/private-services>
- Variables predeterminadas: <https://render.com/docs/environment-variables>
- Health checks: <https://render.com/docs/health-checks>
- Despliegues y pre-deploy: <https://render.com/docs/deploys>
- PostgreSQL y acceso: <https://render.com/docs/postgresql-creating-connecting>
- Nginx `resolve`: <https://nginx.org/en/docs/http/ngx_http_upstream_module.html>

## IP real del cliente (bloqueo de inicio de sesión y bitácora)

La cadena es Cloudflare → proxy de Render → Nginx (web) → API (privada). Para
Nginx, `$remote_addr` es el proxy de Render: la misma para todos los clientes.
Por eso (auditoría de seguridad 2026-10-10, S-01/S-02/S-04; ver
`docs/DECISIONES.md` punto 15):

- Nginx toma la IP del cliente de `CF-Connecting-IP` **sólo** si la conexión
  llega desde una red de `NEXORA_TRUSTED_EDGE_CIDRS` y si la cabecera contiene
  una sola IP. Si no, usa `$remote_addr`, como antes. La envía a la API como
  `X-Forwarded-For`/`X-Real-IP` y no reenvía `CF-Connecting-IP` ni
  `True-Client-IP`. La `X-Forwarded-For` que manda el navegador nunca se usa.
- `NEXORA_TRUSTED_EDGE_CIDRS` es una variable opcional del servicio web (redes
  separadas por espacios o comas; `none` desactiva la cabecera). Al arrancar,
  `deploy/render/render-trusted-edge.sh` la valida y la convierte en
  configuración. Sin ella se usan las redes privadas, CGNAT y ULA:

  ```text
  10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 fc00::/7
  ```

- La API sólo cree `X-Forwarded-For` si la conexión viene de loopback o de una
  red privada (`TRUSTED_PROXIES`, sintaxis de Express `trust proxy`, para otra
  red interna). Así nadie fuera de la red privada elige su IP con cabeceras.
- El bloqueo de cuenta **no** depende de que esto funcione: con la IP
  colapsada sigue limitando a 10 contraseñas por hora y cuenta y deja entrar
  a la cajera desde su equipo aprobado. La IP real sólo afina los límites por
  dirección y llena `AuditLog.ip`.

**Comprobar tras desplegar** (no verificable sin Render y Cloudflare reales):

1. Inicia sesión desde dos redes distintas (p. ej. Wi-Fi de la tienda y datos
   del celular) y consulta la base (la pantalla de bitácora no muestra la IP):

   ```sql
   SELECT action, ip, "createdAt" FROM "AuditLog"
   WHERE action = 'login' ORDER BY "createdAt" DESC LIMIT 5;
   ```

   Debe aparecer la IP pública de cada red, no una `10.x`/`100.64.x` del
   proxy. Si sale la del proxy de Render, mira en el registro de Nginx la
   dirección de conexión y ajusta `NEXORA_TRUSTED_EDGE_CIDRS`; si sale la de
   Nginx, ajusta `TRUSTED_PROXIES` en la API.

2. Falsificación: ninguna de estas IP debe aparecer en la bitácora ni en
   `AuthAttempt` (Cloudflare sustituye `CF-Connecting-IP` por la real):

   ```sh
   curl -s -X POST https://URL-DE-LA-WEB/api/auth/login \
     -H 'Content-Type: application/json' \
     -H 'X-Forwarded-For: 203.0.113.9' -H 'CF-Connecting-IP: 203.0.113.8' \
     -d '{"login":"no-existe","password":"x"}'
   ```

   ```sql
   SELECT key FROM "AuthAttempt" WHERE key LIKE '%203.0.113.%';  -- vacío
   ```

3. `curl -s https://URL-DE-LA-WEB/api/health` responde `{"status":"ok"}` y
   `curl -s -o /dev/null -w '%{http_code}' https://URL-DE-LA-WEB/healthz/deep`
   responde `204`.
