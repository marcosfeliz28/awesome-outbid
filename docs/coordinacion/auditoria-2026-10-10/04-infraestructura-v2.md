# 04 · Infraestructura · auditoría v2

**Commit auditado:** `a12c980` (worktree `wt-v2-infraestructura`, desacoplado de `origin/nexora-cloud`). **Fecha:** 2026-10-10 (~14:30 UTC). **Modo:** sólo lectura; no se cambió código ni se hizo push. Producción: únicamente GET/HEAD públicos sin credenciales. No se usó Render MCP.

## Qué se ejecutó de verdad

- `prisma migrate deploy` de las 51 migraciones sobre una base nueva (PostgreSQL 16.14 del sistema, base `aud_v2_infra`): todas se aplican. `prisma migrate diff` base→`schema.prisma`: **vacío**, sin deriva. Las 18 restricciones CHECK quedan validadas en base vacía.
- `with-cloud-env.mjs … migrate deploy` con una migración-sonda: dentro de la migración se ve `lock_timeout=5s statement_timeout=2min TimeZone=Etc/UTC`, o sea que los límites **sí llegan** a la sesión de Prisma.
- Sonda de `RAISE NOTICE`: **Prisma no muestra los NOTICE** en la salida de `migrate deploy`.
- Sonda de `statement_timeout` dentro de `DO … EXCEPTION WHEN OTHERS`: el error **no se captura** y aborta la migración.
- Ciclo completo del respaldo de Drive: `pg_dump -Fc` → `createEncryptStream` (código real de la API) → `scripts/decrypt-backup.mjs` (idéntico byte a byte) → `scripts/restore.mjs` en una base nueva (verifica SHA-256; 39 filas de `_prisma_migrations`). Funciona con PG16; **no** se probó con PG17.
- `vitest`: `cloud-deploy` (33), `pwa-update` (4) y `drive-backup-core` (21) pasan. Las pruebas `*-postgres` que levantan PostgreSQL embebido no se pudieron correr (el binario no arranca como root: EACCES); se reemplazaron por las pruebas manuales de arriba.
- Hash SHA-256 de la clave PGDG (`ACCC4CF8.asc`) descargada hoy: coincide con el `ADD --checksum` de `Dockerfile.api:30`.
- Producción (GET): `/healthz` 204, `/healthz/deep` 204, `/api/health` y `/api/health/ready` 200 `{"status":"ok"}`, `/.env` 404, `/api/docs` 404, `/api/backups/status` 401, `/runtime-config.js` → release `nexora-pos@a12c980…` (la web en vivo **es** el commit auditado) y `/api/backups/google/callback` → 302 `…/?drive=unconfigured#settings`: **el respaldo a Drive NO está configurado en producción**.

## Tabla v1 → estado en `a12c980`

