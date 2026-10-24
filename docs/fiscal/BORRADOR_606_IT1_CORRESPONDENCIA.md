# Correspondencia 606 e IT-1 con los datos del sistema

> **BORRADOR PARA LA CONTADORA — no es un archivo oficial ni se presenta a la DGII**

Fecha de corte del código: rama `producto-nexora`, commit `e3fada7`. Este documento solo compara columnas con campos del sistema. No cambia nada del programa.

**Aviso sobre los códigos.** Los nombres de columna del 606 están escritos en lenguaje común, no como códigos oficiales. El orden, los códigos y el formato exactos (longitudes, fechas, separadores) deben **confirmarse con la contadora y con la Norma General 07-2018 vigente** antes de generar cualquier archivo.

## 1. Resumen para la dueña

- **Se puede hacer ya (como borrador):** un 606 parcial y la parte de ITBIS de ventas y compras del IT-1.
- **No se puede hacer todavía:** el 607 (ventas) y el 608 (anulados). El sistema **nunca guarda el NCF de una venta**. El campo `Sale.ncf` existe (`schema.prisma:429`), pero en `apps/api/src/sales.ts` solo se lee (línea 234). Al crear la venta únicamente se escriben `ncfType` y `recipientLegalId` (líneas 1067-1068). Sin NCF emitido no hay 607 ni 608.
- Las preguntas pendientes para la dueña ya están redactadas en `docs/coordinacion/DECISIONES_DUENA_PC12_PC15.md` (rama `origin/nexora-cloud`). Aquí solo se citan (sección 6).

## 2. Compras: columnas del 606

> **BORRADOR PARA LA CONTADORA — no es un archivo oficial ni se presenta a la DGII**

Fuentes: recepción de mercancía `GoodsReceipt` (`schema.prisma:719`), orden de compra `PurchaseOrder` (`:672`), gasto `Expense` (`:858`), suplidor `Supplier` (`:102`). La exportación actual está en `apps/api/src/inventory.ts:1363` (Excel «Compras», solo recepciones, no gastos).

| Columna del 606 (confirmar nombre y código) | Campo hoy (`schema.prisma`) | ¿Existe? | Cómo se obtiene o qué falta |
|---|---|---|---|
| RNC o cédula del suplidor | `Supplier.legalId` (`:108`) | Sí, opcional | Directo. `Expense.supplierId` (`:868`) es opcional: FALTA exigir suplidor en gastos con NCF. |
| Tipo de identificación (RNC / cédula) | — | No | Se podría deducir por el largo (9 u 11 dígitos). Confirmar con la contadora. |
| Tipo de bienes y servicios comprados (01 a 11) | — | No | FALTA: la dueña decide (pregunta 2). Idea: mercancía = «costo de venta»; gasto = según su categoría (`ExpenseCategory`, `:847`). |
| NCF | `GoodsReceipt.supplierNcf` (`:741`); `Expense.ncf` (`:872`) | Sí, opcional | Directo. El Excel actual ya marca «Falta NCF». |
| NCF modificado (notas de crédito o débito del suplidor) | — | No | FALTA: guardar a qué NCF corrige una nota. |
| Fecha del comprobante | `GoodsReceipt.invoiceDate` (`:742`); `Expense.date` (`:865`) | Sí (en recepción es opcional) | Directo. Formato por confirmar. |
| Fecha de pago | `SupplierPayment.createdAt` (`:760`) | Parcial | El pago no está unido a la factura. FALTA: unirlos (pregunta 3) o que la contadora la complete. |
| Monto facturado en servicios | — | No | FALTA: separar servicios de bienes. Posible regla: gastos = servicios, recepciones = bienes. Confirmar. |
| Monto facturado en bienes | `GoodsReceipt.total` (`:730`) menos `itbis` | Parcial | Derivable. Definir si flete y otros cargos (`:736-737`) van aquí. |
| Total facturado | `GoodsReceipt.invoiceTotal` (`:750`); `Expense.amount` (`:866`) | Parcial | Confirmar si `Expense.amount` incluye ITBIS. |
| ITBIS facturado | `GoodsReceipt.itbis` (`:745`); `Expense.itbis` (`:873`) | Sí, opcional | Directo. Vacío se trata como cero, con aviso. |
| ITBIS retenido | — | No | FALTA: depende de si se retiene (pregunta 1). |
| ITBIS sujeto a proporcionalidad | — | No | FALTA: la contadora indica si aplica. |
| ITBIS llevado al costo | — | No | FALTA: decisión de la contadora por compra. |
| ITBIS por adelantar | `itbis` | Parcial | Derivable si el ITBIS no va al costo. |
| ITBIS percibido | — | No | FALTA: confirmar si aplica. |
| Tipo de retención de ISR y monto retenido de renta | — | No | FALTA (pregunta 1). |
| ISR percibido en compras | — | No | FALTA: confirmar si aplica. |
| Impuesto selectivo al consumo | — | No | FALTA. |
| Otros impuestos o tasas | — | No | FALTA. |
| Propina legal | — | No | FALTA (normalmente cero en compras de mercancía). |
| Forma de pago (código DGII) | `GoodsReceipt.paymentType` (`:743`) y `creditDays` (`:744`); `Expense.method` (`:867`); `SupplierPayment.method` (`:767`) | Parcial | Hay texto propio, no el código de la DGII. FALTA: tabla de traducción (pregunta 3). |

