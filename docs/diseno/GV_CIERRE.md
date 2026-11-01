# GV · caja propia y cierre diario (diseño)

Estado: **documento de diseño, sin código.** Orden 106 de `docs/coordinacion/RESPUESTA_CLAUDE_PC_27OCT.md` (origen `origin/nexora-cloud`, base `d067a901`). Rama: `claude-pc/gv-cierre`.

Nada de este documento se implementa todavía. Las decisiones marcadas como **pregunta** son de Norexos 1 y no están tomadas.

## 0. Resumen

- GV recibe dinero por tres vías (efectivo, tarjeta, transferencia) en una tabla distinta de la caja de tienda: `GvPayment`. Hoy esos pagos **nunca** tocan `CashSession`.
- Por tanto hoy GV no tiene caja: no hay apertura, ni conteo, ni diferencia, ni resumen de cierre. Sus cifras solo se ven en reportes (`GET /gv/reports`).
- Propuesta: reutilizar `CashSession` con un campo `area` (`tienda` por defecto, `gv` para GV). Los pagos GV se enlazan a la caja GV abierta con una columna nueva `GvPayment.cashSessionId`. El cierre GV calcula su esperado solo con esos pagos.
- La caja de tienda no cambia: su fórmula (`cashExpected`) solo suma `Payment` con `cashSessionId` de la sesión, y los pagos GV nunca tienen ese enlace.
- El riesgo principal no está en el cierre sino en las ~30 consultas que buscan "la caja abierta del usuario" sin filtrar por área (sección 6). Sin ese filtro, una caja GV abierta se confundiría con la caja de tienda.

## 1. Estado actual: cómo fluye el dinero de GV hoy

### 1.1 Entrada de dinero

- Modelo `GvPayment` (`apps/api/prisma/schema.prisma`, bloque `model GvPayment`, ~líneas 1109–1155): `enrollmentId` o `appointmentId`, `date`, `amount`, `method` (`efectivo | transferencia | tarjeta`), `bank`, `destination`, `currency` (`DOP | USD`), `rate`, `amountDop`, `verified`, `rejectedAt`. **No tiene `cashSessionId`.**
- Alta: `POST /gv/payments` (`apps/api/src/gv.ts:383`) llama a `createGvPayment` (`apps/api/src/gv-money.ts:358`). El insert está en `gv-money.ts:413–419`.
- Tarjeta: `destination = "gv"` (`gv-money.ts:191`, `gv-money.ts:412`). Efectivo y transferencia: `destination` nulo; la transferencia nace `verified = false` (`gv-money.ts:416`).
- Dólares: `amountDop = amount × rate` (`gv-money.ts:397–401`). Tope por moneda del curso (`gv-money.ts:403–408`).
- Importación de Excel: `gvImportUpsert` / `applyGvImportPayment` (`gv-money.ts:626`, `gv-money.ts:648`), `POST /gv/import` (`gv.ts:807`).

### 1.2 Reembolsos

- Campos `refundAmount` y `refundDate` en `GvEnrollment` y `GvAppointment` (schema). Validación `gvRefundFields` (`gv-money.ts:233–236`).
- Al pasar a `reembolsada` se exige monto y fecha (`gv-money.ts:474–476`). El tope compara contra lo verificado **en la moneda del curso** (`gv-money.ts:478–483`, `gvTotals(…, moneda)` en `gv-money.ts:282`). Para un curso en US$ el reembolso queda en US$. Esto es la raíz de Q-05 que la orden 106 pide cerrar: **el reembolso no tiene columna de moneda**; siempre se trata como pesos en el neto (`apps/api/src/gv-incentives.ts:51–52`) pero el tope se compara en la moneda del curso.
- No hay enlace de un reembolso con una caja.

### 1.3 Dónde se concilia hoy

- `GET /gv/reports` (`gv.ts:531`): agrupa `gvPayment` verificados por método y banco (`gv.ts:550–575`). Es un reporte, no un cuadre: no compara contra nada físico.
- `GET /gv/transfers/pending` (`gv.ts:775–790`): transferencias por verificar.
- Incentivos: `gv-incentives.ts` (neto del mes, resta reembolsos en su mes).
- Ningún reporte de caja (`reports.ts`, `income-report.ts`, `reportes/dinero.ts`, `formal-report.ts`) lee `GvPayment` (búsqueda de `gvPayment` en `apps/api/src`: solo `gv.ts`, `gv-money.ts`, `gv-citas.ts`).

