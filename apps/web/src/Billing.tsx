import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

type Plan = { id: string; monthlyPrice: number; currency: string };
type Provider = { kind: "bank_transfer" | "test"; instructions: { bank: string; account: string; holder: string } | null };
type Request = { id: string; plan: string; provider: string; amount: string; status: string; hasProof: boolean; createdAt: string };

export function Billing() {
  const cache = useQueryClient();
  const plans = useQuery<Plan[]>({ queryKey: ["billing-plans"], queryFn: () => api("/billing/plans") });
  const providers = useQuery<Provider[]>({ queryKey: ["billing-providers"], queryFn: () => api("/billing/providers") });
  const requests = useQuery<Request[]>({ queryKey: ["billing-requests"], queryFn: () => api("/billing/requests") });
  const [selected, setSelected] = useState("autoservicio");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const bank = providers.data?.find((entry) => entry.kind === "bank_transfer");
  const createRequest = async () => {
    setBusy(true); setError(""); setMessage("");
    try {
      await api("/billing/requests", { method: "POST", body: JSON.stringify({ plan: selected, provider: "bank_transfer" }) });
      setMessage("Solicitud creada. Haz la transferencia y sube el comprobante. Nexora la verificará antes de activar el plan.");
      await cache.invalidateQueries({ queryKey: ["billing-requests"] });
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const upload = async (id: string, file?: File) => {
    if (!file) return;
    setError(""); setMessage("");
    if (file.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("El comprobante debe ser JPG, PNG o WebP y pesar máximo 2 MB."); return;
    }
    setBusy(true);
    try {
      const body = new FormData(); body.append("file", file);
      await api(`/billing/requests/${id}/proof`, { method: "POST", body });
      setMessage("Comprobante recibido. El plan sigue pendiente hasta la verificación de Nexora.");
      await cache.invalidateQueries({ queryKey: ["billing-requests"] });
    } catch (cause: any) { setError(cause.message); }
    finally { setBusy(false); }
  };
  return <main className="onboarding">
    <header><h1>Plan y facturación</h1><p>Elige un plan mensual. No guardamos tarjetas ni activamos transferencias sin verificarlas.</p></header>
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
    <label htmlFor="billing-plan">Plan mensual</label>
    <select id="billing-plan" value={selected} onChange={(event) => setSelected(event.target.value)}>
      {(plans.data ?? []).map((plan) => <option key={plan.id} value={plan.id}>{plan.id} · RD$ {plan.monthlyPrice.toLocaleString("es-DO")}/mes</option>)}
    </select>
    {bank?.instructions ? <section aria-label="Cuenta bancaria de Nexora">
      <h2>Transferencia bancaria</h2>
      <p>Banco: {bank.instructions.bank}<br />Titular: {bank.instructions.holder}<br />Cuenta: {bank.instructions.account}</p>
      <p>Importe: RD$ {(plans.data?.find((plan) => plan.id === selected)?.monthlyPrice ?? 0).toLocaleString("es-DO")}</p>
      <button disabled={busy || plans.isLoading} onClick={createRequest}>Solicitar pago por transferencia</button>
    </section> : <p role="status">La cuenta para transferencias aún no está configurada. No hagas un pago hasta que aparezca aquí.</p>}
    <section aria-label="Solicitudes de pago">
      <h2>Mis solicitudes</h2>
      {requests.data?.length ? <ul>{requests.data.map((request) => <li key={request.id}>
        <strong>{request.plan} · RD$ {Number(request.amount).toLocaleString("es-DO")}</strong> · {request.status === "approved" ? "Aprobado" : request.status === "rejected" ? "Rechazado" : request.status === "pending_review" ? "En verificación" : "Falta el comprobante"}
        {request.provider === "bank_transfer" && ["pending_proof", "pending_review"].includes(request.status) && <label>Subir comprobante JPG, PNG o WebP (máx. 2 MB)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { void upload(request.id, event.currentTarget.files?.[0]); }} /></label>}
      </li>)}</ul> : <p>Aún no hay solicitudes.</p>}
    </section>
  </main>;
}
