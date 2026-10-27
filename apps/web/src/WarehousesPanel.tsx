import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { FormModal, toast, dateLabel } from "./helpers";
import { warehouseLabel } from "./product-branding";

type Warehouse = { id: string; name: string; kind: string; sellable: boolean };
export function WarehousesPanel({
  rows,
  warehouseId,
}: {
  rows: any[];
  warehouseId: string;
}) {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const warehouses = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: () => api("/inventory/warehouses"),
  });
  const report = useQuery<any[]>({
    queryKey: ["location-report"],
    queryFn: () => api("/inventory/location-report"),
  });
  const transfers = useQuery<any[]>({
    queryKey: ["transfers"],
    queryFn: () => api("/inventory/transfers"),
  });
  const [transfer, setTransfer] = useState<any>(null);
  const [variantId, setVariantId] = useState("");
  const [operationId, setOperationId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState<Warehouse | null>(null);
  const selected = warehouses.data?.find((w) => w.id === warehouseId);
  const home = warehouses.data?.find((w) => w.kind === "home");
  const store = warehouses.data?.find((w) => w.kind === "store");
  const homeName = warehouseLabel(home);
  const storeName = warehouseLabel(store);
  const defaultFrom = selected?.id || store?.id || home?.id || "";
  const defaultTo =
    warehouses.data?.find((w) => w.id !== defaultFrom)?.id || "";
  function selectImportFile(nextFile: File | null) {
    if (nextFile && !nextFile.name.toLowerCase().endsWith(".xlsx")) {
      toast("Selecciona un archivo Excel con extensión .xlsx.", true);
      return;
    }
    setFile(nextFile);
    setPreview(null);
  }
  async function upload(stage: "preview" | "apply") {
    if (!file) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (stage === "apply") {
        form.append("hash", preview.hash);
        form.append("state", preview.state);
      }
      const result = await api<any>(`/inventory-import/casa/${stage}`, {
        method: "POST",
        body: form,
        timeout: 180_000,
      });
      if (stage === "preview") setPreview(result);
      else {
        setPreview(null);
        setFile(null);
        toast(`Levantamiento de ${homeName} aplicado.`);
        await client.invalidateQueries();
      }
    } catch (e) {
      toast(
        e instanceof Error ? e.message : "No se pudo cargar el archivo.",
        true,
      );
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-label="Almacenes y traspasos">
      <h2>Dónde está la mercancía</h2>
      <div className="table-toolbar">
        <span>
          Producto · {storeName} · {homeName} · Total
          {can(user.permissions, "profit:read") ? " · Valor a costo" : ""}
        </span>
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>{storeName}</th>
              <th>{homeName}</th>
              <th>Total</th>
              {can(user.permissions, "profit:read") && <th>Valor a costo</th>}
            </tr>
          </thead>
          <tbody>
            {(report.data || [])
              .filter((r) => rows.some((v) => v.id === r.variantId))
              .map((r) => (
                <tr key={r.variantId}>
                  <td>
                    {r.product} · {r.sku}
                  </td>
                  <td>{r.store}</td>
                  <td>{r.home}</td>
                  <td>{r.total}</td>
                  {can(user.permissions, "profit:read") && (
                    <td>{r.valueAtCost}</td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {user.permissions.includes("*") && (
        <>
          <h2>Nombres de almacenes</h2>
          <p>Cada empresa puede nombrar sus almacenes según su operación.</p>
          {(warehouses.data || []).map((warehouse) => (
            <Button key={warehouse.id} onClick={() => setRenaming(warehouse)}>
              Renombrar {warehouseLabel(warehouse)}
            </Button>
          ))}
          {renaming && (
            <FormModal
              title={`Renombrar ${warehouseLabel(renaming)}`}
              onClose={() => setRenaming(null)}
              fields={[
                {
                  key: "name",
                  label: "Nombre",
                  required: true,
                  initial: renaming.name,
                },
              ]}
              onSubmit={async (data) => {
                await api(`/inventory/warehouses/${renaming.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ name: data.name }),
                });
                setRenaming(null);
                await client.invalidateQueries({ queryKey: ["warehouses"] });
              }}
            />
          )}
          <h2>Traspasar mercancía</h2>
          <p>
            El movimiento resta del origen y suma al destino en una sola
            operación.
          </p>
          <label htmlFor="transfer-product">Producto</label>
          <select
            id="transfer-product"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            <option value="">Elige un producto</option>
            {rows.map((v) => (
              <option key={v.id} value={v.id}>
                {v.product.name} · {v.sku}
              </option>
            ))}
          </select>
          <Button
            disabled={!variantId}
            onClick={() => {
              setTransfer(rows.find((v) => v.id === variantId));
              setOperationId(crypto.randomUUID());
            }}
          >
            Traspasar
          </Button>
          {transfer && (
            <FormModal
              title={`Traspasar · ${transfer.product.name}`}
              onClose={() => setTransfer(null)}
              fields={[
                {
                  key: "fromId",
                  label: "Desde",
                  type: "select",
                  required: true,
                  initial: defaultFrom,
                  options: (warehouses.data || []).map((w) => ({
                    label: w.name,
                    value: w.id,
                  })),
                },
                {
                  key: "toId",
                  label: "Hasta",
                  type: "select",
                  required: true,
                  initial: defaultTo,
                  options: (warehouses.data || []).map((w) => ({
                    label: w.name,
                    value: w.id,
                  })),
                },
                {
                  key: "qty",
                  label: "Cantidad",
                  type: "number",
                  required: true,
                  min: 0.001,
                  step: "0.001",
                },
                {
                  key: "lotId",
                  label: "Lote (si aplica)",
                  type: "select",
                  options: transfer.lots.map((l: any) => ({
                    label: l.lotNumber,
                    value: l.id,
                  })),
                },
                {
                  key: "reason",
                  label: "Motivo",
                  required: true,
                  type: "textarea",
                },
              ]}
              onSubmit={async (data) => {
                await post("/inventory/transfers", {
                  operationId,
                  fromId: data.fromId,
                  toId: data.toId,
                  reason: data.reason,
                  lines: [
                    {
                      variantId: transfer.id,
                      lotId: data.lotId || undefined,
                      qty: data.qty,
                    },
                  ],
                });
              }}
            />
          )}
          <h2>Levantamiento inicial de {homeName}</h2>
          <p>
            El Excel usa las columnas ID, EXISTENCIA, COSTO y PRECIODETALLE. Los
            productos nuevos se crean con cero unidades en {storeName}. Los
            productos con lote se cuentan por lote.
          </p>
          <label
            className="nx-file-dropzone"
            htmlFor="casa-excel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              selectImportFile(event.dataTransfer.files?.[0] || null);
            }}
          >
            <input
              className="sr-only"
              id="casa-excel"
              type="file"
              aria-label={`Excel de ${homeName}`}
              accept=".xlsx"
              onChange={(event) =>
                selectImportFile(event.target.files?.[0] || null)
              }
            />
            <strong>Arrastra tu archivo Excel aquí</strong>
            <span>o presiona para seleccionar un archivo .xlsx</span>
            <small>{file ? file.name : "Ningún archivo seleccionado"}</small>
          </label>
          <Button disabled={!file || busy} onClick={() => upload("preview")}>
            Revisar archivo
          </Button>
          {preview && (
            <div role="status">
              <p>
                {preview.rows} filas · {preview.blocking.length} problemas
              </p>
              {preview.changes?.length > 0 && (
                <div className="table-wrap" tabIndex={0}>
                  <table
                    aria-label={`Cambios del levantamiento de ${homeName}`}
                  >
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Producto</th>
                        <th>Existencia actual en {homeName}</th>
                        <th>Existencia después de cargar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.changes.map((change: any, index: number) => (
                        <tr key={`${change.id}-${index}`}>
                          <td>{change.id}</td>
                          <td>{change.name}</td>
                          <td>{change.before}</td>
                          <td>{change.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {preview.blocking.map((b: any, i: number) => (
                <p key={i}>
                  Fila {b.row}: {b.message}
                </p>
              ))}
              {preview.canApply && (
                <Button disabled={busy} onClick={() => upload("apply")}>
                  Cargar en {homeName}
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <h2>Historial de traspasos</h2>
      <div className="table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Desde</th>
              <th>Hasta</th>
              <th>Producto</th>
              <th>Cantidad</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {(transfers.data || []).flatMap((t) =>
              t.lines.map((l: any) => (
                <tr key={l.id}>
                  <td>{dateLabel(t.createdAt)}</td>
                  <td>{t.from.name}</td>
                  <td>{t.to.name}</td>
                  <td>{l.variant.product.name}</td>
                  <td>{l.qty}</td>
                  <td>{t.reason}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
