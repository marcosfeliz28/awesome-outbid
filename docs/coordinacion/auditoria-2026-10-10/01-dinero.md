# Auditoría 01 · Integridad del dinero y la contabilidad · Nexora POS

- **Rama auditada:** `origin/nexora-cloud` @ `3e5521c` (worktree desacoplado, solo lectura). Producción, Render y la base real no se tocaron.
- **Fecha:** 2026-10-10. Reloj de la máquina: 03:57–04:10 UTC, que es justo la medianoche de Santo Domingo (UTC−4). Así quedó probado el corte del día.
- **Punto de partida:** `docs/AUDITORIA_FINAL_DINERO.md` (rama `claude/audit-money`, sobre `ae765d1`), `docs/DECISIONES.md` (puntos 9–13) y `docs/coordinacion/COLA_HALLAZGOS_NEXORA.md`. Desde entonces hay 169 commits y 3,633 líneas nuevas en `apps/api/src` y `packages/shared`, entre ellas `incentives.ts` completo y las correcciones D-01 a D-08.
- **Método:** lectura adversaria de `sales.ts`, `cash.ts`, `incentives.ts`, `reports.ts`, `inventory.ts`, `merchandise.ts`, `offline-sales.ts`, `alerts.ts`, `admin.ts`, `catalog.ts`, `packages/shared/src/index.ts` y de la web (`Tienda.tsx`, `pendingSales.ts`, `Management.tsx`). Después, pruebas contra la **API compilada** (`node dist/main.js`, `NODE_ENV=production`), conectada a un PostgreSQL 16 propio (clúster en `/var/lib/postgresql/aud-dinero01`, puerto 55601). La base `audm_tpl` se cargó con el seed oficial y `audm_money` es una copia de ella. Se usaron los usuarios del seed: `vendedor@` (rol `seller`, el de las cajeras), `gerente@`, `admin@` y `almacen@`.
- **Convención:** **[VERIFICADO]** significa que lo reproduje y anoto la salida real. **[CÓDIGO]** significa que sale de leer el código y no lo ejecuté. Lo que no pude demostrar está en «No verificado».
- **Scripts:** `scratchpad/audm2/lib.sh` (helpers `tok`, `reg`, `open_cash`, `sale_body`, `q`…), más `rp.mts` y `f2.mts`.

## Resumen

| Severidad | Nº |
|---|---|
| BLOQUEANTE | 0 |
| ALTO | 2 |
| MEDIO | 6 |
| BAJO | 11 (7 nuevos + 4 de la auditoría anterior que siguen abiertos) |

No hay hallazgos que dupliquen ventas, rompan la idempotencia, dejen stock negativo o descuadren las tablas entre sí: las invariantes dieron 0 violaciones en las ~860 ventas del seed más las de la prueba (ver «Lo que está bien»). Los problemas son **controles que se pueden rodear** y **reportes que no muestran lo que pasó**:

