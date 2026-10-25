// Puente de impresión de la app de escritorio. La web normal conserva el
// diálogo del navegador; solo una ventana Tauri con origen permitido usa IPC.
import { invoke as tauriInvoke, isTauri } from "@tauri-apps/api/core";

type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
const PRINTER_KEY = "nexora.desktop.printer";
export type DrawerAuthorization = {
  accessToken: string;
  saleId?: string;
  movementId?: string;
  /** La venta acaba de cobrarse; no es una apertura manual de gerencia. */
  automatic?: boolean;
  /** Motivo de la apertura manual (mínimo 5 caracteres); se audita en la API. */
  reason?: string;
};
let drawerOnNextPrint: DrawerAuthorization | null = null;
let testInvoke: Invoke | null = null;

/** El ticket salió, pero la API/gaveta no autorizó la apertura. */
export class DrawerNotAuthorizedError extends Error {}
export const DRAWER_WARNING = "Ticket impreso; la gaveta no se autorizó, avisa a gerencia.";
/** Aviso para el cajero: sólo un fallo de gaveta con ticket ya impreso es advertencia (no error). */
export const printNotice = (error: unknown) =>
  error instanceof DrawerNotAuthorizedError
    ? { message: DRAWER_WARNING, error: false }
    : { message: String((error as { message?: string })?.message ?? error), error: true };

export function prepareThermalText(value: string): string {
  const text = Array.from(value.replace(/\r\n?/g, "\n"))
    .filter((character) => { const code = character.codePointAt(0) ?? 0; return code === 10 || code === 9 || (code >= 32 && code !== 127); })
    .join("").trim();
  if (!text || text.length > 32768) throw new Error("El impreso está vacío o excede el tamaño permitido.");
  return text;
}

export const cashDrawerRequired = (payments: { method: string; amount: number | string }[]) =>
  payments.some((payment) => payment.method === "cash" && Number(payment.amount) > 0);

function invoke(): Invoke | null {
  if (testInvoke) return testInvoke;
  return typeof window !== "undefined" && isTauri() ? tauriInvoke : null;
}

/** Solo para pruebas unitarias: producción usa el API oficial de Tauri. */
export function setNativeInvokeForTest(value: Invoke | null) { testInvoke = value; }

export const isNativeDesktop = () => invoke() !== null;
export const selectedPrinter = () => localStorage.getItem(PRINTER_KEY) ?? "";
export function selectPrinter(name: string) {
  if (name) localStorage.setItem(PRINTER_KEY, name);
  else localStorage.removeItem(PRINTER_KEY);
}
export async function nativePrinters(): Promise<string[]> {
  const call = invoke();
  if (!call) return [];
  const names = await call("list_printers");
  return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string") : [];
}

let drawerTimer: ReturnType<typeof setTimeout> | undefined;
// Caduca a los 10 s: si la impresión nunca la consume, no debe abrir la gaveta en un ticket posterior.
export function openDrawerOnNextPrint(authorization: DrawerAuthorization) {
  drawerOnNextPrint = authorization;
  clearTimeout(drawerTimer);
  drawerTimer = setTimeout(() => { drawerOnNextPrint = null; }, 10_000);
}
export function takeDrawerAuthorizationForNextPrint() {
  const authorization = drawerOnNextPrint;
  drawerOnNextPrint = null;
  clearTimeout(drawerTimer);
  return authorization;
}

export async function nativePrintThermal(
  text: string,
  columns: 32 | 48,
  drawer: DrawerAuthorization | null = takeDrawerAuthorizationForNextPrint(),
): Promise<void> {
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
  // El ticket sale primero y sin ningún pulso de gaveta. Sólo después se pide
  // a la API que registre/autorice la apertura. Si esa API falla, este ticket
  // ya quedó impreso y el segundo comando nunca llega a abrir la gaveta.
  await call("print_thermal", { printerName: name, text, columns });
  if (drawer)
    await call("open_cash_drawer", {
      printerName: name,
      accessToken: drawer.accessToken,
      saleId: drawer.saleId ?? null,
      movementId: drawer.movementId ?? null,
      automatic: drawer.automatic === true,
    }).catch((cause) => { throw new DrawerNotAuthorizedError(String(cause?.message ?? cause)); });
}

export async function nativePrintCurrentSheet(): Promise<void> {
  const drawer = takeDrawerAuthorizationForNextPrint();
  const sheet = document.querySelector<HTMLElement>(".thermal-print");
  if (!sheet) throw new Error("No hay un ticket térmico abierto para imprimir.");
  // La hoja está oculta fuera de @media print. Leer innerText directamente
  // perdería los saltos de línea; una copia invisible sí participa en layout.
  const preview = sheet.cloneNode(true) as HTMLElement;
  preview.style.cssText = `display:block;position:fixed;left:-10000px;top:0;visibility:hidden;width:${sheet.classList.contains("w58") ? "58" : "80"}mm`;
  document.body.appendChild(preview);
  let text: string;
  try { text = prepareThermalText(preview.innerText); }
  finally { preview.remove(); }
  await nativePrintThermal(
    text,
    sheet.classList.contains("w58") ? 32 : 48,
    drawer,
  );
}

export async function nativePrintTest(): Promise<void> {
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
  await call("print_thermal", { printerName: name, text: "NEXORA POS\nPrueba de impresora - 80 mm\nSin venta ni comprobante fiscal", columns: 48 });
}

export async function nativeOpenDrawer(authorization: DrawerAuthorization): Promise<void> {
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
  await call("open_cash_drawer", {
    printerName: name,
    accessToken: authorization.accessToken,
    saleId: authorization.saleId ?? null,
    movementId: authorization.movementId ?? null,
    automatic: authorization.automatic === true,
    reason: authorization.reason ?? null,
  });
}
