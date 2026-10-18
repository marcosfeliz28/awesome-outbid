# Propuesta de Mejora Operativa y Control de Cierre de Caja — Nexora POS (Grupo Macgen)

*Entregada por Gemini el 17-oct-2026 (orden 3ah). Gemini no pudo escribir en GitHub; la dueña pegó el texto y Claude lo guardó aquí sin cambiar el contenido (solo se encerró el modelo de ticket en un bloque de texto para que se lea).*

> Nota previa de alcance y preguntas iniciales: Como no tengo acceso directo a la lectura de los archivos del repositorio (AGENTS.md y docs/coordinacion/ORDEN_LEVANTAMIENTO_CIERRE_CAJA.md) ni permiso de escritura en GitHub desde este entorno, entrego el texto completo listo para copiar y pegar. Para no inventar datos sobre la operación actual, dejo tres preguntas puntuales al final del documento para confirmar detalles operativos de la tienda.

## 1. Cómo cobrar y cerrar contraentregas o créditos sin descuadrar la gaveta

El problema del 17 de octubre (donde el sistema esperaba RD$ 9,900, se contaron RD$ 6,700 y faltaron RD$ 3,200 porque el cajero cerró a las 17:09 una contraentrega vieja del 11 de octubre por RD$ 3,300 que ya tenía la dueña) ocurrió porque hoy cerrar un cobro en efectivo asume automáticamente que los billetes entraron a la gaveta del cajero.

Para que siempre se sepa dónde quedó el dinero, cada vez que se registre el cobro de una contraentrega o factura a crédito, el sistema y el proceso deben exigir elegir el Destino del Dinero antes de guardar:

* Opción A — «Efectivo entra a mi gaveta hoy»: Se usa cuando el mensajero o el cliente entrega los billetes directamente a la cajera en su turno (como ocurrió con los RD$ 4,700 de contraentregas de los días 15 y 16). Este monto sí suma al efectivo que el sistema espera en la gaveta al cerrar. Obliga a imprimir un mini-recibo en dos copias que firman la cajera y quien entrega el dinero.
* Opción B — «Efectivo ya recibido por la dueña / administración»: Funciona igual que cuando el dueño cierra hoy una transferencia de crédito sin depender de ninguna caja. Si la dueña ya recibió el dinero antes (como los RD$ 3,300 del 11 de octubre), se elige esta opción:
  * La cajera no puede cerrar esta opción sola; pide obligatoriamente el PIN de gerente/dueña en el momento o solo puede hacerlo la dueña desde su propio usuario.
  * El saldo de la factura queda saldado, pero no suma ni un peso a la gaveta de la cajera, evitando faltantes falsos.
* Opción C — «Cierre por salida inmediata a manos de la dueña» (alternativa sin tocar el sistema hoy): Mientras no se cambie nada del programa, si por urgencia una cajera debe rebajar en su caja una factura cuyo efectivo ya lo tiene la dueña, en ese mismo minuto debe registrar una Salida de Caja por el mismo monto (RD$ 3,300) con el concepto «Efectivo recibido previamente por dueña - Factura #», firmada por la dueña. Así la entrada (+3,300) y la salida (-3,300) se anulan y la gaveta cuadra exacta.

## 2. Cómo debe verse el papel de cierre (Diseño claro línea por línea)

Hoy el papel solo dice «Total en venta efectivo», no separa ventas nuevas de cobros viejos y no deja claro cuánto hay que entregar. El ticket impreso (y su vista previa para gerencia) debe tener esta estructura clara:

```text
================================================
          GRUPO MACGEN - NEXORA POS
            ACTA DE CIERRE DE CAJA
================================================
Fecha y Hora: DD/MM/AAAA - HH:MM
Caja: [Nombre/Número]    Cajero(a): [Nombre]
------------------------------------------------
1. VENTAS DEL DÍA EN EFECTIVO
   (+) Ventas al contado de hoy:       RD$ 1,900
   (-) Devoluciones en efectivo:       RD$     0
   Subtotal ventas del día:            RD$ 1,900
------------------------------------------------
2. COBROS DE FACTURAS VIEJAS / CONTRAENTREGAS
   (Efectivo que entró hoy a esta gaveta)
   - Fact #1042 | Cliente A (15/oct):  RD$ 2,500
   - Fact #1048 | Cliente B (16/oct):  RD$ 2,200
   Subtotal cobros viejos en gaveta:   RD$ 4,700
------------------------------------------------
3. MOVIMIENTOS DE GAVETA (ENTRADAS Y SALIDAS)
   (+) Fondo inicial / Entradas:       RD$     0
   (-) Salidas / Entregas parciales:   RD$     0
------------------------------------------------
4. RESUMEN DE EFECTIVO (LO QUE DEBES ENTREGAR)
   EFECTIVO QUE DEBE ESTAR EN GAVETA:  RD$ 6,600
   EFECTIVO CONTADO POR CAJERO(A):     RD$ 6,700
   DIFERENCIA EN EFECTIVO:             +RD$  100
------------------------------------------------
5. INFORMATIVO (NO AFECTA TU GAVETA)
   Cobros recibidos directo por dueña: RD$ 3,300
   - Fact #0985 | Cliente C (11/oct)
   Transferencias cerradas hoy:        RD$ [Monto]
------------------------------------------------
6. CUADRE DE TARJETA (VERIFÓN)
   Ventas con tarjeta en Nexora:       RD$ [Monto]
   Total lote cierre Verifón:          RD$ [Monto]
   Diferencia en Tarjeta:              RD$     0
   Núm. Lote Cerrado: #[Número] ( Voucher pegado )
------------------------------------------------
AUTORIZACIÓN DE CIERRE CON DIFERENCIA:
Autorizado por (PIN): [Nombre del Gerente/Dueña]
Motivo registrado: [Explicación breve]

_____________________      _____________________
Firma Cajero(a)            Firma Recibido/Gerente
================================================
```

