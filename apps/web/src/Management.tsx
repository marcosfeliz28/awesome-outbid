import {
  CashElsewhere,
  Equipment,
  cashOnOtherDevice,
  registerTerminal,
  terminalIdentity,
} from "./realtime";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  Download,
  Upload,
  Eye,
  Pencil,
  Printer,
  Sparkles,
  ArrowRight,
  Wallet,
  RefreshCw,
  FileText,
  ChevronRight,
  AlertTriangle,
  Boxes,
  ArrowDownToLine,
} from "lucide-react";
import { Button, Badge, Modal, Empty } from "@fitstore/ui";
import { formatMoney, can } from "@fitstore/shared";
import {
  api,
  post,
  loadCatalog,
  useStore,
  download,
  localDB,
  syncSales,
  type Product,
} from "./api";
import {
  QueryState,
  FormModal,
  ConfirmModal,
  type Field,
  attrLabel,
  dateLabel,
  today,
  toast,
  mutate,
} from "./helpers";
import { PurchaseEditor, ReceiptEditor, ReceiptHistory } from "./Purchases";
import {
  CloseCashModal,
  CodPending,
  ProofThumb,
  uploadProof,
  DayReports,
  PrintModal,
  SessionPrintButtons,
  StoreSettings,
  type Printing,
} from "./Tienda";
import { METHOD_LABEL, printSoon } from "./Prints";
import {
  applyPendingSaleReprice,
  discardPendingSale,
  isPendingPriceConflict,
} from "./pendingSales";

