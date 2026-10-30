// GV Makeup Studio: cursos, inscripciones y cobros (docs/coordinacion/MODULO-GV.md).
// Registro de seguimiento: no es la caja ni factura.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, Button, Modal } from "@fitstore/ui";
import { businessDate, can, formatMoney } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { QueryState, toast } from "./helpers";
import { GvAppointments, GV_TERMINAL, paymentBank } from "./GvCitas";
import { GvLeads } from "./GvInteresadas";
import "./gv.css";

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
  rejectReason: string | null;
  createdByName: string | null;
  verifiedByName: string | null;
};
type Enrollment = {
  id: string;
  clientName: string;
  phone: string | null;
  instagram: string | null;
  agreedPrice: string;
  status: string;
  attended: boolean | null;
  boughtBrushSet: boolean;
  note: string | null;
  createdByName: string | null;
  paid: string;
  pending: string;
  unverified: string;
  payments: Payment[];
};
type Course = {
  id: string;
  name: string;
  type: string;
  date: string;
  price: string;
  capacity: number;
  active: boolean;
  enrolled: number;
  attended: number;
  brushSets: number;
  paid: string;
  pending: string;
  unverified: string;
};
type Group = { key: string; total: string; count: number };

const TYPES: Record<string, string> = {
  automaquillaje: "Automaquillaje",
  brazilian: "Brazilian",
  personalizado: "Personalizado",
  otro: "Otro",
};
const STATUS: Record<string, string> = {
  activa: "Activa",
  no_asistio: "No asistió",
  personalizado: "Cambió a personalizado",
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
const METHODS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
};
const CLOSED = new Set(["cancelada", "reembolsada"]);
const money = (value: string | number) => (
  <span className="gv-money">{formatMoney(value)}</span>
);
const dateText = (value: string) =>
  new Date(value + "T12:00:00").toLocaleDateString("es-DO", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

export function Gv() {
  const user = useStore((s) => s.user)!;
  const [tab, setTab] = useState<
    "courses" | "appointments" | "leads" | "transfers" | "reports"
  >("courses");
  const [courseId, setCourseId] = useState<string | null>(null);
  return (
    <section className="gv-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GV MAKEUP STUDIO</div>
          <h1>Cursos y cobros</h1>
          <p>
            Inscripciones y pagos de GV. No es la caja: los productos se venden
            en el punto de venta.
          </p>
        </div>
      </div>
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "courses"}
          className={tab === "courses" ? "active" : ""}
          onClick={() => {
            setTab("courses");
            setCourseId(null);
          }}
        >
          Cursos
        </button>
        <button
          role="tab"
          aria-selected={tab === "appointments"}
          className={tab === "appointments" ? "active" : ""}
          onClick={() => setTab("appointments")}
        >
          Citas
        </button>
        <button
          role="tab"
          aria-selected={tab === "leads"}
          className={tab === "leads" ? "active" : ""}
          onClick={() => setTab("leads")}
        >
          Interesadas
        </button>
        <button
          role="tab"
          aria-selected={tab === "transfers"}
          className={tab === "transfers" ? "active" : ""}
          onClick={() => setTab("transfers")}
        >
          Por verificar
        </button>
        {can(user.permissions, "gv:reports") && (
          <button
            role="tab"
            aria-selected={tab === "reports"}
            className={tab === "reports" ? "active" : ""}
            onClick={() => setTab("reports")}
          >
            Reportes
          </button>
        )}
      </div>
      {tab === "courses" &&
        (courseId ? (
          <CourseDetail id={courseId} back={() => setCourseId(null)} />
        ) : (
          <Courses open={setCourseId} />
        ))}
      {tab === "appointments" && <GvAppointments />}
      {tab === "leads" && <GvLeads />}
      {tab === "transfers" && <Transfers />}
      {tab === "reports" && <Reports />}
    </section>
  );
}

