# 04 · Infraestructura, despliegue, operación y recuperación ante desastres

**Sistema:** Nexora POS (repo `marcosfeliz28/awesome-outbid`, rama `nexora-cloud`)
**Commit auditado:** `3e5521c` (worktree desacoplado en `origin/nexora-cloud`). Lo desplegado en Render es: API `ec51dc8` (live desde 2026-10-10 03:34 UTC) y web `bfec6b6` (live desde 2026-10-10 01:40 UTC). Entre `bfec6b6` y `3e5521c` sólo cambian documentos; entre `ec51dc8` y `bfec6b6` no cambian `apps/api`, `packages/shared` ni `deploy/`.
**Fecha:** 2026-10-10. **Modo:** sólo lectura. No se modificó código ni Render. Lo único que se hizo fue leer el estado con las herramientas MCP de Render (`list_services`, `list_postgres_instances`, `list_deploys`, `list_events`, `get_metrics` y `list_logs`) y hacer peticiones GET a `https://nexora-pos-web.onrender.com`. No se ejecutó SQL contra producción.

## Estado real observado en Render (2026-10-10 ~03:50 UTC)

| Recurso | Estado real | Lo que declara `render.yaml` |
|---|---|---|
| `nexora-pos-web` (web, Docker, Virginia) | `0.5c-512mb`, 1 instancia, `healthCheckPath /healthz`, autodeploy apagado, build sin caché | `0.5c-512mb` ✔ |
| `nexora-pos-api` (pserv, Docker) | **`1c-2g`** (cambio de plan a las 03:33 UTC del 10-oct), 1 instancia, preDeploy `migrate deploy`, `maxShutdownDelaySeconds 60` | **`0.5c-512mb`** ✘ |
| `nexora-pos-db` (PostgreSQL 17.11) | **`0.5c-1g`, disco 5 GB**, autoescalado de disco desactivado, sin HA, sin réplicas, `ipAllowList []`, base **`fitstore_bfjz`** | **`0.1c-256mb`, `diskSizeGB: 1`**, `databaseName: fitstore` ✘ |
| Cron de respaldo a S3 | **No existe** (sólo hay 2 servicios) | Sólo como ejemplo (`backup-cron.example.yaml`) |

Mediciones de las últimas 24 h:

- **API:** usa entre 106 y 173 MB de RAM y la CPU está casi a cero. El límite de memoria mostrado hasta las 03:00 era de 512 MB, el plan anterior.
- **Web (Nginx):** usa entre 14 y 21 MB.
- **Base de datos:** usa entre 46 y 92 MB, con CPU de alrededor de 0,006. Las conexiones activas fueron **17** de forma constante entre las 05:00 y las 15:00 del 9-oct. Ese número coincide con el pool por defecto de Prisma (núcleos físicos ×2 + 1).
- **Tráfico:** el piloto tiene muy poco tráfico (decenas de peticiones por hora como máximo).
- **Cambio de plan de la base:** reinició PostgreSQL. Se apagó a las 03:35:38 y volvió a las 03:36:27, unos **50 s de corte**. En ese lapso `/api/health` devolvió 503, que es lo correcto.
- **PITR:** está activo. Los logs muestran el envío continuo de WAL a pgBackRest.

Comprobaciones públicas: `/healthz` 204, `/healthz/deep` 204, `/api/health` 200 `{"database":"ok"}`, `/.env` 404, `/api/docs` 404. Las cabeceras de seguridad están presentes y delante hay Cloudflare.

## Resumen por severidad

| Severidad | Cantidad |
|---|---|
| BLOQUEANTE | 1 |
| ALTO | 5 |
| MEDIO | 10 |
| BAJO | 9 |

---

## BLOQUEANTE

### B1 · No existe ninguna copia de los datos fuera de Render y nunca se ensayó una restauración en Render
- **Evidencia:**
  - Render (`list_services`) muestra sólo `nexora-pos-web` y `nexora-pos-api`. El cron `nexora-pos-cloud-backup` no existe; sólo está como ejemplo en `deploy/render/backup-cron.example.yaml:1-25`.
  - `docs/RESPALDO_CLOUD_RENDER.md` («Activación futura (no ejecutada)») y `docs/DEPLOY-RENDER.md:363-367` dicen literalmente: «No se ejecutó PITR ni una restauración lógica en Render».
  - La única prueba de restauración real está en `docs/PRUEBA_RESTAURACION.md`. Ese archivo vive sólo en la rama `claude/restore-evidence` y no está en `nexora-cloud`. Se hizo **en un clúster local con PostgreSQL 16.14**, no con PostgreSQL 17 ni en Render.
  - El CI (`.github/workflows/ci.yml:37-60`) prueba `backup.mjs`/`restore.mjs` con PostgreSQL 17, pero sobre datos de seed.
  - Según `docs/DEPLOY-RENDER.md:306-314`, el workspace es Hobby, así que **la ventana de PITR es de sólo 3 días**.
- **Escenario de falla:**
  - (a) Alguien anula o borra datos por error, o una migración fusiona lotes mal (como `202610160002_lot_identity_reconciliation`), y se descubre el lunes. El error fue el jueves: ya quedó fuera de la ventana de PITR.
  - (b) La cuenta de Render queda suspendida por impago o comprometida, o la base se borra desde el panel. Hoy no hay ningún `.dump` en otro lugar.
  - (c) Llega el día de usar PITR y nadie sabe cuánto tarda, ni que crea una base **nueva** con otra URL. Tampoco se sabe que `RENDER_DATABASE_URL` hay que cambiarla a mano, y el Blueprint no lo sabe.