| ID | Sev. | Hallazgo (una línea) | Impacto demostrado |
|---|---|---|---|
| A-1 | **ALTO** | La cajera declara un «Vale de caja» por cualquier monto al cerrar: se lleva el efectivo, la diferencia queda en 0 y no hacen falta PIN, nota ni alerta (anula D-04). | RD$ 3,000 de una caja con RD$ 3,200 |
| A-2 | **ALTO** | La corrección de D-03 (fondo de apertura) no funciona en el flujo normal: si la cajera deja vacío «Entregado», el cierre guarda `left = null` y la siguiente apertura acepta cualquier fondo. | Todo el fondo (demo RD$ 200; en tienda, RD$ 1,000–3,000 por turno) |
| M-1 | MEDIO | La evaluación de alertas resuelve sola las alertas de control: la de diferencia de caja cuando ya hay 30 cierres más nuevos y la de descuento inusual al día siguiente. | Faltante de RD$ 900 → alerta «resolved» sin que nadie la revisara |
| M-2 | MEDIO | Con «ventas a crédito» activado, el crédito y la contraentrega partidos por debajo del umbral (RD$ 1,000) no piden PIN y no tienen tope por cliente (límite 0 = sin límite). | RD$ 6,300 a un cliente recién creado, en 7 ventas |
| M-3 | MEDIO | El pago por transferencia al vender no se verifica, no genera alerta y no se puede rechazar: la mercancía sale con cualquier banco y referencia y cuenta como ingreso. | RD$ 600 con «Banco Inventado / 0000», cuadre en 0 |
| M-4 | MEDIO | El tope de salidas sin PIN (D-04) se cuenta por turno: cerrar y reabrir lo reinicia. | RD$ 3,000 en 3 turnos sin PIN y sin alertas |
| M-5 | MEDIO | El rol almacén saca inventario (ajuste negativo o «salida») sin aprobación, y las mermas, ajustes y salidas no aparecen en el estado de resultados. | RD$ 12,000 a costo desaparecen; la utilidad neta no cambia |
| M-6 | MEDIO | Una venta offline pagada en efectivo cuyo precio subió queda varada: nadie puede descartarla (403/404), la web no la repreciar y bloquea el cierre de caja en ese equipo. | La venta (RD$ 1,000) sin registrar y la caja sin poder cerrarse |
| B-1 | BAJO | Repreciar una venta offline cuyo precio bajó registra como «cambio entregado» una rebaja que el cliente nunca recibió: el sobrante queda en la gaveta. | RD$ 110 por venta |
| B-2 | BAJO | El total de una recepción de mercancía se suma con `number` (float): ±1 centavo frente al cálculo con Decimal. | 9.1 × 625.55 → 5,692.50 (debe ser 5,692.51) |
| B-3 | BAJO | Se puede «Cerrar mes» de incentivos con el mes en curso y no hay forma de reabrirlo. | El resto del mes pasa al siguiente |
| B-4 | BAJO | Siguen en bruto, sin restar devoluciones: «top», los reportes de tienda (`venta-diaria-usuario`, `venta-por-forma-pago`), `customers` y la línea «Total» del cuadre. | top 1,100 frente a ingresos 740 en el mismo día |
| B-5 | BAJO | Una anulación cambia los informes de días pasados (la venta deja de contar en su fecha), mientras que una devolución cuenta en la fecha de la devolución. | El 2026-10-09 bajó RD$ 600 al anular el día 10 |
| B-6 | BAJO | Una devolución de una venta cobrada con tarjeta se puede reembolsar en efectivo (D-06 solo pone tope al efectivo). | RD$ 1,100 de tarjeta a efectivo |
| B-7 | BAJO | `PATCH /variants/:id` deja que un gerente cambie `costAvg` directamente, sin movimiento de inventario. Eso altera la utilidad y la valoración. | Costo 600 → 1: +RD$ 599 de utilidad por unidad |
| D-07 | BAJO | (sigue abierto) `operationId` sigue siendo opcional en `POST /returns`: un reintento duplica la devolución. | NC-000001 y NC-000002, ×2 el reembolso |
| D-09 | BAJO | (sigue abierto) El cierre ciego revela si el conteo es exacto, y `GET /sales?date=` permite reconstruir el esperado. | — |
| D-10 | BAJO | (sigue abierto) La auditoría `close_difference` se registra también cuando la diferencia es 0.00. | Bitácora engañosa |
| D-11 | BAJO | (sigue abierto) `POST /sales/:id/void` sigue sin `@RequireTerminal()`. | Se anula sin equipo registrado |

**Prioridad antes de cerrar la ronda:** A-1 y A-2. Las dos dejan sacar efectivo de la gaveta con el cuadre en 0 y son el rodeo directo de dos correcciones que se dieron por cerradas (D-04 y D-03). Después, M-1, porque las alertas son la red que debería atrapar todo lo demás.

---

## Reproducción común

```bash
source scratchpad/audm2/lib.sh      # API=http://127.0.0.1:3601/api, PG 55601
reset_db && start_api && login_all && use_tokens   # tokens ADMIN, GER, VEND y equipo de cada uno
CLI=$(cust); VAR=$(var_nolot Fajas); setstock $VAR 50   # Fajas, precio 1100, sin lote
```

---

## A-1 · ALTO · «Vale de caja» sin control al cerrar **[VERIFICADO]**

**Dónde**
- `apps/api/src/cash.ts:88-99` (`closeDifferences`): la diferencia de efectivo es `countedCash + vouchers − expected.cash`.
- `apps/api/src/cash.ts:795-858` (`close`): `vouchers` se acepta tal como llega. No hay PIN, ni tope, ni alerta, ni comprobación contra las salidas registradas.
- `packages/shared/src/index.ts:597`: `vouchers: cashAmount.default(0)` (hasta 100,000,000).
- `apps/web/src/Tienda.tsx:154`: campo libre «Vale de caja — Comprobantes de salida que están en la gaveta».
- Mientras tanto, `cash.ts:652-698` sí exige PIN para una salida registrada de más de RD$ 1,000 (D-04).

**Escenario** (token de la vendedora, rol `seller`):
```bash
CAJA=$(open_cash "$VEND" 1000)
p "$VEND" /sales "$(sale_body $CAJA $VAR 2 '[{"method":"cash","amount":2200}]')"          # FS-0000847, 2200
p "$VEND" /cash-sessions/$CAJA/movements '{"type":"out","amount":2000,"reason":"retiro"}'
#   → 400 «Las salidas de efectivo de este turno superan RD$ 1,000.00: se requiere el PIN de un gerente.»
p "$VEND" /cash-sessions/$CAJA/close '{"countedCash":200,"vouchers":3000,"countedCard":0,"countedTransfer":0}'
#   → 201 (sin nota)
```
**Resultado:** `opening 1000 | expected 3200 | counted 200 | vouchers 3000 | differenceCash 0.00`. Hay **0 alertas** (`Alert key=cash:<id>` no existe) y la bitácora solo tiene `open, close, close_difference`. El cuadre del admin dice «Vale de caja 3000 · Diferencias RD$ 0».

