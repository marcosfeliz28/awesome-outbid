// GV · citas de maquillaje: lista, alta/edición y pagos de cada cita
// (docs/coordinacion/MODULO-GV.md §3). Los pagos se verifican en «Por verificar».
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Modal } from "@fitstore/ui";
import { businessDate, can, formatMoney } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { QueryState, toast } from "./helpers";

type Payment = {
  id: string;
  date: string;
  amount: string;
  concept: string;
  method: string;
  bank: string | null;
  reference: string | null;
  verified: boolean;
  rejectedAt: string | null;
};
type Appointment = {
  id: string;
  date: string;
  clientName: string;
  phone: string | null;
  instagram: string | null;
  service: string;
  artists: string[];
  afterHours: boolean;
  total: string;
  tip: string;
  status: string;
  note: string | null;
  weddingQuote: string | null;
  venue: string | null;
  people: number | null;
  paid: string;
  pending: string;
  unverified: string;
  payments: Payment[];
};

const SERVICES: Record<string, string> = {
  sencillo: "Sencillo",
  social: "Social",
  glam: "Glam",
  correctivo: "Correctivo",
  novia: "Novia",
  con_peinado: "Con peinado",
  boda: "Boda",
  otro: "Otro",
};
const ARTISTS = ["Génesis", "Maryori", "Camila", "Evelin"];
const STATUS: Record<string, string> = {
  agendada: "Agendada",
  realizada: "Realizada",
  cancelada: "Cancelada",
  reembolsada: "Reembolsada",
};
const CONCEPTS: Record<string, string> = {
  separo: "Separo",
  completo: "Pago completo",
  restante: "Restante",
  segundo: "Segundo pago",
  tercero: "Tercer pago",
  otro: "Otro",
};
// Con tarjeta no se elige banco: se registra la terminal (la de Configuración
// si existe; si no, un único valor fijo).
export const GV_TERMINAL = "Terminal GV";
export const paymentBank = (
  method: string,
  bank: string,
  terminals: string[] = [],
) =>
  method === "tarjeta"
    ? terminals.length
      ? bank
      : GV_TERMINAL
    : method === "transferencia"
      ? bank
      : "";
const METHODS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};
const TZ = "America/Santo_Domingo";
const money = (value: string | number) => (
  <span className="gv-money">{formatMoney(value)}</span>
);
const when = (iso: string) =>
  new Date(iso).toLocaleString("es-DO", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
// <input type="datetime-local"> ↔ hora de República Dominicana (UTC−4, sin
// horario de verano).
const toLocalInput = (iso: string) =>
  new Date(new Date(iso).getTime() - 4 * 3600000).toISOString().slice(0, 16);
const fromLocalInput = (value: string) => value + ":00-04:00";
const send = (path: string, data: unknown, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });

