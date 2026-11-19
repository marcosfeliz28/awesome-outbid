import { useLanguage } from "./inicioLanguage";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { can } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { FormModal, toast, dateLabel } from "./helpers";

type Warehouse = { id: string; name: string; kind: string; sellable: boolean };
export function WarehousesPanel({
  rows,
  warehouseId,
}: {
  rows: any[];
  warehouseId: string;
}) {
  const en = useLanguage() === "en";
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
  const selected = warehouses.data?.find((w) => w.id === warehouseId);
  const home = warehouses.data?.find((w) => w.kind === "home");
  const store = warehouses.data?.find((w) => w.kind === "store");
  const defaultFrom = selected?.id || store?.id || home?.id || "";
  const defaultTo =
    warehouses.data?.find((w) => w.id !== defaultFrom)?.id || "";
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
        toast(
          en ? "Home stock count applied." : "Levantamiento de Casa aplicado.",
        );
        await client.invalidateQueries();
      }
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : en
            ? "The file could not be uploaded."
            : "No se pudo cargar el archivo.",
        true,
      );
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel"
      aria-label={en ? "Warehouses and transfers" : "Almacenes y traspasos"}
    >
      <h2>{en ? "Where the goods are" : "Dónde está la mercancía"}</h2>
      <div className="table-toolbar">
        <span>
          {en
            ? "Product · Store · Home · Total"
            : "Producto · Tienda · Casa · Total"}
          {can(user.permissions, "profit:read")
            ? en
              ? " · Value at cost"
              : " · Valor a costo"
            : ""}
        </span>
      </div>
      <div className="table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>{en ? "Product" : "Producto"}</th>
              <th>{en ? "Store" : "Tienda"}</th>
              <th>{en ? "Home" : "Casa"}</th>
              <th>Total</th>
              {can(user.permissions, "profit:read") && (
                <th>{en ? "Value at cost" : "Valor a costo"}</th>
              )}
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
          <h2>{en ? "Transfer goods" : "Traspasar mercancía"}</h2>
          <p>
            {en
              ? "The movement subtracts from the source and adds to the destination in a single operation."
              : "El movimiento resta del origen y suma al destino en una sola operación."}
          </p>
          <label htmlFor="transfer-product">
            {en ? "Product" : "Producto"}
          </label>
          <select
            id="transfer-product"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            <option value="">
              {en ? "Choose a product" : "Elige un producto"}
            </option>
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
            {en ? "Transfer" : "Traspasar"}
          </Button>
          {transfer && (
            <FormModal
              english={en}
              title={`${en ? "Transfer" : "Traspasar"} · ${transfer.product.name}`}
              onClose={() => setTransfer(null)}
              fields={[
                {
                  key: "fromId",
                  label: en ? "From" : "Desde",
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
                  label: en ? "To" : "Hasta",
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
                  label: en ? "Quantity" : "Cantidad",
                  type: "number",
                  required: true,
                  min: 0.001,
                  step: "0.001",
                },
                {
                  key: "lotId",
                  label: en ? "Batch (if applicable)" : "Lote (si aplica)",
                  type: "select",
                  options: transfer.lots.map((l: any) => ({
                    label: l.lotNumber,
                    value: l.id,
                  })),
                },
                {
                  key: "reason",
                  label: en ? "Reason" : "Motivo",
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
          <h2>
            {en ? "Initial Home stock count" : "Levantamiento inicial de Casa"}
          </h2>
          <p>
            {en
              ? "The spreadsheet uses columns ID, EXISTENCIA, COSTO and PRECIODETALLE (no space). New products are created with zero units in Store. Batch-tracked products are counted by batch."
              : "El Excel usa las columnas ID, EXISTENCIA, COSTO y PRECIODETALLE (sin espacio). Los productos nuevos se crean con cero unidades en Tienda. Los productos con lote se cuentan por lote."}
          </p>
          <div className="casa-import-actions">
            <label htmlFor="casa-excel">
              {en ? "Home spreadsheet" : "Excel de Casa"}
            </label>
            <input
              id="casa-excel"
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
              }}
            />
            <Button disabled={!file || busy} onClick={() => upload("preview")}>
              {en ? "Review file" : "Revisar archivo"}
            </Button>
          </div>
          {preview && (
            <div role="status">
              <p>
                {preview.rows} {en ? "rows" : "filas"} ·{" "}
                {preview.blocking.length} {en ? "issues" : "problemas"}
              </p>
              {preview.changes?.length > 0 && (
                <div className="table-wrap" tabIndex={0}>
                  <table
                    aria-label={
                      en
                        ? "Home stock count changes"
                        : "Cambios del levantamiento de Casa"
                    }
                  >
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>{en ? "Product" : "Producto"}</th>
                        <th>
                          {en
                            ? "Current stock at Home"
                            : "Existencia actual en Casa"}
                        </th>
                        <th>
                          {en
                            ? "Stock after import"
                            : "Existencia después de cargar"}
                        </th>
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
                  {en ? "Row" : "Fila"} {b.row}: {b.message}
                </p>
              ))}
              {preview.canApply && (
                <Button disabled={busy} onClick={() => upload("apply")}>
                  {en ? "Import into Home" : "Cargar en Casa"}
                </Button>
              )}
            </div>
          )}
        </>
      )}
      <h2>{en ? "Transfer history" : "Historial de traspasos"}</h2>
      <div className="table-wrap" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th>{en ? "Date" : "Fecha"}</th>
              <th>{en ? "From" : "Desde"}</th>
              <th>{en ? "To" : "Hasta"}</th>
              <th>{en ? "Product" : "Producto"}</th>
              <th>{en ? "Quantity" : "Cantidad"}</th>
              <th>{en ? "Reason" : "Motivo"}</th>
            </tr>
          </thead>
          <tbody>
            {(transfers.data || []).flatMap((t) =>
              t.lines.map((l: any) => (
                <tr key={l.id}>
                  <td>
                    {en
                      ? new Date(t.createdAt).toLocaleString("en-US")
                      : dateLabel(t.createdAt)}
                  </td>
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