**Impacto:** una cajera se lleva **todo el efectivo del turno** (fondo + ventas; en la demo RD$ 3,000) y el cierre queda cuadrado. No necesita conocer el esperado: toma X, cuenta lo que queda y declara un vale por X. Lo único que queda es el número en la línea 5 del cuadre. Así, el PIN de D-04 no sirve para nada: basta con no registrar la salida y declararla como vale.

**Arreglo propuesto** (diff mínimo: que los vales de quien no gestiona ventas pasen por la misma regla que las salidas; los vales deben existir como salidas registradas):
```diff
--- a/apps/api/src/cash.ts
+++ b/apps/api/src/cash.ts
@@ async close(
     const closed = await this.db.$transaction(async (tx) => {
       const session = await cashLock(
@@
       const expected = await cashExpected(tx, session);
+      // A-1: un vale es una salida de efectivo. Quien no gestiona ventas la
+      // registra como salida (con su tope y PIN, D-04) antes de cerrar; el
+      // cierre no acepta vales sueltos que compensen un faltante.
+      if (input.vouchers > 0 && !can(actor.permissions, "sale:manage"))
+        bad("Registra cada vale como salida de efectivo antes de cerrar la caja.");
```
En la web, ocultar «Vale de caja» a la cajera o explicar que va en «Salidas». Regresión: el `close` de arriba debe responder 400, y con la salida registrada (con PIN) debe cerrar en 0.

---

## A-2 · ALTO · El control del fondo de apertura (D-03) no funciona si «Entregado» queda vacío **[VERIFICADO]**

**Dónde**
- `apps/web/src/Tienda.tsx:159`: `...(delivered === null ? {} : { delivered })`. Con «Entregado» vacío no se envía nada, aunque la pantalla diga «Dejado en caja: {subtotal} · Será el fondo sugerido de la próxima apertura».
- `packages/shared/src/index.ts:573-578` (`deliveredSplit`): sin `delivered` devuelve `{ delivered: null, left: null }`.
- `apps/api/src/cash.ts:912-929` (`openingSuggestion`): con `left` nulo devuelve `{amount:null}`, y entonces `open` (`cash.ts:516-553`) no compara nada.

**Escenario:** se sigue con la caja de A-1, cerrada **sin** `delivered`, que es lo que hace la web cuando no se llena el campo:
```bash
g "$VEND" /cash-sessions/opening-suggestion        # → {"amount":null,"fromSessionId":null}
p "$VEND" /cash-sessions/open '{"openingAmount":0}'  # → 201
```
**Resultado:** la caja nueva abre con 0 y en la bitácora solo queda `open`. No hay `opening_difference`, ni nota, ni PIN. Como control, cerrando **con** `"delivered":0` (dejado 500), abrir con 100 responde `400 «El fondo es menor que lo dejado en el último cierre (RD$ 500.00)…»`. La corrección funciona solo si la cajera escribe «Entregado».

**Impacto:** el fondo que quedó en la gaveta (RD$ 1,000–3,000 por turno en la tienda; demo RD$ 200) sale sin dejar diferencia. Es D-03 otra vez, en el camino por defecto.

**Arreglo propuesto** (lo dejado es lo contado si no se entregó nada; también sirve para los cierres ya guardados):
```diff
--- a/apps/api/src/cash.ts
+++ b/apps/api/src/cash.ts
@@ async openingSuggestion(@CurrentUser() actor: Actor) {
-    const left = (last?.closeDetails as any)?.left;
+    // A-2: sin «Entregado», todo lo contado quedó en la gaveta.
+    const left =
+      (last?.closeDetails as any)?.left ?? last?.countedCash ?? undefined;
```
Conviene además que `close` guarde `left = counted` cuando no llega `delivered` (`deliveredSplit(counted, input.delivered ?? 0)`), para que el cuadre impreso diga lo mismo.

---

## M-1 · MEDIO · Las alertas de control se resuelven solas **[VERIFICADO]**

**Dónde:** `apps/api/src/alerts.ts:363-372`. Cada `evaluate()` marca como `resolved` toda alerta cuya clave no vuelva a generar, salvo `offline_conflict` y `receivable`. `evaluate()` corre en **cada** `GET /alerts` (`alerts.ts:418`), es decir, cada vez que un gerente abre Avisos, y además cada 24 h.
- Diferencia de caja: solo se miran los **últimos 30 cierres** (`alerts.ts:85-89`).
- Descuento inusual: solo las ventas de **hoy** (`alerts.ts:260-267`).

**Escenario 1 (caja):** la caja `fb3d…` tiene un faltante de RD$ 900 y su alerta está en `new`. Se registran 30 cierres posteriores (simulados por SQL; con 4 cajas son unos 7 días) y se llama `GET /alerts` como admin. Resultado: `cash:fb3d…|resolved`, aunque `differenceCash` sigue en `-900.00`.

