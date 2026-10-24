import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type OnboardingStatus = {
  available: boolean;
  dismissed: boolean;
  businessType: string;
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

export function Onboarding({ go }: { go: (page: string) => void }) {
  const cache = useQueryClient();
  const status = useQuery<OnboardingStatus>({ queryKey: ["onboarding"], queryFn: () => api("/onboarding") });
  const categories = useQuery<{ name: string }[]>({ queryKey: ["onboarding-categories"], queryFn: () => api("/categories") });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = status.data;
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
  const completed = [data.categories > 0, data.products > 0, data.cashiers > 0, data.cashSessions > 0].filter(Boolean).length;
  return <main className="onboarding">
    <header><h1>Prepara tu empresa</h1><p>{completed} de 4 pasos · Puedes saltar ahora y retomar desde el menú.</p></header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {data.dismissed && <button disabled={busy} onClick={() => setDismissed(false)}>Retomar asistente</button>}
    <ol>
      <li><h2>1. Categorías {data.categories > 0 && <span>✓</span>}</h2><p>Elige una base sugerida para tu tipo de negocio; después podrás editarla.</p><button disabled={busy || categories.isLoading} onClick={createCategories}>Agregar categorías sugeridas</button></li>
      <li><h2>2. Productos {data.products > 0 && <span>✓</span>}</h2><p>En Productos usa «Importar Excel» o agrega tus primeros artículos. Revisa el resultado antes de vender.</p><button onClick={() => go("products")}>Ir a Productos e importar Excel</button></li>
      <li><h2>3. Cajeras {data.cashiers > 0 && <span>✓</span>}</h2><p>En Configuración › Usuarios y permisos crea cada cajera con su propia contraseña y PIN.</p><button onClick={() => go("settings")}>Crear cajeras</button></li>
      <li><h2>4. Primera caja {data.cashSessions > 0 && <span>✓</span>}</h2><p>Este equipo se registra al entrar. En Caja abre el primer turno con el efectivo inicial.</p><button onClick={() => go("cash")}>Abrir primera caja</button></li>
    </ol>
    <button disabled={busy} onClick={() => setDismissed(true)}>{completed === 4 ? "Terminar" : "Saltar por ahora"}</button>
  </main>;
}
