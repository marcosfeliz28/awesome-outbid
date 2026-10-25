# AUD-VIVO · Plan de gerente

Estado: **PENDIENTE DE EJECUCIÓN**. Este archivo es un plan, no un informe de resultados. No se ha visitado el producto ni realizado operaciones. La búsqueda de herramientas no encontró una superficie Browser `js` o CUA disponible; el agente principal está comprobando el acceso.

Alcance único: **https://nexorapos.net**, empresa **aud-chatgpt**, rol gerente. Excluidos otros dominios y Render. No guardar contraseñas ni PIN. No iniciar operaciones hasta que el agente principal confirme acceso, empresa, rol y estado inicial.

## Preparación y registro

1. Confirmar visualmente URL, empresa y rol. Registrar fecha/hora y zona horaria de la empresa, sucursal, caja, período y filtros activos.
2. Registrar saldos iniciales de cliente de prueba y caja, movimientos ya existentes y estado del turno. Coordinar con los otros agentes para evitar que ventas, cobros o cierres concurrentes alteren el escenario.
3. Usar únicamente cliente, documentos y operaciones de auditoría acordados por el agente principal. Anotar sus identificadores y valores reales; no asumir saldo cero ni crear datos hasta su confirmación.
4. Capturar los estados inicial y final y el detalle de cada documento necesario. Reutilizar esos identificadores en crédito, reportes y cierre.
5. Verificar importes con la precisión y regla de redondeo que muestre el producto. Un dato no visible o una capacidad no disponible se marca como limitación, no como fallo contable confirmado.

## Oráculo contable

Comparar siempre la misma empresa, sucursal, moneda, período, zona horaria, estado del documento y caja cuando aplique. Determinar si cada informe usa fecha de venta, cobro o cierre; no comparar conjuntos distintos como si fueran iguales.

- **Crédito:** saldo final del cliente = saldo inicial + cargos de ventas a crédito válidas + otros débitos documentados − cobros aplicados − notas de crédito y anulaciones que reduzcan deuda. Verificar la asignación por documento para no descontar dos veces una devolución o anulación.
- **Venta y cobro:** una venta a crédito incrementa ventas y deuda; no incrementa efectivo. Cobrar una deuda disminuye cuentas por cobrar y aumenta el medio de pago recibido; no registra nuevamente la venta. En una venta mixta, cada parte afecta a su medio y únicamente la parte pendiente afecta a crédito.
- **Caja:** efectivo esperado = fondo inicial + ventas cobradas en efectivo, netas de cambio + cobros de deuda recibidos en efectivo + otros ingresos de efectivo − devoluciones en efectivo − gastos pagados en efectivo − retiros. Contabilizar cada movimiento una sola vez. Pagos con tarjeta o transferencia y deuda sin cobrar no incrementan efectivo.
- **Cierre:** diferencia = efectivo contado − efectivo esperado. Una diferencia distinta de cero debe conservar signo e importe. El cierre y su consulta posterior deben mantener documentos, totales por medio y diferencia conciliados.
- **Reportes:** conciliar detalle → subtotales → total con el conjunto de documentos seleccionado. Distinguir ventas brutas, descuentos, impuestos, devoluciones y ventas netas según sus etiquetas reales. No sumar cobros de deuda a ventas del período. Las anulaciones deben seguir la política visible del informe y ser trazables.

## Casos reproducibles

Todos los casos están **PENDIENTES**. Los pasos describen destinos funcionales; las etiquetas exactas y rutas se registrarán al observar la interfaz.

