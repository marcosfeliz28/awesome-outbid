import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import "./Assistant.css";
import type { AssistantRequest } from "./dashboardQuestions";

type Message = { role: "user" | "assistant"; content: string };
type Usage = { usadas: number; limite: number; mes: string };
type VoidProposal = { factura: string; motivo: string };

const examples = [
  "Cuadre de hoy",
  "¿Quién facturó hoy y quién no?",
  "¿Cómo anulo una factura?",
  "Productos por agotarse",
];

export function Assistant({
  online,
  request,
}: {
  online: boolean;
  request?: AssistantRequest | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [proposal, setProposal] = useState<VoidProposal | null>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const panel = useRef<HTMLElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnTarget = useRef<HTMLElement | null>(null);
  const [suggestion, setSuggestion] = useState<AssistantRequest | null>(null);
  const [contextLabel, setContextLabel] = useState("");

  useEffect(() => {
    if (!request) return;
    returnTarget.current = request.origin;
    setOpen(true);
    if (draft.trim() || busy) setSuggestion(request);
    else {
      setDraft(request.question);
      setContextLabel(request.label);
      setSuggestion(null);
    }
    input.current?.focus();
  }, [request]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    if (online) {
      api<Usage>("/assistant/usage")
        .then(setUsage)
        .catch((cause) =>
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo consultar la cuota.",
          ),
        );
    }
  }, [open, online]);

  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [open]);

  useEffect(() => {
    if (proposal) confirmButton.current?.focus();
  }, [proposal]);

  function close() {
    setOpen(false);
    if (returnTarget.current?.isConnected) {
      returnTarget.current.focus();
    } else {
      launcher.current?.focus();
    }
  }

  function panelKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const controls = [
      ...panel.current.querySelectorAll<HTMLElement>(
        "button:not(:disabled), textarea:not(:disabled), summary, a[href]",
      ),
    ].filter((el) => el.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  async function send(value = draft) {
    const content = value.trim();
    if (
      !online ||
      !content ||
      busy ||
      content.length > 500 ||
      messages.length >= 19
    )
      return;
    const next: Message[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setProposal(null);
    input.current?.focus();
    setError("");
    setBusy(true);
    try {
      const answer = await api<{
        answer: string;
        remaining: number | null;
        proposal?: VoidProposal;
      }>("/assistant/ask", {
        method: "POST",
        body: JSON.stringify({ messages: next }),
      });
      // La API acepta respuestas previas de hasta 2 000 caracteres.
      setMessages([
        ...next,
        { role: "assistant", content: answer.answer.slice(0, 2000) },
      ]);
      setProposal(answer.proposal ?? null);
      const remaining = answer.remaining;
      if (remaining !== null)
        setUsage((previous) =>
          previous
            ? { ...previous, usadas: previous.limite - remaining }
            : previous,
        );
    } catch (cause) {
      setMessages(messages);
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo responder. Inténtalo de nuevo.",
      );
      setDraft(content);
    } finally {
      setBusy(false);
    }
  }

  async function confirmVoid() {
    if (!proposal || busy || !online) return;
    setBusy(true);
    setError("");
    try {
      const sales = await api<Array<{ id: string; number: string }>>(
        "/sales?q=" + encodeURIComponent(proposal.factura),
      );
      const sale = sales.find(
        (row) =>
          row.number.toLocaleUpperCase() ===
          proposal.factura.toLocaleUpperCase(),
      );
      if (!sale)
        throw new Error(
          "No se encontró esa factura entre tus ventas visibles.",
        );
      const result = await api<{ status: string }>(
        "/sales/" + encodeURIComponent(sale.id) + "/void-requests",
        {
          method: "POST",
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            reasonCode: "other",
            reason: proposal.motivo,
          }),
        },
      );
      if (result.status !== "pending")
        throw new Error("La solicitud no quedó pendiente; revísala en Ventas.");
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `Solicitud de anulación de ${proposal.factura} pendiente de revisión.`,
        },
      ]);
      setProposal(null);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo enviar la solicitud.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        className="assistant-launcher"
        onClick={() => {
          returnTarget.current = launcher.current;
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Pregúntale a Nexora
      </button>
      {open && (
        <>
          <button
            className="assistant-backdrop"
            type="button"
            aria-label="Cerrar asistente"
            onClick={close}
            tabIndex={-1}
          />
          <section
            ref={panel}
            className="assistant-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assistant-title"
            onKeyDown={panelKeyDown}
          >
            <header className="assistant-header">
              <div>
                <h2 id="assistant-title">Pregúntale a Nexora</h2>
                <p>Consulta tus datos y aprende a usar el sistema.</p>
              </div>
              <button
                type="button"
                aria-label="Cerrar asistente"
                onClick={close}
              >
                Cerrar
              </button>
            </header>
            <div className="assistant-body">
              {contextLabel && (
                <p className="assistant-context">
                  Desde el tablero: <strong>{contextLabel}</strong>. Revisa la
                  pregunta antes de enviarla.
                </p>
              )}
              {suggestion && (
                <div className="assistant-context-suggestion" role="status">
                  <p>
                    Pregunta sugerida desde {suggestion.label}. Tu borrador se
                    conserva hasta que elijas reemplazarlo.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setDraft(suggestion.question);
                      setContextLabel(suggestion.label);
                      setSuggestion(null);
                      input.current?.focus();
                    }}
                  >
                    Usar pregunta de la tarjeta
                  </button>
                  <button type="button" onClick={() => setSuggestion(null)}>
                    Conservar mi borrador
                  </button>
                </div>
              )}
              <p className="assistant-usage" role="status">
                {usage
                  ? `${usage.usadas} de ${usage.limite} este mes`
                  : "Consultando cuota…"}
              </p>
              {messages.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMessages([]);
                    setContextLabel("");
                    setSuggestion(null);
                    setProposal(null);
                    setError("");
                    input.current?.focus();
                  }}
                >
                  Nueva conversación
                </button>
              )}
              <details>
                <summary>Bandeja de cambios propuestos · 0</summary>
                <p>
                  Las propuestas de conteos y entradas de inventario están
                  desactivadas. El conector MCP solo consulta datos.
                </p>
              </details>
              {!online && <p role="alert">El asistente necesita internet.</p>}
              {error && <p role="alert">{error}</p>}
              <div
                className="assistant-messages"
                role="log"
                aria-label="Conversación"
                aria-live="polite"
              >
                {messages.map((message, index) => (
                  <p
                    key={index}
                    className={`assistant-message assistant-${message.role}`}
                  >
                    <strong>
                      {message.role === "user" ? "Tú" : "Nexora"}:
                    </strong>{" "}
                    {message.content}
                  </p>
                ))}
                {busy && <p>Preparando respuesta…</p>}
              </div>
              {proposal && (
                <div
                  className="assistant-proposal"
                  role="group"
                  aria-label="Confirmar solicitud de anulación"
                >
                  <p>
                    ¿Enviar solicitud de anulación de {proposal.factura} por «
                    {proposal.motivo}»?
                  </p>
                  <div>
                    <button
                      ref={confirmButton}
                      type="button"
                      disabled={busy || !online}
                      onClick={() => void confirmVoid()}
                    >
                      Sí, enviar solicitud
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setProposal(null)}
                    >
                      No, cancelar
                    </button>
                  </div>
                </div>
              )}
              {messages.length === 0 && (
                <div
                  className="assistant-examples"
                  aria-label="Preguntas de ejemplo"
                >
                  {examples.map((example) => (
                    <button
                      key={example}
                      type="button"
                      disabled={!online || busy}
                      onClick={() => void send(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send();
                }}
              >
                <label htmlFor="assistant-question">Tu pregunta</label>
                <textarea
                  ref={input}
                  id="assistant-question"
                  rows={2}
                  maxLength={500}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  disabled={!online || busy}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={
                    !online || busy || !draft.trim() || messages.length >= 19
                  }
                >
                  Enviar pregunta
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </>
  );
}
