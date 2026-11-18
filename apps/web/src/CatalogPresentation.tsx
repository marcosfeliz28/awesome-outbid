import { Children, useState, type ReactNode } from "react";
import { Boxes, Layers, ScanSearch, FileText } from "lucide-react";
import { formatMoney } from "@fitstore/shared";
import { type Product } from "./api";
import { useLanguage } from "./inicioLanguage";
import "./catalogPresentation.css";

/** Presentation only: the existing catalog owns filters, permissions and mutations. */
export function CatalogPresentation({
  products,
  loading,
  failed,
  onDetail,
  children,
}: {
  products: Product[];
  loading: boolean;
  failed: boolean;
  onDetail: (product: Product) => void;
  children: ReactNode;
}) {
  const en = useLanguage() === "en";
  const [heading, ...content] = Children.toArray(children);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(() => new Set());
  const selected = products.find((p) => p.id === selectedId) ?? products[0];
  const available = !loading && !failed;
  const categories = new Set(products.map((p) => p.categoryId)).size;
  const missingImages = products.filter(
    (p) => !p.imageUrl || p.imageUrl.endsWith(".svg") || failedImages.has(p.imageUrl),
  ).length;
  return (
    <section
      className="catalog-fusion"
      aria-label={en ? "Product catalog" : "Catálogo de productos"}
    >
      <div className="catalog-fusion-layout">
        <div className="catalog-fusion-main">
          {heading}
      <div
        className="catalog-fusion-metrics"
        aria-label={
          en ? "Filtered catalog summary" : "Resumen del catálogo filtrado"
        }
      >
        {[
          {
            name: en ? "Products shown" : "Productos visibles",
            value: products.length,
            Icon: Boxes,
          },
          {
            name: en ? "Visible categories" : "Categorías visibles",
            value: categories,
            Icon: Layers,
          },
          {
            name: en ? "Without a photograph" : "Sin fotografía",
            value: missingImages,
            Icon: ScanSearch,
          },
        ].map(({ name, value, Icon }) => (
          <div className="catalog-fusion-metric" key={name}>
            <Icon aria-hidden="true" />
            <div>
              <span>{name}</span>
              <strong>{available ? value : "—"}</strong>
            </div>
          </div>
        ))}
      </div>
          {content}
        </div>
        <aside
          className="catalog-fusion-preview"
          aria-label={en ? "Product preview" : "Vista previa del producto"}
        >
          <h2>{en ? "Product overview" : "Ficha del producto"}</h2>
          {available && selected ? (
            <>
              <label className="catalog-fusion-picker">
                {en ? "Preview product" : "Producto a visualizar"}
                <select
                  value={selected.id}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </option>
                  ))}
                </select>
              </label>
              <div className="catalog-fusion-image">
                <img
                  key={selected.id + selected.imageUrl}
                  src={failedImages.has(selected.imageUrl) ? "/products/accessories.svg" : selected.imageUrl || "/products/accessories.svg"}
                  onError={() => { if (selected.imageUrl && !failedImages.has(selected.imageUrl)) setFailedImages((current) => new Set([...current, selected.imageUrl])); }}
                  alt={selected.name}
                />
              </div>
              {failedImages.has(selected.imageUrl) && <p role="status">{en ? "Photo unavailable" : "Foto no disponible"}</p>}
              <h3>{selected.name}</h3>
              <dl>
                <div>
                  <dt>SKU</dt>
                  <dd>{selected.sku}</dd>
                </div>
                <div>
                  <dt>{en ? "Category" : "Categoría"}</dt>
                  <dd>{selected.category.name}</dd>
                </div>
                <div>
                  <dt>
                    {en ? "First variant price" : "Precio de primera variante"}
                  </dt>
                  <dd className="catalog-fusion-price">
                    {selected.variants.length
                      ? formatMoney(selected.variants[0].price)
                      : "—"}
                  </dd>
                </div>
              </dl>
              <button
                type="button"
                className="button catalog-fusion-open"
                onClick={() => onDetail(selected)}
              >
                <FileText aria-hidden="true" size={20} />
                {en ? "View details" : "Ver ficha"}
              </button>
            </>
          ) : (
            <p>
              {loading
                ? en
                  ? "Loading catalog…"
                  : "Cargando catálogo…"
                : failed
                  ? en
                    ? "Catalog unavailable. Retry in the list."
                    : "Catálogo no disponible. Reintenta en el listado."
                  : en
                    ? "No products match these filters."
                    : "No hay productos con estos filtros."}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