| v1 | Tema | Estado | Evidencia |
|---|---|---|---|
| B1 | Sin copia fuera de Render; restauración nunca ensayada | **Parcial (sigue siendo el riesgo principal)** | Existe el código (`apps/api/src/drive-backup.ts`, `drive-backup-core.ts`, migración `202610200101_drive_backup`), `scripts/decrypt-backup.mjs`, `docs/RESPALDO_DRIVE.md`, `RESTAURACION_RENDER.md` y `PRUEBA_RESTAURACION.md` (ahora sí en la rama; PG16). Pero **en producción no está activo**: el callback devuelve `drive=unconfigured` (faltan `GOOGLE_OAUTH_CLIENT_ID/SECRET` y `BACKUP_ENCRYPTION_KEY`, ni siquiera están como `sync:false` en `render.yaml`). Sigue sin existir PITR ensayado en Render ni restauración con PG17. Mi ciclo local cifrar→descifrar→restaurar sí funciona. |
| A1 | BD caída → API 500 y la PWA no encola | **Parcial** | `database-errors.ts` + `common.ts:700-701` devuelven 503 `DB_UNAVAILABLE`, pero **sólo dentro del `AuthGuard`** (caso "base caída al empezar la petición", el más frecuente). `ApiExceptionFilter` (`common.ts:~735-790`) **no** mapea P1001/P1017/P2024 en los handlers: un pool agotado o una conexión cortada a mitad de `POST /sales` sigue dando 500. Sin `Retry-After`. Tests: sólo `tests/auth-guard.test.ts:107`. |
| A2 | Sin monitor externo ni alertas | **Abierto (sólo documentación)** | `docs/MONITOREO.md` con pasos; ningún monitor verificable. `render.yaml` sin `notifyOnFail` ni `SENTRY_DSN`. Sigue sin chequeo de espacio de disco. |
| A3 | `render.yaml` ≠ Render real | **Corregido** | `render.yaml:33` (`1c-2g`), `:76-85` (`0.5c-1g`, `fitstore_bfjz`, `diskSizeGB: 5`); `tests/cloud-deploy.test.ts:109-137` impide bajar planes. Pendiente (no verificable): desactivar Auto Sync del Blueprint en el panel. |
| A4 | Se despliega cualquier commit; sin CI de imágenes ni verificación posterior | **Parcial** | `ci.yml` job `render-images` (build de ambas imágenes + `deploy/render/ci-smoke.sh`: PG17 con TLS, web antes que API, preDeploy real, `post-deploy-check`, idempotencia) y `post-deploy-check.yml` (manual). Siguen abiertos: protección de rama, deploy hook que dependa del CI, ventana fuera de horario. No pude ejecutar Docker aquí (sin daemon). |
| A5 | Sin plan de contingencia; offline apagado por defecto | **Parcial** | `docs/CONTINGENCIA.md` existe. `admin.ts:92` mantiene `allowOfflineSales` en `false` por defecto; valor en producción no verificable. Sin ensayo de corte real. |
| M1 | Migraciones con bloqueos, sin `lock_timeout`; sin procedimiento P3009 | **Parcial** | `with-cloud-env.mjs:7-60` (lock 5s, statement 120s, verificado con sonda); `docs/MIGRACIONES_SEGURAS.md` con P3009. Las migraciones de la noche reintroducen el problema (ver N1, N3). |
| M2 | Fechas futuras y prefijos repetidos | **Parcial** | Las 8 migraciones nuevas son estrictamente posteriores (`202610200001…210004`), la última (`210004`) renombrada para no chocar; `cloud-deploy.test.ts:254-276` congela los dos prefijos repetidos históricos. No existe la prueba "una migración nueva debe quedar la última". |
| M3 | Migraciones que omiten índices en silencio | **Abierto y ampliado** | Las 4 migraciones nuevas de índices/restricciones (`200001`, `210001`, `210002`, `210003`) siguen el patrón "nunca aborta + NOTICE" y Prisma **no muestra los NOTICE** (probado). `post-deploy-check.mjs` no revisa `pg_indexes`/`convalidated`. La guía de comprobación (`DEPLOY-RENDER.md:~370`) sólo cubre 8 de los ~15 índices y ninguna restricción. |
| M4 | Pool de Prisma sin límite | **Corregido (con matiz)** | `with-cloud-env.mjs:62-88` fija `connection_limit=10`; `database-pool.ts` añade `pool_timeout=20` (`common.ts:30-31`). Falta `connect_timeout`. |
| M5 | La web no arranca si la API no resuelve | **Corregido** | `start-nginx.sh:~60-75` escribe un upstream `127.0.0.1:port down`, Nginx arranca y `/api` responde 502 JSON; el bucle de re-resolución detiene Nginx si muere (`trap … kill -TERM $$`). Probado por `ci-smoke.sh` paso 2. `/healthz` sigue sin mirar la API a propósito; `/healthz/deep` lo cubre. |
| M6 | Una instancia, despliegues que cortan, SSE | **Abierto** | `numInstances: 1`; `realtime.ts` sin cierre activo de SSE al apagar. Sin cambios útiles. |
| M7 | PWA `autoUpdate` recarga sola | **Corregido (con matiz)** | `vite.config.ts:37-44` `registerType: "prompt"`, `pwaUpdate.ts` (no recarga con carrito, revisión horaria), documento de compatibilidad N-1 de 7 días (`DEPLOY-RENDER.md:~396`). Matiz en N8. |
| M8 | Disco sin alerta ni purga | **Parcial** | `retention.ts` purga `RealtimeEvent` (48 h), `NotificationOutbox`, `AuthAttempt`, `RefreshToken`. Siguen sin límite `InvoiceAttachment` (bytea) y `AuditLog`; sigue sin alerta de disco ni autoescalado (`render.yaml:88`). |
| M9 | `/api/alerts` supera 60 s; sondeo SSE cada 150 ms | **Abierto** | `alerts.ts` cambia reglas, no rendimiento; `realtime.ts:75` mantiene el sondeo de 150 ms. Sin `statement_timeout` de rol. |
| M10 | Acciones por etiqueta, sin `permissions` | **Corregido (SHA no verificado)** | `ci.yml:1-8`, `.github/dependabot.yml`, `permissions: contents: read`, imagen `postgres:17.11@sha256:…`. No pude confirmar que los SHA de las acciones existan (sin acceso a GitHub); ver N7. |
| L1 | Imágenes base por etiqueta | **Abierto** | `Dockerfile.api:2,23`, `Dockerfile.web:2,24`, `backup/Dockerfile:2` y `Dockerfile` raíz (`node:24-…`, `nginx:1.27-alpine`) sin digest. Sólo la imagen de PG del CI y del smoke están fijadas. |
| L2 | `client_max_body_size 5m` = multer 5 MB | **Abierto** | `nginx.conf.template:41`, `merchandise.ts:197`, `catalog.ts:567`. |
| L3 | Código de salida del envoltorio | **Parcial** | La API ya se carga en el mismo proceso (`with-cloud-env.mjs:112-134`, sin segundo node, la señal llega directa). Para el preDeploy, `runChild` (`:149`) sigue devolviendo 130 en SIGKILL. |
| L4 | Sobredimensionado/costos | **Abierto** | Sin cambio; `1c-2g` formalizado en `render.yaml`. |
| L5 | Documentación desactualizada | **Parcial** | `DEPLOY-RENDER.md` renovado (+450 líneas), `RESTAURACION_RENDER.md` nuevo. Quedan comentarios viejos (`retention.ts:5` "disco de 1 GB"; `Dockerfile.api` comenta 512 MB). |
| L6 | Logs con datos personales | **No reevaluado** | `nginx.conf.template` sin cambio de `log_format`. |
| L7 | Imagen de la API con fuente y dev deps | **Abierto** | `Dockerfile.api:~57` copia `/app` completo; ahora además lleva `pg_dump`/`pg_restore` 17. |
| L8 | Sentry no vacía en el arranque | **Abierto** | `main.ts:63-66` sin `flush`. |
| L9 | npm / `embedded-postgres` beta / corepack | **Abierto** | Sin cambio. |