- **Impacto:** se pierde de forma irrecuperable el historial de ventas, la caja, el inventario y los datos fiscales (NCF/ITBIS). La tienda no puede cuadrar ni declarar. Es el riesgo existencial del sistema.
- **Arreglo (en orden):**
  1. **Hoy:** desde el panel, Recovery → *Export* lógico, descargar el `.dir.tar.gz` a la laptop y a un USB o OneDrive, y anotar el SHA-256. Repetirlo cada semana mientras no exista el cron.
  2. Activar `deploy/render/backup/` como cron diario a S3 (u otro destino), con un rol PostgreSQL de sólo lectura y la descarga a la laptop (`scripts/Register-NexoraCloudBackupTask.ps1`).
  3. Ensayo documentado de **PITR en Render** hacia una base nueva: medir el RTO (minutos hasta tener una base usable) y el RPO, verificar conteos y `prisma migrate status`, y borrar la base de prueba.
  4. Ensayo de `restore.mjs` con un dump real de producción en la laptop con PostgreSQL 17 o 18. Esto sirve además como «modo isla» (ver el plan de contingencia).
  5. Mezclar `docs/PRUEBA_RESTAURACION.md` en `nexora-cloud` junto con el resultado del ensayo de Render.
  6. Valorar el workspace Pro, que da 7 días de PITR, cuando haya datos reales.

---

## ALTO

### A1 · Si se cae la base de datos, la API responde 500, no 503: la PWA no entra en modo sin conexión y la venta no se encola
- **Evidencia:**
  - `apps/api/src/common.ts:686-739` (`ApiExceptionFilter`) sólo traduce Zod, P2002, P2025 y los conflictos de serialización. Los errores de conexión de Prisma (`P1001`, `P1017`, `P2024` por pool agotado, `PrismaClientInitializationError`) caen en **500**.
  - La web (`apps/web/src/api.ts:198-209`) considera «sin conexión» sólo un fallo de red o un **502/503/504**. Con un 500 muestra «No se pudo completar la operación».
  - `offlineSaleAction` (`apps/web/src/offlinePolicy.ts`) sólo guarda la venta como pendiente si el error es de red.
  - Esto se observó de verdad: el 10-oct a las 03:35:38 PostgreSQL estuvo ~50 s apagado por el cambio de plan.
- **Escenario de falla:** Render reinicia PostgreSQL (mantenimiento, cambio de plan, disco lleno, OOM). Durante 1 a 10 minutos todas las cajas reciben 500 al cobrar, aunque `allowOfflineSales` esté activado. La cajera reintenta a mano o el cliente se va.
- **Impacto:** ventas perdidas y filas en caja justo en el fallo más probable de la nube, que es el de la base y no el de internet. El diseño offline existe, pero no se activa en ese caso.
- **Arreglo:**
  - En `ApiExceptionFilter`, mapear `P1001`, `P1002`, `P1008`, `P1017`, `P2024`, `PrismaClientInitializationError` y `PrismaClientRustPanicError` a **503** con `Retry-After: 5`, sin detalles.
  - Añadir una prueba que apague la base en mitad de `POST /sales` y verifique que la PWA lo encola con el mismo UUID. El reintento idempotente ya existe.

### A2 · No hay forma de enterarse de una caída a tiempo: ni monitor externo ni alertas
- **Evidencia:**
  - `notifyOnFail: default` en ambos servicios, que sólo avisa de deploys fallidos.
  - No hay monitor de disponibilidad. `docs/DEPLOY-RENDER.md:378` lo deja como «Trabajo pendiente: monitor externo y alertas operativas».
  - Sentry de la API es opcional (`apps/api/src/monitoring.ts:10-12`), `SENTRY_DSN` no está en `render.yaml` y no se pudo verificar si existe en el servicio.
  - `/healthz` (lo que mira Render) sólo comprueba Nginx (`nginx.conf.template:30-35`), así que Render ve la web «sana» aunque la API o la base estén caídas.
  - No hay retención externa de logs. Los avisos por Telegram salen de la propia API: si la API muere, no avisa.
- **Escenario de falla:** la API queda en bucle de reinicio, la base se llena o el upstream de Nginx queda obsoleto. El dueño se entera cuando llama la cajera, o al día siguiente.
- **Impacto:** el tiempo de detección se mide en horas. Para un punto de venta, cada minuto sin vender cuesta dinero.
- **Arreglo (para detectar en ≤1 min):**
  1. Monitor externo (UptimeRobot, Better Stack, Healthchecks.io o Cronitor) cada **60 s** a `GET /api/health`, que cubre web, DNS privado, API y base, con un mínimo de 2 fallos seguidos, más un segundo chequeo a `/healthz`.
  2. Alertas a Telegram, SMS o llamada al dueño y al técnico.
  3. Activar en Render las notificaciones de *service failure* (`server_failed`, OOM, `service_disk_usage_high`) por correo y Slack.
  4. Activar `SENTRY_DSN` en la API con una alerta por cada nuevo issue en `area=sales|cash`.
  5. Un heartbeat «de negocio»: si en horario de tienda no entra ninguna venta en 60 min, avisar.
  6. Un log stream de Render hacia un proveedor con retención de 30 días o más.