**Escenario 2 (descuento):** el gerente vende con un 40 % de descuento (FS-0000858, desc. RD$ 240) y `GET /alerts` crea `discount:<id>|new`. Se mueve `createdAt` un día atrás (simula el día siguiente) y se vuelve a llamar `GET /alerts`: queda `resolved`.

**Impacto:** un faltante o un descuento sospechoso que nadie revisó a tiempo desaparece de Avisos sin intervención humana. Afecta a cualquier monto.

**Arreglo:**
```diff
--- a/apps/api/src/alerts.ts
+++ b/apps/api/src/alerts.ts
@@
-        type: { notIn: ["offline_conflict", "receivable"] },
+        // Son hechos, no estados: sólo una persona los da por revisados.
+        type: {
+          notIn: ["offline_conflict", "receivable", "cash_difference", "unusual_discount"],
+        },
```

---

## M-2 · MEDIO · Crédito o contraentrega partidos por debajo del umbral, sin tope por cliente **[VERIFICADO]** (requiere `allowCreditSales=true`)

**Dónde:** `packages/shared/src/index.ts:389-406` (`receivableNeedsApproval`) compara **cada venta** contra `creditApprovalThreshold` (1,000) y no la deuda acumulada del cliente. En `apps/api/src/sales.ts:667-677`, el límite del cliente solo se aplica si es mayor que 0, y un cliente nuevo tiene `creditLimit 0`.

**Escenario:** la vendedora crea el cliente «Cliente Nuevo Sin Historial» (`POST /customers`) y luego se activa `allowCreditSales=true`.
- Con `allowCreditSales=false`, una contraentrega de 900 responde `400 «requiere el PIN»`. D-01 está bien.
- Con `true`: 4 ventas de **contraentrega** de 900 → `201` cada una; 3 ventas a **crédito** de 900 con `creditDueDate` → `201` cada una.
- `SUM(creditBalance)=6300.00` en 7 ventas, con 0 `credit_approved` en la bitácora. Como control, una sola contraentrega de 1,200 responde `400 PIN`.

**Impacto:** mercancía por cobrar sin tope (demo RD$ 6,300) a un cliente que creó la propia cajera. D-04 se diseñó para que «partir un retiro no evite el control», pero aquí partir sí lo evita.

**Arreglo** (comparar la deuda total del cliente después de la venta con el umbral):
```diff
--- a/apps/api/src/sales.ts
+++ b/apps/api/src/sales.ts
@@ private async approve(actor: Actor, input: SaleInput) {
+    const openDebt = input.customerId
+      ? Number((await this.db.sale.aggregate({
+          where: { customerId: input.customerId, branchId: actor.branchId, status: "completed",
+                   payments: { some: { method: { in: ["credit", "cod"] }, entryType: "sale" } } },
+          _sum: { creditBalance: true } }))._sum.creditBalance ?? 0)
+      : 0;
     const needsCreditApproval = receivableNeedsApproval(
-      input.payments,
+      // M-2: el umbral es por cliente (deuda abierta + esta venta), no por venta.
+      openDebt > 0 ? [...input.payments, { method: "cod", amount: openDebt }] : input.payments,
       setting?.data as any,
       can(actor.permissions, "sale:manage"),
     );
```
(Mejor aún, y decisión de la dueña: que `creditLimit 0` signifique «sin crédito» para quien no tiene `sale:manage`.)

---

## M-3 · MEDIO · Transferencia al vender: sin verificación, sin alerta y sin rechazo **[VERIFICADO]**

**Dónde:**
- `apps/api/src/sales.ts:964-969`: el pago queda en `pending_verification`.
- `cash.ts:47-54` (`cashExpected`): lo cuenta como esperado de transferencia aunque no esté verificado.
- `sales.ts:1453-1470` (`reject`): solo admite `entryType: "installment"`.
- `alerts.ts` no tiene ninguna regla para transferencias pendientes.

**Escenario** (vendedora):
```bash
p "$VEND" /sales "$(sale_body $CAJA $VAR 2 '[{"method":"transfer","amount":600,"bank":"Banco Inventado","reference":"0000"}]')"
#   → 201 FS-0000857, payments[0].status = pending_verification
p "$ADMIN" /payments/<id>/reject '{"reason":"no llegó"}'   # → 404 «El registro no existe.»
p "$VEND" /cash-sessions/$CAJA/close '{"countedCash":500,"countedCard":0,"countedTransfer":600,"delivered":0}'
#   → 201; expectedTransfer 600.00, differenceTransfer 0.00
```
No hay ninguna alerta de esa venta y el dashboard la cuenta en `revenue` y en `payments.transfer`.

**Impacto:** mercancía entregada contra una transferencia que nunca llega, por el monto de la venta (demo RD$ 600), con el cuadre en 0. Solo se descubre conciliando a mano con el banco. La única salida es anular, y anular solo puede el admin.