## Hallazgos nuevos o regresiones

Resumen: **0 críticos, 0 altos, 4 medios, 8 bajos.** Ningún hallazgo nuevo rompe producción hoy; el riesgo existencial sigue siendo B1.

### MEDIO

**N1 · Las migraciones nuevas acumulan bloqueos en una sola transacción, con espera hasta 15 s por objeto**
- Archivo: `apps/api/prisma/migrations/202610210002_datos_restricciones/migration.sql:79-171` (también `202610200001…/migration.sql:21-60` y `202610210001…/migration.sql:30-55`).
- Cada `ALTER TABLE … ADD CONSTRAINT … NOT VALID` toma `SHARE ROW EXCLUSIVE` sobre la tabla (y, en una FK, sobre la tabla referida). Todo corre en un único `DO` = una transacción, así que **ningún bloqueo se libera hasta el final**, y cada nuevo objeto puede esperar hasta `lock_timeout = 15 s` (la migración lo sube de los 5 s del envoltorio) mientras conserva los anteriores. Incluye también los escaneos completos de validación. Tablas afectadas: `Sale`, `Payment`, `CashSession`, `CashMovement`, `SaleReturn`, `CreditNote`, `PurchaseItem`, `Variant`…
- Escenario: despliegue en horario de tienda; un reporte largo retiene `Customer`/`CashSession` 14 s. El `DO` ya sostiene `Sale` y `Payment` en `SHARE ROW EXCLUSIVE`. Cada `UPDATE "Variant"`/`INSERT INTO Payment` de las cajas (la API vieja sigue viva durante el preDeploy) hace cola: la tienda se congela entre 15 s y varios minutos (27 objetos × 15 s en el peor caso). Y el envoltorio de 5 s deja de proteger porque `set_config('lock_timeout','15s',true)` lo pisa.
- Arreglo mínimo: quitar los `set_config('lock_timeout', '15s')` (o bajarlos a 2-3 s), partir `210002` en varias migraciones (una por tabla caliente) y desplegar fuera de horario.

