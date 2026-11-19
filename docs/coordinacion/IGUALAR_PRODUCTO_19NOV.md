# Igualar producto con nexora-cloud (19-nov-2026)

Rama: `claude/producto-igualado-19nov` (desde `origin/producto-nexora` 50563e46,
mezcla de `origin/claude/publicar-lote-19nov` 5a63325d = nexora-cloud 8014355b +
GV aparte + mover efectivo + lote A). No se tocó `nexora-cloud` ni
`producto-nexora`; no se desplegó ni se llamó a producción.

## Medida

- `merge-base`: 97d73f03 (25-oct). Producto: 443 commits propios; lote: 1,046.
- Mezcla de prueba: 55 archivos en conflicto (≈270 bloques), 10 de ellos «añadidos
  en los dos lados» (assistant.ts, cashier-survey.ts, QuickQuestions.tsx, su
  migración y 3 pruebas -postgres, textos de la portada, tokens.css).

## Decisiones (criterio de la orden)

### Multiempresa / RLS / registro / planes: manda producto

- `202610310001_cashier_survey`: versión del producto (tenantId, RLS, guardia FK).
- `assistant.ts`: el del producto (cuota por plan + paquetes, por empresa). El
  asistente de la tienda («Preguntar a Norexos», `IA_VENTAS_PLAN`, `/assistant/status`)
  usaba la misma ruta `POST /assistant/ask`; se dejó fuera. Se borraron sus pruebas
  (`assistant-api`, `assistant-unit`); `AssistantPanel.tsx` queda sin usar.
- `security.ts`, `cashier-survey.ts`, `inventory.ts`, `income-report.ts`: claves
  únicas por empresa (`tenantUnique`) sobre los arreglos de la tienda
  (p. ej. `updateMany`/`upsert` de AuthAttempt de la tienda, con clave por empresa).
- Registro cerrado por defecto, preDeploy y rol RLS: sin cambios (no hubo conflicto).

### Tablas nuevas de nexora-cloud con RLS

Migración nueva `202611200001_producto_igualar_tenant` para `GvCourse`,
`GvEnrollment`, `GvPayment`, `GvCashSession`, `GvProof`, `GvAppointment`, `GvLead`,
`AiUsage`, `BranchTermination`: `tenantId` (default demo + trigger
`nexora_assign_tenant`), FK a `Tenant`, índice, política `tenant_isolation`,
permisos del rol runtime y guardia `nexora_check_tenant_fk` en sus FK. Únicas por
sucursal → por empresa y sucursal (`externalId`, `receiptNumber`, `gv_cash_one_open`);
`BranchTermination` con PK `(tenantId, branchId)`. Esquema Prisma igual; el código
GV usa `tenantId_branchId_externalId` y `baja.ts` usa `tenantUnique("branchId")`.
`product-tenants-postgres` ahora exige 77 tablas, todas con RLS.

Migraciones GV editadas **solo en esta rama**: se quitaron los INSERT/UPDATE de
`Role` (`gv`, `gerente_gv`, permisos gv:* de manager). En la base multiempresa la
migración no pasa por RLS y tocaría a todas las empresas; además
`ON CONFLICT ("name")` falla con la única `(tenantId, name)` del producto.
Las dos correcciones de costo de la tienda (`202611100001/2`) quedan: en la base
del producto no encuentran filas (no hacen nada).

Orden: `prisma migrate deploy` aplicado sobre PostgreSQL nuevo (las 77 tablas con
RLS). Sobre la base del producto ya desplegada (29-oct) las 14 migraciones de la
tienda y la nueva entran como pendientes, en orden de nombre; todas son aditivas
o idempotentes. **No se probó contra una copia de la base real del producto.**

### Cosas de la tienda fuera del producto

- **GV Makeup Studio**: controladores `Gv*` y `GvCajaVigilante` solo si no es
  producto (`app.ts`); menú y página GV eliminados del build del producto (constante
  `VITE_PRODUCT_TENANCY`); `gv-scope.ts` no aparta categorías «GV …» en producto
  (`gvApartado()`), así un cliente con una categoría «GV algo» no pierde ventas en
  reportes; reporte «margen por empresa» usa el nombre de Ajustes en producto.
- **Fotos de productos de la tienda** (`apps/web/public/products/fotos`, 276
  archivos, 13 MB): borradas en esta rama. Quedan los 5 SVG genéricos.
- **Marca**: ticket sin logo de Grupo Macgen (versión del producto); PDF/Excel de
  reportes con «Norexos»; textos de la guía de reportes sin GV/MacGen; login y
  menú con la marca del producto. Build del producto: «artefacto compilado sin
  datos de la tienda».
- `Dashboard.tsx`: versión del producto entera (tablero ejecutivo); el rediseño del
  tablero de Dot (KpiStrip, CountUp, accesos rápidos) no entró.

### Negocio / diseño / auditoría: manda nexora-cloud