## 3. Controles prácticos para evitar robo en tienda

Pensando en que las cajeras tienen poco tiempo y el internet a veces falla, los controles deben ser rápidos y apoyarse en reglas físicas y del sistema:

* Tope máximo de efectivo en gaveta (Sangría o Entrega Parcial): La gaveta nunca debe acumular mucho efectivo. Cuando el efectivo supere un tope fijo (por ejemplo, RD$ 10,000 o RD$ 15,000), la cajera saca el excedente, registra una «Salida por entrega parcial a dueña», imprime dos papelitos y ambos firman (uno queda en la gaveta como vale y otro se va con los billetes). Si se cae el internet, se llena un talonario físico pre-numerado y se pasa al sistema apenas vuelva la conexión.
* Doble conteo a ciegas al cerrar: Se mantiene el cierre ciego actual (la cajera no ve cuánto debería haber). La cajera cuenta sus billetes por denominación en una hoja o pantalla, y el supervisor o dueña vuelve a contar el fajo frente a ella antes de guardar el cierre.
* Uso estricto del PIN de gerente con motivo obligatorio: Como ya se agregó que no se puede cerrar sin PIN de gerente cuando el efectivo o la tarjeta no cuadran, el gerente no debe poner su PIN «por salir del paso». Debe quedar escrito en una línea por qué dio el PIN (ejemplo: «Faltó devuelta», «Lote día anterior»).
* Alertas activas al celular (WhatsApp/Telegram) o correo: Hoy la alerta alta por diferencias mayores a RD$ 100 es pasiva y solo se ve si alguien abre el panel de Alertas. Se debe conectar esa misma alerta para que dispare un correo electrónico o un mensaje automático al celular de la dueña en tres momentos: 1) Cierre con diferencia mayor a RD$ 100, 2) Uso del PIN de gerente en un cierre, y 3) Salida de efectivo o anulación de factura.

## 4. Tarjeta y Verifón: cómo cuadrar ventas y evitar lotes abiertos

El 17 de octubre se cobraron RD$ 2,500 en el verifón sin hacer factura, y como el lote del día 16 no se cerró, el cierre de tarjeta del día 17 salió con +21,800 de diferencia. Para corregirlo sin depender de que la cajera digite bien un número al final:

* Regla de oro al cobrar («Sin número de aprobación no hay factura»): Cada vez que se cobra con tarjeta, la cajera debe digitar en la factura de Nexora los últimos 4 dígitos de aprobación del voucher (o el monto exacto que salió en el papelito) y engrapar el voucher copia comercio a una hoja del turno. Así es imposible pasar el verifón por RD$ 2,500 y olvidar facturarlo, porque al final del día todo voucher en la gaveta debe tener su número de factura escrito arriba.
* Cómo evitar que el lote quede abierto de un día para otro:
  * Cierre de lote obligatorio pegado al acta: Ninguna cajera puede irse ni recibir el PIN de cierre si no engrapa el Reporte de Cierre de Lote (Settlement) impreso por el verifón junto al papel de cierre de Nexora.
  * Revisión de la fecha y hora del lote: El supervisor revisa que el voucher largo del verifón diga «CIERRE DE LOTE EXITOSO» con fecha de hoy, y no solo un «Reporte de Totales» (que muestra ventas pero deja el lote abierto para el día siguiente).
  * Revisión en la apertura de la mañana (1 minuto): Al abrir la caja en la mañana, la cajera saca un «Sub-total» del verifón; debe salir en RD$ 0.00. Si sale con monto del día anterior, se cierra ese lote antes de atender al primer cliente para no mezclar días.

## 5. Tabla Resumen de Problemas y Soluciones

