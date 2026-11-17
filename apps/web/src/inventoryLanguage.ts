import type { Language } from "./inicioLanguage";

export const inventoryEnglish: Record<string, string> = {
  "Cada unidad, bajo control": "Every unit, under control",
  "El inventario correcto hace espacio para mejores decisiones.":
    "Accurate inventory makes room for better decisions.",
  Almacén: "Warehouse",
  Todos: "All",
  "Stock actual": "Current stock",
  "Conteos físicos": "Physical counts",
  "Buscar producto o código": "Search product or code",
  "No encontramos artículos en el inventario": "No inventory items found",
  "Revisa la búsqueda o registra una entrada de mercancía.":
    "Check the search or record incoming goods.",
  "Producto / Variante": "Product / Variant",
  Precio: "Price",
  Costo: "Cost",
  "En Tienda": "In store",
  Total: "Total",
  "Lote en Tienda": "In-store batch",
  "Sin lote": "No batch",
  Vencimiento: "Expiry",
  "No aplica": "Not applicable",
  Acciones: "Actions",
  Ajustar: "Adjust",
  Contar: "Count",
  "Todavía no hay conteos físicos": "No physical counts yet",
  "Pulsa Contar junto a un artículo para registrar su existencia real.":
    "Select Count next to an item to record its actual quantity.",
  Fecha: "Date",
  Artículos: "Items",
  Estado: "Status",
  Aplicado: "Applied",
  Pendiente: "Pending",
  Acción: "Action",
  "Aprobar ajuste": "Approve adjustment",
  "Cantidad contada": "Counted quantity",
};

/** UI labels only: never translate product names, API codes or persisted values. */
export function inventoryText(text: string, language: Language): string {
  return language === "en" ? (inventoryEnglish[text] ?? text) : text;
}
