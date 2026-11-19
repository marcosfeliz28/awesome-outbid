// Medidor de IA (docs/sistema/MEDIDOR_IA.md): tarjeta de Configuración, solo administración.
// Listas en filas que se parten (no tabla) para que quepa en 390 px.
import { useQuery } from "@tanstack/react-query";
import { can } from "@fitstore/shared";
import { api, useStore } from "./api";
import "./aiUsage.css";
import { useLanguage } from "./inicioLanguage";

type Line = {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
};
type Usage = {
  from: string;
  to: string;
  total: Line | null;
  byFeature: Line[];
  byUser: Line[];
  byDay: Line[];
};

export const usd = (n: number | null, en = false) =>
  n == null ? (en ? "unpriced" : "sin precio") : "US$" + n.toFixed(4);

function Rows({ title, lines }: { title: string; lines?: Line[] }) {
  const en = useLanguage() === "en";
  const safeLines = lines ?? [];
  return (
    <>
      <h4>{title}</h4>
      <ul className="ai-usage-list">
        {safeLines.map((l) => (
          <li
            key={l.key}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 12px",
              justifyContent: "space-between",
            }}
          >
            <strong>{l.key}</strong>
            <span>
              {l.calls} {en ? "calls" : "llamadas"} · {l.inputTokens + l.outputTokens} tokens ·{" "}
              {usd(l.costUsd, en)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function AiUsageCard() {
  const user = useStore((s) => s.user)!;
  return can(user.permissions, "*") ? <AiUsagePanel /> : null;
}

function AiUsagePanel() {
  const en = useLanguage() === "en";
  const q = useQuery({
    queryKey: ["ai-usage"],
    queryFn: () => api<Usage>("/ai/usage"),
  });
  const d = q.data;
  return (
    <section className="ai-usage-card">
      <h3>{en ? "AI usage and cost" : "Uso y costo de IA"}</h3>
      {q.isLoading && <p>{en ? "Loading…" : "Cargando…"}</p>}
      {q.isError && <p className="ai-error">{en ? "AI usage could not be loaded." : "No se pudo cargar el uso de IA."}</p>}
      {d && (
        <>
          <p>
            {en ? "From" : "Del"} {d.from} {en ? "to" : "al"} {d.to}:{" "}
            {d.total
              ? `${d.total.calls} ${en ? "calls" : "llamadas"}, ${usd(d.total.costUsd, en)}`
              : en ? "no usage" : "sin uso"}
            {en ? ". “unpriced” = the model price has not been entered." : ". «sin precio» = falta cargar el precio del modelo."}
          </p>
          <Rows title={en ? "By feature" : "Por función"} lines={d.byFeature} />
          <Rows title={en ? "By user" : "Por usuario"} lines={d.byUser} />
          <Rows title={en ? "By day" : "Por día"} lines={d.byDay} />
        </>
      )}
    </section>
  );
}
