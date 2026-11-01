// Guía de los reportes y de los informes formales, en español claro para la
// dueña. Cada definición se verificó leyendo el código que calcula la cifra.
// Donde no se pudo confirmar, o el código no coincide con la regla vigente
// (devoluciones por fecha de venta en el desglose), el texto dice «por confirmar».
// La prueba tests/reportes-guia.test.ts revisa que todo reporte registrado tenga
// guía completa y que ninguna columna quede sin explicar.

export type Explicacion = { nombreAmigable: string; significa: string };
export type Guia = {
  queEs: string;
  paraQueSirve: string;
  comoSeLee: string;
  /** Clave = encabezado tal como sale en pantalla, Excel o PDF. */
  columnas: Record<string, Explicacion>;
};

const c = (nombreAmigable: string, significa: string): Explicacion => ({
  nombreAmigable,
  significa,
});

// Ventas netas: lo vendido menos lo devuelto de esa misma venta, por fecha de venta.
const NETO_POR_VENTA =
  "Las devoluciones se restan en la fecha de la venta original.";
const POR_CONFIRMAR_DEVOLUCION =
  " Por confirmar: en este reporte las devoluciones se restan en la fecha en que se devolvieron, no en la de la venta.";

// Mismas columnas de mezcla de pagos (formas-pago-mes y formas-pago-categoria).
const MEZCLA: Record<string, Explicacion> = {
  Efectivo: c("Efectivo", "Lo cobrado en efectivo de las facturas."),
  Transferencia: c("Transferencia", "Lo cobrado por transferencia bancaria."),
  Tarjeta: c("Tarjeta", "Lo cobrado con tarjeta."),
  "Crédito/contraentrega": c(
    "Crédito o contraentrega",
    "Lo que quedó a crédito o se cobra contra entrega. Incluye transferencias rechazadas.",
  ),
  Otros: c(
    "Otros",
    "Cualquier otra forma de pago que no entra en las anteriores.",
  ),
  Total: c("Total", "Suma de las cinco formas de pago de la fila."),
  "% Efectivo": c("% en efectivo", "Parte del total que se cobró en efectivo."),
  "% Transferencia": c(
    "% en transferencia",
    "Parte del total cobrada por transferencia.",
  ),
  "% Tarjeta": c("% con tarjeta", "Parte del total cobrada con tarjeta."),
  "% Crédito/contraentrega": c(
    "% a crédito o contraentrega",
    "Parte del total que quedó a crédito o contraentrega.",
  ),
};

// Columnas de margen (solo para quien tiene permiso de ver costo y ganancia).
const MARGEN_COLUMNAS: Record<string, Explicacion> = {
  Unidades: c(
    "Unidades vendidas",
    "Piezas vendidas, menos las que se devolvieron.",
  ),
  Venta: c(
    "Venta",
    "Lo que se cobró por esas piezas, menos devoluciones. Incluye el ITBIS porque es el precio que pagó el cliente.",
  ),
  Costo: c(
    "Costo",
    "Lo que costó la mercancía vendida (costo promedio de cada producto).",
  ),
  Utilidad: c(
    "Ganancia",
    "Venta menos costo. Es lo que queda antes de pagar gastos.",
  ),
  "Margen %": c(
    "Margen %",
    "De cada 100 pesos de venta, cuántos quedan de ganancia: (precio menos costo) dividido entre precio. No se resta el ITBIS.",
  ),
};

