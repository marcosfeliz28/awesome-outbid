import type { Language } from "./inicioLanguage";

const EN = {
  Cuadre: "Reconciliation",
  "Venta diaria": "Daily sales",
  "Por forma de pago": "By payment method",
  "Venta diaria del día": "Daily sales report",
  "Por forma de pago del día": "Daily payment-method report",
} as const;

export function cashPrintLabel(label: keyof typeof EN, language: Language) {
  return language === "en" ? EN[label] : label;
}
