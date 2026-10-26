# T4 · Efectivo y caja ciega

Fecha: 2026-10-26  
Rama auditada: `origin/claude/producto-mezcla-4`  
Commit auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
Método: auditoría estática; no se modificó código existente.

## Resumen

La separación por cajera y empresa está presente, y «¿cuánto vendí hoy?» usa la ruta rápida sin consumir cuota de IA. Sin embargo, la respuesta actual permite reconstruir el efectivo de una caja abierta. No es posible mostrar a la vez el total monetario exacto de la sesión abierta y garantizar una caja ciega.

## Hallazgos

### Alta · La cajera puede deducir el efectivo esperado de una caja abierta

**Evidencia:**

- `apps/api/src/reports.ts:1454-1458`: limita las ventas a la cajera, pero conserva sus importes.
- `apps/api/src/reports.ts:1462-1469`: detecta cuáles cajas propias siguen abiertas.
- `apps/api/src/reports.ts:1514-1535`: devuelve por separado el monto de transferencias pendientes.
- `apps/api/src/reports.ts:1523-1538`: devuelve el total neto y la última venta con importe.
- `apps/web/src/QuickQuestions.tsx:179-195`: muestra total y crédito aun con caja abierta.
- `apps/web/src/QuickQuestions.tsx:278-295`: muestra el monto de transferencias pendientes.
- `apps/web/src/QuickQuestions.tsx:358-367`: muestra el fondo inicial.

**Cómo reproducirlo:**

1. Abrir caja con RD$500.
2. Vender RD$100 en efectivo, RD$50 por transferencia pendiente y RD$30 a crédito.
3. Abrir «Preguntas»: se muestran total RD$180, crédito RD$30, transferencia pendiente RD$50 y fondo RD$500.
4. Calcular `180 - 30 - 50 = 100` de efectivo y, por tanto, RD$600 esperados en gaveta.

**Arreglo propuesto:** cuando la persona no pueda ver el efectivo esperado y tenga una caja propia abierta, no devolver ningún importe monetario derivado de esa sesión. Devolver solo cantidad de facturas, unidades y producto más vendido. Los importes se habilitan después del cierre.

### Media · «Transferencias pendientes» puede incluir cobros hechos por la dueña

**Evidencia:**

- `apps/api/src/reports.ts:1472-1475`: el desglose normal excluye pagos `installment`.
- `apps/api/src/reports.ts:1514-1522`: la consulta de transferencias pendientes no excluye `entryType = "installment"` ni filtra por la fecha del pago.

**Cómo reproducirlo:**

1. La cajera crea una venta a crédito.
2. La dueña registra después un abono por transferencia sobre esa venta.
3. Consultar «¿Tengo transferencias sin verificar?» desde la cajera.
4. El abono puede aparecer como propio de la cajera y quedar clasificado por la fecha de la venta, aunque lo registró la dueña en otra fecha.

**Arreglo propuesto:** excluir `entryType = "installment"` de «mis ventas», o crear un resumen separado de cobros propios filtrado por la persona que registró el pago y por `Payment.createdAt`.

### Media · La IA presenta un desglose parcial como si fuera completo

**Evidencia:**

- `apps/api/src/assistant.ts:1452-1466`: si `hiddenUntilClose` es verdadero, avisa que el desglose está oculto y a continuación imprime efectivo, tarjeta y transferencia.
- `apps/api/src/reports.ts:1497-1505`: esos campos contienen solo pagos de sesiones visibles; los de la caja abierta se omiten.

**Cómo reproducirlo:**

1. Abrir una caja y vender RD$100 en efectivo.
2. Preguntar a la IA «¿Cuánto vendí hoy?».
3. La respuesta puede decir total RD$100 y «Efectivo: RD$0», porque ocultó el pago abierto del desglose sin ocultar el total.

**Arreglo propuesto:** con `hiddenUntilClose = true`, omitir por completo importes y métodos y responder únicamente las métricas no monetarias permitidas por la caja ciega.

## Controles comprobados

- No se exponen costo ni margen en `/sales/mine`: `apps/api/src/reports.ts:1470-1541`.
- El catálogo usado por preguntas elimina costos: `apps/api/src/common.ts:437-446` y `apps/api/src/catalog.ts:349-360`.
- La IA niega costos a `seller` incluso si recibe por error `profit:read`: `apps/api/src/assistant.ts:1238-1240`.
- Las ventas se filtran por `sellerId = actor.id`: `apps/api/src/reports.ts:1454-1458`.
- Cotizaciones, solicitudes de anulación e incentivos también se limitan a la persona: `apps/api/src/admin.ts:805-809`, `apps/api/src/sales.ts:1865-1870` y `apps/api/src/incentives.ts:754-774`.
- La encuesta propia se limita al usuario y el resumen exige administración: `apps/api/src/cashier-survey.ts:13-41`.
- «¿Cuánto vendí hoy?» no reserva ni consume cuota: `apps/api/src/assistant.ts:1497-1508`. Limitación: la validación previa de `apps/api/src/assistant.ts:1486-1490` exige que exista `ANTHROPIC_API_KEY`.

## Regla exacta propuesta

Definir `cajaCiegaActiva` cuando el usuario no tenga permiso para ver el efectivo esperado y mantenga una caja propia abierta.

Mientras esté activa:

1. No devolver `total`, métodos, montos pendientes, devoluciones, última venta con importe ni totales semanales que incorporen la sesión abierta.
2. Sí devolver número de facturas, unidades y producto más vendido.
3. Mantener separados los datos de sesiones ya cerradas; nunca mezclarlos con los de la sesión abierta.
4. Excluir abonos `installment` y operaciones hechas por la dueña de «mis ventas».
5. Hacer que «Preguntas» y la IA consuman exactamente la misma respuesta ya redactada por el servidor.
6. Tras cerrar la caja, permitir los importes exactos de las ventas propias.
7. Mantener siempre prohibidos para la cajera costos, margen y ventas de otras personas.

## Pruebas pendientes

- PostgreSQL real: combinación de efectivo, crédito, transferencia pendiente, abono de la dueña y devolución con caja abierta y cerrada.
- API: afirmar que la respuesta abierta no contiene ningún importe con el que se reconstruya la gaveta.
- Web a 320 px y 390 px: verificar que el estado oculto no deje importes en texto, etiquetas accesibles ni mensajes de IA.
