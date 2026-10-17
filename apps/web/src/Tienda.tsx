// Pantallas de la tienda: cierre por denominaciones, impresión del cuadre y
// de los reportes, contraentregas pendientes y ajustes de caja/cajero.
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Printer, Truck, Upload } from "lucide-react";
import { Button, Badge, Modal, Empty } from "@fitstore/ui";
import { CASH_DENOMINATIONS, can, formatMoney } from "@fitstore/shared";
import { api, apiBlob, post, localDB, useStore } from "./api";
import { FormModal, QueryState, toast, mutate, today } from "./helpers";
import { closeCashIntro } from "./managementMessages";
import { CreditAccounts } from "./CreditAccounts";
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
  sessionId,
  onSwitch,
}: {
  printing: Printing;
  onClose: () => void;
  /** Caja recién cerrada: ofrece sus otras dos impresiones del día. */
  sessionId?: string;
  onSwitch?: (p: Printing) => void;
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
      {sessionId && onSwitch && (
        <div className="print-actions">
          {(
            [
              ["cuadre", "Cuadre de caja"],
              ["daily", "Productos vendidos de esta caja"],
              ["method", "Facturas por forma de pago"],
            ] as [PrintKind, string][]
          )
            .filter(([kind]) => kind !== printing.kind)
            .map(([kind, label]) => (
              <Button
                key={kind}
                variant="secondary"
                onClick={async () => {
                  try {
                    onSwitch(await loadSessionPrint(kind, sessionId));
                  } catch (e: any) {
                    toast(e.message, true);
                  }
                }}
              >
                Siguiente: {label}
              </Button>
            ))}
        </div>
      )}
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
    managerPin: "",
  });
  const user = useStore((s) => s.user);
  // Igual que cash.ts (canViewCashExpected).
  const canSeeExpected =
    can(user?.permissions ?? [], "profit:read") ||
    can(user?.permissions ?? [], "sale:manage");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmBlindClose, setConfirmBlindClose] = useState(false),
    [cardNeedsPin, setCardNeedsPin] = useState(false),
    [cashNeedsPin, setCashNeedsPin] = useState(false);
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
  // A-1: un vale de caja exige nota y, a quien no gestiona ventas, el PIN de
  // un gerente (la API aplica la misma regla).
  const hasVouchers = parse(form.vouchers) > 0;
  const voucherNeedsPin =
    hasVouchers && !can(user?.permissions ?? [], "sale:manage");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (delivered !== null && delivered > subtotal) {
      setError("Lo entregado no puede superar el efectivo contado.");
      return;
    }
    if (hasVouchers && !form.notes.trim()) {
      setError(
        "Explica en las notas del cierre qué comprobantes forman el vale de caja.",
      );
      return;
    }
    if (!confirmBlindClose) {
      setError(
        "Confirma que contaste el efectivo y la tarjeta antes de cerrar.",
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
        ...(voucherNeedsPin || cardNeedsPin || cashNeedsPin
          ? { managerPin: form.managerPin }
          : {}),
      });
      const cuadre = await api("/cash-sessions/" + session.id + "/cuadre");
      await client.invalidateQueries();
      onClosed(cuadre);
    } catch (e: any) {
      setError(e.message);
      if (/total de tarjeta no coincide/i.test(e.message))
        setCardNeedsPin(true);
      if (/caja no cuadra con el sistema/i.test(e.message))
        setCashNeedsPin(true);
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
        {session.userId !== user?.id && (
          <p className="close-pending-warning" role="alert">
            Estás cerrando la caja de {session.userName ?? "otra persona"}
            {session.registerName ? " (" + session.registerName + ")" : ""}. Es
            un cierre de emergencia: queda en la bitácora como cerrada por ti en
            su nombre y el cuadre muestra a ambos.
          </p>
        )}
        <p className="close-reminder" role="note">
          Antes de cerrar: cierra el lote del verifón (datáfono) para que los
          cobros con tarjeta caigan el próximo día.
        </p>
        <p className="close-expected">{closeCashIntro(canSeeExpected)}</p>
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
          {canSeeExpected &&
            money(
              "Vale de caja",
              "vouchers",
              "Comprobantes de salida que están en la gaveta. Requiere una nota y, para cajeras, el PIN de un gerente; mejor regístralos como «Salida» antes de cerrar.",
            )}
          {(voucherNeedsPin || cardNeedsPin || cashNeedsPin) && (
            <label className="field">
              <span>
                {voucherNeedsPin
                  ? "PIN de gerente (vale de caja)"
                  : cardNeedsPin
                    ? "PIN de gerente (tarjeta no coincide)"
                    : "PIN de gerente (la caja no cuadra)"}
              </span>
              <input
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{4,6}"
                value={form.managerPin}
                onChange={set("managerPin")}
                required
              />
            </label>
          )}
          {!!config.data?.usdRate &&
            money("Dólares US$", "countedUsd", "Tasa " + config.data.usdRate)}
          {!!config.data?.eurRate &&
            money("Euros €", "countedEur", "Tasa " + config.data.eurRate)}
          {money(
            "Tarjeta declarada",
            "countedCard",
            "Total que imprimió el verifón al cerrar el lote de hoy. Cierra el verifón antes de cerrar la caja; escribe 0 solo si no hubo cobros con tarjeta.",
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
              Confirmo que conté efectivo y tarjeta. Las transferencias las suma
              el sistema. Los campos vacíos representan RD$ 0.00.
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

/** Créditos pendientes: sólo la administración registra los cobros. */
const CREDIT_STATUS: Record<string, { label: string; tone: any }> = {
  open: { label: "Abierto", tone: "danger" },
  partial: { label: "Parcial", tone: "warning" },
  closed: { label: "Cerrado", tone: "success" },
};
const ageText = (days: number) =>
  days <= 0 ? "hoy" : days === 1 ? "hace 1 día" : `hace ${days} días`;
export function CodPending({ session }: { session: any }) {
  const user = useStore((s) => s.user);
  const isAdmin = can(user?.permissions ?? [], "*");
  const [view, setView] = useState<"sales" | "customers">("sales");
  const [state, setState] = useState<"pending" | "closed">("pending");
  const query = useQuery({
    queryKey: ["cod-pending", state],
    queryFn: () => api<any[]>("/cod/pending?state=" + state),
    refetchInterval: 30000,
  });
  const [collecting, setCollecting] = useState<any>(null);
  const rows = query.data ?? [];
  const totalPending = rows.reduce((a, r) => a + Number(r.pending), 0);
  return (
    <section className="panel cod-panel" aria-labelledby="credits-title">
      <div className="panel-heading">
        <div>
          <h2 id="credits-title">
            <Truck size={20} /> Créditos pendientes
          </h2>
          <p>
            Ventas entregadas sin pago. Cualquier cajera puede cerrarlas en
            efectivo, de cualquier día: el dinero entra a su caja y lo entrega
            al cerrar. La tarjeta y la transferencia las registra la
            administración.
          </p>
        </div>
        <div
          className="segmented"
          role="group"
          aria-label="Estado de los créditos"
        >
          {(
            [
              ["pending", "Pendientes"],
              ["closed", "Cerrados"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={state === id ? "active" : ""}
              aria-pressed={state === id}
              onClick={() => setState(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isAdmin && (
        <div className="segmented" role="group" aria-label="Vista de créditos">
          <button
            type="button"
            className={view === "sales" ? "active" : ""}
            aria-pressed={view === "sales"}
            onClick={() => setView("sales")}
          >
            Por venta
          </button>
          <button
            type="button"
            className={view === "customers" ? "active" : ""}
            aria-pressed={view === "customers"}
            onClick={() => setView("customers")}
          >
            Por persona
          </button>
        </div>
      )}
      {isAdmin && view === "customers" ? (
        <CreditAccounts session={session} />
      ) : (
        <>
          {state === "pending" && rows.length > 0 && (
            <p className="cod-hint">
              {rows.length} {rows.length === 1 ? "crédito" : "créditos"} · Por
              cobrar: <strong>{formatMoney(totalPending)}</strong>
            </p>
          )}
          <QueryState query={query}>
            {rows.length ? (
              <div className="cod-list">
                {rows.map((r) => (
                  <div className="cod-row" key={r.saleId}>
                    <div>
                      <strong>{r.number}</strong>{" "}
                      <Badge tone={CREDIT_STATUS[r.status]?.tone}>
                        {CREDIT_STATUS[r.status]?.label}
                      </Badge>
                      <small>
                        {new Date(r.createdAt).toLocaleString("es-DO", {
                          timeZone: "America/Santo_Domingo",
                        })}
                        {" · " + ageText(r.ageDays)}
                        {r.customer
                          ? " · " +
                            r.customer.name +
                            (r.customer.phone ? " · " + r.customer.phone : "")
                          : ""}
                        {r.seller ? " · Vendió " + r.seller.name : ""}
                      </small>
                      <small className="cod-figures">
                        Total {formatMoney(r.total)} · Cobrado{" "}
                        {formatMoney(r.collected)} · Pendiente{" "}
                        {formatMoney(r.pending)}
                      </small>
                      {r.closedAt && (
                        <small>
                          Cerrado el{" "}
                          {new Date(r.closedAt).toLocaleString("es-DO", {
                            timeZone: "America/Santo_Domingo",
                          })}
                          {r.closedBy ? " por " + r.closedBy : ""}
                        </small>
                      )}
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
                                {c.receivedBy
                                  ? " · recibió " + c.receivedBy
                                  : ""}
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
                    <strong className="cod-amount">
                      {formatMoney(r.pending)}
                    </strong>
                    {state === "pending" && (
                      <Button onClick={() => setCollecting(r)}>
                        Registrar cobro
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                title={
                  state === "pending"
                    ? "Sin créditos pendientes"
                    : "Sin créditos cerrados"
                }
                description={
                  state === "pending"
                    ? "Las ventas a crédito aparecerán aquí, con el nombre del cliente, hasta completar el pago."
                    : "Los créditos saldados aparecerán aquí con quién y cuándo los cerró."
                }
              />
            )}
          </QueryState>
          {collecting && (
            <CodCollect
              row={collecting}
              session={session}
              onClose={() => setCollecting(null)}
            />
          )}
        </>
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

type CollectLine = {
  key: string;
  method: "cash" | "card" | "transfer";
  amount: string;
  bank: string;
  reference: string;
};
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
  const user = useStore((s) => s.user);
  const manager = can(user?.permissions ?? [], "sale:manage");
  // La dueña da por recibida la transferencia desde cualquier equipo: solo
  // indica el banco como guía (sin referencia ni caja propia).
  const owner = can(user?.permissions ?? [], "*");
  const newLine = (
    amount: string,
    method: CollectLine["method"] = session || !manager ? "cash" : "transfer",
  ) => ({
    key: crypto.randomUUID(),
    method,
    amount,
    bank: "",
    reference: "",
  });
  const [lines, setLines] = useState<CollectLine[]>(() => [
    newLine(String(row.pending)),
  ]);
  const [proof, setProof] = useState<File | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  // Un reintento usa el mismo identificador: no se cobra dos veces.
  const [operationId] = useState(() => crypto.randomUUID());
  const total = lines.reduce((a, l) => a + (Number(l.amount) || 0), 0);
  const left = Math.round((Number(row.pending) - total) * 100) / 100;
  const patch = (key: string, change: Partial<CollectLine>) =>
    setLines(lines.map((l) => (l.key === key ? { ...l, ...change } : l)));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!(total > 0)) return setError("Indica cuánto entregó el cliente.");
    if (left < 0)
      return setError(
        `Los pagos suman ${formatMoney(total)} y solo quedan ${formatMoney(row.pending)} pendientes.`,
      );
    setBusy(true);
    try {
      const result = await post(
        "/sales/" + row.saleId + "/credit-collections",
        {
          operationId,
          ...(session ? { cashSessionId: session.id } : {}),
          lines: lines.map((l) => ({
            method: l.method,
            amount: Number(l.amount),
            ...(l.method === "transfer"
              ? {
                  bank: l.bank,
                  reference: l.reference || undefined,
                  ...(owner ? { ownerConfirmed: true } : {}),
                }
              : l.method === "card"
                ? { reference: l.reference }
                : {}),
          })),
        },
      );
      let proofFailed = "";
      if (proof && result.payments?.[0]) {
        try {
          await uploadProof(result.payments[0].id, proof);
        } catch (err: any) {
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
          result.closed
            ? "Cobro registrado: el crédito quedó cerrado."
            : lines.some((l) => l.method === "transfer") && !owner
              ? "Cobro registrado: la transferencia queda por verificar en el banco."
              : "Cobro registrado. Queda pendiente " +
                formatMoney(result.pending) +
                ".",
        );
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={"Registrar cobro · " + row.number}>
      <form className="form-grid" onSubmit={submit}>
        <p className="cod-hint full">
          Pendiente: <strong>{formatMoney(row.pending)}</strong> de{" "}
          {formatMoney(row.total)}
          {row.customer ? " · " + row.customer.name : ""}. Agrega una línea por
          cada forma de pago (por ejemplo, mitad transferencia y mitad
          efectivo).
        </p>
        {!session && (
          <p className="form-error full" role="note">
            No tienes caja abierta: sin ella no puedes recibir efectivo. Abre tu
            caja o registra solo tarjeta o transferencia.
          </p>
        )}
        {lines.map((l, index) => (
          <fieldset className="collect-line full" key={l.key}>
            <legend>Pago {index + 1}</legend>
            <label className="field">
              <span>Forma de pago</span>
              <select
                value={l.method}
                onChange={(e) =>
                  patch(l.key, { method: e.target.value as any })
                }
              >
                <option value="cash" disabled={!session}>
                  Efectivo
                </option>
                {manager && <option value="card">Tarjeta</option>}
                {manager && <option value="transfer">Transferencia</option>}
              </select>
            </label>
            <label className="field">
              <span>Monto entregado</span>
              <input
                type="number"
                min="0.01"
                max={row.pending}
                step="0.01"
                required
                value={l.amount}
                onChange={(e) => patch(l.key, { amount: e.target.value })}
              />
            </label>
            {l.method === "card" && (
              <label className="field full">
                <span>Referencia del voucher</span>
                <input
                  required
                  value={l.reference}
                  onChange={(e) => patch(l.key, { reference: e.target.value })}
                  placeholder="Número de aprobación o del enlace de pago"
                />
              </label>
            )}
            {l.method === "transfer" && (
              <>
                <label className="field">
                  <span>Banco</span>
                  <input
                    required
                    value={l.bank}
                    onChange={(e) => patch(l.key, { bank: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{owner ? "Referencia (opcional)" : "Referencia"}</span>
                  <input
                    required={!owner}
                    value={l.reference}
                    onChange={(e) =>
                      patch(l.key, { reference: e.target.value })
                    }
                  />
                </label>
              </>
            )}
            {lines.length > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setLines(lines.filter((x) => x.key !== l.key))}
              >
                Quitar este pago
              </Button>
            )}
          </fieldset>
        ))}
        {lines.length < 4 && left > 0 && (
          <Button
            type="button"
            variant="secondary"
            className="full"
            onClick={() => setLines([...lines, newLine(String(left))])}
          >
            Agregar otra forma de pago
          </Button>
        )}
        <p className="cod-hint full" role="status">
          Suma de pagos: <strong>{formatMoney(total)}</strong> · Quedaría
          pendiente: <strong>{formatMoney(Math.max(0, left))}</strong>
        </p>
        <ProofPicker file={proof} onChange={setProof} disabled={busy} />
        <p className="cod-hint full">
          El efectivo entra en el cuadre de tu caja; la tarjeta y la
          transferencia se anotan por método.{" "}
          {owner
            ? "Tu transferencia se da por recibida y cierra el cobro al instante, sin depender de tu caja."
            : "La transferencia queda pendiente hasta verificarla en el banco."}{" "}
          Puedes cobrar una parte ahora y el resto después: el crédito se cierra
          cuando el saldo llega a cero.
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
            {busy ? "Registrando…" : "Guardar cobro"}
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
