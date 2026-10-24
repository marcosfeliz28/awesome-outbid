// Puente de impresión de la app de escritorio. La web normal conserva el
// diálogo del navegador; solo una ventana Tauri con origen permitido usa IPC.
type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
type NativeWindow = Window & { __TAURI__?: { core?: { invoke?: Invoke } } };
const PRINTER_KEY = "nexora.desktop.printer";
let drawerOnNextPrint = false;

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
  if (typeof window === "undefined") return null;
  return (window as NativeWindow).__TAURI__?.core?.invoke ?? null;
}

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

export function openDrawerOnNextPrint() { drawerOnNextPrint = true; }

export async function nativePrintCurrentSheet(): Promise<void> {
  const openDrawer = drawerOnNextPrint;
  drawerOnNextPrint = false;
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
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
  await call("print_thermal", { printerName: name, text, columns: sheet.classList.contains("w58") ? 32 : 48, openDrawer });
}

export async function nativePrintTest(): Promise<void> {
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
  await call("print_thermal", { printerName: name, text: "NEXORA POS\nPrueba de impresora - 80 mm\nSin venta ni comprobante fiscal", columns: 48, openDrawer: false });
}

export async function nativeOpenDrawer(): Promise<void> {
  const call = invoke();
  if (!call) throw new Error("Esta función solo está disponible en la app de escritorio.");
  const name = selectedPrinter();
  if (!name) throw new Error("Elige la impresora térmica en el menú de la app.");
  await call("open_cash_drawer", { printerName: name });
}