| ID | Secuencia a ejecutar tras confirmar estado inicial | Resultado esperado y evidencia |
| --- | --- | --- |
| GER-CR-01 | Consultar cliente y documento de crédito de auditoría; contrastar saldo, vencimiento y movimientos con sus documentos. | El saldo satisface el oráculo. Capturar lista, detalle y movimientos con sus identificadores. |
| GER-CR-02 | Sobre deuda y monto acordados, registrar un único abono parcial; recargar detalle y listado. | Saldo disminuye exactamente el abono; existe un solo movimiento y recibo; el cobro figura en el medio elegido, sin duplicar ventas. Capturar antes, comprobante y después. |
| GER-CR-03 | Completar la deuda restante con el importe exacto; consultar y recargar. | Saldo cero y estado coherente; suma de cobros igual al importe aplicado; no aparece saldo negativo por redondeo. Capturar comprobantes y estado final. |
| GER-CR-04 | Si el producto permite una validación previa, introducir importe mayor al saldo y cancelar antes de confirmar. | La interfaz muestra la política de excedente: bloqueo o tratamiento explícito como saldo a favor. No atribuir un fallo sin observar su regla. No guardar un sobrepago sin escenario aprobado. |
| GER-RP-01 | Abrir reporte de ventas del intervalo de auditoría y registrar filtros; identificar documentos conocidos y recalcular detalle y totales. | Total y subtotales concilian con los documentos y las etiquetas del informe. Capturar filtros, detalle y total. |
| GER-RP-02 | Consultar reportes de cobros y cuentas por cobrar usando los mismos documentos de GER-CR-02/03. | Los abonos aparecen una vez; deuda cae; ventas no aumentan otra vez. Separar fecha de venta y fecha de cobro. Capturar ambas vistas y sus filtros. |
| GER-RP-03 | Cambiar un filtro disponible de fecha/sucursal/caja; volver al filtro inicial y recargar. | Resultados corresponden a los filtros visibles y el filtro inicial recupera el mismo conjunto si no hubo nuevas operaciones. Capturar ambos estados. |
| GER-RP-04 | Si existe exportación, exportar el reporte visible sin cambiar filtros y contrastar identificadores, filas y totales. | Exportación y vista representan el mismo alcance. Un paginado visual no implica que el total corresponda solo a la página. Conservar archivo y captura; marcar no aplicable si no hay exportación. |
| GER-CJ-01 | Consultar turno de auditoría todavía abierto y reunir fondo, ventas, cobros, devoluciones, gastos y retiros por medio. | Efectivo esperado coincide con el oráculo y medios no efectivos quedan separados. Capturar turno y movimientos. |
| GER-CJ-02 | Con todos los agentes fuera de ese turno y cierre acordado, revisar vista previa con conteo igual al esperado. | Diferencia cero y totales conciliados antes de confirmar. Si se confirma el cierre acordado, el histórico conserva el resultado tras recarga. Capturar previa, confirmación y detalle histórico. |
| GER-CJ-03 | En un turno distinto expresamente acordado, introducir un conteo con diferencia conocida; revisar antes de confirmar. | Diferencia = contado − esperado, con signo e importe correctos. La confirmación solo se realiza si ese cierre está incluido en el escenario autorizado. No reutilizar ni reabrir el turno cerrado por GER-CJ-02. |
| GER-CJ-04 | Tras un cierre confirmado, consultar de nuevo su detalle e histórico sin nuevas operaciones en ese turno. | El cierre es estable, aparece una vez y mantiene fecha, caja, operador, medios y diferencia. Capturar el mismo identificador después de recargar. |

No repetir una operación de escritura porque tarde la respuesta. Comprobar primero movimientos y comprobantes para evitar duplicados. No reabrir turnos, anular ventas ni modificar configuración para producir un caso sin coordinación previa.

## Plantilla de hallazgo

```text
ID: GER-...
Estado: PENDIENTE | PASA | FALLA | BLOQUEADO | NO APLICA
Gravedad: crítica | alta | media | baja (solo si FALLA)
Título:
Fecha y hora / zona horaria:
URL observada: https://nexorapos.net/...
Empresa / rol / sucursal / caja / turno:
Filtros y período:
Precondiciones y documentos de auditoría:
Pasos exactos:
1.
2.
3.
Esperado: [fórmula, documentos e importes que sustentan el cálculo]
Real: [resultado efectivamente observado; no completar por inferencia]
Impacto:
Reproducibilidad: [intentos e incidencia, sin repetir escrituras a ciegas]
Captura: [ruta o referencia de archivo real; si falta, indicar SIN CAPTURA]
Evidencia adicional: [comprobantes/exportación real y sus identificadores]
Estado residual / coordinación necesaria:
```

Gravedad orientativa: **crítica**, corrupción contable amplia o exposición entre empresas; **alta**, cobro, deuda o cierre erróneo con impacto financiero; **media**, reporte o flujo inconsistente con alternativa verificable; **baja**, defecto visual o de claridad sin efecto contable observado. La gravedad requiere evidencia del impacto, no solo una hipótesis.

Por cada fallo, conservar una captura con URL/contexto, filtros e importe erróneo; sumar captura del origen contable si la comparación la necesita. No capturar formularios con contraseñas o PIN. Si no existe captura o reproducción verificable, registrarlo expresamente y no presentar el caso como ejecutado.
