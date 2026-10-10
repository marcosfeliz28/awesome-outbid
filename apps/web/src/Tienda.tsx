// Pantallas de la tienda: cierre por denominaciones, impresión del cuadre y
// de los reportes, contraentregas pendientes y ajustes de caja/cajero.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Printer, Truck, Upload } from "lucide-react";
import { Button, Badge, Modal, Empty } from "@fitstore/ui";
import { CASH_DENOMINATIONS, can, formatMoney } from "@fitstore/shared";
import { api, apiBlob, post, localDB, useStore } from "./api";
import { FormModal, QueryState, toast, mutate, today } from "./helpers";
import { pendingCloseMessage } from "./pendingSales";
import {
  CuadrePrint,
  DailyUserReportPrint,
  PaymentMethodReportPrint,
  PrintSheet,
} from "./Prints";

export type PrintKind = "cuadre" | "daily" | "method";
const TITLES: Record<PrintKind, string> = {
  cuadre: "Cuadre de Caja",
  daily: "Reporte de la venta diaria de usuario",
  method: "Reporte de venta usuario",
};
const REPORT: Record<Exclude<PrintKind, "cuadre">, string> = {
  daily: "venta-diaria-usuario",
  method: "venta-por-forma-pago",
};
export type Printing = { kind: PrintKind; data: any } | null;

// Lee el impreso de una caja (la propia o, con sale:manage, cualquiera).
export async function loadSessionPrint(kind: PrintKind, sessionId: string) {
  const path =
    kind === "cuadre"
      ? "/cash-sessions/" + sessionId + "/cuadre"
      : "/cash-sessions/" + sessionId + "/reports/" + REPORT[kind];
  return { kind, data: await api(path) };
}

function PrintBody({ p }: { p: NonNullable<Printing> }) {
  return p.kind === "cuadre" ? (
    <CuadrePrint c={p.data} />
  ) : p.kind === "daily" ? (
    <DailyUserReportPrint r={p.data} />
  ) : (
    <PaymentMethodReportPrint r={p.data} />
  );
}

/** Vista previa en pantalla, botón grande «Imprimir» y la hoja térmica. */
export function PrintModal({
  printing,
  onClose,
}: {
  printing: Printing;
  onClose: () => void;
}) {
  const config = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
  });
  if (!printing) return null;
  const width = config.data?.receiptWidth ?? "80";
  return (
    <Modal open onClose={onClose} title={TITLES[printing.kind]}>
      <div className="print-actions">
        <Button className="print-big" onClick={() => window.print()}>
          <Printer size={20} />
          Imprimir
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Listo
        </Button>
      </div>
      <div className={"print-preview w" + width}>
        <PrintBody p={printing} />
      </div>
      <PrintSheet width={width}>
        <PrintBody p={printing} />
      </PrintSheet>
    </Modal>
  );
}

