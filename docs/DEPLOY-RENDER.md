# Preparación de Nexora POS para Render

**Estado (10-oct-2026):** en producción desde el 8-oct-2026. Web
`nexora-pos-web` (`0.5c-512mb`), API privada `nexora-pos-api` (`1c-2g`) y
PostgreSQL 17 `nexora-pos-db` (`0.5c-1g`, 5 GB, base `fitstore_bfjz`), los tres
en Virginia. Los despliegues son manuales. Documentos de operación:
[CONTINGENCIA.md](CONTINGENCIA.md) (qué hace la tienda si algo cae),
[MONITOREO.md](MONITOREO.md) (avisos de caída),
[RESTAURACION_RENDER.md](RESTAURACION_RENDER.md) (recuperar la base) y
[MIGRACIONES_SEGURAS.md](MIGRACIONES_SEGURAS.md).

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
- `render.yaml` refleja los planes reales. **Los cambios de plan se hacen
  primero en el repositorio** (`render.yaml` y los mínimos de
  `tests/cloud-deploy.test.ts`) y después en el panel, nunca sólo en el panel:
  una sincronización del Blueprint con valores menores bajaría los planes
  (reinicio) e intentaría encoger el disco, que Render no permite. La prueba
  impide bajar un plan o el disco por accidente.
- `autoDeployTrigger: off` evita que web, API y migraciones se publiquen en un
  orden accidental. Cada liberación debe iniciarse de forma controlada.

## Archivos de despliegue

| Archivo                               | Función                                                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `render.yaml`                         | Blueprint reproducible, tamaños, región, conexiones y secretos generados.                                                         |
| `deploy/render/Dockerfile.web`        | Construye la PWA y la sirve con Nginx 1.30.5.                                                                                     |
| `deploy/render/nginx.conf.template`   | Publica la web, cabeceras de seguridad y `/api` a la red privada.                                                                 |
| `deploy/render/security-headers.conf` | CSP/PWA, cámara y cabeceras HTTP defensivas.                                                                                      |
| `deploy/render/start-nginx.sh`        | Valida el destino privado y re-resuelve la API cada 10 s (recarga Nginx). Si la API no resuelve, arranca igual con `/api` en 502. |
| `deploy/render/Dockerfile.api`        | Construye y ejecuta exclusivamente la API.                                                                                        |
| `deploy/render/post-deploy-check.mjs` | Tras desplegar: `node deploy/render/post-deploy-check.mjs <URL_WEB> [URL_API]` falla si `/api/health` no da `database: ok`.       |
| `deploy/render/with-cloud-env.mjs`    | Forma `DATABASE_URL` con TLS, UTC y tope de conexiones; en `migrate deploy` añade `lock_timeout` y `statement_timeout`.           |
| `deploy/render/ci-smoke.sh`           | En el CI: arranca las imágenes como en Render (web sin API, migración, API) y ejecuta `post-deploy-check.mjs`.                    |
| `tests/cloud-deploy.test.ts`          | Comprueba las reglas de aislamiento y configuración anteriores.                                                                   |

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
- `NEXORA_DB_CONNECTION_LIMIT` (opcional, 1–100, por defecto 10) limita las
  conexiones de la API. Sin tope, Prisma usaba los núcleos físicos del host
  (17 conexiones). `NEXORA_MIGRATION_LOCK_TIMEOUT` y
  `NEXORA_MIGRATION_STATEMENT_TIMEOUT` (por defecto `5s` y `120s`) sólo se
  añaden de forma temporal para una migración pesada planificada.
- `ANTHROPIC_API_KEY` no está declarada. La lectura con IA permanece apagada
  hasta que el negocio decida activarla como secreto separado.
- Swagger queda apagado en producción.

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
reglas de rutas se comprobaron con un Nginx 1.24 real y, desde el 10-oct-2026,
con la imagen `nginx:1.30.5-alpine3.24` construida en Docker (job
`render-images` del CI). El recorrido visual/offline de la cámara sigue
pendiente.

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

