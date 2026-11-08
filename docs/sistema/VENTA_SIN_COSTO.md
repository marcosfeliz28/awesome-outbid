# Venta sin costo

Aún no desplegado (rama `claude-pc/venta-sin-costo`). Origen: el 8-nov el tablero mostró ganancia 35,598 con 28 facturas de brochas (PRD-001) vendidas a costo 0; la real era ~15,999.

## 1. Regla

- La caja **no vende** una variante activa con `costAvg` 0 o vacío. Mensaje: «Este producto no tiene costo: pídele a la administración que lo complete. Producto: <nombre>.» (`apps/api/src/sales.ts:627-628`, `:994-995`).
- Todo camino que crea una venta pasa por `SalesController.complete` (`POST /sales`, `POST /sales/sync` y la revisión de ventas sin conexión `apps/api/src/offline-sale-review.ts:253`). No hay otra escritura de `Sale`/`SaleItem` (GV cobra cursos y servicios en sus propias tablas, no en `Sale`).
- Combos: se mira el costo de cada componente.
- La web no cambia: ante el error, el Punto de venta muestra el mensaje y **conserva el carrito** (el carrito solo se vacía tras una venta confirmada, `apps/web/src/POS.tsx`, `clearCart()` dentro del `try`).

## 2. Excepciones

| Caso                                             | Qué pasa                                                                                                                                      | Por qué                                                                    |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Servicio (`Product.unit = "servicio"`)           | Se vende con costo 0.                                                                                                                         | No lleva inventario (`isService`, `packages/shared/src/index.ts:850-851`). |
| Venta sin conexión que llega a sincronizar       | **Entra** (no se pierde) y queda marcada: aviso `zero_cost_sale` (solo la dueña) y bitácora `sale_zero_cost_accepted` (`sales.ts:1306-1330`). | El dinero ya se cobró y la mercancía salió.                                |
| Revisión de una venta sin conexión («entregada») | Igual que la anterior.                                                                                                                        | Misma razón.                                                               |
| Devoluciones y notas de crédito                  | Sin cambio: no crean ventas. Una venta pagada con nota de crédito sí exige costo.                                                             |                                                                            |
| Regalos / cortesías                              | No existe regla: una venta con total 0 ya se rechaza.                                                                                         |                                                                            |

## 3. Lista de productos sin costo

- `GET /inventory/without-cost` (`apps/api/src/inventory.ts:618`). Permiso `profit:read` y nunca la vendedora (403). Solo la sucursal de quien pregunta. Devuelve `total`, `withStock` e `items` (nombre, SKU, precio, existencia), primero los que tienen existencia. Excluye servicios e inactivos.
- Pantalla: tarjeta «Productos sin costo» arriba de Inventario, solo si hay alguno (`apps/web/src/ZeroCost.tsx:20`, `apps/web/src/Management.tsx:850`). Lista simple, cabe a 390 px. El costo se completa en Productos (cambio de costo a mano ya deja aviso `cost_change`).

## 4. Corregir el costo de una factura ya hecha

- `POST /sales/:id/items/:itemId/cost` con `{ unitCost, reason (8-500), managerPin }` (`apps/api/src/sales.ts:2243`). Solo administración (`*`) con PIN de gerencia; equipo aprobado.
- Hace: `SaleItem.unitCost` y su `stockAllocations`, `Sale.costTotal` += (nuevo − viejo) × cantidad, el kárdex de esa salida (`InventoryMovement.unitCost`; si otra línea o un combo de la misma venta saca la misma variante y lote, el kárdex no se toca porque sus movimientos no se distinguen), y resuelve el aviso `zero_cost_sale` cuando la venta ya no tiene líneas en 0 (los servicios no cuentan). Repetir la misma corrección no cambia nada ni duplica la bitácora.
- No toca: total, impuestos, descuentos, pagos, saldo, incentivos ni el efectivo esperado de la caja (sale de los pagos, `apps/api/src/cash.ts:55`). Probado con la caja cerrada.
- Bitácora `sale_item_cost_corrected`: quién (`userId`, equipo, IP), cuándo, antes (costo, costTotal) → después (costo, costTotal, cambio de ganancia, quién aprobó el PIN, motivo).
- No se corrige aquí: líneas de combo ni líneas con devolución (su devolución ya guardó el costo; cambiarlo descuadra) (`sales.ts:2288`, `:2292`).
- Pantalla: Ventas › ojo › panel «Costo pendiente» (solo `*`, ventas vigentes, solo líneas con costo 0) (`apps/web/src/Management.tsx:3439`).
- Efecto en reportes: baja la ganancia/margen de esa venta en todo lo que usa `Sale.costTotal` o `SaleItem.unitCost` (Resumen, informes, utilidad por producto, rentabilidad de la caja). La rentabilidad que muestra una caja cerrada también se recalcula, porque se calcula al consultarla; su efectivo no cambia.
- Se eligió acción directa con PIN (como «corregir método de pago») y no solicitud con aprobación: solo administración puede iniciarla, así que no hay una segunda persona que apruebe.

## 5. Riesgos

- Con productos con existencia y sin costo, al desplegar quedan invendibles hasta completar el costo. Plan: completar los costos desde la tarjeta antes de desplegar (o el mismo día, con la lista abierta) y desplegar cuando `withStock` sea 0 o casi.
- Con «ventas sin conexión» activadas, una venta mandada por `POST /sales/sync` estando en línea también entra (marcada con aviso y bitácora). Es el precio de no perder ventas reales sin conexión.
- La corrección acepta ventas de cualquier fecha: corregir una venta de un mes ya entregado cambia la ganancia de ese mes (también el Informe formal).
- Los combos y las líneas con devolución no se corrigen desde aquí; su aviso queda abierto hasta revisarlos a mano.
