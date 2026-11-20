import type { Language } from "./inicioLanguage";

export function posStockLabel(
  stock: number,
  service: boolean,
  language: Language,
) {
  if (service) return language === "en" ? "Service" : "Servicio";
  return stock + (language === "en" ? " in stock" : " en stock");
}