### 1.4 Caja de tienda (lo que se reutiliza)

- Modelo `CashSession` (`schema.prisma:673–702`): `registerId`, `userId`, `openingAmount`, `openedAt`, `closedAt`, `expected*`, `counted*`, `difference*`, `closeDetails` (JSON), `branchId`. Relaciones con `Payment`, `Sale`, `SaleReturn`, `CashMovement`.
- Apertura: `POST /cash-sessions/open` (`apps/api/src/cash.ts:837–947`), `@RequireTerminal()` + `@Permit("cash:write")`. Si el usuario ya tiene una caja abierta, devuelve esa (`cash.ts:897–900`).
- Esperado: `cashExpected` (`cash.ts:55–117`). Suma `Payment` con `cashSessionId = session.id` (`cash.ts:57–66`), movimientos (`cash.ts:84–87`) y devoluciones (`cash.ts:88–93`). La versión agrupada para listados es `cashExpectedMany` (`cash.ts:119`).
- Cierre: `POST :id/close` (`cash.ts:1112–1420`), diferencias en `closeDifferences` (`cash.ts:181`), refresco de cerrada en `refreshClosedCash` (`cash.ts:229`).
- Índices: `one_open_cash_per_user` (única, `(branchId, userId) WHERE closedAt IS NULL`, migración `202610030001_initial`, línea 633). El índice único por equipo se relajó en `202610240101_caja_por_usuario` (`DROP INDEX one_open_cash_per_register`).
- Caja ciega: `hiddenUntilClose` en `apps/api/src/reports.ts:1446–1483` (resumen del vendedor oculta importes si hay caja propia abierta) y `apps/api/src/sales.ts:176`, `sales.ts:1798`, `sales.ts:4339`.
- Búsqueda de la caja abierta del usuario: `apps/api/src/sales.ts:147–149` (`findFirst({ branchId, userId, closedAt: null })`), usada por ventas.

## 2. Diseño propuesto

### 2.1 Qué distingue una caja GV de una de tienda

Un campo nuevo en `CashSession`:

- `area TEXT NOT NULL DEFAULT 'tienda'`, con `CHECK area IN ('tienda','gv')`. Las filas existentes quedan en `tienda` sin reescribir nada (el `DEFAULT` cubre el alta; en PostgreSQL 11+ no reescribe la tabla).
- `registerId` de una caja GV: el identificador del equipo GV (un `Terminal` aprobado en el área GV, o un id fijo `gv` si la pregunta P2 se responde así). Nunca un equipo de tienda.
- `openingAmount`, `countedCash` y `closeDetails` se usan igual que en tienda. `countedCard` y `countedTransfer` también.

Por qué `area` y no una tabla nueva: `CashSession` ya tiene apertura, cierre, auditoría, `hiddenUntilClose`, reportes por sesión (`cash.ts:1543`) y permisos. Duplicarlo sería más código y dos fuentes de verdad.

### 2.2 Qué abre y qué cierra la caja GV

- Apertura: `POST /cash-sessions/open` con `area: "gv"`. Se acepta solo si el actor tiene el permiso de GV de caja (P3). El `area` por defecto sigue siendo `tienda`, así que el cliente actual no cambia.
- Cierre: `POST /cash-sessions/:id/close` detecta `area = gv` y usa `cashExpectedGv` en vez de `cashExpected`. El cierre de tienda no se toca.
- Un usuario puede tener a la vez una caja de tienda y una GV solo si se cambia el índice (P1). Con el índice actual, no.

### 2.3 Qué entra al esperado de la caja GV

Columna nueva `GvPayment.cashSessionId` (nullable, FK a `CashSession`, `onDelete: Restrict`). Se asigna en `createGvPayment` cuando hay una caja GV abierta del mismo `branchId` y del actor. Si no la hay, el pago queda con `cashSessionId = null`, como hoy.

Fórmula de `cashExpectedGv(session)`:

