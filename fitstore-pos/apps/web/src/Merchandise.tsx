import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Modal } from "@fitstore/ui";
import {
  api,
  download,
  loadCatalog,
  localDB,
  post,
  syncMerchandise,
  useStore,
} from "./api";
import { FormModal, toast } from "./helpers";
import { registerTerminal } from "./realtime";
import { Barcode } from "./Management";
type GoodsLine = {
  variantId?: string;
  name: string;
  qty: number;
  unitCost: number;
  lotId?: string;
  lotNumber?: string;
  expiryDate?: string;
  supplierCode?: string;
  itemId?: string;
  confidence?: number;
  quick?: any;
};
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
  const [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    let control: { stop: () => void } | undefined;
    let last = "",
      when = 0;
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
            if (code === last && Date.now() - when < 1200) return;
            last = code;
            when = Date.now();
            callback.current(code);
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
        <p role="alert">{error}</p>
      ) : (
        <video ref={video} muted playsInline className="scanner-video" />
      )}
      <p>
        Cada lectura suma una unidad. El mismo código se cuenta como máximo una
        vez cada 1,2 segundos.
      </p>
    </Modal>
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
  const catalog = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const variants = (catalog.data ?? []).flatMap((p) =>
    p.variants.map((v) => ({ ...v, product: p })),
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
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [importing, setImporting] = useState(false),
    [draft, setDraft] = useState<any>(null),
    [result, setResult] = useState<any>(null),
    [labels, setLabels] = useState(false),
    [freight, setFreight] = useState(0),
    [taxes, setTaxes] = useState(0),
    [total, setTotal] = useState(""),
    [mismatchAccepted, setMismatchAccepted] = useState(false),
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
  const scan = (value: string) => {
    const v = variants.find((v) => v.barcode === value || v.sku === value);
    if (!v) {
      setCamera(false);
      if (direction === "entry") setUnknown(value);
      else
        setError("Código desconocido. Una salida requiere producto existente.");
      return;
    }
    setItems((old) => {
      const at = old.findIndex(
        (l) => l.variantId === v.id && !l.lotId && !l.lotNumber,
      );
      return at < 0
        ? [
            ...old,
            {
              variantId: v.id,
              name: v.product.name,
              qty: 1,
              unitCost: Number(v.costAvg ?? 1),
            },
          ]
        : old.map((l, i) => (i === at ? { ...l, qty: l.qty + 1 } : l));
    });
    setCode("");
    navigator.vibrate?.(50);
  };
  const subtotal =
    items.reduce((s, l) => s + l.qty * l.unitCost, 0) + freight + taxes;
  const mismatch = !!total && Math.abs(Number(total) - subtotal) > 0.01;
  const confirm = async () => {
    if (!items.length || busy) return;
    if (items.some((l) => !l.variantId && !l.quick)) {
      setError("Elige o crea todos los productos antes de confirmar.");
      return;
    }
    if (
      !window.confirm(
        direction === "entry"
          ? "¿Confirmar entrada de mercancía?"
          : "¿Confirmar salida de mercancía?",
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
      items: items.map(({ name, confidence, expiryDate, ...l }) => {
        void name;
        void confidence;
        return {
          ...l,
          expiryDate: expiryDate
            ? new Date(expiryDate + "T12:00:00Z").toISOString()
            : undefined,
        };
      }),
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
        setResult(saved);
        await client.invalidateQueries();
        toast("Mercancía registrada.");
      } else {
        toast("Guardado en cola. Se sincronizará al reconectar.");
        setResult(null);
      }
      setItems([]);
      setDraft(null);
      setOrder("");
      setTotal("");
      setFreight(0);
      setTaxes(0);
      setMismatchAccepted(false);
      operationId.current = crypto.randomUUID();
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
  return (
    <div className="merchandise">
      <h1>Mercancía</h1>
      <p>Entradas y salidas con revisión antes de confirmar.</p>
      <div className="tabs">
        <Button
          variant={direction === "entry" ? "primary" : "secondary"}
          onClick={() => {
            if (
              items.length &&
              !window.confirm("¿Descartar las líneas al cambiar de modo?")
            )
              return;
            setItems([]);
            setDraft(null);
            setDirection("entry");
          }}
        >
          ENTRADA
        </Button>
        <Button
          variant={direction === "exit" ? "primary" : "secondary"}
          onClick={() => {
            if (
              items.length &&
              !window.confirm("¿Descartar las líneas al cambiar de modo?")
            )
              return;
            setItems([]);
            setDraft(null);
            setDirection("exit");
            setOrder("");
          }}
        >
          SALIDA
        </Button>
      </div>
      {direction === "entry" ? (
        <>
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
                onChange={(e) => {
                  const id = e.target.value;
                  setOrder(id);
                  const o = orders.data?.find((o) => o.id === id);
                  if (o)
                    setItems(
                      o.items
                        .filter(
                          (i: any) => Number(i.qty) > Number(i.receivedQty),
                        )
                        .map((i: any) => ({
                          variantId: i.variantId,
                          itemId: i.id,
                          name:
                            variants.find((v) => v.id === i.variantId)?.product
                              .name ?? i.variantId,
                          qty: Number(i.qty) - Number(i.receivedQty),
                          unitCost: Number(i.unitCost ?? 1),
                        })),
                    );
                }}
              >
                <option value="">Sin orden</option>
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
          <Button
            variant="secondary"
            disabled={!online || items.length > 0}
            onClick={() => setImporting(true)}
          >
            Importar factura del proveedor
          </Button>
        </>
      ) : (
        <label className="field">
          Motivo
          <select value={reason} onChange={(e) => setReason(e.target.value)}>
            {[
              "merma",
              "dañado",
              "vencido",
              "muestra",
              "uso interno",
              "devolución a proveedor",
            ].map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      )}
      {!orderId && (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              scan(code.trim());
            }}
          >
            <label className="field">
              Código de barras o SKU
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </label>
            <Button type="submit">Sumar una unidad</Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setCamera(true)}
            >
              Escanear continuamente
            </Button>
          </form>
          <label className="field">
            Agregar producto
            <select
              value=""
              onChange={(e) => {
                const v = variants.find((v) => v.id === e.target.value);
                if (v) scan(v.barcode);
              }}
            >
              <option value="">Elegir…</option>
              {variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.product.name} · {v.sku}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {draft && (
        <div className="panel">
          <h2>REVISIÓN de factura</h2>
          <p>
            Nada entra al inventario hasta que confirmes. Comprueba cada
            producto sugerido, cantidad y costo.
          </p>
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
              Descargar comprobante
            </Button>
          )}
        </div>
      )}
      {items.map((l, index) => {
        const v = variants.find((v) => v.id === l.variantId);
        const category = l.quick
          ? categories.data?.find((c: any) => c.id === l.quick.categoryId)
          : categories.data?.find((c: any) => c.id === v?.product.categoryId);
        return (
          <div
            className={`panel goods-line ${!l.variantId && !l.quick ? "unmatched" : ""}`}
            key={index}
          >
            <h3>{l.name}</h3>
            {l.confidence !== undefined && (
              <p>
                {l.variantId
                  ? "Producto sugerido"
                  : "Sin pareja · elige o crea un producto"}{" "}
                · Confianza {Math.round(l.confidence * 100)}%
              </p>
            )}
            {draft && (
              <label className="field">
                Producto
                <select
                  value={l.variantId ?? ""}
                  onChange={(e) => {
                    const v = variants.find((v) => v.id === e.target.value);
                    patch(index, {
                      variantId: e.target.value || undefined,
                      quick: undefined,
                      name: v?.product.name ?? l.name,
                    });
                  }}
                >
                  <option value="">Sin pareja</option>
                  {variants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.product.name} · {v.sku}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!l.variantId && !l.quick && (
              <Button
                variant="secondary"
                onClick={() => setUnknown("review:" + index)}
              >
                Crear producto rápido
              </Button>
            )}
            <div className="goods-fields">
              <label className="field">
                Cantidad
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={l.qty}
                  onChange={(e) =>
                    patch(index, { qty: Number(e.target.value) })
                  }
                />
              </label>
              {direction === "entry" && (
                <label className="field">
                  Costo unitario
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={l.unitCost}
                    onChange={(e) =>
                      patch(index, { unitCost: Number(e.target.value) })
                    }
                  />
                </label>
              )}
            </div>
            {direction === "entry" ? (
              <>
                {(category?.requiresLot || l.lotNumber !== undefined) && (
                  <label className="field">
                    Lote
                    <input
                      value={l.lotNumber ?? ""}
                      onChange={(e) =>
                        patch(index, { lotNumber: e.target.value || undefined })
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
              </>
            ) : (
              <>
                {(category?.requiresLot || v?.lots?.length) && (
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
                            {lot.lotNumber} · {lot.qty} ·{" "}
                            {lot.expiryDate?.slice(0, 10)}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </>
            )}
            <Button
              variant="secondary"
              onClick={() =>
                setItems((old) => old.filter((_, i) => i !== index))
              }
            >
              Quitar línea
            </Button>
          </div>
        );
      })}
      {direction === "entry" && items.length > 0 && (
        <div className="panel">
          <div className="goods-fields">
            <label className="field">
              Flete
              <input
                type="number"
                min="0"
                step="0.01"
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
                value={taxes}
                onChange={(e) => setTaxes(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="field">
            Total de la factura
            <input
              type="number"
              min="0"
              step="0.01"
              value={total}
              onChange={(e) => {
                setTotal(e.target.value);
                setMismatchAccepted(false);
              }}
            />
          </label>
          <p>Total calculado: RD$ {subtotal.toFixed(2)}</p>
          {mismatch && (
            <>
              <p role="alert" className="form-error">
                El total no coincide con la factura. Revisa líneas, flete e
                impuestos.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={mismatchAccepted}
                  onChange={(e) => setMismatchAccepted(e.target.checked)}
                />{" "}
                Confirmo la diferencia después de revisar
              </label>
            </>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button
        className="goods-confirm"
        disabled={busy || !items.length || (mismatch && !mismatchAccepted)}
        onClick={confirm}
      >
        {busy
          ? "Registrando…"
          : direction === "entry"
            ? "Confirmar entrada"
            : "Confirmar salida"}
      </Button>
      {result?.receiptId && (
        <Button variant="secondary" onClick={() => setLabels(true)}>
          Imprimir etiquetas de lo recibido
        </Button>
      )}
      {history.data?.some((h) => h.result.receiptId) && (
        <div className="panel">
          <h2>Entradas confirmadas</h2>
          {history.data
            .filter((h) => h.result.receiptId)
            .map((h) => (
              <p key={h.id}>
                {new Date(h.createdAt).toLocaleString("es-DO")}{" "}
                <Button
                  variant="secondary"
                  onClick={() => {
                    setResult(h.result);
                    setLabels(true);
                  }}
                >
                  Imprimir etiquetas de lo recibido
                </Button>
              </p>
            ))}
        </div>
      )}
      {queue.length > 0 && (
        <div className="panel">
          <h2>Cola de este equipo</h2>
          {queue.map((row) => (
            <div key={row.id}>
              <p>
                {row.status === "conflict" ? "Requiere revisión" : "Pendiente"}{" "}
                · {row.input.direction === "entry" ? "Entrada" : "Salida"} ·{" "}
                {row.message ?? new Date(row.createdAt).toLocaleString()}
              </p>
              {row.status === "conflict" && (
                <>
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
                        row.input.items.map((l: any) => ({
                          ...l,
                          name:
                            variants.find((v) => v.id === l.variantId)?.product
                              .name ??
                            l.quick?.name ??
                            l.variantId,
                          expiryDate: l.expiryDate?.slice(0, 10),
                        })),
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
                </>
              )}
            </div>
          ))}
        </div>
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
              label: "Precio",
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
              label: "Variante",
              required: true,
              initial: "Única",
            },
          ]}
          onSubmit={async (q) => {
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
        <p>
          Excel/CSV: indica los nombres exactos de las columnas. El mapeo se
          recuerda por proveedor.
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
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {Object.entries(mapping).map(([k, v]) => (
          <label className="field" key={k}>
            {
              {
                code: "Código",
                description: "Descripción",
                qty: "Cantidad",
                unitCost: "Costo unitario",
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
        {options.data?.aiEnabled && (
          <p>
            Las fotos y PDF se enviarán a Anthropic para extraer sus líneas.
            Revisa el resultado antes de confirmar.
          </p>
        )}
        <Button
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
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
              setItems(
                d.lines.map((l: any) => ({
                  variantId: l.variantId ?? undefined,
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
            } catch (e: any) {
              toast(e.message, true);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Extrayendo…" : "Extraer para revisar"}
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
                <strong>{v.product.name}</strong>
                <Barcode value={v.barcode} />
                <span>{v.barcode}</span>
              </div>
            ) : null;
          })}
        </div>
        <Button onClick={() => window.print()}>Imprimir etiquetas</Button>
      </Modal>
    </div>
  );
}
