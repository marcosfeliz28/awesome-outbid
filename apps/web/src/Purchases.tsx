import { useState } from "react";
import { purchaseEditorText } from "./purchaseEditorLanguage";
import { useLanguage } from "./inicioLanguage";
import { receiptDocumentLabel } from "./receiptDocumentLanguage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileSpreadsheet, Plus, Printer, Trash2 } from "lucide-react";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, download, post, useStore } from "./api";
import {
  businessErrorMessage,
  managementQueryError,
} from "./managementMessages";
import {
  FormModal,
  attrLabel,
  dateLabel,
  toast,
  today,
  type Field,
} from "./helpers";

// Documento del proveedor y condición de pago (paso 35): todo opcional.
export type SupplierDocument = {
  supplierInvoice?: string;
  supplierNcf?: string;
  invoiceDate?: string;
  paymentType?: "" | "cash" | "credit";
  creditDays?: number | "";
  itbis?: number | "";
};
// Motivos de las unidades dañadas o rechazadas al recibir (paso 36).
export const DAMAGE_REASONS = [
  "Dañado",
  "Vencido o por vencer",
  "Producto equivocado",
  "Rechazado por calidad",
];
const when = (value: string, english = false) =>
  new Date(value).toLocaleString(english ? "en-US" : "es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const plural = (n: number, word: string) =>
  n + " " + word + (n === 1 ? "" : "s");
export const paymentLabel = (r: {
  paymentType?: string | null;
  creditDays?: number | null;
}) =>
  r.paymentType === "cash"
    ? "Contado"
    : r.paymentType === "credit"
      ? "Crédito" + (r.creditDays ? " " + r.creditDays + " días" : "")
      : "Sin indicar";

/**
 * Cuerpo para la API. En una alta se omite lo vacío; al completar después
 * (`clear`), lo vacío se envía como null para borrar el dato.
 */
export function documentPayload(doc: SupplierDocument, clear = false) {
  const out: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value === "" || value === undefined) {
      if (clear) out[key] = null;
    } else out[key] = value;
  };
  put("supplierInvoice", doc.supplierInvoice?.trim());
  put("supplierNcf", doc.supplierNcf?.trim());
  put("invoiceDate", doc.invoiceDate);
  put("paymentType", doc.paymentType);
  put(
    "creditDays",
    doc.paymentType === "credit" && Number(doc.creditDays) > 0
      ? Number(doc.creditDays)
      : undefined,
  );
  put("itbis", Number(doc.itbis) > 0 ? Number(doc.itbis) : undefined);
  return out;
}

