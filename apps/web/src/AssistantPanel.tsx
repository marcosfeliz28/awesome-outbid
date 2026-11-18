import { PremiumWorkspace } from "./PremiumWorkspace";
import "./premiumOperations.css";
import { useLanguage } from "./inicioLanguage";
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
  const en = useLanguage() === "en";
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
      setError(e?.message || (en ? "Unable to answer right now. Try again." : "No pude contestar ahora. Intenta de nuevo."));
    } finally {
      setBusy(false);
    }
  };
  return (
    <PremiumWorkspace area="assistant">
    <div className="assistant-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">{en ? "READ ONLY" : "SOLO LECTURA"}</span>
          <h1>{en ? "Ask Norexos" : "Preguntar a Norexos"}</h1>
          <p>
            {en ? "Ask in your own words, for example: how much did I sell in supplements this month? Read only: it does not change prices, stock or sales." : "Pregunta en tus palabras, por ejemplo «¿cuánto vendí en suplementos este mes?». Solo lee datos: no cambia precios, existencias ni ventas."}
          </p>
        </div>
      </div>
      <form className="assistant-question panel"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label={en ? "Your question" : "Tu pregunta"}
          rows={3}
          maxLength={500}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          style={{ width: "100%" }}
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          {busy ? (en ? "Thinking…" : "Pensando…") : (en ? "Ask" : "Preguntar")}
        </Button>
      </form>
      {error && <p role="alert">{error}</p>}
      {reply && (
        <section className="assistant-answer panel" aria-live="polite">
          <h2>{en ? "Answer" : "Respuesta"}</h2>
          <p style={{ whiteSpace: "pre-wrap" }}>{reply.answer}</p>
          <h3>{en ? "Data sources" : "Fuentes de datos"}</h3>
          <div className="assistant-sources">
          {reply.used.map((u, i) => (
            <article className="assistant-source" key={i}>
              <strong>{u.tool}</strong>
              {u.range && <p>{u.range.from} — {u.range.to}</p>}
            </article>
          ))}
          </div>
          <small>{en ? `You have ${reply.remaining} questions left today.` : `Te quedan ${reply.remaining} preguntas hoy.`}</small>
        </section>
      )}
      {!reply && remaining !== undefined && (
        <small>{en ? `You have ${remaining} questions left today.` : `Te quedan ${remaining} preguntas hoy.`}</small>
      )}
    </div>
    </PremiumWorkspace>
  );
}