function Options({ map }: { map: Record<string, string> }) {
  return (
    <>
      {Object.entries(map).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </>
  );
}
async function refresh(client: ReturnType<typeof useQueryClient>) {
  await client.invalidateQueries({ queryKey: ["gv-appointments"] });
  await client.invalidateQueries({ queryKey: ["gv-transfers"] });
  await client.invalidateQueries({ queryKey: ["gv-reports"] });
}

export function GvAppointments() {
  const user = useStore((s) => s.user)!;
  const [status, setStatus] = useState("");
  const list = useQuery<Appointment[]>({
    queryKey: ["gv-appointments", status],
    queryFn: () =>
      api("/gv/appointments" + (status ? "?status=" + status : "")),
  });
  const [editing, setEditing] = useState<Appointment | "new" | null>(null);
  const [paying, setPaying] = useState<Appointment | null>(null);
  const write = can(user.permissions, "gv:write");
  return (
    <>
      <div className="gv-toolbar">
        <label className="field">
          <span>Estado</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            <Options map={STATUS} />
          </select>
        </label>
        {write && <Button onClick={() => setEditing("new")}>Nueva cita</Button>}
      </div>
      <QueryState query={list}>
        <div className="gv-cards">
          {list.data?.map((a) => (
            <div key={a.id} className="panel gv-card">
              <strong>{a.clientName}</strong>
              <span>
                {when(a.date)} · {SERVICES[a.service]}
                {a.afterHours && " · fuera de horario"}
              </span>
              {a.artists.length > 0 && <span>{a.artists.join(", ")}</span>}
              {(a.phone || a.instagram) && (
                <span>
                  {[a.phone, a.instagram].filter(Boolean).join(" · ")}
                </span>
              )}
              <span>
                Total {money(a.total)} · Pagado {money(a.paid)}
              </span>
              <span>
                Pendiente {money(a.pending)}
                {Number(a.unverified) > 0 && (
                  <small> ({money(a.unverified)} por verificar)</small>
                )}
                {Number(a.tip) > 0 && <> · Propina {money(a.tip)}</>}
              </span>
              <span>
                <Badge
                  tone={
                    a.status === "realizada"
                      ? "success"
                      : a.status === "agendada"
                        ? "warning"
                        : "danger"
                  }
                >
                  {STATUS[a.status]}
                </Badge>
              </span>
              {write && (
                <span className="gv-actions">
                  <Button
                    variant="secondary"
                    disabled={
                      a.status === "cancelada" || a.status === "reembolsada"
                    }
                    onClick={() => setPaying(a)}
                  >
                    Pago
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(a)}>
                    Editar
                  </Button>
                </span>
              )}
            </div>
          ))}
          {!list.data?.length && <p>Todavía no hay citas.</p>}
        </div>
      </QueryState>
      {editing && (
        <AppointmentForm
          appointment={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {paying && (
        <AppointmentPaymentForm
          appointment={paying}
          onClose={() => setPaying(null)}
        />
      )}
    </>
  );
}

function AppointmentForm({
  appointment: a,
  onClose,
}: {
  appointment?: Appointment;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [operationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    date: a ? toLocalInput(a.date) : businessDate() + "T10:00",
    clientName: a?.clientName ?? "",
    phone: a?.phone ?? "",
    instagram: a?.instagram ?? "",
    service: a?.service ?? "social",
    artists: a?.artists ?? [],
    afterHours: a?.afterHours ?? false,
    total: a?.total ?? "",
    tip: a?.tip ?? "0",
    status: a?.status ?? "agendada",
    note: a?.note ?? "",
    weddingQuote: a?.weddingQuote ?? "",
    venue: a?.venue ?? "",
    people: a?.people ? String(a.people) : "",
    refundAmount: "",
    refundDate: businessDate(),
  });
  // «Reembolsada» se registra una vez, con monto y fecha (GV-13).
  const refunding =
    form.status === "reembolsada" && a?.status !== "reembolsada";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const wedding = form.service === "boda";
      const { refundAmount, refundDate, ...rest } = form;
      const data = {
        ...rest,
        ...(refunding
          ? { refundAmount: Number(refundAmount), refundDate }
          : {}),
        date: fromLocalInput(form.date),
        total: Number(form.total),
        tip: Number(form.tip || 0),
        weddingQuote:
          wedding && form.weddingQuote !== ""
            ? Number(form.weddingQuote)
            : null,
        venue: wedding ? form.venue : null,
        people: wedding && form.people !== "" ? Number(form.people) : null,
      };
      if (a) await send("/gv/appointments/" + a.id, data, "PATCH");
      else await post("/gv/appointments", { ...data, operationId });
      await refresh(client);
      toast(a ? "Cita actualizada." : "Cita guardada.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={a ? "Editar cita" : "Nueva cita"} wide>
      <form onSubmit={save} className="form-grid gv-form">
        <label className="field full">
          <span>Clienta</span>
          <input
            required
            value={form.clientName}
            onChange={(e) => set("clientName", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Teléfono</span>
          <input
            inputMode="tel"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Instagram</span>
          <input
            value={form.instagram}
            onChange={(e) => set("instagram", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Fecha y hora</span>
          <input
            type="datetime-local"
            required
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Servicio</span>
          <select
            value={form.service}
            onChange={(e) => set("service", e.target.value)}
          >
            <Options map={SERVICES} />
          </select>
        </label>
        <fieldset className="field full">
          <legend>Artistas</legend>
          <div className="gv-actions">
            {ARTISTS.map((name) => (
              <label key={name} className="gv-check">
                <input
                  type="checkbox"
                  checked={form.artists.includes(name)}
                  onChange={(e) =>
                    set(
                      "artists",
                      e.target.checked
                        ? [...form.artists, name]
                        : form.artists.filter((x) => x !== name),
                    )
                  }
                />
                <span>{name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field gv-check">
          <input
            type="checkbox"
            checked={form.afterHours}
            onChange={(e) => set("afterHours", e.target.checked)}
          />
          <span>Fuera de horario</span>
        </label>
        <label className="field">
          <span>Estado</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            <Options map={STATUS} />
          </select>
        </label>
        {refunding && (
          <>
            <label className="field">
              <span>Monto reembolsado (RD$)</span>
              <input
                inputMode="decimal"
                required
                value={form.refundAmount}
                onChange={(e) => set("refundAmount", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Fecha del reembolso</span>
              <input
                type="date"
                required
                value={form.refundDate}
                onChange={(e) => set("refundDate", e.target.value)}
              />
            </label>
          </>
        )}
        <label className="field">
          <span>Total (RD$)</span>
          <input
            inputMode="decimal"
            required
            value={form.total}
            onChange={(e) => set("total", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Propina (RD$)</span>
          <input
            inputMode="decimal"
            value={form.tip}
            onChange={(e) => set("tip", e.target.value)}
          />
        </label>
        {form.service === "boda" && (
          <>
            <label className="field">
              <span>Cotización (RD$)</span>
              <input
                inputMode="decimal"
                value={form.weddingQuote}
                onChange={(e) => set("weddingQuote", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Personas</span>
              <input
                inputMode="numeric"
                value={form.people}
                onChange={(e) => set("people", e.target.value)}
              />
            </label>
            <label className="field full">
              <span>Lugar</span>
              <input
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
              />
            </label>
          </>
        )}
        <label className="field full">
          <span>Nota</span>
          <input
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </label>
        {a && a.payments.length > 0 && (
          <div className="full gv-payments">
            <strong>Pagos</strong>
            {a.payments.map((p) => (
              <div key={p.id} className="gv-payment">
                <span>
                  {p.date} · {CONCEPTS[p.concept]} · {METHODS[p.method]}
                  {p.bank && " · " + p.bank}
                  {p.reference && " · Ref. " + p.reference}
                </span>
                <span>
                  {money(p.amount)}{" "}
                  {p.rejectedAt ? (
                    <Badge tone="danger">Rechazado</Badge>
                  ) : p.verified ? (
                    <Badge tone="success">Verificado</Badge>
                  ) : (
                    <Badge tone="warning">Por verificar</Badge>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
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

function AppointmentPaymentForm({
  appointment: a,
  onClose,
}: {
  appointment: Appointment;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [operationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    date: businessDate(),
    // Lo que falta cobrar, descontando lo que ya espera verificación.
    amount:
      Number(a.pending) - Number(a.unverified) > 0
        ? (Number(a.pending) - Number(a.unverified)).toFixed(2)
        : "",
    concept: a.payments.length ? "restante" : "separo",
    method: "transferencia",
    bank: "",
    reference: "",
  });
  const terminals = useQuery({
    queryKey: ["gv-banks"],
    queryFn: () => api<{ terminals: string[] }>("/gv/banks"),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/gv/appointments/${a.id}/payments`, {
        ...form,
        bank: paymentBank(form.method, form.bank, terminals.data?.terminals),
        amount: Number(form.amount),
        operationId,
      });
      await refresh(client);
      toast("Pago registrado.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={"Pago de " + a.clientName}>
      <p>Pendiente: {money(a.pending)}. Este pago no pasa por la caja.</p>
      <form onSubmit={save} className="form-grid gv-form">
        <label className="field">
          <span>Fecha</span>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Monto (RD$)</span>
          <input
            inputMode="decimal"
            required
            value={form.amount}
            onChange={(e) => set("amount", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Concepto</span>
          <select
            value={form.concept}
            onChange={(e) => set("concept", e.target.value)}
          >
            <Options map={CONCEPTS} />
          </select>
        </label>
        <label className="field">
          <span>Método</span>
          <select
            value={form.method}
            onChange={(e) => set("method", e.target.value)}
          >
            <Options map={METHODS} />
          </select>
        </label>
        {form.method === "transferencia" && (
          <>
            <label className="field">
              <span>Banco</span>
              <input
                required
                value={form.bank}
                onChange={(e) => set("bank", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Referencia</span>
              <input
                required
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
              />
            </label>
          </>
        )}
        {form.method === "tarjeta" && (
          <>
            <label className="field">
              <span>Terminal</span>
              {(terminals.data?.terminals.length ?? 0) > 0 ? (
                <select
                  required
                  value={form.bank}
                  onChange={(e) => set("bank", e.target.value)}
                >
                  <option value="">Elige la terminal…</option>
                  {terminals.data?.terminals.map((t: string) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input readOnly value={GV_TERMINAL} />
              )}
            </label>
            <label className="field">
              <span>Referencia (aprobación, lote o voucher)</span>
              <input
                required
                value={form.reference}
                onChange={(e) => set("reference", e.target.value)}
              />
            </label>
          </>
        )}
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer full">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>
            {busy ? "Guardando…" : "Registrar pago"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