### A3 · `render.yaml` no coincide con lo que corre en Render, y las pruebas congelan los valores viejos
- **Evidencia:**
  - `render.yaml:33` declara la API en `plan: 0.5c-512mb`; corre en `1c-2g`.
  - `render.yaml:69-73` declara la base en `plan: 0.1c-256mb` con `diskSizeGB: 1`; corre en `0.5c-1g` con 5 GB y `databaseName fitstore_bfjz`.
  - `tests/cloud-deploy.test.ts:23-26` **exige** los valores viejos (`plan: 0.5c-512mb` dos veces, `0.1c-256mb` y `diskSizeGB: 1`).
  - `docs/DEPLOY-RENDER.md:3` dice que «no se ha creado… ningún recurso», y en las líneas 268-273 sigue hablando de los planes viejos.
- **Escenario de falla:** los tres recursos se crearon a la vez (2026-10-08 01:51-01:52), lo que sugiere un Blueprint. Si la sincronización del Blueprint está activa, que lo es por defecto en Render, cualquier commit a `nexora-cloud` que toque `render.yaml` (o una sincronización manual) intentaría:
  - bajar la API a 512 MB;
  - bajar la base a 256 MB, lo que la reinicia;
  - reducir el disco a 1 GB. Render no permite reducir disco, así que la sincronización falla a medias y deja el Blueprint en estado de error.

  Además, quien reconstruya el entorno desde el repo (DR en otra cuenta o región) obtendría una infraestructura más pequeña de lo que el negocio necesita.
- **Impacto:** una degradación o un reinicio no planificados en horario de tienda, y un Blueprint inútil como plan de recuperación.
- **Arreglo:**
  - Actualizar `render.yaml` al estado real (`1c-2g`, o el plan elegido tras el dimensionamiento de L4; `0.5c-1g`; `diskSizeGB: 5`) y el test `cloud-deploy.test.ts`.
  - Comprobar en el panel si el Blueprint tiene *Auto Sync* y desactivarlo, de modo que se sincronice sólo de forma manual y revisada.
  - Dejar escrito que los cambios de plan se hacen **primero en el repo** y luego en Render, nunca sólo en el panel.

### A4 · Se puede desplegar cualquier commit: el CI no protege el despliegue, no se construyen las imágenes y la verificación posterior no se ejecuta sola
- **Evidencia:**
  - El CI (`.github/workflows/ci.yml`) no construye `deploy/render/Dockerfile.api` ni `Dockerfile.web`. La propia `docs/DEPLOY-RENDER.md:136-140, 249-254` reconoce que «Docker no está disponible en el equipo de revisión».
  - Los despliegues se lanzan por API o a mano, sin relación con el CI: 15 deploys de la API en ~48 h (`list_deploys`, `trigger: api`).
  - `deploy/render/post-deploy-check.mjs` existe, pero ningún proceso lo ejecuta.
  - El último commit de la rama dice «CI en rojo» (para otra rama), lo que muestra que hay ramas en rojo circulando.
  - Hubo un `build_failed` el 2026-10-08 22:14 por red.
  - Varios despliegues ocurrieron en horario comercial dominicano: 12:00, 15:13, 18:23 y 21:52 UTC equivalen a 08:00, 11:13, 14:23 y 17:52 AST.
- **Escenario de falla:** se mezcla en `nexora-cloud` un commit con pruebas rojas o con un Dockerfile roto y alguien despliega. En el peor caso la migración se aplica (el preDeploy es irreversible) y la API nueva no arranca: queda la API vieja contra un esquema nuevo (ver M1), o una regresión de cobro en vivo en hora pico.
- **Impacto:** caídas y regresiones auto-infligidas en horario de venta. Es la causa más frecuente de incidentes en sistemas pequeños.
- **Arreglo:**
  - Un job de CI que construya ambas imágenes (`docker build`) y ejecute `render blueprints validate`.
  - Protección de rama en `nexora-cloud` que exija CI en verde.
  - Desplegar sólo desde un workflow que llame al *deploy hook* de Render **después** de que el CI pase, primero la API y luego la web, y que ejecute `post-deploy-check.mjs` al final, alertando si falla.
  - Ventana de despliegue fuera de horario (antes de las 08:00 o después del cierre), salvo hotfix.

### A5 · No hay plan de contingencia operativo y, por defecto, la caja no vende sin conexión
- **Evidencia:**
  - `apps/api/src/admin.ts:87`: `allowOfflineSales: z.boolean().default(false)`.
  - `apps/web/src/offlinePolicy.ts:11`: sólo guarda la venta si el valor es exactamente `true`. El seed lo activa (`prisma/seed.ts:554`), pero no se sabe qué valor tiene producción (No verificado).
  - La sesión offline sólo dura mientras no venza la inactividad local (`App.tsx:440-470`, `sessionTimeoutMinutes` de 30 por defecto). Una caja que abre la app sin red y sin sesión válida no puede entrar.
  - No hay ningún documento de qué hacer si Render o internet caen. `docs/INSTALADOR.md:1-8` desaconseja el servidor local para cajas conectadas a la nube y no describe un «modo isla».
