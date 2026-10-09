import { useState } from "react";
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
const when = (value: string) =>
  new Date(value).toLocaleString("es-DO", {
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
  const set = (change: Partial<SupplierDocument>) =>
    onChange({ ...value, ...change });
  return (
    <div className="goods-grid">
      <label className="field">
        Número de factura
        <input
          value={value.supplierInvoice ?? ""}
          maxLength={60}
          onChange={(e) => set({ supplierInvoice: e.target.value })}
        />
      </label>
      <label className="field">
        NCF del proveedor
        <input
          value={value.supplierNcf ?? ""}
          maxLength={30}
          placeholder="B0100000123"
          autoCapitalize="characters"
          onChange={(e) => set({ supplierNcf: e.target.value })}
        />
      </label>
      <label className="field">
        Fecha de la factura
        <input
          type="date"
          max={today()}
          value={value.invoiceDate ?? ""}
          onChange={(e) => set({ invoiceDate: e.target.value })}
        />
      </label>
      <label className="field">
        Condición de pago
        <select
          value={value.paymentType ?? ""}
          onChange={(e) =>
            set({
              paymentType: e.target.value as SupplierDocument["paymentType"],
            })
          }
        >
          <option value="">Según el proveedor</option>
          <option value="cash">Contado</option>
          <option value="credit">Crédito</option>
        </select>
      </label>
      {value.paymentType === "credit" && (
        <label className="field">
          Días de crédito
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
        ITBIS de la factura
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
        <small>Para la contable; no cambia el costo.</small>
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
  const [supplierId, setSupplier] = useState(""),
    [lines, setLines] = useState([{ variantId: "", qty: 1, unitCost: 0 }]),
    [doc, setDoc] = useState<SupplierDocument>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const client = useQueryClient();
  return (
    <Modal open onClose={onClose} title="Nueva orden de compra" wide>
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
            toast("Orden de compra creada.");
            onClose();
          } catch (e: any) {
            setError(businessErrorMessage(e));
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Proveedor</span>
          <select
            required
            value={supplierId}
            onChange={(e) => setSupplier(e.target.value)}
          >
            <option value="">Seleccionar…</option>
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
                <span>Producto / variante</span>
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
                  <option value="">Seleccionar…</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {attrLabel(v.attributes)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cantidad</span>
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
                <span>Costo unitario</span>
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
                aria-label="Quitar línea"
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
          Agregar producto
        </Button>
        <details className="panel goods-card" style={{ marginTop: 12 }}>
          <summary>
            Documento del proveedor y condición de pago (opcional)
          </summary>
          <DocumentFields value={doc} onChange={setDoc} />
        </details>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <Button disabled={busy}>Crear orden</Button>
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
  const pending = order.items.filter((i: any) => pendingOf(i) > 0);
  // Un id por recepción, creado al abrir el formulario: si se pierde la
  // respuesta y se pulsa Guardar otra vez, la API devuelve la misma
  // recepción en vez de recibir la mercancía dos veces (R9-facturas-8).
  const [operationId] = useState(() => crypto.randomUUID());
  const fields: Field[] = [
    numberField("freight", "Flete"),
    numberField("otherCosts", "Otros costos"),
    ...pending.flatMap((i: any) => {
      const variant = variants.find((v) => v.id === i.variantId);
      const name = variant?.name || i.variantId;
      return [
        {
          ...numberField(
            "qty_" + i.id,
            name + " · Unidades buenas",
            pendingOf(i),
          ),
          step: "0.001",
          help: `Pedido ${Number(i.qty)} · recibido ${Number(i.receivedQty)} · dañado ${Number(i.damagedQty ?? 0)} · pendiente ${pendingOf(i)}`,
        },
        {
          ...numberField("damaged_" + i.id, "Dañadas o rechazadas"),
          step: "0.001",
          help: "No entran al stock; cierran lo pendiente.",
        },
        {
          key: "reason_" + i.id,
          label: "Motivo del daño o rechazo",
          type: "select" as const,
          options: DAMAGE_REASONS.map((r) => ({ label: r, value: r })),
        },
        { key: "lot_" + i.id, label: "Número de lote" },
        { key: "expiry_" + i.id, label: "Vencimiento", type: "date" as const },
      ];
    }),
    { key: "supplierInvoice", label: "Número de factura" },
    { key: "supplierNcf", label: "NCF del proveedor" },
    { key: "invoiceDate", label: "Fecha de la factura", type: "date" },
    {
      key: "paymentType",
      label: "Condición de pago",
      type: "select",
      options: [
        { label: "Contado", value: "cash" },
        { label: "Crédito", value: "credit" },
      ],
      help: "Vacío: la de la orden o el plazo del proveedor.",
    },
    numberField("creditDays", "Días de crédito"),
    {
      ...numberField("itbis", "ITBIS de la factura"),
      help: "Para la contable.",
    },
  ];
  return (
    <FormModal
      title={"Recibir mercancía · " + order.number}
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

const documentLabel = (r: any) =>
  [r.orderNumber, r.supplierInvoice && "Factura " + r.supplierInvoice]
    .concat(r.supplierNcf ? ["NCF " + r.supplierNcf] : [])
    .filter(Boolean)
    .join(" · ") +
  (r.supplierInvoice || r.supplierNcf
    ? ""
    : (r.orderNumber ? " · " : "") + "Sin documento");

/**
 * Historial de recepciones (paso 37) en Compras y en Mercancía (celular):
 * proveedor, documento, fecha, quién recibió, líneas y dañados. `compact`
 * muestra las últimas sin filtro de período.
 */
export function ReceiptHistory({ compact = false }: { compact?: boolean }) {
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
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="field">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {canExport && (
            <div className="field">
              <span>Por fecha de la factura (o de recepción si falta)</span>
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
                <FileSpreadsheet size={16} aria-hidden="true" /> Excel para la
                contable
              </Button>
            </div>
          )}
        </div>
      )}
      {!online ? (
        <p className="modal-intro">El historial necesita conexión.</p>
      ) : query.isLoading ? (
        <p className="modal-intro">Cargando recepciones…</p>
      ) : !rows.length ? (
        <p className="modal-intro">Todavía no hay recepciones.</p>
      ) : (
        <ul className="goods-history">
          {shown.map((r) => (
            <li key={r.id}>
              <span>
                <strong>
                  {when(r.createdAt)} · {r.supplierName ?? "Sin proveedor"}
                </strong>
                <small style={{ display: "block" }}>{documentLabel(r)}</small>
                <small style={{ display: "block" }}>
                  {r.units} {r.units === 1 ? "unidad buena" : "unidades buenas"}
                  {r.damagedUnits > 0 &&
                    " · " +
                      r.damagedUnits +
                      (r.damagedUnits === 1 ? " dañada" : " dañadas")}{" "}
                  · {plural(r.lines.length, "línea")} · Recibió{" "}
                  {r.userName ?? "—"}
                  {seesCost ? " · " + formatMoney(r.total) : ""}
                </small>
              </span>
              <Button variant="secondary" onClick={() => setOpen(r.id)}>
                Ver
              </Button>
            </li>
          ))}
        </ul>
      )}
      {compact && rows.length > shown.length && (
        <Button variant="ghost" onClick={() => setAll(true)}>
          Ver las {rows.length} recepciones
        </Button>
      )}
      {open && <ReceiptDetail id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

// Comprobante de una recepción: se imprime y se completa su documento.
function ReceiptDetail({ id, onClose }: { id: string; onClose: () => void }) {
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
      toast("Documento guardado.");
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
    <Modal open title="Comprobante de recepción" onClose={onClose} wide>
      {!r ? (
        <p className="modal-intro">
          {query.error ? managementQueryError(query.error) : "Cargando…"}
        </p>
      ) : (
        <>
          <div className="receipt-only-on-print">
            <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>
              Recepción de mercancía · {when(r.createdAt)}
            </h2>
            <div className="goods-grid">
              {fact(
                "Proveedor",
                r.supplierName
                  ? r.supplierName +
                      (r.supplierLegalId ? " · RNC " + r.supplierLegalId : "")
                  : null,
              )}
              {fact("Orden de compra", r.orderNumber)}
              {fact("Factura del proveedor", r.supplierInvoice)}
              {fact("NCF", r.supplierNcf)}
              {fact(
                "Fecha de la factura",
                r.invoiceDate ? dateLabel(r.invoiceDate) : null,
              )}
              {fact("Condición de pago", paymentLabel(r))}
              {fact("Recibió", r.userName)}
              {r.itbis != null && fact("ITBIS facturado", formatMoney(r.itbis))}
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
                      {l.sku ? l.sku + " · " : ""}Recibido bueno {l.qty}
                      {l.lotNumber ? " · Lote " + l.lotNumber : ""}
                      {l.expiryDate
                        ? " · vence " + dateLabel(l.expiryDate)
                        : ""}
                      {seesCost && l.unitCost !== undefined
                        ? " · " + formatMoney(l.unitCost) + " c/u"
                        : ""}
                    </small>
                    {l.damagedQty > 0 && (
                      <small style={{ display: "block" }}>
                        <Badge tone="warning">
                          Dañado o rechazado {l.damagedQty} · {l.damageReason}
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
                Mercancía {formatMoney(r.goods)} · Flete{" "}
                {formatMoney(r.freight)} · Otros {formatMoney(r.otherCosts)} ·{" "}
                <strong>Total {formatMoney(r.total)}</strong>
                {r.damagedCost > 0 &&
                  " · Dañado o rechazado (aparte) " +
                    formatMoney(r.damagedCost)}
              </p>
            )}
          </div>
          <div className="goods-row-actions" style={{ flexWrap: "wrap" }}>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" /> Imprimir
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
                <Download size={16} aria-hidden="true" /> Factura original
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
                Completar documento
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
                  Cancelar
                </Button>
                <Button disabled={busy}>
                  {busy ? "Guardando…" : "Guardar documento"}
                </Button>
              </div>
            </form>
          )}
        </>
      )}
    </Modal>
  );
}