type Column = {
  label: string;
  render: (row: any) => ReactNode;
  className?: string;
};
function DataTable({
  rows,
  columns,
  empty = "Todavía no hay registros",
}: {
  rows: any[];
  columns: Column[];
  empty?: string;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length]);
  const totalPages = Math.ceil(rows.length / 20);
  return rows.length ? (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.label} className={c.className}>
                  {c.label.toUpperCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice((page - 1) * 20, page * 20).map((r, index) => (
              <tr key={r.id || r.sku || index}>
                {columns.map((c) => (
                  <td key={c.label} className={c.className}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="pagination">
          <span>
            {rows.length} registros · Página {page} de {totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="ghost"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </>
  ) : (
    <Empty
      title={empty}
      description="Cada registro te ayuda a conocer mejor tu negocio."
    />
  );
}
function Heading({
  title,
  caption,
  children,
}: {
  title: string;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">TU NEGOCIO, CON CLARIDAD</span>
        <h1>{title}</h1>
        <p>{caption}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
function Filter({
  value,
  onChange,
  placeholder = "Buscar…",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="table-search">
      <Search size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
const requiredNumber = (key: string, label: string, initial = 0): Field => ({
  key,
  label,
  type: "number",
  required: true,
  min: 0,
  initial,
});
const paymentOptions = [
  { label: "Efectivo", value: "cash" },
  { label: "Tarjeta", value: "card" },
  { label: "Transferencia", value: "transfer" },
];

export function Catalog() {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api("/categories"),
  });
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [create, setCreate] = useState(false),
    [detail, setDetail] = useState<Product | null>(null),
    [matrix, setMatrix] = useState<Product | null>(null),
    [editing, setEditing] = useState<any>(null),
    [labels, setLabels] = useState<Product | null>(null);
  const [tab, setTab] = useState("General");
  const write = can(user.permissions, "catalog:write");
  const rows =
    query.data?.filter(
      (p) =>
        (!category || p.categoryId === category) &&
        [p.name, p.sku, p.brand]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    ) || [];
  const fields: Field[] = [
    { key: "name", label: "Nombre del producto", required: true },
    { key: "sku", label: "SKU", required: true },
    {
      key: "categoryId",
      label: "Categoría",
      type: "select",
      required: true,
      options: cats.data?.map((c: any) => ({ label: c.name, value: c.id })),
    },
    { key: "brand", label: "Marca", initial: "Nexora" },
    { key: "barcode", label: "Código de barras", required: true },
    requiredNumber("price", "Precio de venta"),
    requiredNumber("costAvg", "Costo de entrada"),
    requiredNumber("minStock", "Stock mínimo", 5),
    {
      key: "imageUrl",
      label: "URL de la foto",
      initial: "/products/accessories.svg",
    },
    { key: "description", label: "Descripción", type: "textarea" },
  ];
  return (
    <>
      <Heading
        title="Tu catálogo, con personalidad"
        caption="Cada producto, cada variante y cada oportunidad, en su lugar."
      >
        {write && (
          <>
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  "/catalog-template.xlsx",
                  "plantilla-productos.xlsx",
                ).catch((e) => toast(e.message, true))
              }
            >
              <Download size={16} />
              Plantilla
            </Button>
            <label className="button secondary">
              <Upload size={16} />
              Importar Excel
              <input
                type="file"
                accept=".xlsx"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const data = new FormData();
                      data.append("file", file);
                      const result = await api("/products/import", {
                        method: "POST",
                        body: data,
                      });
                      toast(`${result.imported} productos importados.`);
                      await client.invalidateQueries();
                    } catch (e: any) {
                      toast(e.message, true);
                    }
                    e.target.value = "";
                  }
                }}
              />
            </label>
            <Button onClick={() => setCreate(true)}>
              <Plus size={17} />
              Nuevo producto
            </Button>
          </>
        )}
      </Heading>
      <div className="panel">
        <div className="table-toolbar">
          <Filter
            value={search}
            onChange={setSearch}
            placeholder="Buscar nombre, SKU o marca"
          />
          <select
            aria-label="Filtrar por categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {cats.data?.map((c: any) => (
              <option value={c.id} key={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Badge tone="violet">{rows.length} productos</Badge>
        </div>
        <QueryState query={query}>
          <DataTable
            rows={rows}
            columns={[
              {
                label: "Producto",
                render: (p) => (
                  <div className="table-product">
                    <img
                      src={p.imageUrl || "/products/accessories.svg"}
                      alt=""
                    />
                    <div>
                      <strong>{p.name}</strong>
                      <small>
                        {p.sku} · {p.brand}
                      </small>
                    </div>
                  </div>
                ),
              },
              {
                label: "Categoría",
                render: (p) => <Badge>{p.category.name}</Badge>,
              },
              { label: "Variantes", render: (p) => p.variants.length },
              {
                label: "Precio",
                render: (p) => formatMoney(p.variants[0]?.price || 0),
              },
              {
                label: "Stock",
                render: (p) => {
                  const stock = p.variants.reduce(
                    (a: number, v: any) => a + Number(v.stock),
                    0,
                  );
                  return (
                    <Badge
                      tone={stock <= Number(p.minStock) ? "warning" : "success"}
                    >
                      {stock} unidades
                    </Badge>
                  );
                },
              },
              {
                label: "Acciones",
                render: (p) => (
                  <div className="table-actions">
                    <button
                      aria-label={"Ver " + p.name}
                      onClick={() => {
                        setDetail(p);
                        setTab("General");
                      }}
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      aria-label={"Etiquetas de " + p.name}
                      onClick={() => setLabels(p)}
                    >
                      <Printer size={17} />
                    </button>
                    {write && (
                      <button
                        aria-label={"Variantes de " + p.name}
                        onClick={() => setMatrix(p)}
                      >
                        <Boxes size={17} />
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </QueryState>
      </div>
      {create && (
        <FormModal
          title="Un nuevo producto para tu tienda"
          fields={fields}
          onClose={() => setCreate(false)}
          onSubmit={(values) => {
            const { barcode, price, costAvg, ...data } = values;
            return post("/products", {
              ...data,
              variants: [{ sku: data.sku, barcode, price, costAvg }],
            });
          }}
        />
      )}
      {matrix && (
        <FormModal
          title={"Crear variantes · " + matrix.name}
          fields={[
            {
              key: "attribute1",
              label: "Primer atributo",
              initial: "talla",
              required: true,
            },
            {
              key: "values1",
              label: "Valores separados por coma",
              initial: "S,M,L",
              required: true,
            },
            { key: "attribute2", label: "Segundo atributo", initial: "color" },
            {
              key: "values2",
              label: "Valores separados por coma",
              initial: "Negro,Azul",
            },
            requiredNumber("price", "Precio", Number(matrix.variants[0].price)),
            requiredNumber(
              "costAvg",
              "Costo",
              Number(matrix.variants[0].costAvg || 0),
            ),
          ]}
          onClose={() => setMatrix(null)}
          onSubmit={(values) =>
            post("/products/" + matrix.id + "/variants", {
              attributes: {
                [values.attribute1]: values.values1
                  .split(",")
                  .map((v: string) => v.trim()),
                ...(values.attribute2 && values.values2
                  ? {
                      [values.attribute2]: values.values2
                        .split(",")
                        .map((v: string) => v.trim()),
                    }
                  : {}),
              },
              price: values.price,
              costAvg: values.costAvg,
            })
          }
        />
      )}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name || "Producto"}
        wide
      >
        <div className="tabs">
          {["General", "Variantes", "Lotes", "Kardex"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {detail &&
          (tab === "General" ? (
            <div className="product-detail">
              <img src={detail.imageUrl} alt={detail.name} />
              <div>
                <Badge tone="violet">{detail.category.name}</Badge>
                <h2>{detail.name}</h2>
                <p>
                  {detail.brand} · {detail.sku}
                </p>
                <p>
                  Stock mínimo: {detail.minStock} · Stock máximo:{" "}
                  {detail.maxStock}
                </p>
                <p>ITBIS: {detail.taxRate}%</p>
                {write && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setEditing({ type: "product", data: detail })
                    }
                  >
                    <Pencil size={16} />
                    Editar producto
                  </Button>
                )}
              </div>
            </div>
          ) : tab === "Variantes" ? (
            <DataTable
              rows={detail.variants}
              columns={[
                { label: "Variante", render: (v) => attrLabel(v.attributes) },
                {
                  label: "SKU / Código",
                  render: (v) => (
                    <span>
                      {v.sku}
                      <small>{v.barcode}</small>
                    </span>
                  ),
                },
                { label: "Precio", render: (v) => formatMoney(v.price) },
                { label: "Stock", render: (v) => v.stock },
                ...(can(user.permissions, "profit:read")
                  ? [
                      {
                        label: "Costo",
                        render: (v: any) => formatMoney(v.costAvg),
                      },
                    ]
                  : []),
                {
                  label: "Acción",
                  render: (v) =>
                    write && (
                      <button
                        className="text-link"
                        onClick={() => setEditing({ type: "variant", data: v })}
                      >
                        Editar precio
                      </button>
                    ),
                },
              ]}
            />
          ) : tab === "Lotes" ? (
            <DataTable
              rows={detail.variants.flatMap((v) =>
                (v.lots || []).map((l) => ({ ...l, sku: v.sku })),
              )}
              columns={[
                { label: "SKU", render: (l) => l.sku },
                { label: "Lote", render: (l) => l.lotNumber },
                {
                  label: "Vencimiento",
                  render: (l) =>
                    l.expiryDate ? dateLabel(l.expiryDate) : "No aplica",
                },
                { label: "Cantidad", render: (l) => l.qty },
              ]}
            />
          ) : (
            <Kardex variantId={detail.variants[0].id} />
          ))}
      </Modal>
      {editing && (
        <FormModal
          title={
            editing.type === "product"
              ? "Editar producto"
              : "Editar variante y precio"
          }
          initial={editing.data}
          fields={
            editing.type === "product"
              ? [
                  { key: "name", label: "Nombre", required: true },
                  { key: "brand", label: "Marca" },
                  requiredNumber("minStock", "Stock mínimo"),
                  requiredNumber("maxStock", "Stock máximo"),
                  { key: "imageUrl", label: "Foto URL" },
                  { key: "active", label: "Producto activo", type: "checkbox" },
                ]
              : [
                  requiredNumber("price", "Precio"),
                  requiredNumber("costAvg", "Costo promedio"),
                  { key: "barcode", label: "Código de barras", required: true },
                ]
          }
          onClose={() => setEditing(null)}
          onSubmit={async (data) => {
            await mutate(
              "/" +
                (editing.type === "product" ? "products" : "variants") +
                "/" +
                editing.data.id,
              data,
              "PATCH",
            );
            setDetail(null);
          }}
        />
      )}
      <Modal
        open={!!labels}
        onClose={() => setLabels(null)}
        title="Etiquetas de código de barras"
      >
        <p>Imprime las etiquetas de cada variante.</p>
        <div className="barcode-labels receipt-only-on-print">
          {labels?.variants.map((v) => (
            <div className="barcode-label" key={v.id}>
              <strong>{labels.name}</strong>
              <small>{attrLabel(v.attributes)}</small>
              <Barcode value={v.barcode} />
              <span>{v.barcode}</span>
              <b>{formatMoney(v.price)}</b>
            </div>
          ))}
        </div>
        <Button onClick={() => window.print()}>
          <Printer size={17} />
          Imprimir etiquetas
        </Button>
      </Modal>
    </>
  );
}
export function Barcode({ value }: { value: string }) {
  const patterns = [
    "nnnwwnwnn",
    "wnnwnnnnw",
    "nnwwnnnnw",
    "wnwwnnnnn",
    "nnnwwnnnw",
    "wnnwwnnnn",
    "nnwwwnnnn",
    "nnnwnnwnw",
    "wnnwnnwnn",
    "nnwwnnwnn",
    "wnnnnwnnw",
    "nnwnnwnnw",
    "wnwnnwnnn",
    "nnnnwwnnw",
    "wnnnwwnnn",
    "nnwnwwnnn",
    "nnnnnwwnw",
    "wnnnnwwnn",
    "nnwnnwwnn",
    "nnnnwwwnn",
    "wnnnnnnww",
    "nnwnnnnww",
    "wnwnnnnwn",
    "nnnnwnnww",
    "wnnnwnnwn",
    "nnwnwnnwn",
    "nnnnnnwww",
    "wnnnnnwwn",
    "nnwnnnwwn",
    "nnnnwnwwn",
    "wwnnnnnnw",
    "nwwnnnnnw",
    "wwwnnnnnn",
    "nwnnwnnnw",
    "wwnnwnnnn",
    "nwwnwnnnn",
    "nwnnnnwnw",
    "wwnnnnwnn",
    "nwwnnnwnn",
    "nwnwnwnnn",
    "nwnwnnnwn",
    "nwnnnwnwn",
    "nnnwnwnwn",
    "nwnnwnwnn",
  ];
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*";
  let x = 0;
  const bars: any[] = [];
  for (const c of "*" + value.toUpperCase() + "*") {
    const pattern = patterns[chars.indexOf(c)];
    if (!pattern) return <span>Código no imprimible en Code 39</span>;
    [...pattern].forEach((w, i) => {
      const width = w === "w" ? 3 : 1;
      if (i % 2 === 0)
        bars.push(
          <rect key={bars.length} x={x} y={0} width={width} height={40} />,
        );
      x += width;
    });
    x++;
  }
  return (
    <svg
      viewBox={`-10 0 ${x + 20} 40`}
      height="42"
      aria-label={"Código de barras " + value}
    >
      {bars}
    </svg>
  );
}
function Kardex({ variantId }: { variantId: string }) {
  const query = useQuery({
    queryKey: ["movements", variantId],
    queryFn: () => api("/inventory/movements?variantId=" + variantId),
  });
  return (
    <QueryState query={query}>
      <DataTable
        rows={query.data || []}
        columns={[
          { label: "Fecha", render: (m) => dateLabel(m.createdAt) },
          { label: "Tipo", render: (m) => <Badge>{m.type}</Badge> },
          { label: "Cantidad", render: (m) => m.qty },
          { label: "Saldo", render: (m) => m.balanceAfter },
          { label: "Motivo", render: (m) => m.reason },
        ]}
      />
    </QueryState>
  );
}

export function Inventory() {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["stock"],
    queryFn: () => api("/inventory/stock"),
  });
  const counts = useQuery({
    queryKey: ["counts"],
    queryFn: () => api("/inventory/counts"),
  });
  const [search, setSearch] = useState(""),
    [mode, setMode] = useState("stock"),
    [adjust, setAdjust] = useState<any>(null),
    [count, setCount] = useState<any>(null),
    [kardex, setKardex] = useState<any>(null);
  const rows = (query.data || []).filter((v: any) =>
    [v.sku, v.barcode, v.product.name]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Cada unidad, bajo control"
        caption="El inventario correcto hace espacio para mejores decisiones."
      />
      <div className="panel">
        <div className="table-toolbar">
          <div className="tabs">
            <button
              className={mode === "stock" ? "active" : ""}
              onClick={() => setMode("stock")}
            >
              Stock actual
            </button>
            <button
              className={mode === "counts" ? "active" : ""}
              onClick={() => setMode("counts")}
            >
              Conteos físicos
            </button>
          </div>
          <Filter
            value={search}
            onChange={setSearch}
            placeholder="Buscar producto o código"
          />
        </div>
        <QueryState query={query}>
          {mode === "stock" ? (
            <DataTable
              rows={rows}
              columns={[
                {
                  label: "Producto / Variante",
                  render: (v) => (
                    <span>
                      <strong>{v.product.name}</strong>
                      <small>
                        {v.sku} · {attrLabel(v.attributes)}
                      </small>
                    </span>
                  ),
                },
                {
                  label: "Stock",
                  render: (v) => (
                    <Badge
                      tone={
                        Number(v.stock) <= Number(v.product.minStock)
                          ? "warning"
                          : "success"
                      }
                    >
                      {v.stock}
                    </Badge>
                  ),
                },
                {
                  label: "Lote más próximo",
                  render: (v) =>
                    v.lots.find((l: any) => Number(l.qty) > 0)?.lotNumber ||
                    "Sin lote",
                },
                {
                  label: "Vencimiento",
                  render: (v) => {
                    const lot = v.lots
                      .filter((l: any) => Number(l.qty) > 0 && l.expiryDate)
                      .sort(
                        (a: any, b: any) =>
                          +new Date(a.expiryDate) - +new Date(b.expiryDate),
                      )[0];
                    return lot ? dateLabel(lot.expiryDate) : "No aplica";
                  },
                },
                {
                  label: "Acciones",
                  render: (v) => (
                    <div className="table-actions">
                      <button
                        className="text-link"
                        onClick={() => setAdjust(v)}
                      >
                        Ajustar
                      </button>
                      <button className="text-link" onClick={() => setCount(v)}>
                        Contar
                      </button>
                      <button
                        onClick={() => setKardex(v)}
                        aria-label={"Kardex de " + v.product.name}
                      >
                        <Eye size={17} />
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          ) : (
            <QueryState query={counts}>
              <DataTable
                rows={counts.data || []}
                columns={[
                  { label: "Fecha", render: (c) => dateLabel(c.createdAt) },
                  { label: "Artículos", render: (c) => c.items.length },
                  {
                    label: "Estado",
                    render: (c) => (
                      <Badge
                        tone={c.status === "applied" ? "success" : "warning"}
                      >
                        {c.status === "applied" ? "Aplicado" : "Pendiente"}
                      </Badge>
                    ),
                  },
                  {
                    label: "Acción",
                    render: (c) =>
                      c.status === "pending" &&
                      can(user.permissions, "sale:manage") && (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await post(
                                "/inventory/counts/" + c.id + "/apply",
                                {},
                              );
                              await client.invalidateQueries();
                              toast("Conteo aprobado y aplicado.");
                            } catch (e: any) {
                              toast(e.message, true);
                            }
                          }}
                        >
                          Aprobar ajuste
                        </Button>
                      ),
                  },
                ]}
              />
            </QueryState>
          )}
        </QueryState>
      </div>
      {adjust && (
        <FormModal
          title={"Ajustar · " + adjust.product.name}
          fields={[
            {
              ...requiredNumber("qty", "Cantidad (+ entrada / − salida)"),
              min: -100000,
              initial: 1,
            },
            {
              key: "type",
              label: "Tipo",
              type: "select",
              initial: "adjustment",
              options: [
                { label: "Ajuste", value: "adjustment" },
                { label: "Merma", value: "waste" },
                { label: "Devolución a proveedor", value: "supplier_return" },
              ],
            },
            {
              key: "lotId",
              label: "Lote de salida",
              type: "select",
              options: adjust.lots.map((l: any) => ({
                label: l.lotNumber + " · " + l.qty + " unidades",
                value: l.id,
              })),
            },
            { key: "lotNumber", label: "Lote de entrada" },
            {
              key: "expiryDate",
              label: "Vencimiento de entrada",
              type: "date",
            },
            {
              key: "reason",
              label: "Motivo",
              required: true,
              type: "textarea",
            },
          ]}
          onClose={() => setAdjust(null)}
          onSubmit={(data) =>
            post("/inventory/adjustments", {
              ...data,
              variantId: adjust.id,
              lotId: data.lotId || undefined,
              lotNumber: data.lotNumber || undefined,
              expiryDate: data.expiryDate
                ? new Date(data.expiryDate + "T23:59:59-04:00").toISOString()
                : undefined,
            })
          }
        />
      )}
      {count && (
        <FormModal
          title={"Conteo físico · " + count.product.name}
          fields={[
            requiredNumber("counted", "Cantidad contada", Number(count.stock)),
          ]}
          onClose={() => setCount(null)}
          onSubmit={(data) =>
            post("/inventory/counts", {
              items: [{ variantId: count.id, counted: data.counted }],
            })
          }
        />
      )}
      <Modal
        open={!!kardex}
        onClose={() => setKardex(null)}
        title={"Kardex · " + (kardex?.product.name || "")}
        wide
      >
        {kardex && <Kardex variantId={kardex.id} />}
      </Modal>
    </>
  );
}

export function Purchases() {
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api("/purchase-orders"),
  });
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api("/suppliers"),
  });
  const products = useQuery({ queryKey: ["catalog"], queryFn: loadCatalog });
  const variants =
    products.data?.flatMap((p) =>
      p.variants.map((v) => ({ ...v, name: p.name })),
    ) || [];
  const [tab, setTab] = useState("orders"),
    [newSupplier, setNewSupplier] = useState(false),
    [create, setCreate] = useState(false),
    [receive, setReceive] = useState<any>(null),
    [paySupplier, setPaySupplier] = useState<any>(null);
  return (
    <>
      <Heading
        title="Compras que impulsan tu tienda"
        caption="Del proveedor al estante, con costos y lotes claros."
      >
        <Button variant="secondary" onClick={() => setNewSupplier(true)}>
          <Plus size={16} />
          Proveedor
        </Button>
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Orden de compra
        </Button>
      </Heading>
      <div className="panel">
        <div className="table-toolbar">
          <div className="tabs">
            <button
              className={tab === "orders" ? "active" : ""}
              onClick={() => setTab("orders")}
            >
              Órdenes
            </button>
            <button
              className={tab === "suppliers" ? "active" : ""}
              onClick={() => setTab("suppliers")}
            >
              Proveedores
            </button>
            <button
              className={tab === "receipts" ? "active" : ""}
              onClick={() => setTab("receipts")}
            >
              Recepciones
            </button>
          </div>
        </div>
        {tab === "receipts" ? (
          <ReceiptHistory />
        ) : tab === "orders" ? (
          <QueryState query={orders}>
            <DataTable
              rows={orders.data || []}
              columns={[
                { label: "Orden", render: (o) => <strong>{o.number}</strong> },
                {
                  label: "Proveedor",
                  render: (o) =>
                    suppliers.data?.find((s: any) => s.id === o.supplierId)
                      ?.name || "Proveedor",
                },
                { label: "Fecha", render: (o) => dateLabel(o.createdAt) },
                { label: "Artículos", render: (o) => o.items.length },
                { label: "Total", render: (o) => formatMoney(o.total) },
                {
                  label: "Estado",
                  render: (o) => (
                    <Badge
                      tone={o.status === "received" ? "success" : "warning"}
                    >
                      {{
                        ordered: "Por recibir",
                        partial: "Parcial",
                        received: "Recibida",
                      }[o.status as string] || o.status}
                    </Badge>
                  ),
                },
                {
                  label: "Acción",
                  render: (o) =>
                    o.status !== "received" && (
                      <Button variant="secondary" onClick={() => setReceive(o)}>
                        <ArrowDownToLine size={16} />
                        Recibir
                      </Button>
                    ),
                },
              ]}
            />
          </QueryState>
        ) : (
          <QueryState query={suppliers}>
            <DataTable
              rows={suppliers.data || []}
              columns={[
                {
                  label: "Proveedor",
                  render: (s) => <strong>{s.name}</strong>,
                },
                { label: "RNC", render: (s) => s.legalId || "—" },
                {
                  label: "Contacto",
                  render: (s) => (
                    <span>
                      {s.phone}
                      <small>{s.email}</small>
                    </span>
                  ),
                },
                {
                  label: "Plazo de pago",
                  render: (s) => s.paymentTermsDays + " días",
                },
                { label: "Entrega", render: (s) => s.leadTimeDays + " días" },
                {
                  label: "Acción",
                  render: (s) => (
                    <Button
                      variant="secondary"
                      onClick={() => setPaySupplier(s)}
                    >
                      Registrar pago
                    </Button>
                  ),
                },
              ]}
            />
          </QueryState>
        )}
      </div>
      {newSupplier && (
        <FormModal
          title="Nuevo proveedor"
          fields={[
            { key: "name", label: "Nombre", required: true },
            { key: "legalId", label: "RNC / identificación" },
            { key: "phone", label: "Teléfono" },
            { key: "email", label: "Correo", type: "email" },
            requiredNumber("paymentTermsDays", "Plazo de pago (días)", 30),
            requiredNumber("leadTimeDays", "Tiempo de entrega (días)", 7),
          ]}
          onClose={() => setNewSupplier(false)}
          onSubmit={(data) => post("/suppliers", data)}
        />
      )}
      {create && (
        <PurchaseEditor
          suppliers={suppliers.data || []}
          variants={variants}
          onClose={() => setCreate(false)}
        />
      )}
      {receive && (
        <ReceiptEditor
          order={receive}
          variants={variants}
          onClose={() => setReceive(null)}
        />
      )}
      {paySupplier && (
        <FormModal
          title={"Pago · " + paySupplier.name}
          fields={[
            { ...requiredNumber("amount", "Monto del pago"), min: 0.01 },
            {
              key: "method",
              label: "Método",
              type: "select",
              required: true,
              initial: "transfer",
              options: paymentOptions,
            },
            { key: "reference", label: "Referencia" },
          ]}
          onClose={() => setPaySupplier(null)}
          onSubmit={(data) =>
            post("/supplier-payments", { ...data, supplierId: paySupplier.id })
          }
        />
      )}
    </>
  );
}
export function Expenses() {
  const query = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api("/expenses"),
  });
  const cats = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => api("/expense-categories"),
  });
  const [create, setCreate] = useState(false),
    [budget, setBudget] = useState<any>(null),
    [voiding, setVoiding] = useState<any>(null);
  const client = useQueryClient();
  const month = today().slice(0, 7);
  const rows = query.data || [];
  return (
    <>
      <Heading
        title="Tus gastos, sin sorpresas"
        caption="Controla lo que sale para cuidar lo que ganas."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Registrar gasto
        </Button>
      </Heading>
      <div className="budget-grid">
        {cats.data?.slice(0, 4).map((c: any) => {
          const used = rows
            .filter(
              (e: any) => e.categoryId === c.id && e.date.startsWith(month),
            )
            .reduce((a: number, e: any) => a + Number(e.amount), 0);
          const percent = Number(c.monthlyBudget)
            ? (used / Number(c.monthlyBudget)) * 100
            : 0;
          return (
            <div className="panel budget-card" key={c.id}>
              <div>
                <strong>{c.name}</strong>
                <button
                  className="icon-button"
                  aria-label={"Editar presupuesto de " + c.name}
                  onClick={() => setBudget(c)}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <h2>{formatMoney(used)}</h2>
              <small>de {formatMoney(c.monthlyBudget)} este mes</small>
              <div className="progress-track">
                <div
                  style={{
                    width: Math.min(100, percent) + "%",
                    background:
                      percent >= 100
                        ? "#ef4444"
                        : percent >= 80
                          ? "#f59e0b"
                          : "#7c3aed",
                  }}
                />
              </div>
              <Badge tone={percent >= 80 ? "warning" : "violet"}>
                {percent.toFixed(0)}% del presupuesto
              </Badge>
            </div>
          );
        })}
      </div>
      <div className="panel">
        <QueryState query={query}>
          <DataTable
            rows={rows}
            columns={[
              { label: "Fecha", render: (e) => dateLabel(e.date) },
              {
                label: "Descripción",
                render: (e) => (
                  <span>
                    <strong>{e.description}</strong>
                    {e.recurring && <small>Marcado recurrente</small>}
                  </span>
                ),
              },
              {
                label: "Categoría",
                render: (e) => <Badge>{e.category.name}</Badge>,
              },
              {
                label: "Método",
                render: (e) =>
                  paymentOptions.find((p) => p.value === e.method)?.label,
              },
              { label: "Monto", render: (e) => formatMoney(e.amount) },
              {
                label: "Acción",
                render: (e) => (
                  <button
                    className="text-link danger-text"
                    onClick={() => setVoiding(e)}
                  >
                    Anular
                  </button>
                ),
              },
            ]}
          />
        </QueryState>
      </div>
      {create && (
        <FormModal
          title="Registrar un gasto"
          fields={[
            { key: "description", label: "Descripción", required: true },
            {
              key: "categoryId",
              label: "Categoría",
              type: "select",
              required: true,
              options: cats.data?.map((c: any) => ({
                label: c.name,
                value: c.id,
              })),
            },
            { ...requiredNumber("amount", "Monto"), min: 0.01 },
            {
              key: "date",
              label: "Fecha",
              type: "date",
              initial: today(),
              required: true,
            },
            {
              key: "method",
              label: "Método",
              type: "select",
              initial: "transfer",
              options: paymentOptions,
              required: true,
            },
            { key: "receiptUrl", label: "URL del comprobante" },
            {
              key: "recurring",
              label: "Marcar como recurrente mensual",
              type: "checkbox",
            },
          ]}
          onClose={() => setCreate(false)}
          onSubmit={(data) =>
            post("/expenses", {
              ...data,
              date: new Date(data.date + "T12:00:00-04:00").toISOString(),
            })
          }
        />
      )}
      {budget && (
        <FormModal
          title={"Presupuesto · " + budget.name}
          fields={[
            requiredNumber(
              "monthlyBudget",
              "Presupuesto mensual",
              Number(budget.monthlyBudget),
            ),
          ]}
          onClose={() => setBudget(null)}
          onSubmit={(data) =>
            mutate("/expense-categories/" + budget.id, data, "PATCH")
          }
        />
      )}
      {voiding && (
        <ConfirmModal
          title="Anular gasto"
          description="El gasto queda conservado en la bitácora y sale de los totales."
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await post("/expenses/" + voiding.id + "/void", { reason });
            await client.invalidateQueries();
            toast("Gasto anulado.");
          }}
        />
      )}
    </>
  );
}

