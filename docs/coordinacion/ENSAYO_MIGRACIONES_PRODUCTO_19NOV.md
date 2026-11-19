# Ensayo de migraciones del producto (nube de venta), 19-nov-2026

Punto 2 del plan de venta. Se ensayaron las migraciones del candidato sobre una base que
imita la de la nube de venta antes de publicar. **Todo fue local**: un PostgreSQL desechable
(puerto 55433, ya borrado), sin Render y sin producción. No se tocaron `producto-nexora`
ni `nexora-cloud`.

|                                        | Commit                                                 | Migraciones                                  |
| -------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| En vivo (Render `nexora-saas-api/web`) | `d3acef4f`                                             | 81, la última `202611050001_change_requests` |
| Candidato                              | `origin/dot/ci-producto-19nov` (`8f5205a8`…`69ea2f35`) | 99, o sea **18 nuevas**                      |

`origin/claude/producto-candidato-19nov` (`04fbc26a`) tiene las mismas migraciones,
`deploy/render`, bootstrap y `render.producto.yaml` que `dot/ci-producto-19nov`, así que
el ensayo vale también para ese candidato. Entre `8f5205a8` y `69ea2f35` no cambió nada
en `apps/api/prisma` ni en `deploy`.

## Veredicto

**Se puede publicar.** Ninguna migración falló. Los datos quedaron idénticos tabla por tabla
y empresa por empresa. La RLS separa bien a las empresas en las 10 tablas nuevas. La API
candidata funciona en modo producto. Si una migración falla a mitad, el preDeploy se detiene
y se recupera con el runbook P3009. Hay que correr antes el **chequeo previo** (§ Runbook,
paso 1).

## Resumen de hallazgos

| #   | Severidad                                       | Hallazgo                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | **Alta (hoy en vivo; la arregla el candidato)** | En `d3acef4f` el cierre de incentivos tiene un índice único **global** (`branchId, period`). Solo la **primera** empresa puede cerrar un mes. Las demás reciben `409 «Ya existe un registro con esos datos.»`. Se reprodujo con la API en vivo: salon-prueba cerró 2026-10, y colmado-pagando y boutique-suspendida recibieron 409. Con la migración `202611190002` el índice pasa a ser por empresa, y la misma API vieja ya cierra 2026-10 en la segunda empresa (201). |
| H2  | Baja                                            | `202611190001_branches` **falla entera** si algún `branchId` de `Settings/User/Terminal/Warehouse` mide más de 80 caracteres (`Branch_name_check`). Se probó con una fila de 81 caracteres: P3018 y nada aplicado (la migración es atómica). La API en vivo no deja escribir `branchId`, así que es improbable. El chequeo previo lo cuenta.                                                                                                                              |
| H3  | Baja                                            | `Branch` solo registra las sucursales que aparecen en `Tenant/Settings/User/Terminal/Warehouse`. Si un `branchId` existiera solo en `Sale`, `CashSession`, etc., quedaría sin fila en `Branch`. En el ensayo se revisaron **todas** las tablas con `branchId` y no faltó ninguna.                                                                                                                                                                                         |
| H4  | Baja                                            | `202611100001/2` (corrección de costo) apuntan a **35 `SaleItem.id` fijos de la tienda**. En el producto no existen: 0 filas tocadas, 0 `AuditLog sale_item_cost_backfill`, y la línea vendida a costo 0 en colmado-pagando no cambió. Solo actuarían si algún día se importaran a la nube datos de la tienda con los mismos UUID. El chequeo previo lo confirma con la base real.                                                                                        |
| H5  | Baja (docs)                                     | En `docs/MIGRACIONES_SEGURAS.md` el runbook P3009 nombra el servicio de la tienda (`nexora-pos-api`). Para el producto es **`nexora-saas-api`** (pserv). Además, `branches` e `igualar_tenant` no bajan `lock_timeout` a 3 s o menos como pide esa guía para migraciones nuevas, e `igualar_tenant` es un solo `DO` con varios objetos. No es dañino aquí (tablas vacías o pequeñas): duraron 16 ms y 47 ms.                                                              |
| H6  | Info                                            | 14 de las 18 migraciones tienen nombre **anterior** a la última aplicada (las `2026102609…`, `20261031…` y siguientes). `prisma migrate deploy` las aplica igual, en orden de nombre. Comprobado.                                                                                                                                                                                                                                                                         |
| H7  | Info                                            | Si el preDeploy falla a mitad, las migraciones anteriores al fallo **quedan aplicadas**. En ese estado intermedio las tablas GV/IA/baja existen sin `tenantId`/RLS, pero el rol `nexora_tenant_runtime` **no tiene permisos** sobre ellas (comprobado), así que no hay exposición. La API vieja no las usa.                                                                                                                                                               |

