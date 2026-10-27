import {
  CashElsewhere,
  Equipment,
  cashOnOtherDevice,
  registerTerminal,
  terminalIdentity,
} from "./realtime";
import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { formatMoney, can, DEFAULT_SETTINGS } from "@fitstore/shared";
import {
  api,
  post,
  loadCatalog,
  useStore,
  download,
  DOWNLOAD_FAILED,
  localDB,
  syncSales,
  type Product,
} from "./api";
import {
  QueryState as BaseQueryState,
  CustomerPrivacyNotice,
  FormModal,
  ConfirmModal,
  type Field,
  attrLabel,
  dateLabel,
  today,
  toast,
  mutate,
  matchesWords,
  searchWords,
} from "./helpers";
import { confirmMargin, productSearchText } from "./catalogChecks";
import { PurchaseEditor, ReceiptEditor, ReceiptHistory } from "./Purchases";
import { WarehousesPanel } from "./WarehousesPanel";
import { CourierFeeEditor } from "./CourierFeeEditor";
import { SaleEditPanel, editableNow } from "./SaleEditPanel";
import { IncomeByDay } from "./IncomeByDay";
import { FormalReports } from "./FormalReports";
import { SupportAccessCard } from "./SupportAccess";
import { productTenancyRequired } from "./productTenancy";
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
import { METHOD_LABEL } from "./Prints";
import {
  customerEditValue,
  customerPrivateDisplay,
  seesCustomerPii,
} from "./customer-display";
import {
  businessErrorMessage,
  managementQueryError,
  openCashBlindNote,
} from "./managementMessages";
import { passwordChangeError, passwordPolicyForRole } from "./passwordChange";
import "./passwordChange.css";
import { IncentiveRates, MyIncentives } from "./Incentives";
import { CashierSurveySummary } from "./QuickQuestions";
import { DriveBackupCard } from "./DriveBackup";
import { InventoryImportButton } from "./InventoryImport";
import { NcfSequenceSettings } from "./NcfSequenceSettings";
import {
  applyPendingSaleReprice,
  conflictHelp,
  discardWithApproval,
  isPendingPriceConflict,
  retryMessage,
} from "./pendingSales";