- **Escenario de falla:** se cae internet en la tienda o Render tiene un incidente regional en Virginia, que ocurre algunas veces al año. Con el ajuste apagado la caja no factura nada, y con él encendido sólo factura quien ya tenía sesión abierta. Nadie tiene a mano un procedimiento ni un talonario.
- **Impacto:** tienda parada. Si se vende «a mano» sin procedimiento, las ventas no quedan registradas en el sistema, el inventario se descuadra y faltan los NCF.
- **Arreglo:**
  - Decidir y dejar escrito el valor de `allowOfflineSales` en producción, con límites de monto si aplica.
  - Probar un corte real: router sin WAN durante 15 min con 2 cajas, y luego sincronizar.
  - Adoptar el «Plan de contingencia» de más abajo, imprimirlo y pegarlo junto a la caja.

---

## MEDIO

### M1 · Migraciones que bloquean tablas, sin `lock_timeout`, y sin procedimiento para una migración fallida
- **Evidencia:**
  - `202610170001_variant_code_unique/migration.sql:36` hace `LOCK TABLE "Variant" IN SHARE MODE`, que bloquea toda venta, porque cada venta actualiza `Variant.stock`.
  - `202610170001_perf_indexes/migration.sql:4-5` usa `CREATE INDEX` sin `CONCURRENTLY`, que bloquea escrituras en `InventoryMovement`. No puede ser concurrente porque Prisma ejecuta cada archivo dentro de una transacción implícita.
  - `202610160001_sale_tax_included_snapshot/migration.sql:5-20` hace un `UPDATE` de toda la tabla `Sale` y luego `SET NOT NULL`, que escanea la tabla bajo `ACCESS EXCLUSIVE`.
  - `202610150002_remove_customer_birthday` usa `DROP COLUMN`: la API vieja sigue sirviendo durante el preDeploy (~20-40 s según los eventos) con un cliente Prisma que hace `SELECT "birthday"`, así que toda consulta de clientes falla en esa ventana. Esto rompe la regla «ampliar y luego retirar» de `DEPLOY-RENDER.md:203-212`.
  - Ninguna migración fija `SET lock_timeout` ni `statement_timeout` (grep vacío).
- **Escenario de falla:** con años de ventas, el preDeploy queda esperando el lock detrás de un reporte largo. Mientras tanto, cada `UPDATE Variant` de las cajas se encola detrás del `ALTER` o `LOCK`: la tienda entera se congela hasta que acaba el reporte y la migración. Si una migración falla a medias, Prisma la marca como `failed` (`_prisma_migrations`), y todos los despliegues siguientes fallan (P3009) hasta que alguien ejecuta `prisma migrate resolve`. No hay ningún procedimiento escrito para eso.
- **Impacto:** congelamientos de caja durante el despliegue y despliegues bloqueados en plena emergencia.
- **Arreglo:**
  - Encabezar cada migración que toque tablas con datos con `SET LOCAL lock_timeout = '3s'; SET LOCAL statement_timeout = '60s';`. Es mejor que falle y se reintente fuera de horario.
  - Prohibir con revisión o lint `DROP COLUMN`/`DROP TABLE` en la misma versión que deja de usarlos.
  - Un procedimiento escrito para P3009: diagnosticar, aplicar `migrate resolve --rolled-back` o `--applied` y volver a desplegar.
  - Para índices sobre tablas grandes, crearlos con `CREATE INDEX CONCURRENTLY` en una tarea puntual y que la migración use `IF NOT EXISTS`.

### M2 · Las migraciones llevan fechas futuras y prefijos repetidos, y el orden puede diferir entre producción y una base nueva
- **Evidencia:**
  - Hay migraciones con fecha `202610110001` … `202610190001` y hoy es 2026-10-10.
  - Hay prefijos repetidos: `202610170001_perf_indexes`/`202610170001_variant_code_unique` y `202610190001_incentives`/`202610190001_sale_item_promotion_name`.
- **Escenario de falla:** alguien crea hoy `202610120002_x`, que depende de tablas de `202610180001`. En producción se aplica la última y funciona. En una base nueva (CI, instalador Windows, restauración de DR con `migrate deploy`) se aplica **antes** y falla, o crea el esquema en otro orden. `migrate deploy` no avisa cuando una migración nueva tiene un nombre anterior a otras ya aplicadas.
- **Impacto:** el instalador o la reconstrucción de DR fallan justo cuando se necesitan, y el esquema de producción diverge del de pruebas.
- **Arreglo:** nombrar las nuevas migraciones con un número mayor que la última existente (por ejemplo `202610200001_…`, o un contador) y añadir al CI una prueba que falle si una migración nueva no queda la última en orden lexicográfico.

### M3 · Migraciones que «nunca fallan» omiten índices únicos en silencio
- **Evidencia:**
  - `202610170001_variant_code_unique` y `202610190001_incentives` (bloque `DO $$` final) **no crean** el índice único si encuentran duplicados. Sólo dejan un `NOTICE`, que Prisma no muestra, y en un caso una fila en `AuditLog`.
  - `prisma migrate status` dirá «up to date» aunque falten `Variant_sku_ci_key` o `IncentiveEntry_saleItemId_kind_refId_key`.
- **Escenario de falla:** los datos importados del sistema viejo traen SKUs repetidos que sólo difieren en mayúsculas. El índice no se crea, la unicidad queda a cargo sólo de la aplicación, y la idempotencia de incentivos depende de una transacción, no de una restricción.
- **Impacto:** el esquema se desvía de forma invisible, con riesgo de duplicados en códigos o incentivos.
- **Arreglo:** que `post-deploy-check.mjs` (o un endpoint de admin) compruebe que en `pg_indexes` existen los índices esperados y alerte si faltan. Documentarlo en la checklist de despliegue.