Reportes (desglose de cobros por banco, export PDF/Excel con guía, costo con merma,
utilidad con ITBIS `profit`), anulación con caja abierta (mensaje nuevo + cierre de
transferencias atascadas del producto), mover efectivo, recálculo/corrección de
costo, venta sin costo (`blockZeroCostSales`), margen visible (COM-03), ventas
con fecha, búsqueda de clientes sin teléfono (P5), i18n y presentaciones de Dot
donde no chocaban con funciones del producto. Arreglo encontrado al mezclar:
`entradas-cuenta` agrupaba 5 columnas con `GROUP BY 1,2,3,4` (500).

## Pruebas

- typecheck (`pnpm -r typecheck`): verde. lint (`pnpm lint`): verde.
- Build web del producto (`VITE_PRODUCT_TENANCY=required pnpm build`): verde,
  incluido `check-product-brand`.
- Unitarias + -postgres (`vitest run`, 655 archivos, como usuario `postgres`):
  1,702 pasan, 39 fallan en 19 archivos, 10 omitidas. Todas las -postgres del
  producto pasan (aislamiento RLS de 77 tablas, matriz, dinero, inventario,
  plataforma, registro, respaldo/exportación por empresa, baja de cliente).
  Las que fallan:
  - 16 archivos de guardias de diseño de Dot que comparan contra la versión de
    la tienda (caja/productos/inventario/operaciones-presentación,
    caja-turnos, merchandise-premium, operational-aux, purchase-editors-language,
    store-settings-language, config-rates-survey-language, operaciones-language,
    login-legible, login-animacion, tablero-animacion, f2-02-kpi-strip,
    inicio-integrado, catalog-image «104px»). Ver pendiente 1.
  - `docs-sistema-citas`: 15 citas de docs/sistema perdieron su línea (se
    re-anclaron las que se movieron con `node scripts/citas-reanclar.mjs`).
  - `portabilidad` (3): solo falla corriendo como `postgres` (pnpm/permiso del
    entorno); como root pasa.
- Integración (`vitest.integration.config.ts`, necesita API en :3001 + base):
  **no se corrió** aquí.
- Matriz de aislamiento: 218 rutas; las 8 nuevas tienen caso A/B en
  `tests/product-route-lote19-postgres.test.ts` (medidor IA, sin costo, guía,
  exportación, recálculo, desverificar, mover de caja, corregir costo).
- Las pruebas -postgres no corren como root (initdb): se corrieron como
  `postgres` (`su postgres`).

## Pendientes y riesgos

1. Guardias «byte por byte» de Dot que comparan archivos contra la versión de la
   tienda (merchandise-premium, purchase-editors-language, caja-presentacion,
   config-rates-survey-language, productos/inventario/operaciones-presentación,
   login-legible/animación, tablero-animación, inicio-integrado, catalog-image…):
   fallan porque el producto cambió esos archivos (marca, tenant, tablero
   ejecutivo, login del producto). Necesitan que Dot/ChatGPT rehaga su capa sobre
   la base del producto o re-ancle las huellas. Claude no diseña (regla 4).
2. Asistente de la tienda («Preguntar a Norexos» con `IA_VENTAS_PLAN`) no está en
   el producto: quedó el del producto. Si se quiere, hay que portarlo como otra
   ruta (`/assistant-ventas`) y sumarlo a la matriz.
3. Pruebas -postgres de la tienda con el mismo nombre que las del producto
   (`anular-caja-abierta`, `mis-ventas-preguntas`, `ventas-caja-ciega`): quedó la
   versión del producto; casos solo de la tienda (rol de almacén en Mis ventas,
   resumen solo de gerencia, formas «bandera APAGADA») no se portaron.
4. Guía de reportes: las columnas de inventario del producto se llaman
   «Existencia en <almacén>» (nombres por empresa); la guía cubre los nombres por
   defecto, no los personalizados.
5. `sql-sin-unsafe`: se permitió `$queryRawUnsafe` en los 5 archivos de
   infraestructura de tenant del producto (identificadores citados, valores $1).
6. `operationId` de GV sigue único global (uuid del cliente): un choque entre
   empresas da error, no fuga.
7. Migraciones probadas solo en base nueva; falta ensayo sobre copia de la base del
   producto antes de desplegar.
8. Desglose «forma de pago por categoría»: se tomó el de la tienda (banco,
   «sin cobro registrado», crédito cobrado) y se le sumó la regla del producto:
   la transferencia rechazada cuenta como crédito.
9. Citas de docs/sistema: 15 perdidas por la mezcla (pendiente de base-sistema).
10. `.env.example` trae `ASSISTANT_MODEL`/`IA_VENTAS_PLAN` de la tienda (sin efecto
   en el producto).

## Orden recomendado para desplegar el producto

1. Dot/ChatGPT: rehacer o re-anclar las guardias de diseño sobre esta rama
   (punto 1) hasta tener `verify` verde.
2. Correr los 3 CI (`verify`, `windows-installer`, `render-images`) en esta rama.
3. Ensayo de `prisma migrate deploy` + `producto-predeploy.mjs` sobre una copia de
   la base de nexora-saas (Render) y la matriz de aislamiento contra ella.
4. Aceptación de Marcos y despliegue en nexora-saas-web / nexora-saas-api.
