import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "@fitstore/ui";
import { DEFAULT_SETTINGS } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { BusinessHeader, PrintSheet, printSoon } from "./Prints";
import { InventoryImportButton } from "./InventoryImport";
import { businessErrorMessage } from "./managementMessages";
import { registerTerminal, terminalIdentity } from "./realtime";
import { HelpArticle } from "./SupportHelp";

export type OnboardingStatus = {
  available: boolean;
  dismissed: boolean;
  businessType: string;
  businessName: string;
  legalId: string;
  hasLogo: boolean;
  selectedModules: string[];
  categories: number;
  products: number;
  cashiers: number;
  terminals: number;
  cashSessions: number;
};

export const categorySuggestions: Record<string, string[]> = {
  general: ["Productos", "Servicios"],
  retail: ["Abarrotes", "Hogar", "Accesorios"],
  beauty: ["Maquillaje", "Cuidado personal", "Accesorios"],
  fitness: ["Suplementos", "Equipos", "Ropa deportiva"],
  services: ["Servicios", "Productos complementarios"],
};

const businessTypes = [
  ["general", "General"],
  ["retail", "Tienda / colmado"],
  ["beauty", "Belleza"],
  ["fitness", "Fitness"],
  ["services", "Servicios"],
];
const STEPS = ["Tu negocio y tu caja", "Tu primer producto"];
const QUICK_CASH = ["0", "1000", "2000"];
type ProductRow = { name: string; price: string; qty: string; code: string };
// El código se fija una vez por fila: un reintento encuentra lo ya guardado (INI-04).
const newCode = () => `P${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
const EXAMPLES: ProductRow[] = [
  { name: "Ejemplo · Agua 500 ml", price: "25", qty: "10", code: "EJEMPLO-1" },
  { name: "Ejemplo · Refresco", price: "50", qty: "10", code: "EJEMPLO-2" },
  { name: "Ejemplo · Galletas", price: "40", qty: "10", code: "EJEMPLO-3" },
];

/** «Primeros pasos»: dos pantallas y a cobrar con la caja abierta. */
export function Onboarding({ go }: { go: (page: string) => void }) {
  const cache = useQueryClient();
  const status = useQuery<OnboardingStatus>({ queryKey: ["onboarding"], queryFn: () => api("/onboarding") });
  const settings = useQuery<Record<string, any>>({ queryKey: ["settings", "onboarding"], queryFn: () => api("/settings") });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [opening, setOpening] = useState("0");
  const [row, setRow] = useState<ProductRow>(() => ({ name: "", price: "", qty: "", code: newCode() }));
  const userId = useStore(s => s.user?.id);
  const loaded = settings.data;
  const [filledIn, setFilledIn] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  // INI-08: al cambiar de paso el foco va al título del paso nuevo.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step]);
  // Solo la primera carga llena el formulario; lo que se escribe no se pisa.
  useEffect(() => {
    if (!loaded || filledIn) return;
    setFilledIn(true);
    setName(loaded.name ?? "");
    setBusinessType(loaded.businessType ?? "general");
  }, [loaded, filledIn]);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true); setError("");
    try { await work(); }
    catch (cause) { setError(businessErrorMessage(cause)); }
    finally { setBusy(false); }
  };
  // Se guarda por PUT /settings con todo lo demás tal como está (y los valores
  // seguros de una empresa nueva donde falte algo). El logo va aparte.
  const saveSettings = async (changes: Record<string, unknown>) => {
    const { logo: _logo, ...current } = (await api<Record<string, any>>("/settings"));
    await api("/settings", { method: "PUT", body: JSON.stringify({ ...DEFAULT_SETTINGS, ...current, ...changes }) });
    await cache.invalidateQueries({ queryKey: ["settings"] });
  };
  const finish = async (page: string) => {
    await api("/onboarding", { method: "POST", body: JSON.stringify({ dismissed: true }) });
    await cache.invalidateQueries({ queryKey: ["onboarding"] });
    go(page);
  };
  // Paso 1: nombre y tipo; las categorías del tipo se crean solas.
  const saveBusiness = () => run(async () => {
    await saveSettings({ name: name.trim(), businessType });
    const categories = await api<{ id: string }[]>("/categories");
    if (!categories.length)
      for (const category of categorySuggestions[businessType] ?? categorySuggestions.general)
        await post("/categories", { name: category });
    await cache.invalidateQueries({ queryKey: ["onboarding"] });
    setStep(1);
  });
  // Producto y existencia van en dos solicitudes: si el producto ya existe (por
  // su código) no se crea otro, y la existencia solo se suma si sigue en 0.
  const saveProduct = async (item: ProductRow, categoryId: string) => {
    const found = await api<{ items: { variants: { id: string; barcode: string; stock: string }[] }[] }>(
      "/products?q=" + encodeURIComponent(item.code));
    const existing = found.items.find(p => p.variants.some(v => v.barcode === item.code));
    const product = existing ?? await post<{ variants: { id: string; barcode: string; stock: string }[] }>("/products", {
      name: item.name.trim(), sku: item.code, categoryId, brand: "",
      variants: [{ sku: item.code, barcode: item.code, price: Number(item.price), costAvg: 0 }],
    });
    const variant = product.variants.find(v => v.barcode === item.code) ?? product.variants[0];
    if (Number(item.qty) > 0 && !(Number(variant.stock) > 0))
      await post("/inventory/adjustments", {
        variantId: variant.id, qty: Number(item.qty), reason: "Existencia inicial (Primeros pasos)",
      });
  };
  const valid = row.name.trim().length >= 2 && Number(row.price) > 0 && Number(row.qty) > 0;
  // Paso 2: guarda el producto (o los de ejemplo), abre la caja y va a cobrar.
  const start = (items: ProductRow[]) => run(async () => {
    // Las existencias y la caja se registran desde un equipo aprobado.
    await registerTerminal().catch(() => undefined);
    if (items.length) {
      const categories = await api<{ id: string }[]>("/categories");
      const categoryId = categories[0]?.id ?? (await post<{ id: string }>("/categories", {
        name: (categorySuggestions[businessType] ?? categorySuggestions.general)[0],
      })).id;
      for (const item of items) await saveProduct(item, categoryId);
    }
    const sessions = await api<{ closedAt: string | null; userId: string }[]>("/cash-sessions");
    if (!sessions.some(s => !s.closedAt && s.userId === userId))
      await post("/cash-sessions/open", { openingAmount: Number(opening) || 0, registerId: terminalIdentity().name });
    await cache.invalidateQueries();
    await finish("pos");
  });

  if (status.isLoading || settings.isLoading) return <main className="onboarding"><p>Preparando tu empresa…</p></main>;
  if (status.isError || !status.data) return <main className="onboarding"><p role="alert">No se pudo cargar el asistente.</p><Button onClick={() => status.refetch()}>Reintentar</Button></main>;
  if (!status.data.available) return <main className="onboarding"><h1>Empresa configurada</h1><p>Este asistente está reservado para empresas nuevas.</p><Button onClick={() => go("dashboard")}>Ir al resumen</Button></main>;
  const field = (key: "name" | "price" | "qty", value: string) => setRow(r => ({ ...r, [key]: value }));
  const hasProducts = status.data.products > 0;

  return <main className="onboarding wizard">
    <header>
      <h1>Primeros pasos</h1>
      <p aria-live="polite">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>
      <div className="wizard-progress" role="progressbar" aria-label="Avance" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}

    {step === 0 && <section aria-label="Tu negocio y tu caja">
      <h2 ref={heading} tabIndex={-1}>Tu negocio y tu caja</h2>
      <label className="field"><span>Nombre del negocio</span><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
      <label className="field"><span>Tipo de negocio</span><select value={businessType} onChange={e => setBusinessType(e.target.value)}>
        {businessTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label className="field"><span>¿Con cuánto efectivo abres tu caja hoy? (RD$)</span><input value={opening} inputMode="decimal" onChange={e => setOpening(e.target.value)} /></label>
      <div className="wizard-quick" role="group" aria-label="Montos rápidos">
        {QUICK_CASH.map(amount => <Button key={amount} type="button" variant="secondary" aria-pressed={opening === amount} onClick={() => setOpening(amount)}>RD$ {Number(amount).toLocaleString("en-US")}</Button>)}
      </div>
      <p>Precios con ITBIS 18 % incluido y ticket de 80 mm. Lo cambias cuando quieras en Configuración.</p>
      <Button disabled={busy || name.trim().length < 2} onClick={saveBusiness}>Siguiente</Button>
    </section>}

    {step === 1 && <section aria-label="Tu primer producto">
      <h2 ref={heading} tabIndex={-1}>Tu primer producto</h2>
      <div className="wizard-product">
        <label className="field"><span>Nombre del producto</span><input value={row.name} maxLength={150} onChange={e => field("name", e.target.value)} /></label>
        <label className="field"><span>Precio RD$</span><input value={row.price} inputMode="decimal" onChange={e => field("price", e.target.value)} /></label>
        <label className="field"><span>¿Cuántos tienes?</span><input value={row.qty} inputMode="numeric" onChange={e => field("qty", e.target.value)} /></label>
      </div>
      <Button variant="success" disabled={busy || !(valid || hasProducts)} onClick={() => start(valid ? [row] : [])}>Ir a cobrar mi primera venta →</Button>
      <Button variant="secondary" disabled={busy} onClick={() => start(EXAMPLES)}>Usar 3 productos de ejemplo para probar ya</Button>
      <InventoryImportButton />
      {hasProducts && <p role="status">{status.data.products} producto{status.data.products === 1 ? "" : "s"} en tu catálogo ✓</p>}
    </section>}

    <footer className="wizard-nav">
      {step > 0 && <Button variant="secondary" disabled={busy} onClick={() => setStep(0)}>Atrás</Button>}
      <Button variant="ghost" disabled={busy} onClick={() => run(() => finish("dashboard"))}>Saltar por ahora</Button>
    </footer>
  </main>;
}

/** Lo que no hace falta para vender el primer día: tarjeta opcional del resumen. */
export function SetupChecklist({ go }: { go: (page: string) => void }) {
  const status = useQuery<OnboardingStatus>({ queryKey: ["onboarding"], queryFn: () => api("/onboarding") });
  const settings = useQuery<Record<string, any>>({ queryKey: ["settings", "onboarding"], queryFn: () => api("/settings"), enabled: !!status.data?.available });
  const [guide, setGuide] = useState<string | null>(null);
  const [guideError, setGuideError] = useState("");
  const [ticketVisible, setTicketVisible] = useState(false);
  useEffect(() => {
    const clear = () => setTicketVisible(false);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);
  const data = status.data;
  if (!data?.available || !settings.data) return null;
  const tasks = [
    { label: "Sube tu logo y tu RNC para los tickets", done: data.hasLogo && !!data.legalId },
    { label: "Agrega a tu primera cajera (Configuración › Usuarios)", done: data.cashiers > 0 },
    { label: "Configura tus comprobantes fiscales (NCF)", done: settings.data.ncfMode === "sequences" },
  ];
  const pending = tasks.filter(t => !t.done).length;
  if (!pending) return null;
  return <section className="setup-checklist" aria-label="Completa tu tienda">
    <details>
      <summary>Completa tu tienda cuando tengas tiempo (opcional) · {pending} pendiente{pending === 1 ? "" : "s"}</summary>
      <ul>
        {tasks.map(t => <li key={t.label}>{t.done ? "✓ " : ""}{t.done ? t.label : <button type="button" className="text-link" onClick={() => go("settings")}>{t.label}</button>}</li>)}
        <li><button type="button" className="text-link" onClick={() => { setTicketVisible(true); printSoon(); }}>Imprimir ticket de prueba</button></li>
        <li><button type="button" className="text-link" onClick={async () => {
          setGuideError("");
          const response = await fetch("/ayuda/primera-venta.md").catch(() => null);
          if (!response?.ok) setGuideError("No se pudo abrir la guía. Revisa tu conexión.");
          else setGuide(await response.text());
        }}>Ver la guía «Tu primera venta»</button></li>
      </ul>
      {guideError && <p role="alert">{guideError}</p>}
    </details>
    <Modal open={guide !== null} onClose={() => setGuide(null)} title="Tu primera venta">{guide && <HelpArticle text={guide} />}</Modal>
    {ticketVisible && <PrintSheet width="80"><BusinessHeader business={settings.data} title="TICKET DE PRUEBA · 80 MM" /><p className="tp-center">NO ES UNA VENTA · DOCUMENTO NO FISCAL</p><p className="tp-center">Si puedes leer esto completo, la impresora está preparada.</p></PrintSheet>}
  </section>;
}