## Salud y preparación

- Render consulta `GET /healthz` en la web. Devuelve `204` aunque PostgreSQL
  esté temporalmente caído, por lo que una avería de datos no reinicia una web
  sana. Es liveness sólo de Nginx y no depende de la API, para que redesplegar
  la API no reinicie la web en bucle.
- `GET /healthz/deep` comprueba además que la API responde (`204` o `503`, sin
  detalles). Es para uso manual o externo; Render no debe usarlo como
  `healthCheckPath`. Lo vigila el monitor externo ([MONITOREO.md](MONITOREO.md)).
- Si al arrancar la web la API no resuelve (suspendida, reiniciando), Nginx
  arranca igual: sirve la PWA y `/healthz`, y `/api/*` responde `502` con un
  JSON claro (`504` si la API tarda más de 60 s), que la PWA trata como «sin
  conexión». El bucle de re-resolución apunta a la API en cuanto aparece. Si
  ese bucle muere, detiene Nginx para que Render reinicie la web.
- Render sólo realiza comprobación TCP nativa al servicio privado.
- `GET /api/health/live` confirma que el proceso de la API vive.
- `GET /api/health` y `GET /api/health/ready` consultan PostgreSQL y devuelven
  `503` si la base no está disponible.
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
ni el seed de demostración. `with-cloud-env.mjs` reconoce esta orden y le
añade `lock_timeout=5s` y `statement_timeout=120s`: una migración que tendría
que esperar o bloquear las tablas de venta falla en vez de congelar las cajas.
Reglas, migraciones pesadas y qué hacer ante un error P3009/P3018:
[MIGRACIONES_SEGURAS.md](MIGRACIONES_SEGURAS.md). Las migraciones nuevas deben
seguir el patrón “ampliar y luego retirar”:

1. Añadir tablas, columnas o índices de forma compatible.
2. Publicar una API que entienda la estructura vieja y la nueva.
3. Publicar la web y comprobar una venta controlada.
4. Retirar estructuras antiguas sólo en una liberación posterior y después de
   un respaldo verificable.

Volver al contenedor anterior no revierte una migración de datos.

### Actualización de la PWA en las cajas

La web usa `registerType: "prompt"`: una versión nueva no recarga la página
sola. Aparece el aviso «Hay una versión nueva de Nexora» y se aplica con
«Actualizar ahora» (sólo con el carrito vacío) o sola cuando el carrito está
vacío y la caja lleva 5 minutos sin uso; nunca con una venta en curso
(`apps/web/src/pwaUpdate.ts`). Cada caja comprueba cada hora si hay versión
nueva. Por eso **la API debe aceptar durante al menos 7 días la versión
anterior de la web y su cola de ventas sin conexión**.

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

El CI (job `render-images` de `.github/workflows/ci.yml`) construye ambas
imágenes en cada _push_ sin publicarlas y ejecuta `deploy/render/ci-smoke.sh`.
Si Docker está disponible en local, se puede repetir:

