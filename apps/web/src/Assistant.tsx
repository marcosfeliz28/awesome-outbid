import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./Assistant.css";

type Message = { role: "user" | "assistant"; content: string };
type Usage = { usadas: number; limite: number; mes: string };

const examples = [
  "Cuadre de hoy",
  "¿Quién facturó hoy y quién no?",
  "¿Cómo anulo una factura?",
  "Productos por agotarse",
];

export function Assistant({ online }: { online: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    if (online) {
      api<Usage>("/assistant/usage").then(setUsage).catch((cause) =>
        setError(cause instanceof Error ? cause.message : "No se pudo consultar la cuota."));
    }
  }, [open, online]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  function close() {
    setOpen(false);
    launcher.current?.focus();
  }

  function panelKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab" || !panel.current) return;
    const controls = [...panel.current.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)")];
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  async function send(value = draft) {
    const content = value.trim();
    if (!online || !content || busy || content.length > 500 || messages.length >= 19) return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    input.current?.focus();
    setError("");
    setBusy(true);
    try {
      const answer = await api<{ answer: string; remaining: number | null }>("/assistant/ask", {
        method: "POST", body: JSON.stringify({ messages: next }),
      });
      // La API acepta respuestas previas de hasta 2 000 caracteres.
      setMessages([...next, { role: "assistant", content: answer.answer.slice(0, 2000) }]);
      const remaining = answer.remaining;
      if (remaining !== null) setUsage(previous => previous ? { ...previous, usadas: previous.limite - remaining } : previous);
    } catch (cause) {
      setMessages(messages);
      setError(cause instanceof Error ? cause.message : "No se pudo responder. Inténtalo de nuevo.");
      setDraft(content);
    } finally { setBusy(false); }
  }

  return <>
    <button ref={launcher} type="button" className="assistant-launcher" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}>
      Pregúntale a Nexora
    </button>
    {open && <>
      <button className="assistant-backdrop" type="button" aria-label="Cerrar asistente" onClick={close} tabIndex={-1} />
      <section ref={panel} className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title" onKeyDown={panelKeyDown}>
        <header className="assistant-header">
          <div><h2 id="assistant-title">Pregúntale a Nexora</h2><p>Consulta tus datos y aprende a usar el sistema.</p></div>
          <button type="button" aria-label="Cerrar asistente" onClick={close}>Cerrar</button>
        </header>
        <div className="assistant-body">
          <p className="assistant-usage" role="status">{usage ? `${usage.usadas} de ${usage.limite} este mes` : "Consultando cuota…"}</p>
          {!online && <p role="alert">El asistente necesita internet.</p>}
          {error && <p role="alert">{error}</p>}
          <div className="assistant-messages" role="log" aria-label="Conversación" aria-live="polite">
            {messages.map((message, index) => <p key={index} className={`assistant-message assistant-${message.role}`}><strong>{message.role === "user" ? "Tú" : "Nexora"}:</strong> {message.content}</p>)}
            {busy && <p>Preparando respuesta…</p>}
          </div>
          {messages.length === 0 && <div className="assistant-examples" aria-label="Preguntas de ejemplo">
            {examples.map(example => <button key={example} type="button" disabled={!online || busy} onClick={() => void send(example)}>{example}</button>)}
          </div>}
          <form onSubmit={event => { event.preventDefault(); void send(); }}>
            <label htmlFor="assistant-question">Tu pregunta</label>
            <textarea ref={input} id="assistant-question" rows={2} maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} disabled={!online || busy} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} />
            <button type="submit" disabled={!online || busy || !draft.trim() || messages.length >= 19}>Enviar pregunta</button>
          </form>
        </div>
      </section>
    </>}
  </>;
}