export const GUIA_REPORTES: Record<string, Guia> = {
  // ---------------- VENTAS ----------------
  "ventas-por-hora": {
    queEs: "Cuántas ventas y cuánto dinero entra en cada hora del día.",
    paraQueSirve:
      "Para saber en qué horas hay más clientes y ponerle más gente a caja.",
    comoSeLee: `Cada fila es una hora (hora de Santo Domingo). ${NETO_POR_VENTA}`,
    columnas: {
      Hora: c("Hora", "La hora del día, de 00:00 a 23:00."),
      Facturas: c("Facturas", "Cuántas facturas se hicieron en esa hora."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido en esa hora, menos lo devuelto.",
      ),
      "% del total": c(
        "% del total",
        "Qué parte de todas las ventas del período fue en esa hora.",
      ),
    },
  },
  "ventas-por-dia-semana": {
    queEs: "Ventas agrupadas por día de la semana (lunes a domingo).",
    paraQueSirve:
      "Para ver qué días de la semana venden más y planear personal y compras.",
    comoSeLee: `Compara todos los lunes del período, todos los martes, etc. ${NETO_POR_VENTA}`,
    columnas: {
      Día: c("Día", "Día de la semana."),
      Facturas: c(
        "Facturas",
        "Cuántas facturas se hicieron ese día de la semana.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido ese día de la semana, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Cuánto gasta un cliente en promedio por factura ese día.",
      ),
      "% del total": c(
        "% del total",
        "Qué parte de las ventas del período cayó en ese día.",
      ),
    },
  },
  "ventas-mes-anterior": {
    queEs:
      "Compara el mes que termina en la fecha final del reporte con el mes anterior.",
    paraQueSirve: "Para ver si este mes vende más o menos que el mes pasado.",
    comoSeLee: `Usa el mes de la fecha final del reporte, no todo el rango. ${NETO_POR_VENTA} El cambio % solo aparece en el mes actual.`,
    columnas: {
      Mes: c("Mes", "El mes que se compara."),
      Facturas: c("Facturas", "Cuántas facturas se hicieron en ese mes."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido en el mes, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Lo vendido dividido entre las facturas del mes.",
      ),
      "Cambio %": c(
        "Cambio contra el mes anterior",
        "Cuánto subió (+) o bajó (−) el mes actual frente al mes anterior, en porcentaje.",
      ),
    },
  },
  "ventas-mes-ano-anterior": {
    queEs:
      "Compara el mes que termina en la fecha final del reporte con el mismo mes del año pasado.",
    paraQueSirve:
      "Para ver si el negocio crece frente al mismo mes del año anterior, sin que pesen las temporadas.",
    comoSeLee: `Usa el mes de la fecha final del reporte. ${NETO_POR_VENTA} El cambio % solo aparece en el mes actual.`,
    columnas: {
      Mes: c("Mes", "El mes que se compara."),
      Facturas: c("Facturas", "Cuántas facturas se hicieron en ese mes."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido en el mes, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Lo vendido dividido entre las facturas del mes.",
      ),
      "Cambio %": c(
        "Cambio contra el año pasado",
        "Cuánto subió (+) o bajó (−) este mes frente al mismo mes del año anterior, en porcentaje.",
      ),
    },
  },
  "ticket-promedio": {
    queEs:
      "Cuánto gasta en promedio un cliente por factura, día por día y mes por mes.",
    paraQueSirve:
      "Para saber si la gente compra más o menos cada vez que viene.",
    comoSeLee: `Hay filas de tipo Día y filas de tipo Mes. ${NETO_POR_VENTA}`,
    columnas: {
      Tipo: c("Tipo", "Si la fila es un día o un mes completo."),
      Período: c("Período", "La fecha del día, o el nombre del mes."),
      Facturas: c("Facturas", "Cuántas facturas hay en ese día o mes."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido en ese día o mes, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Lo vendido dividido entre las facturas.",
      ),
    },
  },
  "unidades-por-factura": {
    queEs: "Cuántas piezas lleva cada cliente por factura, agrupado en rangos.",
    paraQueSirve:
      "Para ver si la gente compra una sola cosa o varias, y si conviene ofrecer combos.",
    comoSeLee: `Cada fila es un rango de piezas. Devuelta completa significa que la factura quedó en cero piezas por devoluciones. La última fila da el promedio de piezas por factura. ${NETO_POR_VENTA}`,
    columnas: {
      Unidades: c(
        "Piezas por factura",
        "El rango de piezas (1, 2, … 5, 6 a 10, más de 10), o el promedio en la última fila.",
      ),
      Facturas: c("Facturas", "Cuántas facturas caen en ese rango."),
      "% de facturas": c(
        "% de facturas",
        "Qué parte de las facturas del período cae en ese rango.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido en las facturas de ese rango, menos lo devuelto.",
      ),
    },
  },
  "ranking-cajeras": {
    queEs: "Las cajeras ordenadas de la que más vendió a la que menos vendió.",
    paraQueSirve:
      "Para reconocer el trabajo de cada cajera y ver quién necesita apoyo.",
    comoSeLee: `El puesto 1 es la cajera con más ventas netas del período. ${NETO_POR_VENTA}`,
    columnas: {
      Puesto: c("Puesto", "El lugar de la cajera en el ranking."),
      Cajera: c(
        "Cajera",
        "Nombre de la cajera que hizo la venta. Sin nombre aparece como (sin nombre).",
      ),
      Facturas: c("Facturas", "Cuántas facturas hizo."),
      Unidades: c("Piezas", "Piezas vendidas, menos las devueltas."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido por esa cajera, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Lo vendido dividido entre sus facturas.",
      ),
      "% del total": c(
        "% del total",
        "Qué parte de las ventas del período hizo esa cajera.",
      ),
    },
  },
  "top-clientes": {
    queEs: "Los 20 clientes que más compraron en el período.",
    paraQueSirve:
      "Para cuidar a los mejores clientes y darles atención especial.",
    comoSeLee: `Ordenado por ventas netas. ${NETO_POR_VENTA} El porcentaje se calcula sobre todas las ventas del período, no solo sobre estos 20.`,
    columnas: {
      Puesto: c("Puesto", "El lugar del cliente en el ranking, del 1 al 20."),
      Cliente: c("Cliente", "Nombre del cliente."),
      Facturas: c("Facturas", "Cuántas facturas le hicimos en el período."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo que compró en el período, menos lo devuelto.",
      ),
      "Ticket promedio": c(
        "Ticket promedio",
        "Cuánto gasta en promedio por factura.",
      ),
      "% de las ventas": c(
        "% de las ventas",
        "Qué parte de todas las ventas del período es de este cliente.",
      ),
    },
  },
  "ventas-categoria-mes": {
    queEs:
      "Las ventas de cada categoría (suplementos, ropa, etc.) mes por mes.",
    paraQueSirve: "Para ver qué categorías crecen o bajan con el tiempo.",
    comoSeLee: `Cada fila es una categoría en un mes. ${NETO_POR_VENTA} El % del mes muestra qué parte de las ventas de ese mes fue de esa categoría.`,
    columnas: {
      Mes: c("Mes", "El mes del período."),
      Categoría: c("Categoría", "La categoría del producto."),
      Facturas: c(
        "Facturas",
        "Cuántas facturas incluyeron esa categoría ese mes.",
      ),
      Unidades: c(
        "Piezas",
        "Piezas vendidas de esa categoría, menos las devueltas.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido de esa categoría ese mes, menos lo devuelto.",
      ),
      "% del mes": c(
        "% del mes",
        "Qué parte de las ventas de ese mes fue de esta categoría.",
      ),
    },
  },
  "ventas-por-marca": {
    queEs: "Las ventas de cada marca, de la que más vende a la que menos.",
    paraQueSirve:
      "Para decidir qué marcas comprar más y cuáles conviene reducir.",
    comoSeLee: `Los productos sin marca aparecen como Sin marca. ${NETO_POR_VENTA}`,
    columnas: {
      Marca: c("Marca", "El nombre de la marca del producto."),
      Facturas: c("Facturas", "Cuántas facturas incluyeron esa marca."),
      Unidades: c(
        "Piezas",
        "Piezas vendidas de esa marca, menos las devueltas.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido de esa marca, menos lo devuelto.",
      ),
      "% del total": c(
        "% del total",
        "Qué parte de las ventas del período es de esa marca.",
      ),
    },
  },

  // ---------------- DINERO ----------------
  descuadres: {
    queEs:
      "Cada caja cerrada que no cuadró: faltó o sobró dinero, con quién cerró, quién lo aprobó y cómo se resolvió.",
    paraQueSirve:
      "Para revisar cada diferencia de caja y confirmar que tuvo explicación.",
    comoSeLee:
      "Solo aparecen cajas cerradas con diferencia en efectivo, tarjeta o transferencia. Un número negativo es faltante y uno positivo es sobrante. Si la columna Resolución dice PENDIENTE, nadie la ha cerrado todavía.",
    columnas: {
      Día: c("Día", "El día en que se cerró la caja."),
      Caja: c("Caja", "El nombre de la terminal o caja."),
      Cajera: c("Cajera", "La persona que cerró la caja."),
      Mensajero: c(
        "Mensajero",
        "El mensajero que cobró envíos en esa caja, si hubo.",
      ),
      Efectivo: c(
        "Diferencia en efectivo",
        "Cuánto faltó (−) o sobró (+) en efectivo.",
      ),
      Tarjeta: c(
        "Diferencia en tarjeta",
        "Cuánto faltó (−) o sobró (+) en tarjeta.",
      ),
      Transferencia: c(
        "Diferencia en transferencia",
        "Cuánto faltó (−) o sobró (+) en transferencias.",
      ),
      Aprobó: c(
        "Aprobó",
        "Quién aprobó la diferencia. Si nadie, dice Sin aprobar.",
      ),
      Justificación: c(
        "Motivo",
        "La explicación que se escribió para la diferencia.",
      ),
      Resolución: c(
        "Cómo se resolvió",
        "La nota de cómo se arregló y quién lo registró. PENDIENTE si falta.",
      ),
    },
  },
  "entradas-cuenta": {
    queEs:
      "Por dónde entró el dinero cada día: caja, cuenta de banco o terminal de tarjeta.",
    paraQueSirve:
      "Para cuadrar el dinero que llegó al banco o a la terminal con lo que la tienda registró.",
    comoSeLee:
      "Cuenta solo los cobros de ventas y los abonos que sí llegaron, por fecha del cobro. No incluye los pagos rechazados ni las devoluciones: los reembolsos se ven en el informe de ingresos por día.",
    columnas: {
      Día: c("Día", "El día en que entró el dinero."),
      Forma: c("Forma de pago", "Efectivo, tarjeta o transferencia."),
      "Cuenta / terminal": c(
        "Cuenta o terminal",
        "Caja para efectivo. Para tarjeta y transferencia, la cuenta o terminal que se indicó. Sin indicar si no se anotó.",
      ),
      Cobros: c(
        "Cobros",
        "Cuántos pagos entraron por esa forma y cuenta ese día.",
      ),
      Monto: c("Monto", "Suma de esos pagos."),
    },
  },
  "formas-pago-mes": {
    queEs:
      "Cómo se cobró cada mes: efectivo, transferencia, tarjeta o crédito.",
    paraQueSirve:
      "Para saber qué parte de las ventas se cobra en cada forma de pago, mes a mes.",
    comoSeLee:
      "Las ventas se cuentan por mes de la venta. Las devoluciones se restan en el mes en que se devolvieron, y el reembolso se resta en la forma en que se devolvió el dinero. Un pago por transferencia rechazado cuenta como crédito." +
      POR_CONFIRMAR_DEVOLUCION,
    columnas: {
      Mes: c("Mes", "El mes del período."),
      ...MEZCLA,
    },
  },
  "formas-pago-categoria": {
    queEs: "Cómo se cobró cada categoría de producto, mes por mes.",
    paraQueSirve:
      "Para ver si una categoría se compra más a crédito, con tarjeta o en efectivo.",
    comoSeLee:
      "Lo vendido de cada categoría en cada factura se reparte según cómo se pagó esa factura. Las devoluciones se restan en la fecha de la venta original. Un pago por transferencia rechazado cuenta como crédito.",
    columnas: {
      Mes: c("Mes", "El mes de la venta."),
      Categoría: c("Categoría", "La categoría del producto."),
      ...MEZCLA,
    },
  },
  "descuentos-cajera": {
    queEs:
      "Cuántos descuentos dio cada cajera, de cuánto fueron y cuántos aprobó ella misma.",
    paraQueSirve:
      "Para ver si una cajera da descuentos de más o aprueba descuentos sin que otra persona lo revise.",
    comoSeLee:
      "El % compara el descuento total con sus ventas netas del período. Las devoluciones se restan en la fecha en que se devolvieron." +
      POR_CONFIRMAR_DEVOLUCION +
      " Aprobados por ella misma cuenta los descuentos que aprobó la propia cajera.",
    columnas: {
      Cajera: c("Cajera", "La persona que hizo la venta con descuento."),
      "Facturas con descuento": c(
        "Facturas con descuento",
        "Cuántas facturas suyas tuvieron algún descuento.",
      ),
      "Descuento total": c(
        "Descuento total",
        "Suma de todos los descuentos que dio.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo vendido por ella, menos lo devuelto.",
      ),
      "% de sus ventas": c(
        "% de sus ventas",
        "Qué parte de sus ventas netas representa el descuento.",
      ),
      "Aprobados por ella misma": c(
        "Aprobados por ella misma",
        "Cuántos de esos descuentos los aprobó ella sin otra persona.",
      ),
    },
  },
  "por-mayor-detalle": {
    queEs:
      "Cuánto se vendió por mayor (a precio de mayoreo) y cuánto al detalle.",
    paraQueSirve: "Para ver cuánto pesa la venta por mayor en el negocio.",
    comoSeLee:
      "Las ventas se suman por la fecha de la venta. Las devoluciones se restan en la fecha en que se devolvieron." +
      POR_CONFIRMAR_DEVOLUCION,
    columnas: {
      Tipo: c("Tipo de venta", "Por mayor o detalle."),
      Facturas: c("Facturas", "Cuántas facturas de ese tipo hubo."),
      Ventas: c("Ventas", "Suma del total de esas facturas."),
      Devoluciones: c("Devoluciones", "Lo devuelto en el período de ese tipo."),
      Neto: c("Neto", "Ventas menos devoluciones."),
      "% del total": c(
        "% del total",
        "Qué parte del neto total es de ese tipo.",
      ),
    },
  },
  "envios-mensajero": {
    queEs:
      "El cobro de envíos que hizo el mensajero, cuánto se le ha pagado y cuánto falta.",
    paraQueSirve:
      "Para saber cuánto dinero de envíos le debemos al mensajero y cuánto ya se le liquidó.",
    comoSeLee:
      "El envío es de un tercero y va aparte de la venta. Pagado significa que ya se le liquidó. Pendiente es lo que todavía no se le ha pagado.",
    columnas: {
      Mensajero: c(
        "Mensajero",
        "Nombre del mensajero. Sin nombre aparece vacío.",
      ),
      Envíos: c("Envíos", "Cuántos envíos cobró."),
      "Monto de envíos": c(
        "Monto de envíos",
        "Suma de lo cobrado por esos envíos.",
      ),
      Pagados: c("Envíos pagados", "Cuántos envíos ya se le liquidaron."),
      "Monto pagado": c("Monto pagado", "Lo que ya se le pagó."),
      Pendientes: c(
        "Envíos pendientes",
        "Cuántos envíos todavía no se le pagan.",
      ),
      "Monto pendiente": c("Monto pendiente", "Lo que todavía le debemos."),
    },
  },
  "diferencias-cuadre": {
    queEs: "Cuánto faltó o sobró en las cajas de cada cajera, en el período.",
    paraQueSirve:
      "Para ver qué cajera cuadra mejor y dónde hay que poner atención.",
    comoSeLee:
      "Cuenta las cajas cerradas en el período, por fecha de cierre. Negativo es faltante y positivo es sobrante. La diferencia total es la que calcula el sistema para cada caja; la fórmula exacta por confirmar.",
    columnas: {
      Cajera: c("Cajera", "La persona que cerró las cajas."),
      "Cajas cerradas": c(
        "Cajas cerradas",
        "Cuántas cajas cerró en el período.",
      ),
      "Diferencia efectivo": c(
        "Diferencia en efectivo",
        "Suma de la diferencia en efectivo (− falta, + sobra).",
      ),
      "Diferencia tarjeta": c(
        "Diferencia en tarjeta",
        "Suma de la diferencia en tarjeta.",
      ),
      "Diferencia transferencia": c(
        "Diferencia en transferencia",
        "Suma de la diferencia en transferencias.",
      ),
      "Diferencia total": c(
        "Diferencia total",
        "Suma de la diferencia total de cada caja. Por confirmar la fórmula exacta.",
      ),
      "Cajas con faltante": c(
        "Cajas con faltante",
        "Cuántas cajas cerraron con menos dinero del esperado.",
      ),
      "Cajas con sobrante": c(
        "Cajas con sobrante",
        "Cuántas cajas cerraron con más dinero del esperado.",
      ),
    },
  },
  anulaciones: {
    queEs: "Las facturas anuladas por cajera y el motivo de cada anulación.",
    paraQueSirve:
      "Para detectar anulaciones raras o repetidas y ver si hay un patrón.",
    comoSeLee:
      "Se cuentan por la fecha de la factura anulada. Monto es el total de la factura. Sin motivo aparece vacío.",
    columnas: {
      Cajera: c("Cajera", "La persona que hizo la factura anulada."),
      Motivo: c("Motivo", "La razón que se escribió para anularla."),
      Anuladas: c("Anuladas", "Cuántas facturas se anularon con ese motivo."),
      Monto: c("Monto", "Suma de los totales de esas facturas."),
    },
  },
  "devoluciones-producto": {
    queEs:
      "Qué productos se devolvieron, cuántas veces, cuántas piezas y cuánto dinero.",
    paraQueSirve:
      "Para ver qué productos generan más devoluciones y si hay un problema con alguno.",
    comoSeLee:
      "Cada fila es un producto. Las devoluciones se cuentan en la fecha en que se devolvieron. El monto es lo que se devolvió de ese producto; en devoluciones antiguas sin ese dato se calcula en proporción a la línea vendida.",
    columnas: {
      Producto: c("Producto", "Nombre del producto devuelto."),
      SKU: c("Código", "El código interno del producto (SKU)."),
      Devoluciones: c(
        "Devoluciones",
        "Cuántas devoluciones incluyeron ese producto.",
      ),
      Unidades: c("Piezas devueltas", "Cuántas piezas se devolvieron."),
      Monto: c("Monto devuelto", "Cuánto dinero se devolvió de ese producto."),
    },
  },

  // ---------------- MARGEN (solo con permiso de ganancia) ----------------
  "margen-por-producto": {
    queEs:
      "La ganancia de cada producto: cuánto se vendió, cuánto costó y cuánto quedó.",
    paraQueSirve:
      "Para saber qué productos dejan más ganancia y cuáles casi no dejan nada.",
    comoSeLee: `${NETO_POR_VENTA} Margen % es de cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS. Ninguna venta se bloquea por su margen.`,
    columnas: {
      Producto: c("Producto", "Nombre del producto."),
      ...MARGEN_COLUMNAS,
    },
  },
  "margen-por-categoria": {
    queEs: "La ganancia de cada categoría de producto.",
    paraQueSirve:
      "Para ver qué categorías dejan más ganancia y dónde conviene mover precios o compras.",
    comoSeLee: `${NETO_POR_VENTA} Margen % es de cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS.`,
    columnas: {
      Categoría: c("Categoría", "La categoría del producto."),
      ...MARGEN_COLUMNAS,
    },
  },
  "margen-por-empresa": {
    queEs:
      "Cuánto vendió y ganó cada empresa del grupo: GV Makeup Studio y MacGen.",
    paraQueSirve:
      "Para ver cuánto aporta cada empresa a la ganancia del grupo.",
    comoSeLee: `La empresa se toma de la categoría: las categorías que empiezan por GV son GV Makeup Studio; las demás son MacGen. ${NETO_POR_VENTA} Margen % no resta el ITBIS.`,
    columnas: {
      Empresa: c("Empresa", "GV Makeup Studio o MacGen."),
      ...MARGEN_COLUMNAS,
    },
  },
  "margen-por-marca": {
    queEs: "La ganancia de cada marca.",
    paraQueSirve:
      "Para decidir qué marcas comprar más y cuáles dejan poca ganancia.",
    comoSeLee: `${NETO_POR_VENTA} Margen % no resta el ITBIS. Los productos sin marca aparecen vacíos.`,
    columnas: {
      Marca: c("Marca", "El nombre de la marca del producto."),
      ...MARGEN_COLUMNAS,
    },
  },
  "margen-por-cajera": {
    queEs: "La ganancia que dejó cada cajera en sus ventas.",
    paraQueSirve:
      "Para ver qué cajera vende con mejor ganancia y si alguna vende muy barato.",
    comoSeLee: `${NETO_POR_VENTA} Margen % no resta el ITBIS. Sin cajera aparece cuando la venta no tiene nombre de cajera.`,
    columnas: {
      Cajera: c("Cajera", "La persona que hizo la venta."),
      ...MARGEN_COLUMNAS,
    },
  },
  "ventas-margen-bajo": {
    queEs: "Las facturas cuyo margen quedó por debajo del 15 %.",
    paraQueSirve: "Para revisar qué ventas dejaron poca ganancia y por qué.",
    comoSeLee:
      "Es una lista para revisar: no bloquea ni cambia ninguna venta. Margen % es de cada 100 pesos de venta, cuántos quedan de ganancia; no se resta el ITBIS. Las devoluciones se restan en la fecha de la venta original.",
    columnas: {
      Factura: c("Factura", "Número de la factura."),
      Fecha: c("Fecha", "Fecha y hora de la venta."),
      Cajera: c("Cajera", "La persona que hizo la venta."),
      Total: c("Venta", "Lo que se cobró por la factura, menos devoluciones."),
      Costo: c("Costo", "Lo que costó la mercancía de la factura."),
      Utilidad: c("Ganancia", "Venta menos costo."),
      "Margen %": c(
        "Margen %",
        "De cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS.",
      ),
    },
  },
  "utilidad-bruta-por-mes": {
    queEs:
      "La ganancia bruta de cada mes: venta menos costo de la mercancía vendida.",
    paraQueSirve: "Para ver si el negocio gana más o menos cada mes.",
    comoSeLee: `Es la ganancia antes de pagar gastos (renta, sueldos, luz). ${NETO_POR_VENTA} Margen % no resta el ITBIS.`,
    columnas: {
      Mes: c("Mes", "El mes del período, en formato año-mes."),
      Facturas: c("Facturas", "Cuántas facturas tuvo el mes."),
      Venta: c("Venta", "Lo cobrado en el mes, menos devoluciones."),
      Costo: c("Costo", "Lo que costó la mercancía vendida ese mes."),
      Utilidad: c("Ganancia bruta", "Venta menos costo. No descuenta gastos."),
      "Margen %": c(
        "Margen %",
        "De cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS.",
      ),
    },
  },
  "costo-vendido-vs-inventario": {
    queEs:
      "Cuánto costó lo que se vendió comparado con cuánto vale la mercancía que hay en existencia.",
    paraQueSirve:
      "Para saber cuántos días de mercancía tenemos al ritmo de venta actual.",
    comoSeLee:
      "El inventario se valora al costo promedio de cada producto, en todos los almacenes. Días de cobertura es cuántos días alcanza el inventario al ritmo de venta del período. Inventario entre costo vendido es cuántas veces cabe el inventario en lo vendido.",
    columnas: {
      "Costo de lo vendido": c(
        "Costo de lo vendido",
        "Lo que costó la mercancía vendida en el período, menos devoluciones.",
      ),
      "Valor del inventario (costo)": c(
        "Valor del inventario al costo",
        "Cuánto vale hoy la mercancía en existencia, a costo promedio.",
      ),
      "Días del período": c(
        "Días del período",
        "Cuántos días tiene el período hasta hoy.",
      ),
      "Costo vendido por día": c(
        "Costo vendido por día",
        "Costo de lo vendido dividido entre los días del período.",
      ),
      "Días de cobertura": c(
        "Días de cobertura",
        "Cuántos días alcanza el inventario al ritmo de venta del período.",
      ),
      "Inventario / costo vendido": c(
        "Inventario entre costo vendido",
        "Cuántas veces cabe el inventario en lo vendido en el período.",
      ),
    },
  },
  "precio-vendido-vs-lista": {
    queEs:
      "Si los productos se vendieron al precio de lista o con descuento: precio promedio cobrado contra el precio de lista.",
    paraQueSirve:
      "Para ver qué productos se venden más barato de lo que dice la lista.",
    comoSeLee: `Precio promedio vendido es lo cobrado dividido entre las piezas. Diferencia % negativa significa que se vendió por debajo de la lista. ${NETO_POR_VENTA}`,
    columnas: {
      Producto: c("Producto", "Nombre del producto."),
      SKU: c("Código", "El código interno del producto (SKU)."),
      Unidades: c("Piezas vendidas", "Piezas vendidas, menos devueltas."),
      "Precio promedio vendido": c(
        "Precio promedio cobrado",
        "Lo cobrado dividido entre las piezas.",
      ),
      "Precio de lista": c(
        "Precio de lista",
        "El precio de la lista de ese producto.",
      ),
      "Diferencia %": c(
        "Diferencia con la lista",
        "Cuánto más (+) o menos (−) se cobró frente a la lista, en porcentaje.",
      ),
    },
  },

  // ---------------- INVENTARIO ----------------
  "rotacion-producto": {
    queEs:
      "Cuántas veces rotó cada producto en el período: vendidas frente al inventario que hubo.",
    paraQueSirve:
      "Para ver qué productos se mueven rápido y cuáles se quedan quietos.",
    comoSeLee:
      "El stock cuenta Tienda más Casa. El stock inicial y final se calculan a partir del stock actual, quitando los movimientos posteriores. Rotación es vendidas dividido entre el stock promedio: más alto significa que el producto se mueve más rápido.",
    columnas: {
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Categoría: c("Categoría", "La categoría del producto."),
      Vendidas: c(
        "Piezas vendidas",
        "Piezas vendidas en el período, menos devueltas.",
      ),
      "Stock inicial": c(
        "Existencia al inicio",
        "Piezas en existencia al inicio del período (Tienda más Casa).",
      ),
      "Stock final": c(
        "Existencia al final",
        "Piezas en existencia al final del período (Tienda más Casa).",
      ),
      "Stock promedio": c(
        "Existencia promedio",
        "El promedio entre la existencia del inicio y la del final.",
      ),
      Rotación: c(
        "Rotación",
        "Cuántas veces se vendió el inventario promedio. Vacío si no hubo inventario.",
      ),
    },
  },
  "dias-inventario": {
    queEs:
      "Cuántos días de venta alcanza el inventario que hay hoy, por producto.",
    paraQueSirve:
      "Para saber qué productos se van a acabar pronto y cuándo hay que comprar.",
    comoSeLee:
      "La venta diaria es lo vendido en el período dividido entre los días del período. Días restantes es el stock total dividido entre la venta diaria. Ordenado de menos a más días.",
    columnas: {
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Categoría: c("Categoría", "La categoría del producto."),
      Tienda: c("Tienda", "Piezas en la tienda."),
      Casa: c("Casa", "Piezas en la casa (bodega)."),
      "Stock total": c("Existencia total", "Tienda más Casa."),
      "Vendidas en el período": c(
        "Piezas vendidas",
        "Piezas vendidas en el período, menos devueltas.",
      ),
      "Venta diaria": c(
        "Venta diaria",
        "Piezas que se venden por día, al ritmo del período.",
      ),
      "Días restantes": c(
        "Días que alcanza",
        "Cuántos días de venta alcanza la existencia actual.",
      ),
    },
  },
  "sin-movimiento": {
    queEs:
      "Los productos que no se han vendido en 30, 60 o 90 días, con existencia en la tienda o la casa.",
    paraQueSirve:
      "Para ver qué productos están quietos y decidir si hay que rebajarlos o dejar de comprarlos.",
    comoSeLee:
      "Los días sin vender se cuentan desde la última venta hasta la fecha final del reporte. Si nunca se vendió, se cuentan desde que se creó el producto. Nunca en Última venta significa que no tiene ventas.",
    columnas: {
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Categoría: c("Categoría", "La categoría del producto."),
      Tienda: c("Tienda", "Piezas en la tienda."),
      Casa: c("Casa", "Piezas en la casa (bodega)."),
      "Última venta": c(
        "Última venta",
        "Fecha de la última venta. Nunca si no tiene ventas.",
      ),
      "Días sin vender": c(
        "Días sin vender",
        "Cuántos días pasaron sin venderse.",
      ),
      Tramo: c("Tramo", "30-59, 60-89 o 90 días o más sin vender."),
    },
  },
  "bajo-minimo": {
    queEs:
      "Los productos cuya existencia en la tienda ya está en el mínimo o por debajo.",
    paraQueSirve: "Para saber qué comprar o reponer hoy.",
    comoSeLee:
      "Es la existencia de hoy, no la del período. Faltan es cuántas piezas faltan para llegar al mínimo.",
    columnas: {
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Categoría: c("Categoría", "La categoría del producto."),
      Tienda: c("Tienda", "Piezas en la tienda hoy."),
      Casa: c("Casa", "Piezas en la casa (bodega) hoy."),
      Mínimo: c("Mínimo", "La cantidad mínima que debe haber en la tienda."),
      Faltan: c("Faltan", "Cuántas piezas faltan para llegar al mínimo."),
    },
  },
  "valor-inventario-almacen": {
    queEs:
      "Cuánto vale la mercancía en existencia, por categoría y por almacén.",
    paraQueSirve:
      "Para saber cuánto dinero tenemos guardado en mercancía y dónde está.",
    comoSeLee:
      "El valor es al costo promedio de cada producto. Los productos sin existencia no aparecen.",
    columnas: {
      Categoría: c("Categoría", "La categoría del producto."),
      Almacén: c("Almacén", "Dónde está la mercancía: Tienda o Casa."),
      Unidades: c("Piezas", "Piezas en existencia en ese almacén."),
      "Valor a costo": c(
        "Valor a costo",
        "Cuánto vale esa mercancía a costo promedio.",
      ),
    },
  },
  "perdidas-conteo": {
    queEs:
      "La mercancía que salió sin venderse por mes: mermas, ajustes de conteo y salidas.",
    paraQueSirve:
      "Para ver cuánta mercancía se pierde y si son errores de conteo o pérdidas reales.",
    comoSeLee:
      "Corrección de conteo es un ajuste que corrigió el sistema al contar; no es una pérdida del mes. Salida real es mermas, desperdicios, devoluciones a proveedor y salidas de mercancía. Valor a costo es el costo de esas piezas.",
    columnas: {
      Mes: c("Mes", "El mes del movimiento."),
      Tipo: c(
        "Tipo",
        "Corrección de conteo (ajuste del sistema) o salida real (pérdida).",
      ),
      Unidades: c("Piezas", "Piezas que salieron o se corrigieron."),
      "Valor a costo": c("Valor a costo", "Cuánto costaron esas piezas."),
    },
  },
  traspasos: {
    queEs: "Las mercancías que se pasaron entre la Casa y la Tienda.",
    paraQueSirve:
      "Para ver quién movió qué, cuándo y por qué entre los almacenes.",
    comoSeLee:
      "Dirección muestra de dónde salió y a dónde llegó (Casa → Tienda, o Tienda → Casa). Ordenado del más reciente al más antiguo.",
    columnas: {
      Fecha: c("Fecha y hora", "Cuándo se hizo el traspaso."),
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Cantidad: c("Piezas", "Cuántas piezas se traspasaron."),
      Dirección: c(
        "De dónde a dónde",
        "De qué almacén salió y a qué almacén llegó.",
      ),
      Usuario: c("Quién lo hizo", "La persona que registró el traspaso."),
      Motivo: c("Motivo", "La razón que se escribió para el traspaso."),
    },
  },
  "agotados-con-ventas": {
    queEs:
      "Los productos que ya no tienen existencia en la tienda, pero sí se vendieron en el período.",
    paraQueSirve:
      "Para ver qué productos vendíamos y se acabaron, y reponerlos.",
    comoSeLee:
      "Solo aparecen productos con existencia en cero o menos en la tienda, y con ventas en el período. Última venta es el día de la última venta dentro del período.",
    columnas: {
      SKU: c("Código", "El código interno del producto (SKU)."),
      Producto: c("Producto", "Nombre del producto."),
      Categoría: c("Categoría", "La categoría del producto."),
      Tienda: c("Tienda", "Piezas en la tienda hoy."),
      Casa: c("Casa", "Piezas en la casa (bodega) hoy."),
      "Vendidas en el período": c(
        "Piezas vendidas",
        "Piezas vendidas en el período, menos devueltas.",
      ),
      "Última venta": c(
        "Última venta",
        "Día de la última venta dentro del período.",
      ),
    },
  },

  // ---------------- CLIENTES Y CRÉDITO ----------------
  "creditos-por-antiguedad": {
    queEs:
      "Las ventas que todavía deben dinero (a crédito o contraentrega), agrupadas por cuánto tiempo llevan sin pagarse.",
    paraQueSirve:
      "Para cobrar primero lo más viejo y saber cuánto dinero tenemos en la calle.",
    comoSeLee:
      "Los saldos son los de hoy, no los que había en la fecha del reporte. Los días se cuentan desde la fecha de la venta. Las filas Resumen dan el total de cada tramo; las demás son cada factura. El teléfono aparece parcial si no tienes permiso para verlo completo.",
    columnas: {
      Tramo: c(
        "Antigüedad",
        "Cuántos días llevan sin pagarse: 0-15, 16-30, 31-60 o más de 60 días.",
      ),
      Factura: c(
        "Factura",
        "Número de la factura. En las filas Resumen dice Resumen.",
      ),
      Tipo: c("Tipo", "Crédito o contraentrega."),
      Cliente: c(
        "Cliente",
        "Nombre del cliente. Consumidor final si no tiene nombre.",
      ),
      Teléfono: c("Teléfono", "Teléfono del cliente."),
      Fecha: c("Fecha de la venta", "Día en que se hizo la venta."),
      Vence: c("Vence", "Fecha en que vence el crédito, si tiene."),
      Días: c(
        "Días sin pagar",
        "Días desde la venta hasta la fecha del reporte.",
      ),
      Facturas: c("Facturas", "Cuántas facturas hay en el tramo."),
      Saldo: c("Saldo que debe", "Lo que todavía debe esa factura hoy."),
    },
  },
  "clientes-con-mas-deuda": {
    queEs:
      "Los clientes que más dinero deben, sumando todas sus facturas abiertas.",
    paraQueSirve: "Para saber a quién llamar primero para cobrar.",
    comoSeLee:
      "Los saldos son los de hoy. Factura más antigua es la primera factura abierta del cliente y Días es cuántos días lleva. El teléfono aparece parcial si no tienes permiso para verlo completo.",
    columnas: {
      Cliente: c("Cliente", "Nombre del cliente."),
      Teléfono: c("Teléfono", "Teléfono del cliente."),
      "Facturas abiertas": c(
        "Facturas abiertas",
        "Cuántas facturas tiene sin pagar.",
      ),
      Deuda: c("Deuda", "Suma de lo que debe en todas sus facturas abiertas."),
      "Factura más antigua": c(
        "Factura más antigua",
        "Fecha de la factura más vieja que tiene abierta.",
      ),
      "Días de la más antigua": c(
        "Días de la más antigua",
        "Cuántos días lleva esa factura sin pagarse.",
      ),
    },
  },
  "clientes-nuevos-por-mes": {
    queEs:
      "Cuántos clientes nuevos se registraron cada mes y cuántos ya compraron.",
    paraQueSirve: "Para ver si llegan clientes nuevos y si vuelven a comprar.",
    comoSeLee:
      "Ya compraron cuenta a los clientes de ese mes que tienen al menos una venta completada hasta hoy, no solo dentro del período.",
    columnas: {
      Mes: c("Mes", "El mes en que se registró el cliente."),
      "Clientes nuevos": c(
        "Clientes nuevos",
        "Cuántos clientes se registraron ese mes.",
      ),
      "Ya compraron": c(
        "Ya compraron",
        "De esos clientes, cuántos tienen al menos una compra hasta hoy.",
      ),
    },
  },
  "frecuencia-de-compra": {
    queEs:
      "Cuántas veces compró cada cliente en el período y cada cuánto tiempo.",
    paraQueSirve:
      "Para ver qué clientes compran seguido y cuáles compran pocas veces.",
    comoSeLee:
      "Cuenta las compras del período. Las devoluciones de cada venta se restan siempre, sin importar cuándo se devolvieron. Promedio de días entre compras es cuántos días pasan en promedio entre una compra y la siguiente. El teléfono aparece parcial si no tienes permiso para verlo completo.",
    columnas: {
      Cliente: c("Cliente", "Nombre del cliente."),
      Teléfono: c("Teléfono", "Teléfono del cliente."),
      Compras: c("Compras", "Cuántas compras hizo en el período."),
      "Ventas netas": c(
        "Ventas netas",
        "Lo que compró en el período, menos lo devuelto.",
      ),
      "Promedio de días entre compras": c(
        "Días entre compras",
        "Cuántos días pasan en promedio entre una compra y la siguiente. Vacío si compró una sola vez.",
      ),
      "Última compra": c(
        "Última compra",
        "Día de su última compra en el período.",
      ),
    },
  },
  "clientes-inactivos": {
    queEs: "Los clientes que no han comprado en más de 60 días.",
    paraQueSirve: "Para llamarlos o mandarles una promoción y recuperarlos.",
    comoSeLee:
      "Los días se cuentan desde su última compra hasta la fecha final del reporte. Compras y Ventas netas suman todo su historial hasta esa fecha, no solo los 60 días. Los clientes que pidieron borrar sus datos no aparecen.",
    columnas: {
      Cliente: c("Cliente", "Nombre del cliente."),
      Teléfono: c("Teléfono", "Teléfono del cliente."),
      "Última compra": c("Última compra", "Día de su última compra."),
      "Días sin comprar": c(
        "Días sin comprar",
        "Cuántos días pasaron desde su última compra.",
      ),
      Compras: c(
        "Compras",
        "Cuántas compras tiene en todo su historial hasta la fecha.",
      ),
      "Ventas netas": c(
        "Ventas netas",
        "Lo que ha comprado en todo su historial, menos lo devuelto.",
      ),
    },
  },
  "cobros-por-mes": {
    queEs:
      "El dinero que nos abonaron los clientes con crédito o contraentrega, por mes y forma de pago.",
    paraQueSirve: "Para cuadrar cuánto cobramos de los créditos cada mes.",
    comoSeLee:
      "Solo cuenta abonos ya verificados. Una transferencia pendiente o rechazada no cuenta como cobrada. Se agrupa por la fecha del cobro.",
    columnas: {
      Mes: c("Mes", "El mes en que se cobró."),
      "Forma de pago": c(
        "Forma de pago",
        "Efectivo, tarjeta, transferencia o nota de crédito.",
      ),
      Cobros: c("Cobros", "Cuántos abonos entraron de esa forma ese mes."),
      Monto: c("Monto cobrado", "Suma de esos abonos."),
    },
  },
};