Otros datos que sí existen: `supplierInvoice` (número de factura del suplidor), `damagedCost`, `invoiceDifference` y el adjunto de la factura (`attachmentId`). Los gastos anulados (`Expense.voided`, `:875`) deben excluirse.

## 3. Ventas: columnas del 607 y 608

> **BORRADOR PARA LA CONTADORA — no es un archivo oficial ni se presenta a la DGII**

| Dato | Campo hoy | Estado |
|---|---|---|
| NCF emitido | `Sale.ncf` (`:429`) | **Nunca se escribe.** No se puede generar el 607. |
| Tipo de comprobante | `Sale.ncfType` (`:431`) | Se escribe solo si viene en la venta (`sales.ts:1067`). |
| RNC o cédula del cliente | `Sale.recipientLegalId` (`:432`) | Se escribe solo si viene (`sales.ts:1068`). |
| Tipo de ingreso (01 a 06) y retenciones de terceros | — | No existen. |
| NCF anulado y tipo de anulación (01 a 10) | `Sale.status = voided`, `voidedReason` (`:435`) | Sin NCF no hay 608. Los motivos de anulación del sistema no coinciden con la tabla de la DGII. |

Decisión pendiente: si el sistema guardará el NCF de cada venta (pregunta 4; la e-CF sigue en pausa). Mientras tanto, el 607 y el 608 se hacen a mano fuera del sistema.

## 4. Hoja base del IT-1 (ITBIS mensual)

> **BORRADOR PARA LA CONTADORA — no es un archivo oficial ni se presenta a la DGII**

No se citan números de casilla del formulario: confirmar con la contadora y con el IT-1 vigente.

| Concepto | ¿Se calcula hoy? | Fuente y nota |
|---|---|---|
| ITBIS cobrado en ventas, por tasa | Sí | Suma de `SaleItem.tax` (`:532`) de ventas `completed` del mes, agrupada por tasa (`Product.taxRate`, `:134`, por defecto 18). Verificar que la tasa quede guardada por línea; si no, se deduce del producto actual y puede variar si cambió. |
| Base de ventas gravadas | Sí | `SaleItem.lineTotal` (`:533`) menos `tax`, por tasa. Confirmar si `lineTotal` ya descuenta `discount`. |
| Ventas exentas o con tasa cero | Sí | Líneas con `taxRate = 0`. Confirmar cómo separar exento de tasa cero. |
| Menos: devoluciones | Sí | `SaleReturn.taxTotal` (`:611`) del mes. Evitar contar dos veces una venta anulada y su devolución. |
| ITBIS pagado en compras | Sí, parcial | `GoodsReceipt.itbis` + `Expense.itbis` del mes. Solo con NCF y con ITBIS capturado; el resto queda en una lista de pendientes. |
| ITBIS por adelantar o llevado al costo | No | Decisión de la contadora (ver 606). |
| Saldo a favor del mes anterior | No | FALTA: dato externo, no se guarda. |
| Compensaciones, retenciones y anticipos | No | FALTA: no se guardan. |
| Ajustes por notas de crédito de suplidores | No | Falta el NCF modificado. |

## 5. Dudas para la contadora

1. Orden y códigos oficiales vigentes de las columnas del 606 y 607 (Norma General 07-2018 y sus modificaciones).
2. Si el flete y otros cargos van en bienes o servicios.
3. Si `Expense.amount` incluye o no el ITBIS.
4. Cómo tratar compras sin NCF (gastos menores, informales).
5. Tratamiento de ITBIS «llevado al costo» y «por adelantar».
6. Si algún suplidor requiere retención de ITBIS o ISR.

## 6. Decisiones de la dueña ya redactadas

Están en `docs/coordinacion/DECISIONES_DUENA_PC12_PC15.md` (rama `origin/nexora-cloud`), sección PC-12. No se repiten aquí:

- Pregunta 1: retenciones de ITBIS e ISR.
- Pregunta 2: tipo de gasto (01 a 11).
- Pregunta 3: fecha y forma de pago de cada factura.
- Pregunta 4: 607 y 608 (guardar el NCF de las ventas).
- Pregunta 5: aprobar esta hoja base del IT-1 y un 606 en borrador.