export function Cash() {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: () => api("/cash-sessions"),
  });
  const pending = useQuery({
    queryKey: ["pending-sales"],
    queryFn: () => localDB.sales.where("userId").equals(user.id).toArray(),
    refetchInterval: 5000,
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api("/customers"),
  });
  const [open, setOpen] = useState(false),
    [movement, setMovement] = useState(false),
    [closing, setClosing] = useState<any>(null),
    [discarding, setDiscarding] = useState<any>(null),
    [printing, setPrinting] = useState<Printing>(null);
  // Fondo sugerido: lo dejado en el último cierre de esta caja.
  const suggestion = useQuery({
    queryKey: ["opening-suggestion"],
    queryFn: () => api("/cash-sessions/opening-suggestion"),
    enabled: open,
  });
  const active = query.data?.find(
    (s: any) => !s.closedAt && s.userId === user.id,
  );
  const canSeeExpected =
    can(user.permissions, "profit:read") ||
    can(user.permissions, "sale:manage");
  const elsewhere = cashOnOtherDevice(active);
  const repricePending = async (sale: any) => {
    const [products, promotions, settings] = await Promise.all([
      loadCatalog(),
      api<any[]>("/promotions"),
      api<any>("/settings"),
    ]);
    const applied = await applyPendingSaleReprice(
      sale,
      products,
      promotions,
      settings.taxIncluded !== false,
      {
        recordResolution: (body) => post("/sales/offline-resolution", body),
        updateLocal: (id, changes) => localDB.sales.update(id, changes),
        syncOne: async (input) => {
          const result = await post("/sales/sync", { sales: [input] });
          return result.results[0];
        },
        deleteLocal: (id) => localDB.sales.delete(id),
      },
    );
    await client.invalidateQueries({ queryKey: ["pending-sales"] });
    toast(
      applied.synced.status === "synced"
        ? "Precios actualizados y venta sincronizada."
        : "Precios actualizados. La venta sigue pendiente de revisión.",
      applied.synced.status !== "synced",
    );
  };
  return (
    <>
      <Heading
        title="Una caja que siempre cuadra"
        caption="Abre el día con claridad. Ciérralo con tranquilidad."
      >
        {!active ? (
          <Button onClick={() => setOpen(true)}>
            <Wallet size={17} />
            Abrir caja
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={elsewhere}
              title={
                elsewhere
                  ? "Traslada la caja a este equipo para registrar movimientos."
                  : undefined
              }
              onClick={() => setMovement(true)}
            >
              <Plus size={17} />
              Movimiento
            </Button>
            <Button onClick={() => setClosing(active)}>Cerrar y arquear</Button>
          </>
        )}
      </Heading>
      {elsewhere && <CashElsewhere session={active} />}
      {active && canSeeExpected ? (
        <div className="cash-overview">
          <div className="cash-main">
            <Badge tone="success">Caja abierta</Badge>
            <h2>{active.registerName ?? active.registerId}</h2>
            <p>
              Desde{" "}
              {new Date(active.openedAt).toLocaleString("es-DO", {
                timeZone: "America/Santo_Domingo",
              })}
            </p>
            <strong>{formatMoney(active.expected.cash)}</strong>
            <span>Efectivo esperado</span>
          </div>
          <div className="panel cash-methods">
            <div>
              <span>Apertura</span>
              <strong>{formatMoney(active.openingAmount)}</strong>
            </div>
            <div>
              <span>Tarjeta esperada</span>
              <strong>{formatMoney(active.expected.card)}</strong>
            </div>
            <div>
              <span>Transferencia esperada</span>
              <strong>{formatMoney(active.expected.transfer)}</strong>
            </div>
            <div>
              <span>Movimientos de efectivo</span>
              <strong>{active.expected.movements.length}</strong>
            </div>
          </div>
        </div>
      ) : active ? (
        <div className="panel">
          <Badge tone="success">Caja abierta</Badge>
          <h2>{active.registerName ?? active.registerId}</h2>
          <p>
            Arqueo ciego activo: los montos esperados y las diferencias se
            mostrarán únicamente a administración.
          </p>
        </div>
      ) : (
        <div className="panel">
          <Empty
            title="Tu día empieza con una caja abierta"
            description="Registra el fondo inicial para comenzar a facturar."
            action={
              <Button onClick={() => setOpen(true)}>Abrir mi caja</Button>
            }
          />
        </div>
      )}
      {can(user.permissions, "*") && <CodPending session={active} />}
      {!!pending.data?.length && (
        <section className="panel pending-panel">
          <div className="panel-heading">
            <div>
              <h2>Ventas guardadas en este dispositivo</h2>
              <p>Conservadas hasta recibir confirmación del servidor.</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const result = await syncSales();
                  await client.invalidateQueries();
                  toast(
                    `${result.synced} sincronizadas · ${result.conflicts} requieren revisión.`,
                  );
                } catch (e: any) {
                  toast(e.message, true);
                }
              }}
            >
              <RefreshCw size={17} />
              Sincronizar
            </Button>
          </div>
          <DataTable
            rows={pending.data}
            columns={[
              { label: "Recibo", render: (s) => s.receipt.number },
              { label: "Monto", render: (s) => formatMoney(s.receipt.total) },
              {
                label: "Estado",
                render: (s) => (
                  <Badge tone={s.status === "conflict" ? "danger" : "warning"}>
                    {s.status === "conflict"
                      ? "Requiere revisión"
                      : "Pendiente"}
                  </Badge>
                ),
              },
              {
                label: "Detalle",
                render: (s) => s.message || "Esperando conexión",
              },
              {
                label: "Acción",
                render: (s) => {
                  if (s.status !== "conflict") return null;
                  const priceConflict = isPendingPriceConflict(s.message);
                  return (
                    <div className="pending-sale-actions">
                      {!s.input.customerId && (
                        <select
                          aria-label={`Cliente para el recibo ${s.receipt.number}`}
                          defaultValue=""
                          onChange={async (event) => {
                            const customerId = event.target.value;
                            if (!customerId) return;
                            const input = { ...s.input, customerId };
                            await localDB.sales.update(s.id, {
                              input,
                              status: "pending",
                              message: undefined,
                            });
                            await client.invalidateQueries({
                              queryKey: ["pending-sales"],
                            });
                            toast(
                              "Cliente asociado. Venta lista para sincronizar.",
                            );
                          }}
                        >
                          <option value="">Asociar cliente…</option>
                          {(customers.data || []).map((customer: any) => (
                            <option key={customer.id} value={customer.id}>
                              {customer.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {priceConflict && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            repricePending(s).catch((error: any) =>
                              toast(error.message, true),
                            )
                          }
                        >
                          Actualizar precios y reintentar
                        </Button>
                      )}
                      {s.input.customerId && !priceConflict && (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            await localDB.sales.update(s.id, {
                              status: "pending",
                              message: undefined,
                            });
                            await client.invalidateQueries({
                              queryKey: ["pending-sales"],
                            });
                            toast("Lista para reintentar.");
                          }}
                        >
                          Reintentar
                        </Button>
                      )}
                      {can(user.permissions, "sale:manage") && (
                        <Button
                          variant="danger"
                          onClick={() => setDiscarding(s)}
                        >
                          Descartar
                        </Button>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />
        </section>
      )}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Historial de cajas</h2>
            <p>Un registro claro de cada jornada.</p>
          </div>
        </div>
        <DayReports onPrint={setPrinting} />
        <QueryState query={query}>
          <DataTable
            rows={query.data || []}
            columns={[
              {
                label: "Equipo",
                render: (s) => (
                  <strong>{s.registerName ?? s.registerId}</strong>
                ),
              },
              { label: "Apertura", render: (s) => dateLabel(s.openedAt) },
              {
                label: "Estado",
                render: (s) => (
                  <Badge tone={s.closedAt ? "neutral" : "success"}>
                    {s.closedAt ? "Cerrada" : "Abierta"}
                  </Badge>
                ),
              },
              {
                label: "Efectivo esperado",
                render: (s) => {
                  const expected = s.expectedCash ?? s.expected?.cash;
                  return expected == null ? "—" : formatMoney(expected);
                },
              },
              {
                label: "Contado",
                render: (s) =>
                  s.countedCash === null ? "—" : formatMoney(s.countedCash),
              },
              {
                label: "Diferencias por método",
                render: (s) =>
                  s.closedAt &&
                  [
                    s.differenceCash,
                    s.differenceCard,
                    s.differenceTransfer,
                  ].some((value) => value != null) ? (
                    <div>
                      <div>
                        Efectivo:{" "}
                        {s.differenceCash == null
                          ? "—"
                          : formatMoney(s.differenceCash)}
                      </div>
                      <div>
                        Tarjeta:{" "}
                        {s.differenceCard == null
                          ? "—"
                          : formatMoney(s.differenceCard)}
                      </div>
                      <div>
                        Transferencia:{" "}
                        {s.differenceTransfer == null
                          ? "—"
                          : formatMoney(s.differenceTransfer)}
                      </div>
                    </div>
                  ) : (
                    "—"
                  ),
              },
              {
                label: "Acciones",
                render: (s) => (
                  <>
                    {!s.closedAt && can(user.permissions, "sale:manage") && (
                      <Button variant="secondary" onClick={() => setClosing(s)}>
                        Cerrar y arquear
                      </Button>
                    )}
                    <SessionPrintButtons session={s} onPrint={setPrinting} />
                  </>
                ),
              },
            ]}
          />
        </QueryState>
      </section>
      {open && !suggestion.isLoading && (
        <FormModal
          title="Abrir mi caja"
          fields={[
            {
              ...requiredNumber(
                "openingAmount",
                "Efectivo inicial",
                suggestion.data?.amount ?? undefined,
              ),
              ...(suggestion.data?.amount != null
                ? { help: "Sugerido: lo dejado en el último cierre." }
                : {}),
            },
          ]}
          onClose={() => setOpen(false)}
          onSubmit={async (data) => {
            // La caja queda asignada a este equipo (el servidor usa su registro).
            await registerTerminal().catch(() => undefined);
            return post("/cash-sessions/open", {
              ...data,
              registerId: terminalIdentity().name,
            });
          }}
        />
      )}
      {movement && (
        <FormModal
          title="Movimiento de efectivo"
          fields={[
            {
              key: "type",
              label: "Tipo",
              type: "select",
              required: true,
              initial: "in",
              options: [
                { label: "Entrada de efectivo", value: "in" },
                { label: "Salida de efectivo", value: "out" },
              ],
            },
            { ...requiredNumber("amount", "Monto"), min: 0.01 },
            {
              key: "reason",
              label: "Motivo",
              required: true,
              type: "textarea",
            },
          ]}
          onClose={() => setMovement(false)}
          onSubmit={(data) =>
            post("/cash-sessions/" + active.id + "/movements", data)
          }
        />
      )}
      {closing && (
        <CloseCashModal
          session={closing}
          onClose={() => setClosing(null)}
          onClosed={(cuadre) => {
            setClosing(null);
            setPrinting({ kind: "cuadre", data: cuadre });
            printSoon();
          }}
        />
      )}
      {discarding && (
        <ConfirmModal
          title="Descartar venta pendiente"
          description={`Se eliminará ${discarding.receipt?.number ?? "esta venta"} de este dispositivo. La decisión y el motivo quedarán en la bitácora.`}
          confirmLabel="Descartar"
          onClose={() => setDiscarding(null)}
          onConfirm={async (reason) => {
            await discardPendingSale(discarding, reason, {
              recordResolution: (body) =>
                post("/sales/offline-resolution", body),
              deleteLocal: (id) => localDB.sales.delete(id),
            });
            await client.invalidateQueries({ queryKey: ["pending-sales"] });
            toast("Venta pendiente descartada.");
          }}
        />
      )}
      <PrintModal printing={printing} onClose={() => setPrinting(null)} />
    </>
  );
}

export function Customers() {
  const user = useStore((state) => state.user)!;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["customers"],
    queryFn: () => api("/customers"),
  });
  const [create, setCreate] = useState(false),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [anonymizing, setAnonymizing] = useState<any>(null);
  const fields: Field[] = [
    { key: "name", label: "Nombre", required: true },
    { key: "phone", label: "Teléfono" },
    { key: "email", label: "Correo", type: "email" },
    { key: "legalId", label: "Cédula / RNC" },
    ...(can(useStore.getState().user!.permissions, "sale:manage")
      ? [requiredNumber("creditLimit", "Límite de crédito (RD$)", 0)]
      : []),
    { key: "notes", label: "Notas", type: "textarea" },
  ];
  return (
    <>
      <Heading
        title="Personas que vuelven a elegirte"
        caption="Conoce a tus clientes y construye relaciones que duran."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Nuevo cliente
        </Button>
      </Heading>
      <div className="panel">
        <div className="table-toolbar">
          <Filter
            value={search}
            onChange={setSearch}
            placeholder="Buscar nombre o teléfono"
          />
        </div>
        <QueryState query={query}>
          <DataTable
            rows={(query.data || []).filter((c: any) =>
              (c.name + " " + c.phone)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )}
            columns={[
              { label: "Cliente", render: (c) => <strong>{c.name}</strong> },
              {
                label: "Contacto",
                render: (c) => (
                  <span>
                    {c.phone || "—"}
                    <small>{c.email}</small>
                  </span>
                ),
              },
              { label: "Cédula / RNC", render: (c) => c.legalId || "—" },
              { label: "Compras", render: (c) => c.purchases },
              {
                label: "Total gastado",
                render: (c) => formatMoney(c.totalSpent),
              },
              {
                label: "Última compra",
                render: (c) =>
                  c.lastPurchase
                    ? dateLabel(c.lastPurchase)
                    : "Aún sin compras",
              },
              {
                label: "Acción",
                render: (c) => (
                  <div className="table-actions">
                    <button
                      className="text-link"
                      onClick={() => setEditing(c)}
                    >
                      Editar
                    </button>
                    {can(user.permissions, "customers:erase") && (
                      <button
                        className="text-link danger-text"
                        onClick={() => setAnonymizing(c)}
                      >
                        Anonimizar
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </QueryState>
      </div>
      {create && (
        <FormModal
          title="Nuevo cliente"
          fields={fields}
          onClose={() => setCreate(false)}
          onSubmit={(data) => post("/customers", data)}
        />
      )}
      {editing && (
        <FormModal
          title="Editar cliente"
          fields={fields}
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => mutate("/customers/" + editing.id, data, "PATCH")}
        />
      )}
      {anonymizing && (
        <ConfirmModal
          title="Anonimizar cliente"
          description={`Se eliminarán los datos personales de ${anonymizing.name}. Las ventas y sus montos se conservarán. Esta acción no se puede deshacer.`}
          confirmLabel="Anonimizar"
          onClose={() => setAnonymizing(null)}
          onConfirm={async (reason) => {
            await post(`/customers/${anonymizing.id}/anonymize`, {
              reason,
              requestRef: `APP-${new Date().toISOString()}`,
            });
            await client.invalidateQueries({ queryKey: ["customers"] });
            toast("Cliente anonimizado.");
          }}
        />
      )}
    </>
  );
}

export function Promotions() {
  const query = useQuery({
    queryKey: ["clearance"],
    queryFn: () => api("/promotions/clearance-candidates"),
  });
  const promos = useQuery({
    queryKey: ["promotions"],
    queryFn: () => api("/promotions"),
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: () => api("/categories"),
  });
  const client = useQueryClient();
  const [tab, setTab] = useState("clearance"),
    [offer, setOffer] = useState<any>(null),
    [create, setCreate] = useState(false);
  return (
    <>
      <Heading
        title="Dale una nueva oportunidad"
        caption="Libera espacio, recupera capital y sorprende a tus clientes."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Nueva promoción
        </Button>
      </Heading>
      <div className="clearance-intro">
        <div className="clearance-symbol">
          <Sparkles size={27} />
        </div>
        <div>
          <h2>El momento perfecto para una oferta</h2>
          <p>
            Prioriza productos sin rotación o próximos a vencer. El descuento
            sugerido protege tu costo.
          </p>
        </div>
        <Badge tone="pink">{query.data?.length || 0} oportunidades</Badge>
      </div>
      <div className="tabs outside">
        <button
          className={tab === "clearance" ? "active" : ""}
          onClick={() => setTab("clearance")}
        >
          Candidatos a liquidación
        </button>
        <button
          className={tab === "promos" ? "active" : ""}
          onClick={() => setTab("promos")}
        >
          Mis promociones
        </button>
      </div>
      {tab === "clearance" ? (
        <QueryState query={query}>
          <div className="clearance-grid">
            {query.data?.map((c: any) => (
              <article className="panel clearance-card" key={c.variantId}>
                <div className="clearance-top">
                  <img src={c.imageUrl} alt={c.name} />
                  <div>
                    <Badge
                      tone={
                        c.daysToExpiry !== null && c.daysToExpiry < 30
                          ? "warning"
                          : "violet"
                      }
                    >
                      {c.daysToExpiry !== null
                        ? `${c.daysToExpiry} días para vencer`
                        : `${c.daysIdle} días sin venta`}
                    </Badge>
                    <h3>{c.name}</h3>
                    <small>
                      {c.sku} · {c.category}
                    </small>
                  </div>
                </div>
                <div className="clearance-metrics">
                  <div>
                    <span>Stock</span>
                    <strong>{c.stock} unidades</strong>
                  </div>
                  <div>
                    <span>Capital inmovilizado</span>
                    <strong>{formatMoney(c.capital)}</strong>
                  </div>
                  <div>
                    <span>Margen actual</span>
                    <strong>{c.margin}%</strong>
                  </div>
                  <div>
                    <span>Descuento sugerido</span>
                    <strong className="violet-text">
                      {c.suggestedDiscount}%
                    </strong>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="full-width"
                  onClick={() => setOffer(c)}
                >
                  <Sparkles size={16} />
                  Crear oferta <ArrowRight size={16} />
                </Button>
              </article>
            ))}
          </div>
          {!query.data?.length && (
            <Empty
              title="Tu inventario está en movimiento"
              description="No hay candidatos según tus umbrales actuales."
            />
          )}
        </QueryState>
      ) : (
        <div className="panel">
          <QueryState query={promos}>
            <DataTable
              rows={promos.data || []}
              columns={[
                {
                  label: "Promoción",
                  render: (p) => <strong>{p.name}</strong>,
                },
                { label: "Tipo", render: (p) => p.type },
                {
                  label: "Valor",
                  render: (p) => p.value + (p.type === "percent" ? "%" : ""),
                },
                {
                  label: "Vigencia",
                  render: (p) =>
                    dateLabel(p.startsAt) + " – " + dateLabel(p.endsAt),
                },
                {
                  label: "Estado",
                  render: (p) => (
                    <Badge tone={p.active ? "success" : "neutral"}>
                      {p.active ? "Activa" : "Inactiva"}
                    </Badge>
                  ),
                },
                {
                  label: "Acción",
                  render: (p) => (
                    <button
                      className="text-link"
                      onClick={async () => {
                        try {
                          await mutate(
                            "/promotions/" + p.id,
                            { active: !p.active },
                            "PATCH",
                          );
                          await client.invalidateQueries();
                        } catch (e: any) {
                          toast(e.message, true);
                        }
                      }}
                    >
                      {p.active ? "Desactivar" : "Activar"}
                    </button>
                  ),
                },
              ]}
            />
          </QueryState>
        </div>
      )}
      {offer && (
        <FormModal
          title={"Crear oferta · " + offer.name}
          fields={[
            {
              key: "name",
              label: "Nombre de la oferta",
              initial: "Oferta · " + offer.name,
              required: true,
            },
            {
              ...requiredNumber(
                "value",
                "Descuento (%)",
                offer.suggestedDiscount,
              ),
              max: 100,
              help: `Margen actual ${offer.margin}%. Más de ${offer.margin}% puede dejar la venta bajo costo.`,
            },
            {
              key: "endsAt",
              label: "Fecha de finalización",
              type: "date",
              initial: new Date(Date.now() + 14 * 86400000)
                .toISOString()
                .slice(0, 10),
              required: true,
            },
          ]}
          onClose={() => setOffer(null)}
          onSubmit={(data) =>
            post("/promotions", {
              ...data,
              type: "percent",
              startsAt: new Date().toISOString(),
              endsAt: new Date(data.endsAt + "T23:59:59-04:00").toISOString(),
              scope: { variantId: offer.variantId },
              isClearance: true,
            })
          }
        />
      )}
      {create && (
        <FormModal
          title="Nueva promoción"
          fields={[
            { key: "name", label: "Nombre", required: true },
            {
              key: "type",
              label: "Tipo",
              type: "select",
              initial: "percent",
              required: true,
              options: [
                { label: "Descuento porcentual", value: "percent" },
                { label: "Descuento fijo por unidad", value: "amount" },
                { label: "Precio especial", value: "special_price" },
                { label: "2 × 1", value: "nxm" },
                { label: "Segundo a mitad de precio", value: "second_half" },
              ],
            },
            requiredNumber("value", "Porcentaje, descuento o precio", 15),
            {
              key: "categoryId",
              label: "Categoría",
              type: "select",
              required: true,
              options: cats.data?.map((c: any) => ({
                label: c.name,
                value: c.id,
              })),
            },
            {
              key: "startsAt",
              label: "Inicio",
              type: "date",
              initial: today(),
              required: true,
            },
            { key: "endsAt", label: "Fin", type: "date", required: true },
          ]}
          onClose={() => setCreate(false)}
          onSubmit={(data) => {
            const { categoryId, ...values } = data;
            return post("/promotions", {
              ...values,
              startsAt: new Date(
                data.startsAt + "T00:00:00-04:00",
              ).toISOString(),
              endsAt: new Date(data.endsAt + "T23:59:59-04:00").toISOString(),
              scope: {
                categoryId,
                ...(data.type === "nxm" ? { buy: 2, pay: 1 } : {}),
              },
            });
          }}
        />
      )}
    </>
  );
}

const reportList = [
  ["sales", "Ventas detalladas"],
  ["monthly-consumption", "Consumo mensual"],
  ["profit", "Utilidad por producto"],
  ["inventory-value", "Inventario valorizado"],
  ["kardex", "Kardex"],
  ["low-stock", "Stock bajo y reposición"],
  ["no-movement", "Productos sin movimiento"],
  ["expiring", "Lotes próximos a vencer"],
  ["abc", "Clasificación ABC"],
  ["expenses", "Gastos y presupuesto"],
  ["income-statement", "Estado de resultados"],
  ["cash", "Cierres y diferencias"],
  ["by-seller", "Ventas por vendedor"],
  ["by-payment", "Ventas por método de pago"],
  ["returns-discounts", "Devoluciones y descuentos"],
  ["customers", "Mejores clientes"],
  ["purchases", "Compras y cuentas por pagar"],
];
export function Reports() {
  const [report, setReport] = useState("sales"),
    [from, setFrom] = useState(today().slice(0, 8) + "01"),
    [to, setTo] = useState(today());
  const query = useQuery({
    queryKey: ["report", report, from, to],
    queryFn: () => api(`/reports/${report}?from=${from}&to=${to}`),
  });
  const rows = query.data?.rows || [];
  const columns = Object.keys(rows[0] || {})
    .filter((k) => k !== "class")
    .map((key) => ({
      label: key.replace(/_/g, " "),
      render: (row: any) =>
        typeof row[key] === "number"
          ? row[key].toLocaleString("es-DO", { maximumFractionDigits: 2 })
          : String(row[key] ?? "—"),
    }));
  return (
    <>
      <Heading
        title="Los números cuentan tu historia"
        caption="Transforma tus datos en decisiones para el próximo paso."
      />
      <div className="reports-layout">
        <aside className="panel report-menu">
          {reportList.map(([id, name]) => (
            <button
              key={id}
              onClick={() => setReport(id)}
              className={report === id ? "active" : ""}
            >
              <FileText size={17} />
              {name}
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>{reportList.find((r) => r[0] === report)?.[1]}</h2>
              <p>Información registrada en tu tienda.</p>
            </div>
            <div className="table-actions">
              {["xlsx", "pdf"].map((format) => (
                <Button
                  variant="secondary"
                  key={format}
                  onClick={() =>
                    download(
                      `/reports/${report}?from=${from}&to=${to}&format=${format}`,
                      `${report}.${format}`,
                    ).catch((e) => toast(e.message, true))
                  }
                >
                  <Download size={16} />
                  {format === "xlsx" ? "Excel" : "PDF"}
                </Button>
              ))}
            </div>
          </div>
          <div className="date-filters">
            <label className="field">
              <span>Desde</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Hasta</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </label>
            <Badge tone="violet">{rows.length} registros</Badge>
          </div>
          <QueryState query={query}>
            <DataTable
              rows={rows}
              columns={columns}
              empty="No hay datos para este período"
            />
          </QueryState>
        </section>
      </div>
    </>
  );
}

export function Alerts() {
  const [status, setStatus] = useState("new");
  const query = useQuery({
    queryKey: ["alerts", status],
    queryFn: () => api("/alerts?status=" + status),
  });
  const client = useQueryClient();
  const rows = (query.data || []).filter(
    (a: any) => status === "all" || a.status === status,
  );
  return (
    <>
      <Heading
        title="Lo importante, a tiempo"
        caption="Un centro de atención para mantener tu tienda un paso adelante."
      >
        <Button variant="secondary" onClick={() => query.refetch()}>
          <RefreshCw size={17} />
          Actualizar
        </Button>
      </Heading>
      <div className="panel">
        <div className="table-toolbar">
          <div className="tabs">
            {[
              ["new", "Nuevas"],
              ["seen", "Vistas"],
              ["resolved", "Resueltas"],
              ["all", "Todas"],
            ].map(([id, label]) => (
              <button
                className={status === id ? "active" : ""}
                key={id}
                onClick={() => setStatus(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <Badge tone="warning">{rows.length} alertas</Badge>
        </div>
        <QueryState query={query}>
          <div className="alerts-list">
            {rows.map((a: any) => (
              <div className="alert-row" key={a.id}>
                <div
                  className={`alert-symbol ${a.severity === "high" ? "orange" : "violet"}`}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <strong>{a.message}</strong>
                  <p>
                    {dateLabel(a.createdAt)} · {a.type.replaceAll("_", " ")}
                  </p>
                </div>
                <Badge tone={a.severity === "high" ? "danger" : "warning"}>
                  {a.severity === "high" ? "Prioritaria" : "Atención"}
                </Badge>
                <div className="table-actions">
                  {a.status !== "seen" && a.status !== "resolved" && (
                    <button
                      className="text-link"
                      onClick={async () => {
                        await mutate(
                          "/alerts/" + a.id,
                          { status: "seen" },
                          "PATCH",
                        );
                        await client.invalidateQueries();
                      }}
                    >
                      Marcar vista
                    </button>
                  )}
                  {a.status !== "resolved" && (
                    <button
                      className="text-link"
                      onClick={async () => {
                        await mutate(
                          "/alerts/" + a.id,
                          { status: "resolved" },
                          "PATCH",
                        );
                        await client.invalidateQueries();
                      }}
                    >
                      Resolver
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!rows.length && (
              <Empty
                title="Todo en orden por aquí"
                description="Las alertas aparecerán cuando tu tienda necesite atención."
              />
            )}
          </div>
        </QueryState>
      </div>
    </>
  );
}

export function SalesHistory() {
  const user = useStore((s) => s.user)!;
  const [selected, setSelected] = useState<any>(null),
    [voiding, setVoiding] = useState<any>(null),
    [returning, setReturning] = useState<any>(null),
    [installment, setInstallment] = useState<any>(null),
    [rejecting, setRejecting] = useState<any>(null),
    [search, setSearch] = useState(""),
    [saleDate, setSaleDate] = useState("");
  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (saleDate) params.set("date", saleDate);
  const query = useQuery({
    queryKey: ["sales", search.trim(), saleDate],
    queryFn: () => api("/sales" + (params.size ? "?" + params : "")),
  });
  const sessions = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: () => api("/cash-sessions"),
  });
  const client = useQueryClient();
  const session = sessions.data?.find(
    (s: any) => !s.closedAt && s.userId === user.id,
  );
  return (
    <>
      <Heading
        title="Cada venta tiene una historia"
        caption="Consulta recibos, pagos y movimientos sin perder el detalle."
      />
      <div className="panel">
        <div className="table-toolbar">
          <Filter
            value={search}
            onChange={setSearch}
            placeholder="Buscar número de factura"
          />
          <label className="table-search">
            <span>Fecha</span>
            <input
              type="date"
              value={saleDate}
              onChange={(event) => setSaleDate(event.target.value)}
              aria-label="Buscar ventas de una fecha"
            />
          </label>
        </div>
        <QueryState query={query}>
          <DataTable
            rows={query.data || []}
            columns={[
              { label: "Factura", render: (s) => <strong>{s.number}</strong> },
              { label: "Fecha", render: (s) => dateLabel(s.createdAt) },
              {
                label: "Estado",
                render: (s) => (
                  <Badge tone={s.status === "voided" ? "danger" : "success"}>
                    {s.status === "voided" ? "Anulada" : "Completada"}
                  </Badge>
                ),
              },
              { label: "Total", render: (s) => formatMoney(s.total) },
              {
                label: "Saldo pendiente",
                render: (s) => formatMoney(s.creditBalance ?? 0),
              },
              {
                label: "Pagos",
                render: (s) =>
                  s.payments
                    .map(
                      (p: any) =>
                        paymentOptions.find((o) => o.value === p.method)?.label,
                    )
                    .join(" + "),
              },
              {
                label: "Acciones",
                render: (s) => (
                  <div className="table-actions">
                    <button
                      onClick={() => setSelected(s)}
                      aria-label={"Ver " + s.number}
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() =>
                        download(
                          "/sales/" + s.id + "/receipt.pdf",
                          s.number + ".pdf",
                        ).catch((e) => toast(e.message, true))
                      }
                      aria-label={"PDF de " + s.number}
                    >
                      <Download size={18} />
                    </button>
                    {can(user.permissions, "*") &&
                      s.status === "completed" &&
                      Number(s.creditBalance) > 0 && (
                        <button
                          className="text-link"
                          onClick={() => {
                            if (!session) {
                              toast(
                                "Abre tu caja para registrar abonos.",
                                true,
                              );
                              return;
                            }
                            setInstallment({
                              ...s,
                              offlineUuid: crypto.randomUUID(),
                            });
                          }}
                        >
                          Registrar abono
                        </button>
                      )}
                    {can(user.permissions, "sale:manage") &&
                      s.status === "completed" && (
                        <button
                          className="text-link"
                          onClick={() => {
                            if (!session) {
                              toast(
                                "Abre tu caja para procesar devoluciones.",
                                true,
                              );
                              return;
                            }
                            // Un UUID por formulario: si la respuesta se pierde y
                            // se vuelve a guardar, la API devuelve la misma
                            // devolución en vez de repetirla (R9-A01).
                            setReturning({
                              ...s,
                              operationId: crypto.randomUUID(),
                            });
                          }}
                        >
                          Devolver
                        </button>
                      )}
                    {can(user.permissions, "*") &&
                      s.status === "completed" &&
                      !s.returns?.length &&
                      !s.payments?.some(
                        (p: any) =>
                          p.entryType === "installment" &&
                          p.status !== "rejected",
                      ) && (
                        <button
                          className="text-link danger-text"
                          onClick={() => setVoiding(s)}
                        >
                          Anular
                        </button>
                      )}
                  </div>
                ),
              },
            ]}
          />
        </QueryState>
      </div>
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.number || "Venta"}
        wide
      >
        {selected && (
          <>
            {can(user.permissions, "sale:manage") &&
              selected.returns?.map((r: any) => (
                <Button
                  key={r.id}
                  variant="secondary"
                  onClick={() =>
                    download(
                      "/returns/" + r.id + "/credit-note.pdf",
                      r.number + ".pdf",
                    ).catch((e) => toast(e.message, true))
                  }
                >
                  Imprimir nota {r.number}
                </Button>
              ))}
            <DataTable
              rows={selected.items}
              columns={[
                { label: "Producto", render: (i) => i.variant.product.name },
                {
                  label: "Variante",
                  render: (i) => attrLabel(i.variant.attributes),
                },
                { label: "Cantidad", render: (i) => i.qty },
                { label: "Devuelta", render: (i) => i.returnedQty },
                { label: "Total", render: (i) => formatMoney(i.lineTotal) },
              ]}
            />
            <h3>Pagos registrados</h3>
            {Number(selected.discountTotal) > 0 && (
              <p>
                Descuento: {formatMoney(selected.discountTotal)} · Motivo:{" "}
                {selected.discountReason}
                {selected.discountApprovedName
                  ? ` · Autorizó: ${selected.discountApprovedName}`
                  : ""}
              </p>
            )}
            {selected.payments.map((p: any) => (
              <div className="payment-list" key={p.id}>
                <div>
                  <span>
                    {METHOD_LABEL[p.method] ??
                      paymentOptions.find((o) => o.value === p.method)?.label ??
                      p.method}{" "}
                    · Recibido: {formatMoney(p.tendered ?? p.amount)} ·
                    Aplicado: {formatMoney(p.amount)} · Cambio:{" "}
                    {formatMoney(p.change ?? 0)}
                    <small>{p.reference || p.approvalCode}</small>
                  </span>
                  <ProofThumb paymentId={p.id} hasProof={p.hasProof} />
                  {p.entryType === "installment" &&
                    can(user.permissions, "*") && (
                      <label className="text-link proof-upload">
                        {p.hasProof ? "Cambiar foto" : "Subir foto"}
                        <input
                          type="file"
                          hidden
                          accept="image/jpeg,image/png,image/webp"
                          capture="environment"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              await uploadProof(p.id, file);
                              setSelected(null);
                              await client.invalidateQueries();
                              toast("Foto de la evidencia guardada.");
                            } catch (err: any) {
                              toast(err.message, true);
                            }
                          }}
                        />
                      </label>
                    )}
                  <Badge
                    tone={
                      p.status === "ok"
                        ? "success"
                        : p.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {p.status === "ok"
                      ? "Verificado"
                      : p.status === "rejected"
                        ? "Rechazada"
                        : "Pendiente de verificar"}
                  </Badge>
                  {p.method === "transfer" &&
                    p.status === "pending_verification" &&
                    can(user.permissions, "*") && (
                      <button
                        className="text-link"
                        onClick={async () => {
                          try {
                            await post("/payments/" + p.id + "/verify", {});
                            setSelected(null);
                            await client.invalidateQueries();
                            toast("Transferencia verificada.");
                          } catch (e: any) {
                            toast(e.message, true);
                          }
                        }}
                      >
                        Verificar
                      </button>
                    )}
                  {/* Un abono por transferencia que no llegó se rechaza: si no,
                      bloquea para siempre la devolución de la venta
                      (R9-dinero-3-ui). */}
                  {p.method === "transfer" &&
                    p.entryType === "installment" &&
                    p.status === "pending_verification" &&
                    can(user.permissions, "*") && (
                      <button
                        className="text-link danger-text"
                        onClick={() => {
                          setSelected(null);
                          setRejecting(p);
                        }}
                      >
                        Rechazar
                      </button>
                    )}
                </div>
              </div>
            ))}
            <h3>Total {formatMoney(selected.total)}</h3>
          </>
        )}
      </Modal>
      {voiding && (
        <ConfirmModal
          title={"Anular " + voiding.number}
          description="Solo un administrador puede hacerlo. La factura se conserva con el motivo y el usuario responsable, se revierte el inventario y deja de contar en ventas; no necesitas abrir caja."
          confirmLabel="Sí, anular factura"
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await post("/sales/" + voiding.id + "/void", {
              reason,
            });
            await client.invalidateQueries();
            toast("Factura anulada.");
          }}
        />
      )}
      {rejecting && (
        <ConfirmModal
          title={"Rechazar transferencia de " + formatMoney(rejecting.amount)}
          description="Úsalo cuando el dinero no llegó al banco. El abono no descuenta la deuda ni entra a la caja; si el cliente vuelve a pagar, registra un abono nuevo."
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await post("/payments/" + rejecting.id + "/reject", { reason });
            await client.invalidateQueries();
            toast("Transferencia rechazada.");
          }}
        />
      )}
      {returning && (
        <FormModal
          title={"Devolución · " + returning.number}
          fields={[
            {
              key: "saleItemId",
              label: "Artículo a devolver",
              type: "select",
              required: true,
              options: returning.items
                .filter((i: any) => Number(i.returnedQty) < Number(i.qty))
                .map((i: any) => ({
                  label:
                    i.variant.product.name +
                    " · " +
                    attrLabel(i.variant.attributes),
                  value: i.id,
                })),
            },
            // Paso de 0.001 como las existencias: con el paso de 0.01 y el
            // mínimo de 0.001, el navegador rechazaba devolver 1 unidad
            // («valores válidos: 0.991 y 1.001») (R9-dinero-3-ui).
            {
              ...requiredNumber("qty", "Cantidad", 1),
              min: 0.001,
              step: "0.001",
            },
            {
              key: "reason",
              label: "Motivo",
              type: "textarea",
              required: true,
            },
            {
              key: "refundMethod",
              label: "Método de reembolso",
              type: "select",
              required: true,
              initial: "cash",
              options: [
                ...paymentOptions,
                { label: "Nota de crédito", value: "credit_note" },
              ],
            },
            {
              key: "restock",
              label: "Reingresar al stock vendible",
              type: "checkbox",
              initial: true,
            },
            { key: "opened", label: "Producto abierto", type: "checkbox" },
            { key: "damaged", label: "Producto dañado", type: "checkbox" },
          ]}
          onClose={() => setReturning(null)}
          onSubmit={(data) =>
            post("/returns", {
              operationId: returning.operationId,
              saleId: returning.id,
              cashSessionId: session.id,
              reason: data.reason,
              refundMethod: data.refundMethod,
              items: [
                {
                  saleItemId: data.saleItemId,
                  qty: data.qty,
                  restock: data.restock,
                  opened: data.opened,
                  damaged: data.damaged,
                },
              ],
            })
          }
        />
      )}
      {installment && (
        <FormModal
          title={
            "Registrar pago de crédito / contraentrega · " + installment.number
          }
          fields={[
            {
              ...requiredNumber("amount", "Monto del abono"),
              max: Number(installment.creditBalance),
            },
            {
              key: "method",
              label: "Método",
              type: "select",
              required: true,
              initial: "cash",
              options: paymentOptions,
            },
            { key: "bank", label: "Banco (transferencia)" },
            { key: "reference", label: "Referencia (transferencia)" },
            { key: "cardLast4", label: "Últimos 4 dígitos (tarjeta)" },
            { key: "approvalCode", label: "Aprobación (tarjeta)" },
          ]}
          onClose={() => setInstallment(null)}
          onSubmit={(data) =>
            post("/sales/" + installment.id + "/installments", {
              amount: data.amount,
              method: data.method,
              ...(data.method === "card"
                ? { cardLast4: data.cardLast4, approvalCode: data.approvalCode }
                : data.method === "transfer"
                  ? { bank: data.bank, reference: data.reference }
                  : {}),
              cashSessionId: session.id,
              offlineUuid: installment.offlineUuid,
            })
          }
        />
      )}
    </>
  );
}

export function Configuration() {
  const user = useStore((s) => s.user)!;
  const query = useQuery({
    queryKey: ["settings", user.branchId],
    queryFn: () => api("/settings"),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: () => api("/users"),
    enabled: can(user.permissions, "*"),
  });
  const roles = useQuery({
    queryKey: ["roles"],
    queryFn: () => api("/roles"),
    enabled: can(user.permissions, "*"),
  });
  const logs = useQuery({
    queryKey: ["audit"],
    queryFn: () => api("/audit-log"),
    enabled: can(user.permissions, "*"),
  });
  const [editing, setEditing] = useState(false),
    [newUser, setNewUser] = useState(false),
    [userEdit, setUserEdit] = useState<any>(null),
    [roleEdit, setRoleEdit] = useState<any>(null),
    [tab, setTab] = useState("business");
  const client = useQueryClient();
  if (!can(user.permissions, "*"))
    return can(user.permissions, "sale:manage") ? (
      <Equipment />
    ) : (
      <Empty
        title="Configuración del administrador"
        description="Pide al administrador que realice estos cambios."
      />
    );
  const fields: Field[] = [
    { key: "name", label: "Nombre del negocio", required: true },
    { key: "legalId", label: "RNC" },
    { key: "address", label: "Dirección" },
    { key: "phone", label: "Teléfono" },
    // Encabezado de lo impreso (tienda).
    { key: "branchName", label: "Sucursal" },
    { key: "phone2", label: "Teléfono 2 / WhatsApp" },
    {
      key: "autoPrintReceipt",
      label: "Imprimir la factura automáticamente al cobrar",
      type: "checkbox",
    },
    {
      key: "usdRate",
      label: "Tasa del dólar (RD$ por US$)",
      help: "Vacío: no se cuentan dólares.",
    },
    {
      key: "eurRate",
      label: "Tasa del euro (RD$ por €)",
      help: "Vacío: el cuadre no muestra euros.",
    },
    requiredNumber("sellerDiscountLimit", "Descuento máximo del vendedor (%)"),
    requiredNumber("cardFeePercent", "Comisión bancaria (%)"),
    requiredNumber("returnDays", "Plazo de devolución (días)"),
    requiredNumber("idleDays", "Días sin rotación"),
    requiredNumber("expiryDays", "Alerta de vencimiento (días)"),
    requiredNumber("lowMargin", "Margen bajo (%)"),
    requiredNumber("cashDifferenceLimit", "Alerta de diferencia en caja"),
    {
      key: "receiptWidth",
      label: "Ancho de ticket",
      type: "select",
      options: [
        { label: "80 mm", value: "80" },
        { label: "58 mm", value: "58" },
      ],
    },
    requiredNumber("sessionTimeoutMinutes", "Inactividad (minutos)"),
    requiredNumber(
      "creditApprovalThreshold",
      "Crédito por venta que requiere gerente (RD$)",
      1000,
    ),
    {
      key: "allowNegativeStock",
      label:
        "Permitir stock negativo en productos sin lote obligatorio (con advertencia)",
      type: "checkbox",
    },
    {
      key: "allowOfflineSales",
      label: "Permitir ventas sin conexión (riesgo entre varias cajas)",
      help: "Desactivado es lo más seguro: dos laptops offline no pueden reservar entre sí la última unidad. Actívalo sólo si aceptas revisar conflictos al reconectar.",
      type: "checkbox",
    },
    requiredNumber(
      "unusualDiscountPercent",
      "Alerta de descuento inusual (%)",
      25,
    ),
    requiredNumber(
      "lowSalesDropPercent",
      "Caída frente al promedio de 3 meses (%)",
      50,
    ),
    requiredNumber(
      "unusualDiscountCount",
      "Descuentos por vendedor al día para alertar",
      10,
    ),
    {
      key: "allowCreditSales",
      label: "Habilitar ventas a crédito con cliente y vencimiento",
      type: "checkbox",
    },
    {
      key: "ncfMode",
      label: "Preparación de NCF",
      type: "select",
      initial: "disabled",
      options: [
        { label: "Desactivada", value: "disabled" },
        { label: "Preparar solicitud (sin emisión fiscal)", value: "prepared" },
      ],
    },
    {
      key: "taxIncluded",
      label: "Precios con ITBIS incluido",
      type: "checkbox",
    },
  ];
  return (
    <>
      <Heading
        title="A la medida de tu negocio"
        caption="Define cómo trabaja tu tienda, desde los impuestos hasta los permisos."
      />
      <div className="tabs outside">
        {[
          ["business", "Negocio y reglas"],
          ["users", "Usuarios y permisos"],
          ["audit", "Bitácora"],
          ["equipment", "Equipos"],
        ].map(([id, label]) => (
          <button
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="panel">
        {tab === "equipment" ? (
          <Equipment />
        ) : tab === "business" ? (
          <QueryState query={query}>
            <div className="settings-summary">
              <div>
                <Badge tone="violet">República Dominicana · RD$</Badge>
                <h2>{query.data?.name}</h2>
                <p>
                  {query.data?.address || "Configura la dirección de tu tienda"}
                </p>
                <p>
                  ITBIS 18% {query.data?.taxIncluded ? "incluido" : "adicional"}{" "}
                  · Ticket {query.data?.receiptWidth} mm
                </p>
                <p>
                  NCF/e-CF reservado para integración futura. Los recibos son
                  internos.
                </p>
              </div>
              <Button onClick={() => setEditing(true)}>
                <Pencil size={16} />
                Editar configuración
              </Button>
            </div>
            <div className="settings-rules">
              {[
                ["Descuento vendedor", query.data?.sellerDiscountLimit + "%"],
                ["Sin rotación", query.data?.idleDays + " días"],
                ["Por vencer", query.data?.expiryDays + " días"],
                ["Margen bajo", query.data?.lowMargin + "%"],
                ["Devolución", query.data?.returnDays + " días"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <StoreSettings />
          </QueryState>
        ) : tab === "users" ? (
          <>
            <div className="panel-heading">
              <h2>Equipo de tu tienda</h2>
              <Button onClick={() => setNewUser(true)}>
                <Plus size={17} />
                Crear usuario
              </Button>
            </div>
            <QueryState query={users}>
              <DataTable
                rows={users.data || []}
                columns={[
                  { label: "Nombre", render: (u) => <strong>{u.name}</strong> },
                  {
                    label: "Usuario",
                    render: (u) => u.username || "Pendiente",
                  },
                  {
                    label: "Rol",
                    render: (u) => <Badge tone="violet">{u.role.name}</Badge>,
                  },
                  {
                    label: "Estado",
                    render: (u) => (u.active ? "Activo" : "Inactivo"),
                  },
                  {
                    label: "Acción",
                    render: (u) => (
                      <div className="inline-actions">
                        <button
                          className="text-link"
                          onClick={() => setUserEdit(u)}
                        >
                          Editar
                        </button>
                        {u.id !== user.id && (
                          <button
                            className="text-link"
                            onClick={async () => {
                              try {
                                await mutate(
                                  "/users/" + u.id,
                                  { active: !u.active },
                                  "PATCH",
                                );
                                await client.invalidateQueries();
                              } catch (e: any) {
                                toast(e.message, true);
                              }
                            }}
                          >
                            {u.active ? "Desactivar" : "Activar"}
                          </button>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </QueryState>
            <div className="panel-heading">
              <h2>Permisos por rol</h2>
            </div>
            <div className="roles-list">
              {roles.data?.map((r: any) => (
                <button key={r.id} onClick={() => setRoleEdit(r)}>
                  <strong>{r.name}</strong>
                  <small>{r.permissions.join(", ")}</small>
                  <Pencil size={17} />
                </button>
              ))}
            </div>
          </>
        ) : (
          <QueryState query={logs}>
            <DataTable
              rows={logs.data || []}
              columns={[
                {
                  label: "Fecha",
                  render: (l) =>
                    new Date(l.createdAt).toLocaleString("es-DO", {
                      timeZone: "America/Santo_Domingo",
                    }),
                },
                {
                  label: "Usuario",
                  render: (l) =>
                    users.data?.find((u: any) => u.id === l.userId)?.name ||
                    l.userId,
                },
                { label: "Acción", render: (l) => <Badge>{l.action}</Badge> },
                { label: "Entidad", render: (l) => l.entity },
                {
                  label: "Referencia",
                  render: (l) => <small>{l.entityId}</small>,
                },
              ]}
            />
          </QueryState>
        )}
      </div>
      {editing && (
        <FormModal
          title="Configuración del negocio"
          fields={fields}
          initial={{
            ...query.data,
            branchName: query.data?.branchName ?? "",
            phone2: query.data?.phone2 ?? "",
            autoPrintReceipt: !!query.data?.autoPrintReceipt,
            requireCustomer: query.data?.requireCustomer === true,
            allowOfflineSales: query.data?.allowOfflineSales === true,
            usdRate: query.data?.usdRate ?? "",
            eurRate: query.data?.eurRate ?? "",
          }}
          onClose={() => setEditing(false)}
          onSubmit={(data) => {
            // Tasa vacía = sin divisa.
            const rate = (v: unknown) =>
              v === "" || v === null || v === undefined ? null : Number(v);
            return mutate(
              "/settings",
              {
                ...data,
                usdRate: rate(data.usdRate),
                eurRate: rate(data.eurRate),
                currency: "DOP",
              },
              "PUT",
            );
          }}
        />
      )}
      {newUser && (
        <FormModal
          title="Crear usuario"
          fields={[
            { key: "name", label: "Nombre", required: true },
            {
              key: "username",
              label: "Usuario para entrar",
              required: true,
            },
            {
              key: "password",
              label:
                "Contraseña temporal (12+; mayúscula, minúscula, número y símbolo)",
              type: "password",
              required: true,
            },
            {
              key: "pin",
              label: "PIN de 4–6 dígitos",
              type: "password",
              required: true,
            },
            {
              key: "roleId",
              label: "Rol",
              type: "select",
              required: true,
              options: roles.data?.map((r: any) => ({
                label: r.name,
                value: r.id,
              })),
            },
          ]}
          onClose={() => setNewUser(false)}
          onSubmit={(data) => post("/users", data)}
        />
      )}
      {userEdit && (
        <FormModal
          title={"Editar usuario · " + userEdit.name}
          fields={[
            { key: "name", label: "Nombre", required: true },
            {
              key: "username",
              label: "Usuario para entrar",
              required: true,
            },
          ]}
          initial={{ name: userEdit.name, username: userEdit.username || "" }}
          onClose={() => setUserEdit(null)}
          onSubmit={(data) => mutate("/users/" + userEdit.id, data, "PATCH")}
        />
      )}
      {roleEdit && (
        <FormModal
          title={"Permisos · " + roleEdit.name}
          fields={[
            {
              key: "permissions",
              label: "Permisos separados por coma",
              type: "textarea",
              initial: roleEdit.permissions.join(", "),
              required: true,
              help: "Ejemplos: catalog:read, sale:write, profit:read. * da acceso completo.",
            },
          ]}
          onClose={() => setRoleEdit(null)}
          onSubmit={(data) =>
            mutate(
              "/roles/" + roleEdit.id,
              {
                permissions: data.permissions
                  .split(",")
                  .map((p: string) => p.trim())
                  .filter(Boolean),
              },
              "PUT",
            )
          }
        />
      )}
    </>
  );
}

export function StyleGuide() {
  const [modal, setModal] = useState(false);
  return (
    <>
      <Heading
        title="La energía de Nexora"
        caption="Un sistema visual para que cada interacción se sienta familiar."
      />
      <div className="panel style-guide">
        <h2>Colores que mueven</h2>
        <div className="swatch-grid">
          {[
            ["Primario", "#7C3AED"],
            ["Acento", "#EC4899"],
            ["Éxito", "#10B981"],
            ["Aviso", "#F59E0B"],
            ["Peligro", "#EF4444"],
            ["Fondo", "#F8FAFC"],
          ].map(([label, color]) => (
            <div key={label}>
              <div style={{ background: color }} />
              <strong>{label}</strong>
              <small>{color}</small>
            </div>
          ))}
        </div>
        <h2>Tipografía</h2>
        <h1>Tu negocio, en movimiento.</h1>
        <p>
          Inter y Plus Jakarta Sans · números tabulares · 12–16 px de radio ·
          controles táctiles de 44 px.
        </p>
        <h2>Botones</h2>
        <div className="style-row">
          {(
            ["primary", "secondary", "success", "danger", "ghost"] as const
          ).map((v) => (
            <Button key={v} variant={v} onClick={() => toast("Botón " + v)}>
              {v}
            </Button>
          ))}
          <Button disabled>Desactivado</Button>
        </div>
        <h2>Estados y etiquetas</h2>
        <div className="style-row">
          {["violet", "pink", "success", "warning", "danger", "neutral"].map(
            (v) => (
              <Badge key={v} tone={v}>
                {v}
              </Badge>
            ),
          )}
        </div>
        <h2>Formularios y superficies</h2>
        <label className="field">
          <span>Nombre del producto</span>
          <input placeholder="Ej. Proteína Whey Chocolate" />
        </label>
        <div className="style-row">
          <Button onClick={() => setModal(true)}>
            Abrir diálogo accesible
          </Button>
          <Button
            variant="secondary"
            onClick={() => toast("Cambios guardados.")}
          >
            Mostrar aviso
          </Button>
        </div>
        <Empty
          title="Un espacio para algo nuevo"
          description="Los estados vacíos siempre ofrecen un siguiente paso."
          action={
            <Button onClick={() => toast("Ejemplo de acción")}>Comenzar</Button>
          }
        />
      </div>
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Diálogo Nexora"
      >
        <p>Navega con Tab. Esc cierra. El foco regresa al control de origen.</p>
        <Button onClick={() => setModal(false)}>Entendido</Button>
      </Modal>
    </>
  );
}