const DINERO_INGRESO_COLUMNAS: Record<string, Explicacion> = {
  "Fecha ISO": c(
    "Día",
    "El día de negocio (hora de Santo Domingo), en formato año-mes-día.",
  ),
  Efectivo: c(
    "Efectivo",
    "Efectivo de las ventas del día, menos lo reembolsado en efectivo.",
  ),
  Tarjeta: c(
    "Tarjeta",
    "Tarjeta de las ventas del día, menos lo reembolsado con tarjeta.",
  ),
  Transferencia: c(
    "Transferencia",
    "Transferencias de las ventas del día, menos lo reembolsado por transferencia.",
  ),
  "Crédito generado": c(
    "Crédito generado",
    "Lo que quedó a crédito o contraentrega en las ventas del día. No es dinero recibido.",
  ),
  "Cobro crédito efectivo": c(
    "Cobro de crédito en efectivo",
    "Abonos de crédito cobrados en efectivo ese día.",
  ),
  "Cobro crédito tarjeta": c(
    "Cobro de crédito con tarjeta",
    "Abonos de crédito cobrados con tarjeta ese día.",
  ),
  "Cobro crédito transferencia": c(
    "Cobro de crédito por transferencia",
    "Abonos de crédito cobrados por transferencia ese día.",
  ),
  Devoluciones: c(
    "Devoluciones",
    "Lo devuelto ese día, con signo menos. Se resta en el día en que se devolvió.",
  ),
  "Dinero ingresado": c(
    "Dinero que entró",
    "Efectivo, tarjeta, transferencia y cobros de crédito, ya descontados los reembolsos. No incluye crédito generado.",
  ),
  "Vendido neto": c("Vendido neto", "Lo vendido ese día menos lo devuelto."),
  "Fecha local": c("Fecha local", "El mismo día en formato día/mes/año."),
  "Hora RD": c("Hora", "Hora del movimiento en Santo Domingo."),
  Documento: c(
    "Número de factura o devolución",
    "Número del documento que originó el movimiento.",
  ),
  Tipo: c(
    "Tipo de movimiento",
    "Venta en efectivo, tarjeta o transferencia; crédito generado; cobro de crédito; o reembolso de devolución.",
  ),
  Método: c("Forma de pago", "Efectivo, tarjeta o transferencia."),
  Importe: c(
    "Importe",
    "Cantidad del movimiento. Los reembolsos van con signo menos.",
  ),
  Caja: c(
    "Caja",
    "Identificador interno de la caja donde se hizo el movimiento (no el nombre).",
  ),
  "Últimos 4": c(
    "Últimos 4 de la tarjeta",
    "Últimos cuatro dígitos de la tarjeta, si aplica.",
  ),
  Aprobación: c(
    "Código de aprobación",
    "Código que dio la terminal al aprobar la tarjeta.",
  ),
  Banco: c("Banco o cuenta", "Banco o cuenta de la transferencia o terminal."),
  Referencia: c(
    "Referencia",
    "Número de referencia de la transferencia o pago.",
  ),
};