**Arreglo:** crear una alerta `transfer:<paymentId>` (severidad alta) al guardar una venta con transferencia y resolverla en `verify`. Además, permitir `reject` también en `entryType:"sale"`, convirtiendo ese importe en saldo por cobrar (`creditBalance += amount`, alerta `receivable`).
```diff
@@ sales.ts complete(), después de crear los pagos
+        for (const pay of await tx.payment.findMany({ where: { saleId: sale.id, method: "transfer" } }))
+          await tx.alert.create({ data: { key: "transfer:" + pay.id, type: "transfer_pending", severity: "high",
+            entityId: sale.id, branchId: actor.branchId,
+            message: `Transferencia de ${sale.number} por RD$ ${pay.amount} sin verificar.` } });
@@ sales.ts verify(), tras status ok
+      await tx.alert.updateMany({ where: { key: "transfer:" + id }, data: { status: "resolved" } });
```
(Agregar `transfer_pending` a la lista de M-1 que no se resuelve sola.)

---

## M-4 · MEDIO · El tope de salidas sin PIN se reinicia con cada turno **[VERIFICADO]**

**Dónde:** `apps/api/src/cash.ts:686-689` suma las salidas de `sessionId: session.id`, no las del usuario en el día.

**Escenario** (vendedora, fondo 3000): se repite 3 veces la secuencia `open(fondo) → movements out 1000 «pago mensajero» → close(countedCash=fondo−1000, delivered 0)`. Las tres salidas responden `201` sin PIN y cada cierre cuadra. `SUM(out)=3000.00` en 3 movimientos y 0 alertas. La apertura no pide nada porque se declara exactamente lo dejado.

**Impacto:** RD$ 1,000 por turno sin aprobación y sin límite de turnos por día (demo RD$ 3,000, todo el fondo).

**Arreglo:**
```diff
--- a/apps/api/src/cash.ts
+++ b/apps/api/src/cash.ts
@@
-        const outs = await tx.cashMovement.aggregate({
-          where: { sessionId: session.id, type: "out" },
+        // M-4: el tope es por usuaria y día de negocio, no por turno.
+        const dayStart = new Date(businessDate() + "T00:00:00-04:00");
+        const outs = await tx.cashMovement.aggregate({
+          where: { userId: actor.id, type: "out", createdAt: { gte: dayStart } },
           _sum: { amount: true },
         });
```

---

## M-5 · MEDIO · Mermas y ajustes de almacén sin aprobación y fuera del estado de resultados **[VERIFICADO]**

**Dónde:**
- `apps/api/src/inventory.ts:517-654` (`POST /inventory/adjustments`, `@Permit("inventory:write")`, que tiene el rol `warehouse`): un ajuste negativo no necesita aprobación ni genera alerta. El conteo físico, en cambio, sí exige `sale:manage` para aplicarse (`inventory.ts:1217-1219`).
- `merchandise.ts:327-…`: salidas «merma / dañado / vencido / muestra / uso interno».
- `reports.ts:368-387` (`costTotal` = solo ventas y devoluciones) y `reports.ts:572-581` (`income-statement`): no incluyen `InventoryMovement` de tipo `adjustment`, `waste`, `merchandise_exit` ni `count`.

**Escenario** (usuario `almacen@`, equipo aprobado):
```bash
p "$ALM" /inventory/adjustments "{\"variantId\":\"$VAR\",\"qty\":-20,\"reason\":\"conteo\"}"   # → 201, stock 30
```
El dashboard del día antes del ajuste daba `costTotal 280 | netProfit 347.12 | inventoryCost 2,795,360`. Después da `costTotal 280 | netProfit 347.12 | inventoryCost 2,783,360`. El estado de resultados no cambia («Ganancia neta 347.12»).

**Impacto:** se pueden sacar RD$ 12,000 a costo (20 u × 600) sin aprobación, y la utilidad que ve la dueña no baja. El rastro está en el kardex y la bitácora, pero ningún informe de dinero lo muestra.

**Arreglo:**
- Agregar al dashboard y al estado de resultados una línea «Mermas y ajustes de inventario».
- Pedir `sale:manage` (o alerta alta) para un ajuste negativo por encima de un umbral.

```diff
@@ reports.ts dashboard Promise.all
+      this.db.$queryRaw<any[]>`SELECT COALESCE(SUM(-qty*"unitCost"),0) AS loss FROM "InventoryMovement"
+        WHERE "branchId"=${actor.branchId} AND type IN ('adjustment','waste','merchandise_exit','count')
+        AND "createdAt">=${since} AND "createdAt"<=${until}`,
@@
-        netProfit: netProfit(net, cost, expense, fees),
+        shrinkage: Number(shrink[0].loss),
+        netProfit: money(d(netProfit(net, cost, expense, fees)).minus(shrink[0].loss)),
```