- `cash` = `openingAmount` + pagos `efectivo` verificados (`rejectedAt IS NULL`) en `DOP` − reembolsos en efectivo asignados a la sesión (P6).
- `card` = pagos `tarjeta` con `destination = 'gv'` y `rejectedAt IS NULL`.
- `transfer` = pagos `transferencia` **verificados** (`verified = true`). Las no verificadas van en una línea aparte, no en el esperado (P5).
- `usd` = pagos en `USD` en efectivo (si P8 lo pide), con el monto en US$ recibido.

Con la misma forma de respuesta que `cashExpected` (`cash`, `card`, `transfer`, `usd`), `closeDifferences` puede reutilizarse sin cambio.

### 2.4 Conteo y diferencia

Mismos campos que tienda: `countedCash`, `countedCard`, `countedTransfer`, `expected*`, `difference*`, `difference`, y `closeDetails` para denominaciones y notas. El descuadre se resuelve con el endpoint de tienda (`cash.ts:1469`) solo si P9 lo confirma; si no, se bloquea el cierre con diferencia sin nota (igual que `cashCloseRequiresNote`, `cash.ts:203`).

### 2.5 Factura o resumen del día

- Producto: un resumen GV de la sesión (y del día, por sucursal), con: cursos y citas cobrados por método, pendientes, verificaciones de transferencia, reembolsos en pesos, conteo y diferencia.
- Se guarda en `closeDetails.gvSummary` al cerrar, para que el documento no dependa de recalcular después (los pagos se pueden anular).
- Se entrega con `GET /cash-sessions/:id/reports/gv-resumen` (ruta nueva, mismo estilo que `reports/:name`, `cash.ts:1543`).
- Si P7 exige factura fiscal (NCF, ITBIS), queda **fuera de este diseño**: la numeración y el ITBIS de GV no existen hoy y requieren decisión propia.

### 2.6 Caja ciega

- La caja GV puede ocultar el esperado al cajero de GV hasta el cierre, igual que la de tienda. Se usa la misma bandera `hiddenUntilClose` (`reports.ts:1446`). **Pregunta P4**: si GV es ciega o no.
- No se cambia `hiddenUntilClose` para tienda.

### 2.7 Reembolsos en pesos (parte de la orden 106, no de este paso)

- Añadir columna de moneda del reembolso en `GvEnrollment` y `GvAppointment` (`refundCurrency DEFAULT 'DOP'`, `CHECK = 'DOP'`) y, si P6 lo pide, `refundCashSessionId`.
- Validar el tope en DOP con `valorPesos` (`gv-money.ts:263`) en vez de en la moneda del curso.
- Esto cierra Q-05. Va en su propia tarea con prueba que falle antes; aquí solo se deja como dependencia.

## 3. Qué NO debe cambiar

1. **Caja de tienda.** `cashExpected`, `closeDifferences`, `refreshClosedCash`, apertura y cierre de tienda, y el índice `one_open_cash_per_user` no se modifican para tienda. El filtro `area = 'tienda'` se añade solo donde se busca "la caja abierta" del usuario (sección 6).
2. **Caja ciega (`hiddenUntilClose`).** Las rutas `reports.ts:1446–1483`, `sales.ts:176`, `sales.ts:1798`, `sales.ts:4339` mantienen su comportamiento. Ningún importe de una caja de tienda abierta se muestra por el cambio de GV.
3. **Reembolsos en pesos (orden 106).** Todo reembolso GV queda en DOP. Ningún reembolso en US$ nuevo. Los reembolsos ya guardados (sin moneda) se interpretan como DOP solo si se confirma P10; no se reescriben.
4. **Pagos GV históricos.** Las filas anteriores a la migración conservan `cashSessionId = null`. No se reasignan a ninguna caja.
5. **Pagos de tienda y `Payment`.** Ningún pago de GV se crea como `Payment`, ni se mezcla en `Sale`.
6. **Permisos.** Ningún rol gana acceso nuevo sin decisión (P3).
7. **Reportes existentes de GV** (`GET /gv/reports`, `gv-incentives`) siguen igual; el resumen de caja es un reporte adicional.

## 4. Migración aditiva propuesta (solo nombres, no escrita)