### M4 · El pool de conexiones de Prisma depende del host y no está limitado
- **Evidencia:**
  - `deploy/render/with-cloud-env.mjs:28-29` sólo añade `sslmode` y `TimeZone`, sin `connection_limit`, `pool_timeout` ni `connect_timeout`.
  - Render mostró **17 conexiones** fijas: Prisma calcula núcleos *físicos del host* ×2 + 1, no los del contenedor, así que el cambio a `1c-2g` no lo cambia.
  - Durante un despliegue conviven la API vieja (17), la nueva (17), el `startupDb` de `main.ts:25-30` (1) y el preDeploy (1-2). Una tarea puntual (`create-admin`, `require-password-change`) o el cron de respaldo suman más.
- **Escenario de falla:** si Render mueve el servicio a un host con más núcleos (por ejemplo 32 físicos, que dan 65 conexiones por instancia), dos instancias más las tareas pueden acercarse al `max_connections` del plan de 1 GB (No verificado; suele ser 100). Entonces aparecen `too many connections` en el arranque y el despliegue falla, o P2024 (timeout del pool) en hora pico, que hoy se convierte en 500 (ver A1).
- **Impacto:** caídas intermitentes difíciles de diagnosticar.
- **Arreglo:** en `with-cloud-env.mjs`, fijar `connection_limit=8` (ajustable por variable), `pool_timeout=10` y `connect_timeout=10`, y vigilar `active_connections` con una alerta al 70 % de `max_connections`.

### M5 · La web no arranca si la API no resuelve, y su health check no detecta una API caída
- **Evidencia:**
  - `deploy/render/start-nginx.sh:47-51`: si `getent` no resuelve la API, ejecuta `exit 1`.
  - `/healthz` devuelve 204 sin mirar el upstream (`nginx.conf.template:30-35`).
  - Los logs del 2026-10-08 01:58-02:03 muestran el error «nexora-pos-api could not be resolved» cada 11 s.
- **Escenario de falla:**
  - (a) La API está suspendida o fallando y Render reinicia o migra la instancia web (mantenimiento de host). La web entra en un bucle de arranque fallido: nadie puede descargar la PWA ni el `index.html`, ni siquiera para ver la pantalla de «sin conexión». Las PWA ya instaladas siguen funcionando por el precache.
  - (b) El bucle de re-resolución (`start-nginx.sh:54-68`) muere o se queda con una IP vieja. Render sigue viendo `/healthz` en 204 y no reinicia nada, y todas las peticiones `/api` dan 502 indefinidamente.
- **Impacto:** se alarga una caída de la API, y el aislamiento entre web y API que pretendía el diseño desaparece.
- **Arreglo:**
  - Si no resuelve al arrancar, escribir un upstream de reserva (`server 127.0.0.1:9 down;` o similar, que devuelve 502) y dejar que el bucle lo corrija.
  - Vigilar el subproceso de re-resolución: si muere, que `/healthz` falle.
  - Monitorear `/healthz/deep` desde fuera (A2).

### M6 · Una sola instancia y despliegues que cortan: SSE, ventanas de 502 y ~50 s sin base al cambiar el plan
- **Evidencia:**
  - `numInstances: 1` en la web y en la API.
  - Logs de la web del 2026-10-08 03:57:18-03:57:44: `connect() failed (111: Connection refused)` y luego timeouts sobre `/api/auth/login`, `/api/terminals/register` y `/api/health` durante un reemplazo de la API (~25 s).
  - Cada despliegue de la API corta todos los SSE («upstream prematurely closed», varios días).
  - El cambio de plan de la base del 10-oct provocó ~50 s de base caída.
  - Las conexiones SSE abiertas retrasan el cierre ordenado hasta `maxShutdownDelaySeconds: 60` (`render.yaml:40`), porque `app.close()` espera a que se cierren las conexiones.
- **Escenario de falla:** se despliega o cambia el plan en horario de tienda y las cajas ven errores o «sin conexión» durante decenas de segundos. Con A1 sin arreglar, un cobro en ese momento falla con 500.
- **Impacto:** fricción en caja y ventas reintentadas. Es aceptable en un piloto si se despliega fuera de horario.
- **Arreglo:**
  - Ventana de cambios fuera de horario (A4).
  - Al recibir SIGTERM, cerrar activamente los SSE con `event: reconnect` para que el corte sea rápido.
  - Valorar `numInstances: 2` en la API sólo si el costo lo justifica.
  - Los cambios de plan de la base, siempre después del cierre.

### M7 · La PWA se actualiza sola y recarga la página, y las cajas viejas pueden quedarse con código viejo
- **Evidencia:** `apps/web/vite.config.ts:39` tiene `registerType: "autoUpdate"` y `apps/web/src/main.tsx:9` llama `registerSW({ immediate: true })`. Con `autoUpdate`, vite-plugin-pwa activa el nuevo service worker y **recarga la página** sin preguntar. No se configura una comprobación periódica de actualizaciones.
- **Escenario de falla:**
  - (a) Justo después de un despliegue de la web, la cajera abre o recarga la app, empieza a escanear, y a los pocos segundos el SW nuevo toma el control y recarga. No se verificó si el carrito se conserva.
  - (b) Una pestaña de caja que pasa todo el día abierta nunca se actualiza, así que la API debe aceptar la web N-1 (y su cola offline) durante días.
