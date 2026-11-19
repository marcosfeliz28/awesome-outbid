// Textos en español de los códigos internos que salen en reportes (métodos de
// pago, tipos de kardex y eventos de bitácora). Un código nuevo sin etiqueta
// sale tal cual, para no esconder datos.

import { methodName } from "@fitstore/shared";
export { auditActionName, kardexTypeName, methodName } from "@fitstore/shared";

const INCOME_KIND: Record<string, string> = {
  sale_cash: "Venta en efectivo",
  sale_card: "Venta con tarjeta",
  sale_transfer: "Venta por transferencia",
  credit_generated: "Crédito generado",
  collection_cash: "Cobro de crédito en efectivo",
  collection_card: "Cobro de crédito con tarjeta",
  collection_transfer: "Cobro de crédito por transferencia",
  return_cash: "Devolución en efectivo",
  return_card: "Devolución a tarjeta",
  return_transfer: "Devolución por transferencia",
};
export const incomeKindName = (kind: string) => INCOME_KIND[kind] ?? kind;

const rd = (value: unknown) =>
  "RD$ " +
  Number(value ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// «Detalle» de Devoluciones y descuentos: frase legible en vez del JSON de la
// bitácora. Nunca incluye costos (el reporte lo ve quien no tiene profit:read).
export function auditDetail(action: string, after: any): string {
  const a = after && typeof after === "object" ? after : {};
  const parts: string[] = [];
  if (action === "void") {
    if (a.reason) parts.push("Motivo: " + a.reason);
    if (a.afterCashClose) parts.push("después del cierre de caja");
  } else if (action === "return") {
    if (a.number) parts.push("Devolución " + a.number);
    if (a.total != null) parts.push("Devuelto " + rd(a.total));
    if (Number(a.refundAmount) > 0)
      parts.push(
        "Reembolso " + rd(a.refundAmount) + " en " + methodName(a.refundMethod),
      );
    else if (a.refundMethod === "credit_note")
      parts.push("Queda como nota de crédito");
    if (a.reason) parts.push("Motivo: " + a.reason);
    if (a.refundApprovedBy?.name)
      parts.push("Aprobó: " + a.refundApprovedBy.name);
  } else if (action === "discount_approved") {
    if (a.discount != null) parts.push("Descuento " + rd(a.discount));
    if (a.reason) parts.push("Motivo: " + a.reason);
    const by = a.authorizer?.name;
    if (by)
      parts.push(
        "Autorizó: " +
          by +
          (a.authorizer?.id && a.authorizer.id === a.actor?.id
            ? " (la misma persona que vendió)"
            : ""),
      );
  }
  return parts.join(" · ");
}