---

## M-6 · MEDIO · Venta offline en efectivo con precio más alto: nadie puede resolverla **[VERIFICADO]** (requiere `allowOfflineSales=true`)

**Dónde:**
- `apps/api/src/offline-sales.ts:44-81`. Para descartar hace falta `sale:manage` **y** ser quien sincronizó (`auditLog.userId = actor.id`), y además `paymentTotal == 0`, lo que nunca pasa porque todo pago es mayor que 0.
- `apps/web/src/pendingSales.ts:117-125`: si el precio subió y solo hay efectivo, la web lanza «Descarta esta venta y cóbrala nuevamente».
- `apps/web/src/Tienda.tsx:139-145`: con una venta pendiente de esa caja, la web no deja cerrar la caja.

**Escenario:** la vendedora sincroniza una venta offline con `expectedTotal 1000`, efectivo 1000, y precio actual 1100.
```
POST /sales/sync                       → conflict «Los precios o promociones cambiaron…»
offline-resolution discard (vendedora) → 403
offline-resolution discard (gerente)   → 404 «No existe una venta offline pendiente de este usuario.»
offline-resolution discard (admin)     → 404
```
`repricePendingSale` (ejecutado con `rp.mts`) responde «El precio aumentó y falta cobrar la diferencia. Descarta esta venta…».

**Impacto:**
- La mercancía ya salió, pero el stock no se descuenta.
- Hay RD$ 1,000 en la gaveta que el esperado no incluye.
- La caja no puede cerrarse desde ese equipo.
- La alerta queda abierta para siempre (es lo que la cola llamaba O1 y la auditoría anterior S-1; sigue sin salida).

**Arreglo:** que un gerente pueda «aceptar el precio capturado» con su PIN: `POST /sales/sync` con `managerPin` y `honorCapturedPrice: true` omite la comparación de `expectedTotal` y registra la diferencia como descuento autorizado (`discountRule: "manager_pin"`, motivo «Precio de la venta offline»). La alternativa es permitir el descarte a `sale:manage` de la sucursal (sin exigir que sea el mismo usuario) **creando** un `CashMovement in` por el efectivo cobrado y un ajuste de inventario por la mercancía entregada.

---

## B-1 · BAJO · Repreciar una venta offline más barata inventa un «cambio» **[VERIFICADO]**

**Dónde:** `apps/web/src/pendingSales.ts:102-104` y `apps/api/src/offline-sales.ts:181-190`. Este último exige que la rebaja en efectivo «quede registrada como cambio entregado».

**Escenario:** una venta offline cobrada en efectivo a 1210 (`expectedTotal 1210`) que ahora vale 1100. Al reenviarla con `expectedTotal 1100` queda `synced FS-0000859` con `tendered 1210 | amount 1100 | change 110`, y `offline-resolution reprice` responde `{ok:true}`.

**Impacto:** el cliente ya se fue con un recibo de 1210 y nunca recibió 110 de cambio. Esos RD$ 110 quedan en la gaveta como un sobrante que el cuadre no espera, y la cajera puede quedárselos con el cierre en 0.

**Arreglo:** en `offline-sales.ts` (reprice, solo efectivo, `previousTotal > currentTotal`), crear `cashMovement {type:"in", amount: previousTotal − currentTotal, reason:"Diferencia de precio de venta offline <número>"}`, para que el esperado coincida con la gaveta.

## B-2 · BAJO · Total de la recepción calculado con float **[VERIFICADO por cálculo]**

**Dónde:** `apps/api/src/inventory.ts:880-884` y `apps/api/src/merchandise.ts:425-428` usan `lines.reduce((s,l) => s + l.qty*l.cost, 0)`.

**Prueba:** en `f2.mts` hubo 92 diferencias en 200,000 casos al azar. Ejemplo: `qty 9.1 × cost 625.55` da 5,692.50 cuando el valor correcto (Decimal, redondeo hacia arriba en la mitad) es 5,692.51.

**Impacto:** ±RD$ 0.01 por recepción, en la deuda con el proveedor y en «Compras».

**Arreglo:** `money(lines.reduce((s,l)=>s.plus(d(l.qty).times(l.cost)), d(0)).plus(data.freight).plus(data.otherCosts))`.

## B-3 · BAJO · Se puede cerrar el mes de incentivos en curso **[VERIFICADO]**

**Dónde:** `apps/api/src/incentives.ts:662` solo rechaza meses futuros, y la web propone el mes actual por defecto (`Incentives.tsx:274`).

**Escenario:** el 2026-10-10, `POST /incentives/close {"month":"2026-10"}` responde `201`. La venta siguiente queda con `period 2026-11` y la nota «Venta de 2026-10 registrada después del cierre…». `DELETE` responde 404, porque no hay forma de reabrir.

**Arreglo:** `if (period >= businessMonth()) bad("Sólo se cierra un mes terminado.");`.