Ninguna migración altera datos de las empresas. No hay ninguna fila que reportar para
corregir en producto.

## Cómo se hizo

Los scripts quedaron en el scratchpad de la sesión (`ensayo/`) y no van en el repo.

### Paso 1: base «como la real»

- PostgreSQL 16.15 local (Render usa 17; ver Riesgos) con el dueño **sin superusuario**, como
  en Render: `CREATE ROLE nexora_saas_migrator LOGIN CREATEROLE` y
  `CREATE DATABASE nexora_saas OWNER nexora_saas_migrator`.
- Árbol de `d3acef4f` extraído con `git archive`. Se corrió **su**
  `node deploy/render/producto-predeploy.mjs`:
  `scripts/producto-bootstrap.sql` (crea `nexora_tenant_runtime NOLOGIN` y le da SET al
  migrador) y luego `prisma migrate deploy`. Salida 0, 81 migraciones, unos 4 s.
- Resultado: 70 tablas, 69 con RLS. Índices únicos de incentivos globales, sin `tenantId`.

### Paso 2: siembra multiempresa con la API en vivo

La siembra se hizo con la **API de `d3acef4f`** compilada y en marcha (`NODE_ENV=production`,
`PRODUCT_TENANCY=required`, registro público cerrado). Así los triggers, la RLS y las reglas
de caja son los reales.

| Empresa                                     | Estado                              | Cómo                                                             |
| ------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `salon-prueba` (Salón Ñoña & Compañía)      | prueba (trial, básico)              | invitación del operador, aceptada                                |
| `colmado-pagando` (Colmado Doña Inés)       | pagando (`active` hasta 2027-01-19) | cobro del operador RD$2,000 por transferencia                    |
| `boutique-suspendida` (Boutique José María) | suspendida                          | trial y pago vencidos hace 8 días (como el trabajador de cobros) |

Cada empresa tiene:

- admin y cajera;
- 3 productos y 4 variantes con acentos y comillas «»;
- existencias de 40 por variante;
- un cliente;
- una caja **cerrada** con 6 ventas: efectivo, tarjeta (con lote del verifón), transferencia,
  crédito (`cod` + `receivableKind=credit`), 10 % de descuento con PIN de gerente, y un pago
  mixto efectivo + tarjeta;
- una caja **abierta** con una venta;
- una tasa de incentivo e intento de cierre de 2026-10 (ver H1).

Filas «sucias» añadidas con SQL, con el rol runtime y `app.tenant_id` de cada empresa:

- salon-prueba: 2 lotes (uno sin vencimiento) con su `LotStock`; un proveedor
  «Peña & Hijos, S.R.L.» con perfil de importación jsonb con acentos y un valor `null`; un
  `InvoiceAttachment` PDF sin `objectKey`; bitácora con `before` nulo.
- colmado-pagando: una vendedora, un almacén y unos ajustes en `sucursal-norte`; un **cierre
  de incentivos 2026-10 en `sucursal-norte`** (el índice viejo lo permite porque la sucursal
  es distinta); una `SaleItem` a costo 0.
- boutique-suspendida: una terminal heredada en `' Sucursal Sur '` (con espacios); bitácora
  con `after` nulo.

La huella de control (`snapshot.sh`) guarda, por cada tabla y empresa, el conteo y el md5 de
todas las filas, tomados sobre las columnas de la línea base para que las columnas nuevas no
cambien la huella. También guarda sumas de dinero y existencias:

| Por empresa       | Valor                                                 |
| ----------------- | ----------------------------------------------------- |
| `Sale`            | 7 · total 5,846.00 · costo 3,800.00 · descuento 24.00 |
| `Payment`         | card 920 · cash 2,066 · cod 2,500 · transfer 360      |
| `CashSession`     | 2 (1 abierta) · fondos 3,416                          |
| `VariantStock`    | 148 unidades                                          |
| `PlatformPayment` | 1 (colmado) · 2,000.00                                |

### Paso 3: migraciones del candidato, igual que el preDeploy

Se corrió `node deploy/render/producto-predeploy.mjs` del árbol del candidato con la API vieja
**conectada y en marcha**, como pasa en Render. `with-cloud-env.mjs` reconoce `migrate deploy`
y añade `-c lock_timeout=5s -c statement_timeout=120s`. El fallo inducido del paso 6 confirmó
que esos límites se aplican: canceló a los 5 s.

