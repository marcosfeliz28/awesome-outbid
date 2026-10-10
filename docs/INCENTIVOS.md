# Incentivos por cajera

Cada cajera gana dinero por cada producto que vende y se cuadra a fin de mes. Pedido por la dueña (Grupo Macgen, 4 cajas con cajeras con nombre).

## Reglas

| Tema                  | Decisión                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A quién se le paga    | A la **usuaria que registra la venta** (`Sale.sellerId`), por persona y con su nombre. La caja o el equipo son sólo informativos.                                                                                                                                                                                                              |
| Cuánto                | Una tarifa en RD$ **por unidad vendida**, según la categoría del producto. Por defecto: **Suplementos 50, Fajas 50, Maquillaje 25**, las demás 0. El nombre se compara sin mayúsculas ni acentos (también «Suplemento», «Faja»).                                                                                                               |
| Dónde se cambia       | **Configuración › Negocio y reglas › Incentivos por categoría.** Sólo la administración (permiso `*`). Queda en la bitácora (`incentive_rates`).                                                                                                                                                                                               |
| Cambiar una tarifa    | **No altera lo ya ganado.** Cada línea vendida guarda la tarifa vigente al cobrar.                                                                                                                                                                                                                                                             |
| «Venta al por mayor»  | Un clic en el punto de venta (debajo del cliente). Con la marca activa se ve el aviso «el incentivo de esta venta será la mitad» y el cobro dice «Venta al por mayor · incentivo a la mitad». **Sólo afecta al incentivo** (× 0.5): precios y totales no cambian. Se reinicia en «Nueva venta», al limpiar el carrito o al cambiar de usuaria. |
| Quién marca mayorista | Cualquier cajera. Queda en la bitácora (`wholesale_marked`), en el aviso de Telegram de la venta y en la columna «Al por mayor» del cuadre (con «Revisar» si es la mitad o más de sus ventas): control de abuso.                                                                                                                               |
| Redondeo              | Cantidad × tarifa (× 0.5) por línea, a 2 decimales, mitad hacia arriba.                                                                                                                                                                                                                                                                        |
| Devoluciones          | Descuentan **proporcionalmente por unidades devueltas** (redondeo acumulado: devolver de a una suma exactamente lo ganado), a nombre de la cajera que ganó el incentivo.                                                                                                                                                                       |
| Anulaciones           | Descuentan todo lo que queda de la venta.                                                                                                                                                                                                                                                                                                      |
| Mes                   | El mes de negocio en **America/Santo_Domingo** (la medianoche de RD, no la UTC).                                                                                                                                                                                                                                                               |
| Reversos de otro mes  | Se descuentan en el mes en que ocurren, aunque la venta sea de un mes anterior. El cuadre lo muestra aparte («de ventas de meses anteriores») y, si el neto queda negativo, lo marca «Saldo negativo por devoluciones»: nunca se esconde ni se compensa solo.                                                                                  |
| Ventas por cobrar     | El incentivo de ventas a crédito o contraentrega con saldo pendiente se incluye en el neto, pero se informa en la columna «Por cobrar» para que la dueña decida si lo retiene.                                                                                                                                                                 |
| Cerrar mes            | Botón «Cerrar mes» (sólo administración). Guarda una instantánea inmutable por cajera y el mes ya no se recalcula. Una venta tardía (offline) o una devolución de ese mes cae en el **siguiente mes abierto**, con una nota.                                                                                                                   |
| Ventas anteriores     | Las ventas registradas antes de esta función no generan incentivo (la migración no inventa montos).                                                                                                                                                                                                                                            |

## Quién ve qué

| Rol                      | Ve                                                                                                      | Puede                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Cajera (`sale:write`)    | **Sólo lo suyo**: el cuadro «Mis incentivos» en Caja (neto, unidades, ventas, al por mayor, por cobrar) | Marcar «Venta al por mayor»     |
| Gerencia (`sale:manage`) | Pantalla «Incentivos» con todas las cajeras, Excel y recibos                                            | —                               |
| Administración (`*`)     | Lo mismo                                                                                                | Cambiar tarifas y cerrar el mes |

Ningún endpoint de incentivos devuelve costos ni utilidad. `GET /incentives/me` ignora cualquier `userId`: siempre responde con la usuaria de la sesión. El aviso de Telegram lleva «Venta al por mayor» e «Incentivo: RD$ X» porque ese grupo es de la administración.

