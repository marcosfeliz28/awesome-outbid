# Auditoría final de dinero · Nexora POS

- **Rama auditada:** `origin/nexora-cloud` @ `ae765d1` (docs: órdenes v3 limpias), la que está en producción.
- **Fecha:** 2026-10-09.
- **Método:** lectura adversaria de `apps/api/src/{sales,cash,reports,offline-sales,inventory,admin,common}.ts` y `packages/shared/src/index.ts`, y pruebas contra la **API compilada** (`node dist/main.js`, `NODE_ENV=production`) sobre un PostgreSQL 16 propio (clúster aislado en el puerto 55491, bases `audm_money` y `audm_tpl` recreadas desde el seed oficial para cada escenario). Se usaron los tokens reales del seed (`vendedor@fitstore.demo`, rol `seller`; `gerente@…`, `admin@…`) y una «cajera» creada por el admin con `POST /users` (rol `seller`, el mismo que usa la tienda). No se modificó código; este archivo es el único cambio.
- **Convención:** **[VERIFICADO]** = lo reproduje contra la API y anoto la salida; **[SOSPECHA]** = sale de leer el código y no lo reproduje.

## Resumen

No encontré ningún defecto que **duplique o pierda ventas**, rompa la **idempotencia** o deje **stock o lotes inconsistentes**, ni siquiera con 4 cajas simultáneas (ver «Controles que resistieron»). La aritmética (ITBIS incluido y excluido, descuentos con decimales, pagos combinados, cambio y devoluciones parciales) cuadró al centavo en 120 ventas y 90 devoluciones generadas al azar.

Lo que sí hay son **agujeros de control que dejan salir mercancía o efectivo sin aprobación** y **descuadres que la propia API produce**:

| ID | Sev. | Hallazgo | Impacto (demo) |
|---|---|---|---|
| D-01 | **P1** | Una cajera o un vendedor despacha **contraentrega (`cod`) por cualquier monto**, sin PIN, sin el ajuste «ventas a crédito» y sin límite (un cliente nuevo tiene límite 0, que significa «sin límite») | RD$ 12,000 en una sola venta. No tiene tope |
| D-02 | **P2** | **Anular una venta de una caja ya cerrada** cambia ese cuadre después del cierre (sobrante ficticio) y no registra la salida de efectivo en la caja que paga el reembolso (faltante sin explicación) | ±RD$ 800 por venta anulada |
| D-03 | **P2** | El **fondo de apertura** se declara sin control: si se declara menos de lo que dejó el cierre anterior, ese efectivo sale sin diferencia, alerta ni marca | RD$ 1,000 por turno (todo el fondo) |
| D-04 | **P2** | Una **cajera registra «salidas» de efectivo** hasta el total esperado de la caja sin PIN ni tope, y el cierre ciego queda en cero | RD$ 2,999.99 de una caja con fondo de 3,000 |
| D-05 | **P2** | Los **reportes no usan una misma definición de venta neta**: en una misma respuesta del dashboard, «ingresos» descuenta devoluciones y el gráfico diario, los vendedores, las categorías y los métodos de pago no | 2,400 frente a 1,600 (+50 %) |
| D-06 | P3 | Una devolución en efectivo no comprueba el efectivo de la caja ni el método con que se pagó (venta con tarjeta reembolsada en efectivo, esperado negativo) | −RD$ 800 esperado |
| D-07 | P3 | `operationId` es opcional en `POST /returns`: un reintento sin la clave duplica la devolución y el reembolso | ×2 el reembolso |
| D-08 | P3 | Los importes de movimientos de caja, gastos y pagos a proveedor no validan los 2 decimales ni un máximo: con 0.004 se graba un movimiento de 0.00 y con 1e15 la API responde 500 | Ruido y error 500 |
| D-09 | P3 | El cierre «ciego» no es ciego: el error que pide nota revela si el conteo es exacto, y `GET /sales?date=` permite reconstruir el esperado | Habilita quedarse con sobrantes |
| D-10 | P3 | La auditoría `close_difference` se graba en **todo** cierre (Decimal siempre es verdadero), aunque la diferencia sea 0 | Bitácora engañosa |
| D-11 | P3 | `POST /sales/:id/void` no exige equipo registrado (`@RequireTerminal`), a diferencia del resto de rutas de dinero | Un token robado anula desde cualquier equipo |
| D-12 | P3 | Las ventas offline con `capturedAt` anterior a `2026-10-09T04:00Z` aceptan descuentos **sin motivo** (normalización heredada) | Solo el motivo; caduca sola el 2026-10-11 |