- **Total: 2.85 s** (bootstrap + 18 migraciones). Salida 0.

| Migración                              | ms  | Migración                             | ms  |
| -------------------------------------- | --- | ------------------------------------- | --- |
| 202610260901_gv                        | 26  | 202611060001_gv_gerente_rol           | 2   |
| 202610260902_gv_citas                  | 17  | 202611070001_ai_usage                 | 5   |
| 202610260903_gv_auditoria              | 6   | 202611090001_baja_cliente             | 4   |
| 202610310002_gv_pago_completo          | 4   | 202611100001_corrige_costo_maquillaje | 6   |
| 202610310003_gv_destino_tarjeta        | 3   | 202611100002_corrige_costo_prd001     | 8   |
| 202610310004_gv_pago_moneda            | 4   | 202611190001_branches                 | 16  |
| 202611010001_gv_pago_usd_solo_efectivo | 4   | 202611190002_incentive_unique_tenant  | 16  |
| 202611040001_gv_caja                   | 9   | 202611190101_pc23_payment_prev_plan   | 2   |
| 202611050001_gv_comprobantes           | 7   | 202611200001_producto_igualar_tenant  | 47  |

- Con tráfico de caja simultáneo (una venta cada 200 ms en colmado con la API vieja), ninguna
  venta se bloqueó ni falló por la migración. La máxima tardó 345 ms. Los únicos 400 fueron
  «Stock insuficiente», propios de la carga.

### Paso 4: verificaciones

| Verificación                                                                | Resultado                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ninguna migración falla                                                     | OK (18/18)                                                                                                                                                                                                                                                                                                                                                           |
| Conteos y md5 por tabla y empresa                                           | **Idénticos** en las 70 tablas × 4 empresas. La única diferencia fue en `Alert`: 1 aviso `credit_reminder` que el trabajador de la API vieja creó a las 15:38:33, antes de que empezara la migración (15:39:00).                                                                                                                                                     |
| Sumas de control (ventas, pagos, cajas, costos, existencias, lotes, cobros) | Idénticas                                                                                                                                                                                                                                                                                                                                                            |
| RLS                                                                         | **79 de 80 tablas** con RLS (solo `_prisma_migrations` no tiene). Ninguna tabla con `tenantId` queda sin RLS o sin política `tenant_isolation`.                                                                                                                                                                                                                      |
| Tablas GV/IA/baja (9) + `Branch`                                            | Todas tienen `tenantId NOT NULL`, FK a `Tenant`, RLS, política para `nexora_tenant_runtime`, permisos y trigger `nexora_assign_tenant` (salvo `Branch`, que exige `tenantId` explícito). La guardia de FK entre empresas está en GvEnrollment(1), GvPayment(3) y GvProof(2). Los únicos GV y la PK de `BranchTermination` incluyen `tenantId`.                       |
| Aislamiento A/B (rol runtime)                                               | A inserta en GvCourse/GvLead/GvCashSession/AiUsage/BranchTermination/Settings → **B ve 0**. B no puede escribir con el `tenantId` de A (`violates row-level security policy` en GvLead y Branch). El UPDATE de B sobre filas de A afecta 0. B abre su propia caja GV aunque A tenga una abierta (el único es por empresa). Sin empresa en la sesión se ve 0 de todo. |
| `Branch`                                                                    | `main` («Principal») para las 4 empresas (incluida demo), más `sucursal-norte` (colmado) y `' Sucursal Sur '` (boutique), heredadas. El trigger `Settings → Branch` registró `sucursal-este` con el rol runtime.                                                                                                                                                     |
| Incentivos                                                                  | Se crearon `…_tenantId_branchId_…_key` en IncentiveRate, PeriodClose y Settlement. Los viejos se borraron. Filas: 2 = 2, ninguna perdida.                                                                                                                                                                                                                            |
| `prevPlan`                                                                  | `text`, nullable, sin default. El cobro viejo queda en `NULL`.                                                                                                                                                                                                                                                                                                       |
| Corrección de costo                                                         | 0 de 35 ids presentes. 0 bitácoras de backfill. La línea a costo 0 de colmado no cambió. **No toca costos de empresas del producto.**                                                                                                                                                                                                                                |
| `igualar_tenant`                                                            | No queda ninguna tabla GV sin `tenantId`/RLS (ver la fila de tablas GV).                                                                                                                                                                                                                                                                                             |
| Deriva de esquema                                                           | `prisma migrate diff --from-url <base> --to-schema-datamodel schema.prisma` devuelve **«empty migration»**: la base migrada coincide exactamente con el `schema.prisma` del candidato.                                                                                                                                                                               |

