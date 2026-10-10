// Textos del PDF del recibo (GET /sales/:id/receipt.pdf). Aparte de sales.ts
// para poder probarlos sin base de datos y para que ese archivo cambie lo
// mínimo. Mismas reglas que el ticket térmico (apps/web/src/Prints.tsx):
// V2-02, auditoría 03 v2.
import { privacyNoticeText, returnPolicyText } from "@fitstore/shared";

/**
 * Línea «Vendido a». El PDF sale por WhatsApp o correo, a un tercero, y el
 * número puede ser equivocado o reenviado: nunca lleva el teléfono, y la
 * cédula/RNC sólo cuando se pidió un comprobante con NCF y aun así enmascarada
 * (últimos 4 dígitos). Quien necesita el documento fiscal lo tiene en caja.
 */
export function receiptCustomerLine(
  customer: { name?: string | null; legalId?: string | null } | null,
  sale: { ncfType?: string | null },
) {
  const id = String(customer?.legalId ?? "").replace(/[^0-9A-Za-z]/g, "");
  return (
    "Vendido a: " +
    (customer?.name || "Consumidor final") +
    (id && sale.ncfType ? " · RNC/Cédula ***" + id.slice(-4) : "")
  );
}

/** Pie del PDF: política de devolución y aviso de privacidad. */
export const receiptFooterLines = (business: any) => [
  returnPolicyText(business),
  privacyNoticeText(business),
];