**Prioridad antes de abrir:** D-01. Después, D-02, D-03 y D-04, que permiten sacar efectivo sin que el cuadre lo muestre. D-05 confunde a la dueña, pero no mueve dinero.

---

## Reproducción común

Contra producción **no** se ejecutó nada. Los pasos sirven igual en local o en un entorno de pruebas:

```bash
API=http://127.0.0.1:3491/api           # API compilada local
J='content-type: application/json'
tok() { curl -s -X POST $API/auth/login -H "$J" -d "{\"login\":\"$1\",\"password\":\"$2\"}" | jq -r .accessToken; }
ADMIN=$(tok admin@fitstore.demo "$PW"); VEND=$(tok vendedor@fitstore.demo "$PW"); GER=$(tok gerente@fitstore.demo "$PW")
# Equipo de cada usuario (el del vendedor lo aprueba el admin)
reg() { curl -s -X POST $API/terminals/register -H "$J" -H "authorization: Bearer $1" -d "{\"id\":\"$2\",\"name\":\"Caja\",\"secret\":\"$(openssl rand -hex 24)\"}"; }
T=$(uuidgen); reg $VEND $T; curl -s -X POST $API/terminals/$T/approve -H "authorization: Bearer $ADMIN"
CAJA=$(curl -s -X POST $API/cash-sessions/open -H "$J" -H "authorization: Bearer $VEND" -d '{"openingAmount":1000}' | jq -r .id)
VAR=<id de variante sin lote, precio 800>; CLI=<id de cliente>
```

Los scripts completos de cada escenario (`s1`…`s7`) están en el scratchpad de la sesión de auditoría (`audm/`). No se suben al repo porque el encargo era no modificarlo.

---

## D-01 · P1 · Contraentrega sin aprobación ni límite **[VERIFICADO]**

**Dónde**
- `apps/api/src/sales.ts:366-370` (`approve`): el umbral de aprobación solo suma `method === "credit"`.
- `apps/api/src/sales.ts:632-635`: «ventas a crédito desactivadas» y la fecha de vencimiento solo se exigen a `credit`.
- `apps/api/src/sales.ts:623-630`: el límite solo se aplica si `creditLimit > 0`. Un cliente nuevo tiene `@default(0)` (`schema.prisma:199`), y un vendedor puede crearlo (`POST /customers`, `customers:write`).
- `apps/web/src/POS.tsx:1437-1441`: la caja tampoco pide PIN para `cod`.

**Entrada exacta** (token de vendedor; `allowCreditSales` sin activar, como en el seed):
```bash
NC=$(curl -s -X POST $API/customers -H "$J" -H "authorization: Bearer $VEND" -d '{"name":"Cliente Fantasma","phone":"8095550000"}' | jq -r .id)
curl -s -X POST $API/sales -H "$J" -H "authorization: Bearer $VEND" -d "{
 \"offlineUuid\":\"$(uuidgen)\",\"customerId\":\"$NC\",\"cashSessionId\":\"$CAJA\",
 \"items\":[{\"variantId\":\"$VAR\",\"qty\":15}],\"payments\":[{\"method\":\"cod\",\"amount\":12000}]}"
```
**Resultado:** `201`, `total 12000`, `creditBalance 12000`. Como control, la misma venta con `"method":"credit"` responde `400 «Las ventas a crédito están desactivadas en Ajustes.»`. En `s1` también pasaron 10 unidades (RD$ 8,000) a un cliente existente.

