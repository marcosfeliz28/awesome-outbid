/** Reparte centavos enteros de la deuda más antigua a la más reciente. */
export function allocateCredit(
  sales: { id: string; createdAt: Date; availableCents: number }[],
  amountCents: number,
) {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0)
    throw new Error("El monto debe ser positivo y expresado en centavos.");
  const ordered = [...sales].sort(
    (a, b) =>
      a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  if (
    ordered.some(
      (sale) =>
        !Number.isSafeInteger(sale.availableCents) || sale.availableCents < 0,
    )
  )
    throw new Error("Saldo de crédito inválido.");
  if (ordered.reduce((sum, sale) => sum + sale.availableCents, 0) < amountCents)
    throw new Error("El cobro supera el saldo pendiente.");
  let left = amountCents;
  const allocations: { saleId: string; amountCents: number }[] = [];
  for (const sale of ordered) {
    const taken = Math.min(left, sale.availableCents);
    if (taken > 0) allocations.push({ saleId: sale.id, amountCents: taken });
    left -= taken;
    if (left === 0) break;
  }
  return allocations;
}

// D5 (auditoría 19-nov): es cuenta por cobrar la venta a crédito o
// contraentrega y también la pagada con una transferencia que se rechazó
// (M-3: ese monto pasa a deuda del cliente). Filtro de Prisma para
// `payments: { some: ... }` y su versión para filas ya leídas.
export const RECEIVABLE_SALE_PAYMENT = {
  entryType: "sale" as const,
  OR: [
    { method: { in: ["credit" as const, "cod" as const] } },
    { method: "transfer" as const, status: "rejected" as const },
  ],
};
export function isReceivableSalePayment(p: {
  entryType: string;
  method: string;
  status?: string | null;
}) {
  return (
    p.entryType === "sale" &&
    (p.method === "credit" ||
      p.method === "cod" ||
      (p.method === "transfer" && p.status === "rejected"))
  );
}