function Courses({ open }: { open: (id: string) => void }) {
  const courses = useQuery<Course[]>({
    queryKey: ["gv-courses"],
    queryFn: () => api("/gv/courses"),
  });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="gv-toolbar">
        <Button onClick={() => setCreating(true)}>Nuevo curso</Button>
      </div>
      <QueryState query={courses}>
        <div className="gv-cards">
          {courses.data?.map((c) => (
            <button
              key={c.id}
              className="panel gv-card"
              onClick={() => open(c.id)}
            >
              <strong>{c.name}</strong>
              <span>
                {TYPES[c.type]} · {dateText(c.date)}
                {!c.active && " · inactivo"}
              </span>
              <span>
                {c.enrolled} / {c.capacity} inscritas · {money(c.price)}
              </span>
              <span>
                Pagado {money(c.paid)} · Pendiente {money(c.pending)}
              </span>
            </button>
          ))}
          {!courses.data?.length && <p>Todavía no hay cursos.</p>}
        </div>
      </QueryState>
      {creating && <CourseForm onClose={() => setCreating(false)} />}
    </>
  );
}

function CourseForm({
  course,
  onClose,
}: {
  course?: Course;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [form, setForm] = useState({
    name: course?.name ?? "",
    type: course?.type ?? "automaquillaje",
    date: course?.date ?? businessDate(),
    price: course?.price ?? "",
    capacity: String(course?.capacity ?? ""),
    active: course?.active ?? true,
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
      const data = {
        ...form,
        price: Number(form.price),
        capacity: Number(form.capacity),
      };
      if (course) await send("/gv/courses/" + course.id, data, "PATCH");
      else await post("/gv/courses", data);
      await client.invalidateQueries({ queryKey: ["gv-courses"] });
      await client.invalidateQueries({ queryKey: ["gv-course"] });
      toast(course ? "Curso actualizado." : "Curso creado.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={course ? "Editar curso" : "Nuevo curso"}
    >
      <form onSubmit={save} className="form-grid gv-form">
        <label className="field full">
          <span>Nombre</span>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Tipo</span>
          <select
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
          >
            <Options map={TYPES} />
          </select>
        </label>
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
          <span>Precio (RD$)</span>
          <input
            inputMode="decimal"
            required
            value={form.price}
            onChange={(e) => set("price", e.target.value)}
          />
        </label>
        <label className="field">
          <span>Cupo</span>
          <input
            inputMode="numeric"
            required
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value)}
          />
        </label>
        {course && (
          <label className="field full gv-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            <span>Activo</span>
          </label>
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

function CourseDetail({ id, back }: { id: string; back: () => void }) {
  const course = useQuery<Course & { enrollments: Enrollment[] }>({
    queryKey: ["gv-course", id],
    queryFn: () => api("/gv/courses/" + id),
  });
  const [editCourse, setEditCourse] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | "new" | null>(null);
  const [paying, setPaying] = useState<Enrollment | null>(null);
  const c = course.data;
  return (
    <QueryState query={course}>
      {c && (
        <>
          <div className="gv-toolbar">
            <Button variant="ghost" onClick={back}>
              ← Cursos
            </Button>
            <Button variant="secondary" onClick={() => setEditCourse(true)}>
              Editar curso
            </Button>
            <Button onClick={() => setEnrollment("new")}>
              Nueva inscripción
            </Button>
          </div>
          <div className="panel">
            <h2>{c.name}</h2>
            <p>
              {TYPES[c.type]} · {dateText(c.date)} · {money(c.price)} · Cupo{" "}
              {c.capacity}
            </p>
          </div>
          <div className="panel">
            <div className="table-wrap" tabIndex={0}>
              <table className="gv-table">
                <thead>
                  <tr>
                    <th>CLIENTA</th>
                    <th>TELÉFONO</th>
                    <th className="num">PRECIO</th>
                    <th className="num">PAGADO</th>
                    <th className="num">PENDIENTE</th>
                    <th>ESTADO</th>
                    <th>ASISTIÓ</th>
                    <th>SET</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {c.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{e.clientName}</strong>
                        {e.instagram && <small> {e.instagram}</small>}
                      </td>
                      <td>{e.phone}</td>
                      <td className="num">{money(e.agreedPrice)}</td>
                      <td className="num">
                        {money(e.paid)}
                        {Number(e.unverified) > 0 && (
                          <small> ({money(e.unverified)} por verificar)</small>
                        )}
                      </td>
                      <td className="num">{money(e.pending)}</td>
                      <td>{STATUS[e.status]}</td>
                      <td>
                        {e.attended === null ? "—" : e.attended ? "Sí" : "No"}
                      </td>
                      <td>{e.boughtBrushSet ? "Sí" : "No"}</td>
                      <td className="gv-actions">
                        <Button
                          variant="secondary"
                          disabled={CLOSED.has(e.status)}
                          onClick={() => setPaying(e)}
                        >
                          Pago
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setEnrollment(e)}
                        >
                          Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!c.enrollments.length && <p>Todavía no hay inscripciones.</p>}
          </div>
          {editCourse && (
            <CourseForm course={c} onClose={() => setEditCourse(false)} />
          )}
          {enrollment && (
            <EnrollmentForm
              courseId={c.id}
              price={c.price}
              enrollment={enrollment === "new" ? undefined : enrollment}
              onClose={() => setEnrollment(null)}
            />
          )}
          {paying && (
            <PaymentForm enrollment={paying} onClose={() => setPaying(null)} />
          )}
        </>
      )}
    </QueryState>
  );
}

function EnrollmentForm({
  courseId,
  price,
  enrollment,
  onClose,
}: {
  courseId: string;
  price: string;
  enrollment?: Enrollment;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [operationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    clientName: enrollment?.clientName ?? "",
    phone: enrollment?.phone ?? "",
    instagram: enrollment?.instagram ?? "",
    agreedPrice: enrollment?.agreedPrice ?? price,
    status: enrollment?.status ?? "activa",
    attended:
      enrollment?.attended === undefined || enrollment.attended === null
        ? ""
        : String(enrollment.attended),
    boughtBrushSet: enrollment?.boughtBrushSet ?? false,
    note: enrollment?.note ?? "",
    refundAmount: "",
    refundDate: businessDate(),
  });
  // «Reembolsada» se registra una vez, con monto y fecha (GV-13).
  const refunding =
    form.status === "reembolsada" && enrollment?.status !== "reembolsada";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key: string, value: unknown) =>
    setForm((f) => ({ ...f, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { refundAmount, refundDate, ...rest } = form;
      const data = {
        ...rest,
        agreedPrice: Number(form.agreedPrice),
        attended: form.attended === "" ? null : form.attended === "true",
        ...(refunding
          ? { refundAmount: Number(refundAmount), refundDate }
          : {}),
      };
      if (enrollment)
        await send("/gv/enrollments/" + enrollment.id, data, "PATCH");
      else await post("/gv/enrollments", { ...data, courseId, operationId });
      await client.invalidateQueries({ queryKey: ["gv-course", courseId] });
      await client.invalidateQueries({ queryKey: ["gv-courses"] });
      toast(enrollment ? "Inscripción actualizada." : "Inscripción guardada.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={enrollment ? "Editar inscripción" : "Nueva inscripción"}
      wide
    >
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
          <span>Precio acordado (RD$)</span>
          <input
            inputMode="decimal"
            required
            value={form.agreedPrice}
            onChange={(e) => set("agreedPrice", e.target.value)}
          />
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
        <label className="field">
          <span>Asistió</span>
          <select
            value={form.attended}
            onChange={(e) => set("attended", e.target.value)}
          >
            <option value="">Sin marcar</option>
            <option value="true">Sí</option>
            <option value="false">No</option>
          </select>
        </label>
        <label className="field gv-check">
          <input
            type="checkbox"
            checked={form.boughtBrushSet}
            onChange={(e) => set("boughtBrushSet", e.target.checked)}
          />
          <span>Compró el set de brochas</span>
        </label>
        <label className="field full">
          <span>Nota</span>
          <input
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
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
        {enrollment && <PaymentList enrollment={enrollment} />}
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

function PaymentList({ enrollment }: { enrollment: Enrollment }) {
  const client = useQueryClient();
  const user = useStore((s) => s.user);
  const canVoid = can(user?.permissions ?? [], "gv:write");
  // Anular un pago equivocado con razón; se registra el correcto aparte.
  const voidPayment = async (p: Payment) => {
    const reason = prompt("¿Por qué se anula este pago?");
    if (!reason || reason.trim().length < 3) return;
    try {
      await post("/gv/payments/" + p.id + "/void", { reason });
      toast("Pago anulado.");
      await client.invalidateQueries({ queryKey: ["gv-course"] });
      await client.invalidateQueries({ queryKey: ["gv-courses"] });
      await client.invalidateQueries({ queryKey: ["gv-appointments"] });
    } catch (cause: any) {
      toast(cause.message, true);
    }
  };
  if (!enrollment.payments.length)
    return <p className="full">Sin pagos todavía.</p>;
  return (
    <div className="full gv-payments">
      <strong>Pagos</strong>
      {enrollment.payments.map((p) => (
        <div key={p.id} className="gv-payment">
          <span>
            {dateText(p.date)} · {CONCEPTS[p.concept]} · {METHODS[p.method]}
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
          {p.createdByName && <small>Registró: {p.createdByName}</small>}
          {canVoid && !p.rejectedAt && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => voidPayment(p)}
            >
              Anular
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

function PaymentForm({
  enrollment,
  onClose,
}: {
  enrollment: Enrollment;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [operationId] = useState(() => crypto.randomUUID());
  const [form, setForm] = useState({
    date: businessDate(),
    // Lo que falta cobrar, descontando lo que ya espera verificación.
    amount:
      Number(enrollment.pending) - Number(enrollment.unverified) > 0
        ? (Number(enrollment.pending) - Number(enrollment.unverified)).toFixed(
            2,
          )
        : "",
    concept: enrollment.payments.length ? "restante" : "separo",
    method: "transferencia",
    bank: "",
    reference: "",
  });
  const banks = useQuery({
    queryKey: ["gv-banks"],
    queryFn: () =>
      api<{ genesis: string[]; macgen: string[]; terminals: string[] }>(
        "/gv/banks",
      ),
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
      await post("/gv/payments", {
        ...form,
        bank: paymentBank(form.method, form.bank, banks.data?.terminals),
        amount: Number(form.amount),
        enrollmentId: enrollment.id,
        operationId,
      });
      await client.invalidateQueries({ queryKey: ["gv-course"] });
      await client.invalidateQueries({ queryKey: ["gv-courses"] });
      await client.invalidateQueries({ queryKey: ["gv-transfers"] });
      toast("Pago registrado.");
      onClose();
    } catch (cause: any) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={"Pago de " + enrollment.clientName}>
      <p>
        Pendiente: {money(enrollment.pending)}. Este pago no pasa por la caja.
      </p>
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
              <select
                required
                value={form.bank}
                onChange={(e) => set("bank", e.target.value)}
              >
                <option value="">Elige el banco…</option>
                {(banks.data?.genesis.length ?? 0) > 0 && (
                  <optgroup label="Grupo Génesis">
                    {banks.data?.genesis.map((b: string) => (
                      <option key={b}>{b}</option>
                    ))}
                  </optgroup>
                )}
                {(banks.data?.macgen.length ?? 0) > 0 && (
                  <optgroup label="Grupo Macgen">
                    {banks.data?.macgen.map((b: string) => (
                      <option key={b}>{b}</option>
                    ))}
                  </optgroup>
                )}
              </select>
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
              {(banks.data?.terminals.length ?? 0) > 0 ? (
                <select
                  required
                  value={form.bank}
                  onChange={(e) => set("bank", e.target.value)}
                >
                  <option value="">Elige la terminal…</option>
                  {banks.data?.terminals.map((t: string) => (
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

type PendingTransfer = Payment & {
  enrollment: { clientName: string; course: { name: string } } | null;
  appointment: { clientName: string; service: string } | null;
};
function Transfers() {
  const client = useQueryClient();
  const user = useStore((s) => s.user)!;
  const transfers = useQuery<PendingTransfer[]>({
    queryKey: ["gv-transfers"],
    queryFn: () => api("/gv/transfers/pending"),
  });
  const [busy, setBusy] = useState("");
  const review = async (p: PendingTransfer, verified: boolean) => {
    const reason = verified
      ? undefined
      : prompt("¿Por qué se rechaza? (por ejemplo, no llegó al banco)");
    if (!verified && (!reason || reason.trim().length < 3)) return;
    setBusy(p.id);
    try {
      await post("/gv/payments/" + p.id + "/review", { verified, reason });
      toast(verified ? "Transferencia verificada." : "Pago rechazado.");
      await client.invalidateQueries({ queryKey: ["gv-transfers"] });
      await client.invalidateQueries({ queryKey: ["gv-course"] });
      await client.invalidateQueries({ queryKey: ["gv-courses"] });
      await client.invalidateQueries({ queryKey: ["gv-appointments"] });
    } catch (cause: any) {
      toast(cause.message, true);
    } finally {
      setBusy("");
    }
  };
  // GV-05: sólo gerencia y administración verifican (gv:verify).
  const canReview = can(user.permissions, "gv:verify");
  return (
    <QueryState query={transfers}>
      <div className="panel gv-payments">
        {transfers.data?.map((p) => (
          <div key={p.id} className="gv-payment">
            <span>
              <strong>
                {p.enrollment?.clientName ?? p.appointment?.clientName}
              </strong>{" "}
              · {p.enrollment?.course.name ?? "Cita de maquillaje"}
            </span>
            <span>
              {dateText(p.date)} · {money(p.amount)} · {p.bank || "Sin banco"}
              {p.reference && " · Ref. " + p.reference}
            </span>
            {canReview && (
              <span className="gv-actions">
                <Button
                  variant="success"
                  disabled={busy === p.id}
                  onClick={() => review(p, true)}
                >
                  Verificar
                </Button>
                <Button
                  variant="danger"
                  disabled={busy === p.id}
                  onClick={() => review(p, false)}
                >
                  Rechazar
                </Button>
              </span>
            )}
          </div>
        ))}
        {!transfers.data?.length && <p>No hay transferencias por verificar.</p>}
      </div>
    </QueryState>
  );
}

function GroupTable({ title, rows }: { title: string; rows: Group[] }) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      <div className="table-wrap" tabIndex={0}>
        <table className="gv-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{METHODS[r.key] ?? r.key}</td>
                <td className="num">{r.count}</td>
                <td className="num">{money(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reports() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const report = useQuery<any>({
    queryKey: ["gv-reports", from, to],
    queryFn: () => api("/gv/reports" + (params.size ? "?" + params : "")),
  });
  const r = report.data;
  return (
    <>
      <div className="panel gv-toolbar">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>
      <QueryState query={report}>
        {r && (
          <div className="gv-reports">
            <div className="panel">
              <h2>Ingresos</h2>
              <p>
                Verificado {money(r.income.total)} · reembolsos{" "}
                {money(r.income.refunds)} · neto {money(r.income.net)} · por
                verificar {money(r.income.unverified)}
              </p>
            </div>
            <GroupTable title="Por día" rows={r.income.byDay} />
            <GroupTable title="Por método" rows={r.income.byMethod} />
            <GroupTable title="Por banco" rows={r.income.byBank} />
            <GroupTable title="Por empleada" rows={r.income.byEmployee} />
            <div className="panel">
              <h2>Ocupación y pendientes por curso</h2>
              <div className="table-wrap" tabIndex={0}>
                <table className="gv-table">
                  <thead>
                    <tr>
                      <th>CURSO</th>
                      <th className="num">INSCRITAS</th>
                      <th className="num">ASISTIERON</th>
                      <th className="num">SETS</th>
                      <th className="num">PAGADO</th>
                      <th className="num">PENDIENTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.courses.map((c: any) => (
                      <tr key={c.id}>
                        <td>
                          {c.name} <small>{dateText(c.date)}</small>
                        </td>
                        <td className="num">
                          {c.enrolled} / {c.capacity}
                        </td>
                        <td className="num">{c.attended}</td>
                        <td className="num">{c.brushSets}</td>
                        <td className="num">{money(c.paid)}</td>
                        <td className="num">{money(c.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="panel">
              <h2>Pendientes por clienta</h2>
              <div className="table-wrap" tabIndex={0}>
                <table className="gv-table">
                  <tbody>
                    {r.pendingByClient.map((e: any) => (
                      <tr key={e.id}>
                        <td>
                          {e.clientName} <small>{e.phone}</small>
                        </td>
                        <td>{e.course}</td>
                        <td className="num">{money(e.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </QueryState>
    </>
  );
}
