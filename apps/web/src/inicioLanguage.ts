import { useSyncExternalStore } from "react";

export type Language = "es" | "en";
const KEY = "noxeros-overview-language";
let language: Language = "es";
try {
  language = localStorage.getItem(KEY) === "en" ? "en" : "es";
} catch {
  /* SSR or unavailable storage */
}
const listeners = new Set<() => void>();
export function setLanguage(next: Language) {
  language = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* Keep the session usable. */
  }
  listeners.forEach((listener) => listener());
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function useLanguage() {
  return useSyncExternalStore(
    subscribe,
    () => language,
    () => "es" as Language,
  );
}
/** Only UI copy is translated. Product names and server messages remain verbatim. */
export const english: Record<string, string> = {
  "No se pudo cargar.": "Unable to load.",
  "No se pudo cargar": "Unable to load",
  Reintentar: "Retry",
  "Cargando…": "Loading…",
  facturas: "invoices",
  Costo: "Cost",
  "Ganancia (venta − costo)": "Profit (sales − cost)",
  "Ventas por día": "Sales by day",
  Ayer: "Yesterday",
  Hoy: "Today",
  "Buscar otro día": "Choose another day",
  "Ventas del período": "Period sales",
  "vs. período anterior": "vs. previous period",
  "Ganancia bruta": "Gross profit",
  "Inventario a la venta": "Inventory retail value",
  "Valor del stock disponible": "Available stock value",
  "Ventas registradas": "Recorded sales",
  "Cada venta cuenta": "Every sale counts",
  "Ticket promedio": "Average sale",
  "Por cada visita a tu tienda": "Per store visit",
  "EL PULSO DE TU NEGOCIO": "THE PULSE OF YOUR BUSINESS",
  "Hola,": "Hello,",
  "Un vistazo a tu tienda. Un paso más hacia tus metas.":
    "Your store at a glance. One step closer to your goals.",
  "Período del resumen": "Overview period",
  "Este mes": "This month",
  "Últimos 7 días": "Last 7 days",
  "Otro día…": "Another day…",
  "Día del resumen": "Overview day",
  Exportar: "Export",
  "Nueva venta": "New sale",
  "Solicitudes de anulación pendientes": "Pending cancellation requests",
  "Revisa la venta antes de aprobar o rechazar.":
    "Review the sale before approving or rejecting.",
  "Revisar solicitudes": "Review requests",
  Factura: "Invoice",
  "Anular venta": "Cancel sale",
  "No se puede anular:": "Cannot cancel:",
  "Anular factura ": "Cancel invoice ",
  "Confirma la anulación. Se revertirán los movimientos de esta venta.":
    "Confirm cancellation. This sale's transactions will be reversed.",
  Cancelar: "Cancel",
  "Venta anulada y solicitud aprobada.": "Sale cancelled and request approved.",
  "Confirmar anulación": "Confirm cancellation",
  "Tu tienda está en movimiento": "Your store is moving forward",
  "Pequeñas decisiones.": "Small decisions.",
  "Grandes resultados.": "Big results.",
  "Todo lo que necesitas para vender mejor, en un solo lugar.":
    "Everything you need to sell better, in one place.",
  "Explorar mis reportes": "Explore my reports",
  "Tu siguiente meta": "Your next goal",
  "Seguir creciendo": "Keep growing",
  "Así van tus ventas": "Your sales at a glance",
  "Una historia de crecimiento, día a día.": "A story of growth, day by day.",
  Ventas: "Sales",
  "Día ": "Day ",
  "Datos de ventas registradas": "Recorded sales data",
  "Ver detalle": "View details",
  "Un poco de atención": "Needs attention",
  "Lo importante, antes de que sea urgente.":
    "What matters, before it becomes urgent.",
  "Stock para reponer": "Stock to replenish",
  "Fecha de vencimiento cerca": "Expiry date approaching",
  "Tiempo de una nueva oportunidad": "Time for a new opportunity",
  "Revisa tu presupuesto": "Review your budget",
  "Requiere tu atención": "Needs your attention",
  "Todo en orden. Tu tienda está al día.":
    "All clear. Your store is up to date.",
  "Ver todas las alertas": "View all alerts",
  "Los favoritos de tu tienda": "Your store's favourites",
  "Productos que tus clientes eligen una y otra vez.":
    "Products your customers choose again and again.",
  "Ver productos": "View products",
  PRODUCTO: "PRODUCT",
  CATEGORÍA: "CATEGORY",
  UNIDADES: "UNITS",
  VENTAS: "SALES",
  "Cada categoría cuenta": "Every category counts",
  "La mezcla que mueve tu tienda.": "The mix that drives your store.",
  "Conoce tu mezcla de ventas y dale espacio a lo que funciona.":
    "Know your sales mix and make room for what works.",
  "Comparativo anual": "Year-over-year comparison",
  "Mismo período del año anterior": "Same period last year",
  "Sin base comparable": "No comparable baseline",
  "% de variación": "% change",
  "Horas pico": "Peak hours",
  "Ventas por día y hora · Santo Domingo":
    "Sales by day and hour · Santo Domingo",
  "Ventas por día y hora": "Sales by day and hour",
  Hora: "Hour",
  Lun: "Mon",
  Mar: "Tue",
  Mié: "Wed",
  Jue: "Thu",
  Vie: "Fri",
  Sáb: "Sat",
  Dom: "Sun",
  " ventas": " sales",
  "Gastos del período": "Period expenses",
  "Comisiones bancarias": "Bank fees",
  "Mermas, ajustes y devoluciones a proveedor (a costo)":
    "Losses, adjustments and supplier returns (at cost)",
  "Correcciones del conteo de inventario (no restan)":
    "Inventory count corrections (not deducted)",
  "Ganancia neta": "Net profit",
  "Inventario a costo": "Inventory at cost",
  "Ventas del año por mes": "Annual sales by month",
  "El círculo es el 100 % de": "The circle represents 100% of",
  ". Toca un mes para ver su desglose.":
    ". Select a month to see its breakdown.",
  Año: "Year",
  "Ventas por mes": "Sales by month",
  ventas: "sales",
  Bruta: "Gross",
  Neta: "Net",
  "No se pudo cargar las ventas del año.": "Unable to load annual sales.",
  "Ver detalle del mes": "View month details",
  "Bruta = lo vendido (devoluciones descontadas). Neta = bruta − costo, sin restar ITBIS ni gastos.":
    "Gross = sales less returns. Net = gross minus cost, before ITBIS and expenses.",
  "Resumen de hoy": "Today's overview",
  "Ventas de hoy": "Today's sales",
  "Alertas de inventario": "Inventory alerts",
  "Cajas activas": "Active tills",
  "caja abierta": "open till",
  "cajas abiertas": "open tills",
  "Sin faltantes": "No shortages",
  "agotados o por agotarse": "out of stock or running low",
  Mercancía: "Goods received",
  Resumen: "Overview",
  "Punto de venta": "Point of sale",
  "Solicitudes de anulación": "Cancellation requests",
  "Conciliar transferencias": "Reconcile transfers",
  "Envíos del mensajero": "Courier deliveries",
  Productos: "Products",
  Inventario: "Inventory",
  Compras: "Purchases",
  Caja: "Till",
  Gastos: "Expenses",
  Clientes: "Customers",
  Promociones: "Promotions",
  Reportes: "Reports",
  Alertas: "Alerts",
  Incentivos: "Incentives",
  "Preguntar a Noxeros": "Ask Noxeros",
  "Cerrar menú": "Close menu",
  "Tienda principal": "Main store",
  "República Dominicana": "Dominican Republic",
  "TU NEGOCIO": "YOUR BUSINESS",
  "Ayuda para trabajar": "Help at work",
  "Consulta los pasos de venta": "Review the sales steps",
  "y los atajos de tu caja.": "and your till shortcuts.",
  "Ver ayuda": "View help",
  Configuración: "Settings",
  "Acerca de": "About",
  "Guía de estilos": "Style guide",
  "Abrir menú": "Open menu",
  "Mi tienda": "My store",
  "Buscar en Noxeros": "Search Noxeros",
  Conectado: "Connected",
  "Sin conexión": "Offline",
  Sincronizando: "Syncing",
  "En línea": "Online",
  "Activar modo oscuro": "Enable dark mode",
  "Activar modo claro": "Enable light mode",
  Administradora: "Administrator",
  Gerente: "Manager",
  Vendedora: "Sales assistant",
  Almacén: "Warehouse",
  "Cambiar de usuario con PIN": "Switch user with PIN",
  "Cerrar sesión": "Sign out",
  "Noxeros · Tu negocio, en movimiento.":
    "Noxeros · Your business, moving forward.",
  "RD$ · ITBIS incluido · Documento interno":
    "DOP · ITBIS included · Internal document",
  "¿A dónde quieres ir?": "Where would you like to go?",
  "Buscar pantalla": "Search pages",
  "Buscar pantalla…": "Search pages…",
  Demostración: "Demonstration",
  "Cambiar mi contraseña": "Change my password",
  "Tu negocio, de un vistazo": "Your business at a glance",
  "Accesos rápidos": "Quick access",
  "Tus herramientas, a un clic.": "Your tools, one click away.",
};
export function translate(text: string, lang: Language): string {
  return lang === "en" ? (english[text] ?? text) : text;
}
export function t(text: string): string {
  return translate(text, language);
}
export function locale() {
  return language === "en" ? "en-US" : "es-DO";
}
export function money(value: number) {
  return new Intl.NumberFormat(locale(), {
    style: "currency",
    currency: "DOP",
  }).format(value);
}
export function monthLabel(month: number) {
  return new Intl.DateTimeFormat(locale(), {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, month - 1, 1)));
}
export function dateLabel(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "—";
  const parsed = new Date(date + "T12:00:00Z");
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    return "—";
  return new Intl.DateTimeFormat(locale(), { timeZone: "UTC" }).format(parsed);
}
export function invoiceLabel(count: number) {
  return `${count} ${language === "en" ? (count === 1 ? "invoice" : "invoices") : count === 1 ? "factura" : "facturas"}`;
}