1. `202611010001_cash_session_area`: `CashSession.area TEXT NOT NULL DEFAULT 'tienda'`, `CHECK cash_session_area_valid`, índice `CashSession_branchId_area_open_idx` (`WHERE closedAt IS NULL`).
2. `202611010002_gv_payment_cash_session`: `GvPayment.cashSessionId UUID NULL`, FK `ON DELETE RESTRICT`, índice `GvPayment_cashSessionId_idx`.
3. `202611010003_gv_refund_currency`: `GvEnrollment.refundCurrency` y `GvAppointment.refundCurrency` (`TEXT NOT NULL DEFAULT 'DOP'`, `CHECK = 'DOP'`). Solo si la orden 106 Q-05 se implementa en el mismo lote; si no, va después.
4. (Opcional, según P6) `202611010004_gv_refund_cash_session`: `refundCashSessionId` en las dos tablas de reembolso.
5. Si P1 se responde con índice nuevo: `202611010005_cash_open_per_user_area`: sustituye `one_open_cash_per_user` por `(branchId, userId, area) WHERE closedAt IS NULL`. **Es el único cambio que toca tienda**; por eso es la última y la más revisada.

Todas son aditivas (columnas nullable o con `DEFAULT`, índices nuevos). El `DROP` de 5 es la única excepción y solo existe si P1 lo pide.

## 5. Pruebas (escribir primero; cada una debe fallar antes y pasar después)

Patrón de los tests existentes: `tests/*.test.ts` y `tests/*-postgres.test.ts`, con base real para las migraciones.

1. `tests/gv-caja-propia.test.ts` (nuevo):
   - Abrir caja con `area: "gv"` crea sesión `area = gv`. Antes: el campo no existe (falla).
   - Abrir caja GV no cambia la caja de tienda abierta del mismo usuario (si P1 lo permite).
   - Un pago GV con caja GV abierta queda con `cashSessionId` de esa caja; sin caja, queda `null`.
2. `tests/gv-caja-cierre.test.ts` (nuevo): el esperado GV suma efectivo, tarjeta (`destination = gv`) y transferencias verificadas; no suma transferencias sin verificar ni pagos de otra caja. El cierre con diferencia sin nota se rechaza.
3. `tests/caja-por-usuario.test.ts` (existente, ampliar): una caja de tienda abierta y una GV del mismo usuario coexisten (solo si P1 = índice nuevo).
4. `tests/cash-privacy.test.ts` y `tests/caja-ciega-margen-api.test.ts` (existentes): no cambian; deben seguir pasando sin edición. Es la prueba de "no tocar tienda".
5. `tests/gv-adversarial-independiente.test.ts` (existente): ningún pago GV se crea como `Payment`.
6. Búsquedas de caja abierta (sección 6): una prueba por consulta cambiada que demuestre que una caja GV abierta no es la caja de venta del usuario (`sales.ts:147`). Antes falla (la caja GV se devuelve), después pasa.
7. `tests/gv-reembolso-pesos.test.ts` (orden 106 Q-05, otra tarea): reembolso de curso US$ se valida en DOP. Antes falla.

## 6. Riesgo de búsquedas sin filtro de área

Se encontraron ~30 consultas `cashSession.findFirst/findMany` que buscan la caja abierta por `userId`/`branchId`/`closedAt: null` sin `area`, entre ellas:

- `apps/api/src/sales.ts:147–149` (caja de venta del usuario), `sales.ts:2466`, `sales.ts:2981`, `sales.ts:3848`, `sales.ts:4385`
- `apps/api/src/cash.ts:868`, `897`, `938`, `1437`, `1444`, `1148`
- `apps/api/src/income-report.ts:238`, `302`
- `apps/api/src/reportes/dinero.ts:25`
- `apps/api/src/reports.ts:726`
- `apps/api/src/realtime.ts:385`, `apps/api/src/alerts.ts:414`
- `apps/api/src/formal-report.ts:152`

Regla de diseño: **toda** consulta que busque "la caja de venta" debe filtrar `area: 'tienda'`. Las que listan cajas para una pantalla (`cash.ts:769`, `realtime.ts:385`) deben decidir si muestran GV (P11). Si no se filtra, una caja GV abierta puede (a) recibir ventas de tienda por `sales.ts:147`, (b) aparecer como caja de tienda en el cuadre, (c) bloquear la apertura de la caja de tienda por `one_open_cash_per_user`.