export function DocumentFields({
  value,
  onChange,
}: {
  value: SupplierDocument;
  onChange: (value: SupplierDocument) => void;
}) {
  const english = useLanguage() === "en";
  const t = (text: string) => receiptDocumentLabel(text, english);
  const set = (change: Partial<SupplierDocument>) =>
    onChange({ ...value, ...change });
  return (
    <div className="goods-grid">
      <label className="field">
        {t("Número de factura")}
        <input
          value={value.supplierInvoice ?? ""}
          maxLength={60}
          onChange={(e) => set({ supplierInvoice: e.target.value })}
        />
      </label>
      <label className="field">
        {t("NCF del proveedor")}
        <input
          value={value.supplierNcf ?? ""}
          maxLength={30}
          placeholder="B0100000123"
          autoCapitalize="characters"
          onChange={(e) => set({ supplierNcf: e.target.value })}
        />
      </label>
      <label className="field">
        {t("Fecha de la factura")}
        <input
          type="date"
          max={today()}
          value={value.invoiceDate ?? ""}
          onChange={(e) => set({ invoiceDate: e.target.value })}
        />
      </label>
      <label className="field">
        {t("Condición de pago")}
        <select
          value={value.paymentType ?? ""}
          onChange={(e) =>
            set({
              paymentType: e.target.value as SupplierDocument["paymentType"],
            })
          }
        >
          <option value="">{t("Según el proveedor")}</option>
          <option value="cash">{t("Contado")}</option>
          <option value="credit">{t("Crédito")}</option>
        </select>
      </label>
      {value.paymentType === "credit" && (
        <label className="field">
          {t("Días de crédito")}
          <input
            type="number"
            min="1"
            max="365"
            step="1"
            inputMode="numeric"
            value={value.creditDays ?? ""}
            onChange={(e) =>
              set({
                creditDays: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
          />
        </label>
      )}
      <label className="field">
        {t("ITBIS de la factura")}
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          value={value.itbis ?? ""}
          onChange={(e) =>
            set({ itbis: e.target.value === "" ? "" : Number(e.target.value) })
          }
        />
        <small>{t("Para la contable; no cambia el costo.")}</small>
      </label>
    </div>
  );
}

const pendingOf = (i: any) =>
  Number(i.qty) - Number(i.receivedQty) - Number(i.damagedQty ?? 0);
const numberField = (key: string, label: string, initial = 0): Field => ({
  key,
  label,
  type: "number",
  min: 0,
  initial,
});

export function PurchaseEditor({
  suppliers,
  variants,
  onClose,
}: {
  suppliers: any[];
  variants: any[];
  onClose: () => void;
}) {
  const english = useLanguage() === "en";
  const et = (text: string) => purchaseEditorText(english, text);
  const [supplierId, setSupplier] = useState(""),
    [lines, setLines] = useState([{ variantId: "", qty: 1, unitCost: 0 }]),
    [doc, setDoc] = useState<SupplierDocument>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const client = useQueryClient();
  return (
    <Modal open onClose={onClose} title={et("Nueva orden de compra")} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await post("/purchase-orders", {
              supplierId,
              items: lines,
              ...documentPayload(doc),
            });
            await client.invalidateQueries();
            toast(et("Orden de compra creada."));
            onClose();
          } catch (e: any) {
            setError(businessErrorMessage(e));
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>{et("Proveedor")}</span>
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">{et("Seleccionar…")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="purchase-lines">
          {lines.map((line, index) => (
            <div key={index}>
              <label className="field">
                <span>{et("Producto / variante")}</span>
                <select
                  required
                  value={line.variantId}
                  onChange={(e) => {
                    const v = variants.find((v) => v.id === e.target.value);
                    setLines(
                      lines.map((l, i) =>
                        i === index
                          ? {
                              ...l,
                              variantId: e.target.value,
                              unitCost: Number(v?.costAvg || 0),
                            }
                          : l,
                      ),
                    );
                  }}
                >
                  <option value="">{et("Seleccionar…")}</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {attrLabel(v.attributes, english ? "Single" : "Única")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>{et("Cantidad")}</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={line.qty}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, i) =>
                        i === index ? { ...l, qty: Number(e.target.value) } : l,
                      ),
                    )
                  }
                />
              </label>
              <label className="field">
                <span>{et("Costo unitario")}</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={line.unitCost}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, i) =>
                        i === index
                          ? { ...l, unitCost: Number(e.target.value) }
                          : l,
                      ),
                    )
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button"
                aria-label={et("Quitar línea")}
                disabled={lines.length === 1}
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setLines([...lines, { variantId: "", qty: 1, unitCost: 0 }])
          }
        >
          <Plus size={16} />
          {et("Agregar producto")}
        </Button>
        <details className="panel goods-card" style={{ marginTop: 12 }}>
          <summary>
            {et("Documento del proveedor y condición de pago (opcional)")}
          </summary>
          <DocumentFields value={doc} onChange={setDoc} />
        </details>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <Button disabled={busy}>{et("Crear orden")}</Button>
        </div>
      </form>
    </Modal>
  );
}

