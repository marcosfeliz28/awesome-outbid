import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Minus,
  PackageMinus,
  PackagePlus,
  Plus,
  Printer,
  ScanBarcode,
  Search,
  Trash2,
} from "lucide-react";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import {
  api,
  download,
  loadCatalog,
  localDB,
  post,
  syncMerchandise,
  useStore,
  type Product,
  type Variant,
} from "./api";
import { FormModal, attrLabel, toast } from "./helpers";
import { registerTerminal } from "./realtime";
import { Barcode } from "./Management";
import {
  DAMAGE_REASONS,
  DocumentFields,
  ReceiptHistory,
  documentPayload,
  type SupplierDocument,
} from "./Purchases";

type GoodsLine = {
  variantId?: string;
  name: string;
  qty: number;
  unitCost?: number;
  lotId?: string;
  lotNumber?: string;
  expiryDate?: string;
  supplierCode?: string;
  itemId?: string;
  confidence?: number;
  productId?: string;
  note?: string;
  quick?: any;
  // Dañadas o rechazadas al recibir: no entran al stock (paso 36).
  damagedQty?: number;
  damageReason?: string;
  showDamage?: boolean;
  // Línea de la orden: pedido, ya recibido bueno y ya dañado.
  ordered?: { qty: number; received: number; damaged: number };
};
// `stock` es lo vendible; lo de lotes vencidos llega aparte (paso 04).
type CatalogVariant = Variant & { product: Product; expiredStock?: string };
const expiredNote = (v: CatalogVariant) =>
  Number(v.expiredStock) > 0 ? " · vencido: " + Number(v.expiredStock) : "";

// Valores que acepta el servidor y su nombre para el usuario.
const EXIT_REASONS = [
  ["merma", "Merma"],
  ["dañado", "Dañado"],
  ["vencido", "Vencido"],
  ["muestra", "Muestra o probador"],
  ["uso interno", "Uso interno"],
  ["devolución a proveedor", "Devolución a proveedor"],
] as const;
const reasonLabel = (value: string) =>
  EXIT_REASONS.find(([v]) => v === value)?.[1] ?? value;
const when = (value: string | number) =>
  new Date(value).toLocaleString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const variantName = (v: CatalogVariant) => {
  const attrs = attrLabel(v.attributes ?? {});
  return attrs === "Única" ? v.product.name : v.product.name + " · " + attrs;
};
// Misma regla que la caja (R9-codigos-2): el código se compara sin distinguir
// mayúsculas, en el código de barras y en el SKU. La etiqueta impresa (Code 39)
// sale en MAYÚSCULAS aunque el código se guardara en minúsculas, y un código
// de dos productos no elige ninguno en silencio.
function findByCode(variants: CatalogVariant[], code: string) {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  const hits = variants.filter(
    (v) => v.barcode?.toLowerCase() === c || v.sku?.toLowerCase() === c,
  );
  const distinct = new Set(hits.map((v) => v.id)).size;
  if (distinct > 1) return { ambiguous: distinct } as const;
  return hits[0] ? ({ variant: hits[0] } as const) : undefined;
}

function ContinuousScanner({
  onCode,
  onClose,
}: {
  onCode: (s: string) => void;
  onClose: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    callback = useRef(onCode);
  callback.current = onCode;
  const [error, setError] = useState(""),
    [count, setCount] = useState(0);
  useEffect(() => {
    let stopped = false;
    let control: { stop: () => void } | undefined;
    let last = "",
      at = 0;
    void (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        if (stopped) return;
        control = await new BrowserMultiFormatReader().decodeFromVideoDevice(
          undefined,
          video.current!,
          (result) => {
            if (!result || stopped) return;
            const code = result.getText();
            if (code === last && Date.now() - at < 1200) return;
            last = code;
            at = Date.now();
            callback.current(code);
            setCount((c) => c + 1);
            navigator.vibrate?.(50);
          },
        );
        if (stopped) control.stop();
      } catch (e: any) {
        setError(
          "No se pudo usar la cámara. Usa el lector o escribe el código. " +
            e.message,
        );
      }
    })();
    return () => {
      stopped = true;
      control?.stop();
    };
  }, []);
  return (
    <Modal open title="Escaneo continuo" onClose={onClose}>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : (
        <video ref={video} muted playsInline className="scanner-video" />
      )}
      <p className="modal-intro">
        Cada lectura suma una unidad ({count} leídas). El mismo código se cuenta
        como máximo una vez cada 1,2 segundos.
      </p>
      <Button onClick={onClose}>Listo</Button>
    </Modal>
  );
}

