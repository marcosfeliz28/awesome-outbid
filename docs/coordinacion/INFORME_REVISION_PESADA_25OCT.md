# Informe: revisión pesada del sistema de la tienda (25-oct-2026)

Pedido de la dueña: usar el sistema completo de forma pesada y buscarle fallos, **sin arreglar nada antes de que ella decida**.

Lo hizo Claude nube con 3 agentes en paralelo:
1. **Casos reales del 24-oct:** causa raíz en el código, confirmada con datos de la API (solo lectura).
2. **Revisión de código y seguridad:** dinero, caja, inventario, anulaciones y permisos.
3. **Un día simulado:** unas 150 ventas y 4 cajas a la vez en una copia local desechable. Nunca contra producción.

El detalle de cada parte está en `revision-pesada/1-casos-reales.md`, `2-revision-codigo.md` y `3-dia-simulado.md`. No se cambió código ni datos.

## Fallos por gravedad

| # | Gravedad | Qué pasa | Dinero | Propuesta |
|---|---|---|---|---|
| 1 | **Crítica (fiscal)** | Ninguna venta guarda NCF (`Sale.ncf` no se escribe y `ncfMode` viene en `disabled`). Las devoluciones generan una nota «interna», no B04. | Riesgo DGII, no de caja | Ya estaba anotado: el e-CF está en pausa con la contadora. **Hay que confirmar con ella cómo se emiten hoy los comprobantes** (¿talonario o fuera del sistema?). La regla es «toda venta lleva su comprobante». |
| 2 | **Alta** | **No existe el pago en dólares.** La venta en US$ entra como efectivo en RD$ y los dólares solo aparecen al cerrar, sueltos. Caja de Lizbeth: −RD$2,500 y +US$40 (con tasa 61.42 son RD$2,457; no falta dinero). Wendy pudo declarar US$58.30 sin ninguna venta en dólares, sin alerta ni justificación. | Faltantes falsos y dólares sin control | Pago en efectivo con moneda, monto en US$ y tasa. El equivalente se resta del esperado en RD$ y se suma al esperado en US$. Diferencia en US$ con justificación y PIN, igual que en RD$. |
| 3 | **Alta** | **Un gerente se aprueba a sí mismo** con su propio PIN: descuentos (vendió bajo costo, FS de prueba con total 380 y costo 525), su propio descuadre, «Recibido por la dueña», crédito sobre el umbral y uso de nota de crédito. | Ventas bajo costo y salidas de efectivo sin un segundo par de ojos | El PIN de aprobación debe ser de **otra persona** con permiso. |
| 4 | **Alta** | **Descartar una venta offline «con mercancía entregada»** saca inventario y mete efectivo **sin crear la venta**: sin NCF, sin ITBIS y fuera de los ingresos. Además usa lo que manda el navegador. | Mercancía que sale sin factura | Que cree la venta real con lo guardado en el servidor, o que lo apruebe solo la dueña. |
| 5 | Media | El **cierre ciego se puede adivinar**: «La caja no cuadra» deja reintentar sin límite. | Llevarse el sobrante | Limitar los intentos o pasar a PIN después del segundo. |
| 6 | Media | **Corregir el método con la caja cerrada** (efectivo → tarjeta) deja la caja +950 y −950 sin alerta ni justificación. También **una venta offline que llega después del cierre** cambia el esperado y deja un faltante sin alerta. | Descuadres sin explicación | Alerta y justificación cuando algo cambia una caja ya cerrada; alerta de «falta lote» si entra tarjeta. |
| 7 | Media | Un gerente **devuelve en efectivo desde la caja abierta de otra persona** sin otra aprobación. | Salida de efectivo | Exigir la aprobación de la dueña o de la dueña de la caja. |
| 8 | Media | **El margen se calcula de 2 formas:** el tablero, el reporte por producto y la alerta restan el ITBIS (contra la regla). El mínimo del 15 % no se exige al vender, ni en promociones, ni al editar precios. | Decisiones con márgenes distintos | Una sola fórmula (precio − costo)/precio sin ITBIS. **La dueña decide** si el 15 % se exige al vender o solo avisa. |
| 9 | Media | «Corregir método de pago» no ajusta los incentivos. | Incentivo mal pagado | Recalcular el incentivo al corregir. |
| 10 | Baja | **«Addison» en todas las ventas**, incluso de mostrador: es el valor por defecto de la columna (`schema.prisma:337`, migración `202610250001_courier_fee`). Los reportes de envíos no se afectan. | Ninguno | Quitar el valor por defecto y limpiar las ventas sin envío. Toca datos: **lo confirma la dueña.** |
| 11 | Baja | Varios: la anulación después del cierre muestra «Entradas 950» en el cuadre impreso; el descuadre pide justificación y nota (lo mismo dos veces); las transferencias de una venta anulada quedan atascadas; el gerente aplica su propio conteo; Ajustes borra claves fuera del esquema; tiempos de 5 s en transferencias. | Menor | Arreglos pequeños. |
| 12 | Baja (decisión) | El cobro de contraentrega solo lo puede registrar el administrador (la cajera y el gerente reciben 403). | — | **La dueña confirma** si así lo quiere. |

**Caso de Manuela (tarjeta RD$7,870 sin lote):** no es un fallo. Cerró a las 21:58 UTC, 4 minutos antes de que entrara la regla del lote (22:02). Hoy el servidor la exige siempre, también con una página vieja en caché.

## Lo que funcionó bien (probado)
- **El cuadre en efectivo cuadra** en las 6 cajas, y sus sumas coinciden con los pagos.
- **Lote del verifón:** se exige siempre.
- **Faltante y sobrante:** piden justificación, y el faltante además PIN y alerta.
- **Cierre ciego:** la cajera no ve el esperado.
- **Carreras:** la última unidad se vende una sola vez y el stock nunca baja de cero. Una venta repetida queda en una. Los dobles cierres, anulaciones, devoluciones y traspasos quedan en uno.
- **Sin internet:** las ventas sin duplicados.
- **Transferencias:** verificar, rechazar y corregir funcionan.
- **Inventario:** traspasos Casa↔Tienda y lotes (sale primero el que vence antes).
- **Permisos de cajera y bitácora:** completos.
- **Seguridad:** los costos están ocultos sin permiso y el PIN tiene límite de intentos.

## Orden de arreglo que propone el arquitecto (lo decide la dueña)
1. **#3:** el PIN de otra persona. Es rápido y cierra la mayoría de las autoaprobaciones.
2. **#2:** el pago en dólares bien hecho.
3. **#4 y #6:** el descarte de ventas offline y las alertas en cajas cerradas.
4. **#5 y #7.**
5. **#8:** una sola fórmula de margen, más la decisión del 15 %.
6. **#10, #11 y #9.**

Aparte: **#1, con la contadora.**