// Recibir una orden: unidades buenas, dañadas o rechazadas con su motivo,
// lote y vencimiento, y el documento del proveedor (opcional).
export function ReceiptEditor({
  order,
  variants,
  onClose,
}: {
  order: any;
  variants: any[];
  onClose: () => void;
}) {
  const english = useLanguage() === "en";
  const et = (text: string) => purchaseEditorText(english, text);
  const pending = order.items.filter((i: any) => pendingOf(i) > 0);
  // Un id por recepción, creado al abrir el formulario: si se pierde la
  // respuesta y se pulsa Guardar otra vez, la API devuelve la misma
  // recepción en vez de recibir la mercancía dos veces (R9-facturas-8).
  const [operationId] = useState(() => crypto.randomUUID());
  const fields: Field[] = [
    numberField("freight", et("Flete")),
    numberField("otherCosts", et("Otros costos")),
    ...pending.flatMap((i: any) => {
      const variant = variants.find((v) => v.id === i.variantId);
      const name = variant?.name || i.variantId;
      return [
        {
          ...numberField(
            "qty_" + i.id,
            name + et(" · Unidades buenas"),
            pendingOf(i),
          ),
          step: "0.001",
          help: english
            ? `Ordered ${Number(i.qty)} · received ${Number(i.receivedQty)} · damaged ${Number(i.damagedQty ?? 0)} · pending ${pendingOf(i)}`
            : `Pedido ${Number(i.qty)} · recibido ${Number(i.receivedQty)} · dañado ${Number(i.damagedQty ?? 0)} · pendiente ${pendingOf(i)}`,
        },
        {
          ...numberField("damaged_" + i.id, et("Dañadas o rechazadas")),
          step: "0.001",
          help: et("No entran al stock; cierran lo pendiente."),
        },
        {
          key: "reason_" + i.id,
          label: et("Motivo del daño o rechazo"),
          type: "select" as const,
          options: DAMAGE_REASONS.map((r) => ({ label: et(r), value: r })),
        },
        { key: "lot_" + i.id, label: et("Número de lote") },
        { key: "expiry_" + i.id, label: et("Vencimiento"), type: "date" as const },
      ];
    }),
    { key: "supplierInvoice", label: et("Número de factura") },
    { key: "supplierNcf", label: et("NCF del proveedor") },
    { key: "invoiceDate", label: et("Fecha de la factura"), type: "date" },
    {
      key: "paymentType",
      label: et("Condición de pago"),
      type: "select",
      options: [
        { label: et("Contado"), value: "cash" },
        { label: et("Crédito"), value: "credit" },
      ],
      help: et("Vacío: la de la orden o el plazo del proveedor."),
    },
    numberField("creditDays", et("Días de crédito")),
    {
      ...numberField("itbis", et("ITBIS de la factura")),
      help: et("Para la contable."),
    },
  ];
  return (
    <FormModal
      english={english}
      title={et("Recibir mercancía · ") + order.number}
      fields={fields}
      onClose={onClose}
      onSubmit={(data) =>
        post("/purchase-orders/" + order.id + "/receive", {
          operationId,
          freight: data.freight,
          otherCosts: data.otherCosts,
          ...documentPayload(data),
          items: pending
            .filter(
              (i: any) =>
                data["qty_" + i.id] > 0 || data["damaged_" + i.id] > 0,
            )
            .map((i: any) => ({
              itemId: i.id,
              qty: data["qty_" + i.id],
              damagedQty: data["damaged_" + i.id],
              damageReason: data["reason_" + i.id] || undefined,
              lotNumber:
                data["qty_" + i.id] > 0
                  ? data["lot_" + i.id] || undefined
                  : undefined,
              expiryDate:
                data["qty_" + i.id] > 0 && data["expiry_" + i.id]
                  ? new Date(
                      data["expiry_" + i.id] + "T23:59:59-04:00",
                    ).toISOString()
                  : undefined,
            })),
        })
      }
    />
  );
}

const documentLabel = (r: any, english = false) =>
  [r.orderNumber, r.supplierInvoice && (english ? "Invoice " : "Factura ") + r.supplierInvoice]
    .concat(r.supplierNcf ? ["NCF " + r.supplierNcf] : [])
    .filter(Boolean)
    .join(" · ") +
  (r.supplierInvoice || r.supplierNcf
    ? ""
    : (r.orderNumber ? " · " : "") + (english ? "No document" : "Sin documento"));

/**
 * Historial de recepciones (paso 37) en Compras y en Mercancía (celular):
 * proveedor, documento, fecha, quién recibió, líneas y dañados. `compact`
 * muestra las últimas sin filtro de período.
 */