const parse = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** Cierre de caja: conteo por denominación, vales, divisas, entregado. */
export function CloseCashModal({
  session,
  onClose,
  onClosed,
}: {
  session: any;
  onClose: () => void;
  onClosed: (cuadre: any) => void;
}) {
  const config = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
  });
  // 05-A2: lo que quedó en este equipo de esta caja se avisa antes de
  // contar, con lo que hay que hacer (antes sólo salía al pulsar «Cerrar»).
  const local = useQuery({
    queryKey: ["pending-sales", "close", session.id],
    queryFn: () =>
      localDB.sales
        .filter((s) => s.input.cashSessionId === session.id)
        .toArray(),
    networkMode: "always",
  });
  const waiting = pendingCloseMessage(
    local.data?.length ?? 0,
    local.data?.filter((s) => s.status === "conflict").length ?? 0,
  );
  const client = useQueryClient();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    vouchers: "",
    countedUsd: "",
    countedEur: "",
    countedCard: "",
    countedTransfer: "",
    delivered: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmBlindClose, setConfirmBlindClose] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm({ ...form, [key]: e.target.value });
  const subtotal =
    Math.round(
      CASH_DENOMINATIONS.reduce(
        (a, v) => a + v * Math.max(0, Math.floor(parse(counts[v] ?? ""))),
        0,
      ) * 100,
    ) / 100;
  const delivered = form.delivered.trim() === "" ? null : parse(form.delivered);
  const left = delivered === null ? subtotal : subtotal - delivered;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (delivered !== null && delivered > subtotal) {
      setError("Lo entregado no puede superar el efectivo contado.");
      return;
    }
    if (!confirmBlindClose) {
      setError(
        "Confirma que contaste todos los medios de pago antes de cerrar.",
      );
      return;
    }
    setBusy(true);
    try {
      const pending = await localDB.sales
        .filter((s) => s.input.cashSessionId === session.id)
        .toArray();
      if (pending.length)
        throw new Error(
          pendingCloseMessage(
            pending.length,
            pending.filter((s) => s.status === "conflict").length,
          ),
        );
      const denominations = Object.fromEntries(
        Object.entries(counts)
          .map(([k, v]) => [k, Math.floor(parse(v))] as const)
          .filter(([, v]) => v > 0),
      );
      await post("/cash-sessions/" + session.id + "/close", {
        denominations,
        countedCash: subtotal,
        vouchers: parse(form.vouchers),
        countedUsd: parse(form.countedUsd),
        countedEur: parse(form.countedEur),
        countedCard: parse(form.countedCard),
        countedTransfer: parse(form.countedTransfer),
        ...(delivered === null ? {} : { delivered }),
        notes: form.notes,
      });
      const cuadre = await api("/cash-sessions/" + session.id + "/cuadre");
      await client.invalidateQueries();
      onClosed(cuadre);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const money = (
    label: string,
    key: keyof typeof form,
    help?: string,
    required = false,
  ) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={form[key]}
        onChange={set(key)}
        required={required}
      />
      {help && <small>{help}</small>}
    </label>
  );
  return (
    <Modal open onClose={onClose} title="Cuadre y cierre de caja">
      <form onSubmit={submit} className="close-cash">
        {waiting && (
          <p className="close-pending-warning" role="alert">
            {waiting}
          </p>
        )}
        <p className="close-expected">
          Conteo ciego: declara lo que realmente tienes. La comparación aparece
          después de cerrar.
        </p>
        <h3>Detalles de monedas</h3>
        <div className="count-grid">
          {CASH_DENOMINATIONS.map((v) => {
            const qty = Math.max(0, Math.floor(parse(counts[v] ?? "")));
            return (
              <label key={v} className="count-row">
                <span className="count-value">{v.toLocaleString("en-US")}</span>
                <span aria-hidden>×</span>
                <input
                  aria-label={"Cantidad de " + v}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  placeholder="0"
                  value={counts[v] ?? ""}
                  onChange={(e) =>
                    setCounts({ ...counts, [v]: e.target.value })
                  }
                />
                <span className="count-total">= {formatMoney(v * qty)}</span>
              </label>
            );
          })}
        </div>
        <p className="count-subtotal">
          Efectivo contado (Sub-total) <strong>{formatMoney(subtotal)}</strong>
        </p>
        <div className="form-grid">
          {money(
            "Vale de caja",
            "vouchers",
            "Comprobantes de salida que están en la gaveta.",
          )}
          {!!config.data?.usdRate &&
            money("Dólares US$", "countedUsd", "Tasa " + config.data.usdRate)}
          {!!config.data?.eurRate &&
            money("Euros €", "countedEur", "Tasa " + config.data.eurRate)}
          {money(
            "Tarjeta declarada",
            "countedCard",
            "Escribe 0 si no hubo cobros con tarjeta.",
            true,
          )}
          {money(
            "Transferencia declarada",
            "countedTransfer",
            "Escribe 0 si no hubo transferencias.",
            true,
          )}
          {money(
            "Entregado",
            "delivered",
            "Efectivo que se le entrega a la dueña.",
          )}
          <div className="field count-left">
            <span>Dejado en caja</span>
            <strong className={left < 0 ? "danger-text" : ""}>
              {formatMoney(left)}
            </strong>
            <small>Será el fondo sugerido de la próxima apertura.</small>
          </div>
          <label className="field full">
            <span>Notas del cierre</span>
            <textarea value={form.notes} onChange={set("notes")} />
          </label>
          <label className="field full checkbox-field">
            <input
              type="checkbox"
              checked={confirmBlindClose}
              onChange={(event) => setConfirmBlindClose(event.target.checked)}
            />
            <span>
              Confirmo que conté efectivo, tarjeta y transferencia. Los campos
              vacíos representan RD$ 0.00.
            </span>
          </label>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy} className="print-big">
            <Printer size={18} />
            {busy ? "Cerrando…" : "Cerrar caja e imprimir cuadre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Botones de impresión de cada caja del historial. */
export function SessionPrintButtons({
  session,
  onPrint,
}: {
  session: any;
  onPrint: (p: Printing) => void;
}) {
  const open = async (kind: PrintKind) => {
    try {
      onPrint(await loadSessionPrint(kind, session.id));
    } catch (e: any) {
      toast(e.message, true);
    }
  };
  return (
    <div className="cash-history-actions">
      {session.closedAt && (
        <Button variant="secondary" onClick={() => open("cuadre")}>
          <Printer size={15} />
          Cuadre
        </Button>
      )}
      <Button variant="ghost" onClick={() => open("daily")}>
        Venta diaria
      </Button>
      <Button variant="ghost" onClick={() => open("method")}>
        Por forma de pago
      </Button>
    </div>
  );
}

/** Reportes de la sucursal por fecha y usuario (requiere reports:read). */
export function DayReports({ onPrint }: { onPrint: (p: Printing) => void }) {
  const user = useStore((s) => s.user)!;
  const [date, setDate] = useState(today()),
    [userId, setUserId] = useState("");
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/users"),
    enabled: can(user.permissions, "*"),
  });
  if (!can(user.permissions, "reports:read")) return null;
  const open = async (kind: "daily" | "method") => {
    try {
      const params = new URLSearchParams({
        from: date + "T00:00:00-04:00",
        to: date + "T23:59:59-04:00",
        ...(userId ? { userId } : {}),
      });
      onPrint({
        kind,
        data: await api("/reports/" + REPORT[kind] + "?" + params),
      });
    } catch (e: any) {
      toast(e.message, true);
    }
  };
  return (
    <div className="day-reports">
      <label className="field">
        <span>Fecha</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      {!!users.data && (
        <label className="field">
          <span>Usuario</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">Todos</option>
            {users.data.map((u: any) => (
              <option key={u.id} value={u.id}>
                {(u.cashierNumber ? u.cashierNumber + " · " : "") + u.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <Button variant="secondary" onClick={() => open("daily")}>
        <Printer size={15} />
        Venta diaria del día
      </Button>
      <Button variant="secondary" onClick={() => open("method")}>
        <Printer size={15} />
        Por forma de pago del día
      </Button>
    </div>
  );
}

/** Créditos y contraentregas: sólo la administración registra los cobros. */
export function CodPending({ session }: { session: any }) {
  const query = useQuery({
    queryKey: ["cod-pending"],
    queryFn: () => api<any[]>("/cod/pending"),
    refetchInterval: 30000,
  });
  const [collecting, setCollecting] = useState<any>(null);
  const rows = query.data ?? [];
  return (
    <section className="panel cod-panel">
      <div className="panel-heading">
        <div>
          <h2>
            <Truck size={20} /> Créditos y contraentregas pendientes
          </h2>
          <p>
            Seguimiento administrativo de mercancía entregada y todavía no
            cobrada.
          </p>
        </div>
      </div>
      <QueryState query={query}>
        {rows.length ? (
          <div className="cod-list">
            {rows.map((r) => (
              <div className="cod-row" key={r.saleId}>
                <div>
                  <strong>{r.number}</strong>
                  <small>
                    {new Date(r.createdAt).toLocaleString("es-DO", {
                      timeZone: "America/Santo_Domingo",
                    })}
                    {r.customer
                      ? " · " +
                        r.customer.name +
                        (r.customer.phone ? " · " + r.customer.phone : "")
                      : ""}
                  </small>
                  {r.pendingVerification > 0 && (
                    <Badge tone="warning">
                      {formatMoney(r.pendingVerification)} por verificar
                    </Badge>
                  )}
                  {r.collections?.length > 0 && (
                    <ul className="cod-collections">
                      {r.collections.map((c: any) => (
                        <li key={c.paymentId}>
                          <ProofThumb
                            paymentId={c.paymentId}
                            hasProof={c.hasProof}
                          />
                          <span>
                            {COD_METHOD_LABEL[c.method] ?? c.method}{" "}
                            {formatMoney(c.amount)}
                            {c.reference ? " · " + c.reference : ""}
                            {c.status === "pending_verification"
                              ? " · por verificar"
                              : c.status === "rejected"
                                ? " · rechazada"
                                : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <strong className="cod-amount">{formatMoney(r.pending)}</strong>
                <Button
                  disabled={!session}
                  title={session ? undefined : "Abre tu caja para cobrar."}
                  onClick={() => setCollecting(r)}
                >
                  Registrar pago
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="Sin créditos ni contraentregas pendientes"
            description="Las ventas pendientes aparecerán aquí, con el nombre del cliente, hasta completar el pago."
          />
        )}
      </QueryState>
      {collecting && session && (
        <CodCollect
          row={collecting}
          session={session}
          onClose={() => setCollecting(null)}
        />
      )}
    </section>
  );
}

const COD_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
};
export const PROOF_MAX_BYTES = 2 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Carga la evidencia sólo cuando el usuario la solicita; las listas nunca
 * transportan imágenes base64 completas. */
export function ProofThumb({
  paymentId,
  hasProof,
}: {
  paymentId: string;
  hasProof?: boolean;
}) {
  const [blobUrl, setBlobUrl] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!hasProof) return;
    let current = true;
    let url = "";
    apiBlob("/payments/" + paymentId + "/proof")
      .then((blob) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasProof, paymentId]);
  if (!hasProof) return null;
  return (
    <button
      type="button"
      className="proof-thumb"
      onClick={() =>
        blobUrl && window.open(blobUrl, "_blank", "noopener,noreferrer")
      }
      title="Ver la foto de la evidencia"
      disabled={!blobUrl}
    >
      {blobUrl ? (
        <img src={blobUrl} alt="Evidencia del pago" />
      ) : failed ? (
        "No disponible"
      ) : (
        "Cargando evidencia…"
      )}
    </button>
  );
}

/** Sube la foto de la evidencia (jpg/png/webp, 2 MB) a un pago. */
export async function uploadProof(paymentId: string, file: File) {
  if (!PROOF_TYPES.includes(file.type))
    throw new Error("La evidencia debe ser una imagen JPG, PNG o WebP.");
  if (file.size > PROOF_MAX_BYTES)
    throw new Error("La foto debe pesar como máximo 2 MB.");
  const body = new FormData();
  body.append("file", file);
  return api<{ hasProof: boolean }>("/payments/" + paymentId + "/proof", {
    method: "POST",
    body,
  });
}

/** Botón para tomar o elegir la foto desde el celular o la laptop. */
export function ProofPicker({
  file,
  onChange,
  disabled,
}: {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState("");
  const pick = (next: File | null) => {
    if (next && !PROOF_TYPES.includes(next.type)) {
      toast("La evidencia debe ser una imagen JPG, PNG o WebP.", true);
      return;
    }
    if (next && next.size > PROOF_MAX_BYTES) {
      toast("La foto debe pesar como máximo 2 MB.", true);
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : "");
    onChange(next);
  };
  return (
    <div className="proof-picker full">
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        aria-label="Foto de la evidencia"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
      <Button
        type="button"
        variant="secondary"
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <Camera size={18} />{" "}
        {file ? "Cambiar foto" : "Subir foto de la evidencia"}
      </Button>
      {file ? (
        <span className="proof-preview">
          {preview && <img src={preview} alt="" />}
          <small>
            {file.name} · {Math.max(1, Math.round(file.size / 1024))} KB
          </small>
          <button
            type="button"
            className="text-link"
            onClick={() => pick(null)}
          >
            Quitar
          </button>
        </span>
      ) : (
        <small>
          Voucher, comprobante o el efectivo recibido (JPG, PNG o WebP, hasta 2
          MB). Opcional.
        </small>
      )}
    </div>
  );
}

function CodCollect({
  row,
  session,
  onClose,
}: {
  row: any;
  session: any;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [amount, setAmount] = useState(String(row.pending)),
    [method, setMethod] = useState<"cash" | "card" | "transfer">("cash"),
    [bank, setBank] = useState(""),
    [reference, setReference] = useState(""),
    [proof, setProof] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Un reintento usa el mismo identificador: no se cobra dos veces.
  const [uuid] = useState(() => crypto.randomUUID());
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payment = await post("/sales/" + row.saleId + "/cod-collections", {
        offlineUuid: uuid,
        cashSessionId: session.id,
        amount: Number(amount),
        method,
        ...(method === "transfer" ? { bank, reference } : {}),
        ...(method === "card" ? { reference } : {}),
      });
      let proofFailed = "";
      if (proof) {
        try {
          await uploadProof(payment.id, proof);
        } catch (err: any) {
          // El cobro ya quedó registrado; la foto se puede subir después
          // desde el detalle de la venta.
          proofFailed = err.message;
        }
      }
      await client.invalidateQueries();
      if (proofFailed)
        toast(
          "Cobro registrado, pero la foto no se guardó: " + proofFailed,
          true,
        );
      else
        toast(
          method === "transfer"
            ? "Cobro registrado: queda por verificar en el banco."
            : method === "card"
              ? "Cobro con tarjeta registrado en tu caja."
              : "Cobro registrado en tu caja.",
        );
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={"Pago de crédito / contraentrega · " + row.number}
    >
      <form className="form-grid" onSubmit={submit}>
        <label className="field">
          <span>Monto cobrado</span>
          <input
            type="number"
            min="0.01"
            max={row.pending}
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Forma de pago</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as any)}
          >
            <option value="cash">Efectivo</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>
        {method === "card" && (
          <label className="field full">
            <span>Referencia del voucher</span>
            <input
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Número de aprobación o del enlace de pago"
            />
          </label>
        )}
        {method === "transfer" && (
          <>
            <label className="field">
              <span>Banco</span>
              <input
                required
                value={bank}
                onChange={(e) => setBank(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Referencia</span>
              <input
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
          </>
        )}
        <ProofPicker file={proof} onChange={setProof} disabled={busy} />
        <p className="cod-hint full">
          {method === "cash"
            ? "El efectivo entra en el cuadre de tu caja."
            : method === "card"
              ? "Cuenta como tarjeta en el cuadre de tu caja."
              : "Queda pendiente hasta que se verifique en el banco."}{" "}
          Puedes registrar una parte ahora y otra después, incluso con métodos
          diferentes. La cuenta sólo se cierra cuando el saldo llega a cero.
        </p>
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
            {busy ? "Registrando…" : "Registrar cobro"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Ajustes de la tienda: logo, número/nombre de cada caja y de cada cajero. */
export function StoreSettings() {
  const client = useQueryClient();
  const terminals = useQuery({
    queryKey: ["terminals"],
    queryFn: () => api<any[]>("/terminals"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api<any[]>("/users"),
  });
  const config = useQuery({
    queryKey: ["settings"],
    queryFn: () => api("/settings"),
  });
  const [register, setRegister] = useState<any>(null),
    [cashier, setCashier] = useState<any>(null);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 200 * 1024) {
      toast("El logo debe pesar como máximo 200 KB.", true);
      return;
    }
    const body = new FormData();
    body.append("file", file);
    try {
      await api("/settings/logo", { method: "POST", body });
      await client.invalidateQueries({ queryKey: ["settings"] });
      toast("Logo guardado.");
    } catch (e: any) {
      toast(e.message, true);
    }
  };
  const optionalNumber = (v: unknown) =>
    v === "" || v === null || v === undefined ? null : Number(v);
  return (
    <div className="store-settings">
      <div className="store-logo">
        {config.data?.logo ? (
          <img src={config.data.logo} alt="Logo del negocio" />
        ) : (
          <span>Sin logo</span>
        )}
        <label className="button secondary">
          <Upload size={16} />
          Subir logo (hasta 200 KB)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
      </div>
      <h3>Cajas (número y nombre en el cuadre)</h3>
      <div className="store-list">
        {(terminals.data ?? [])
          .filter((t) => !t.revokedAt)
          .map((t) => (
            <div key={t.id}>
              <span>
                <strong>
                  {t.registerNumber ? t.registerNumber + " · " : ""}
                  {t.registerName || t.name}
                </strong>
                <small>Equipo: {t.name}</small>
              </span>
              <Button variant="secondary" onClick={() => setRegister(t)}>
                Editar caja
              </Button>
            </div>
          ))}
      </div>
      <h3>Cajeros (número en el cuadre y los reportes)</h3>
      <div className="store-list">
        {(users.data ?? []).map((u) => (
          <div key={u.id}>
            <span>
              <strong>
                {u.cashierNumber ? u.cashierNumber + " · " : ""}
                {u.name}
              </strong>
              <small>{u.email}</small>
            </span>
            <Button variant="secondary" onClick={() => setCashier(u)}>
              No. de cajero
            </Button>
          </div>
        ))}
      </div>
      {register && (
        <FormModal
          title={"Caja · " + register.name}
          fields={[
            { key: "registerNumber", label: "Número de caja (ej. 4012)" },
            { key: "registerName", label: "Nombre de caja" },
          ]}
          initial={{
            registerNumber: register.registerNumber ?? "",
            registerName: register.registerName ?? "",
          }}
          onClose={() => setRegister(null)}
          onSubmit={(data) =>
            mutate(
              "/terminals/" + register.id + "/register",
              {
                registerNumber: optionalNumber(data.registerNumber),
                registerName: data.registerName || null,
              },
              "PATCH",
            )
          }
        />
      )}
      {cashier && (
        <FormModal
          title={"Cajero · " + cashier.name}
          fields={[
            { key: "cashierNumber", label: "Número de cajero (ej. 1031)" },
          ]}
          initial={{ cashierNumber: cashier.cashierNumber ?? "" }}
          onClose={() => setCashier(null)}
          onSubmit={(data) =>
            mutate(
              "/users/" + cashier.id,
              { cashierNumber: optionalNumber(data.cashierNumber) },
              "PATCH",
            )
          }
        />
      )}
    </div>
  );
}
