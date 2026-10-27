# Decisiones para la dueña: PC-12 y PC-15 (Claude PC, 24-oct-2026)

El desarrollador no puede terminar estos dos puntos sin estas respuestas. Cada pregunta trae una opción recomendada. Basta con contestar con el número y la letra, por ejemplo «1a, 2a, 3b…».

## PC-12 · Archivos para la DGII (606, 607, 608 e IT-1)

**Dato clave:** hoy el sistema **no guarda el número de NCF en las ventas**. Sin eso no se puede sacar el 607 (ventas) ni el 608 (anulaciones).

1. **¿Su negocio le retiene ITBIS o ISR a algún suplidor?** Por ejemplo, al pagarle un servicio a una persona.
   - a) No, nunca retenemos. **(Recomendado si es así: el 606 sale con retenciones en cero.)**
   - b) Sí, a veces. Entonces cada compra o gasto debe llevar el tipo y el monto de la retención.
   - c) No lo sé. Lo consultamos primero con la contadora.
2. **¿Qué tipo de gasto es cada compra?** La DGII pide un código del 01 al 11.
   - a) Las compras de mercancía son «costo de venta», y cada gasto toma el código de su categoría. **(Recomendado.)**
   - b) Se elige a mano en cada factura.
3. **Fecha y forma de pago de cada factura de suplidor:** hoy el pago no está unido a la factura.
   - a) Se unen el pago y la factura, con el código de pago de la DGII. **(Recomendado.)**
   - b) Se deja en blanco y lo completa la contadora.
4. **607 y 608:**
   - a) Se esperan hasta decidir si el sistema guardará el NCF de cada venta (con la contadora; la e-CF sigue pausada). **(Recomendado.)**
   - b) Mientras tanto se hacen a mano, fuera del sistema.
5. **¿Hacemos ya la hoja base del IT-1 y un 606 marcados «borrador para revisión de la contadora»?**
   - a) Sí. **(Recomendado.)**
   - b) No, solo el formato oficial completo.

## PC-15 · Interruptores por empresa

6. **Al apagar una función, ¿qué pasa con lo que ya se hizo?**
   - a) Desaparece solo de las ventas y los tickets nuevos. Lo viejo, como una reimpresión o un reporte de meses pasados, se sigue viendo igual. **(Recomendado.)**
   - b) Se oculta todo, también lo viejo. Esto cambia las cifras de meses pasados.
7. **Contraentrega:** al apagarla, ¿qué pasa con las que faltan por cobrar?
   - a) No se aceptan nuevas, pero las pendientes se siguen cobrando y salen en el cierre de caja. **(Recomendado.)**
   - b) No se deja apagar mientras quede alguna pendiente.
8. **Mensajero:** ¿se puede apagar si todavía se le debe al mensajero?
   - a) No, primero hay que pagarle. **(Recomendado.)**
   - b) Sí, y la deuda queda en un reporte aparte.
9. **Incentivos:** ¿qué pasa con lo ganado y con lo que falta por cobrar de ventas a crédito?
   - a) Solo se apaga al cerrar el mes, y lo que se cobre después de ventas anteriores se sigue pagando. **(Recomendado.)**
   - b) Se apaga al momento y lo pendiente se pierde.
10. **Lotes y vencimientos:**
    - a) No se deja apagar mientras queden lotes con existencia. **(Recomendado: si no, se podría vender mercancía vencida sin aviso.)**
    - b) Se dejan de pedir lotes en las compras nuevas, y los avisos siguen hasta que se acaben los lotes viejos.
11. **Tasa del dólar:**
    - a) No se deja apagar mientras haya productos con precio en dólares. **(Recomendado.)**
    - b) Al apagarla, esos precios quedan fijos en pesos con la última tasa.
12. **¿Cómo arrancan los interruptores?**
    - a) En las empresas que ya existen, encendido si ya usan la función y apagado si no. En las empresas nuevas, todo apagado. **(Recomendado.)**
    - b) Todo encendido.

## Apéndice técnico (verificado en `e3fada7`)

**PC-12**
- `Sale.ncf` existe (`schema.prisma:426-430`), pero ninguna ruta lo escribe. `sales.ts:234` solo lo lee.
- Para el 606 faltan:
  - el tipo de bienes y servicios (01–11);
  - la división entre servicios y bienes;
  - la fecha de pago (`SupplierPayment` no está unido a la factura);
  - las retenciones de ITBIS e ISR, el ISC, otros impuestos y la propina legal;
  - el código de forma de pago;
  - el NCF modificado.
- Para el 607 faltan el NCF emitido, el tipo de ingreso (01–06) y las retenciones de terceros.
- Para el 608 faltan el NCF anulado y el tipo de anulación (01–10).
- Se puede hacer ya:
  - el IT-1 base, con el ITBIS de ventas por tasa (`SaleItem.tax`, restando devoluciones) y el ITBIS de compras (`GoodsReceipt.itbis` + `Expense.itbis`);
  - un 606 borrador, ampliando la exportación de `inventory.ts:1363`.

**PC-15**
- El único interruptor que existe hoy es `allowCreditSales` (`admin.ts:99`, aplicado en `sales.ts:953`).
- Dónde vive cada función:
  - lotes: `Category.requiresLot`, `Lot`, FEFO (`sales.ts:1161`, `:2293`);
  - contraentrega: `receivableKind`, «cod» en caja (`cash.ts:268`, `:284`, `:506`);
  - incentivos: `IncentiveEntry`, `PeriodClose`, `Settlement.pendingCollection`;
  - dólar: `usd-rate.ts`;
  - mensajero: `CourierPayout` y `courier.ts:127`.
- **Fallo encontrado:** el proceso automático del dólar solo actualiza la empresa `"main"` (`usd-rate.ts:96-108`).