**Impacto:** la mercancía sale del inventario como cuenta por cobrar y no hay ningún tope por venta, cliente ni día. La única huella es la alerta `receivable`. Cobrar después solo puede hacerlo el admin, pero despachar puede hacerlo cualquier vendedor.

**Diff mínimo** (tratar `cod` como el crédito ante el umbral de aprobación; la caja ya pide PIN en ese caso):
```diff
--- a/apps/api/src/sales.ts
+++ b/apps/api/src/sales.ts
@@ -366,3 +366,5 @@ private async approve(actor: Actor, input: SaleInput) {
-    const credit = input.payments
-      .filter((p) => p.method === "credit")
+    // Contraentrega es la misma cuenta por cobrar que el crédito: la mercancía
+    // sale sin cobrar y requiere la misma aprobación.
+    const credit = input.payments
+      .filter((p) => p.method === "credit" || p.method === "cod")
       .reduce((sum, p) => sum + p.amount, 0);
@@ -856,1 +858,1 @@
-        if (credit && approvedBy)
+        if ((credit || cod) && approvedBy)
--- a/apps/web/src/POS.tsx
+++ b/apps/web/src/POS.tsx
@@ -1438,3 +1438,3 @@
     payments
-      .filter((p) => p.method === "credit")
+      .filter((p) => p.method === "credit" || p.method === "cod")
       .reduce((sum, p) => sum + p.amount, 0) >
```
Complemento recomendado (decisión de la dueña): que `creditLimit = 0` signifique «sin crédito» para quien no tenga `sale:manage`, y un ajuste `allowCodSales`. Regresión: la venta de arriba debe dar `400 «requiere el PIN de un gerente»` y pasar con PIN.

---

## D-02 · P2 · Anular después del cierre descuadra dos cajas **[VERIFICADO]**

**Dónde:** `apps/api/src/sales.ts:1133-1269` (`voidSale`). Si la caja original está cerrada, `refreshClosedCash` (`:1248-1259`) recalcula su esperado. Nada registra de qué cajón sale el reembolso. Además la ruta no tiene `@RequireTerminal()` (D-11).

**Entrada exacta** (escenario `s4`):
1. El vendedor abre su caja con 1000, hace 2 ventas en efectivo de 800 y cierra con `countedCash: 2600`. Diferencia: 0.
2. Abre la caja B con 1000.
3. El admin ejecuta `POST /sales/<venta1>/void {"reason":"cliente devolvió al día siguiente"}` → `201`.

**Resultado:**
- Caja A (cerrada): `expectedCash 1800 | countedCash 2600 | differenceCash +800`. Aparece un sobrante después del cierre.
- Caja B: el esperado sigue en 1000. Si la cajera entrega los 800 del reembolso y cuenta 200, cierra con `cash: -800`.

**Impacto:** cada anulación de una venta de días anteriores fabrica un sobrante en una caja ya entregada y un faltante en otra, sin vínculo entre ambos. Por el monto de la venta (demo: RD$ 800).

**Diff mínimo:** si hay efectivo y la caja original cerró, obligar a usar una devolución, que sí registra la caja que reembolsa:
```diff
--- a/apps/api/src/sales.ts
+++ b/apps/api/src/sales.ts
@@ -1133,2 +1133,3 @@
   @Post("sales/:id/void")
+  @RequireTerminal()
   @Permit("*")
@@ -1161,2 +1162,10 @@
       if (sale.status !== "completed" || sale.returns.length)
         bad("La venta ya está anulada o tiene devoluciones.");
+      // Anular no registra de qué cajón sale el reembolso. Si la caja de la
+      // venta ya cerró, el efectivo se devuelve con una devolución desde la
+      // caja que lo entrega.
+      if (
+        originalCash?.closedAt &&
+        sale.payments.some((p) => p.method === "cash" && Number(p.amount) > 0)
+      )
+        bad("La caja de esta venta ya cerró: registra una devolución desde tu caja.");
```