type Column = {
  label: string;
  render: (row: any) => ReactNode;
  className?: string;
};
function QueryState({ query, children }: { query: any; children: ReactNode }) {
  return (
    <BaseQueryState
      query={
        query.error
          ? { ...query, error: { message: managementQueryError(query.error) } }
          : query
      }
    >
      {children}
    </BaseQueryState>
  );
}
function DataTable({
  rows,
  columns,
  empty = "Todavía no hay registros",
  emptyDescription = "Revisa la búsqueda y los filtros, o registra un nuevo dato desde esta pantalla.",
  cards = false,
}: {
  rows: any[];
  columns: Column[];
  empty?: string;
  emptyDescription?: string;
  /** En el celular cada fila es una tarjeta (sin desplazamiento horizontal). */
  cards?: boolean;
}) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [rows.length]);
  const totalPages = Math.ceil(rows.length / 20);
  return rows.length ? (
    <>
      {/* G12: con desplazamiento horizontal, la tabla se recorre con teclado. */}
      <div
        className={"table-wrap" + (cards ? " table-cards" : "")}
        tabIndex={0}
      >
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
                  <td
                    key={c.label}
                    className={c.className}
                    data-label={c.label}
                  >
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
    <Empty title={empty} description={emptyDescription} />
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
  // Misma búsqueda que la caja: código de barras, SKU de variante, sin acentos.
  const words = searchWords(search);
  const rows =
    query.data?.filter(
      (p) =>
        (!category || p.categoryId === category) &&
        matchesWords(productSearchText(p), words),
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
      key: "service",
      label: "Es un servicio (se vende sin existencia)",
      type: "checkbox",
    },
    {
      key: "soldByUnit",
      label:
        "Se vende por unidad (sin decimales; desmárcalo para kg, lb o litro)",
      type: "checkbox",
      initial: true,
    },
    {
      key: "imageUrl",
      label: "URL de la foto",
      initial: "/products/accessories.svg",
    },
    { key: "description", label: "Descripción", type: "textarea" },
  ];
  return (
    <div className="catalog-screen">
      <Heading
        title="Catálogo de productos"
        caption="Consulta productos, variantes, precios y existencias desde una sola vista."
      >
        {write && (
          <>
            <Button onClick={() => setCreate(true)}>
              <Plus size={17} />
              Nuevo producto
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  "/catalog-template.xlsx",
                  "plantilla-productos.xlsx",
                ).catch(() =>
                  toast(
                    "No pudimos descargar la plantilla. Revisa tu conexión e inténtalo de nuevo.",
                    true,
                  ),
                )
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
                className="sr-only"
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
                    } catch {
                      toast(
                        "No pudimos importar el archivo. Revisa las columnas y los datos de la plantilla antes de volver a intentar.",
                        true,
                      );
                    }
                    e.target.value = "";
                  }
                }}
              />
            </label>
            {can(user.permissions, "inventory:import") && (
              <InventoryImportButton />
            )}
          </>
        )}
      </Heading>
      <section className="panel catalog-panel" aria-labelledby="catalog-list-title">
        <div className="panel-heading catalog-panel-heading">
          <div>
            <h2 id="catalog-list-title">Productos registrados</h2>
            <p>Busca por nombre, código o marca y revisa el estado del inventario.</p>
          </div>
          <Badge tone="violet">{rows.length} productos</Badge>
        </div>
        <div className="table-toolbar catalog-toolbar">
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
        </div>
        <QueryState query={query}>
          <DataTable
            cards
            rows={rows}
            empty={
              query.data?.length
                ? "No encontramos productos"
                : "Aún no tienes productos"
            }
            emptyDescription={
              query.data?.length
                ? "Revisa los filtros o agrega un producto con Nuevo producto."
                : "Crea tu primer producto con «Nuevo producto» o importa desde Excel."
            }
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
      </section>
      {create && (
        <FormModal
          title="Un nuevo producto para tu tienda"
          fields={fields}
          onClose={() => setCreate(false)}
          onSubmit={(values) => {
            const { barcode, price, costAvg, service, ...data } = values;
            if (!service && !confirmMargin(price, costAvg))
              return Promise.reject(
                new Error("No se guardó: corrige el precio o confírmalo."),
              );
            return post("/products", {
              ...data,
              ...(service ? { unit: "servicio", minStock: 0 } : {}),
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
            !confirmMargin(values.price, values.costAvg)
              ? Promise.reject(
                  new Error("No se guardó: corrige el precio o confírmalo."),
                )
              : post("/products/" + matrix.id + "/variants", {
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
                  {
                    key: "soldByUnit",
                    label: "Se vende por unidad (sin decimales)",
                    type: "checkbox",
                  },
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
            if (
              editing.type === "variant" &&
              !confirmMargin(data.price, data.costAvg)
            )
              throw new Error("No se guardó: corrige el precio o confírmalo.");
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
    </div>
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
        cards
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
  const warehouses = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => api("/inventory/warehouses"),
  });
  // N-1: la devolución a proveedor lleva proveedor y referencia.
  const adjustSuppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api("/suppliers"),
  });
  const [search, setSearch] = useState(""),
    [mode, setMode] = useState("stock"),
    [adjust, setAdjust] = useState<any>(null),
    [count, setCount] = useState<any>(null),
    [kardex, setKardex] = useState<any>(null);
  const [warehouseView, setWarehouseView] = useState("all");
  const selectedWarehouse = (warehouses.data || []).find(
    (w: any) => w.id === warehouseView,
  );
  const storeWarehouseName =
    (warehouses.data || []).find((w: any) => w.kind === "store")?.name ||
    "Almacén vendible";
  const visibleStock = (v: any) =>
    selectedWarehouse
      ? selectedWarehouse.kind === "store"
        ? v.stock
        : v.warehouseStocks?.find(
            (s: any) => s.warehouseId === selectedWarehouse.id,
          )?.qty || "0"
      : v.stock;
  const countWarehouseId =
    selectedWarehouse?.id ||
    (warehouses.data || []).find((w: any) => w.kind === "store")?.id ||
    "";
  const stockAtWarehouse = (variant: any, id: string) => {
    const warehouse = (warehouses.data || []).find((w: any) => w.id === id);
    if (!warehouse || warehouse.kind === "store") return Number(variant.stock);
    return Number(
      variant.warehouseStocks?.find((stock: any) => stock.warehouseId === id)
        ?.qty ?? 0,
    );
  };
  const words = searchWords(search);
  const rows = (query.data || []).filter((v: any) =>
    matchesWords(productSearchText({ ...v.product, variants: [v] }), words),
  );
  return (
    <>
      <Heading
        title="Inventario"
        caption="El inventario correcto hace espacio para mejores decisiones."
      />
      <div className="panel inventory-panel">
        <div className="panel-heading">
          <div>
            <h2>Existencias por almacén</h2>
            <p>Consulta cantidades, lotes y vencimientos antes de ajustar.</p>
          </div>
          <div className="field inventory-warehouse-field">
            <label htmlFor="warehouse-view">Almacén</label>
            <select
              id="warehouse-view"
              value={warehouseView}
              onChange={(e) => setWarehouseView(e.target.value)}
            >
              <option value="all">Todos</option>
              {(warehouses.data || []).map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="tabs">
            <button
              type="button"
              className={mode === "stock" ? "active" : ""}
              aria-pressed={mode === "stock"}
              onClick={() => setMode("stock")}
            >
              Stock actual
            </button>
            <button
              type="button"
              className={mode === "counts" ? "active" : ""}
              aria-pressed={mode === "counts"}
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
              cards
              rows={rows}
              empty="No encontramos artículos en el inventario"
              emptyDescription="Revisa la búsqueda o registra una entrada de mercancía."
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
                { label: "Precio", render: (v) => formatMoney(v.price) },
                ...(can(user.permissions, "profit:read")
                  ? [
                      {
                        label: "Costo",
                        render: (v: any) => formatMoney(v.costAvg),
                      },
                    ]
                  : []),
                {
                  label: selectedWarehouse
                    ? "En " + selectedWarehouse.name
                    : "En " + storeWarehouseName,
                  render: (v) => (
                    <Badge
                      tone={
                        selectedWarehouse && !selectedWarehouse.sellable
                          ? "neutral"
                          : Number(v.stock) <= Number(v.product.minStock)
                            ? "warning"
                            : "success"
                      }
                    >
                      {visibleStock(v)} ·{" "}
                      {selectedWarehouse && !selectedWarehouse.sellable
                        ? "En almacén"
                        : Number(v.stock) <= Number(v.product.minStock)
                          ? "Stock bajo"
                          : "Disponible"}
                    </Badge>
                  ),
                },
                { label: "Total", render: (v) => v.totalStock },
                {
                  label: `Lote en ${storeWarehouseName}`,
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
                empty="Todavía no hay conteos físicos"
                emptyDescription="Pulsa Contar junto a un artículo para registrar su existencia real."
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
                            } catch {
                              toast(
                                "No pudimos aprobar el conteo. Revisa los datos y tu conexión antes de volver a intentar.",
                                true,
                              );
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
      <WarehousesPanel rows={rows} warehouseId={warehouseView} />
      {adjust && (
        <FormModal
          title={"Ajustar · " + adjust.product.name}
          fields={[
            {
              key: "warehouseId",
              label: "Almacén",
              type: "select",
              required: true,
              initial: countWarehouseId,
              options: (warehouses.data || []).map((w: any) => ({
                label: w.name,
                value: w.id,
              })),
            },
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
              key: "supplierId",
              label: "Proveedor (solo en devolución a proveedor)",
              type: "select",
              options: (adjustSuppliers.data || []).map((x: any) => ({
                label: x.name,
                value: x.id,
              })),
            },
            {
              key: "reference",
              label:
                "Referencia de la devolución (documento o nota de crédito)",
            },
            // Un lote existente sirve para sacar o para sumar sin repetir
            // número ni vencimiento; sólo un lote nuevo los pide, y el
            // vencimiento sólo si la categoría lo exige.
            ...(adjust.lots.length
              ? [
                  {
                    key: "lotId",
                    label: "Lote existente (salida o entrada a ese lote)",
                    type: "select" as const,
                    options: adjust.lots.map((l: any) => ({
                      label: l.lotNumber + " · " + l.qty + " unidades",
                      value: l.id,
                    })),
                  },
                ]
              : []),
            ...(adjust.product.category?.requiresLot ||
            adjust.product.category?.requiresExpiry
              ? [{ key: "lotNumber", label: "Lote nuevo de entrada" }]
              : []),
            ...(adjust.product.category?.requiresExpiry
              ? [
                  {
                    key: "expiryDate",
                    label: "Vencimiento del lote nuevo",
                    type: "date" as const,
                  },
                ]
              : []),
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
              supplierId:
                data.type === "supplier_return"
                  ? data.supplierId || undefined
                  : undefined,
              reference:
                data.type === "supplier_return"
                  ? data.reference || undefined
                  : undefined,
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
            {
              key: "warehouseId",
              label: "Almacén",
              type: "select",
              required: true,
              initial:
                selectedWarehouse?.id ||
                (warehouses.data || []).find((w: any) => w.kind === "store")
                  ?.id ||
                "",
              options: (warehouses.data || []).map((w: any) => ({
                label: w.name,
                value: w.id,
              })),
            },
            // Suplementos y maquillaje: se cuenta cada lote por separado.
            ...(count.product.category?.requiresLot
              ? [
                  {
                    key: "lotId",
                    label: "Lote que contaste",
                    type: "select" as const,
                    required: true,
                    options: count.lots.map((l: any) => ({
                      label: l.lotNumber,
                      value: l.id,
                    })),
                  },
                ]
              : []),
            requiredNumber(
              "counted",
              "Cantidad contada",
              count.product.category?.requiresLot
                ? 0
                : stockAtWarehouse(count, countWarehouseId),
            ),
          ]}
          onFieldChange={(key, value, values) =>
            key === "lotId"
              ? {
                  ...values,
                  counted: Number(
                    count.lots.find((l: any) => l.id === value)?.qty ?? 0,
                  ),
                }
              : key === "warehouseId" && !count.product.category?.requiresLot
                ? { ...values, counted: stockAtWarehouse(count, String(value)) }
                : undefined
          }
          onClose={() => setCount(null)}
          onSubmit={(data) =>
            post("/inventory/counts", {
              warehouseId: data.warehouseId,
              items: [
                {
                  variantId: count.id,
                  lotId: data.lotId || undefined,
                  counted: data.counted,
                },
              ],
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
  // La API no envía el total de la orden a quien no ve costos (F2).
  const seesCost = can(useStore((s) => s.user)!.permissions, "profit:read");
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
              empty="Todavía no hay órdenes de compra"
              emptyDescription="Crea una Orden de compra para registrar tu próxima compra."
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
                ...(seesCost
                  ? [
                      {
                        label: "Total",
                        render: (o: any) => formatMoney(o.total),
                      },
                    ]
                  : []),
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
              empty="Todavía no hay proveedores"
              emptyDescription="Pulsa Proveedor para registrar quién te vende la mercancía."
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
                      // D-M4: una clave por formulario; un reintento no
                      // duplica el pago.
                      onClick={() =>
                        setPaySupplier({
                          ...s,
                          operationId: crypto.randomUUID(),
                        })
                      }
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
            post("/supplier-payments", {
              ...data,
              supplierId: paySupplier.id,
              operationId: paySupplier.operationId,
            })
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
  // D-M4: la clave del formulario abierto (un reintento no duplica el gasto).
  const [create, setCreate] = useState<string | false>(false),
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
        <Button onClick={() => setCreate(crypto.randomUUID())}>
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
                label: "Comprobante",
                render: (e) =>
                  e.ncf ? (
                    <span>
                      <strong>{e.ncf}</strong>
                      <small>ITBIS: {formatMoney(e.itbis ?? 0)}</small>
                    </span>
                  ) : e.receiptUrl ? (
                    "Comprobante anterior sin datos fiscales"
                  ) : (
                    "Sin comprobante"
                  ),
              },
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
          fields={(values) => {
            const withDocument = Boolean(
              values.receiptUrl?.trim() ||
              values.ncf?.trim() ||
              (values.itbis ?? "") !== "",
            );
            return [
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
              { key: "receiptUrl", label: "URL del comprobante (opcional)" },
              {
                key: "ncf",
                label: "NCF del comprobante",
                required: withDocument,
                help: "Si registras un comprobante, indica también el ITBIS facturado.",
              },
              {
                key: "itbis",
                label: "ITBIS del comprobante",
                inputMode: "decimal",
                pattern: "[0-9]+([.][0-9]{1,2})?",
                required: withDocument,
                help: "Escribe 0 cuando el comprobante no facture ITBIS.",
              },
              {
                key: "recurring",
                label: "Marcar como recurrente mensual",
                type: "checkbox",
              },
            ];
          }}
          onClose={() => setCreate(false)}
          onSubmit={(data) =>
            post("/expenses", {
              ...data,
              // Vacío no equivale a cero; la API exige el dato si hay comprobante.
              itbis: data.itbis === "" ? undefined : Number(data.itbis),
              operationId: create,
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

// 05-B2: el tipo de alerta en español (antes «offline conflict», «low
// stock»…). Un tipo nuevo sin etiqueta se muestra legible igual.
const ALERT_TYPE_LABEL: Record<string, string> = {
  offline_conflict: "Venta sin conexión",
  receivable: "Por cobrar",
  credit_reminder: "Créditos por cobrar",
  cash_difference: "Diferencia de caja",
  return_waste: "Merma por devolución",
  expense_budget: "Presupuesto de gastos",
  expired: "Vencido",
  expiring: "Por vencer",
  low_margin: "Margen bajo",
  low_sales: "Ventas bajas",
  low_stock: "Stock bajo",
  negative_stock: "Stock negativo",
  no_movement: "Sin movimiento",
  out_of_stock: "Agotado",
  overstock: "Exceso de stock",
  unusual_discount: "Descuento inusual",
  sale_void_request: "Solicitud de anulación",
};
const alertTypeLabel = (type: string) =>
  ALERT_TYPE_LABEL[type] ?? type.replaceAll("_", " ");

export function Cash() {
  const user = useStore((s) => s.user)!;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: () => api("/cash-sessions"),
  });
  // 05-A2: gerencia ve en este equipo las ventas guardadas de toda su
  // sucursal (antes sólo las suyas, que eran ninguna); la cajera, las suyas.
  // 05-M3: es una consulta local (IndexedDB): sin internet también corre.
  const manages = can(user.permissions, "sale:manage");
  const pending = useQuery({
    queryKey: ["pending-sales", user.id, manages],
    queryFn: () =>
      manages
        ? localDB.sales.filter((s) => s.branchId === user.branchId).toArray()
        : localDB.sales.where("userId").equals(user.id).toArray(),
    refetchInterval: 5000,
    networkMode: "always",
  });
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api("/customers"),
  });
  const [open, setOpen] = useState(false),
    // D-M4: la clave del formulario abierto (un reintento no duplica).
    [movement, setMovement] = useState<string | false>(false),
    [closing, setClosing] = useState<any>(null),
    [discarding, setDiscarding] = useState<any>(null),
    [printing, setPrinting] = useState<Printing>(null),
    [printSession, setPrintSession] = useState<string>(),
    [autoPrint, setAutoPrint] = useState(false);
  // Fondo sugerido: lo dejado en el último cierre de la propia persona.
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
        : applied.synced.status === "retry"
          ? "Precios actualizados. " + retryMessage(1)
          : "Precios actualizados. La venta sigue pendiente de revisión.",
      applied.synced.status !== "synced",
    );
  };
  return (
    <div className="cash-page">
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
              onClick={() => setMovement(crypto.randomUUID())}
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
            <small>
              Sólo lo que entró a esta gaveta. Las ventas a crédito y lo
              «Recibido por la dueña» salen en Reportes pero no aquí; por eso
              los totales pueden ser distintos sin que haya descuadre.
            </small>
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
          <p>{openCashBlindNote(false)}</p>
        </div>
      ) : (
        <div className="panel">
          <Empty
            title="Tu día empieza con una caja abierta"
            description="Registra el fondo inicial para comenzar a vender."
            action={
              <Button onClick={() => setOpen(true)}>Abrir mi caja</Button>
            }
          />
        </div>
      )}
      <MyIncentives />
      {can(user.permissions, "sale:write") && <CodPending session={active} />}
      {!!pending.data?.length && (
        <section className="panel pending-panel">
          <div className="panel-heading">
            <div>
              <h2>Ventas guardadas en este dispositivo</h2>
              <p>
                Conservadas hasta recibir confirmación del servidor. Si una
                requiere revisión, la cajera la reintenta y gerencia la puede
                descartar con su PIN.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const result = await syncSales();
                  await client.invalidateQueries();
                  toast(
                    `${result.synced} sincronizadas · ${result.conflicts} requieren revisión` +
                      (result.retry
                        ? ` · ${result.retry} por reintentar.`
                        : "."),
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
              ...(manages
                ? [
                    {
                      label: "Cobró",
                      render: (s: any) =>
                        s.userId === user.id
                          ? user.name
                          : (s.userName ?? "Otra persona de este equipo"),
                    },
                  ]
                : []),
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
                render: (s) => (
                  <>
                    {s.message || "Esperando conexión"}
                    {s.status === "conflict" && (
                      <small className="pending-sale-help">
                        {s.userId === user.id
                          ? conflictHelp(s.message)
                          : "Sólo " +
                            (s.userName ?? "quien la cobró") +
                            " puede reintentarla desde su sesión. Si no se puede cobrar, descártala."}
                      </small>
                    )}
                  </>
                ),
              },
              {
                label: "Acción",
                render: (s) => {
                  if (s.status !== "conflict") return null;
                  const priceConflict = isPendingPriceConflict(s.message);
                  const own = s.userId === user.id;
                  return (
                    <div className="pending-sale-actions">
                      {own && !s.input.customerId && (
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
                      {own && priceConflict && (
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
                      {own && s.input.customerId && !priceConflict && (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            await localDB.sales.update(s.id, {
                              status: "pending",
                              message: undefined,
                            });
                            // 05-A2: reintenta ya, no al próximo
                            // «Sincronizar»: la cajera ve el resultado.
                            try {
                              const result = await syncSales();
                              toast(
                                result.conflicts
                                  ? "La venta sigue requiriendo revisión."
                                  : result.synced
                                    ? "Venta sincronizada."
                                    : result.retry
                                      ? retryMessage(result.retry)
                                      : "Lista para reintentar al volver la conexión.",
                                result.conflicts > 0 || result.retry > 0,
                              );
                            } catch (e: any) {
                              toast(e.message, true);
                            }
                            await client.invalidateQueries({
                              queryKey: ["pending-sales"],
                            });
                          }}
                        >
                          Reintentar
                        </Button>
                      )}
                      <Button variant="danger" onClick={() => setDiscarding(s)}>
                        {manages ? "Descartar" : "Descartar con PIN de gerente"}
                      </Button>
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
              ...(can(user.permissions, "sale:manage")
                ? [
                    {
                      label: "Cajero",
                      render: (s: any) => <strong>{s.userName ?? "—"}</strong>,
                    },
                  ]
                : []),
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
              ...(suggestion.data?.fromSessionId
                ? { help: "Sugerido: lo que dejaste en tu último cierre." }
                : {}),
            },
            // Un fondo menor que lo dejado en el último cierre se explica con
            // una nota; no pide PIN (D-03).
            ...(suggestion.data?.fromSessionId
              ? [
                  {
                    key: "openingNote",
                    label: "Nota si el fondo es menor que el sugerido",
                    type: "textarea" as const,
                  },
                ]
              : []),
          ]}
          onClose={() => setOpen(false)}
          onSubmit={async ({ openingNote, ...data }) => {
            // La caja queda asignada a este equipo (el servidor usa su registro).
            await registerTerminal().catch(() => undefined);
            // Caja nueva, día nuevo: que este equipo use la última versión.
            window.dispatchEvent(new Event("nexora:check-update"));
            return post("/cash-sessions/open", {
              ...data,
              ...(String(openingNote ?? "").trim()
                ? { openingNote: String(openingNote).trim() }
                : {}),
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
            // D-04: las salidas del turno sobre el límite de Ajustes
            // necesitan el PIN de un gerente (no el de la cajera).
            ...(can(user.permissions, "sale:manage")
              ? []
              : [
                  {
                    key: "managerPin",
                    label: "PIN del gerente",
                    type: "password" as const,
                    help: "Sólo para salidas que superen el límite del turno.",
                  },
                ]),
          ]}
          onClose={() => setMovement(false)}
          onSubmit={({ managerPin, ...data }) =>
            post("/cash-sessions/" + active.id + "/movements", {
              ...data,
              operationId: movement,
              ...(managerPin ? { managerPin } : {}),
            })
          }
        />
      )}
      {closing && (
        <CloseCashModal
          session={closing}
          onClose={() => setClosing(null)}
          onClosed={(cuadre) => {
            setPrintSession(closing.id);
            setClosing(null);
            setPrinting({ kind: "cuadre", data: cuadre });
            setAutoPrint(true);
          }}
        />
      )}
      {discarding && (
        <DiscardOfflineSale
          sale={discarding}
          needsPin={!manages}
          onClose={() => setDiscarding(null)}
          onDiscarded={async () => {
            setDiscarding(null);
            await client.invalidateQueries({ queryKey: ["pending-sales"] });
            toast("Venta sin conexión descartada. Quedó en la bitácora.");
          }}
        />
      )}
      <PrintModal
        printing={printing}
        onClose={() => {
          setPrinting(null);
          setPrintSession(undefined);
          setAutoPrint(false);
          window.dispatchEvent(new Event("nexora:check-update"));
        }}
        autoPrint={autoPrint}
        sessionId={printSession}
        onSwitch={setPrinting}
      />
    </div>
  );
}

// 05-A2: descartar una venta sin conexión en conflicto, con el PIN de un
// gerente si quien la pide es la cajera. La bitácora guarda quién aprobó, el
// motivo y lo que la caja tenía (artículos y pagos).
function DiscardOfflineSale({
  sale,
  needsPin,
  onClose,
  onDiscarded,
}: {
  sale: any;
  needsPin: boolean;
  onClose: () => void;
  onDiscarded: () => void;
}) {
  const [reason, setReason] = useState(""),
    [pin, setPin] = useState(""),
    [outcome, setOutcome] = useState<"returned" | "delivered">("returned"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lines: any[] = sale.receipt?.snapshot ?? [];
  const paid = (sale.input?.payments ?? []).reduce(
    (sum: number, p: any) => sum + Number(p.amount ?? 0),
    0,
  );
  return (
    <Modal open onClose={onClose} title="Descartar venta sin conexión">
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await discardWithApproval(
              sale,
              reason,
              needsPin ? pin : undefined,
              {
                post,
                deleteLocal: (id) => localDB.sales.delete(id),
              },
              outcome,
            );
            onDiscarded();
          } catch (e: any) {
            setError(businessErrorMessage(e));
            setBusy(false);
          }
        }}
      >
        <p>
          <strong>{sale.receipt?.number}</strong> ·{" "}
          {formatMoney(sale.receipt?.total ?? 0)}
          {sale.userName ? " · cobró " + sale.userName : ""}
        </p>
        {!!lines.length && (
          <ul className="discard-lines">
            {lines.map((line, index) => (
              <li key={index}>
                {line.qty} × {line.name}
              </li>
            ))}
          </ul>
        )}
        <label className="field">
          <span>¿Qué pasó con la mercancía?</span>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as any)}
          >
            <option value="returned">
              No salió o se devolvió, con su dinero (no se mueve nada)
            </option>
            <option value="delivered">
              El cliente se la llevó y pagó (se registra la venta con su
              factura)
            </option>
          </select>
        </label>
        <p className="form-hint">
          {outcome === "delivered"
            ? "Se registra la venta real con los datos que guardó el servidor y los precios de hoy, en la caja de quien la cobró (" +
              formatMoney(paid) +
              " cobrados en el equipo). La revisa la cajera que la cobró, con el PIN de gerencia. Si el pago no cubre el total o falta algún dato, se rechaza: descártala como devuelta y vuelve a facturarla."
            : "La venta no se registra ni descuenta inventario. Lo cobrado en este equipo (" +
              formatMoney(paid) +
              ") queda anotado en la bitácora y en una alerta para gerencia: si el dinero quedó en la caja, el cuadre lo mostrará como sobrante."}
        </p>
        <label className="field">
          <span>Motivo obligatorio</span>
          <textarea
            required
            minLength={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {needsPin && (
          <label className="field">
            <span>PIN del gerente</span>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]{4,6}"
              required
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          </label>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy}>
            {busy ? "Descartando…" : "Descartar venta"}
          </Button>
        </div>
      </form>
    </Modal>
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
  // SEC-05: sin gerencia, la API envía teléfono, correo y cédula/RNC
  // enmascarados («•••••••123») y sin gasto histórico. El correo enmascarado
  // no es un correo válido para el navegador; la API lo valida al guardar.
  const fullCustomer = seesCustomerPii(user.permissions);
  const fields: Field[] = [
    { key: "name", label: "Nombre", required: true },
    { key: "phone", label: "Teléfono" },
    {
      key: "email",
      label: "Correo",
      ...(fullCustomer ? { type: "email" } : {}),
    },
    { key: "legalId", label: "Cédula / RNC" },
    ...(can(useStore.getState().user!.permissions, "sale:manage")
      ? [requiredNumber("creditLimit", "Límite de crédito (RD$)", 0)]
      : []),
    { key: "notes", label: "Notas", type: "textarea" },
  ];
  const rows = (query.data || []).filter((c: any) =>
    // P5: sin acceso completo la búsqueda no usa el teléfono, para
    // no servir de oráculo de los dígitos ocultos.
    (c.name + " " + (fullCustomer ? c.phone : ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="catalog-screen">
      <Heading
        title="Clientes"
        caption="Consulta contactos, compras y datos de crédito desde un solo directorio."
      >
        <Button onClick={() => setCreate(true)}>
          <Plus size={17} />
          Nuevo cliente
        </Button>
      </Heading>
      <section
        className="panel catalog-panel"
        aria-labelledby="customers-list-title"
      >
        <div className="panel-heading catalog-panel-heading">
          <div>
            <h2 id="customers-list-title">Directorio de clientes</h2>
            <p>Busca por nombre o teléfono y revisa su historial comercial.</p>
          </div>
          <Badge tone="violet">{rows.length} clientes</Badge>
        </div>
        <div className="table-toolbar catalog-toolbar">
          <Filter
            value={search}
            onChange={setSearch}
            placeholder="Buscar nombre o teléfono"
          />
        </div>
        <QueryState query={query}>
          <DataTable
            cards
            rows={rows}
            empty="No encontramos clientes"
            emptyDescription="Revisa la búsqueda o registra una persona con Nuevo cliente."
            columns={[
              { label: "Cliente", render: (c) => <strong>{c.name}</strong> },
              {
                label: "Contacto",
                render: (c) => (
                  <span>
                    {customerPrivateDisplay(c.phone, fullCustomer)}
                    <small>{c.email}</small>
                  </span>
                ),
              },
              {
                label: "Cédula / RNC",
                // P5 + SEC-05: la API ya envía el dato enmascarado a la caja;
                // la vista lo acorta igual («•••123») con el mismo criterio
                // de acceso que la API (fullCustomer).
                render: (c) => customerPrivateDisplay(c.legalId, fullCustomer),
              },
              ...(fullCustomer
                ? [
                    { label: "Compras", render: (c: any) => c.purchases },
                    {
                      label: "Total gastado",
                      render: (c: any) => formatMoney(c.totalSpent),
                    },
                    {
                      label: "Última compra",
                      render: (c: any) =>
                        c.lastPurchase
                          ? dateLabel(c.lastPurchase)
                          : "Aún sin compras",
                    },
                  ]
                : []),
              {
                label: "Acción",
                render: (c) => (
                  <div className="table-actions">
                    <button className="text-link" onClick={() => setEditing(c)}>
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
      </section>
      {create && (
        <FormModal
          title="Nuevo cliente"
          fields={fields}
          notice={<CustomerPrivacyNotice />}
          onClose={() => setCreate(false)}
          onSubmit={(data) => post("/customers", data)}
        />
      )}
      {editing && (
        <FormModal
          title="Editar cliente"
          fields={fields}
          notice={<CustomerPrivacyNotice />}
          // P5: «Editar» tampoco muestra teléfono ni cédula/RNC completos.
          initial={{
            ...editing,
            phone: customerEditValue(editing.phone, fullCustomer),
            legalId: customerEditValue(editing.legalId, fullCustomer),
          }}
          onClose={() => setEditing(null)}
          onSubmit={(data) => mutate("/customers/" + editing.id, data, "PATCH")}
        />
      )}
      {anonymizing && (
        <ConfirmModal
          title="Anonimizar cliente"
          description={`${anonymizing.debt > 0 ? `${anonymizing.name} todavía debe ${formatMoney(anonymizing.debt)} (crédito o contraentrega): no se puede anonimizar hasta que salde la deuda. ` : ""}Se eliminarán los datos personales de ${anonymizing.name}: nombre, teléfono, correo, cédula/RNC, notas, fotos de comprobantes y su nombre en motivos, referencias, bitácora y avisos pendientes. Las ventas y sus montos se conservarán. Los avisos que ya llegaron a Telegram y las copias de seguridad se eliminan al vencer su plazo. Esta acción no se puede deshacer.`}
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
    </div>
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
            sugerido conserva al menos 15% de margen según el costo actual.
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
                    {c.daysToExpiry !== null && (
                      <small>
                        La oferta se aplica a la variante; la caja vende los
                        lotes más antiguos primero.
                      </small>
                    )}
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
                  disabled={c.suggestedDiscount <= 0}
                  onClick={() => setOffer(c)}
                >
                  <Sparkles size={16} />
                  {c.suggestedDiscount <= 0
                    ? "Sin margen para oferta"
                    : "Crear oferta"}{" "}
                  <ArrowRight size={16} />
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
              max: offer.suggestedDiscount,
              help: `Máximo ${offer.suggestedDiscount}% para conservar al menos 15% de margen según costo y precio actuales.`,
            },
            {
              key: "endsAt",
              label: "Fecha de finalización",
              type: "date",
              initial: new Date(
                Date.now() +
                  Math.max(0, Math.min(14, offer.daysToExpiry ?? 14)) *
                    86400000,
              )
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
  ["fiscal", "Libro fiscal NCF (emitidos y anulados)"],
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
  [
    "ventas-categoria-forma-pago",
    "Ventas por categoría y forma de pago (% y monto)",
  ],
  ["income-by-day", "Ingresos por día y método"],
  ["formal", "Informe formal diario/mensual"],
  ["returns-discounts", "Devoluciones y descuentos"],
  ["customers", "Mejores clientes"],
  ["purchases", "Compras y cuentas por pagar"],
];
// Dueña (21-oct): los reportes ordenados por grupos plegables; en el móvil,
// lista vertical (nada de fila horizontal).
const REPORT_GROUPS: [string, string[]][] = [
  [
    "Ventas",
    [
      "sales",
      "fiscal",
      "monthly-consumption",
      "ventas-categoria-forma-pago",
      "returns-discounts",
      "anulaciones",
      "devoluciones-producto",
      "por-mayor-detalle",
    ],
  ],
  [
    "Caja y pagos",
    [
      "cash",
      "descuadres",
      "diferencias-cuadre",
      "by-payment",
      "income-by-day",
      "entradas-cuenta",
      "formas-pago-mes",
      "formas-pago-categoria",
    ],
  ],
  [
    "Contraentregas y crédito",
    [
      "creditos-por-antiguedad",
      "clientes-con-mas-deuda",
      "cobros-por-mes",
      "envios-mensajero",
    ],
  ],
  [
    "Clientes",
    [
      "customers",
      "top-clientes",
      "clientes-nuevos-por-mes",
      "frecuencia-de-compra",
      "clientes-inactivos",
    ],
  ],
  [
    "Inventario",
    [
      "inventory-value",
      "kardex",
      "low-stock",
      "no-movement",
      "expiring",
      "abc",
      "purchases",
    ],
  ],
  [
    "Vendedoras",
    ["by-seller", "ranking-cajeras", "descuentos-cajera", "margen-por-cajera"],
  ],
  ["Margen y resultados", ["profit", "expenses", "income-statement", "formal"]],
];
// Lo que el servidor agrega después cae en su grupo por nombre.
const SERVER_GROUP: Record<string, string> = {
  Ventas: "Ventas",
  Dinero: "Caja y pagos",
  "Clientes y crédito": "Clientes",
  Inventario: "Inventario",
  Margen: "Margen y resultados",
};
export function groupReports(
  reports: { id: string; name: string; group?: string }[],
) {
  const out = new Map<string, { id: string; name: string }[]>(
    REPORT_GROUPS.map(([g]) => [g, []]),
  );
  for (const r of reports) {
    const fixed = REPORT_GROUPS.find(([, ids]) => ids.includes(r.id))?.[0];
    const group = fixed ?? SERVER_GROUP[r.group ?? ""] ?? "Ventas";
    out.get(group)!.push({ id: r.id, name: r.name });
  }
  return [...out].filter(([, list]) => list.length);
}
export function Reports() {
  const user = useStore((s) => s.user);
  // Los 40 reportes de la dueña (orden 18-oct) vienen del servidor, ya
  // filtrados por permiso (los de margen solo con profit:read).
  const extra = useQuery({
    queryKey: ["reportes-40"],
    queryFn: () =>
      api<{ name: string; title: string; group: string }[]>("/reportes"),
  });
  const allReports: string[][] = [
    ...reportList,
    ...(extra.data ?? []).map((r) => [r.name, r.title]),
  ];
  const serverGroup = new Map(
    (extra.data ?? []).map((r) => [r.name, r.group] as const),
  );
  const [openGroup, setOpenGroup] = useState<string | null>("Ventas");
  const [report, setReport] = useState("sales"),
    [from, setFrom] = useState(today().slice(0, 8) + "01"),
    [to, setTo] = useState(today()),
    // Los listados largos (ventas, kardex, devoluciones) llegan por páginas
    // con su total; Excel y PDF traen el período completo.
    [page, setPage] = useState(1);
  const inverted = !!from && !!to && from > to;
  const query = useQuery({
    queryKey: ["report", report, from, to, page],
    queryFn: () => api(`/reports/${report}?from=${from}&to=${to}&page=${page}`),
    // Rango invertido: se avisa aquí, sin pedirlo (no es falta de conexión).
    enabled: report !== "income-by-day" && report !== "formal" && !inverted,
  });
  const rows = query.data?.rows || [];
  const total: number = query.data?.total ?? rows.length;
  const limit: number = query.data?.limit ?? (rows.length || 1);
  const pages = Math.max(1, Math.ceil(total / limit));
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
        title="Reportes"
        caption="Transforma tus datos en decisiones para el próximo paso."
      />
      <div className="reports-layout lumina-reports">
        <aside className="panel report-menu" aria-label="Explorar reportes">
          {groupReports(
            allReports
              .filter(
                ([id]) =>
                  id !== "formal" ||
                  can(user?.permissions ?? [], "profit:read"),
              )
              .map(([id, name]) => ({ id, name, group: serverGroup.get(id) })),
          ).map(([group, list]) => {
            const open =
              openGroup === group || list.some((r) => r.id === report);
            return (
              <div key={group} className="report-group">
                <button
                  type="button"
                  className="report-group-title"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : group)}
                >
                  {group}
                  <span className="report-group-count">{list.length}</span>
                  <ChevronRight
                    size={14}
                    className={open ? "report-group-open" : ""}
                  />
                </button>
                {open &&
                  list.map(({ id, name }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setReport(id);
                        setOpenGroup(group);
                        setPage(1);
                      }}
                      className={report === id ? "active" : ""}
                      aria-current={report === id ? "page" : undefined}
                    >
                      <FileText size={17} />
                      {name}
                      <ChevronRight size={14} />
                    </button>
                  ))}
              </div>
            );
          })}
        </aside>
        {report === "formal" ? (
          <FormalReports />
        ) : report === "income-by-day" ? (
          <IncomeByDay />
        ) : (
          <section className="panel report-workspace">
            <div className="panel-heading report-workspace-heading">
              <div>
                <h2>{allReports.find((r) => r[0] === report)?.[1]}</h2>
                <p>Información registrada en tu tienda.</p>
              </div>
              <div className="table-actions report-export-actions">
                {["xlsx", "pdf"].map((format) => (
                  <Button
                    variant="secondary"
                    key={format}
                    onClick={() =>
                      download(
                        `/reports/${report}?from=${from}&to=${to}&format=${format}`,
                        `${report}.${format}`,
                      ).catch((error) =>
                        toast(
                          error.message !== DOWNLOAD_FAILED
                            ? error.message
                            : "No pudimos descargar el reporte. Revisa las fechas y tu conexión e inténtalo de nuevo.",
                          true,
                        ),
                      )
                    }
                  >
                    <Download size={16} />
                    {format === "xlsx" ? "Excel" : "PDF"}
                  </Button>
                ))}
              </div>
            </div>
            <div className="date-filters report-filters">
              <label className="field">
                <span>Desde</span>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    setPage(1);
                  }}
                  required
                />
              </label>
              <label className="field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => {
                    setTo(e.target.value);
                    setPage(1);
                  }}
                  required
                />
              </label>
              <Badge tone="violet">{total} registros</Badge>
            </div>
            {pages > 1 && (
              <div className="pagination">
                <span>
                  Mostrando {(page - 1) * limit + 1}–
                  {(page - 1) * limit + rows.length} de {total}. Excel (hasta
                  50,000 filas) y PDF (hasta 10,000) incluyen todo el período.
                </span>
                <Button
                  variant="ghost"
                  disabled={page === 1 || query.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Anteriores
                </Button>
                <Button
                  variant="ghost"
                  disabled={page >= pages || query.isFetching}
                  onClick={() => setPage(page + 1)}
                >
                  Siguientes
                </Button>
              </div>
            )}
            {inverted ? (
              <p className="form-error" role="alert">
                La fecha inicial es posterior a la final.
              </p>
            ) : (
              <QueryState query={query}>
                <DataTable
                  rows={rows}
                  columns={columns}
                  empty="No hay datos para este período"
                  emptyDescription="Prueba otras fechas o registra una venta para consultar este reporte."
                />
              </QueryState>
            )}
          </section>
        )}
      </div>
    </>
  );
}

export function Alerts({ go }: { go?: (page: string) => void }) {
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
                    {dateLabel(a.createdAt)} · {alertTypeLabel(a.type)}
                  </p>
                </div>
                <Badge tone={a.severity === "high" ? "danger" : "warning"}>
                  {a.severity === "high" ? "Prioritaria" : "Atención"}
                </Badge>
                <div className="table-actions">
                  {a.type === "sale_void_request" && go && (
                    <button
                      className="text-link"
                      onClick={() => go("void-requests")}
                    >
                      Revisar solicitud
                    </button>
                  )}
                  {a.type !== "sale_void_request" &&
                    a.status !== "seen" &&
                    a.status !== "resolved" && (
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
                  {a.type !== "sale_void_request" &&
                    a.status !== "resolved" && (
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

// B-01: con la bandera de caja ciega la API manda los importes en null.
const HIDDEN_AMOUNT = "—";
const saleMoney = (s: any, value: unknown) =>
  s.hiddenUntilClose ? HIDDEN_AMOUNT : formatMoney(value as any);

export function SalesHistory() {
  const user = useStore((s) => s.user)!;
  const [selected, setSelected] = useState<any>(null),
    [voiding, setVoiding] = useState<any>(null),
    [requestingVoid, setRequestingVoid] = useState<any>(null),
    [returning, setReturning] = useState<any>(null),
    [installment, setInstallment] = useState<any>(null),
    [rejecting, setRejecting] = useState<any>(null),
    [correctingTransfer, setCorrectingTransfer] = useState<any>(null),
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
            placeholder="Buscar número de venta"
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
              {
                label: "Venta n.º",
                render: (s) => <strong>{s.number}</strong>,
              },
              { label: "Cliente", render: (s) => s.customerName ?? "—" },
              { label: "Fecha", render: (s) => dateLabel(s.createdAt) },
              {
                label: "Estado",
                render: (s) => (
                  <>
                    <Badge tone={s.status === "voided" ? "danger" : "success"}>
                      {s.status === "voided" ? "Anulada" : "Completada"}
                    </Badge>
                    {s.voidRequest && (
                      <small>
                        {" "}
                        · Solicitud{" "}
                        {
                          (
                            {
                              pending: "pendiente",
                              approved: "aprobada",
                              rejected: "rechazada",
                              cancelled: "cancelada",
                            } as Record<string, string>
                          )[s.voidRequest.status]
                        }
                      </small>
                    )}
                  </>
                ),
              },
              { label: "Total", render: (s) => saleMoney(s, s.total) },
              {
                label: "Saldo pendiente",
                render: (s) => saleMoney(s, s.creditBalance ?? 0),
              },
              {
                label: "Pagos",
                render: (s) =>
                  s.hiddenUntilClose
                    ? "Se ve al cerrar tu caja"
                    : s.payments
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
                    {!can(user.permissions, "*") &&
                      s.sellerId === user.id &&
                      s.status === "completed" &&
                      s.voidRequest?.status !== "pending" && (
                        <button
                          className="text-link"
                          onClick={() =>
                            setRequestingVoid({
                              ...s,
                              operationId: crypto.randomUUID(),
                            })
                          }
                        >
                          Solicitar anulación
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
            {can(user.permissions, "*") && editableNow(selected) && (
              <SaleEditPanel
                key={"edit-" + selected.id}
                sale={selected}
                onSaved={(change) => {
                  setSelected({ ...selected, ...change });
                  void client.invalidateQueries({ queryKey: ["sales"] });
                  toast("Factura corregida.");
                }}
              />
            )}
            {can(user.permissions, "sale:manage") && (
              <div className="panel">
                <h3>Envío del mensajero</h3>
                <p>
                  Separado del total de la factura y de la caja.{" "}
                  {selected.courierPaidAt ? "Pagado." : "Pendiente de pago."}
                </p>
                {can(user.permissions, "*") &&
                editableNow(selected) &&
                !selected.courierPaidAt ? (
                  <CourierFeeEditor
                    key={selected.id}
                    saleId={selected.id}
                    initialFee={String(selected.courierFee ?? 0)}
                    initialName={selected.courierName}
                    onSaved={(fee, name) => {
                      setSelected({
                        ...selected,
                        courierFee: fee,
                        courierName: name,
                      });
                      void client.invalidateQueries({ queryKey: ["sales"] });
                    }}
                  />
                ) : (
                  <p>Envío: {formatMoney(Number(selected.courierFee ?? 0))}</p>
                )}
              </div>
            )}
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
                {
                  label: "Total",
                  render: (i) => saleMoney(selected, i.lineTotal),
                },
              ]}
            />
            <h3>Pagos registrados</h3>
            {selected.hiddenUntilClose && <p>Se ve al cerrar tu caja.</p>}
            {Number(selected.discountTotal) > 0 && (
              <p>
                Descuento: {saleMoney(selected, selected.discountTotal)} · Motivo:{" "}
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
                    · Recibido: {saleMoney(selected, p.tendered ?? p.amount)}{" "}
                    · Aplicado: {saleMoney(selected, p.amount)} · Cambio:{" "}
                    {saleMoney(selected, p.change ?? 0)}
                    <small>{p.reference || p.approvalCode}</small>
                  </span>
                  <ProofThumb paymentId={p.id} hasProof={p.hasProof} />
                  {p.method === "transfer" &&
                    ["pending_verification", "ok"].includes(p.status) &&
                    can(user.permissions, "*") && (
                      <button
                        className="text-link"
                        onClick={() => {
                          setSelected(null);
                          setCorrectingTransfer(p);
                        }}
                      >
                        Corregir banco y referencia
                      </button>
                    )}
                  {p.entryType === "installment" &&
                    can(user.permissions, "*") && (
                      <label className="text-link proof-upload">
                        {p.hasProof ? "Cambiar foto" : "Subir foto"}
                        <input
                          type="file"
                          className="sr-only"
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
                      (R9-dinero-3-ui). M-3: también la transferencia con la
                      que se pagó la venta; su importe pasa a cobrar. */}
                  {p.method === "transfer" &&
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
            <h3>Total {saleMoney(selected, selected.total)}</h3>
          </>
        )}
      </Modal>
      {voiding && (
        <ConfirmModal
          title={"Anular " + voiding.number}
          description="Solo un administrador puede hacerlo. La venta se conserva con el motivo y el usuario responsable, se revierte el inventario y deja de contar en ventas. No necesitas abrir caja, salvo en un caso: si la caja de esta venta ya cerró y la venta tuvo efectivo, el reembolso sale de tu propia caja, que debe estar abierta y con efectivo suficiente."
          confirmLabel="Sí, anular venta"
          onClose={() => setVoiding(null)}
          onConfirm={async (reason) => {
            await post("/sales/" + voiding.id + "/void", {
              reason,
            });
            await client.invalidateQueries();
            toast("Venta anulada.");
          }}
        />
      )}
      {requestingVoid && (
        <FormModal
          title={"Solicitar anulación · " + requestingVoid.number}
          fields={[
            {
              key: "reasonCode",
              label: "Tipo de motivo",
              type: "select",
              required: true,
              options: [
                { value: "customer_request", label: "Solicitud del cliente" },
                { value: "duplicate", label: "Venta duplicada" },
                { value: "payment_error", label: "Error de pago" },
                { value: "item_error", label: "Error de artículo" },
                { value: "other", label: "Otro" },
              ],
            },
            {
              key: "reason",
              label: "Explica el motivo",
              type: "textarea",
              required: true,
            },
          ]}
          onClose={() => setRequestingVoid(null)}
          onSubmit={(data) =>
            post("/sales/" + requestingVoid.id + "/void-requests", {
              operationId: requestingVoid.operationId,
              reasonCode: data.reasonCode,
              reason: data.reason,
            })
          }
        />
      )}
      {rejecting && (
        <ConfirmModal
          title={"Rechazar transferencia de " + formatMoney(rejecting.amount)}
          description={
            rejecting.entryType === "sale"
              ? "Úsalo cuando el dinero no llegó al banco. La mercancía ya se entregó: el importe pasa a cuenta por cobrar del cliente y deja de contar en la caja; cuando pague, registra un abono."
              : "Úsalo cuando el dinero no llegó al banco. El abono no descuenta la deuda ni entra a la caja; si el cliente vuelve a pagar, registra un abono nuevo."
          }
          onClose={() => setRejecting(null)}
          onConfirm={async (reason) => {
            await post("/payments/" + rejecting.id + "/reject", { reason });
            await client.invalidateQueries();
            toast("Transferencia rechazada.");
          }}
        />
      )}
      {correctingTransfer && (
        <FormModal
          title="Corregir referencia de transferencia"
          notice="La corrección queda en la bitácora. El importe y el estado del pago no cambian."
          fields={[
            { key: "bank", label: "Banco correcto", required: true },
            { key: "reference", label: "Referencia correcta", required: true },
            {
              key: "reason",
              label: "Motivo de la corrección",
              type: "textarea",
              required: true,
            },
          ]}
          initial={{
            bank: correctingTransfer.bank ?? "",
            reference: correctingTransfer.reference ?? "",
          }}
          onClose={() => setCorrectingTransfer(null)}
          onSubmit={async (data) => {
            await post(
              "/payments/" + correctingTransfer.id + "/correct-transfer",
              {
                bank: data.bank,
                reference: data.reference,
                reason: data.reason,
                expectedBank: correctingTransfer.bank ?? null,
                expectedReference: correctingTransfer.reference ?? null,
              },
            );
            await client.invalidateQueries();
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

// Avisos de facturas por Telegram: estado de la cola y prueba de conexión.
// El token y el chat sólo viven en las variables del servidor.
function TelegramNotices() {
  const user = useStore((s) => s.user)!;
  const admin = can(user.permissions, "*");
  const client = useQueryClient();
  const [sending, setSending] = useState(false);
  const status = useQuery({
    queryKey: ["notifications-status"],
    queryFn: () => api("/notifications/status"),
    enabled: admin,
    refetchInterval: 15000,
  });
  const data = status.data as
    | {
        enabled: boolean;
        pending: number;
        sent: number;
        failed: number;
        lastError: { message: string } | null;
      }
    | undefined;
  const test = async () => {
    setSending(true);
    try {
      const r = await post("/notifications/telegram/test", {});
      toast(r.message, !r.queued);
      await client.invalidateQueries({ queryKey: ["notifications-status"] });
    } catch (e: any) {
      toast(e.message, true);
    } finally {
      setSending(false);
    }
  };
  return (
    <section className="telegram-card" aria-labelledby="telegram-title">
      <div className="panel-heading">
        <h3 id="telegram-title">Avisos de facturas por Telegram</h3>
        {data && (
          <Badge tone={data.enabled ? "success" : "neutral"}>
            {data.enabled ? "Activados" : "Desactivados"}
          </Badge>
        )}
      </div>
      <p>
        Cada factura, anulación, devolución, cobro y cierre de caja llega al
        grupo de Telegram de la administración. Sin cédula, teléfono, correo ni
        dirección del cliente.
      </p>
      {data?.enabled ? (
        <p>
          Enviados: <strong>{data.sent}</strong> · Pendientes:{" "}
          <strong>{data.pending}</strong> · Fallidos:{" "}
          <strong>{data.failed}</strong>
          {data.lastError && (
            <>
              <br />
              <small>Último error: {data.lastError.message}</small>
            </>
          )}
        </p>
      ) : (
        <ol>
          <li>En Telegram, crea el bot con @BotFather (/newbot).</li>
          <li>Agrega el bot al grupo privado de la administración.</li>
          <li>
            {productTenancyRequired(import.meta.env.VITE_PRODUCT_TENANCY)
              ? "Pide a soporte de Nexora que active los avisos por Telegram para tu empresa."
              : "En Render (API), pon TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID y vuelve a desplegar."}
          </li>
        </ol>
      )}
      {admin && (
        <Button variant="secondary" onClick={test} disabled={sending}>
          {sending ? "Enviando…" : "Enviar mensaje de prueba"}
        </Button>
      )}
    </section>
  );
}

// «Restablecer contraseña» de otra persona (sólo administración). La temporal
// generada se muestra una sola vez; nunca se guarda en el equipo.
function ResetPassword({
  target,
  onClose,
}: {
  target: any;
  onClose: () => void;
}) {
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState<{ temporaryPassword?: string } | null>(null);
  const policy = passwordPolicyForRole(target.role?.name);
  const cashier = policy === "cashier-six-digits";
  const client = useQueryClient();
  const result = useRef<HTMLDivElement>(null);
  // El foco va al resultado (la temporal y lo que ocurrió) para que se lea
  // en voz alta y no quede en un botón que ya no existe.
  useEffect(() => {
    if (done) result.current?.focus();
  }, [done]);
  return (
    <Modal
      open
      onClose={onClose}
      title={"Restablecer contraseña · " + target.name}
    >
      {done ? (
        <div className="reset-password-result">
          <div
            ref={result}
            tabIndex={-1}
            role="status"
            className="reset-password-summary"
            data-testid="reset-password-summary"
          >
            {done.temporaryPassword && (
              <>
                <p>
                  Contraseña temporal de {target.name}. Dásela en persona; no se
                  volverá a mostrar.
                </p>
                <code
                  className="temporary-password"
                  data-testid="temporary-password"
                >
                  {done.temporaryPassword}
                </code>
              </>
            )}
            <p>
              {target.name} deberá crear su propia contraseña la próxima vez que
              entre. Sus sesiones abiertas se cerraron y ya no está bloqueada
              por intentos fallidos.
            </p>
          </div>
          <div className="modal-footer">
            <Button onClick={onClose}>Listo</Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              password &&
              passwordChangeError(password, password, "", "required", policy)
            ) {
              setError(
                cashier
                  ? passwordChangeError(
                      password,
                      password,
                      "",
                      "required",
                      policy,
                    )
                  : "La contraseña temporal debe cumplir las cinco reglas, o deja el campo vacío para que el sistema genere una.",
              );
              return;
            }
            setBusy(true);
            setError("");
            try {
              const result = await post(
                `/users/${target.id}/reset-password`,
                password ? { password } : {},
              );
              setPassword("");
              setDone({ temporaryPassword: result.temporaryPassword });
              await client.invalidateQueries();
            } catch (e) {
              setError(businessErrorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          <p>
            Úsalo si {target.name} olvidó su contraseña o quedó bloqueada. Esto
            cierra sus sesiones abiertas, quita el bloqueo por intentos fallidos
            y le pide crear su propia contraseña al entrar.
          </p>
          <label className="field">
            <span>
              {cashier
                ? "Contraseña temporal de 6 números (opcional)"
                : "Contraseña temporal (opcional)"}
            </span>
            {/* Es de un solo uso y de otra persona: el navegador no debe
                ofrecer guardarla como la contraseña de la administradora. */}
            <input
              type="password"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              inputMode={cashier ? "numeric" : "text"}
              minLength={cashier ? 6 : undefined}
              maxLength={cashier ? 6 : 128}
              pattern={cashier ? "[0-9]{6}" : undefined}
              title={cashier ? "Escribe exactamente 6 números." : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <small>
              {cashier
                ? "Déjala vacía para que el sistema genere una temporal. Si la escribes, usa exactamente 6 números; no uses secuencias ni números repetidos."
                : "Déjala vacía y el sistema genera una segura. Si la escribes: 12 o más caracteres con mayúscula, minúscula, número y símbolo."}
            </small>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button variant="danger" disabled={busy}>
              {busy ? "Procesando…" : "Restablecer contraseña"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
const CONFIG_MODE_KEY = "nexora-config-mode";
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
    [passwordReset, setPasswordReset] = useState<any>(null),
    [roleEdit, setRoleEdit] = useState<any>(null),
    // El aviso de cupo de equipos abre directo la pestaña «Equipos».
    [tab, setTab] = useState(() => {
      try {
        const wanted = sessionStorage.getItem("nexora-config-tab");
        sessionStorage.removeItem("nexora-config-tab");
        return wanted || "business";
      } catch {
        return "business";
      }
    }),
    // Producto: «Básico» por defecto (empresa nueva); la tienda no cambia.
    [mode, setMode] = useState(() => {
      try {
        return localStorage.getItem(CONFIG_MODE_KEY) ?? "basic";
      } catch {
        return "basic";
      }
    });
  const client = useQueryClient();
  const product = productTenancyRequired(import.meta.env.VITE_PRODUCT_TENANCY);
  const basic = product && mode === "basic";
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
    { key: "receiptFooter", label: "Mensaje al pie del ticket (opcional)" },
    { key: "phone2", label: "Teléfono 2 / WhatsApp" },
    {
      key: "autoPrintReceipt",
      label: "Imprimir el recibo automáticamente al cobrar",
      type: "checkbox",
    },
    ...(product
      ? [
          {
            key: "dailySummaryEnabled",
            label: "Recibir por correo el resumen diario con IA",
            type: "checkbox" as const,
            help: "Apagado por defecto. Se envía después de las 8:00 p. m. al primer administrador verificado de esta sucursal.",
          },
        ]
      : []),
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
    {
      key: "transferAccounts",
      label: "Cuentas de banco para transferencias (una por línea)",
      type: "textarea",
      help: "Ej.: Banco Principal ···3620. La caja elige de esta lista.",
    },
    {
      key: "cardTerminals",
      label: "Terminales de tarjeta (uno por línea)",
      type: "textarea",
      help: "Ej.: Verifone mostrador. Vacío: la caja no pregunta.",
    },
    requiredNumber("sellerDiscountLimit", "Descuento máximo del vendedor (%)"),
    requiredNumber("cardFeePercent", "Comisión bancaria (%)"),
    requiredNumber("returnDays", "Plazo de devolución (días)"),
    requiredNumber("idleDays", "Días sin rotación", 60),
    requiredNumber("expiryDays", "Alerta de vencimiento (días)", 60),
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
    requiredNumber("sessionTimeoutMinutes", "Inactividad (minutos)", 30),
    {
      ...requiredNumber(
        "creditApprovalThreshold",
        "Crédito por venta que requiere gerente (RD$)",
        1000,
      ),
      help: "0 = siempre pedir PIN de gerente. Pon un monto alto (ej. 1000000) para no pedir PIN por monto.",
    },
    {
      ...requiredNumber(
        "receivableShiftLimit",
        "Crédito y contraentrega por turno sin PIN de gerente (RD$)",
        3000,
      ),
      help: "Suma de todos los clientes del turno. 0 = siempre pedir PIN de gerente. Pon un monto alto (ej. 1000000) para no pedir PIN por monto.",
    },
    {
      ...requiredNumber(
        "cashMovementApprovalLimit",
        "Salidas de efectivo por turno sin PIN de gerente (RD$)",
        1000,
      ),
      help: "Retiros y vales de la cajera. Por encima, se pide el PIN de un gerente.",
    },
    {
      key: "allowNegativeStock",
      label:
        "Permitir stock negativo en productos sin lote obligatorio (con advertencia)",
      type: "checkbox",
    },
    {
      key: "allowOfflineSales",
      label: "Permitir ventas sin conexión (riesgo entre varias cajas)",
      help: "Desactivado evita vender la misma última unidad desde dos equipos sin conexión: dos laptops offline no pueden reservarla entre sí. Actívalo sólo si aceptas revisar conflictos al reconectar.",
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
      help: "Con esto apagado, todo crédito de un cajero pide PIN, sin importar el monto.",
    },
    {
      key: "ncfMode",
      label: "Preparación de NCF",
      type: "select",
      initial: "disabled",
      options: [
        { label: "Desactivada", value: "disabled" },
        { label: "Preparar solicitud (sin emisión fiscal)", value: "prepared" },
        {
          label: "NCF por venta desde las secuencias declaradas (B01/B02)",
          value: "sequences",
        },
      ],
    },
    {
      key: "taxIncluded",
      label: "Precios con ITBIS incluido",
      type: "checkbox",
    },
  ];
  const ncfOn = (v: Record<string, any>) => v.ncfOn === true;
  const basicFields = (values: Record<string, any>): Field[] => [
    { key: "name", label: "Nombre del negocio", required: true },
    { key: "phone", label: "Teléfono" },
    { key: "address", label: "Dirección" },
    { key: "taxIncluded", label: "Precios con ITBIS incluido", type: "checkbox" },
    {
      key: "requireCustomer",
      label: "Pedir cliente en cada venta",
      type: "checkbox",
      help: "Apagado: la venta queda a nombre de «Consumidor final».",
    },
    fields.find((f) => f.key === "receiptWidth")!,
    ...(product
      ? [fields.find((f) => f.key === "dailySummaryEnabled")!]
      : []),
    fields.find((f) => f.key === "usdRate")!,
    {
      key: "ncfOn",
      // INI-02: «prepared» no asigna NCF; solo «sequences» emite.
      label:
        query.data?.ncfMode === "sequences"
          ? "Emito comprobante fiscal (NCF) con RNC"
          : "Preparar solicitudes de NCF con RNC",
      type: "checkbox",
      help:
        query.data?.ncfMode === "sequences"
          ? "El NCF se asigna al cobrar con tus secuencias."
          : "No emite NCF: el ticket sigue siendo interno hasta configurar las secuencias de NCF en Avanzado.",
    },
    ...(ncfOn(values) ? [{ key: "legalId", label: "RNC" }] : []),
  ];
  const initial = {
    ...DEFAULT_SETTINGS,
    ...query.data,
    logo: undefined,
    branchName: query.data?.branchName ?? "",
    phone2: query.data?.phone2 ?? "",
    autoPrintReceipt: !!query.data?.autoPrintReceipt,
    dailySummaryEnabled: query.data?.dailySummaryEnabled === true,
    requireCustomer: query.data?.requireCustomer === true,
    allowOfflineSales: query.data?.allowOfflineSales === true,
    usdRate: query.data?.usdRate ?? "",
    eurRate: query.data?.eurRate ?? "",
    transferAccounts: (query.data?.transferAccounts ?? []).join("\n"),
    cardTerminals: (query.data?.cardTerminals ?? []).join("\n"),
    ncfOn: (query.data?.ncfMode ?? "disabled") !== "disabled",
  };
  return (
    <>
      <div className={`lumina-settings lumina-settings-${tab}`}>
        <Heading
          title="Configuración"
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
      {product && tab === "business" && (
        <div className="config-mode" role="group" aria-label="Vista de la configuración">
          {[
            ["basic", "Básico"],
            ["advanced", "Avanzado"],
          ].map(([id, label]) => (
            <Button
              key={id}
              variant="secondary"
              className={mode === id ? "active" : ""}
              aria-pressed={mode === id}
              onClick={() => {
                setMode(id);
                try {
                  localStorage.setItem(CONFIG_MODE_KEY, id);
                } catch {
                  // Sin almacenamiento: vale para esta visita.
                }
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      )}
        <div className="panel lumina-settings-content">
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
                  {query.data?.ncfMode === "sequences"
                    ? "NCF por venta activo: cada venta emite su NCF (B01/B02). e-CF en pausa."
                    : "Sin NCF por venta: los recibos son internos. e-CF en pausa."}
                </p>
              </div>
              <Button
                className="lumina-primary-action"
                onClick={() => setEditing(true)}
              >
                <Pencil size={16} />
                Editar configuración
              </Button>
            </div>
            {!basic && (
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
            )}
            {!basic && (Number(query.data?.creditApprovalThreshold) === 0 ||
              Number(query.data?.receivableShiftLimit) === 0) && (
              <p className="cod-hint" role="note">
                Algún tope de crédito está en 0: esto significa pedir siempre el
                PIN de gerente para ese control. Si no buscas ese resultado,
                escribe un monto alto, por ejemplo RD$ 1,000,000.
              </p>
            )}
            {!basic && query.data?.allowCreditSales !== true && (
              <p className="cod-hint" role="note">
                Las ventas a crédito están deshabilitadas: todo crédito de un
                cajero pide PIN de gerente.
              </p>
            )}
            {query.data?.usdRateHeld?.rate && (
              <div className="cod-hint" role="alert">
                <p>
                  La tasa automática del dólar saltó{" "}
                  {query.data.usdRateHeld.percent} %: de RD${" "}
                  {query.data.usdRateHeld.before} a RD${" "}
                  {query.data.usdRateHeld.rate}. No se aplicó; los precios en
                  dólares siguen con la tasa anterior. Revisa la fuente (
                  {query.data.usdRateHeld.source}) antes de confirmarla.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    try {
                      await mutate("/settings/usd-rate/confirm", {
                        rate: Number(query.data.usdRateHeld.rate),
                      });
                      toast("Tasa del dólar aplicada.");
                      await client.invalidateQueries();
                    } catch (e: any) {
                      toast(e.message, true);
                    }
                  }}
                >
                  Confirmar y aplicar RD$ {query.data.usdRateHeld.rate}
                </Button>
              </div>
            )}
            {Number(query.data?.usdRateLowMargin?.count) > 0 && (
              <p className="cod-hint" role="alert">
                Atención: {query.data.usdRateLowMargin.count} precio
                {Number(query.data.usdRateLowMargin.count) === 1
                  ? " queda"
                  : "s quedan"}{" "}
                con margen menor de 15 % después de aplicar la tasa del dólar.
                Revisa sus costos y precios.
              </p>
            )}
            {basic ? (
              <>
                <StoreSettings logoOnly />
                {query.data?.ncfMode && query.data.ncfMode !== "disabled" && (
                  <NcfSequenceSettings />
                )}
              </>
            ) : (
              <>
                <StoreSettings />
                {product && <SupportAccessCard />}
                <NcfSequenceSettings />
                <TelegramNotices />
                {/* El producto no tiene respaldo a Drive por empresa (sin /backups). */}
                {!product && <DriveBackupCard />}
                <IncentiveRates />
                <CashierSurveySummary />
              </>
            )}
          </QueryState>
        ) : tab === "users" ? (
          <>
            <div className="panel-heading">
              <h2>Equipo de tu tienda</h2>
              <Button
                className="lumina-primary-action"
                onClick={() => setNewUser(true)}
              >
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
                            onClick={() => setPasswordReset(u)}
                          >
                            Restablecer contraseña
                          </button>
                        )}
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
                {
                  label: "Acción",
                  render: (l) => (
                    <Badge>
                      {l.action === "support.read"
                        ? `Soporte de Nexora consultó ${String(l.after?.ruta ?? "").includes("reports") ? "un reporte" : String(l.after?.ruta ?? "").includes("dashboard") ? "el resumen" : "una pantalla"}`
                        : l.action === "support.enable"
                          ? "Permitió soporte de Nexora"
                          : l.action === "support.disable"
                            ? "Quitó acceso de soporte"
                            : l.action === "support.expired"
                              ? "Venció el acceso de soporte"
                              : l.action}
                    </Badge>
                  ),
                },
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
      </div>
      {editing && (
        <FormModal
          title="Configuración del negocio"
          fields={basic ? basicFields : fields}
          initial={initial}
          onClose={() => setEditing(false)}
          onSubmit={(values) => {
            // Básico solo edita unos campos: el resto viaja tal como está.
            const { ncfOn: _ncfOn, ...data } = basic
              ? {
                  ...initial,
                  ...values,
                  ncfMode: values.ncfOn
                    ? initial.ncfOn
                      ? initial.ncfMode
                      : "prepared"
                    : "disabled",
                }
              : values;
            // Tasa vacía = sin divisa.
            const rate = (v: unknown) =>
              v === "" || v === null || v === undefined ? null : Number(v);
            const lines = (v: unknown) =>
              String(v ?? "")
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean);
            return mutate(
              "/settings",
              {
                ...data,
                usdRate: rate(data.usdRate),
                eurRate: rate(data.eurRate),
                transferAccounts: lines(data.transferAccounts),
                cardTerminals: lines(data.cardTerminals),
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
          fields={(values) => {
            const cashier =
              roles.data?.find((role: any) => role.id === values.roleId)
                ?.name === "seller";
            return [
              {
                key: "roleId",
                label: "Rol",
                type: "select",
                required: true,
                resetFieldsOnChange: ["password"],
                options: roles.data?.map((r: any) => ({
                  label: r.name,
                  value: r.id,
                })),
              },
              { key: "name", label: "Nombre", required: true },
              {
                key: "username",
                label: "Usuario para entrar",
                required: true,
              },
              {
                key: "password",
                label: cashier
                  ? "Contraseña temporal (6 números)"
                  : "Contraseña temporal (12+; mayúscula, minúscula, número y símbolo)",
                type: "password",
                required: true,
                inputMode: cashier ? "numeric" : "text",
                minLength: cashier ? 6 : 12,
                maxLength: cashier ? 6 : 128,
                pattern: cashier ? "[0-9]{6}" : undefined,
                title: cashier ? "Escribe exactamente 6 números." : undefined,
                help: cashier
                  ? "Usa 6 números no triviales; la cajera deberá cambiarla al entrar."
                  : "La persona deberá cambiarla al entrar.",
              },
              {
                key: "pin",
                label: "PIN de 6 dígitos",
                type: "password",
                required: true,
              },
            ];
          }}
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
            {
              key: "pin",
              label: "PIN de caja nuevo, 6 dígitos (opcional)",
              type: "password",
              help: "El PIN autoriza en caja y cambia de usuario; no es la contraseña para entrar (esa se cambia con «Restablecer contraseña»). Déjalo vacío para conservar el PIN actual. Los PIN antiguos de 4 o 5 dígitos siguen sirviendo, pero conviene cambiarlos.",
            },
          ]}
          initial={{ name: userEdit.name, username: userEdit.username || "" }}
          onClose={() => setUserEdit(null)}
          onSubmit={({ pin, ...data }) =>
            mutate(
              "/users/" + userEdit.id,
              pin ? { ...data, pin } : data,
              "PATCH",
            )
          }
        />
      )}
      {passwordReset && (
        <ResetPassword
          target={passwordReset}
          onClose={() => setPasswordReset(null)}
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
            ["Obsidiana (fondo oscuro)", "#05050A"],
            ["Superficie zafiro", "#0D0F18"],
            ["Acción (violeta)", "#7C3AED"],
            ["Lugar actual (violeta)", "#8B5CF6"],
            ["Estado y foco (esmeralda)", "#43E3B1"],
            ["Aviso", "#FBBF24"],
            ["Peligro", "#FF8FA3"],
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
        <h2>Avisos</h2>
        <div className="style-stack">
          <p className="notice success" role="status">
            <strong>Guardado.</strong> Los cambios ya están en el sistema.
          </p>
          <p className="notice warning" role="status">
            <strong>Revisa el conteo.</strong> Hay 3 productos sin contar hoy.
          </p>
          <p className="notice danger" role="alert">
            <strong>No se guardó.</strong> Revisa tu internet e inténtalo otra vez.
          </p>
          <p className="notice info">
            <strong>Dato.</strong> El margen se calcula sobre el precio.
          </p>
        </div>
        <h2>Cargando</h2>
        <div className="style-stack" aria-hidden="true">
          <span className="skeleton" style={{ width: "60%" }} />
          <span className="skeleton" style={{ width: "40%" }} />
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