### Paso 5: API candidata en modo producto sobre la base migrada

Arrancada como en la imagen (`with-cloud-env.mjs apps/api/dist/main.js`,
`PRODUCT_TENANCY=required`). Lista en unos 3 s.

| Prueba                               | salon (trial)                       | colmado (pagando)                                                                   | boutique (suspendida)                       |
| ------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `/api/health/ready` y `/api/health`  | 200 `ok`                            |                                                                                     |                                             |
| Login admin (`x-tenant-id`)          | 201, tenant correcto                | 201                                                                                 | 201                                         |
| `/api/tenant/status`                 | `trial`                             | `active`                                                                            | `suspended`                                 |
| Venta de prueba                      | 201 `completed`                     | 201                                                                                 | 403 «Plan suspendido…» (correcto)           |
| `GET /api/tenant/export?format=json` | 200                                 | 200: 79 tablas, 176 filas, **0 ajenas**, incluye `Branch` y las GV, `faltantes: []` | 200 (la suspendida conserva la exportación) |
| Cierre de caja                       | 201                                 | 201                                                                                 | 403 (correcto)                              |
| `GET /api/branches`                  | 1                                   | 2 (main, sucursal-norte)                                                            | 2                                           |
| Cierre de incentivos 2026-10         | 409 «ya está cerrado» (ya lo cerró) | 409 (ya lo cerró la API vieja tras migrar)                                          | 403                                         |

Además:

- **Alta nueva** por el operador (`ferreteria-nueva`): 201. La invitación se aceptó (201) y
  la empresa queda con su sucursal `main` gracias al trigger.
- **Cobro a la empresa en prueba**: 201 y queda `active`. La **anulación** devuelve `trial`
  con `paidUntil: null` y `prevPlan: basico` guardado.
- **Ventana de despliegue (la API vieja sobre la base ya migrada)**: login, estado, venta,
  productos, cierre de incentivos y **alta por invitación** funcionan. Volver a la imagen
  anterior no exige tocar la base.

### Paso 6: fallo inducido e idempotencia

Se restauró la base sembrada y se tomó un `LOCK TABLE "Tenant" IN ROW EXCLUSIVE MODE`
durante 40 s, como una transacción larga del trabajador de cobros. Mientras tanto corrió el
preDeploy del candidato.

1. Se aplicaron las 14 primeras. `202611190001_branches` falló a los **5 s** con
   `55P03 canceling statement due to lock timeout` (P3018). **El preDeploy salió con 1 y no
   siguió.**
2. Fue atómico: `Branch`, la función y el trigger **no existen**. `_prisma_migrations` marca
   `branches` como fallida.
3. La API vieja siguió atendiendo: login, venta (201), estado y la suspendida en 403. Con la
   carga simultánea hubo 38 ventas OK, máximo 320 ms, sin bloqueos.
4. Un nuevo preDeploy sin resolver da `P3009` y sale con 1 (bloquea despliegues, como dice la
   guía).
5. Runbook: `migrate status`, luego `migrate resolve --rolled-back 202611190001_branches`,
   luego preDeploy: aplica las 4 restantes en **2.6 s**, salida 0.
6. Otro preDeploy: «No pending migrations to apply», salida 0. **Es idempotente.**
7. Estado final, comparado con la corrida limpia: la salida de las verificaciones es
   idéntica y la deriva es «empty migration». Las únicas diferencias de datos son las de las
   llamadas del paso 3 (logins y una venta por empresa).

Variante con una fila que rompe (H2): una terminal con `branchId` de 81 caracteres. `branches`
falla con `Branch_name_check` y sin aplicar nada. La recuperación es la misma, después de
corregir la fila con la dueña.

## Riesgos y lo que no se comprobó

- **PostgreSQL 16 local frente a 17 en Render.** Las sentencias usadas no cambian entre
  versiones. El CI `render-images` ya prueba con 17.11 y SSL.
- **Node 22 local frente a 24 en la imagen.**
- **SSL y `RENDER_DATABASE_URL`**: localmente se usó `DATABASE_URL` sin SSL. La rama de
  `with-cloud-env.mjs` para Render (`sslmode=require`, `TimeZone=UTC`) no se ejecutó aquí; la
  cubre `scripts/producto-ci-smoke.sh`.
