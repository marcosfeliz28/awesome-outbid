# Venta sin costo

Aún no desplegado (rama `claude-pc/venta-sin-costo`). Origen: el 8-nov el tablero mostró ganancia 35,598 con 28 facturas de brochas (PRD-001) vendidas a costo 0; la real era ~15,999.

Alcance acordado con la dueña (8-nov): **por ahora no se bloquea ninguna venta**. Ella carga primero los costos de los productos con existencia, después se revisa el recálculo hacia atrás, y el bloqueo se enciende cuando ella lo decida.

## 1. Bloqueo de venta (apagado por defecto)

- Configuración › «No vender productos sin costo» (`blockZeroCostSales`, `apps/api/src/admin.ts:98`, `apps/web/src/Management.tsx:4283`). Por defecto **apagado**. Un guardado de Configuración desde una pantalla vieja que no manda la clave conserva el valor guardado.
- Encendido, la caja no vende una variante activa con `costAvg` 0. Mensaje: «Este producto no tiene costo: pídele a la administración que lo complete. Producto: <nombre>.» (`apps/api/src/sales.ts:631-632`, `:995-999`).
- Todo camino que crea una venta pasa por `SalesController.complete` (`POST /sales`, `POST /sales/sync` y la revisión de ventas sin conexión `apps/api/src/offline-sale-review.ts:253`). No hay otra escritura de `Sale`/`SaleItem` (GV cobra cursos y servicios en sus propias tablas).
- Combos: se mira el costo de cada componente.
- La web no cambia: ante el error, el Punto de venta muestra el mensaje y **conserva el carrito** (el carrito solo se vacía tras una venta confirmada, `apps/web/src/POS.tsx`, `clearCart()` dentro del `try`).

### Excepciones (con el bloqueo encendido)

| Caso                                                               | Qué pasa                                                                                                                                 | Por qué                                                                    |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Servicio (`Product.unit = "servicio"`)                             | Se vende con costo 0.                                                                                                                    | No lleva inventario (`isService`, `packages/shared/src/index.ts:851-852`). |
| Venta sin conexión que llega a sincronizar, o revisión «entregada» | **Entra** (no se pierde) y queda marcada: aviso `zero_cost_sale` (solo la dueña) y bitácora `sale_zero_cost_accepted` (`sales.ts:1313`). | El dinero ya se cobró y la mercancía salió.                                |
| Devoluciones y notas de crédito                                    | Sin cambio: no crean ventas. Una venta pagada con nota de crédito sí exige costo.                                                        |                                                                            |
| Regalos / cortesías                                                | No existe regla: una venta con total 0 ya se rechaza.                                                                                    |                                                                            |

## 2. Lista de productos sin costo

- `GET /inventory/without-cost` (`apps/api/src/inventory.ts:620`). Permiso `profit:read` y nunca la vendedora (403). Solo la sucursal de quien pregunta. Devuelve `total`, `withStock` e `items` (nombre, SKU, precio, existencia), primero los que tienen existencia. Excluye servicios e inactivos.
- Pantalla: tarjeta «Productos sin costo» arriba de Inventario, solo si hay alguno (`apps/web/src/ZeroCost.tsx:20`, `apps/web/src/Management.tsx:850`). Lista simple, cabe a 390 px. El costo se completa en Productos (un cambio de costo a mano ya deja aviso `cost_change`).

## 3. Recálculo de costos (solo lectura)