const FORMAL_TODOS_NOTA =
  " Las cajas de prueba (QA-, TEST-, PRUEBA-) no cuentan.";

const INFORMES_MACGEN: Record<string, Guia> = {
  "ingresos-por-dia": {
    queEs:
      "El informe de ingresos día por día: cuánto se vendió, por qué forma de pago entró el dinero y cuánto se devolvió.",
    paraQueSirve:
      "Para cuadrar el dinero que entró cada día con el banco, las terminales y las cajas.",
    comoSeLee:
      "Cada fila es un día de negocio. Venta y cobro de crédito se cuentan por el día en que pasaron. Las devoluciones se restan en el día en que se devolvieron." +
      POR_CONFIRMAR_DEVOLUCION +
      " Dinero que entró es lo que realmente llegó; Crédito generado no es dinero recibido. Abajo, el detalle lista cada cobro y reembolso, pero no las devoluciones completas.",
    columnas: DINERO_INGRESO_COLUMNAS,
  },
  "informe-formal": {
    queEs:
      "El informe formal de un día o de un mes: resumen de ventas e ingresos, cajas, personal, créditos, anulaciones, descuentos y cambios de costo. Solo se descarga en PDF.",
    paraQueSirve:
      "Para revisar el cierre del período y dejar constancia de los controles de la tienda.",
    comoSeLee:
      "Solo lo puede ver quien tiene permiso de ganancia y de ver el arqueo. Vendido neto es lo vendido menos las devoluciones; las devoluciones se restan en la fecha en que se devolvieron." +
      POR_CONFIRMAR_DEVOLUCION +
      " Margen se calcula como (venta menos costo) entre venta, sin restar el ITBIS." +
      FORMAL_TODOS_NOTA,
    columnas: {
      "Resumen de ventas e ingresos": c(
        "Resumen de ventas e ingresos",
        "Vendido neto, dinero que entró, crédito generado, costo, margen, ITBIS informativo, banco, efectivo para caja, cantidad de devoluciones y total de descuentos del período.",
      ),
      "Por día y forma de pago": c(
        "Por día y forma de pago",
        "Cada día: lo vendido, lo que entró y cómo se cobró (efectivo, tarjeta, transferencia y crédito), con cobros de crédito y devoluciones.",
      ),
      "Cajas y arqueo": c(
        "Cajas y arqueo",
        "Cada caja abierta o cerrada en el período, con lo esperado, lo contado y la diferencia por forma de pago. Sin cierre si la caja sigue abierta.",
      ),
      "Por usuario": c(
        "Por usuario",
        "Cuántas ventas hizo cada persona y cuánto vendió. Es lo vendido antes de restar devoluciones (por confirmar).",
      ),
      "Por categoría: vendidos y sin vender": c(
        "Por categoría: vendidos y sin vender",
        "Cuántos productos activos se vendieron y cuántos no se vendieron en cada categoría, con lo vendido. Lo vendido no resta devoluciones (por confirmar).",
      ),
      "Rotación de 60 días · propuesta de stock para 1–2 meses": c(
        "Propuesta de stock",
        "Para cada producto con existencia en la tienda: lo vendido en los últimos 60 días y una propuesta de cuántas piezas tener para uno o dos meses. Es una propuesta, no cambia precios ni inventario. Solo aparece en períodos desde el 27-oct-2026.",
      ),
      "Créditos abiertos (saldo actual)": c(
        "Créditos abiertos",
        "Facturas a crédito o contraentrega que todavía deben dinero hoy, con cuánto deben y cuántos días llevan. El saldo es el de hoy, no el de la fecha del reporte.",
      ),
      "Créditos cerrados en el período": c(
        "Créditos cerrados",
        "Créditos que se terminaron de pagar dentro del período.",
      ),
      "Ventas anuladas": c(
        "Ventas anuladas",
        "Facturas anuladas dentro del período, con su total y el motivo. Se toma la fecha en que se anularon.",
      ),
      Descuentos: c(
        "Descuentos",
        "Facturas con descuento del período, con el monto y el motivo.",
      ),
      "Cambios de costo": c(
        "Cambios de costo",
        "Cada vez que se cambió a mano el costo de un producto: quién, cuándo, cómo era antes y cómo quedó.",
      ),
      "Señales para revisar": c(
        "Señales para revisar",
        "Avisos automáticos: diferencias de caja, anulaciones, descuentos, cambios de costo y margen global por debajo del mínimo configurado.",
      ),
      "Notas de control": c(
        "Notas de control",
        "Explica cómo se calculó el informe y qué pasa con los casos que no cuadran.",
      ),
    },
  },
  "informe-mensual": {
    queEs:
      "El informe de ventas de un mes (o de un rango de fechas): venta, unidades, ganancia y los 10 productos más vendidos, por categoría. Se descarga en CSV.",
    paraQueSirve:
      "Para ver cómo le fue al mes y en qué categorías y productos se concentra la venta.",
    comoSeLee: `${NETO_POR_VENTA} La venta descuenta devoluciones aunque la pantalla diga «bruta». Ganancia es venta menos costo, antes de gastos aunque la pantalla diga «neta». Por confirmar cómo debe llamarse cada una. Margen promedio no resta el ITBIS. Ganancia y margen solo los ve quien tiene permiso de ganancia.`,
    columnas: {
      "Venta bruta": c(
        "Venta del período",
        "Lo cobrado en el período, menos devoluciones. El nombre de la pantalla dice bruta, por confirmar.",
      ),
      "Ganancia neta": c(
        "Ganancia",
        "Venta menos costo. No descuenta gastos. Por confirmar el nombre.",
      ),
      "Margen promedio": c(
        "Margen promedio",
        "De cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS.",
      ),
      "Promedio por día": c(
        "Promedio por día",
        "Lo vendido dividido entre los días del período.",
      ),
      "Promedio por venta": c(
        "Promedio por venta",
        "Lo vendido dividido entre las facturas.",
      ),
      "Unidades vendidas": c(
        "Piezas vendidas",
        "Piezas vendidas en el período, menos devueltas.",
      ),
      Categoría: c("Categoría", "La categoría del producto."),
      Vendido: c("Vendido", "Lo vendido de esa categoría, menos devoluciones."),
      Unidades: c("Piezas", "Piezas vendidas de esa categoría."),
      Ganancia: c("Ganancia", "Venta menos costo de esa categoría o producto."),
      "Margen %": c(
        "Margen %",
        "De cada 100 pesos de venta, cuántos quedan de ganancia. No se resta el ITBIS.",
      ),
      "Forma de pago": c(
        "Forma de pago",
        "Cómo se cobró lo vendido de esa categoría: efectivo, transferencia, tarjeta o crédito.",
      ),
      Banco: c(
        "Banco o terminal",
        "Banco o terminal por la que entró el pago, si aplica.",
      ),
      Monto: c(
        "Monto",
        "Cuánto se cobró de esa categoría por esa forma de pago.",
      ),
      Código: c("Código", "El código interno del producto (SKU)."),
      "Las 10 más vendidas": c(
        "Las 10 más vendidas",
        "Los 10 productos con más piezas vendidas del período.",
      ),
      "Top 10 por categoría": c(
        "Top 10 por categoría",
        "Los 10 productos más vendidos de cada categoría, por piezas o por monto.",
      ),
    },
  },
};