- **Volumen**: la base del ensayo es pequeña (unas 180 filas por empresa). La de venta es
  nueva y también pequeña, pero hay que mirar en el chequeo previo cuántas empresas tiene.
  Las migraciones caras (índices únicos de incentivos y FK a `Tenant`) escalan con esas
  tablas.
- **La web** (`nexora-saas-web`, cambió `nginx.conf.template`) no se ensayó. Solo se probó la
  API.
- **La base real no se miró** (no hay acceso, ni debe haberlo). Por eso hace falta el paso 1
  del runbook.

## Runbook de publicación (nube de venta)

Hacerlo fuera de horario y con los 3 CI en verde (`verify`, `windows-installer`,
`render-images`) sobre el commit a publicar.

1. **Chequeo previo (solo lectura)** en el _Shell_ de `nexora-saas-api`, con la imagen que
   está en vivo. Crear `/tmp/precheck.cjs` con el contenido de abajo y correr
   `cd /app && node deploy/render/with-cloud-env.mjs node /tmp/precheck.cjs`. Debe dar
   `filasCostoPresentes: 0`, `sucursalesMas80: 0`, `cierresIncentivoRepetidos: 0`,
   `migracionesFallidas: []` y `ultimaAplicada: 202611050001_change_requests`. Si algo no da,
   **no publicar** y avisar.

   <details><summary>precheck.cjs</summary>

   ```js
   // Solo lectura. Correr en el Shell de nexora-saas-api ANTES de publicar:
   //   cd /app && node deploy/render/with-cloud-env.mjs node /tmp/precheck.cjs
   const {
     PrismaClient,
   } = require("/app/apps/api/node_modules/@prisma/client");
   const db = new PrismaClient();
   // 35 SaleItem.id de la tienda que tocan 202611100001/202611100002 (corrección de costo).
   const ids = [
     "0f12c3a8-25e3-495e-ad61-f31a2c9feb4a",
     "266e66c5-91f2-464f-b6c5-eb8fd60d8c0e",
     "269fd0ea-d769-4647-892f-d0ad70159919",
     "2b024186-816e-4525-88cd-7b3a1bb0cca9",
     "3b726368-8a7c-418e-80c9-7b724158e2a7",
     "44460ce0-55e8-45b6-97a4-caf192b4d972",
     "46a9a2ec-d1fc-416c-ba09-b4a6797ac45f",
     "4ca20672-3174-4109-a2b1-ee9ce86c621b",
     "5cba83d0-48be-42cf-b996-70b82d9ea45c",
     "6444012a-f787-49fb-9928-fada8c12420f",
     "70cb88cd-f45a-4449-8c8a-c689127dcc49",
     "7b110bce-e9fa-4776-b7c4-6fde21a2b3ed",
     "7ddba34d-81cb-4a4b-8d50-846cc106c5ec",
     "8218b34f-b2e4-40f9-9733-2f6b1f5787ce",
     "853c0e32-d2bb-4520-b8f0-ff8ac6e76145",
     "8cb859f2-c5f4-443e-8d1a-9c8ae6a2ed45",
     "a3423e02-08c4-45a9-9dd5-690c96959b79",
     "a4f48f21-132e-46ee-ad16-925fcf9ff733",
     "aa7be4e8-ac91-44d0-8c06-a9ee60780d84",
     "aaf55a78-a3b0-47ec-bcfe-8bd835a7862f",
     "b615c7ac-925b-41e5-aa13-d46ba080c308",
     "bc9044c0-7563-4775-946d-d876c4cf7441",
     "c36b0e81-739a-4dbb-81aa-62578f65840c",
     "c44721f6-a1ad-4a93-a3fa-6b30a06720a4",
     "c551d79a-82be-4032-9ed8-2a12ce4053e2",
     "c63afd15-f8ae-4f12-aa5f-ad9ac82f1f49",
     "cc286672-3328-49e6-8095-93da5c673c1b",
     "d0acef84-a610-43c6-b9aa-992c9243bd18",
     "d6ec5b58-23fe-4824-8302-49c51139fc3f",
     "dba90f1b-f616-4cb1-bcff-058c0137e178",
     "e28c14d2-b85b-4da7-a469-e435e10c122d",
     "e653a13b-6886-4ae6-845d-75eb293d5e6b",
     "ea262e89-4e86-4393-afee-4e75c7f6b96d",
     "f5156296-2081-4827-b9dd-85dcb7279106",
     "f5cbbedf-1d65-4664-afe5-2c02a9b6cb95",
   ];
   (async () => {
     const q = (sql, ...p) => db.$queryRawUnsafe(sql, ...p);
     const out = {
       idsCorreccionCosto: ids.length,
       filasCostoPresentes: (
         await q(
           `select count(*)::int n from "SaleItem" where id = any($1::uuid[])`,
           ids,
         )
       )[0].n,
       sucursalesMas80: (
         await q(
           `select count(*)::int n from (select "branchId" b from "User" union select id from "Settings" union select "branchId" from "Terminal" union select "branchId" from "Warehouse") x where char_length(btrim(b)) > 80`,
         )
       )[0].n,
       sucursalesDistintas: await q(
         `select b, count(*)::int n from (select "branchId" b from "User" union all select id from "Settings" union all select "branchId" from "Terminal" union all select "branchId" from "Warehouse") x group by b order by n desc limit 10`,
       ),
       cierresIncentivoRepetidos: (
         await q(
           `select count(*)::int n from (select 1 from "IncentivePeriodClose" group by "tenantId","branchId",period having count(*)>1) d`,
         )
       )[0].n,
       migracionesFallidas: await q(
         `select migration_name from _prisma_migrations where finished_at is null and rolled_back_at is null`,
       ),
       ultimaAplicada: (
         await q(
           `select max(migration_name) m from _prisma_migrations where finished_at is not null`,
         )
       )[0].m,
       empresas: (await q(`select count(*)::int n from "Tenant"`))[0].n,
     };
     console.log(JSON.stringify(out, null, 1));
     await db.$disconnect();
   })();
   ```

   Se probó sobre la base sembrada: todo en 0, 35 ids, última `202611050001_change_requests`.
   </details>

