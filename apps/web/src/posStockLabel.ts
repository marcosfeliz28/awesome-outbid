import type { Language } from "./inicioLanguage";

export function posStockLabel(
  stock: number,
  service: boolean,
  language: Language,
) {
  if (service) return language === "en" ? "Service" : "Servicio";
  return language === "en" ? `${stock} in stock` : `${stock} en stock`;
}
