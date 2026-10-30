Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/GLOSARIO.md`. Tarea N35. Mismo orden que la entrada, una fila por término; definiciones de máximo 15 palabras tomadas de la entrada, sin añadir datos.

# Glosario simple

| Término | Definición |
|---|---|
| Abono | Pago posterior a una venta que quedó con saldo pendiente. |
| Aprobar con PIN / PIN de gerente | Código de 6 dígitos de un gerente que autoriza una operación de riesgo. |
| Arqueo / «Cerrar y arquear» | Contar el dinero de la caja y compararlo con lo que el sistema espera. |
| B01 / B02 | Tipos de comprobante que solo se pueden solicitar; el sistema no los emite. |
| Caja | La pantalla para abrir y cerrar el turno, o el turno de una persona. |
| Caja ciega / arqueo ciego / conteo ciego | La cajera no ve lo esperado; declara lo contado y el sistema compara después. |
| Casa | Almacén de mercancía guardada fuera de la tienda; solo se mueve con orden expresa. |
| Cierre de emergencia | Un gerente o administrador cierra la caja de otra persona. |
| Conciliar | Comparar las transferencias del sistema con el estado del banco. |
| Conteo | Contar físicamente la existencia; un gerente aprueba el ajuste. |
| Consumidor final | Cliente genérico para ventas sin datos; sale primero al elegir cliente. |
| Contraentrega (`cod`) | Venta que sale ahora y se cobra cuando el mensajero trae el dinero. |
| Costo promedio (`costAvg`) | Costo de una variante, recalculado en cada entrada; sirve para el margen. |
| Crédito | Venta a cuenta del cliente: la mercancía sale ahora y se cobra después. |
| Cuadre | Resultado del cierre: lo contado contra lo esperado, con sus diferencias. |
| Datáfono / verifón / lote del verifón | Terminal de tarjeta; su lote se cierra antes de cerrar la caja. |
| Descuento | Rebaja a una línea o global; siempre lleva motivo y puede pedir PIN. |
| Dueña | La usuaria con todos los permisos, cuyas órdenes fechadas mandan. |
| Entregado / Dejado en caja | Efectivo entregado a la dueña y efectivo que queda como fondo próximo. |
| Envío / mensajero | Cobro del envío aparte del total, que luego se paga al mensajero. |
| Equipo / terminal | Computadora registrada; un equipo nuevo necesita aprobación de un gerente. |
| En espera | Carrito guardado para seguir después; cotizar lo guarda como cotización. |
| Factura (venta) | El número de una venta al cliente; el recibo es documento no fiscal. |
| FEFO | Primero vence, primero sale: se vende antes el lote que vence primero. |
| Fondo / «Efectivo inicial» | Dinero con el que se abre la caja. |
| Génesis / Macgen | Nombres de los dos grupos de cuentas bancarias. |
| Grupo MacGen | La empresa dueña de la tienda y de la mercancía que se vende. |
| GV / GV Makeup Studio | Empresa hermana de cursos y servicios de maquillaje. |
| ITBIS | Impuesto de 18 %; los precios lo incluyen y el margen no lo resta. |
| Kardex | Historial de movimientos de una variante. |
| Lote / vencimiento | Partida de una variante con número y fecha de vencimiento. |
| Margen | (precio − costo) / precio, sin restar ITBIS; el mínimo es 15 %. |
| Merma | Pérdida de mercancía por daño, vencimiento o muestra; no es un conteo. |
| NC-000000 / Nota de crédito | Número de la devolución o saldo a favor del cliente para canjear. |
| NCF / e-CF | Número de comprobante fiscal que este sistema no emite. |
| Norexos / «Nexora POS» (nombre anterior) | Nombre nuevo del producto; el código aún muestra el anterior. |
| Ramas de producción y de producto | La primera rama es la tienda en vivo; la segunda, el producto. |
| Offline / sin conexión | Vender sin internet solo si la configuración lo permite; luego se sincroniza. |
| Oferta / promoción | Descuento automático que aplica la caja sin cambiar el precio. |
| Por verificar (`pending_verification`) | Transferencia que aún no se comprobó en el banco. |
| Por mayor («al por mayor») | Marca que solo reduce a la mitad el incentivo de la cajera. |
| Recepción | Registro de lo que llegó de una orden de compra o factura. |
| Reembolsada (GV) | Estado final de una inscripción o cita en que se devolvió dinero. |
| RNC | Registro Nacional del Contribuyente, la identificación de una empresa. |
| Sesiones (equipo de trabajo) | Las sesiones de Claude con su rol: decide, mercancía, taller, revisor, director. |
| SKU / código de barras | Códigos únicos de cada variante; la caja busca por ambos. |
| Solicitud de anulación | Pedido de una cajera para anular su venta; lo aprueba administración. |
| Traspaso | Mover mercancía entre Casa y Tienda en una sola operación. |
| Transferencia | Pago por banco; pide cuenta y referencia y queda por verificar. |
| Vale de caja | Comprobante de salida en la gaveta que compensa efectivo faltante; exige PIN. |
| Variante | Combinación concreta de producto: talla, color o sabor, con código propio. |
| Venta (estado `voided`) | Venta anulada: se conserva con motivo, se revierte inventario y no cuenta. |

## Qué NO comprobé
Las definiciones se resumieron de la entrada; no se contrastaron con el código ni se revisaron las citas del glosario original.
