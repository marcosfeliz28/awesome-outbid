import type { Language } from "./inicioLanguage";

const EN: Record<string, string> = {
  "Una caja que siempre cuadra": "A register that always balances",
  "Abre el día con claridad. Ciérralo con tranquilidad.":
    "Start the day with clarity. Close it with confidence.",
  "Abrir caja": "Open register",
  "Abrir mi caja": "Open my register",
  Movimiento: "Cash movement",
  "Cerrar y arquear": "Close and reconcile",
  "Caja abierta": "Register open",
  Desde: "Since",
  "Efectivo esperado": "Expected cash",
  Apertura: "Opening amount",
  "Tarjeta esperada": "Expected card payments",
  "Transferencia esperada": "Expected transfers",
  "Movimientos de efectivo": "Cash movements",
  "Tu día empieza con una caja abierta":
    "Your day starts with an open register",
  "Registra el fondo inicial para comenzar a vender.":
    "Record the opening cash to start selling.",
  "Créditos pendientes": "Outstanding credit",
  Pendientes: "Outstanding",
  Cerrados: "Closed",
  "Por venta": "By sale",
  "Por persona": "By customer",
  "Buscar por cliente, factura o teléfono":
    "Search by customer, invoice or phone",
  "No hay coincidencias": "No matches found",
  "Prueba con otro nombre, número de factura o teléfono.":
    "Try another name, invoice number or phone number.",
  "Registrar cobro": "Record payment",
  "Sin créditos pendientes": "No outstanding credit",
  "Sin créditos cerrados": "No closed credit",
  "Ya pagaron": "Paid",
  "Buscar por nombre": "Search by name",
  Ordenar: "Sort",
  "Mayor deuda": "Highest balance",
  "Más antiguo": "Oldest",
  "Total general por cobrar:": "Total outstanding:",
  "Por cobrar:": "Outstanding:",
  "Por cobrar visible:": "Visible outstanding:",
  "Hay importes ocultos hasta cerrar la caja; este total no incluye esas ventas.":
    "Some amounts stay hidden until the register closes; this total does not include those sales.",
  "Ver estado de cuenta": "View statement",
  Anterior: "Previous",
  Siguiente: "Next",
  "Estado de cuenta": "Account statement",
  "Saldo total:": "Total balance:",
  "Descargar estado de cuenta PDF": "Download statement PDF",
  "Nada pendiente.": "Nothing outstanding.",
  "Ya pagadas o cerradas": "Paid or closed",
  "Registrar pago": "Record payment",
  Monto: "Amount",
  "Forma de pago": "Payment method",
  Efectivo: "Cash",
  Tarjeta: "Card",
  Transferencia: "Transfer",
  "Banco donde cayó": "Receiving bank",
  "Referencia (opcional)": "Reference (optional)",
  Referencia: "Reference",
  "Reparto previsto:": "Expected allocation:",
  "Indica un monto": "Enter an amount",
  "Historial de cajas": "Register history",
  "Un registro claro de cada jornada.": "A clear record of every shift.",
  Cajero: "Cashier",
  Equipo: "Device",
  Estado: "Status",
  Cerrada: "Closed",
  Abierta: "Open",
  Contado: "Counted cash",
  "Diferencias por método": "Differences by method",
  Acciones: "Actions",
  "Efectivo inicial": "Opening cash",
  "Sugerido: lo que dejaste en tu último cierre.":
    "Suggested: the cash left at your last closing.",
  "Nota si el fondo es menor que el sugerido":
    "Note when opening cash is below the suggested amount",
  "Mis incentivos": "My incentives",
  unidades: "units",
  ventas: "sales",
  "al por mayor": "wholesale",
  devoluciones: "returns",
  "de ventas por cobrar": "from outstanding sales",
  "Incentivo pendiente de cobro (estimado):": "Pending incentive estimate:",
  "Solo tú ves este cuadro. Se cuadra a fin de mes con la administración.":
    "Only you can see this panel. It is reconciled with management at month end.",
  "No está en tu total. Se suma, en el mes del pago, cuando la administración cobre esos créditos.":
    "It is not included in your total. It is added in the payment month when management collects that credit.",
  "Ventas entregadas sin pago. Cualquier cajera puede cerrarlas en efectivo, de cualquier día: el dinero entra a su caja y lo entrega al cerrar. La tarjeta y la transferencia las registra la administración.":
    "Sales delivered without payment. Any cashier can close them in cash on any day: the money enters their register and is handed over at closing. Management records card and transfer payments.",
  "Las ventas a crédito aparecerán aquí, con el nombre del cliente, hasta completar el pago.":
    "Credit sales will appear here with the customer name until payment is complete.",
  "Los créditos saldados aparecerán aquí con quién y cuándo los cerró.":
    "Paid credit will appear here with who closed it and when.",
  Fecha: "Date",
  Usuario: "User",
  Todos: "All",
  "Venta diaria del día": "Daily sales report",
  "Por forma de pago del día": "Daily payment-method report",
  Cuadre: "Closing report",
  "Venta diaria": "Daily sales",
  "Por forma de pago": "By payment method",
  "Tu caja está abierta en": "Your register is open on",
  "otro equipo": "another device",
  "Para cobrar aquí, trasládala a este equipo o ciérrala en el otro.":
    "To take payments here, move it to this device or close it on the other one.",
  "Trasladar caja aquí": "Move register here",
  "Trasladar caja a este equipo": "Move register to this device",
  "Las ventas, abonos y movimientos de esta caja se registrarán desde este equipo. El cambio queda en la bitácora con ambos equipos.":
    "Sales, payments and cash movements for this register will be recorded from this device. The audit log keeps both devices.",
  "Caja trasladada a este equipo.": "Register moved to this device.",
  "PIN del gerente": "Manager PIN",
  "Trasladando…": "Moving…",
  "Trasladar caja": "Move register",
};

/** UI copy only. Business records and server messages remain unchanged. */
export function cashText(text: string, language: Language): string {
  return language === "en" ? (EN[text] ?? text) : text;
}

export function creditSalesCount(
  count: number,
  paid: boolean,
  language: Language,
): string {
  if (language === "en") {
    return `${count} ${paid ? "paid" : "open"} sale${count === 1 ? "" : "s"}`;
  }
  const state = paid
    ? count === 1
      ? "pagada"
      : "pagadas"
    : count === 1
      ? "abierta"
      : "abiertas";
  return `${count} ${count === 1 ? "venta" : "ventas"} ${state}`;
}