## B-4 · BAJO · Desgloses que siguen en bruto **[VERIFICADO: top; CÓDIGO: el resto]**

**Dónde:**
- `reports.ts:256-258` (`top`, neto por `returnedQty` sin tener en cuenta la fecha).
- `reports.ts:1094-1221` (reportes de tienda por caja o fecha).
- `reports.ts:897-907` (`customers`).
- `cash.ts:293-295` (línea «Total» del cuadre).

**Resultado:** el 2026-10-10 el dashboard da `revenue 740` y `Σtop 1100`. Daily, payments, sellers y category suman 740, igual que `by-payment` y `by-seller` en el rango 09–10 (20,750). D-05 está bien en lo que cubrió.

**Arreglo:** rotular «bruto» o restar las devoluciones como en D-05.

## B-5 · BAJO · La anulación reescribe días pasados **[VERIFICADO]**

**Dónde:** `reports.ts:156-160` filtra `status:'completed'` por la fecha de la venta.

**Escenario:** `GET /dashboard/summary?from=2026-10-09&to=2026-10-09` daba 20,250. Se anula FS-0000857 (venta del 09, RD$ 600) el día 10 y el día 09 baja esos 600. La devolución equivalente habría restado en el día 10. El cuadre (D-02) y los incentivos sí registran la anulación en la fecha en que ocurre.

**Arreglo:** decidir y documentar la política. Para el dashboard, restar las anulaciones por `AuditLog.void.createdAt`, igual que las devoluciones.

## B-6 · BAJO · Reembolso en efectivo de una venta cobrada con tarjeta **[VERIFICADO]**

**Dónde:** `sales.ts:1500` (`refundMethod` libre) y `sales.ts:1754-1761`, que solo pone tope al efectivo.

**Escenario:** el gerente vende FS-0000849 con tarjeta (1,100) y la devuelve con `refundMethod:"cash"`. Responde `201 NC-000001 refundAmount 1100`.

**Impacto:** convierte tarjeta (o nota de crédito) en efectivo. Lo hace solo `sale:manage` y queda registrado.

**Arreglo:** exigir el PIN de admin o una nota cuando el `refundMethod` no coincide con ningún pago de la venta.

## B-7 · BAJO · `costAvg` editable directamente **[VERIFICADO]**

**Dónde:** `apps/api/src/catalog.ts:158-165` (`variantSchema` incluye `costAvg`) y `catalog.ts:476-503` (`PATCH` con `.partial()`; la bitácora lo registra como `price_change`).

**Escenario:** el gerente hace `PATCH /variants/$VAR {"costAvg":1}` → `costAvg "1"`. No se crea ningún `InventoryMovement`. La venta siguiente da `grossProfit` de 664.40 → 1,927.80 y el valor del inventario baja 11,982.

**Arreglo:** `variantSchema.omit({ costAvg: true }).partial()` en el `PATCH`. Para corregir el costo, usar un ajuste de costo con su movimiento.

## Abiertos de la auditoría anterior (re-verificados el 2026-10-10)

- **D-07 [VERIFICADO]:** `sales.ts:1496` sigue con `operationId: uuid.optional()`. El mismo cuerpo enviado 2 veces sin clave dio NC-000001 y NC-000002 (180 + 180). **Arreglo:** `operationId: uuid,`.
- **D-09 [VERIFICADO]:** `cash.ts:105-118` sigue igual. Cerrar con 499 sin nota da `400 «agrega una nota»`; con 500 da `201`. `GET /sales?date=` sigue devolviendo los pagos propios.
- **D-10 [VERIFICADO]:** `cash.ts:878`, `if (row.differenceCash || …)` sobre `Prisma.Decimal`. En A-1 se grabó `close_difference` con una diferencia de 0.00. **Arreglo:** `Number(...)`.
- **D-11 [VERIFICADO]:** `sales.ts:1196-1197` sigue sin `@RequireTerminal()`. El admin con una sesión nueva **sin equipo** anuló FS-0000857 → `{"ok":true}`.
- **D-12:** la normalización `capturedAt < 2026-10-09T04:00Z` deja de aplicar sola cuando vence la ventana de 48 h (2026-10-11). No requiere cambios.

---

## Lo que está bien y por qué

