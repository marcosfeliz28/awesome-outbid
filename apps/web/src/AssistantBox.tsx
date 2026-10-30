import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { api } from "./api";

// IA de ventas (solo lectura). Sin llave en el servidor, `enabled` es false y no se muestra nada.
export function AssistantBox() {
  const status = useQuery({
    queryKey: ["assistant-status"],
    queryFn: () => api<{ enabled: boolean }>("/assistant/status"),
    retry: false,
  });
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  if (!status.data?.enabled) return null;
  const ask = async () => {
    setBusy(true);
    try {
      const r = await api<{ answer: string }>("/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      });
      setAnswer(r.answer);
    } catch (e: any) {
      setAnswer(e?.message ?? "No se pudo consultar.");
    }
    setBusy(false);
  };
  return (
    <section className="panel" aria-labelledby="assistant-title">
      <div className="panel-heading">
        <h2 id="assistant-title">Pregunta sobre tus ventas</h2>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) void ask();
        }}
      >
        <input
          aria-label="Tu pregunta"
          maxLength={500}
          placeholder="¿Cuánto vendí en suplementos este mes?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={busy || !question.trim()}>
          {busy ? "Consultando…" : "Preguntar"}
        </Button>
      </form>
      {answer && <p style={{ whiteSpace: "pre-wrap" }}>{answer}</p>}
    </section>
  );
}
