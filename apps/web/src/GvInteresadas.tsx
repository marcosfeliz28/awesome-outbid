// GV · interesadas (prospectos): lista, alta y cambio de estado
// (docs/coordinacion/MODULO-GV.md §4).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { QueryState, toast } from "./helpers";

type Lead = {
  id: string;
  name: string;
  phone: string | null;
  interest: string | null;
  action: string | null;
  status: string;
  note: string | null;
};
const STATUS: Record<string, string> = {
  por_contactar: "Por contactar",
  contactada: "Contactada",
  inscrita: "Inscrita",
  descartada: "Descartada",
};

export function GvLeads() {
  const user = useStore((s) => s.user)!;
  const [status, setStatus] = useState("");
  const list = useQuery<Lead[]>({
    queryKey: ["gv-leads", status],
    queryFn: () => api("/gv/leads" + (status ? "?status=" + status : "")),
  });
  const [editing, setEditing] = useState<Lead | "new" | null>(null);
  const write = can(user.permissions, "gv:write");
  return (
    <>
      <div className="gv-toolbar">
        <label className="field">
          <span>Estado</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {write && (
          <Button onClick={() => setEditing("new")}>Nueva interesada</Button>
        )}
      </div>
      <QueryState query={list}>
        <div className="gv-cards">
          {list.data?.map((l) => (
            <div key={l.id} className="panel gv-card">
              <strong>{l.name}</strong>
              {l.phone && <span>{l.phone}</span>}
              {l.interest && <span>Interés: {l.interest}</span>}
              {l.action && <span>Acción: {l.action}</span>}
              {l.note && <small>{l.note}</small>}
              <span>
                <Badge
                  tone={
                    l.status === "inscrita"
                      ? "success"
                      : l.status === "descartada"
                        ? "danger"
                        : "warning"
                  }
                >
                  {STATUS[l.status]}
                </Badge>
              </span>
              {write && (
                <span className="gv-actions">
                  <Button variant="ghost" onClick={() => setEditing(l)}>
                    Editar
                  </Button>
                </span>
              )}
            </div>
          ))}
          {!list.data?.length && <p>Todavía no hay interesadas.</p>}
        </div>
      </QueryState>
      {editing && (
        <LeadForm
          lead={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

function LeadForm({ lead, onClose }: { lead?: Lead; onClose: () => void }) {
  const client = useQueryClient();
  const [operationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    name: lead?.name ?? "",
    phone: lead?.phone ?? "",
    interest: lead?.interest ?? "",
    action: lead?.action ?? "",
    status: lead?.status ?? "por_contactar",
    note: lead?.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (lead)
        await api("/gv/leads/" + lead.id, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
      else await post("/gv/leads", { ...form, operationId });
      await client.invalidateQueries({ queryKey: ["gv-leads"] });
      toast(lead ? "Interesada actualizada." : "Interesada guardada.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  const text = (key: keyof typeof form, label: string, full = false) => (
    <label className={"field" + (full ? " full" : "")}>
      <span>{label}</span>
      <input
        required={key === "name"}
        inputMode={key === "phone" ? "tel" : undefined}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={lead ? "Editar interesada" : "Nueva interesada"}
    >
      <form onSubmit={save} className="form-grid gv-form">
        {text("name", "Nombre", true)}
        {text("phone", "Teléfono")}
        <label className="field">
          <span>Estado</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {Object.entries(STATUS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {text("interest", "Interés (curso o servicio)", true)}
        {text("action", "Acción a tomar", true)}
        {text("note", "Nota", true)}
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer full">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