| Control | Evidencia |
|---|---|
| Idempotencia offline | 8 `POST /sales` + 4 `POST /sales/sync` en paralelo con el mismo `offlineUuid` dieron **1** venta, 1 pago, 1 `IncentiveEntry` y stock −1. El candado consultivo por UUID está en `sales.ts:477`. |
| Stock bajo concurrencia | 9 ventas en paralelo desde 3 cajas sobre stock 2 dieron 2 vendidas, 4 «Stock insuficiente» y stock 0. Nunca quedó negativo (`lockVariant` FOR UPDATE en orden de id). |
| Consistencia entre tablas | Sobre todas las ventas del seed y de la prueba hubo 0 violaciones en: Σ`lineTotal` = `total`, Σpagos de venta = `total`, Σ`tax` = `taxTotal`, Σ`round(unitCost×qty)` = `costTotal`, Σlotes ≤ stock, `returnedQty` ≤ `qty`, Σpartes de cada devolución = `SaleReturn.total`, ningún stock negativo. |
| D-01 contraentrega | Con `allowCreditSales=false`, una contraentrega de 900 de la vendedora da 400 PIN; una de 1,200 da 400 PIN. |
| D-02 anular tras el cierre | La caja cerrada siguió con `expected 3000 | counted 3000 | diff 0.00` después de anular, y el esperado de la caja del admin bajó de 2000 a 1200. Sin caja abierta propia, la anulación se rechaza. |
| D-03 fondo | Con «Entregado» informado, abrir con menos de lo dejado da 400 con la nota y el PIN (pero ver A-2). |
| D-04 salidas | Dentro de un turno, una salida de 2,000 sin PIN da 400 (pero ver A-1 y M-4). |
| D-05 venta neta | En 3 rangos (09–10, 10, 01-sep–10) el dashboard da `revenue = Σdaily = Σpayments = Σsellers = Σcategory`, con 20,750 / 740 / 536,750. `by-payment` y `by-seller` suman igual. |
| D-06 tope de reembolso | Reembolsar en efectivo más de lo que hay en la caja da 400. |
| D-08 importes | Un movimiento de 0.004 da 400 «como máximo 2 decimales». Los gastos y pagos a proveedor usan `moneyAmount(1e7)`. |
| Incentivos | `tests/incentives-api.test.ts` dio 11/11 contra la API compilada. Las entradas se guardan como instantánea en la misma transacción. Hay un único índice por `(saleItemId, kind, refId)`. Los reversos de devolución usan redondeo acumulado. El cierre usa candado exclusivo/compartido por sucursal. El mes se calcula en `America/Santo_Domingo`. |
| Zona horaria | Los rangos usan `-04:00`. El SQL crudo compara con `AT TIME ZONE 'UTC'` (`reports.ts:50-51`). Las ventas de las 03:58 UTC cayeron en el día 2026-10-09 y las de las 04:01 UTC en el 10. |
| Redondeo de venta y devolución | `lineTotals` redondea bruto, importe e ITBIS y saca por diferencia el descuento y el neto. Las devoluciones parciales usan `returnedAt` acumulado (sin cambios desde el fuzz de 120 ventas y 90 devoluciones de la auditoría anterior). |
| Cierre con ventas en vuelo y orden de bloqueos | Venta, devolución, anulación, movimiento, abono y cierre toman `CashSession FOR UPDATE` antes de `Sale` y de las variantes. No encontré ningún ciclo de bloqueo entre las rutas nuevas (D-02 bloquea la caja original, luego la propia, luego la venta). |

## No verificado

- **Configuración de producción.** No conozco `allowCreditSales`, `allowOfflineSales`, `creditApprovalThreshold` ni `cashMovementApprovalLimit` en Render. M-2 solo aplica con crédito activado, y M-6 y B-1 con ventas offline (el seed las activa).
- **Web en navegador.** `repricePendingSale` se ejecutó como función pura (Node 22 con `--experimental-strip-types`). El bloqueo del cierre de caja (`Tienda.tsx:139-145`) y el comportamiento de «Entregado» vacío salen de leer el código; la API se probó directamente.
- **Cron de alertas en Render.** El `setInterval` de 24 h se reinicia en cada despliegue y no verifiqué si llega a ejecutarse. M-1 se reproduce igual porque cada `GET /alerts` evalúa.
- **Incentivo mayor que el precio.** En el seed no hay productos de Suplementos, Fajas o Maquillaje con precio menor que su tarifa (mínimos 1,600 / 1,100 / 450). Si la tienda tiene sobres o muestras baratos en esas categorías, la cajera gana más de incentivo que el precio cobrado. Es un riesgo de diseño que no comprobé con datos reales.
- **Bloqueos mutuos** entre anulación y devolución (S-2 anterior): no se reprodujeron. Por lectura no hay ciclo.
- **Node 24** (producción) frente a Node 22.22 (local).
- **Gastos y pagos a proveedor «en efectivo»:** no están ligados a ninguna gaveta. Si además se registra la salida de caja, el gasto se cuenta dos veces. Es de diseño y no lo probé.

## Entorno y limpieza

- Worktree `scratchpad/aud-money` (detached en `3e5521c`) con `pnpm install --frozen-lockfile`, `prisma generate` y `tsc` de la API.
- Clúster PostgreSQL 16 en `/var/lib/postgresql/aud-dinero01` (puerto 55601), con las bases `audm_tpl` (seed) y `audm_money`.
- API en el puerto 3601 con `NODE_ENV=production` y los límites de tasa elevados solo para las ráfagas.
- Al terminar se detuvieron la API y el clúster, se borró la carpeta del clúster y se eliminó el worktree.
