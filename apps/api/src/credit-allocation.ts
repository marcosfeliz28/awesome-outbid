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