export function ReceiptHistory({ compact = false }: { compact?: boolean }) {
  const english = useLanguage() === "en";
  const { user, online } = useStore();
  const seesCost = can(user!.permissions, "profit:read");
  const canExport = can(user!.permissions, "reports:read");
  const [from, setFrom] = useState(compact ? "" : today().slice(0, 8) + "01"),
    [to, setTo] = useState(compact ? "" : today()),
    [all, setAll] = useState(false),
    [open, setOpen] = useState<string | null>(null);
  const period =
    from || to ? "?from=" + (from || to) + "&to=" + (to || today()) : "";
  const query = useQuery({
    queryKey: ["goods-receipts", period],
    queryFn: () => api<any[]>("/goods-receipts" + period),
    enabled: online,
  });
  const rows = query.data ?? [];
  const shown = compact && !all ? rows.slice(0, 8) : rows;
  return (
    <div className="receipt-history">
      {!compact && (
        <div className="goods-grid">
          <label className="field">
            {english ? "From" : "Desde"}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            {english ? "To" : "Hasta"}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {canExport && (
            <div className="field">
              <span>{english ? "By invoice date (or receipt date if unavailable)" : "Por fecha de la factura (o de recepción si falta)"}</span>
              <Button
                variant="secondary"
                onClick={() =>
                  download(
                    "/goods-receipts/export" + (period || "?to=" + today()),
                    "compras-" +
                      (from || to || "inicio") +
                      "-" +
                      (to || today()) +
                      ".xlsx",
                  ).catch((e) => toast(businessErrorMessage(e), true))
                }
              >
                <FileSpreadsheet size={16} aria-hidden="true" /> {english ? "Excel for the accountant" : "Excel para la contable"}
              </Button>
            </div>
          )}
        </div>
      )}
      {!online ? (
        <p className="modal-intro">{english ? "History requires a connection." : "El historial necesita conexión."}</p>
      ) : query.isLoading ? (
        <p className="modal-intro">{english ? "Loading receipts…" : "Cargando recepciones…"}</p>
      ) : !rows.length ? (
        <p className="modal-intro">{english ? "No receipts yet." : "Todavía no hay recepciones."}</p>
      ) : (
        <ul className="goods-history">
          {shown.map((r) => (
            <li key={r.id}>
              <span>
                <strong>
                  {when(r.createdAt, english)} · {r.supplierName ?? (english ? "No supplier" : "Sin proveedor")}
                </strong>
                <small style={{ display: "block" }}>{documentLabel(r, english)}</small>
                <small style={{ display: "block" }}>
                  {r.units} {english ? (r.units === 1 ? "good unit" : "good units") : (r.units === 1 ? "unidad buena" : "unidades buenas")}
                  {r.damagedUnits > 0 &&
                    " · " +
                      r.damagedUnits +
                      (english ? " damaged" : (r.damagedUnits === 1 ? " dañada" : " dañadas"))}{" "}
                  · {plural(r.lines.length, english ? "line" : "línea")} · {english ? "Received by" : "Recibió"}{" "}
                  {r.userName ?? "—"}
                  {seesCost ? " · " + formatMoney(r.total) : ""}
                </small>
              </span>
              <Button variant="secondary" onClick={() => setOpen(r.id)}>
                {english ? "View" : "Ver"}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {compact && rows.length > shown.length && (
        <Button variant="ghost" onClick={() => setAll(true)}>
          {english ? `View all ${rows.length} receipts` : `Ver las ${rows.length} recepciones`}
        </Button>
      )}
      {open && <ReceiptDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Comprobante de una recepción: se imprime y se completa su documento.
function ReceiptDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const english = useLanguage() === "en";
  const t = (text: string) => receiptDocumentLabel(text, english);
  const user = useStore((s) => s.user)!;
  const seesCost = can(user.permissions, "profit:read");
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["goods-receipt", id],
    queryFn: () => api("/goods-receipts/" + id),
  });
  const [doc, setDoc] = useState<SupplierDocument | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const r = query.data;
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const saved = await api("/goods-receipts/" + id + "/document", {
        method: "PATCH",
        body: JSON.stringify(documentPayload(doc!, true)),
      });
      client.setQueryData(["goods-receipt", id], saved);
      await client.invalidateQueries({ queryKey: ["goods-receipts"] });
      setDoc(null);
      toast(t("Documento guardado."));
    } catch (e: any) {
      setError(businessErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const fact = (label: string, value: string | null | undefined) => (
    <p style={{ margin: "0 0 8px" }}>
      <small style={{ display: "block", color: "var(--muted)" }}>{label}</small>
      <strong>{value || "—"}</strong>
    </p>
  );
  return (
    <Modal open title={t("Comprobante de recepción")} closeLabel={t("Cerrar")} onClose={onClose} wide>
      {!r ? (
        <p className="modal-intro">
          {query.error ? managementQueryError(query.error) : t("Cargando…")}
        </p>
      ) : (
        <>
          <div className="receipt-only-on-print">
            <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>
              {t("Recepción de mercancía")} · {when(r.createdAt, english)}
            </h2>
            <div className="goods-grid">
              {fact(
                t("Proveedor"),
                r.supplierName
                  ? r.supplierName +
                      (r.supplierLegalId ? " · RNC " + r.supplierLegalId : "")
                  : null,
              )}
              {fact(t("Orden de compra"), r.orderNumber)}
              {fact(t("Factura del proveedor"), r.supplierInvoice)}
              {fact("NCF", r.supplierNcf)}
              {fact(
                t("Fecha de la factura"),
                r.invoiceDate ? dateLabel(r.invoiceDate, english ? "en-US" : "es-DO") : null,
              )}
              {fact(t("Condición de pago"), (english ? (r.paymentType === "cash" ? t("Contado") : r.paymentType === "credit" ? t("Crédito") + (r.creditDays ? " " + r.creditDays + " " + t("días") : "") : t("Sin indicar")) : paymentLabel(r)))}
              {fact(t("Recibió"), r.userName)}
              {r.itbis != null && fact(t("ITBIS facturado"), formatMoney(r.itbis))}
            </div>
            <ul className="goods-history">
              {r.lines.map((l: any, index: number) => (
                <li key={index}>
                  <span>
                    <strong>
                      {l.name}
                      {attrLabel(l.attributes ?? {}) !== "Única"
                        ? " · " + attrLabel(l.attributes ?? {})
                        : ""}
                    </strong>
                    <small style={{ display: "block" }}>
                      {l.sku ? l.sku + " · " : ""}{t("Recibido bueno")} {l.qty}
                      {l.lotNumber ? " · " + t("Lote") + " " + l.lotNumber : ""}
                      {l.expiryDate
                        ? " · " + t("vence") + " " + dateLabel(l.expiryDate, english ? "en-US" : "es-DO")
                        : ""}
                      {seesCost && l.unitCost !== undefined
                        ? " · " + formatMoney(l.unitCost) + " " + t("c/u")
                        : ""}
                    </small>
                    {l.damagedQty > 0 && (
                      <small style={{ display: "block" }}>
                        <Badge tone="warning">
                          {t("Dañado o rechazado")} {l.damagedQty} · {l.damageReason}
                        </Badge>
                        {seesCost && l.damagedCost
                          ? " " + formatMoney(l.damagedCost)
                          : ""}
                      </small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {seesCost && (
              <p className="goods-cost-note" style={{ marginTop: 8 }}>
                {t("Mercancía")} {formatMoney(r.goods)} · {t("Flete")}{" "}
                {formatMoney(r.freight)} · {t("Otros")} {formatMoney(r.otherCosts)} ·{" "}
                <strong>Total {formatMoney(r.total)}</strong>
                {r.damagedCost > 0 &&
                  " · " + t("Dañado o rechazado (aparte)") + " " +
                    formatMoney(r.damagedCost)}
              </p>
            )}
          </div>
          <div className="goods-row-actions" style={{ flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> {t("Imprimir")}
            </Button>
            {r.attachmentId && (
              <Button
                variant="secondary"
                onClick={() =>
                  download(
                    "/merchandise/attachments/" + r.attachmentId,
                    "factura-proveedor",
                  ).catch((e) => toast(businessErrorMessage(e), true))
                }
              >
                <Download size={16} aria-hidden="true" /> {t("Factura original")}
              </Button>
            )}
            {!doc && (
              <Button
                variant="secondary"
                onClick={() =>
                  setDoc({
                    supplierInvoice: r.supplierInvoice ?? "",
                    supplierNcf: r.supplierNcf ?? "",
                    invoiceDate: r.invoiceDate?.slice(0, 10) ?? "",
                    paymentType: r.paymentType ?? "",
                    creditDays: r.creditDays ?? "",
                    itbis: r.itbis ?? "",
                  })
                }
              >
                {t("Completar documento")}
              </Button>
            )}
          </div>
          {doc && (
            <form
              style={{ marginTop: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <DocumentFields value={doc} onChange={setDoc} />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="goods-row-actions">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDoc(null)}
                >
                  {t("Cancelar")}
                </Button>
                <Button disabled={busy}>
                  {busy ? t("Guardando…") : t("Guardar documento")}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
