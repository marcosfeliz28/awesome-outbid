import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";
import { Button } from "@fitstore/ui";
import { api, post } from "./api";

export type AssistantStatus = {
  enabled: boolean;
  canUse: boolean;
  limit: number;
  remaining: number;
};
export const loadAssistantStatus = () =>
  api<AssistantStatus>("/assistant/status");
export const AssistantIcon = MessageCircleQuestion;

type Reply = {
  answer: string;
  remaining: number;
  limited?: boolean;
  used: { tool: string; range?: { from: string; to: string } }[];
};

export function AssistantPage({ remaining }: { remaining?: number }) {
  const [question, setQuestion] = useState(""),
    [reply, setReply] = useState<Reply | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const send = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      setReply(await post<Reply>("/assistant/ask", { question }));
    } catch (e: any) {
      setReply(null);
      setError(e?.message || "No pude contestar ahora. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="assistant-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">SOLO LECTURA</span>
          <h1>Preguntar a Norexos</h1>
          <p>
            Pregunta en tus palabras, por ejemplo «¿cuánto vendí en suplementos
            este mes?». Solo lee datos: no cambia precios, existencias ni
            ventas.
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label="Tu pregunta"
          rows={3}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ width: "100%" }}
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          {busy ? "Pensando…" : "Preguntar"}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {reply && (
        <section aria-live="polite">
          <p style={{ whiteSpace: "pre-wrap" }}>{reply.answer}</p>
          {reply.used.map((u, i) => (
            <small key={i} style={{ display: "block" }}>
              Datos usados: {u.tool}
              {u.range ? ` · ${u.range.from} a ${u.range.to}` : ""}
            </small>
          ))}
          <small>Te quedan {reply.remaining} preguntas hoy.</small>
        </section>
      )}
      {!reply && remaining !== undefined && (
        <small>Te quedan {remaining} preguntas hoy.</small>
      )}
    </div>
  );
}
