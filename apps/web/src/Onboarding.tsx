import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { BusinessHeader, PrintSheet, printSoon } from "./Prints";

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

export const onboardingModules = [
  { id: "sales", label: "Ventas y caja" },
  { id: "inventory", label: "Inventario" },
  { id: "purchases", label: "Compras" },
  { id: "customers", label: "Clientes" },
  { id: "reports", label: "Reportes" },
  { id: "expenses", label: "Gastos" },
] as const;

export const categorySuggestions: Record<string, string[]> = {
  general: ["Productos", "Servicios"],
  retail: ["Abarrotes", "Hogar", "Accesorios"],
  beauty: ["Maquillaje", "Cuidado personal", "Accesorios"],
  fitness: ["Suplementos", "Equipos", "Ropa deportiva"],
  services: ["Servicios", "Productos complementarios"],
};

export function Onboarding({ go }: { go: (page: string) => void }) {
  const cache = useQueryClient();
  const status = useQuery<OnboardingStatus>({ queryKey: ["onboarding"], queryFn: () => api("/onboarding") });
  const categories = useQuery<{ name: string }[]>({ queryKey: ["onboarding-categories"], queryFn: () => api("/categories") });
  const settings = useQuery<Record<string, any>>({ queryKey: ["settings", "onboarding"], queryFn: () => api("/settings") });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [legalId, setLegalId] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [ticketVisible, setTicketVisible] = useState(false);
  const data = status.data;
  useEffect(() => {
    if (!data) return;
    setBusinessName(data.businessName);
    setLegalId(data.legalId);
    setModules(data.selectedModules);
  }, [data?.businessName, data?.legalId, data?.selectedModules?.join(",")]);
  useEffect(() => {
    const clear = () => setTicketVisible(false);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);
  const saveProfile = async () => {
    setBusy(true); setError("");
    try {
      await api("/onboarding/profile", { method: "POST", body: JSON.stringify({ name: businessName, legalId, modules }) });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["onboarding"] }),
        cache.invalidateQueries({ queryKey: ["settings"] }),
      ]);
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (file.size > 200 * 1024 || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("El logo debe ser PNG, JPG, WebP o GIF de hasta 200 KB."); return;
    }
    setBusy(true); setError("");
    try {
      const body = new FormData(); body.append("file", file);
      await api("/settings/logo", { method: "POST", body });
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["onboarding"] }),
        cache.invalidateQueries({ queryKey: ["settings"] }),
      ]);
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const setDismissed = async (dismissed: boolean) => {
    setBusy(true); setError("");
    try {
      await api("/onboarding", { method: "POST", body: JSON.stringify({ dismissed }) });
      await cache.invalidateQueries({ queryKey: ["onboarding"] });
      if (dismissed) go("dashboard");
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const createCategories = async () => {
    if (!data) return;
    setBusy(true); setError("");
    try {
      const existing = new Set((categories.data ?? []).map(c => c.name.toLocaleLowerCase("es")));
      for (const name of categorySuggestions[data.businessType] ?? categorySuggestions.general) {
        if (existing.has(name.toLocaleLowerCase("es"))) continue;
        await api("/categories", { method: "POST", body: JSON.stringify({ name }) });
      }
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["onboarding"] }),
        cache.invalidateQueries({ queryKey: ["onboarding-categories"] }),
        cache.invalidateQueries({ queryKey: ["categories"] }),
      ]);
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  if (status.isLoading) return <main className="onboarding"><p>Preparando tu empresa…</p></main>;
  if (status.isError || !data) return <main className="onboarding"><p role="alert">No se pudo cargar el asistente.</p><button onClick={() => status.refetch()}>Reintentar</button></main>;
  if (!data.available) return <main className="onboarding"><h1>Empresa configurada</h1><p>Este asistente está reservado para empresas nuevas.</p><button onClick={() => go("dashboard")}>Ir al resumen</button></main>;
  const completed = [!!data.businessName, data.categories > 0, data.selectedModules.length > 0, data.products > 0, data.cashiers > 0, data.cashSessions > 0].filter(Boolean).length;
  return <main className="onboarding">
    <header><h1>Prepara tu empresa</h1><p>{completed} de 6 pasos · Puedes saltar ahora y retomar desde el menú.</p></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {data.dismissed && <button disabled={busy} onClick={() => setDismissed(false)}>Retomar asistente</button>}
    <ol>
      <li><h2>1. Identidad del negocio</h2><p>El RNC y el logo son opcionales hasta que tengas tus datos definitivos; nunca se inventa un RNC.</p>
        <label>Nombre del negocio<input value={businessName} maxLength={100} onChange={e => setBusinessName(e.target.value)} /></label>
        <label>RNC<input value={legalId} maxLength={30} onChange={e => setLegalId(e.target.value)} placeholder="Si aún no lo tienes, déjalo vacío" /></label>
        <button disabled={busy || businessName.trim().length < 2} onClick={() => { void saveProfile(); }}>Guardar identidad</button>
        <label>Logo (PNG, JPG, WebP o GIF; máx. 200 KB)<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={e => { void uploadLogo(e.currentTarget.files?.[0]); }} /></label>
        {data.hasLogo && <p>Logo guardado ✓</p>}
      </li>
      <li><h2>2. Categorías {data.categories > 0 && <span>✓</span>}</h2><p>Elige una base sugerida para tu tipo de negocio; después podrás editarla.</p><button disabled={busy || categories.isLoading} onClick={createCategories}>Agregar categorías sugeridas</button></li>
      <li><h2>3. Módulos que usarás {data.selectedModules.length > 0 && <span>✓</span>}</h2><p>Elige las áreas que quieres preparar. Puedes cambiarlas más adelante; esta selección todavía no restringe accesos.</p>
        {onboardingModules.map(module => <label key={module.id}><input type="checkbox" checked={modules.includes(module.id)} onChange={e => setModules(current => e.target.checked ? [...current, module.id] : current.filter(id => id !== module.id))} />{module.label}</label>)}
        <button disabled={busy} onClick={() => { void saveProfile(); }}>Guardar módulos</button>
      </li>
      <li><h2>4. Productos {data.products > 0 && <span>✓</span>}</h2><p>En Productos usa «Importar Excel» o agrega tus primeros artículos. Si tienes una factura de proveedor, Mercancía puede leerla con IA cuando tu plan lo permita. Revisa el resultado antes de vender.</p><button onClick={() => go("products")}>Ir a Productos e importar Excel</button> <button onClick={() => go("merchandise")}>Leer factura de proveedor</button></li>
      <li><h2>5. Cajeras {data.cashiers > 0 && <span>✓</span>}</h2><p>En Configuración › Usuarios y permisos crea cada cajera con su propia contraseña y PIN.</p><button onClick={() => go("settings")}>Crear cajeras</button></li>
      <li><h2>6. Primera caja {data.cashSessions > 0 && <span>✓</span>}</h2><p>Este equipo se registra al entrar. En Caja abre el primer turno con el efectivo inicial.</p><button onClick={() => go("cash")}>Abrir primera caja</button></li>
      <li><h2>Ticket de prueba de 80 mm</h2><p>Comprueba que tu impresora térmica esté alineada. No crea una venta ni un comprobante fiscal.</p><button onClick={() => { setTicketVisible(true); printSoon(); }}>Imprimir ticket de prueba</button></li>
    </ol>
    <button disabled={busy} onClick={() => setDismissed(true)}>{completed === 6 ? "Terminar" : "Saltar por ahora"}</button>
    {ticketVisible && <PrintSheet width="80"><BusinessHeader business={settings.data ?? { name: data.businessName, legalId: data.legalId }} title="TICKET DE PRUEBA · 80 MM" /><p className="tp-center">NO ES UNA VENTA · DOCUMENTO NO FISCAL</p><p className="tp-center">Si puedes leer esto completo, la impresora está preparada.</p></PrintSheet>}
  </main>;
}
