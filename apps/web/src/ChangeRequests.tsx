// «Pedir un cambio»: la persona escribe qué le gustaría cambiar y ve sus solicitudes.
// La administración las revisa en el sistema; aquí no se envía ningún correo.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, post } from "./api";
import { toast } from "./helpers";

type ChangeRequest = {
  id: string;
  title: string;
  description: string;
  status: "abierto" | "en_proceso" | "resuelto";
  createdAt: string;
};

const ESTADO: Record<ChangeRequest["status"], string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  resuelto: "Resuelto",
};

export function ChangeRequestPanel({ onBack }: { onBack: () => void }) {
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const mine = useQuery<ChangeRequest[]>({
    queryKey: ["change-requests"],
    queryFn: () => api("/change-requests"),
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post("/change-requests", { title, description });
      setTitle("");
      setDescription("");
      await client.invalidateQueries({ queryKey: ["change-requests"] });
      toast("Gracias. La administración revisará tu solicitud.");
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <form onSubmit={save} className="form-grid">
        <label className="field full">
          <span>¿Qué cambiarías?</span>
          <input
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="field full">
          <span>Cuéntanos más</span>
          <textarea
            required
            minLength={10}
            maxLength={2000}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer full">
          <button type="button" className="text-link" onClick={onBack}>
            ← Volver a Ayuda
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
      </form>
      <h3>Mis solicitudes</h3>
      {mine.data?.length ? (
        <ul>
          {mine.data.map((r) => (
            <li key={r.id}>
              <strong>{r.title}</strong> · {ESTADO[r.status]}
            </li>
          ))}
        </ul>
      ) : (
        <p>Todavía no has enviado solicitudes.</p>
      )}
    </div>
  );
}