## 7. Preguntas abiertas para Norexos 1 (no decididas aquí)

- **P1.** ¿Un mismo usuario puede tener abiertas a la vez una caja de tienda y una GV? Hoy `one_open_cash_per_user` lo impide. Opciones: (a) índice por `(branchId, userId, area)`, que toca tienda; (b) una caja abierta por persona, GV y tienda por turnos.
- **P2.** ¿Qué `registerId` usa la caja GV: un `Terminal` aprobado del área GV, o un id fijo `gv`?
- **P3.** ¿Qué permiso abre y cierra la caja GV? Hoy `POST open` y `close` exigen `cash:write`, que también da acceso a tienda. ¿Se crea `cash:gv`?
- **P4.** ¿La caja GV es ciega (esperado oculto hasta el cierre), como la de tienda, o visible?
- **P5.** ¿Las transferencias no verificadas entran al esperado de la caja GV, o solo se muestran aparte como pendientes?
- **P6.** ¿Los reembolsos en pesos salen de la caja GV (efectivo) en el día del reembolso, en el día del cierre, o no salen de caja (transferencia)? ¿Se guarda `refundCashSessionId`?
- **P7.** ¿El "resumen del día" es interno, o es factura fiscal con NCF e ITBIS? Si es fiscal, este diseño no basta y hay que definir numeración y ITBIS de GV.
- **P8.** ¿Los cobros en US$ en efectivo van a una gaveta de dólares de la caja GV (como en tienda, `amountUsd`), o se cuentan en pesos con `amountDop`?
- **P9.** ¿Un descuadre de caja GV se resuelve con el flujo de tienda (`POST :id/descuadre`, con PIN de gerente) o con uno propio?
- **P10.** ¿Los reembolsos ya guardados sin moneda se tratan como DOP? (Hoy se comparan contra la moneda del curso, sección 1.2.)
- **P11.** ¿La pantalla de cajas del POS muestra las cajas GV, o solo las de tienda?
- **P12.** ¿El fondo de apertura de GV se sugiere desde el último cierre GV (como `openingSuggestion`, `cash.ts:1433`)?
- **P13.** ¿Los pagos GV anteriores a la migración se dejan sin caja (propuesta) o se asignan a una caja histórica?
- **P14.** ¿Varias sucursales? Hoy `branchId` por defecto es `main`; la caja GV se define por `branchId`.

## 8. Riesgos y reversión

Riesgos:

- **R1. Caja GV confundida con la de venta** (sección 6). Mitigación: filtro `area` en todas las consultas de caja de venta y pruebas 6.
- **R2. Cambio de índice `one_open_cash_per_user`** (solo si P1 = a). Afecta a todas las cajas. Mitigación: migración separada, al final, y prueba de concurrencia en `tests/caja-por-usuario.test.ts`.
- **R3. Pagos GV que quedan sin caja** si se abre la caja tarde. Mitigación: el resumen del cierre muestra "pagos GV sin caja" del día, para revisarlos.
- **R4. Esperado GV distinto del que ve el cajero** si cambian las reglas de verificación. Mitigación: `closeDetails.gvSummary` guarda el cálculo del cierre.
- **R5. Sesiones GV abiertas al desplegar.** La orden 106 pide no desplegar con cajas abiertas: el despliegue debe coordinarse con cierre de GV.

Reversión:

- Las migraciones son aditivas: revertir el código deja las columnas nuevas sin uso (nullable o con `DEFAULT`). No hace falta `DROP` salvo que se haya aplicado la migración 5.
- Si ya hay cajas GV abiertas, cerrarlas antes de revertir; una caja con `area = gv` no debe quedar abierta sin código que la cierre.
- Si la migración 5 se aplica, revertirla implica recrear `one_open_cash_per_user` con la misma condición; solo es seguro si ninguna persona tiene dos cajas abiertas en la sucursal (verificar antes).
- Ningún paso borra filas. Los pagos GV conservan su historial.

## 9. Lo que este documento no cubre

- No cambia código, esquema ni migraciones (esta tarea).
- No decide P1–P14.
- No define la factura fiscal de GV (P7).
- No implementa el reembolso en pesos (orden 106, Q-05); solo lo referencia.
- No se despliega. Antes de mezclar: auditoría de Norexos 1.