// Informes de las otras versiones: GV (cursos y cobros), Tienda en línea (impresos
// de la caja y del día) y el cierre de caja. Textos sin enlaces externos.
const INFORMES_VERSIONES: Record<string, Guia> = {
  "informe-anual": {
    queEs:
      "El resumen del año: cuánto se vendió cada mes, en una gráfica de pastel. Al tocar un mes se ve su detalle.",
    paraQueSirve:
      "Para comparar meses y ver en qué época del año se vende más.",
    comoSeLee:
      "Bruta es lo vendido de cada mes, con las devoluciones ya descontadas. Neta es la bruta menos el costo de la mercancía, sin restar el ITBIS ni los gastos; solo la ve quien tiene permiso de ganancia. Las devoluciones se restan en el mes en que se devolvieron." +
      POR_CONFIRMAR_DEVOLUCION,
    columnas: {
      "Ventas por mes": c(
        "Ventas por mes",
        "Gráfica del año: cada pedazo es un mes, con su venta.",
      ),
      Bruta: c(
        "Bruta",
        "Lo vendido del mes, menos las devoluciones. El nombre dice bruta, pero ya descuenta devoluciones (por confirmar cómo debe llamarse).",
      ),
      Neta: c(
        "Neta",
        "Bruta menos costo de la mercancía, sin restar ITBIS ni gastos. Solo con permiso de ganancia.",
      ),
      Ventas: c("Ventas", "Cuántas facturas se hicieron en el mes."),
    },
  },
  "cierre-caja": {
    queEs:
      "El cuadre de una caja: cuánto debía haber en efectivo, tarjeta y transferencia, cuánto se contó, y la diferencia.",
    paraQueSirve:
      "Para cerrar la caja y ver si cuadra o si falta o sobra dinero.",
    comoSeLee:
      "Una diferencia negativa es faltante y una positiva es sobrante. La diferencia en efectivo es lo contado, más los vales, menos las ventas en efectivo y el fondo inicial. Si hay un descuadre, aparecen quién lo aprobó y el motivo. Rentabilidad resta el ITBIS y el costo: no coincide con la regla de margen de la dueña (ITBIS no se resta); por confirmar.",
    columnas: {
      "Crédito RD$": c(
        "Crédito en pesos",
        "Ventas a crédito de la caja, en pesos.",
      ),
      "Efectivo RD$": c(
        "Efectivo en pesos",
        "Efectivo contado en la caja, en pesos.",
      ),
      Tarjetas: c("Tarjetas", "Lo cobrado con tarjeta en la caja."),
      Transferencia: c(
        "Transferencia",
        "Lo cobrado por transferencia en la caja.",
      ),
      "Vale de caja": c(
        "Vales de caja",
        "Vales de caja registrados en la caja (por confirmar cómo afectan el efectivo).",
      ),
      "Dólares US$": c("Dólares", "Dólares contados en la caja."),
      "Euro €": c("Euros", "Euros contados en la caja."),
      "Cantidad ticket": c(
        "Tickets",
        "Cuántos tickets se hicieron en la caja.",
      ),
      "Ticket nulo": c(
        "Tickets anulados",
        "Cuántos tickets se anularon en la caja.",
      ),
      "Total en venta efectivo": c(
        "Ventas en efectivo",
        "Lo vendido en efectivo en la caja.",
      ),
      "Recibos CxC": c(
        "Cobros de crédito",
        "Abonos de crédito cobrados en la caja.",
      ),
      "Diferencias RD$": c(
        "Diferencia en pesos",
        "Lo que falta (−) o sobra (+) en efectivo, en pesos.",
      ),
      "Diferencias US$": c(
        "Diferencia en dólares",
        "Diferencia en dólares, solo en cierres con pago en dólares.",
      ),
      "Diferencias €": c("Diferencia en euros", "Diferencia en euros."),
      "Total Desc.": c(
        "Descuentos",
        "Suma de los descuentos de las ventas de la caja.",
      ),
      Total: c(
        "Total vendido",
        "Suma del total de las ventas completadas de la caja.",
      ),
      Rentabilidad: c(
        "Rentabilidad",
        "Ventas menos ITBIS y costo, menos devoluciones de la caja. Solo con permiso de ganancia. Por confirmar, porque la regla de margen no resta el ITBIS.",
      ),
      "Fondo Caja inicial": c(
        "Fondo inicial",
        "Dinero con el que se abrió la caja.",
      ),
    },
  },
  "tienda-venta-diaria-usuario": {
    queEs:
      "El impreso de la venta diaria de una cajera: cada producto vendido, cuánto, y el total.",
    paraQueSirve: "Para imprimir al cerrar y ver qué se vendió en el turno.",
    comoSeLee:
      "Cada fila es un producto. Precio es lo cobrado antes del descuento. Desc es el descuento. ITBIS es el impuesto incluido en el precio.",
    columnas: {
      Descripción: c(
        "Producto",
        "Nombre del producto. La última fila dice TOTAL.",
      ),
      SKU: c("Código", "El código interno del producto (SKU)."),
      Cant: c("Cantidad", "Piezas vendidas."),
      ITBIS: c("ITBIS", "Impuesto incluido en lo vendido de ese producto."),
      Desc: c("Descuento", "Descuento dado sobre ese producto."),
      Precio: c("Precio", "Lo vendido de ese producto antes del descuento."),
    },
  },
  "tienda-venta-por-forma-pago": {
    queEs:
      "El impreso de las ventas de un turno, separadas por forma de pago: efectivo, tarjeta, transferencia y crédito.",
    paraQueSirve:
      "Para ver qué facturas se cobraron cómo, y cuánto quedó pendiente de cobrar.",
    comoSeLee:
      "Una venta combinada aparece en cada forma de pago con la parte que le corresponde. En crédito, Pendiente significa que la factura todavía debe dinero y Cobrada que ya se pagó.",
    columnas: {
      COD: c("Número de factura", "Número de la factura."),
      Descripción: c(
        "Concepto",
        "La forma de pago, la factura, o el subtotal del grupo.",
      ),
      Cant: c("Piezas", "Piezas de la factura."),
      T_Venta: c("Monto", "Lo cobrado por esa forma de pago en la factura."),
      "Sub-Total por Pago": c(
        "Subtotal por forma de pago",
        "Total de piezas y de monto de esa forma de pago.",
      ),
      "Sub-Total por Fact.": c(
        "Subtotal por factura",
        "Número de facturas, piezas y monto total del período.",
      ),
    },
  },
  "tienda-ventas-categoria-forma-pago": {
    queEs:
      "Las ventas por categoría y forma de pago, con el porcentaje de cada forma de pago.",
    paraQueSirve:
      "Para ver cómo se cobra cada categoría, por ejemplo cuánto de ropa se paga con tarjeta.",
    comoSeLee:
      "Lo vendido de cada categoría en cada factura se reparte según cómo se pagó la factura. TODAS suma todas las categorías. Las devoluciones se restan en la fecha de la venta original.",
    columnas: {
      Categoría: c(
        "Categoría",
        "La categoría del producto, o TODAS para el total.",
      ),
      "Forma de pago": c(
        "Forma de pago",
        "Efectivo, tarjeta, transferencia, crédito o contraentrega, y nota de crédito.",
      ),
      Monto: c("Monto", "Lo cobrado de esa categoría con esa forma de pago."),
      "%": c(
        "% de la categoría",
        "Qué parte de la categoría se cobró con esa forma de pago.",
      ),
    },
  },
  "gv-reportes": {
    queEs:
      "Los reportes del módulo GV (cursos, citas y cobros): ingresos verificados por día, método, banco y empleada; ocupación y pendientes por curso; y pendientes por clienta.",
    paraQueSirve:
      "Para cuadrar los cobros de cursos y citas y saber qué clientas deben todavía dinero.",
    comoSeLee:
      "Verificado es lo que ya confirmó el banco o la caja. Reembolsos son los devueltos a clientas. Neto es verificado menos reembolsos. Por verificar son pagos registrados que todavía no se confirman. Pendiente es lo que falta por pagar de cada inscripción o cita; si está cancelada o reembolsada, es cero.",
    columnas: {
      Verificado: c("Verificado", "Cobros ya confirmados, en pesos."),
      Reembolsos: c("Reembolsos", "Dinero devuelto a clientas en el período."),
      Neto: c("Neto", "Verificado menos reembolsos."),
      "Por verificar": c(
        "Por verificar",
        "Pagos registrados que todavía no se confirman.",
      ),
      "Por día": c("Por día", "Cuánto entró cada día y cuántos pagos fueron."),
      "Por método": c(
        "Por método",
        "Cuánto entró por cada forma de pago y cuántos pagos fueron.",
      ),
      "Por banco": c(
        "Por banco",
        "Cuánto entró por cada banco o terminal, y cuántos pagos fueron. Sin banco si no se anotó.",
      ),
      "Por empleada": c(
        "Por empleada",
        "Cuánto cobró cada empleada y cuántos pagos registró. Gerencia cuando no hay nombre de quien lo registró.",
      ),
      CURSO: c("Curso", "Nombre y fecha del curso."),
      INSCRITAS: c(
        "Inscritas",
        "Inscritas que ocupan lugar, de la capacidad del curso.",
      ),
      ASISTIERON: c("Asistieron", "Cuántas inscritas marcaron asistencia."),
      SETS: c(
        "Sets de brochas",
        "Cuántas inscritas compraron el set de brochas.",
      ),
      PAGADO: c("Pagado", "Lo verificado de las inscripciones del curso."),
      PENDIENTE: c(
        "Pendiente",
        "Lo que falta por pagar de las inscripciones del curso.",
      ),
      "Pendientes por clienta": c(
        "Pendientes por clienta",
        "Clienta, curso o cita, y lo que todavía debe. Sale el teléfono de la clienta.",
      ),
    },
  },
};

export const GUIA_INFORMES: Record<string, Guia> = {
  ...INFORMES_MACGEN,
  ...INFORMES_VERSIONES,
};