- `GET /reports/cost-recalc?variantId=&from=AAAA-MM-DD&to=AAAA-MM-DD` (`apps/api/src/sales.ts:2251`). Permiso `profit:read`, nunca la vendedora. Todo opcional; fechas en hora de Santo Domingo.
- Lista cada factura vigente con líneas a costo 0 de variantes que **ya tienen costo**, con: costo actual → costo propuesto (el costo de hoy de la variante), cambio de costo por línea, `costTotal` antes → después, utilidad y margen antes → después, y los totales del período.
- Margen según la regla de la dueña: (total − costo) / total, **sin restar ITBIS**.
- `applicable: false` marca líneas de combo o con devolución (no se corrigen con la vía de abajo); su cambio cuenta 0 en los totales. `hasReturns: true` avisa que la factura tiene devoluciones: la utilidad de la fila no las descuenta.
- No incluye combos: su línea guarda la suma del costo de los componentes, así que un componente a costo 0 no deja la línea en 0, y la vía del punto 4 no corrige combos. Se revisan a mano.
- Fechas inválidas (p. ej. `2026-13-45`) devuelven 400.
- No cambia nada. Aplicar es la vía del punto 4, línea por línea, con PIN y bitácora. No hay todavía un «aplicar todo».

## 4. Corregir el costo de una factura ya hecha

- `POST /sales/:id/items/:itemId/cost` con `{ unitCost, expectedUnitCost, operationId, confirmAbovePrice?, reason (8-500), managerPin }` (`apps/api/src/sales.ts:2373`). Solo administración (`*`) con PIN de gerencia; equipo aprobado.
- Hace: `SaleItem.unitCost` y su `stockAllocations`, `Sale.costTotal` += (nuevo − viejo) × cantidad, el kárdex de esa salida (`InventoryMovement.unitCost`; si otra línea o un combo de la misma venta saca la misma variante y lote, el kárdex no se toca porque sus movimientos no se distinguen), y resuelve el aviso `zero_cost_sale` cuando la venta ya no tiene líneas en 0 (los servicios no cuentan). Reglas: `expectedUnitCost` es el costo que el administrador vio; si la línea ya tiene otro costo, se rechaza (409) y no se reescribe a gusto una línea ya costeada. `operationId` hace la operación idempotente: repetirla devuelve lo ya hecho sin otra línea en la bitácora. Un costo mayor que el precio de la línea pide `confirmAbovePrice` (la pantalla pregunta); más de 5 veces el precio se rechaza siempre.
- No toca: total, impuestos, descuentos, pagos, saldo, incentivos ni el efectivo esperado de la caja (sale de los pagos, `apps/api/src/cash.ts:55`). Probado con la caja cerrada.
- Bitácora `sale_item_cost_corrected`: quién (`userId`, equipo, IP), cuándo, antes (costo, costTotal) → después (costo, costTotal, cambio de ganancia, quién aprobó el PIN, motivo).
- No se corrige aquí: líneas de combo ni líneas con devolución (su devolución ya guardó el costo; cambiarlo descuadra) (`sales.ts:2444`, `:2414`).
- Pantalla: Ventas › ojo › panel «Costo pendiente» (solo `*`, ventas vigentes, solo líneas con costo 0) (`apps/web/src/Management.tsx:3439`).
- Efecto en reportes: baja la ganancia/margen de esa venta en todo lo que usa `Sale.costTotal` o `SaleItem.unitCost` (Resumen, informes, utilidad por producto, rentabilidad de la caja). La rentabilidad que muestra una caja cerrada también se recalcula, porque se calcula al consultarla; su efectivo no cambia.
- Acción directa con PIN (como «corregir método de pago») y no solicitud con aprobación: solo administración puede iniciarla, así que no hay una segunda persona que apruebe.

## 5. Riesgos

- Encender el bloqueo con productos con existencia y sin costo los vuelve invendibles. Encenderlo cuando la tarjeta diga 0 con existencia (o casi).
- **Riesgo abierto:** con el bloqueo encendido y «ventas sin conexión» activadas, una venta mandada por `POST /sales/sync` estando en línea también entra (marcada con aviso y bitácora).
- La corrección acepta ventas de cualquier fecha: corregir una venta de un mes ya entregado cambia la ganancia de ese mes (también el Informe formal).
- Con el bloqueo apagado no se crea aviso por venta: el recálculo es la herramienta para encontrarlas.