| Problema | Propuesta | Esfuerzo (bajo, medio o alto) | Cómo evita el robo |
|---|---|---|---|
| 1. Cerrar un cobro no obliga a decir dónde está el dinero (ej. contraentrega de RD$ 3,300 del 11 de oct cerrada en caja). | Prohibir que la cajera cierre en su turno cobros que no entraron a su gaveta; si los tiene la dueña, los cierra la dueña o se mete una Salida firmada al instante. | Bajo (operativo hoy) / Medio (opción en sistema) | Impide que un cajero use el cuento de «era una factura vieja que tenía la jefa» para esconder un faltante real de efectivo en su gaveta. |
| 2. No existe opción para efectivo recibido por la dueña antes (solo existe para transferencias). | Crear la forma de cobro «Efectivo en manos de Administración/Dueña» (protegida con PIN de gerente) que salda la factura sin sumar a la gaveta. | Medio | Separa el bolsillo de la dueña de la gaveta de la cajera; nadie puede mezclar cuentas ni cobrar una factura vieja y quedarse con el efectivo sin rastro. |
| 3. El papel de cierre es confuso (no separa ventas del día de cobros viejos ni dice cuánto entregar). | Rediseñar el formato del ticket (o usar una plantilla impresa al lado) separando: Ventas de hoy, Cobros viejos (con # factura y cliente), Salidas y Efectivo a Entregar. | Bajo (plantilla en papel) / Medio (ticket en app) | La dueña ve en 10 segundos qué facturas viejas se cobraron, de qué clientes son y exactamente cuántos billetes debe recibir en la mano. |
| 4. La alerta de diferencia (> RD$ 100) es pasiva (solo se ve entrando al panel). | Enviar aviso automático por correo o WhatsApp/Telegram al celular de la dueña cuando se cierre con diferencia o se use el PIN de gerente. | Medio | La dueña se entera en el mismo minuto en que cierran la caja, impidiendo que cajero y encargado oculten descuadres entre ellos. |
| 5. La tarjeta se digita a mano, hay cobros sin factura (RD$ 2,500) y lotes sin cerrar (+21,800). | Exigir engrapar el Cierre de Lote del verifón al acta de cierre, verificar lote en RD$ 0 al abrir en la mañana y anotar # de factura en cada voucher. | Bajo | Evita que cobren un producto por verifón sin facturarlo para llevarse mercancía o efectivo de la caja, y elimina los descuadres acumulados de días anteriores. |
| 6. Mucho efectivo en caja y complejidad para auditar quién cobró qué. | Hacer entregas parciales con doble firma cuando la gaveta pase de un tope y hacer doble conteo al final del día. | Bajo | Reduce el dinero tentador en la gaveta y deja un recibo firmado por cada peso que sale de manos de la cajera hacia la dueña. |

## 6. Las 3 cosas que haría primero (en orden)

* Hoy mismo (Cero código): Regla de «Gaveta Real» y Cierre de Lote del Verifón grapado. Prohibir que los cajeros cierren en su caja contraentregas cuyo dinero ya tiene la dueña; esas facturas las rebaja solo la dueña o se acompañan en el acto de un vale de Salida de Caja firmado. Al mismo tiempo, exigir que ningún cierre se apruebe con PIN si no tiene engrapado el papel físico de Cierre de Lote del Verifón de ese día (y revisar cada mañana que el verifón amanezca en cero).
* Esta semana: Hoja/Ticket desglosado y talonario de Entregas Parciales. Poner al lado de la caja media hoja impresa (mientras se ajusta el ticket de Nexora) donde la cajera anote al cerrar los cobros de facturas viejas con número de factura y cliente, y un talonario de recibos para que cada vez que la dueña retire efectivo o reciba una contraentrega, quede un papelito firmado dentro de la gaveta.
* Siguiente paso en Nexora POS: Botón «Efectivo recibido por Dueña» + Alerta al celular. Cuando se autorice tocar el sistema, agregar la opción para cerrar contraentregas en efectivo directo a cuenta de la dueña (igual que hoy se hace con las transferencias de crédito, sin tocar la gaveta) y conectar la alerta de diferencias mayores a RD$ 100 al correo o WhatsApp de la dueña.

## 7. Preguntas rápidas para no asumir lo que no está en este documento

Como no tengo acceso a leer AGENTS.md ni docs/coordinacion/ORDEN_LEVANTAMIENTO_CIERRE_CAJA.md en el repositorio:

* Horarios y turnos: ¿Hacen un solo cierre de caja al final del día o hay cambio de turno de cajeras al mediodía?
* Mensajeros de contraentrega: Cuando un mensajero regresa con el dinero de las contraentregas (como las de los días 15 y 16), ¿le entrega siempre a la cajera de turno o a veces a la dueña y a veces a la cajera?
* Verifones: ¿Usan un solo verifón para toda la tienda o hay más de un aparato / banco (ej. CardNet y Azul) que deban cuadrarse por separado?
