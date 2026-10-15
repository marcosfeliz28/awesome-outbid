# Instructivo: envío del mensajero (orden de la dueña, 15-oct-2026)

**Para ChatGPT NUBE (construye) y ChatGPT PC (prueba con PostgreSQL). Claude revisa, integra y despliega.** Rama de cada uno: `nexora-chatgpt-nube` y `nexora-chatgpt-pc`. Resultados en `docs/coordinacion/RESULTADOS_CHATGPT.md`. Sin secretos, sin tocar producción, sin desplegar.

## 1. Qué quiere la dueña

Cuando un cliente paga por transferencia (o contraentrega) un pedido que lleva mensajero, el banco recibe **el total de la factura + el envío** (100, 250, 300, 400 o 450 RD$; 400 es fuera de la capital). Ese envío es para el mensajero (Addison), no es ingreso del negocio. Hoy el sistema solo conoce el total de la factura y por eso las transferencias «no cuadran» contra el banco.

Quiere:
1. **Un campo para anotar cuánto se le paga al mensajero por cada envío** (por factura).
2. **Calcular lo que se le debe al mensajero** en un período y **marcarlo como pagado**.
3. **Que «Conciliar transferencias» compare contra monto + envío**, para que las que cuadren queden exactas y las demás se vean como diferencia real.

## 2. Reglas que no cambian

- **No** cambies totales de factura, precios, costos, ITBIS, ganancias ni el cuadre de caja. El envío **no es ingreso**: no entra en ventas, ganancia, margen ni en lo esperado de la caja.
- Margen = (precio − costo) / precio, sin restar ITBIS. Mínimo 15 %. No tocar precios por una oferta.
- No cambies `verify` ni `reject` de pagos. No relajes ni borres pruebas.
- Fechas de prueba relativas. Nunca imprimas claves ni PIN.

## 3. Datos (migración aditiva y segura)

En `Sale`: `courierFee` Decimal(12,2) default 0 con CHECK `>= 0`; `courierName` texto opcional (por defecto «Addison»); `courierPaidAt` timestamp opcional; `courierPaidById` opcional. Nada se borra ni se recalcula; las ventas existentes quedan con 0. Pruébala sobre una base con datos (no solo vacía).

## 4. API

- `PATCH /sales/:id/courier` `{ fee, courierName? }`: permiso `sale:manage`. Solo ventas `completed`; no ventas anuladas ni con envío ya pagado (si está pagado, 409 claro). `fee` ≥ 0 con 2 decimales, tope razonable (p. ej. 5,000). Deja bitácora con el valor anterior y el nuevo.
- `GET /courier/pending?from&to`: ventas con `courierFee > 0` y `courierPaidAt` nulo, con factura, cliente, fecha, mensajero y envío; más el **total a pagar**. Permiso `sale:manage`, misma sucursal.
- `POST /courier/payouts` `{ saleIds, note? }`: marca como pagadas (fecha, quién), con `operationId` idempotente. Solo administración (`*`). **No mueve caja** en esta versión: es un registro. Bitácora.
- `GET /payments/pending-transfers` (ya existe): agrega `courierFee`, `expected = amount + courierFee` y `difference`.

## 5. Pantallas

- En el detalle de la venta y en cada fila de «Conciliar transferencias»: campo **Envío (RD$)** editable por administración/gerente, con botones rápidos **100, 250, 300, 400, 450** y «Otro».
- En «Conciliar transferencias»: columna **Envío** y **Esperado**; si el banco (lo que la dueña escribe) menos el monto es uno de 100/250/300/400/450, ofrece «Usar como envío». Lo exacto (monto + envío) se marca como cuadrado.
- Nueva pantalla **Envíos del mensajero** (solo administración): filtro de fechas, lista, **total a pagar**, selección y **Marcar como pagado**, historial de pagados. Exportar CSV (con protección de fórmulas, como la conciliación).
- Español, móvil a 320 px, teclado, contraste correcto, como el resto del sistema.

## 6. Pruebas

- Unidad: `esperado = monto + envío`; presets; redondeo con centavos.
- API (PostgreSQL, **ChatGPT PC**): permisos (vendedora 403), venta anulada, negativo, pagado dos veces, otra sucursal, bitácora, que el envío **no** cambie ventas/ganancia/cuadre/dashboard ni reportes, e idempotencia de `payouts`.
- E2E: poner envío 400 a una venta, ver que la transferencia de 15,950 contra 15,550 + 400 cuadra, pagarle al mensajero y que desaparezca de pendientes.
- `pnpm check` en verde (en Windows también: nombres de archivo sin choque de mayúsculas).

## 7. Entrega

Cada asistente sube su rama y deja una sección con fecha en `RESULTADOS_CHATGPT.md` (qué hizo, commit, pruebas con el texto exacto de cualquier fallo, qué falta). Si no tiene escritura en GitHub, entrega un bundle a la dueña. Claude revisa, integra, espera los 3 CI en verde y despliega.