2. **Respaldo** reciente de `nexora-saas-db` (Render › Recovery / respaldo manual) y anotar la
   hora.
3. **Primero la API** (`nexora-saas-api`, _Manual Deploy_ del commit aprobado). Render corre
   el `preDeployCommand` (bootstrap + `migrate deploy`) con la API vieja todavía sirviendo.
   - En _Events/Logs_ del despliegue, buscar `Script executed successfully.` (bootstrap), las
     18 líneas `Applying migration …` y `All migrations have been successfully applied.`.
     Debería tardar segundos.
   - Cuando la nueva esté sana: `/api/health/ready` debe dar 200. Luego `node
deploy/render/post-deploy-check.mjs`, si se usa.
4. **Después la web** (`nexora-saas-web`). Comprobar `/healthz` (204), `/healthz/deep` (200) y
   que cargue la PWA.
5. **Humo con una empresa piloto real**: login, `/api/tenant/status`, ver productos y abrir y
   cerrar caja **solo si la dueña lo autoriza**; no vender en una empresa real. En el Shell,
   `migrate status` debe decir «Database schema is up to date».
6. **Qué mirar las primeras horas**: errores 5xx en la API, ventas y cierres de caja, y que una
   segunda empresa ya pueda cerrar incentivos de un mes (H1).

### Si falla el preDeploy (P3009/P3018)

La API vieja sigue atendiendo y no hay que hacer nada urgente. Desde el _Shell_ de
**`nexora-saas-api`**:

1. `node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate status --schema apps/api/prisma/schema.prisma`
   y leer el error en _Events_. Con `lock timeout` o `statement timeout` hay que reintentar
   fuera de horario. Con `Branch_name_check`, corregir antes la fila con la dueña (H2).
2. Comprobar que la migración fallida no dejó nada (las migraciones son atómicas; en
   `branches`, por ejemplo, que no exista la tabla `Branch`). Luego:
   `… migrate resolve --rolled-back <nombre> --schema apps/api/prisma/schema.prisma`.
3. Volver a desplegar la API. Las migraciones anteriores al fallo ya están aplicadas y solo
   corren las que faltan. Repetir es seguro (comprobado).
4. No usar `--applied` salvo que se haya comprobado a mano que quedó completa.

### Cómo volver atrás

- **API**: _Rollback_ en Render a la imagen de `d3acef4f`. Las 18 migraciones son aditivas y
  la API vieja funciona sobre la base migrada (comprobado: login, venta, estado, incentivos y
  alta). **No hay que revertir la base.**
- **Web**: _Rollback_ a su despliegue anterior. Es independiente de la base.
- **Base**: restaurar el respaldo del paso 2 **solo** si se corrompieron datos. Se perdería
  todo lo vendido desde ese momento, así que es decisión de la dueña.
