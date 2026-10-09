# Revisión con IA de Fit Store · ronda 3

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

Fecha: 5 de octubre de 2026. Base: fuente de la ronda 3 en `/workspace/fitstore-pos`. ZIP de referencia: `fitstore-pos-ronda3.zip`.

La revisión se realizó sobre el código y con solicitudes a la API local de pruebas. Se usaron usuario, producto, proveedor y equipo de auditoría aislados; el usuario, producto y proveedor se desactivaron al finalizar. No se cambió la implementación ni el ZIP. Las pruebas de aceptación anteriores (16 unitarias, 57 de integración y seis de navegador) siguen siendo evidencia de los casos cubiertos; no detectan los tres escenarios de esta auditoría.

## P1 · Las entradas sin orden no se reflejan en compras

**Comprobado:** una entrada con proveedor, sin orden de compra, dos unidades a 15 y flete de 4 creó una recepción por 34. `GET /reports/purchases` mostró para ese proveedor `Compras: 0` y `Pendiente: 0`.

**Causa:** `apps/api/src/reports.ts:341` suma exclusivamente `PurchaseOrder.total`. Las nuevas recepciones con `orderId` nulo no se incluyen. Además, `GoodsReceipt` no conserva un campo propio para el proveedor; la creación en `apps/api/src/merchandise.ts:557` sólo enlaza la orden opcional.

**Corrección pedida a Claude:** conservar proveedor, total y vínculo con el comprobante en la recepción o en un documento de compra canónico; incluir compras sin orden en el reporte y definir cómo se contabilizan recepción parcial, flete, impuestos y pagos. Evitar contar una misma compra dos veces por tener orden y recepción.

**Prueba exigida:** proveedor nuevo + entrada sin orden de 34 → reporte muestra la compra; repetir el UUID no cambia el importe; una recepción con orden tampoco se suma dos veces; los filtros de sucursal y fechas siguen aplicándose.

## P1 · Las mutaciones antiguas permiten omitir el equipo

**Comprobado:** revocar un equipo invalidó su sesión anterior (401) y bloqueó registrar otra vez el mismo ID (400). Sin embargo, al iniciar sesión nuevamente y omitir `/terminals/register`, almacén pudo ejecutar `POST /inventory/adjustments` (201). El registro de auditoría guardó `terminalId: null`.

**Causa:** `apps/api/src/common.ts:169` verifica revocación solamente cuando la sesión ya tiene `terminalId`. Las rutas antiguas de ajuste no exigen equipo; `apps/api/src/sales.ts:60` también condiciona la comprobación de equipo a que exista ese campo.

**Alcance:** no permite acceso sin credenciales. El problema comprobado es que una nueva sesión autorizada puede omitir el control del equipo y producir movimientos sin el dato obligatorio de equipo. Revocar una sesión no equivale a revocar las credenciales del usuario.

**Corrección pedida a Claude:** exigir un equipo válido en las rutas que alteran stock o caja, con una política explícita de enrolamiento y revocación. Cubrir tanto Mercancía como ajustes, conteos, recepciones antiguas, ventas, devoluciones y anulación. No basar la identidad del equipo únicamente en un ID que el cliente puede sustituir libremente. Definir el tratamiento de integraciones autorizadas que no sean navegadores.

**Prueba exigida:** nueva sesión sin equipo → mutaciones rechazadas; equipo revocado → no puede operar ni eludir la comprobación omitiendo registro; equipo aprobado → operaciones correctas y auditoría con usuario, equipo y hora.

## P2 · Una entrada admite un lote inventado

**Comprobado:** una entrada de una variante sin lote obligatorio, con `lotId` aleatorio y sin `lotNumber`, devolvió 201. El kardex guardó ese UUID inexistente.

**Causa:** `apps/api/src/merchandise.ts:577` copia `line.lotId`. La rama de entrada sólo valida/crea lote si recibe `lotNumber`; de lo contrario transmite el ID sin validarlo a `stockChange`. `InventoryMovement.lotId` tampoco tiene una relación/FK que impida guardar un lote inexistente.

**Corrección pedida a Claude:** rechazar `lotId` en entradas si el flujo sólo admite lote por número, o validar que pertenezca a la variante y sucursal y actualizar sus existencias correctamente. Añadir integridad referencial donde corresponda.

**Prueba exigida:** lote inexistente, de otra variante o de otra sucursal → rechazo y rollback sin recepción ni cambio de stock. Una entrada válida con lote debe mantener coherentes stock de variante, cantidad de lote y kardex.

## Evidencia y siguiente revisión

Resultados originales: `docs/validacion/auditoria-ronda3.json`. Revisar estos tres puntos antes de pruebas en tienda. Cuando Claude entregue sus correcciones, auditar el código final y repetir estas reproducciones, además de las suites existentes. Cada hallazgo se cierra con evidencia de la corrección y de su regresión.

La auditoría cubre estos escenarios concretos; no es una certificación de toda la aplicación ni una prueba de hardware o despliegue de producción.

SHA-256 del ZIP auditado: `2ed7cb7667d40c0afceb7224bea14620b815d8f2b4541982345ba6e0497f074a`.