**N2 · Los "NOTICE" de las migraciones no se ven, y nada comprueba que los objetos de la noche existan**
- Archivos: `202610200001`, `210001`, `210002`, `210003`; `docs/DEPLOY-RENDER.md:~352-380` ("aviso `PERF:` en el registro del pre-deploy" es falso: probado, Prisma no imprime NOTICE); `deploy/render/post-deploy-check.mjs`.
- Escenario: un `lock_timeout` o un permiso hace que el `EXCEPTION WHEN OTHERS` se trague la creación de `Sale_customerId_idx`, de una FK o de un CHECK. `migrate status` dice "up to date", `post-deploy-check` dice `ok`, y nadie se entera. Peor: `210002` deja restricciones en `NOT VALID` si hay filas antiguas que las violan, también sin aviso visible. Además no hay ninguna consulta documentada para `Sale_customerId_idx`, `AuditLog_entityId_entity_idx`, `PurchaseItem_orderId_idx`, `operationId` únicos, `convalidated`, el trigger `auth_attempt_touch` ni `plan_cache_mode`.
- Arreglo mínimo: que la migración deje rastro en `AuditLog` (como `variant_code_unique`) o en una tabla de resultados, y añadir a `post-deploy-check`/un endpoint de administración una consulta que verifique índices (`indisvalid`), restricciones (`convalidated`), el trigger y `SHOW plan_cache_mode`. Corregir la frase de la documentación.

**N3 · Los CHECK/FK `NOT VALID` también bloquean `UPDATE` de filas antiguas que los violan**
- Archivo: `202610210002_datos_restricciones/migration.sql:12-17, 150-171`.
- Una restricción `NOT VALID` se aplica a toda fila que se inserte **o modifique**. Si una venta, pago o recepción antigua viola la regla (p. ej. `receivedQty + damagedQty > qty`, un pago con `change` negativo, una caja con `closedAt < openedAt`), cualquier `UPDATE` posterior sobre esa fila (anular, verificar, corregir) falla con 23514/23503 y la API lo devuelve como 500 genérico. Combinado con N2, las filas problemáticas no quedan listadas en ningún lado visible.
- Arreglo mínimo: antes de desplegar, correr en producción una consulta de sólo lectura que cuente violaciones por restricción (la misma que ya usa la migración) y corregir o excluir esas filas; ante un 23514 en la API, mapear a 409 con mensaje claro.

**N4 · El respaldo a Drive sigue sin estar activo en producción y depende de la misma API**
- Evidencia: `GET /api/backups/google/callback` → `?drive=unconfigured`; `render.yaml` no declara `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` ni `BACKUP_ENCRYPTION_KEY` (ni `SENTRY_DSN`) como `sync:false`; el aviso de fallo sale por Telegram desde la propia API (`docs/RESPALDO_DRIVE.md`), así que si la API está caída no avisa.
- Escenario: se asume que "ya hay respaldo diario" por existir el módulo; en realidad hoy la única copia sigue siendo la de Render (PITR de 3 días). La clave `BACKUP_ENCRYPTION_KEY` sólo está en el panel de Render: si se pierde la cuenta (escenario b de B1), también se pierde la clave salvo que se haya guardado fuera, como pide el manual.
- Arreglo mínimo: ejecutar los pasos del manual hoy, declarar las tres variables como `sync:false` en `render.yaml`, hacer un ensayo `decrypt-backup` + `restore` con un archivo real bajado de Drive, y medir con un monitor externo (A2) en lugar de depender del Telegram de la API.

### BAJO

**N5 · `statement_timeout` no es capturable y rompe la promesa "nunca aborta"** — `with-cloud-env.mjs:9` (120 s) frente a los `DO … EXCEPTION WHEN OTHERS` de `200001/210001/210002/210003`: `QUERY_CANCELED` no lo atrapa `OTHERS` (probado). Si un `DO` pasa de 120 s, la migración falla entera y queda el P3009. Arreglo: un `statement_timeout` mayor por sentencia (`SET LOCAL` dentro de cada bloque) o documentarlo en `MIGRACIONES_SEGURAS.md`, que hoy afirma lo contrario.

**N6 · La imagen de la API depende en tiempo de build de `postgresql.org` y `apt.postgresql.org`** — `deploy/render/Dockerfile.api:30-47`. La clave está fijada por SHA (verificado hoy), pero `apt-get download postgresql-client-17` no fija versión y un corte de PGDG impide construir una corrección urgente. Arreglo: fijar versión (`postgresql-client-17=17.x`), o copiar `pg_dump` desde una imagen oficial `postgres:17.11@sha256:…` con `COPY --from`.

