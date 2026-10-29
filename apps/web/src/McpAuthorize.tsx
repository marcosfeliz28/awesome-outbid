import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "./api";

export function McpAuthorize() {
  const user = useStore((state) => state.user);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const request = {
    response_type: params.get("response_type") ?? "",
    client_id: params.get("client_id") ?? "",
    redirect_uri: params.get("redirect_uri") ?? "",
    code_challenge: params.get("code_challenge") ?? "",
    code_challenge_method: params.get("code_challenge_method") ?? "",
    scope: params.get("scope") ?? "",
    state: params.get("state") ?? "",
  };
  const query = useQuery({
    queryKey: ["mcp-oauth-client", window.location.search],
    queryFn: () => api<{ name: string; id: string; scope: string }>("/mcp/oauth/client?" + params.toString()),
    retry: false,
    enabled: !!request.client_id && !!request.redirect_uri,
  });
  const allowed = can(user?.permissions ?? [], "*") && user?.role !== "support";
  return <main style={{ maxWidth: 560, margin: "3rem auto", padding: "1.5rem" }}>
    <h1>Autorizar lectura para una IA</h1>
    {query.isLoading && <p>Comprobando la solicitud…</p>}
    {query.isError && <p role="alert">Esta aplicación no está autorizada para conectarse a Norexos. Revisa la dirección con administración.</p>}
    {!allowed && <p role="alert">Solo la administración puede autorizar esta conexión.</p>}
    {query.data && <section className="panel">
      <h2>{query.data.name}</h2>
      <p>Solicita permiso para consultar, durante una hora o hasta cerrar tu sesión, el total facturado hoy y hasta 20 productos bajo su mínimo en tu sucursal.</p>
      <p>No podrá cambiar inventario, ventas, precios ni datos del cliente. La conexión quedará en la bitácora.</p>
      <p>Dirección de retorno: <code style={{ overflowWrap: "anywhere" }}>{request.redirect_uri}</code></p>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <Button disabled={busy || !allowed || request.response_type !== "code" || request.scope !== "read"} onClick={async () => {
          setBusy(true); setError("");
          try {
            const response = await post<{ redirectTo: string }>("/mcp/oauth/authorize", request);
            window.location.assign(response.redirectTo);
          } catch (cause: any) { setError(cause?.message ?? "No se pudo autorizar."); setBusy(false); }
        }}>Autorizar solo lectura</Button>
        <Button variant="secondary" onClick={() => window.location.assign("/")}>Cancelar</Button>
      </div>
    </section>}
  </main>;
}