---

## D-03 · P2 · Fondo de apertura declarado sin control **[VERIFICADO]**

**Dónde:** `apps/api/src/cash.ts:482-525` (`open`). `openingAmount` se acepta tal cual. `opening-suggestion` (`:776-793`) solo propone el valor y no lo comprueba.

**Entrada exacta** (`s7`): el día 1 se cierra con `delivered: 800`, así que quedan 1000 de fondo y `GET /cash-sessions/opening-suggestion` devuelve `{"amount":1000}`. El día 2: `POST /cash-sessions/open {"openingAmount":0}` → `201`. Se vende 800 en efectivo y se cierra con `countedCash: 800`.

**Resultado:** caja 2 = `opening 0 | expected 800 | counted 800 | difference 0.00`. **0 alertas.** La bitácora solo tiene `open, close, close_difference` (este último es D-10).

**Impacto:** el fondo completo (RD$ 1,000 en la demo) puede salir cada turno sin que ningún cuadre lo muestre. Solo se nota comparando a mano el «dejado» de un impreso con el «fondo» del siguiente.

**Diff mínimo** (alerta y auditoría si lo declarado no coincide con lo dejado en el último cierre del equipo):
```diff
--- a/apps/api/src/cash.ts
+++ b/apps/api/src/cash.ts
@@ -520,4 +520,22 @@
         const row = await tx.cashSession.create({
           data: { ...data, userId: actor.id, branchId: actor.branchId },
         });
+        const last = await tx.cashSession.findFirst({
+          where: { branchId: actor.branchId, registerId: data.registerId, closedAt: { not: null } },
+          orderBy: { closedAt: "desc" },
+        });
+        const left = (last?.closeDetails as any)?.left;
+        if (left !== undefined && left !== null && !d(left).eq(data.openingAmount))
+          await tx.alert.create({
+            data: {
+              key: "opening:" + row.id,
+              type: "cash_difference",
+              severity: "high",
+              entityId: row.id,
+              branchId: actor.branchId,
+              message: `Fondo declarado RD$ ${data.openingAmount}; el cierre anterior dejó RD$ ${left}.`,
+            },
+          });
         await audit(tx, actor, "open", "cash", row.id, undefined, row);
```

---

## D-04 · P2 · Salidas de efectivo de la cajera sin PIN **[VERIFICADO]**

**Dónde:** `apps/api/src/cash.ts:550-582` (`movement`, `@Permit("cash:write")`, que también tiene el rol `seller`). Solo impide que el esperado quede por debajo de cero.

**Entrada exacta** (`s4`): el vendedor abre con 3000 y envía `POST /cash-sessions/$CAJA/movements {"type":"out","amount":2999.99,"reason":"pago mensajero"}` → `201`. Cierra con `countedCash: 0.01` y sin nota → `201`, diferencia 0.

**Impacto:** todo el efectivo del turno, con un motivo libre. Solo queda en el cuadre como «salidas» y en la bitácora.

**Diff mínimo:** pedir el PIN de un gerente en las salidas de quien no gestiona ventas, con el mismo patrón de `transfer` (`cash.ts:606-625`):
```diff
@@ -558,6 +558,9 @@ async movement(
       z.object({
         type: z.enum(["in", "out"]),
-        amount: z.number().positive(),
+        amount: moneyAmount(10000000),
         reason,
+        managerPin: z.string().regex(/^\d{4,6}$/).optional(),
       }),
       body,
     );
+    let approvedBy: string | null = null;
+    if (data.type === "out" && !can(actor.permissions, "sale:manage")) {
+      if (!data.managerPin) bad("Una salida de efectivo requiere el PIN de un gerente.");
+      approvedBy = await verifyPinAttempt(this.db, "approval:" + actor.id, /* mismo bucle de gerentes que transfer() */ …);
+    }
+    const { managerPin: _pin, ...movement } = data;
```
(Pseudocódigo en la línea del PIN: copiar el bucle de `transfer()`; importar `moneyAmount` de `@fitstore/shared`; guardar `approvedBy` en la auditoría y crear `movement` en lugar de `data`.) El cambio de `amount` también cierra D-08 para esta ruta.

