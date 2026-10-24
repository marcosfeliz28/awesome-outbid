import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

type Status = { enabled: boolean; expiresAt: string | null };
const key = ["nexora-support-access"];
const format = (value: string) => new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Santo_Domingo" }).format(new Date(value));

export function SupportAccessCard() {
  const client = useQueryClient();
  const status = useQuery<Status>({ queryKey: key, queryFn: () => api("/support-access"), refetchInterval: 60000 });
  const [duration, setDuration] = useState<"24h" | "7d">("24h");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (status.data?.enabled === false) setPassword(""); }, [status.data?.enabled]);

  async function enable() {
    setBusy(true); setError(""); setPassword("");
    try {
      const result = await api<Status & { password: string }>("/support-access/enable", { method: "POST", body: JSON.stringify({ duration }) });
      setPassword(result.password);
      client.setQueryData(key, { enabled: result.enabled, expiresAt: result.expiresAt });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo habilitar el soporte."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setError(""); setPassword("");
    try {
      await api("/support-access/disable", { method: "POST", body: "{}" });
      client.setQueryData(key, { enabled: false, expiresAt: null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo quitar el acceso."); }
    finally { setBusy(false); }
  }

  return <section aria-labelledby="support-access-title" style={{ marginBlock: 20, padding: 16, border: "1px solid currentColor", borderRadius: 12 }}>
    <h3 id="support-access-title">Soporte de Nexora</h3>
    <p>El soporte puede consultar datos durante el plazo elegido. Las consultas quedan en la bitácora.</p>
    <p role="status">{status.data?.enabled && status.data.expiresAt ? `Acceso permitido hasta ${format(status.data.expiresAt)}` : "Acceso apagado"}</p>
    {error && <p role="alert">{error}</p>}
    {password && <p role="status">Usuario: <strong>soporte-nexora</strong>. Contraseña, visible solo ahora: <strong>{password}</strong>. Guárdala y compártela por un canal seguro.</p>}
    <label htmlFor="support-duration">Duración del acceso</label>{" "}
    <select id="support-duration" value={duration} onChange={event => setDuration(event.target.value as "24h" | "7d")} style={{ minHeight: 44 }}>
      <option value="24h">24 horas</option><option value="7d">7 días</option>
    </select>{" "}
    <button type="button" disabled={busy} onClick={() => void enable()} style={{ minHeight: 44 }}>Permitir soporte de Nexora</button>{" "}
    {status.data?.enabled && <button type="button" disabled={busy} onClick={() => void disable()} style={{ minHeight: 44 }}>Quitar acceso</button>}
  </section>;
}

export function SupportAccessBanner() {
  const client = useQueryClient();
  const status = useQuery<Status>({ queryKey: key, queryFn: () => api("/support-access"), refetchInterval: 60000 });
  const [error, setError] = useState("");
  if (!status.data?.enabled || !status.data.expiresAt) return null;
  return <div role="status" style={{ padding: 12, background: "#153b54", color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
    Soporte de Nexora con acceso hasta {format(status.data.expiresAt)}.
    <button type="button" style={{ minHeight: 44, background: "#fff", color: "#123044", border: "2px solid #123044", borderRadius: 6 }} onClick={async () => {
      try { await api("/support-access/disable", { method: "POST", body: "{}" }); client.setQueryData(key, { enabled: false, expiresAt: null }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo quitar el acceso."); }
    }}>Quitar acceso</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
