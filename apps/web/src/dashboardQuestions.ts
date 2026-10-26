export type DashboardTopic =
  | "sales"
  | "profit"
  | "invoices"
  | "ticket"
  | "inventory"
  | "alerts"
  | "categories"
  | "products"
  | "year"
  | "hours";
export type AskDashboard = (label: string, question: string) => void;
export type AssistantRequest = {
  id: number;
  session: string;
  origin: HTMLElement | null;
  label: string;
  question: string;
};

// Plantillas cerradas: no se interpolan nombres, mensajes de alertas, IDs ni importes.
export function dashboardQuestion(
  topic: DashboardTopic,
  from: string,
  to: string,
): string {
  const period = `del ${from} al ${to}`;
  const questions: Record<DashboardTopic, string> = {
    sales: `Consulta la facturación por persona ${period}. Indica fuentes, fechas y límites. No presentes el ranking como cobros ni como el total exacto de la tarjeta. No uses el resumen habitual del dashboard como si correspondiera a estas fechas.`,
    profit:
      "Explica la ganancia bruta del tablero: ventas menos devoluciones, ITBIS neto y costo neto. Distingue ganancia bruta, neta y efectivo cobrado. No recalcules mi tarjeta ni inventes cifras o causas.",
    invoices: `Consulta ventas por persona ${period}. Distingue cantidad de ventas completadas de devoluciones y anulaciones. Indica las fuentes y sus límites; no atribuyas a ese rango los totales del resumen habitual del dashboard.`,
    ticket:
      "Explica el ticket promedio: ventas netas de devoluciones divididas entre ventas completadas. Explica cómo influyen las devoluciones de ventas antiguas sin inventar cifras ni recalcular mi tarjeta.",
    inventory:
      "Consulta existencias actuales, bajo mínimo y agotados. Resume qué revisar primero con evidencia. Es una foto actual, no inventario histórico. No propongas cantidades de compra sin datos suficientes.",
    alerts:
      "Explica cómo priorizar alertas nuevas y vistas por severidad. La tarjeta muestra hasta seis pendientes actuales, sin filtro de fechas; la lista es limitada. No afirmes haber verificado esa muestra ni inventes causas o importes. Explica qué revisar en el reporte de alertas sin cambiar estados.",
    categories:
      "Explica cómo interpretar la participación de categorías en las ventas. No inventes porcentajes ni causas: si tus herramientas no permiten verificar mi tarjeta, indícalo.",
    products:
      "Consulta existencias, bajo mínimo y agotados con ventas. Explica qué productos conviene revisar y con qué evidencia. No presentes estos reportes como un ranking de ventas del período del tablero.",
    year: "Explica cómo comparar meses de ventas y cómo afectan devoluciones y períodos incompletos. No intentes consultar un año con herramientas limitadas a 31 días. No inventes cifras ni causas.",
    hours:
      "Explica cómo interpretar las ventas por día y hora. No inventes horas pico ni recomendaciones de personal basadas en datos que no puedas consultar.",
  };
  return questions[topic];
}

export function dailyBriefQuestion(date: string): string {
  return `Prepara una lectura operativa de ${date}: facturación por persona, descuentos y anulaciones de ese día. Cita fuente y fechas de cada dato. No uses dashboard/summary sin fechas como total del día ni lo concilies con mi tarjeta. Distingue fechas de venta y devolución. Señala lo que no puedes verificar y propone hasta tres revisiones, sin ejecutar cambios.`;
}