---

## D-05 · P2 · Reportes con distintas definiciones de venta neta **[VERIFICADO]**

**Dónde**
- `apps/api/src/reports.ts:219-221`: `revenue` = ventas menos devoluciones (por fecha de la devolución). Es **neto**.
- `reports.ts:154-156` (`daily`), `:157-159` (`category`), `:162-177` (`payments`), `:181-183` (`sellers`): **bruto**, sin devoluciones.
- `reports.ts:549-557` (`by-seller`), `:558-601` (`by-payment`), `:711-721` (`customers`) y los reportes de la tienda `venta-diaria-usuario` y `venta-por-forma-pago` (`:831-1036`): **bruto**.
- `profit`, `abc` e `income-statement`: neto. `top`: neto por `returnedQty`, sin importar la fecha.

**Entrada exacta** (`s4`): 3 ventas de 800 en el día y una devolución en efectivo de 800. Luego `GET /dashboard/summary?from=HOY&to=HOY` y `GET /reports/{by-seller,by-payment,sales,profit}?from=HOY&to=HOY`.

**Resultado:**
```
dashboardRevenue 1600 | dashboardDailySum 2400 | dashboardSellersSum 2400 | dashboardCategorySum 2400
dashboardPaymentsSum 2400 | reportBySeller 2400 | reportByPaymentVentas 2400
reportSales Total−Devoluciones 1600 | profit Ventas sin ITBIS 1355.94 (neto)
```
**Impacto:** con devoluciones, la dueña ve en la misma pantalla un total de 1,600 y barras que suman 2,400. «Ventas en efectivo» por método no coincide con el efectivo del cuadre (que sí resta reembolsos). No mueve dinero, pero lleva a pensar que falta dinero que no falta, o a no ver el que sí falta.

**Diff mínimo** (dashboard; aplicar la misma idea a `by-seller` y `by-payment` con una fila o columna «Devoluciones»):
```diff
@@ reports.ts:154 daily
-      >`SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM-DD') AS day, SUM(total) AS total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${since} AND "createdAt"<=${until} GROUP BY day ORDER BY day`,
+      >`SELECT day, SUM(total) AS total FROM (
+          SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM-DD') AS day, total FROM "Sale"
+            WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${since} AND "createdAt"<=${until}
+          UNION ALL
+          SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santo_Domingo','YYYY-MM-DD'), -total FROM "SaleReturn"
+            WHERE "branchId"=${actor.branchId} AND "createdAt">=${since} AND "createdAt"<=${until}
+        ) x GROUP BY day ORDER BY day`,
@@ reports.ts:181 sellers
-      >`SELECT u.name,SUM(s.total) AS total FROM "Sale" s JOIN "User" u ON u.id=s."sellerId" WHERE … GROUP BY u.name ORDER BY total DESC`,
+      >`SELECT u.name, SUM(x.total) AS total FROM (
+          SELECT "sellerId", total FROM "Sale" WHERE "branchId"=${actor.branchId} AND status='completed' AND "createdAt">=${since} AND "createdAt"<=${until}
+          UNION ALL
+          SELECT s."sellerId", -r.total FROM "SaleReturn" r JOIN "Sale" s ON s.id=r."saleId" WHERE r."branchId"=${actor.branchId} AND r."createdAt">=${since} AND r."createdAt"<=${until}
+        ) x JOIN "User" u ON u.id=x."sellerId" GROUP BY u.name ORDER BY total DESC`,
```
Si se prefiere no tocar SQL: rotular esas series como «bruto» y mostrar las devoluciones aparte.

---

## D-06 · P3 · Reembolso en efectivo sin comprobar caja ni método **[VERIFICADO]**

**Dónde:** `apps/api/src/sales.ts:1377` (`refundMethod` libre) y `:1622` (`refundAmount`). No hay un control equivalente al de `movement` (`cash.ts:571-575`).

**Entrada exacta** (`s7`, gerente): abre con 0, vende 800 con tarjeta y luego `POST /returns {…,"refundMethod":"cash",…}` → `201`. `GET /cash-sessions` → `expected.cash = -800`, `expected.card = 800`.

**Impacto:** una venta con tarjeta se convierte en efectivo, y la caja esperada queda en negativo. Solo puede hacerlo `sale:manage`, pero no se verifica nada.

**Diff mínimo:**
```diff
@@ sales.ts:1622
       const refundAmount = money(total.minus(debtReduction));