- **Impacto:** carritos perdidos o dobles escaneos. El requisito de compatibilidad hacia atrás de la API no está documentado.
- **Arreglo:**
  - Cambiar a `registerType: "prompt"`, con un aviso «Hay una versión nueva: actualizar al terminar la venta», o bien aplicar la actualización sólo cuando el carrito esté vacío.
  - Documentar que la API debe aceptar la versión anterior de la web y de la cola offline durante al menos 7 días.

### M8 · El disco crece sin alerta ni purga (adjuntos en `bytea`, eventos y auditoría)
- **Evidencia:**
  - `storageAutoscalingEnabled: false` con 5 GB.
  - `InvoiceAttachment.data Bytes` (`schema.prisma:663-670`): los adjuntos de borradores **confirmados** no se borran nunca. Sólo se purgan los no confirmados de más de 7 días (`apps/api/src/merchandise.ts:242-262`). Con la lectura IA activada, cada foto o PDF puede pesar hasta 5 MB.
  - `RealtimeEvent` recibe una fila por cada cambio de stock (trigger `fitstore_stock_event`) y **nunca se purga**: no hay `deleteMany` ni `DELETE` en la API.
  - `AuditLog` tampoco tiene retención.
  - El WAL también ocupa disco local mientras se archiva.
- **Escenario de falla:** con IA activada, unas 1 000 facturas de proveedor con foto ocupan entre 1 y 5 GB. Al llenarse el disco PostgreSQL deja de aceptar escrituras o se detiene, todas las ventas fallan, y además el dump diario crece y tarda más.
- **Impacto:** caída total y difícil de diagnosticar sin alertas (A2). Más costo de disco y de respaldo.
- **Arreglo:**
  - Alerta de uso de disco al 70 % y al 85 %, mediante la notificación de Render o una consulta periódica a `pg_database_size`.
  - Purga programada de `RealtimeEvent` de más de 7 días.
  - Retención o archivo de adjuntos: moverlos a almacenamiento de objetos, o comprimir y limitar las fotos a 1 MB en el cliente.
  - Valorar activar el autoescalado de disco con un tope de costo.

### M9 · Un endpoint superó el timeout de 60 s y la alerta diaria recorre todo el catálogo en memoria
- **Evidencia:**
  - Logs de la web del 2026-10-08 02:27:50: 4 peticiones simultáneas a `GET /api/alerts?status=new` terminaron en «upstream timed out (110)», es decir, más de 60 s (`nginx.conf.template:118`). Ocurrió con el plan de 0,5 CPU.
  - `AlertEngine.evaluate` (`apps/api/src/alerts.ts:60-70`) carga todas las variantes con sus lotes y hace un `GROUP BY` sobre `SaleItem`/`Sale` completos.
  - `RealtimeHub` consulta `RealtimeEvent` cada 150 ms mientras haya algún cliente SSE (`realtime.ts:75`), lo que da unas 6,7 consultas por segundo de forma permanente.
- **Escenario de falla:** con el catálogo real y meses de ventas, la evaluación de alertas o el listado tardan decenas de segundos, ocupan el pool (M4) y frenan los cobros. El problema real puede estar tapado ahora por el plan de 1 CPU.
- **Impacto:** lentitud intermitente en caja.
- **Arreglo:**
  - Perfilar `/api/alerts` con datos reales, paginarlo y mover la evaluación a una consulta agregada en SQL o a un horario nocturno.
  - Fijar un `statement_timeout` de rol (por ejemplo 30 s) para la API.
  - Medir el p95 con las métricas `http_latency` de Render.

### M10 · Cadena de suministro del CI: acciones fijadas por etiqueta y sin `permissions`
- **Evidencia:**
  - `.github/workflows/ci.yml:25-29, 64, 74-81` usa `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4` y `actions/upload-artifact@v4`, todas por etiqueta móvil y no por SHA.
  - No hay bloque `permissions:`, así que el `GITHUB_TOKEN` usa los permisos por defecto del repositorio, que pueden ser de escritura.
  - El workflow corre en cada `push` de cualquier rama y en `pull_request`.
  - Ejecuta `sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh` y la imagen de servicio `postgres:17` también es móvil.
- **Escenario de falla:** si se compromete la etiqueta de una acción de terceros (ha ocurrido con acciones populares), esa acción ejecuta código con el token del repo y puede empujar a `nexora-cloud`. El despliegue es manual, pero alguien desplegaría ese commit (A4).
- **Impacto:** se podría colar código malicioso en el POS que maneja dinero.
- **Arreglo:**
  - Fijar cada acción por SHA, con un comentario de la versión.
  - `permissions: contents: read` a nivel de workflow.
  - Activar Dependabot para las acciones.
  - Protección de rama (A4).

---

## BAJO

### L1 · Las imágenes base están fijadas por etiqueta, no por digest
- `Dockerfile.api:2,23`, `Dockerfile.web:2,24` y `backup/Dockerfile:2` usan `node:24.21.0-bookworm-slim` y `nginx:1.30.5-alpine3.24` por etiqueta. La versión es concreta, lo cual es bueno, pero una etiqueta puede reescribirse.
- Los `apt-get install` y `apk add` no fijan versión. El `Dockerfile` raíz usa `node:24-bookworm-slim` y `nginx:1.27-alpine`, ambos móviles (afecta sólo al Compose local y al instalador).
- **Escenario de falla:** una reconstrucción da una imagen distinta de la probada.
- **Arreglo:** fijar `@sha256:…` y dejar que Renovate o Dependabot actualicen el digest.