```text
docker build -f deploy/render/Dockerfile.api -t nexora-api:verify .
docker build -f deploy/render/Dockerfile.web -t nexora-web:verify .
NEXORA_API_IMAGE=nexora-api:verify NEXORA_WEB_IMAGE=nexora-web:verify bash deploy/render/ci-smoke.sh
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
2. Confirmar en el panel de Render el precio vigente de los planes de
   `render.yaml` (web `0.5c-512mb`, API `1c-2g`, PostgreSQL `0.5c-1g` con
   5 GB). No aceptar el Blueprint si el total supera el presupuesto aprobado.
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

1. Desplegar sólo un commit de `nexora-cloud` con el CI **en verde** (incluido
   el job `render-images`), fuera de horario (antes de abrir o después del
   cierre) salvo urgencia.
2. Confirmar un respaldo recuperable (export semanal, ver
   [RESTAURACION_RENDER.md](RESTAURACION_RENDER.md)).
3. Publicar primero la API; su `preDeployCommand` aplica la migración.
4. Verificar `/api/health` y una transacción controlada.
5. Publicar la web.
6. Ejecutar Actions › «Comprobación posterior al despliegue» (corre
   `post-deploy-check.mjs` contra la web pública) y verificar inicio de
   sesión, venta, SSE, impresión y cola offline.
7. Observar errores antes de declarar finalizada la liberación.

Los disparadores automáticos permanecen apagados para conservar este orden.

### Protección que sólo puede activar la dueña

- GitHub › _Settings › Branches_: regla para `nexora-cloud` que exija el CI
  en verde (`verify` y `render-images`) y una revisión antes de mezclar.
- GitHub › _Settings › Actions › General_: permisos del `GITHUB_TOKEN` en
  «Read repository contents» (los workflows ya piden sólo lectura).
- Render › Blueprint: confirmar si _Auto Sync_ está activo y dejarlo
  **apagado** (sincronizar sólo a mano, tras revisar el diff).

## Respaldo y recuperación de Render

Procedimiento completo y probado: [RESTAURACION_RENDER.md](RESTAURACION_RENDER.md).

`render.yaml` configura PostgreSQL pagado `0.5c-1g`, pero no permite inferir
el plan del workspace Render. El panel de facturación verificó el plan Hobby
para este workspace el 8 de octubre de 2026: Render publica
PITR continuo con ventana de 3 días en Hobby y 7 días en Pro o superior; los
exports lógicos iniciados desde el Dashboard se conservan 7 días. PITR y los
exports lógicos no están disponibles para bases Free. Fuente y fecha de
consulta: [documentación oficial de Render](https://render.com/docs/postgresql-backups),
consultada el 8 de octubre de 2026. Esta ventana depende del workspace, no del
tamaño `0.5c-1g` del servicio.

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
   el SHA-256 y aplica estas opciones.

   El procedimiento de Render documenta este formato y recomienda no restaurar
   sobre un esquema con datos importantes. La contraseña/URL se proporciona
   mediante el gestor de secretos del cliente, nunca en el historial o como
   argumento literal.

4. Sólo después de validar la instancia recuperada, cambiar `RENDER_DATABASE_URL`
   en el servicio API al connection string de esa nueva base, revisar el
   despliegue y validar `/api/health` y operaciones de lectura/escritura
   controladas. Mantener la instancia anterior intacta hasta completar la
   verificación y decisión del negocio.

No se ejecutó PITR ni una restauración lógica en Render. El 10-oct-2026 se
ensayó en Docker con PostgreSQL 17.11 el respaldo propio (`backup.mjs` /
`restore.mjs`) y un export en formato directorio como el de Render, con
conteos idénticos y la API sana contra la base restaurada (detalle en
[RESTAURACION_RENDER.md](RESTAURACION_RENDER.md); prueba anterior con
PostgreSQL 16 en [PRUEBA_RESTAURACION.md](PRUEBA_RESTAURACION.md)). El ensayo
de PITR hacia una base descartable en Render sigue pendiente.

## Trabajo que sigue pendiente

- Activar y programar el pipeline privado de Render a S3 y de S3 a la laptop.
  Diseño, fragmento de cron no activo, cliente local y límites: [Respaldo cloud
  de Render](./RESPALDO_CLOUD_RENDER.md). Mientras tanto, export semanal a mano
  ([RESTAURACION_RENDER.md](RESTAURACION_RENDER.md)).
- Crear el monitor externo y los avisos ([MONITOREO.md](MONITOREO.md)).
- Ensayo de PITR con base descartable en Render.
- Pruebas reales con dos laptops, celular, impresora, lector y cortes de red
  ([CONTINGENCIA.md](CONTINGENCIA.md)).
- Aceptación del riesgo de una sola instancia.

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