+      if (data.refundMethod === "cash" && refundAmount > 0) {
+        const expected = await cashExpected(tx, await tx.cashSession.findUniqueOrThrow({ where: { id: data.cashSessionId } }));
+        if (d(refundAmount).gt(expected.cash)) bad("No hay suficiente efectivo en caja para este reembolso.");
+      }
```
Para elegir el método según el pago original hace falta una decisión de política; recomiendo pedir nota o PIN de admin cuando sea efectivo y la venta no tuvo efectivo.

---

## D-07 · P3 · Devolución sin `operationId` se duplica **[VERIFICADO]**

**Dónde:** `apps/api/src/sales.ts:1373` (`operationId: uuid.optional()`).

**Entrada exacta** (`s5`, 3b): el mismo cuerpo de `POST /returns` sin `operationId`, enviado 2 veces en paralelo → `201 201`, y quedan **2** devoluciones más con su reembolso. Con `operationId`, 5 reintentos dejaron 1. La web actual sí manda la clave (`Management.tsx:2826`), así que el riesgo viene de otros clientes, scripts o PWAs viejas.

**Diff mínimo:** `operationId: uuid,` (obligatoria).

---

## D-08 · P3 · Importes sin 2 decimales ni máximo **[VERIFICADO]**

**Dónde:** `cash.ts:561` (movimientos), `admin.ts:392` (pagos a proveedor), `admin.ts:453` (gastos): `z.number().positive()`.

**Resultado** (`s4`): `{"type":"out","amount":0.004}` → `201` y se graba `0.00`. `{"type":"in","amount":1e15}` → `500 «No se pudo completar la operación»`.

**Diff mínimo:** usar `moneyAmount(10000000)` de `@fitstore/shared` en las tres rutas.

---

## D-09 · P3 · El cierre «ciego» deja ver el esperado **[VERIFICADO]**

**Dónde:** `cash.ts:102-115` (`cashCloseRequiresNote`: para la cajera, cualquier diferencia exige nota) y `sales.ts:1078-1131` (`GET /sales` devuelve los pagos propios).

**Resultado** (`s4`): cerrar con el conteo exacto menos 1 y sin nota → `400 «agrega una nota…»`. Con el conteo exacto cierra. Además, sumar los pagos en efectivo de `GET /sales?date=HOY` más el fondo dio **2600 = esperado real**.

**Impacto:** la cajera sabe si su conteo cuadra antes de entregar la caja, y puede quedarse con un sobrante (cambio de menos, redondeos) sin que aparezca.

**Diff mínimo:** para quien no ve el esperado, aceptar el cierre siempre y dejar que la alerta (`cash.ts:746-767`) avise al gerente:
```diff
-  return canViewCashExpected(actor)
-    ? Math.max(...values) > differenceLimit
-    : values.some((value) => value > 0);
+  return canViewCashExpected(actor) && Math.max(...values) > differenceLimit;
```

---

## D-10 · P3 · `close_difference` en todo cierre **[VERIFICADO]**

**Dónde:** `cash.ts:744`: `if (row.differenceCash || …)`. Son objetos `Prisma.Decimal` y siempre se evalúan como verdaderos.

**Resultado** (`s7`): una caja con diferencia `0.00` tiene la auditoría `close_difference`.

**Diff:** `if (Number(row.differenceCash) || Number(row.differenceCard) || Number(row.differenceTransfer))`.

---

## D-11 · P3 · Anular sin equipo registrado **[VERIFICADO]**

`POST /sales/:id/void` con el token de un admin que **no registró equipo** → `201 {"ok":true}` (`s7`). Todas las demás rutas que mueven dinero o inventario tienen `@RequireTerminal()`. El diff está incluido en D-02.

---

## D-12 · P3 · Descuento offline «heredado» sin motivo **[VERIFICADO]**

**Dónde:** `sales.ts:181-200` (`normalizeLegacyOfflineDiscount`, corte `2026-10-09T04:00:00Z`).

**Resultado** (`s6`): una venta sincronizada por el gerente con `capturedAt 2026-10-09T03:59Z` y 50 % de descuento sin `discountReason` → `synced`, motivo «Venta offline heredada (sin motivo registrado)». No salta el PIN: un vendedor por encima del 10 % sigue necesitándolo. Desaparece sola cuando pasen las 48 h de la ventana offline (2026-10-11). Basta con saberlo; no hace falta cambio.

---

## Sospechas no reproducidas

- **S-1 (P3).** Una venta «sin respuesta» se guarda para confirmar **sin el PIN de gerente** (`POS.tsx:1566`). Si el primer intento no llegó al servidor y la venta necesitaba PIN (descuento o crédito), al sincronizar queda en conflicto. Descartarla exige `paymentTotal = 0` (`offline-sales.ts:78`), que nunca se cumple porque todo pago es > 0, y además la descarta solo su dueño con `sale:manage`. La venta queda varada (mercancía entregada y stock sin descontar) hasta reenviarla con PIN. No es pérdida de datos, porque la alerta queda abierta, pero conviene un flujo para resolverla.
- **S-2 (P3).** Una anulación (bloquea la caja de la venta y luego `Sale`) y una devolución (bloquea la caja que reembolsa y luego `Sale`) en cajas distintas toman los bloqueos en orden diferente. Puede haber un *deadlock* resuelto por PostgreSQL como error 500 y *rollback*, sin corrupción. En `s5` (misma venta, anular y devolver a la vez) el resultado fue correcto: una gana y la otra recibe `400`.
- **S-3 (diseño).** Una venta offline puede retrofecharse hasta 48 h dentro del horario de su caja (`capturedAt`). Cuadra con su caja, pero mueve ventas a días cuyos reportes ya se imprimieron.

---

## Controles que resistieron (hechos verificados)

| Prueba | Resultado |
|---|---|
| 12 reintentos **en paralelo** del mismo `offlineUuid` (6 por `/sales` y 6 por `/sales/sync`) | 1 venta, 1 pago, stock −1 |
| Mismo UUID con otro contenido, en paralelo | `201` y `400 «El UUID ya corresponde a otra venta.»` |
| UUID de otro vendedor | `403` |
| **4 cajas** (2 cajeras, vendedor y gerente), 8 ventas a la vez, stock 3 | 3 ventas, stock 0, 3 movimientos; nunca negativo |
| **4 cajas**, 12 ventas a la vez sobre una variante con 2 lotes (3 y 5) | 8 ventas; FEFO correcto (A: 3, B: 5); ambos lotes en 0 y stock en 0 |
| 4 cobros COD de 60 % a la vez | 1 aceptado, saldo 320, cobrado 480 |
| 4 devoluciones de 2 u. a la vez (vendidas 3) | 1 aceptada, `returnedQty` 2 |
| 5 reintentos con la misma `operationId` | 1 devolución |
| Nota de crédito usada a la vez en 2 cajas | 1 venta; la otra `400 «Saldo insuficiente»`; saldo 0 |
| Anular y devolver la misma venta a la vez | Una gana y la otra recibe `400`; stock +2 una sola vez |
| 5 ventas y el cierre de la caja a la vez | Las ventas posteriores al cierre son rechazadas y el esperado incluye exactamente las aceptadas |
| Fuzz de 120 ventas (ITBIS incluido/excluido, qty 0.333/1.25, % 7.77/33.333, montos 10.555, global 2.5 %, pagos tarjeta+transferencia+efectivo con cambio) | 0 violaciones: Σlíneas = total, Σpagos = total, ofrecido − cambio = total, subtotal − desc (+ ITBIS) = total |
| 90 devoluciones parciales (25 %, 50 % como merma, 100 %) en 30 ventas | Al cerrar cada venta: Σtotal = total, ΣITBIS = ITBIS, Σreembolso = total |
| Combo con componentes 1.5 y 0.333, devuelto en 3 partes | Σcosto = costo de la venta; stock y costo promedio restaurados; medio combo rechazado |
| Esperado de caja de la API frente a un cálculo independiente (apertura + efectivo − reembolsos) | Idénticos (576,306.79) |
| Terminal ocupado: la cajera inicia sesión en el equipo del vendedor | Abrir caja `409`; vender en la caja ajena `403` |
| Traslado de caja | Sin PIN `400`; PIN incorrecto `400`; PIN de gerente `201` |
| Venta offline en caja propia ya cerrada (dentro de su horario) | Se acepta y recalcula la diferencia (comportamiento documentado) |

## Matriz de permisos (tokens reales de vendedor y de cajera)

Rol `seller` = `catalog:read, sale:write, cash:write, customers:write`. Ambos dieron **el mismo resultado**:

| Endpoint de dinero | Vendedor / cajera |
|---|---|
| `POST /sales`, `POST /sales/sync` | ✅ permitido (propio). **Incluye `cod` sin límite (D-01)** |
| `POST /cash-sessions/open`, `close` (propia), `transfer` (con PIN) | ✅ permitido |
| `POST /cash-sessions/:id/movements` (propia) | ✅ permitido, **salidas sin PIN (D-04)** |
| `POST /cash-sessions/:id/movements|close` (caja ajena) | `403` |
| `GET /cash-sessions/:id/cuadre` propia abierta / ajena | `400 «Cierra la caja»` / `403` |
| `GET /cash-sessions` | Solo las propias, sin esperado ni diferencias |
| `POST /sales/:id/void` | `403` (solo admin) |
| `POST /returns` | `403` (`sale:manage`) |
| `POST /sales/:id/installments`, `cod-collections`, `payments/:id/verify|reject`, `GET /cod/pending` | `403` (solo admin) |
| `GET /dashboard/summary`, `GET /reports/*` (incluidos `by-payment`, `cash`, `venta-por-forma-pago`) | `403` |
| `PUT /settings`, `POST /expenses`, `POST /supplier-payments`, `POST /inventory/adjustments` | `403` |
| `GET /credit-notes?customerId=` | `200` sin código de canje (solo saldos) |
| `GET /sales`, `GET /sales/:id/receipt.pdf` | Solo las propias (venta ajena → `404`) |
| `POST /customers` | ✅ crear; definir `creditLimit` → `400` (solo gerente). Un cliente nuevo queda con límite 0 = sin límite (D-01) |

## Entorno de prueba

- Worktree desacoplado en `origin/nexora-cloud` (`ae765d1`), `pnpm install --frozen-lockfile --offline`, `prisma generate`, `tsc` de la API. Node 22.22 local (producción usa Node 24).
- PostgreSQL 16 del sistema en un clúster propio (puerto 55491), bases `audm_tpl` (seed) y `audm_money` (copia por escenario). La API se lanzó con `NODE_ENV=production`, `SALES_SESSION_RATE_LIMIT=100000` (solo para que el limitador no interfiriera con las ráfagas) y `connection_limit=20`.
- Al terminar se detuvieron la API y el clúster por PID y se borraron las bases.