## Pantalla «Incentivos»

Por mes y cajera: ventas, unidades por categoría (vendidas y devueltas), incentivo bruto, devoluciones y anulaciones, ventas al por mayor, neto y lo que viene de ventas por cobrar. Botones: **Exportar Excel** (hoja «Cuadre» y hoja «Detalle» con cada línea, tarifa, mayorista, nota) y **Recibo PDF** por cajera, con líneas de firma. Con el mes abierto el recibo dice «PRELIMINAR».

## Diseño técnico

- Código: `apps/api/src/incentives.ts` (cálculo puro, enganches y `IncentivesController`) y `apps/web/src/Incentives.tsx`. Enganches de pocas líneas en `sales.ts` (venta, devolución, anulación), `admin.ts` (venta en espera), `notifications.ts` (aviso), `POS.tsx`, `App.tsx` y `Management.tsx` (Caja y Configuración).
- **Instantánea:** en la misma transacción de la venta se crea una `IncentiveEntry` por línea (`kind = "sale"`) con `saleId, saleItemId, userId, categoryId, categoryName, qty, rateAtSale, wholesale, amount, period, originPeriod, note, branchId, createdAt`. Devoluciones (`kind = "return"`, `refId` = devolución) y anulaciones (`kind = "void"`) crean entradas negativas.
- **Idempotencia:** la venta ya es idempotente por `offlineUuid` (un reintento devuelve la venta existente y no vuelve a crear entradas) y la devolución por `operationId`; además `(saleItemId, kind, refId)` es único y las entradas se crean con `skipDuplicates`.
- **Venta mayorista:** `wholesale` es un campo opcional de la venta (`saleSchema`) sin valor por defecto, así la huella (`requestHash`) de ventas offline anteriores no cambia. Se guarda en `Sale.wholesale` y, en la venta en espera, en `Quote.wholesale`. Las ventas offline guardan el cuerpo completo y lo sincronizan con la marca.
- **Cierre:** `POST /incentives/close` toma un candado consultivo exclusivo por sucursal; ventas y devoluciones lo toman compartido, así ninguna entrada cae en un mes que se está cerrando y las ventas no se bloquean entre sí. Crea `IncentivePeriodClose` y una `IncentiveSettlement` por cajera (unidades, ventas, mayoristas, bruto, descuentos, neto, por cobrar, reversos de meses anteriores, cerró, fecha). El informe de un mes cerrado se lee de ahí; las entradas del mes siguen dando las mismas cifras.
- Endpoints: `GET /incentives?month=AAAA-MM` (`sale:manage`), `GET /incentives/me` (`sale:write`, sólo lo propio; por defecto el mes abierto donde cuentan sus ventas nuevas), `GET|PUT /incentives/rates` (`sale:manage` / `*`), `POST /incentives/close` (`*`), `GET /incentives/export.xlsx` y `GET /incentives/receipt.pdf?userId=` (`sale:manage`).

## Migración `202610190001_incentives`

Idempotente: `ADD COLUMN IF NOT EXISTS` (booleanos con `DEFAULT false`, sin reescribir tablas en PostgreSQL 11+), `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS` y los índices únicos sólo si los datos lo permiten (si no, el índice queda pendiente y el despliegue sigue; el `NOTICE` no se ve en Render: lo detecta `node deploy/render/post-deploy-check.mjs --db-only`). No borra ni modifica datos ni genera incentivos para ventas anteriores.

## Pruebas

- `tests/incentives-calc.test.ts` (unitarias): tarifas por categoría y nombre, mayorista × 0.5, redondeo, reversos proporcionales, límites de mes en Santo Domingo, meses cerrados, cuadre por cajera, esquema de la venta y aviso de Telegram.
- `tests/incentives-api.test.ts` (integración, API compilada): categorías mezcladas, venta mayorista, idempotencia en línea y offline, devolución parcial (y su reintento), anulación, contraentrega por cobrar, privacidad por rol, tarifas que no alteran lo ganado, cierre inmutable y reproducible y venta tardía tras el cierre.
- `tests/e2e/incentivos.spec.ts` (Playwright): la administración pone la tarifa, la cajera marca «Venta al por mayor», cobra y ve su acumulado a la mitad; la administración ve el cuadre, exporta y cierra el mes.