**N7 · SHA de acciones del CI no verificados** — `ci.yml:25-29, 64-66`, `post-deploy-check.yml`. No tuve acceso a GitHub; el comentario `# v4.4.0` en `actions/checkout` no corresponde a ningún tag que yo conozca. Si un SHA no existe el CI entero falla y el `render-images` no corre. Arreglo: confirmar los SHA con `git ls-remote` o dejar que Dependabot los regenere.

**N8 · Actualización automática de la PWA tras 5 min de inactividad puede recargar una pantalla con datos sin guardar** — `apps/web/src/pwaUpdate.ts:38-52, 123-136`, `pwaUpdatePolicy.ts:8-27`. Sólo protege el carrito (`useStore.cart`), no formularios de mercancía/ajustes; con `controllerchange` sólo recargan las pestañas que ejecutaron `apply()`, y las demás quedan con JS viejo bajo un SW nuevo. Arreglo: tratar como "ocupado" cualquier formulario sucio (o no autoaplicar fuera de la caja) y recargar todas las pestañas.

**N9 · `/api/health` y `/api/health/ready` consultan la base en cada petición pública, sin caché ni cupo** — `apps/api/src/app.ts:44-58`. Un goteo anónimo desde Cloudflare ocupa conexiones de un pool de 10 (`connection_limit`) y puede provocar P2024 en cobros reales. Arreglo: cachear el resultado 2-5 s en memoria y limitar por IP.

**N10 · Residuo de A1: login y P2024 dentro de los handlers siguen dando 500** — `common.ts:~735-790` (`ApiExceptionFilter`). Rutas `@Public` (login, `/auth/*`) y errores de conexión a mitad de transacción de venta no pasan por el mapeo del guard (no verificado en vivo). Arreglo: mapear `isDatabaseUnavailable` a 503 + `Retry-After: 5` en el filtro global.

**N11 · Pool sin `connect_timeout` y envoltorio de preDeploy** — `with-cloud-env.mjs:62-88`: si la base no responde al abrir, Prisma espera su valor por defecto. Arreglo: añadir `connect_timeout=10` junto a `connection_limit`.

**N12 · `render.yaml` sin variables opcionales operativas** — sólo `VITE_SENTRY_DSN` está como `sync:false`; faltan `SENTRY_DSN`, `TELEGRAM_*`, `GOOGLE_OAUTH_*`, `BACKUP_ENCRYPTION_KEY`, `ANTHROPIC_API_KEY`. Un Blueprint de recuperación en otra cuenta arrancaría sin esas capacidades. Arreglo: declararlas con `sync:false`.

## Prioridades sugeridas

1. Activar y ensayar el respaldo a Drive hoy (N4/B1); descargar una exportación lógica semanal mientras tanto.
2. Antes del próximo despliegue con migraciones: quitar el `lock_timeout` de 15 s o partir `210002` (N1), y revisar filas que violan los CHECK (N3).
3. Hacer visibles los objetos de las migraciones (N2) y extender `post-deploy-check`.
4. Completar A1 en el filtro global (N10), poner el monitor externo (A2), proteger la rama y ejecutar el `post-deploy-check` como paso del despliegue (A4).

## No verificado

- Si el Blueprint de Render tiene Auto Sync activo; el plan del workspace (PITR de 3 vs 7 días); variables reales del servicio; planes y facturación.
- Ejecución de las imágenes Docker y del job `render-images` (sin daemon Docker aquí).
- Pruebas `*-postgres` con PostgreSQL embebido (no arrancan como root); la prueba de migraciones se hizo con PG16 del sistema, producción es PG17.
- Datos reales de producción: filas que violarían las restricciones de `210002`, tamaño de `InvoiceAttachment`/`AuditLog`, `max_connections`.
- Los SHA de las acciones de GitHub y la protección de la rama `nexora-cloud`.
- Eventos de Render, despliegues y métricas posteriores al 10-oct 03:50 UTC (no se usó Render MCP en esta pasada).

Nota de limpieza: las bases de prueba y los archivos temporales se eliminaron; en el PostgreSQL local del sistema (no es producción) el rol `postgres` quedó con una contraseña de prueba y el clúster 16 quedó encendido.