// Buscador por nombre, SKU, código o atributo (sabor, talla, color…).
function ProductSearch({
  variants,
  onPick,
  label = "Buscar producto",
  only,
  autoFocus = false,
  initialText = "",
}: {
  variants: CatalogVariant[];
  onPick: (v: CatalogVariant) => void;
  label?: string;
  only?: string;
  autoFocus?: boolean;
  initialText?: string;
}) {
  const [text, setText] = useState(initialText);
  const pool = only ? variants.filter((v) => v.product.id === only) : variants;
  const results = useMemo(() => {
    const words = fold(text).split(/\s+/).filter(Boolean);
    if (!words.length) return only ? pool.slice(0, 12) : [];
    return pool
      .filter((v) => {
        const hay = fold(
          [
            v.product.name,
            v.sku,
            v.barcode,
            attrLabel(v.attributes ?? {}),
          ].join(" "),
        );
        return words.every((w) => hay.includes(w));
      })
      .slice(0, 8);
  }, [text, pool, only]);
  return (
    <div className="goods-search">
      <label className="field">
        {label}
        <span className="goods-search-input">
          <Search size={16} aria-hidden="true" />
          <input
            value={text}
            autoFocus={autoFocus}
            placeholder="Nombre, SKU, sabor, talla o color"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) {
                e.preventDefault();
                onPick(results[0]);
                setText("");
              }
            }}
          />
        </span>
      </label>
      {results.length > 0 && (
        // G12: lista de resultados con botones (no es un listbox navegable
        // con flechas: Enter toma el primero).
        <ul className="goods-results" aria-label={"Resultados: " + label}>
          {results.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(v);
                  setText("");
                }}
              >
                <span>
                  <strong>{v.product.name}</strong>
                  <small>
                    {attrLabel(v.attributes ?? {})} · {v.sku}
                  </small>
                </span>
                <Badge tone={Number(v.stock) > 0 ? "neutral" : "warning"}>
                  {Number(v.stock)} en stock
                </Badge>
                {Number(v.expiredStock) > 0 && (
                  <Badge tone="warning">
                    vencido: {Number(v.expiredStock)}
                  </Badge>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function cachedReference(key: string, path: string) {
  const user = useStore.getState().user!;
  const cacheKey = "goods:" + user.branchId + ":" + key;
  if (navigator.onLine) {
    const data = await api(path);
    await localDB.cache.put({ key: cacheKey, data });
    return data;
  }
  return (await localDB.cache.get(cacheKey))?.data ?? [];
}

export function Merchandise() {
  const { user, online } = useStore();
  const client = useQueryClient();
  const seesCost = can(user!.permissions, "profit:read");
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const variants: CatalogVariant[] = useMemo(
    () =>
      (catalog.data ?? []).flatMap((p) =>
        p.variants.map((v) => ({ ...v, product: p })),
      ),
    [catalog.data],
  );
  const categories = useQuery({
    queryKey: ["goods-categories"],
    queryFn: () => cachedReference("categories", "/categories"),
  });
  const suppliers = useQuery({
    queryKey: ["goods-suppliers"],
    queryFn: () => cachedReference("suppliers", "/suppliers"),
  });
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<any[]>("/purchase-orders"),
    enabled: online,
  });
  const history = useQuery({
    queryKey: ["goods-history"],
    queryFn: () => api<any[]>("/merchandise/operations"),
    enabled: online,
  });
  const options = useQuery({
    queryKey: ["goods-options"],
    queryFn: () => api("/merchandise/options"),
    enabled: online,
  });
  const [direction, setDirection] = useState<"entry" | "exit">("entry"),
    [items, setItems] = useState<GoodsLine[]>([]),
    [supplierId, setSupplier] = useState(""),
    [orderId, setOrder] = useState(""),
    [reason, setReason] = useState("merma"),
    [code, setCode] = useState(""),
    [camera, setCamera] = useState(false),
    [unknown, setUnknown] = useState<string | null>(null),
    // Texto del buscador tras un código ambiguo; `key` lo reinicia.
    [lookup, setLookup] = useState({ text: "", key: 0 }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState(""),
    [draft, setDraft] = useState<any>(null),
    [result, setResult] = useState<any>(null),
    [labels, setLabels] = useState(false),
    [freight, setFreight] = useState(0),
    [taxes, setTaxes] = useState(0),
    [total, setTotal] = useState(""),
    [mismatchAccepted, setMismatchAccepted] = useState(false),
    [doc, setDoc] = useState<SupplierDocument>({}),
    [queue, setQueue] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null),
    [mapping, setMapping] = useState<Record<string, string>>({
      code: "codigo",
      description: "descripcion",
      qty: "cantidad",
      unitCost: "costo",
    });
  const operationId = useRef(crypto.randomUUID());
  useEffect(() => {
    let stopped = false;
    const read = async () => {
      const rows = await localDB.merchandise
        .where("userId")
        .equals(user!.id)
        .toArray();
      if (!stopped) setQueue(rows);
    };
    void read();
    const timer = setInterval(read, 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [user?.id]);
  useEffect(() => {
    if (!supplierId || !online) return;
    let active = true;
    api("/merchandise/profiles/" + supplierId)
      .then((p) => {
        if (active && p?.mapping) setMapping(p.mapping);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [supplierId, online]);
  const patch = (index: number, change: Partial<GoodsLine>) =>
    setItems((old) =>
      old.map((l, i) => (i === index ? { ...l, ...change } : l)),
    );
  // Quien no ve costos debe escribirlo: nunca se inventa un costo.
  const knownCost = (v: CatalogVariant) =>
    v.costAvg !== undefined && Number(v.costAvg) > 0
      ? Number(v.costAvg)
      : undefined;
  const add = (v: CatalogVariant) => {
    setResult(null);
    setItems((old) => {
      const at = old.findIndex(
        (l) => l.variantId === v.id && !l.lotId && !l.lotNumber,
      );
      return at < 0
        ? [
            ...old,
            {
              variantId: v.id,
              name: variantName(v),
              qty: 1,
              unitCost: direction === "entry" ? knownCost(v) : undefined,
            },
          ]
        : old.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l));
    });
    navigator.vibrate?.(50);
  };
  const scan = (value: string) => {
    const found = findByCode(variants, value);
    if (found && "ambiguous" in found) {
      // No se agrega ninguno ni se ofrece crear otro: los productos quedan en
      // el buscador para elegir el correcto (R9-codigos-2).
      setCamera(false);
      setLookup((old) => ({ text: value.trim(), key: old.key + 1 }));
      setError(
        "El código " +
          value.trim() +
          " es de " +
          found.ambiguous +
          " productos. Elige el producto en el buscador y corrige el código en Productos.",
      );
      return;
    }
    if (!found) {
      setCamera(false);
      if (direction === "entry") setUnknown(value);
      else
        setError("Código desconocido. Una salida requiere producto existente.");
      return;
    }
    setError("");
    add(found.variant);
    setCode("");
  };
  const lineTotal = (l: GoodsLine) => l.qty * (l.unitCost ?? 0);
  const subtotal =
    items.reduce((s, l) => s + lineTotal(l), 0) + freight + taxes;
  const units = items.reduce((s, l) => s + (Number(l.qty) || 0), 0);
  const damagedOf = (l: GoodsLine) =>
    direction === "entry" ? Number(l.damagedQty) || 0 : 0;
  const damaged = items.reduce((s, l) => s + damagedOf(l), 0);
  // La factura puede cobrar también lo dañado: coincide con o sin ello.
  const damagedTotal = items.reduce(
    (s, l) => s + damagedOf(l) * (l.unitCost ?? 0),
    0,
  );
  const unresolved = items.filter((l) => !l.variantId && !l.quick).length;
  const missingCost =
    direction === "entry" &&
    items.some((l) => !(Number(l.unitCost) > 0) && !l.quick);
  const mismatch =
    !!total &&
    Math.abs(Number(total) - subtotal) > 0.01 &&
    Math.abs(Number(total) - subtotal - damagedTotal) > 0.01;
  const resetForm = () => {
    setItems([]);
    setDraft(null);
    setOrder("");
    setTotal("");
    setFreight(0);
    setTaxes(0);
    setMismatchAccepted(false);
    setDoc({});
    operationId.current = crypto.randomUUID();
  };
  const switchTo = (next: "entry" | "exit") => {
    if (next === direction) return;
    if (
      items.length &&
      !window.confirm("¿Descartar las líneas al cambiar de modo?")
    )
      return;
    resetForm();
    setResult(null);
    setError("");
    setDirection(next);
  };
  const confirm = async () => {
    if (!items.length || busy) return;
    if (unresolved) {
      setError("Elige o crea todos los productos antes de confirmar.");
      return;
    }
    if (missingCost) {
      setError("Escribe el costo unitario de cada producto.");
      return;
    }
    if (items.some((l) => !(Number(l.qty) > 0) && !(damagedOf(l) > 0))) {
      setError("Cada línea necesita una cantidad mayor que 0.");
      return;
    }
    if (items.some((l) => damagedOf(l) > 0 && !l.damageReason)) {
      setError("Elige el motivo de las unidades dañadas o rechazadas.");
      return;
    }
    if (
      direction === "exit" &&
      reason === "devolución a proveedor" &&
      (!supplierId || !String(doc.supplierInvoice ?? "").trim())
    ) {
      setError("Elige el proveedor y escribe la referencia de la devolución.");
      return;
    }
    if (
      !window.confirm(
        direction === "entry"
          ? `¿Confirmar entrada de ${units} unidad(es)${damaged ? ` y ${damaged} dañada(s) que no entran al stock` : ""}?`
          : `¿Confirmar salida de ${units} unidad(es) por ${reasonLabel(reason).toLowerCase()}?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    const input = {
      id: operationId.current,
      direction,
      supplierId: supplierId || undefined,
      orderId: orderId || undefined,
      draftId: draft?.id,
      reason: direction === "exit" ? reason : undefined,
      freight,
      taxes,
      invoiceTotal: total ? Number(total) : undefined,
      acknowledgeMismatch: mismatchAccepted,
      ...(direction === "entry" ? documentPayload(doc) : {}),
      ...(direction === "exit" && reason === "devolución a proveedor"
        ? { supplierInvoice: String(doc.supplierInvoice ?? "").trim() }
        : {}),
      items: items.map(
        ({
          name,
          confidence,
          expiryDate,
          productId,
          note,
          unitCost,
          showDamage,
          ordered,
          damagedQty,
          damageReason,
          ...l
        }) => {
          void name;
          void confidence;
          void productId;
          void note;
          void showDamage;
          void ordered;
          return {
            ...l,
            ...(direction === "entry" && Number(damagedQty) > 0
              ? { damagedQty: Number(damagedQty), damageReason }
              : {}),
            // El servidor exige costo positivo también en salidas (no se usa).
            unitCost: Number(unitCost) > 0 ? Number(unitCost) : 1,
            expiryDate: expiryDate
              ? new Date(expiryDate + "T12:00:00Z").toISOString()
              : undefined,
          };
        },
      ),
    };
    try {
      await localDB.merchandise.put({
        id: input.id,
        userId: user!.id,
        branchId: user!.branchId,
        input,
        status: "pending",
        createdAt: Date.now(),
      });
      if (online) {
        await registerTerminal();
        const saved = await post("/merchandise/operations", input);
        await localDB.merchandise.delete(input.id);
        setResult({ ...saved, direction, units });
        await client.invalidateQueries();
        toast("Mercancía registrada.");
      } else {
        toast("Guardado en cola. Se sincronizará al reconectar.");
        setResult(null);
      }
      resetForm();
    } catch (e: any) {
      setError(e.message);
      await localDB.merchandise.update(input.id, {
        status:
          !navigator.onLine || e instanceof TypeError ? "pending" : "conflict",
        message: e.message,
      });
    } finally {
      setBusy(false);
    }
  };
  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setImportError("");
    try {
      const form = new FormData();
      form.set("file", file);
      if (supplierId) form.set("supplierId", supplierId);
      form.set("mapping", JSON.stringify(mapping));
      const d = await api("/merchandise/import", {
        method: "POST",
        body: form,
      });
      setDraft(d);
      setResult(null);
      setItems(
        d.lines.map((l: any) => ({
          variantId: l.variantId ?? undefined,
          productId: l.productId ?? undefined,
          note: l.note,
          name: l.description,
          qty: l.qty,
          unitCost: l.unitCost,
          supplierCode: l.code || undefined,
          lotNumber: l.lotNumber ?? undefined,
          expiryDate: l.expiryDate?.slice(0, 10),
          confidence: l.confidence,
        })),
      );
      setTotal(d.total != null ? String(d.total) : "");
      setImporting(false);
      setFile(null);
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const recent = (history.data ?? []).filter((h) => h.result?.receiptId);
  return (
    <div className="merchandise">
      <header className="goods-header">
        <div>
          <h1>Mercancía</h1>
          <p>Entradas y salidas con revisión antes de confirmar.</p>
        </div>
        <div
          className="goods-mode"
          role="tablist"
          aria-label="Tipo de movimiento"
        >
          <button
            role="tab"
            aria-selected={direction === "entry"}
            className={direction === "entry" ? "active" : ""}
            onClick={() => switchTo("entry")}
          >
            <PackagePlus size={18} aria-hidden="true" /> ENTRADA
          </button>
          <button
            role="tab"
            aria-selected={direction === "exit"}
            className={direction === "exit" ? "active exit" : ""}
            onClick={() => switchTo("exit")}
          >
            <PackageMinus size={18} aria-hidden="true" /> SALIDA
          </button>
        </div>
      </header>

      {result && (
        <div className="goods-done" role="status">
          <div>
            <strong>
              {result.direction === "exit" ? "Salida" : "Entrada"} registrada
            </strong>
            <span>
              {result.units} unidad(es) · {result.variantIds?.length ?? 0}{" "}
              producto(s)
              {result.direction === "entry" && seesCost
                ? " · " + formatMoney(result.total)
                : ""}
            </span>
          </div>
          {result.receiptId && (
            <Button variant="secondary" onClick={() => setLabels(true)}>
              <Printer size={16} aria-hidden="true" /> Imprimir etiquetas de lo
              recibido
            </Button>
          )}
        </div>
      )}

      <section className="panel goods-card">
        {direction === "entry" ? (
          <div className="goods-grid">
            <label className="field">
              Proveedor (opcional)
              <select
                disabled={!!draft}
                value={supplierId}
                onChange={(e) => {
                  setSupplier(e.target.value);
                  setOrder("");
                }}
              >
                <option value="">Sin proveedor</option>
                {suppliers.data?.map((s: any) => (
                  <option value={s.id} key={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            {online && (
              <label className="field">
                Orden de compra (opcional)
                <select
                  value={orderId}
                  disabled={!supplierId || !!draft}
                  onChange={(e) => {
                    const id = e.target.value;
                    setOrder(id);
                    const o = orders.data?.find((o) => o.id === id);
                    setItems(
                      o
                        ? o.items
                            .filter(
                              (i: any) =>
                                Number(i.qty) >
                                Number(i.receivedQty) +
                                  Number(i.damagedQty ?? 0),
                            )
                            .map((i: any) => {
                              const v = variants.find(
                                (v) => v.id === i.variantId,
                              );
                              const ordered = {
                                qty: Number(i.qty),
                                received: Number(i.receivedQty),
                                damaged: Number(i.damagedQty ?? 0),
                              };
                              return {
                                variantId: i.variantId,
                                itemId: i.id,
                                ordered,
                                name: v ? variantName(v) : i.variantId,
                                qty:
                                  ordered.qty -
                                  ordered.received -
                                  ordered.damaged,
                                unitCost:
                                  Number(i.unitCost) > 0
                                    ? Number(i.unitCost)
                                    : undefined,
                              };
                            })
                        : [],
                    );
                  }}
                >
                  <option value="">
                    {supplierId ? "Sin orden" : "Elige primero el proveedor"}
                  </option>
                  {orders.data
                    ?.filter(
                      (o) =>
                        o.supplierId === supplierId && o.status !== "received",
                    )
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.number}
                      </option>
                    ))}
                </select>
              </label>
            )}
          </div>
        ) : (
          <div className="goods-grid">
            <label className="field">
              Motivo de la salida
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {EXIT_REASONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {reason === "devolución a proveedor" && (
              <>
                <label className="field">
                  Proveedor
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplier(e.target.value)}
                  >
                    <option value="">Elige el proveedor</option>
                    {suppliers.data?.map((s: any) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Referencia (documento o nota de crédito)
                  <input
                    maxLength={60}
                    value={doc.supplierInvoice ?? ""}
                    onChange={(e) =>
                      setDoc({ ...doc, supplierInvoice: e.target.value })
                    }
                  />
                </label>
              </>
            )}
          </div>
        )}
        {direction === "entry" && (
          <details className="goods-document">
            <summary>Documento del proveedor (opcional)</summary>
            <p className="goods-cost-note">
              Factura, NCF y condición de pago para la contable. Puedes
              completarlo después desde el historial.
            </p>
            <DocumentFields value={doc} onChange={setDoc} />
          </details>
        )}
        {direction === "entry" && !draft && !orderId && (
          <button
            type="button"
            className="goods-import"
            disabled={!online || items.length > 0}
            onClick={() => {
              setImportError("");
              setImporting(true);
            }}
          >
            <FileSpreadsheet size={22} aria-hidden="true" />
            <span>
              <strong>Importar factura del proveedor</strong>
              <small>
                {!online
                  ? "Necesita conexión a internet."
                  : items.length
                    ? "Disponible con la lista vacía."
                    : options.data?.aiEnabled
                      ? "Excel, CSV, foto o PDF de la factura."
                      : "Excel o CSV de la factura."}
              </small>
            </span>
          </button>
        )}
      </section>

      {!orderId && (
        <section className="panel goods-card">
          <form
            className="goods-scan"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) scan(code.trim());
            }}
          >
            <label className="field">
              Código de barras o SKU
              <span className="goods-search-input">
                <ScanBarcode size={16} aria-hidden="true" />
                <input
                  value={code}
                  inputMode="text"
                  autoComplete="off"
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </span>
            </label>
            <div className="goods-scan-actions">
              <Button type="submit">Sumar una unidad</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setCamera(true)}
              >
                <Camera size={16} aria-hidden="true" /> Escanear con la cámara
              </Button>
            </div>
          </form>
          <ProductSearch
            key={lookup.key}
            initialText={lookup.text}
            variants={variants}
            onPick={(v) => {
              setError("");
              add(v);
            }}
          />
        </section>
      )}

      {draft && (
        <section className="goods-review">
          <div>
            <h2>Revisión de factura</h2>
            <p>
              Nada entra al inventario hasta que confirmes. Comprueba cada
              producto, cantidad y costo.
            </p>
            <div className="goods-review-stats">
              <Badge tone="violet">{items.length} línea(s)</Badge>
              {unresolved > 0 ? (
                <Badge tone="warning">{unresolved} por resolver</Badge>
              ) : (
                <Badge tone="success">Todas emparejadas</Badge>
              )}
              {draft.skipped > 0 && (
                <Badge tone="warning">
                  {draft.skipped} línea(s) ilegible(s): agrégalas a mano
                </Badge>
              )}
            </div>
          </div>
          {draft.attachmentId && (
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  "/merchandise/attachments/" + draft.attachmentId,
                  "comprobante",
                )
              }
            >
              <Download size={16} aria-hidden="true" /> Descargar comprobante
            </Button>
          )}
        </section>
      )}

      {items.length === 0 && !draft && (
        <div className="goods-empty">
          <ScanBarcode size={28} aria-hidden="true" />
          <p>
            {direction === "entry"
              ? "Escanea o busca los productos que llegaron."
              : "Escanea o busca los productos que salen del inventario."}
          </p>
        </div>
      )}

      <div className="goods-lines">
        {items.map((l, index) => {
          const v = variants.find((v) => v.id === l.variantId);
          const category = l.quick
            ? categories.data?.find((c: any) => c.id === l.quick.categoryId)
            : categories.data?.find((c: any) => c.id === v?.product.categoryId);
          const unmatched = !l.variantId && !l.quick;
          const previous = v ? knownCost(v) : undefined;
          const price = v ? Number(v.price) : 0;
          const margin =
            seesCost && price > 0 && Number(l.unitCost) > 0
              ? ((price - Number(l.unitCost)) / price) * 100
              : undefined;
          return (
            <article
              className={`panel goods-line ${unmatched ? "unmatched" : ""}`}
              key={index}
            >
              <div className="goods-line-head">
                <div>
                  <h3>
                    {v ? variantName(v) : l.quick ? l.quick.name : l.name}
                  </h3>
                  <small>
                    {v
                      ? `${v.sku} · ${Number(v.stock)} en stock${expiredNote(v)}`
                      : l.quick
                        ? "Producto nuevo · se crea al confirmar"
                        : l.name}
                    {draft && v && l.name !== variantName(v)
                      ? ` · Factura: «${l.name}»`
                      : ""}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label="Quitar línea"
                  title="Quitar línea"
                  onClick={() =>
                    setItems((old) => old.filter((_, i) => i !== index))
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {l.confidence !== undefined && (
                <p className="goods-match">
                  {unmatched ? (
                    <>
                      <CircleAlert size={15} aria-hidden="true" />
                      {l.note ?? "Sin pareja · elige o crea un producto"}
                    </>
                  ) : (
                    <>
                      Producto sugerido · Confianza{" "}
                      {Math.round(l.confidence * 100)}%
                    </>
                  )}
                </p>
              )}
              {draft && unmatched && (
                <>
                  {l.productId ? (
                    <label className="field">
                      Variante
                      <select
                        value=""
                        onChange={(e) => {
                          const v = variants.find(
                            (v) => v.id === e.target.value,
                          );
                          if (v)
                            patch(index, {
                              variantId: v.id,
                              quick: undefined,
                            });
                        }}
                      >
                        <option value="">
                          Elegir sabor, tamaño, talla o color…
                        </option>
                        {variants
                          .filter((v) => v.product.id === l.productId)
                          .map((v) => (
                            <option key={v.id} value={v.id}>
                              {variantName(v)} · {Number(v.stock)} en stock
                              {expiredNote(v)}
                            </option>
                          ))}
                      </select>
                    </label>
                  ) : null}
                  <ProductSearch
                    variants={variants}
                    label={
                      l.productId ? "O busca otro producto" : "Buscar producto"
                    }
                    onPick={(v) =>
                      patch(index, { variantId: v.id, quick: undefined })
                    }
                  />
                  <Button
                    variant="secondary"
                    onClick={() => setUnknown("review:" + index)}
                  >
                    <Plus size={16} aria-hidden="true" /> Crear producto rápido
                  </Button>
                </>
              )}
              {draft && !unmatched && !l.quick && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() =>
                    patch(index, {
                      variantId: undefined,
                      productId: v?.product.id,
                      note: "Elige el producto correcto.",
                      confidence: 0,
                    })
                  }
                >
                  Cambiar producto
                </button>
              )}
              <div className="goods-fields">
                <div className="field">
                  {/* La etiqueta apunta al campo, no a los botones +/−. */}
                  <label htmlFor={"goods-qty-" + index}>Cantidad</label>
                  <span className="goods-qty">
                    <button
                      type="button"
                      aria-label="Restar una unidad"
                      onClick={() =>
                        patch(index, {
                          qty: Math.max(
                            damagedOf(l) > 0 ? 0 : 1,
                            Number(l.qty) - 1,
                          ),
                        })
                      }
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      id={"goods-qty-" + index}
                      type="number"
                      min={damagedOf(l) > 0 ? "0" : "0.001"}
                      step="0.001"
                      inputMode="decimal"
                      value={l.qty}
                      onChange={(e) =>
                        patch(index, { qty: Number(e.target.value) })
                      }
                    />
                    <button
                      type="button"
                      aria-label="Sumar otra unidad"
                      onClick={() => patch(index, { qty: Number(l.qty) + 1 })}
                    >
                      <Plus size={16} />
                    </button>
                  </span>
                </div>
                {direction === "entry" && (
                  <label className="field">
                    Costo unitario
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Escribe el costo"
                      aria-invalid={!(Number(l.unitCost) > 0) && !l.quick}
                      value={l.unitCost ?? ""}
                      onChange={(e) =>
                        patch(index, {
                          unitCost:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                )}
              </div>
              {direction === "entry" && (
                <DamageFields
                  line={l}
                  index={index}
                  onChange={(change) => patch(index, change)}
                />
              )}
              {direction === "entry" && seesCost && previous !== undefined && (
                <p className="goods-cost-note">
                  Costo promedio actual {formatMoney(previous)}
                  {Number(l.unitCost) > 0 &&
                    Math.abs(Number(l.unitCost) - previous) / previous >
                      0.005 &&
                    ` · ${Number(l.unitCost) > previous ? "sube" : "baja"} ${Math.abs(
                      ((Number(l.unitCost) - previous) / previous) * 100,
                    ).toFixed(0)} %`}
                  {margin !== undefined && margin < 15 && (
                    <span className="goods-warning">
                      {" "}
                      · Margen con este costo: {margin.toFixed(0)} %. Revisa el
                      precio de venta.
                    </span>
                  )}
                </p>
              )}
              {direction === "entry" ? (
                <div className="goods-fields">
                  {(category?.requiresLot || l.lotNumber !== undefined) && (
                    <label className="field">
                      Lote
                      <input
                        value={l.lotNumber ?? ""}
                        onChange={(e) =>
                          patch(index, {
                            lotNumber: e.target.value || undefined,
                          })
                        }
                      />
                    </label>
                  )}
                  {(category?.requiresExpiry || l.expiryDate !== undefined) && (
                    <label className="field">
                      Vencimiento
                      <input
                        type="date"
                        value={l.expiryDate ?? ""}
                        onChange={(e) =>
                          patch(index, {
                            expiryDate: e.target.value || undefined,
                          })
                        }
                      />
                    </label>
                  )}
                </div>
              ) : (
                (category?.requiresLot || (v?.lots?.length ?? 0) > 0) && (
                  <label className="field">
                    Lote de salida
                    <select
                      value={l.lotId ?? ""}
                      onChange={(e) =>
                        patch(index, { lotId: e.target.value || undefined })
                      }
                    >
                      <option value="">Elegir lote</option>
                      {v?.lots
                        ?.filter((lot: any) => Number(lot.qty) > 0)
                        .map((lot: any) => (
                          <option value={lot.id} key={lot.id}>
                            {lot.lotNumber} · {Number(lot.qty)} u.
                            {lot.expiryDate
                              ? " · vence " +
                                new Date(lot.expiryDate).toLocaleDateString(
                                  "es-DO",
                                  { timeZone: "America/Santo_Domingo" },
                                )
                              : ""}
                          </option>
                        ))}
                    </select>
                  </label>
                )
              )}
            </article>
          );
        })}
      </div>

      {direction === "entry" && items.length > 0 && (
        <section className="panel goods-card">
          <div className="goods-grid">
            <label className="field">
              Flete
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={freight}
                onChange={(e) => setFreight(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Impuestos adicionales
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={taxes}
                onChange={(e) => setTaxes(Number(e.target.value))}
              />
            </label>
            <label className="field">
              Total de la factura
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={total}
                onChange={(e) => {
                  setTotal(e.target.value);
                  setMismatchAccepted(false);
                }}
              />
            </label>
            <div className="goods-sum">
              <span>Total calculado</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
          </div>
          {mismatch && (
            <div className="form-error" role="alert">
              El total no coincide con la factura ({formatMoney(Number(total))}
              ). Revisa líneas, flete e impuestos.
              <label className="goods-check">
                <input
                  type="checkbox"
                  checked={mismatchAccepted}
                  onChange={(e) => setMismatchAccepted(e.target.checked)}
                />{" "}
                Confirmo la diferencia después de revisar
              </label>
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className={`goods-actions ${items.length ? "has-items" : ""}`}>
        <span className="goods-actions-summary">
          {items.length
            ? `${items.length} producto(s) · ${units} unidad(es)` +
              (direction === "entry" && !missingCost
                ? " · " + formatMoney(subtotal)
                : "")
            : "Sin productos"}
          {unresolved > 0 && ` · ${unresolved} por resolver`}
          {missingCost && " · faltan costos"}
        </span>
        <Button
          className={`goods-confirm ${direction === "exit" ? "exit" : ""}`}
          disabled={busy || !items.length || (mismatch && !mismatchAccepted)}
          onClick={confirm}
        >
          {busy
            ? "Registrando…"
            : direction === "entry"
              ? "Confirmar entrada"
              : "Confirmar salida"}
        </Button>
      </div>

      {online && (
        <section className="panel goods-card">
          <h2>Historial de recepciones</h2>
          <ReceiptHistory compact />
        </section>
      )}

      {recent.length > 0 && (
        <section className="panel goods-card">
          <h2>Entradas recientes</h2>
          <ul className="goods-history">
            {recent.map((h) => (
              <li key={h.id}>
                <span>
                  <strong>{when(h.createdAt)}</strong>
                  <small>
                    {h.result.variantIds?.length ?? 0} producto(s)
                    {seesCost && h.result.total !== undefined
                      ? " · " + formatMoney(h.result.total)
                      : ""}
                  </small>
                </span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResult({ ...h.result, direction: "entry" });
                    setLabels(true);
                  }}
                >
                  <Printer size={16} aria-hidden="true" /> Etiquetas
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {queue.length > 0 && (
        <section className="panel goods-card">
          <h2>Pendientes de este equipo</h2>
          <ul className="goods-history">
            {queue.map((row) => (
              <li key={row.id}>
                <span>
                  <strong>
                    {row.status === "conflict"
                      ? "Requiere revisión"
                      : "Pendiente"}{" "}
                    · {row.input.direction === "entry" ? "Entrada" : "Salida"}
                  </strong>
                  <small>{row.message ?? when(row.createdAt)}</small>
                </span>
                {row.status === "conflict" && (
                  <span className="goods-row-actions">
                    <Button
                      variant="secondary"
                      disabled={!online}
                      onClick={async () => {
                        await localDB.merchandise.update(row.id, {
                          status: "pending",
                          message: undefined,
                        });
                        await registerTerminal();
                        await syncMerchandise();
                        await client.invalidateQueries();
                      }}
                    >
                      Reintentar
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (
                          !window.confirm(
                            "¿Cargar esta operación para corregirla? La cola conservará la original hasta confirmar la corrección.",
                          )
                        )
                          return;
                        setItems(
                          row.input.items.map((l: any) => {
                            // Al corregir, los dañados quedan a la vista.
                            const v = variants.find(
                              (v) => v.id === l.variantId,
                            );
                            return {
                              ...l,
                              showDamage: Number(l.damagedQty) > 0,
                              name: v
                                ? variantName(v)
                                : (l.quick?.name ?? l.variantId),
                              expiryDate: l.expiryDate?.slice(0, 10),
                            };
                          }),
                        );
                        setDraft(
                          row.input.draftId ? { id: row.input.draftId } : null,
                        );
                        setDirection(row.input.direction);
                        setSupplier(row.input.supplierId ?? "");
                        setOrder(row.input.orderId ?? "");
                        setReason(row.input.reason ?? "merma");
                        setFreight(row.input.freight);
                        setTaxes(row.input.taxes);
                        setDoc({
                          supplierInvoice: row.input.supplierInvoice,
                          supplierNcf: row.input.supplierNcf,
                          invoiceDate: row.input.invoiceDate,
                          paymentType: row.input.paymentType,
                          creditDays: row.input.creditDays,
                          itbis: row.input.itbis,
                        });
                        setTotal(
                          row.input.invoiceTotal != null
                            ? String(row.input.invoiceTotal)
                            : "",
                        );
                        operationId.current = row.id;
                      }}
                    >
                      Revisar
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {camera && (
        <ContinuousScanner onCode={scan} onClose={() => setCamera(false)} />
      )}
      {unknown !== null && (
        <FormModal
          title="Crear producto rápido"
          onClose={() => setUnknown(null)}
          fields={[
            { key: "name", label: "Nombre", required: true },
            {
              key: "categoryId",
              label: "Categoría",
              type: "select",
              required: true,
              options:
                categories.data?.map((c: any) => ({
                  value: c.id,
                  label: c.name,
                })) ?? [],
            },
            {
              key: "barcode",
              label: "Código de barras",
              required: true,
              initial: unknown.startsWith("review:")
                ? items[Number(unknown.split(":")[1])]?.supplierCode
                : unknown,
            },
            {
              key: "price",
              label: "Precio de venta",
              type: "number",
              required: true,
              min: 0.01,
              step: "0.01",
            },
            {
              key: "cost",
              label: "Costo",
              type: "number",
              required: true,
              min: 0.01,
              step: "0.01",
            },
            {
              key: "variant",
              label: "Variante (sabor, talla, color…)",
              required: true,
              initial: "Única",
            },
          ]}
          onSubmit={async (q) => {
            // Un código que ya es de un producto (con otras mayúsculas o en
            // su SKU) no crea otro: la mercancía iría a un duplicado y la
            // caja dejaría de agregar los dos (R9-codigos-3).
            const code = String(q.barcode ?? "").trim();
            const existing = findByCode(variants, code);
            if (existing)
              throw new Error(
                "El código " +
                  code +
                  ("ambiguous" in existing
                    ? " ya es de " + existing.ambiguous + " productos."
                    : " ya es de «" +
                      variantName(existing.variant) +
                      "». Búscalo y agrégalo en vez de crear otro."),
              );
            const replacing = unknown.startsWith("review:")
              ? Number(unknown.split(":")[1])
              : -1;
            if (
              items.some(
                (l, i) =>
                  i !== replacing &&
                  String(l.quick?.barcode ?? "")
                    .trim()
                    .toLowerCase() === code.toLowerCase(),
              )
            )
              throw new Error(
                "El código " +
                  code +
                  " ya es de otro producto nuevo de esta lista.",
              );
            if (unknown.startsWith("review:")) {
              const index = Number(unknown.split(":")[1]);
              patch(index, {
                quick: q,
                variantId: undefined,
                name: q.name,
                unitCost: Number(q.cost),
              });
            } else
              setItems((old) => [
                ...old,
                { quick: q, name: q.name, qty: 1, unitCost: Number(q.cost) },
              ]);
            setUnknown(null);
          }}
        />
      )}
      <Modal
        open={importing}
        title="Importar factura del proveedor"
        onClose={() => setImporting(false)}
      >
        <p className="modal-intro">
          Sube el Excel o CSV que te envió el proveedor
          {options.data?.aiEnabled ? ", o una foto/PDF de la factura" : ""}.
          Reconocemos columnas como Código, Descripción, Cantidad y Costo o
          Precio; si tu archivo usa otros nombres, escríbelos abajo. Se
          recuerdan por proveedor.
        </p>
        <label className="field">
          Archivo
          <input
            type="file"
            accept={
              options.data?.aiEnabled
                ? ".xlsx,.csv,.pdf,image/jpeg,image/png,image/webp"
                : ".xlsx,.csv"
            }
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setImportError("");
            }}
          />
        </label>
        <div className="goods-grid">
          {Object.entries(mapping).map(([k, v]) => (
            <label className="field" key={k}>
              {
                {
                  code: "Columna de código",
                  description: "Columna de descripción",
                  qty: "Columna de cantidad",
                  unitCost: "Columna de costo",
                }[k]
              }
              <input
                value={v}
                onChange={(e) =>
                  setMapping((m) => ({ ...m, [k]: e.target.value }))
                }
              />
            </label>
          ))}
        </div>
        {options.data?.aiEnabled && (
          <p className="modal-intro">
            Las fotos y PDF se envían a Anthropic (Claude) para leer sus líneas.
            Siempre revisas el resultado antes de confirmar.
          </p>
        )}
        {importError && (
          <p className="form-error" role="alert">
            {importError}
          </p>
        )}
        <Button disabled={!file || busy} onClick={extract}>
          {busy ? "Leyendo la factura…" : "Extraer para revisar"}
        </Button>
      </Modal>
      <Modal
        open={labels}
        title="Etiquetas de lo recibido"
        onClose={() => setLabels(false)}
      >
        <div className="barcode-labels receipt-only-on-print">
          {result?.variantIds?.map((id: string) => {
            const v = variants.find((v) => v.id === id);
            return v ? (
              <div key={id} className="barcode-label">
                <strong>{variantName(v)}</strong>
                <Barcode value={v.barcode} />
                <span>{v.barcode}</span>
              </div>
            ) : null;
          })}
        </div>
        <Button onClick={() => window.print()}>
          <Printer size={16} aria-hidden="true" /> Imprimir etiquetas
        </Button>
      </Modal>
    </div>
  );
}

// Unidades dañadas o rechazadas de una línea (paso 36) y, si viene de una
// orden, lo que queda pendiente: pedido = bueno + dañado + pendiente.
function DamageFields({
  line,
  index,
  onChange,
}: {
  line: GoodsLine;
  index: number;
  onChange: (change: Partial<GoodsLine>) => void;
}) {
  const damaged = Number(line.damagedQty) || 0;
  const o = line.ordered;
  const pending = o
    ? Math.max(
        0,
        Math.round(
          (o.qty - o.received - o.damaged - (Number(line.qty) || 0) - damaged) *
            1000,
        ) / 1000,
      )
    : undefined;
  return (
    <>
      {o && (
        <p className="goods-cost-note">
          Pedido {o.qty} · antes: {o.received} buenas
          {o.damaged ? `, ${o.damaged} dañadas` : ""} · Pendiente {pending}
        </p>
      )}
      {line.showDamage || damaged > 0 ? (
        <div className="goods-fields">
          <label className="field">
            Unidades dañadas o rechazadas
            <input
              id={"goods-damaged-" + index}
              type="number"
              min="0"
              step="0.001"
              inputMode="decimal"
              value={line.damagedQty ?? ""}
              onChange={(e) =>
                onChange({
                  damagedQty:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
          <label className="field">
            Motivo del daño o rechazo
            <select
              value={line.damageReason ?? ""}
              aria-invalid={damaged > 0 && !line.damageReason}
              onChange={(e) =>
                onChange({ damageReason: e.target.value || undefined })
              }
            >
              <option value="">Elegir motivo</option>
              {DAMAGE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <button
          type="button"
          className="link-button"
          onClick={() => onChange({ showDamage: true })}
        >
          Dañados o rechazados
        </button>
      )}
    </>
  );
}