### L2 · El límite de subida de Nginx y el de multer chocan
- `nginx.conf.template:25` fija `client_max_body_size 5m` y `merchandise.ts:162` fija `fileSize: 5 MB`. Por la sobrecarga de multipart, un archivo de 4,9 a 5 MB recibe de Nginx un **413 en HTML**, y la web lo muestra como un error genérico.
- **Arreglo:** dejar Nginx en `6m`.

### L3 · El envoltorio `with-cloud-env.mjs` hace de PID 1
- `with-cloud-env.mjs:79-81`: si el kernel mata al hijo con SIGKILL (OOM), el código de salida queda como 130 («SIGINT»), lo que confunde el diagnóstico.
- El envoltorio añade un segundo proceso Node (~40-50 MB), algo irrelevante con 2 GB.
- No reenvía SIGHUP ni SIGQUIT y no reaprovecha procesos zombis. Hoy no hay subprocesos, porque Prisma 6 usa el motor como librería.
- El `HEALTHCHECK` de los Dockerfiles lo ignora Render, como ya está documentado.
- **Arreglo:** `process.exitCode = code ?? 128 + os.constants.signals[signal]`, o usar `tini` y `--env-file`.

### L4 · Costos: la API está sobredimensionada y hay gastos que conviene vigilar
- Uso real de la API: unos 110-170 MB y CPU casi nula, en un plan `1c-2g`. Precios orientativos (No verificado): Standard ~US$25/mes frente a Starter ~US$7/mes.
- Base `0.5c-1g` (~US$19/mes) más 5 GB de disco. Otros gastos que crecen con el uso:
  - minutos de build (`buildPlan: starter`, unos 15 builds de la API en 48 h);
  - el futuro cron y S3;
  - Sentry;
  - el workspace Pro, si se elige por los 7 días de PITR (B1).
- **Escenario de falla:** existe el evento `pipeline_minutes_exhausted`. Si se agotan los minutos de build, **no se puede desplegar un arreglo urgente**.
- **Arreglo:**
  - Dimensionar con una prueba de carga de 4 cajas más el reporte de cierre, y fijar un plan (por ejemplo `0.5c-1g`).
  - Revisar en el panel el consumo de minutos de build y la factura prevista.
  - Activar una alerta de gasto en Render.

### L5 · Documentación operativa desactualizada
- `docs/DEPLOY-RENDER.md:3` («no se ha creado ni desplegado ningún recurso»), líneas 268-273 (planes viejos) y 304-314 (base `0.1c-256mb`).
- No hay procedimiento para rotar `JWT_SECRET` ni la contraseña de la base, ni para una migración fallida (M1), ni para recuperar con PITR y repuntar `RENDER_DATABASE_URL` en el Blueprint.
- **Arreglo:** un `RUNBOOK.md` de una página por incidente.

### L6 · Los logs pueden contener datos personales
- El access log de Nginx registra la URL completa con su query string, por ejemplo búsquedas de clientes por nombre, teléfono o cédula si se pasan por la query (No verificado), además de las IPs de la cadena de Cloudflare.
- La base tiene `log_connections` activado (visible en los logs).
- **Arreglo:** un `log_format` sin `$args` para `/api/`, y fijar la retención de logs.

### L7 · La imagen de la API lleva el código fuente completo y las dependencias de desarrollo
- `Dockerfile.api:29` copia todo `/app` desde el build: `tsx`, el CLI de `prisma`, el TypeScript fuente y `node_modules` completo. Se necesitan para el preDeploy y las tareas puntuales, pero agrandan la imagen y la superficie de ataque.
- **Arreglo:** una etapa `runtime` que haga `pnpm deploy --prod` más una imagen o comando separado para las tareas.

### L8 · Sentry pierde los errores de arranque
- `apps/api/src/main.ts:63-66` llama `captureApiException(error, "startup")` y luego `process.exit(1)` sin `await Sentry.flush()`, así que los fallos de arranque (por ejemplo `WEB_ORIGIN` ausente o la base inaccesible) nunca llegan a Sentry.
- **Arreglo:** `await Sentry.flush(2000)` antes de salir.

### L9 · Reintentos y cadena de suministro de npm aceptables, con matices
- El lockfile está congelado (`--frozen-lockfile`) y `allowBuilds` en `pnpm-workspace.yaml` limita los scripts de instalación, lo cual está bien.
- Pero `@anthropic-ai/sdk ^0.131.0` y otras dependencias usan `^`: sólo el lockfile las fija.
- `embedded-postgres 18.4.0-beta.17` es una versión **beta** usada por el instalador local, del que depende la contingencia.
- `corepack` se usa en `Dockerfile.api:8-9`, y Node 25 o superior ya no lo incluye: atención al pasar a Node 25.
- **Arreglo:** documentar la política de actualización y fijar `embedded-postgres` a una versión estable cuando exista.

---

## Plan de contingencia (1 página, para imprimir junto a la caja)

**Objetivo:** seguir vendiendo y no perder ninguna venta si falla Render, internet o la luz.

