import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { DEFAULT_SETTINGS } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { BusinessHeader, PrintSheet, printSoon } from "./Prints";
import { InventoryImportButton } from "./InventoryImport";
import { businessErrorMessage } from "./managementMessages";
import { registerTerminal, terminalIdentity } from "./realtime";

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
const STEPS = ["Tu negocio", "Precios", "Tus productos", "Tu equipo", "¡Listo!"];
type Ncf = "yes" | "no" | "later";
type ProductRow = { name: string; price: string; qty: string; cost: string };
const emptyRow = (): ProductRow => ({ name: "", price: "", qty: "", cost: "" });

/** «Primeros pasos»: cinco pantallas cortas para vender el mismo día. */
export function Onboarding({ go }: { go: (page: string) => void }) {
  const cache = useQueryClient();
  const status = useQuery<OnboardingStatus>({ queryKey: ["onboarding"], queryFn: () => api("/onboarding") });
  const settings = useQuery<Record<string, any>>({ queryKey: ["settings", "onboarding"], queryFn: () => api("/settings") });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [businessType, setBusinessType] = useState("general");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [ncf, setNcf] = useState<Ncf>("later");
  const [legalId, setLegalId] = useState("");
  const [taxIncluded, setTaxIncluded] = useState(true);
  const [rows, setRows] = useState<ProductRow[]>([emptyRow()]);
  const [saved, setSaved] = useState(0);
  const [cashier, setCashier] = useState({ name: "", pin: "" });
  const [cashierDone, setCashierDone] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [opening, setOpening] = useState("0");
  const [ticketVisible, setTicketVisible] = useState(false);
  const userId = useStore(s => s.user?.id);
  const loaded = settings.data;
  const [filledIn, setFilledIn] = useState(false);
  // Solo la primera carga llena el formulario; lo que se escribe no se pisa.
  useEffect(() => {
    if (!loaded || filledIn) return;
    setFilledIn(true);
    setName(loaded.name ?? "");
    setBusinessType(loaded.businessType ?? "general");
    setPhone(loaded.phone ?? "");
    setAddress(loaded.address ?? "");
    setLegalId(loaded.legalId ?? "");
    setNcf(loaded.legalId || (loaded.ncfMode && loaded.ncfMode !== "disabled") ? "yes" : "later");
    setTaxIncluded(loaded.taxIncluded !== false);
  }, [loaded, filledIn]);
  useEffect(() => {
    const clear = () => setTicketVisible(false);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

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
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const finish = async (page: string) => {
    await api("/onboarding", { method: "POST", body: JSON.stringify({ dismissed: true }) });
    await cache.invalidateQueries({ queryKey: ["onboarding"] });
    go(page);
  };
  const uploadLogo = (file?: File) => run(async () => {
    if (!file) return;
    if (file.size > 200 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type))
      throw new Error("El logo debe ser PNG, JPG, WebP o GIF de hasta 200 KB.");
    const body = new FormData(); body.append("file", file);
    await api("/settings/logo", { method: "POST", body });
    await Promise.all([cache.invalidateQueries({ queryKey: ["onboarding"] }), cache.invalidateQueries({ queryKey: ["settings"] })]);
  });
  const saveBusiness = () => run(async () => {
    const current = settings.data ?? {};
    await saveSettings({
      name: name.trim(), businessType, phone: phone.trim(), address: address.trim(),
      ...(ncf === "yes"
        ? { legalId: legalId.trim(), ncfMode: current.ncfMode && current.ncfMode !== "disabled" ? current.ncfMode : "prepared" }
        : { ncfMode: "disabled" }),
    });
    next();
  });
  const saveTax = () => run(async () => { await saveSettings({ taxIncluded }); next(); });
  const filled = rows.filter(r => r.name.trim() || r.price);
  const saveProducts = () => run(async () => {
    for (const row of filled)
      if (row.name.trim().length < 2 || !(Number(row.price) > 0))
        throw new Error("Cada producto necesita nombre y precio mayor que 0.");
    // Las existencias se registran desde un equipo aprobado (como en Caja).
    await registerTerminal().catch(() => undefined);
    const categories = await api<{ id: string }[]>("/categories");
    const categoryId = categories[0]?.id ?? (await post<{ id: string }>("/categories", {
      name: (categorySuggestions[businessType] ?? categorySuggestions.general)[0],
    })).id;
    let pending = [...rows];
    for (const row of filled) {
      const code = `P${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
      const product = await post<{ variants: { id: string }[] }>("/products", {
        name: row.name.trim(), sku: code, categoryId, brand: "",
        variants: [{ sku: code, barcode: code, price: Number(row.price), costAvg: Number(row.cost) || 0 }],
      });
      if (Number(row.qty) > 0)
        await post("/inventory/adjustments", {
          variantId: product.variants[0].id, qty: Number(row.qty), reason: "Existencia inicial (Primeros pasos)",
        });
      // Lo ya guardado sale de la lista: un reintento no lo duplica.
      pending = pending.filter(r => r !== row);
      setRows(pending.length ? pending : [emptyRow()]);
      setSaved(n => n + 1);
    }
    await cache.invalidateQueries();
    next();
  });
  const saveCashier = () => run(async () => {
    const roles = await api<{ id: string; name: string }[]>("/roles");
    const seller = roles.find(r => r.name === "seller");
    if (!seller) throw new Error("Tu empresa aún no tiene el rol de cajera. Créala después en Configuración › Usuarios.");
    const created = await post<{ username: string; temporaryPassword: string }>("/users", {
      name: cashier.name.trim(), username: cashier.name.trim(), pin: cashier.pin, roleId: seller.id,
    });
    setCashierDone(created);
    await cache.invalidateQueries({ queryKey: ["users"] });
  });
  const openCash = () => run(async () => {
    const sessions = await api<{ closedAt: string | null; userId: string }[]>("/cash-sessions");
    const mine = sessions.find(s => !s.closedAt && s.userId === userId);
    if (!mine) {
      await registerTerminal().catch(() => undefined);
      await post("/cash-sessions/open", { openingAmount: Number(opening) || 0, registerId: terminalIdentity().name });
    }
    await cache.invalidateQueries();
    await finish("pos");
  });

  if (status.isLoading || settings.isLoading) return <main className="onboarding"><p>Preparando tu empresa…</p></main>;
  if (status.isError || !status.data) return <main className="onboarding"><p role="alert">No se pudo cargar el asistente.</p><Button onClick={() => status.refetch()}>Reintentar</Button></main>;
  if (!status.data.available) return <main className="onboarding"><h1>Empresa configurada</h1><p>Este asistente está reservado para empresas nuevas.</p><Button onClick={() => go("dashboard")}>Ir al resumen</Button></main>;
  const setRow = (i: number, key: keyof ProductRow, value: string) =>
    setRows(current => current.map((r, j) => (j === i ? { ...r, [key]: value } : r)));

  return <main className="onboarding wizard">
    <header>
      <h1>Primeros pasos</h1>
      <p>Paso {step + 1} de {STEPS.length} · {STEPS[step]}</p>
      <div className="wizard-progress" role="progressbar" aria-label="Avance" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
        <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}

    {step === 0 && <section aria-label="Tu negocio">
      <h2>Tu negocio</h2>
      <label className="field"><span>Nombre del negocio</span><input value={name} maxLength={100} onChange={e => setName(e.target.value)} /></label>
      <label className="field"><span>Tipo de negocio</span><select value={businessType} onChange={e => setBusinessType(e.target.value)}>
        {businessTypes.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </select></label>
      <label className="field"><span>Teléfono (opcional)</span><input value={phone} maxLength={30} inputMode="tel" onChange={e => setPhone(e.target.value)} /></label>
      <label className="field"><span>Dirección (opcional)</span><input value={address} maxLength={200} onChange={e => setAddress(e.target.value)} /></label>
      <label className="field"><span>Logo (opcional · PNG, JPG, WebP o GIF; máx. 200 KB)</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={e => { void uploadLogo(e.currentTarget.files?.[0]); }} /></label>
      {status.data.hasLogo && <p>Logo guardado ✓</p>}
      <fieldset className="wizard-choice">
        <legend>¿Necesitas dar comprobante fiscal (NCF) con RNC?</legend>
        {([["yes", "Sí"], ["no", "No"], ["later", "Más tarde"]] as const).map(([value, label]) =>
          <label key={value}><input type="radio" name="ncf" checked={ncf === value} onChange={() => setNcf(value)} />{label}</label>)}
      </fieldset>
      {ncf === "yes" && <>
        <label className="field"><span>RNC</span><input value={legalId} maxLength={30} inputMode="numeric" onChange={e => setLegalId(e.target.value)} /></label>
        <p><button type="button" className="text-link" onClick={() => go("settings")}>Configurar mis secuencias NCF (cuando las tengas)</button></p>
      </>}
      <Button disabled={busy || name.trim().length < 2} onClick={saveBusiness}>Siguiente</Button>
    </section>}

    {step === 1 && <section aria-label="Precios">
      <h2>Precios</h2>
      <fieldset className="wizard-choice">
        <legend>¿Tus precios ya incluyen ITBIS?</legend>
        <label><input type="radio" name="tax" checked={taxIncluded} onChange={() => setTaxIncluded(true)} />Sí, ya lo incluyen</label>
        <label><input type="radio" name="tax" checked={!taxIncluded} onChange={() => setTaxIncluded(false)} />No, se suma al cobrar</label>
      </fieldset>
      <Button disabled={busy} onClick={saveTax}>Siguiente</Button>
    </section>}

    {step === 2 && <section aria-label="Tus productos">
      <h2>Tus productos</h2>
      <p>Agrega de 1 a 5 para empezar; el resto lo subes después.</p>
      {saved > 0 && <p role="status">{saved} producto{saved === 1 ? "" : "s"} guardado{saved === 1 ? "" : "s"} ✓</p>}
      {rows.map((row, i) => <div className="wizard-product" key={i}>
        <label className="field"><span>Producto {i + 1}</span><input value={row.name} maxLength={150} onChange={e => setRow(i, "name", e.target.value)} /></label>
        <label className="field"><span>Precio RD$</span><input value={row.price} inputMode="decimal" onChange={e => setRow(i, "price", e.target.value)} /></label>
        <label className="field"><span>Cantidad</span><input value={row.qty} inputMode="numeric" onChange={e => setRow(i, "qty", e.target.value)} /></label>
        <label className="field"><span>Costo RD$ (opcional)</span><input value={row.cost} inputMode="decimal" onChange={e => setRow(i, "cost", e.target.value)} /></label>
      </div>)}
      {rows.length < 5 && <Button variant="secondary" onClick={() => setRows(r => [...r, emptyRow()])}>+ Otro producto</Button>}
      <Button disabled={busy || !filled.length} onClick={saveProducts}>Guardar y seguir</Button>
      <InventoryImportButton />
      <Button variant="ghost" onClick={next}>Lo hago después</Button>
    </section>}

    {step === 3 && <section aria-label="Tu equipo">
      <h2>Tu equipo (opcional)</h2>
      {cashierDone ? <div role="status" className="wizard-secret">
        <p>Cajera creada. Entra con el usuario <strong>{cashierDone.username}</strong> y esta contraseña temporal:</p>
        <p className="wizard-password">{cashierDone.temporaryPassword}</p>
        <p>Anótala: solo se muestra ahora y la cajera la cambia al entrar.</p>
      </div> : <>
        <label className="field"><span>Nombre de la cajera</span><input value={cashier.name} maxLength={80} onChange={e => setCashier(c => ({ ...c, name: e.target.value }))} /></label>
        <label className="field"><span>PIN de 6 números</span><input type="password" autoComplete="off" inputMode="numeric" maxLength={6} value={cashier.pin} onChange={e => setCashier(c => ({ ...c, pin: e.target.value.replace(/\D/g, "") }))} /></label>
        <Button disabled={busy || cashier.name.trim().length < 2 || cashier.pin.length !== 6} onClick={saveCashier}>Crear cajera</Button>
      </>}
      <Button variant={cashierDone ? "primary" : "ghost"} onClick={next}>{cashierDone ? "Siguiente" : "Omitir"}</Button>
    </section>}

    {step === 4 && <section aria-label="¡Listo!">
      <h2>¡Listo para vender!</h2>
      <label className="field"><span>Efectivo inicial en caja (RD$)</span><input value={opening} inputMode="decimal" onChange={e => setOpening(e.target.value)} /></label>
      <Button variant="success" disabled={busy} onClick={openCash}>Abrir caja y hacer mi primera venta</Button>
      <p><a href="/ayuda/primera-venta.md" target="_blank" rel="noopener">Ver las guías de ayuda</a></p>
      <Button variant="secondary" onClick={() => { setTicketVisible(true); printSoon(); }}>Imprimir ticket de prueba</Button>
    </section>}

    <footer className="wizard-nav">
      {step > 0 && <Button variant="secondary" disabled={busy} onClick={() => setStep(s => s - 1)}>Atrás</Button>}
      <Button variant="ghost" disabled={busy} onClick={() => run(() => finish("dashboard"))}>Saltar por ahora</Button>
    </footer>
    {ticketVisible && <PrintSheet width="80"><BusinessHeader business={settings.data ?? { name }} title="TICKET DE PRUEBA · 80 MM" /><p className="tp-center">NO ES UNA VENTA · DOCUMENTO NO FISCAL</p><p className="tp-center">Si puedes leer esto completo, la impresora está preparada.</p></PrintSheet>}
  </main>;
}
