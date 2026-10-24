// Datos de la factura del proveedor. La lectura por IA sólo prellena estos
// campos: la persona los revisa antes de registrar la recepción.
export type SupplierDocument = {
  supplierInvoice?: string;
  supplierNcf?: string;
  invoiceDate?: string;
  paymentType?: "" | "cash" | "credit";
  creditDays?: number | "";
  itbis?: number | "";
};

/** En un alta se omite lo vacío; al completar después se manda null. */
export function documentPayload(doc: SupplierDocument, clear = false) {
  const out: Record<string, unknown> = {};
  const put = (key: string, value: unknown) => {
    if (value === "" || value === undefined) {
      if (clear) out[key] = null;
    } else out[key] = value;
  };
  put("supplierInvoice", doc.supplierInvoice?.trim());
  put("supplierNcf", doc.supplierNcf?.trim());
  put("invoiceDate", doc.invoiceDate);
  put("paymentType", doc.paymentType);
  put(
    "creditDays",
    doc.paymentType === "credit" && Number(doc.creditDays) > 0
      ? Number(doc.creditDays)
      : undefined,
  );
  // Cero leído y confirmado es distinto de un impuesto no indicado.
  put(
    "itbis",
    doc.itbis === "" || doc.itbis == null ? undefined : Number(doc.itbis),
  );
  return out;
}
