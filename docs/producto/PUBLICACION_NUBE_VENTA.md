# Publicar la nube de venta (producto)

Runbook de publicación del producto (`render.producto.yaml`: `nexora-saas-api`,
`nexora-saas-web`, `nexora-saas-db`). Viene del ensayo de migraciones del 19-nov-2026
(`docs/coordinacion/ENSAYO_MIGRACIONES_PRODUCTO_19NOV.md` en la rama
`claude/ensayo-migraciones-19nov`; hallazgos H1–H7). Nunca aplica a la tienda
(`nexora-pos-api`).

Hacerlo fuera de horario y con los 3 CI en verde (`verify`, `windows-installer`,
`render-images`) sobre el commit a publicar.

## Qué hace solo el preDeploy

`preDeployCommand: node deploy/render/producto-predeploy.mjs` corre tres pasos y se
detiene al primer fallo (la API vieja sigue atendiendo):

0. **Chequeo previo** (`deploy/render/producto-precheck.mjs`), en una transacción
   `READ ONLY` con `lock_timeout` 5 s y `statement_timeout` 30 s. No cambia nada.
   **Detiene el despliegue** (sale con 1, mensaje `Chequeo previo, NO SE PUBLICA: …`
   en _Events_, con qué falló y qué hacer) si:
   - hay migraciones fallidas sin resolver en `_prisma_migrations` (P3009);
   - falta `202611190001_branches` y algún `branchId` de `Settings`/`User`/
     `Terminal`/`Warehouse` mide más de 80 caracteres (H2: la migración fallaría
     entera por `Branch_name_check`);
   - falta un índice único por empresa de incentivos
     (`IncentiveRate`/`IncentivePeriodClose`/`IncentiveSettlement`) y hay grupos
     repetidos por `tenantId` que impedirían crearlo (H1: la migración solo avisa y
     queda aplicada sin el índice);
   - faltan `202611100001/2` (corrección de costo) y la base tiene alguna de las
     líneas de venta de la tienda que corrigen (H4);
   - la base tiene tablas pero no `_prisma_migrations` (no es la base del producto).

   Solo **avisa** (`Chequeo previo, AVISO: …`) si la base es nueva (sin tablas), o si
   la migración de incentivos ya está aplicada pero falta su índice. Imprime cuántas
   migraciones hay aplicadas y pendientes, la última y cuántas empresas hay.

1. Rol RLS (`scripts/producto-bootstrap.sql`, idempotente).
2. `prisma migrate deploy` con `lock_timeout` 5 s y `statement_timeout` 120 s
   (`with-cloud-env.mjs`).

Lo cubren `tests/producto-precheck-postgres.test.ts` (base nueva, estado en vivo
`d3acef4f` con datos, `branchId` de 81, P3009 con su recuperación, incentivos
repetidos) y el humo `scripts/producto-ci-smoke.sh` del CI `render-images`.

## Pasos

1. **Respaldo** reciente de `nexora-saas-db` (Render › _Recovery_ / respaldo manual)
   y anotar la hora.
2. **Primero la API** (`nexora-saas-api`, _Manual Deploy_ del commit aprobado).
   En _Events/Logs_ buscar:
   - `Chequeo previo: correcto (solo lectura, sin cambios).` y la línea
     `Migraciones aplicadas: …; pendientes: N` con el número esperado;
   - `Script executed successfully.` (bootstrap);
   - una línea `Applying migration …` por cada pendiente y
     `All migrations have been successfully applied.`. Tarda segundos.

   Si sale `Chequeo previo, NO SE PUBLICA`, no se tocó la base: seguir lo que dice el
   mensaje y volver a desplegar. Cuando la API nueva esté sana, `/api/health/ready`
   debe dar 200; luego `node deploy/render/post-deploy-check.mjs`, si se usa.

3. **Después la web** (`nexora-saas-web`): `/healthz` (204), `/healthz/deep` (200) y
   que cargue la PWA.
4. **Humo con una empresa piloto real**: login, `/api/tenant/status`, ver productos; abrir
   y cerrar caja **solo si la dueña lo autoriza**; no vender en una empresa real. En el
   _Shell_ de `nexora-saas-api`, `migrate status` debe decir «Database schema is up to
   date».
5. **Primeras horas**: errores 5xx en la API, ventas y cierres de caja, y que una
   segunda empresa ya pueda cerrar incentivos de un mes (H1).

El chequeo también se puede correr a mano, sin cambiar nada, desde el _Shell_ de
`nexora-saas-api`:
`cd /app && node deploy/render/with-cloud-env.mjs node deploy/render/producto-precheck.mjs`
(solo si la imagen en vivo ya lo trae; si no, basta con desplegar: es el paso 0).

## Si falla el preDeploy (P3009/P3018)

La API vieja sigue atendiendo; no hay nada urgente. Desde el _Shell_ de
**`nexora-saas-api`** (detalle en `docs/MIGRACIONES_SEGURAS.md`):

1. `node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate status --schema apps/api/prisma/schema.prisma`
   y leer el error en _Events_. Con `lock timeout` o `statement timeout`, reintentar
   fuera de horario. Con `Branch_name_check`, corregir antes la fila con la dueña (H2).
2. Comprobar que la migración fallida no dejó nada (son atómicas; en `branches`, que no
   exista la tabla `Branch`). Luego
   `… migrate resolve --rolled-back <nombre> --schema apps/api/prisma/schema.prisma`.
3. Volver a desplegar la API. Solo corren las que faltan; repetir es seguro.
4. No usar `--applied` salvo que se haya comprobado a mano que quedó completa.

## Cómo volver atrás

- **API**: _Rollback_ en Render a la imagen anterior. Las migraciones del 19-nov son
  aditivas y la API de `d3acef4f` funciona sobre la base migrada (ensayo: login, venta,
  estado, incentivos y alta). **No hay que revertir la base.**
- **Web**: _Rollback_ a su despliegue anterior; no depende de la base.
- **Base**: restaurar el respaldo del paso 1 **solo** si se corrompieron datos. Se
  perdería lo vendido desde entonces: decisión de la dueña.