**Antes del día malo (una sola vez):**
1. El dueño decide si `allowOfflineSales` va activado (Configuración › Negocio y reglas) y con qué tope por venta. Se prueba un corte de 15 min con 2 cajas (A5).
2. Cada caja tiene la PWA **instalada** y abierta al menos una vez después del último despliegue, para tener el catálogo y el código en caché.
3. Hay un **talonario de facturas manuales numeradas** y una hoja de control (hora, cajera, artículos, monto, forma de pago, cliente), guardados en la caja. Si aplica, se tiene la autorización de NCF de contingencia de la DGII (validar con el contador).
4. Hay una laptop «de reserva» con el **instalador local** de Nexora y la **última copia** restaurada (`scripts/restore.mjs`, B1), actualizada como mínimo cada semana. Permanece apagada y sin uso.
5. Un monitor externo avisa al dueño y al técnico en 1-2 minutos (A2). Los teléfonos de soporte (técnico, proveedor de internet, Render status: `status.render.com`) están escritos en esta hoja.
6. El router tiene un respaldo de datos móviles (hotspot del celular o un segundo proveedor).

**Durante la caída. Primero, diagnosticar en 2 minutos:**

| Síntoma | Probable causa | Acción |
|---|---|---|
| Ninguna página abre en ningún equipo; el celular con datos móviles sí abre `nexora-pos-web.onrender.com` | Internet de la tienda | Pasar las cajas al hotspot del celular. Si no hay, **modo sin conexión** (si está activado) o talonario. |
| Ni el celular con datos abre la web, o `/api/health` da 503 | Render, la API o la base | Mirar `status.render.com` y avisar al técnico. Cajas con sesión abierta: **modo sin conexión**. Si no: talonario. |
| Abre, pero cobrar da «No se pudo completar» repetido | La base está caída (A1 todavía sin corregir) | No reintentar en bucle. Usar el talonario y anotar. |
| Se fue la luz | — | El talonario. Las laptops con batería pueden seguir en modo sin conexión si hay internet o hotspot. |

**Escalada por duración:**
- **Menos de 30 min:** modo sin conexión o talonario. No reiniciar equipos ni cerrar sesión, porque se pierde la entrada offline.
- **De 30 min a 4 h:** seguir igual. El técnico revisa Render: eventos del servicio, últimos deploys y estado de la base. Si un despliegue reciente es la causa, se hace **rollback** desde el panel (*Rollback* al deploy anterior; la migración no se revierte).
- **Más de 4 h, o Render caído en toda la región:** el técnico decide activar el **modo isla**. Enciende la laptop de reserva con la última copia y las cajas apuntan a ella en la red local. Todo lo que se venda ahí se **reingresa después** en la nube, porque no hay sincronización automática entre bases: hacerlo con una lista y una persona responsable.
- **Pérdida de datos en la nube:** PITR de Render a una base **nueva**, verificar y repuntar `RENDER_DATABASE_URL` (`DEPLOY-RENDER.md:316-361`). Si pasaron más de 3 días, restaurar la última copia externa (B1).

**Al volver la conexión:**
1. Abrir cada caja con su usuario. Las ventas pendientes se sincronizan solas (por `offlineUuid`, sin duplicar). Revisar «Pendientes / En conflicto» y resolver los conflictos de precio.
2. Pasar las ventas del **talonario** al sistema, una por una, marcando cada hoja como «registrada» con su número de factura del sistema.
3. Hacer cuadre de caja e inventario de los artículos vendidos durante el corte.
4. El técnico escribe un informe breve: causa, duración y ventas afectadas.

---

## No verificado

- Si los servicios están gestionados por un **Blueprint con Auto Sync activo** (afecta a la gravedad de A3).
- El valor de `allowOfflineSales` y `sessionTimeoutMinutes` en producción, y si el carrito sobrevive a la recarga automática del SW (A5, M7).
- Las variables de entorno reales de la API: si existen `SENTRY_DSN` y `TELEGRAM_*`, si quedaron variables temporales `ADMIN_*` o `PASSWORD_CHANGE_*` sin retirar, y si hay `ANTHROPIC_API_KEY` (la herramienta no las muestra).
- El uso real del disco de la base, el tamaño de `InvoiceAttachment`, `RealtimeEvent` y `AuditLog`, el `max_connections` del plan `0.5c-1g`, y si los índices `Variant_*_ci_key` e `Incentive*_key` existen en producción (requeriría SQL en producción; no se ejecutó).
- El plan del workspace (Hobby, según la documentación) y por tanto la ventana real de PITR, la retención de logs y los minutos de build disponibles.
- Los precios exactos de los planes y la factura mensual.
- Las reglas de protección de la rama `nexora-cloud` en GitHub y los permisos por defecto del `GITHUB_TOKEN`.
- Si `docs/PRUEBA_RESTAURACION.md` (rama `claude/restore-evidence`) se repitió con PostgreSQL 17 o con un dump de producción.
- El comportamiento de la PWA y la sesión offline en un corte real con impresora y lector (sólo se revisó el código).
- La causa concreta de los errores del 2026-10-08 03:57 UTC (reemplazo de la API) y de los timeouts de `/api/alerts` a las 02:27 UTC.
- Si `prisma.config.ts` (`apps/api/prisma.config.ts`) carga `../../.env` en algún contexto de producción. En el preDeploy no aplica: la ruta no existe en la imagen y Prisma informa que omite la carga de variables.
