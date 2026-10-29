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
  const [understood, setUnderstood] = useState(false);
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
    <h3 id="support-access-title">Soporte de Norexos</h3>
    {/* SOP-03: alcance real (permissions.support = catalog:read) antes de confirmar. */}
    <ul>
      <li><strong>Para qué:</strong> que el equipo de Norexos revise un problema que reportaste.</li>
      <li><strong>Qué verá, solo para leer:</strong> productos, precios, existencias, movimientos de inventario, compras recibidas, promociones y la configuración de la empresa.</li>
      <li><strong>Qué no verá:</strong> clientes, ventas, caja, reportes, costos ni márgenes. No puede cambiar nada.</li>
      <li><strong>Cuánto dura:</strong> el plazo que elijas (24 horas o 7 días); puedes quitarlo antes.</li>
      <li><strong>Qué se registra:</strong> quién abrió la sesión y por qué, y cada pantalla y registro consultado, en la bitácora.</li>
    </ul>
    <p role="status">{status.data?.enabled && status.data.expiresAt ? `Acceso permitido hasta ${format(status.data.expiresAt)}` : "Acceso apagado"}</p>
    {error && <p role="alert">{error}</p>}
    {password && <p role="status">Usuario: <strong>soporte-nexora</strong>. Contraseña, visible solo ahora: <strong>{password}</strong>. Guárdala y compártela por un canal seguro.</p>}
    <label htmlFor="support-duration">Duración del acceso</label>{" "}
    <select id="support-duration" value={duration} onChange={event => setDuration(event.target.value as "24h" | "7d")} style={{ minHeight: 44 }}>
      <option value="24h">24 horas</option><option value="7d">7 días</option>
    </select>{" "}
    <label style={{ display: "block", marginBlock: 8 }}><input type="checkbox" checked={understood} onChange={event => setUnderstood(event.target.checked)} /> Leí lo que soporte podrá ver y lo permito.</label>
    <button type="button" disabled={busy || !understood} onClick={() => void enable()} style={{ minHeight: 44 }}>Permitir soporte de Norexos</button>{" "}
    {status.data?.enabled && <button type="button" disabled={busy} onClick={() => void disable()} style={{ minHeight: 44 }}>Quitar acceso</button>}
  </section>;
}

export function SupportAccessBanner() {
  const client = useQueryClient();
  const status = useQuery<Status>({ queryKey: key, queryFn: () => api("/support-access"), refetchInterval: 60000 });
  const [error, setError] = useState("");
  if (!status.data?.enabled || !status.data.expiresAt) return null;
  return <div role="status" style={{ padding: 12, background: "#153b54", color: "#fff", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
    Soporte de Norexos con acceso hasta {format(status.data.expiresAt)}.
    <button type="button" style={{ minHeight: 44, background: "#fff", color: "#123044", border: "2px solid #123044", borderRadius: 6 }} onClick={async () => {
      try { await api("/support-access/disable", { method: "POST", body: "{}" }); client.setQueryData(key, { enabled: false, expiresAt: null }); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo quitar el acceso."); }
    }}>Quitar acceso</button>
    {error && <span role="alert">{error}</span>}
  </div>;
}
