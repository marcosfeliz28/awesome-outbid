// «Importar inventario» (sólo administración): se elige el Excel, se revisa una
// vista previa en español (qué se crea, qué cambia de existencia, precio y
// costo, qué no se toca) y sólo entonces se habilita «Cargar inventario». El
// archivo se envía al servidor únicamente para esta revisión y esta carga: no
// se guarda en ningún lado.
import { useId, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { Badge, Button, Modal } from "@fitstore/ui";
import { api } from "./api";
import { toast } from "./helpers";
import "./inventoryImport.css";

type Problem = { row?: number; message: string };
type Change = {
  id: string;
  name: string;
  category: string;
  kind: "existencia" | "precio" | "costo";
  before: number;
  after: number;
};
type Category = {
  name: string;
  nuevos: number;
  existencias: number;
  precios: number;
  costos: number;
  sinCambios: number;
  noVienen: number;
};
export type ImportPreview = {
  fileName: string;
  hash: string;
  state: string;
  canApply: boolean;
  blocking: Problem[];
  rows: number;
  summary?: Record<string, number>;
  categories?: Category[];
  changes?: Change[];
  newCategories?: string[];
  lotCategories?: string[];
  review?: {
    id: string;
    name: string;
    category: string;
    qty: number;
    active: boolean;
    notes: string[];
  }[];
};

const n = (value: number) =>
  value.toLocaleString("es-DO", { maximumFractionDigits: 3 });
const money = (value: number) =>
  value.toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Los cambios de precio más grandes, por porcentaje y luego por monto. */
export function biggestPriceChanges(changes: Change[], limit = 20) {
  const pct = (c: Change) =>
    c.before > 0 ? Math.abs(c.after - c.before) / c.before : 1;
  return changes
    .filter((c) => c.kind === "precio")
    .sort(
      (a, b) =>
        pct(b) - pct(a) ||
        Math.abs(b.after - b.before) - Math.abs(a.after - a.before),
    )
    .slice(0, limit);
}
const KIND = { existencia: "Existencia", precio: "Precio", costo: "Costo" };
/** CSV de todos los cambios (Excel lo abre; ; como separador, como el resto de la tienda). */
export function changesCsv(changes: Change[]) {
  const quote = (v: string | number) =>
    '"' +
    String(v)
      .replace(/"/g, '""')
      .replace(/^([=+\-@\t\r])/, "'$1") +
    '"';
  return (
    "﻿" +
    [
      ["ID", "Producto", "Categoría", "Qué cambia", "Antes", "Después"],
      ...changes.map((c) => [
        c.id,
        c.name,
        c.category,
        KIND[c.kind],
        c.before,
        c.after,
      ]),
    ]
      .map((r) => r.map(quote).join(";"))
      .join("\r\n")
  );
}
const MAX_BYTES = 5 * 1024 * 1024;

export function InventoryImportButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Upload size={16} />
        Importar inventario
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Importar inventario"
        wide
      >
        {open && <InventoryImport onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function InventoryImport({ onDone }: { onDone: () => void }) {
  const client = useQueryClient();
  const ids = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stock, setStock] = useState(true);
  const [prices, setPrices] = useState(true);
  const [noLots, setNoLots] = useState(false);
  // Sólo vale la respuesta de la última revisión pedida.
  const latest = useRef(0);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"" | "preview" | "apply">("");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ImportPreview | null>(null);

  const form = (f: File, extra: Record<string, string> = {}) => {
    const data = new FormData();
    data.append("file", f);
    data.append("updatePrices", String(prices));
    data.append("updateStock", String(stock));
    data.append("withoutLots", String(noLots));
    for (const [k, v] of Object.entries(extra)) data.append(k, v);
    return data;
  };
  async function review(
    f: File | null = file,
    options?: { stock?: boolean; prices?: boolean; noLots?: boolean },
  ) {
    if (!f) return;
    setError("");
    setPreview(null);
    setConfirmed(false);
    if (!/\.xlsx$/i.test(f.name)) {
      setError("El archivo debe ser un Excel (.xlsx).");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(
        "El archivo pesa más de 5 MB. Revisa que sea el listado correcto.",
      );
      return;
    }
    const mine = ++latest.current;
    setBusy("preview");
    try {
      const data = new FormData();
      data.append("file", f);
      data.append("updatePrices", String(options?.prices ?? prices));
      data.append("updateStock", String(options?.stock ?? stock));
      data.append("withoutLots", String(options?.noLots ?? noLots));
      const result = await api<ImportPreview>("/inventory-import/preview", {
        method: "POST",
        body: data,
        timeout: 120_000,
      });
      if (mine === latest.current) setPreview(result);
    } catch (e) {
      if (mine !== latest.current) return;
      setError(
        e instanceof Error && e.message
          ? e.message
          : "No pudimos revisar el archivo. Inténtalo de nuevo.",
      );
    } finally {
      if (mine === latest.current) setBusy("");
    }
  }
  async function apply() {
    if (!file || !preview) return;
    setBusy("apply");
    setError("");
    try {
      const done = await api<ImportPreview>("/inventory-import/apply", {
        method: "POST",
        body: form(file, { hash: preview.hash, state: preview.state }),
        timeout: 180_000,
      });
      setResult(done);
      setPreview(null);
      toast("Inventario cargado.");
      await client.invalidateQueries();
    } catch (e) {
      setError(
        (e instanceof Error && e.message) ||
          "No se pudo cargar el inventario. No se guardó nada.",
      );
      setPreview(null);
    } finally {
      setBusy("");
    }
  }

  if (result?.summary) {
    const s = result.summary;
    return (
      <div className="inv-import">
        <div role="status" className="inv-ok">
          <h3>Listo: el inventario quedó cargado</h3>
          <ul>
            <li>{n(s.nuevos)} productos nuevos creados.</li>
            <li>
              {n(s.existencias)} existencias ajustadas como «Conteo» en el
              kardex.
            </li>
            <li>
              {n(s.precios)} precios y {n(s.costos)} costos actualizados.
            </li>
            <li>{n(s.sinCambios)} productos sin cambios.</li>
          </ul>
          <p>Todo quedó anotado en la bitácora con tu usuario.</p>
        </div>
        <div className="inv-actions">
          <Button onClick={onDone}>Cerrar</Button>
        </div>
      </div>
    );
  }

  const s = preview?.summary;
  const top = preview?.changes ? biggestPriceChanges(preview.changes) : [];
  const download = () => {
    if (!preview?.changes) return;
    const url = URL.createObjectURL(
      new Blob([changesCsv(preview.changes)], {
        type: "text/csv;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "cambios-inventario.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="inv-import">
      <p className="inv-lead">
        Sube el Excel del inventario (columnas ID, DESCRIPCION, REFERENCIA,
        SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y PRECIO DETALLE). Primero
        verás una <strong>vista previa</strong>: no se cambia nada hasta que
        pulses «Cargar inventario».
      </p>
      <div className="field">
        <label htmlFor={ids + "file"}>
          Archivo de Excel (.xlsx, hasta 5 MB)
        </label>
        <input
          id={ids + "file"}
          ref={input}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setResult(null);
            setNoLots(false);
            if (f) void review(f, { noLots: false });
          }}
        />
      </div>
      <fieldset className="inv-options">
        <legend>Qué hacer con los productos que ya existen</legend>
        <label>
          <input
            type="checkbox"
            checked={stock}
            onChange={(e) => {
              setStock(e.target.checked);
              if (file) void review(file, { stock: e.target.checked, prices });
            }}
          />
          Actualizar existencias (queda como «Conteo» en el kardex)
        </label>
        <label>
          <input
            type="checkbox"
            checked={prices}
            onChange={(e) => {
              setPrices(e.target.checked);
              if (file) void review(file, { stock, prices: e.target.checked });
            }}
          />
          Actualizar precios y costos
        </label>
        <p>Lo que no viene en el archivo nunca se toca.</p>
      </fieldset>
      <p className="inv-warn">
        Hazlo con la tienda cerrada o sin ventas: mientras se carga (puede
        tardar unos segundos) las ventas de estos productos esperan.
      </p>
      {busy === "preview" && (
        <p role="status" className="inv-wait">
          Revisando el archivo…
        </p>
      )}
      {error && (
        <p role="alert" className="inv-error">
          {error}
        </p>
      )}
      {preview && !!preview.lotCategories?.length && (
        <div
          className="inv-options"
          role="group"
          aria-label="Categorías con lote"
        >
          <p className="inv-warn">
            {preview.lotCategories.length === 1
              ? "La categoría "
              : "Las categorías "}
            «{preview.lotCategories.join("», «")}» exige lote y vencimiento y el
            Excel no los trae. Para cargar, el control de lote y vencimiento se
            desactivará en{" "}
            {preview.lotCategories.length === 1 ? "ella" : "ellas"}.
          </p>
          <label>
            <input
              type="checkbox"
              checked={noLots}
              onChange={(e) => {
                setNoLots(e.target.checked);
                if (file) void review(file, { noLots: e.target.checked });
              }}
            />
            Cargar sin lotes (queda en la bitácora)
          </label>
        </div>
      )}
      {preview && !preview.canApply && (
        <div role="alert" className="inv-error">
          <h3>Hay que corregir el archivo antes de cargar</h3>
          <p>
            No se guardó nada. Corrige estas filas en el Excel y súbelo otra
            vez:
          </p>
          <ul>
            {preview.blocking.slice(0, 50).map((p, i) => (
              <li key={i}>
                {p.row && !/^fila /i.test(p.message) ? (
                  <strong>Fila {p.row} del Excel: </strong>
                ) : null}
                {p.message}
              </li>
            ))}
          </ul>
          {preview.blocking.length > 50 && (
            <p>… y {preview.blocking.length - 50} problemas más.</p>
          )}
        </div>
      )}
      {preview && s && (
        <section aria-label="Vista previa" className="inv-preview">
          <h3>Esto es lo que pasará con «{preview.fileName}»</h3>
          <dl className="inv-summary">
            <div>
              <dt>Productos en el archivo</dt>
              <dd>{n(s.leidos)}</dd>
            </div>
            <div>
              <dt>Productos nuevos</dt>
              <dd>{n(s.nuevos)}</dd>
            </div>
            <div>
              <dt>Existencias que cambian</dt>
              <dd>
                {n(s.existencias)}
                <small>
                  {" "}
                  (suben {n(s.unidadesSuben)} u., bajan {n(s.unidadesBajan)} u.)
                </small>
              </dd>
            </div>
            <div>
              <dt>Precios que cambian</dt>
              <dd>{n(s.precios)}</dd>
            </div>
            <div>
              <dt>Costos que cambian</dt>
              <dd>{n(s.costos)}</dd>
            </div>
            <div>
              <dt>Sin cambios</dt>
              <dd>{n(s.sinCambios)}</dd>
            </div>
            <div>
              <dt>Sin precio o costo (quedan inactivos)</dt>
              <dd>{n(s.sinDatos)}</dd>
            </div>
            <div>
              <dt>Agotados</dt>
              <dd>{n(s.agotados)}</dd>
            </div>
            <div>
              <dt>Margen bajo</dt>
              <dd>{n(s.margenBajo)}</dd>
            </div>
            <div>
              <dt>En la tienda y no en el archivo (no se tocan)</dt>
              <dd>{n(s.noVienen)}</dd>
            </div>
          </dl>
          {!!preview.newCategories?.length && (
            <p className="inv-warn">
              Se crearán estas categorías: {preview.newCategories.join(", ")}.
            </p>
          )}
          {!!preview.categories?.length && (
            <div className="inv-scroll">
              <table>
                <caption>Por categoría</caption>
                <thead>
                  <tr>
                    <th scope="col">Categoría</th>
                    <th scope="col">Nuevos</th>
                    <th scope="col">Existencias</th>
                    <th scope="col">Precios</th>
                    <th scope="col">Costos</th>
                    <th scope="col">Sin cambios</th>
                    <th scope="col">No vienen</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.categories.map((c) => (
                    <tr key={c.name}>
                      <th scope="row">{c.name}</th>
                      <td>{n(c.nuevos)}</td>
                      <td>{n(c.existencias)}</td>
                      <td>{n(c.precios)}</td>
                      <td>{n(c.costos)}</td>
                      <td>{n(c.sinCambios)}</td>
                      <td>{n(c.noVienen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!!top.length && (
            <div className="inv-scroll">
              <table>
                <caption>
                  Los {top.length} cambios de precio más grandes
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Producto</th>
                    <th scope="col">Antes</th>
                    <th scope="col">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">
                        {c.name} <small>({c.id})</small>
                      </th>
                      <td>{money(c.before)}</td>
                      <td>{money(c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!!preview.changes?.length && (
            <Button variant="ghost" onClick={download}>
              Descargar la lista de todos los cambios (.csv)
            </Button>
          )}
          {!!preview.review?.length && (
            <details>
              <summary>
                Avisos para revisar ({preview.review.length}): sin precio,
                margen bajo, agotados
              </summary>
              <ul className="inv-notes">
                {preview.review.slice(0, 200).map((r) => (
                  <li key={r.id}>
                    <strong>{r.name}</strong> ({r.id}){" "}
                    {!r.active && <Badge tone="amber">Inactivo</Badge>}:{" "}
                    {r.notes.join("; ")}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {preview.canApply && (
            <div className="inv-confirm">
              <label>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Revisé la vista previa y quiero cargar este inventario. Entiendo
                que cambiará las existencias y los precios indicados.
              </label>
              <div className="inv-actions">
                <Button
                  disabled={!confirmed || busy !== ""}
                  onClick={() => void apply()}
                >
                  {busy === "apply" ? "Cargando…" : "Cargar inventario"}
                </Button>
                <Button variant="ghost" onClick={onDone}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
