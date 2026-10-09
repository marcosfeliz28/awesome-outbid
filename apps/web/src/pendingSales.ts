import {
  d,
  lineTotals,
  money,
  paymentTotals,
  type SaleInput,
} from "@fitstore/shared";
import type { PendingSale, Product } from "./api";

export const isPendingPriceConflict = (message?: string) =>
  /precios o promociones cambiaron/i.test(message ?? "");

function promotionDiscount(
  promo: any,
  variant: any,
  product: Product,
  qty: number,
) {
  const scope = promo.scope ?? {};
  // La API sólo puede aplicar una promoción de lote después de asignar FEFO;
  // la cola todavía no conoce ese lote. No anticiparla evita un total distinto.
  if (scope.lotId) return 0;
  if (
    (scope.variantId && scope.variantId !== variant.id) ||
    (scope.productId && scope.productId !== product.id) ||
    (scope.categoryId && scope.categoryId !== product.categoryId) ||
    (scope.brand && scope.brand !== product.brand)
  )
    return 0;
  if (promo.type === "percent") return Number(promo.value);
  if (promo.type === "amount")
    return Math.min(100, (Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "special_price")
    return Math.max(0, (1 - Number(promo.value) / Number(variant.price)) * 100);
  if (promo.type === "nxm")
    return (
      ((Math.floor(qty / (scope.buy || 2)) *
        ((scope.buy || 2) - (scope.pay || 1))) /
        qty) *
      100
    );
  if (promo.type === "second_half")
    return ((Math.floor(qty / 2) * 0.5) / qty) * 100;
  return 0;
}

/** Recalcula una venta pendiente sin alterar su UUID idempotente. */
export function repricePendingSale(
  input: SaleInput,
  products: Product[],
  promotions: any[],
  taxIncluded = true,
) {
  const variants = new Map<string, { variant: any; product: Product }>();
  for (const product of products)
    for (const variant of product.variants)
      variants.set(variant.id, { variant, product });
  const active = promotions.filter(
    (p) =>
      p.active &&
      new Date(p.startsAt) <= new Date() &&
      new Date(p.endsAt) >= new Date(),
  );
  const lines = input.items.map((item) => {
    const current = variants.get(item.variantId);
    if (!current)
      throw new Error("Un producto de la venta ya no está disponible.");
    const { variant, product } = current;
    const gross = Number(variant.price) * item.qty;
    const lineDiscount = Math.max(
      item.discountPercent,
      gross ? ((item.discountAmount ?? 0) / gross) * 100 : 0,
    );
    const manual =
      100 - ((100 - lineDiscount) * (100 - input.globalDiscount)) / 100;
    const promo = Math.max(
      0,
      ...active.map((p) => promotionDiscount(p, variant, product, item.qty)),
    );
    const totals = lineTotals(
      item.qty,
      Number(variant.price),
      Math.max(manual, promo),
      Number(product.taxRate),
      taxIncluded,
    );
    return { item, variant, product, totals };
  });
  const total = money(
    lines.reduce((sum, line) => sum.plus(line.totals.total), d(0)),
  );
  const taxTotal = money(
    lines.reduce((sum, line) => sum.plus(line.totals.tax), d(0)),
  );
  // Las primeras colas offline no guardaban expectedTotal. En ese caso el
  // total aplicado de los pagos es una base segura y evita duplicar el monto
  // al ajustar la diferencia.
  const payments = input.payments.map((payment) => ({ ...payment }));
  const receivables = [...payments]
    .reverse()
    .filter((payment) => ["credit", "cod"].includes(payment.method));
  // El efectivo ya entregado no se inventa ni se borra: si ahora sobra, la API
  // lo registra como cambio. Sólo una cuenta por cobrar puede crecer para
  // cubrir un aumento; tarjeta/transferencia ya autorizadas no se alteran.
  const nonCash = payments
    .filter((payment) => payment.method !== "cash")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  let nonCashExcess = money(Math.max(0, nonCash - total));
  for (const payment of receivables) {
    const applied = Math.min(Number(payment.amount), nonCashExcess);
    payment.amount = money(Number(payment.amount) - applied);
    nonCashExcess = money(nonCashExcess - applied);
    if (nonCashExcess <= 0) break;
  }
  if (nonCashExcess > 0.01)
    throw new Error(
      "Esta venta usa pagos ya autorizados. Un administrador debe descartarla y cobrarla nuevamente.",
    );
  let paymentState = paymentTotals(total, payments);
  if (paymentState.pending > 0) {
    if (!receivables.length)
      throw new Error(
        "El precio aumentó y falta cobrar la diferencia. Descarta esta venta y cóbrala nuevamente.",
      );
    receivables[0].amount = money(
      Number(receivables[0].amount) + paymentState.pending,
    );
    paymentState = paymentTotals(total, payments);
  }
  if (paymentState.pending > 0.01)
    throw new Error(
      "Esta venta no tiene pagos suficientes. Descártala y cóbrala nuevamente.",
    );
  return {
    total,
    taxTotal,
    input: { ...input, expectedTotal: total, payments },
    prices: lines.map(({ item, variant, product, totals }) => ({
      variantId: item.variantId,
      name: product.name,
      sku: variant.sku,
      qty: item.qty,
      unitPrice: Number(variant.price),
      discount: totals.discount,
      lineTotal: totals.total,
    })),
  };
}

type RecordResolution = (body: {
  offlineUuid: string;
  action: "reprice" | "discard";
  previousTotal: number;
  currentTotal?: number;
  reason: string;
}) => Promise<unknown>;

/**
 * Guarda la corrección, sincroniza exclusivamente esta venta y sólo entonces
 * registra la resolución. Si la auditoría falla, la copia local permanece para
 * reintentar; el UUID hace idempotente la venta que ya llegó al servidor.
 */
export async function applyPendingSaleReprice(
  sale: PendingSale,
  products: Product[],
  promotions: any[],
  taxIncluded: boolean,
  dependencies: {
    recordResolution: RecordResolution;
    updateLocal: (
      id: string,
      changes: Partial<PendingSale>,
    ) => Promise<unknown>;
    syncOne: (input: SaleInput) => Promise<{
      status: "synced" | "conflict";
      message?: string;
      sale?: unknown;
    }>;
    deleteLocal: (id: string) => Promise<unknown>;
  },
) {
  const result = repricePendingSale(
    sale.input,
    products,
    promotions,
    taxIncluded,
  );
  const previousTotal = Number(
    sale.input.expectedTotal ?? sale.receipt?.total ?? 0,
  );
  const changes: Partial<PendingSale> = {
    input: result.input,
    receipt: {
      ...sale.receipt,
      total: result.total,
      taxTotal: result.taxTotal,
      payments: result.input.payments,
      snapshot: result.prices,
    },
    status: "pending",
    message: undefined,
  };
  await dependencies.updateLocal(sale.id, changes);
  const synced = await dependencies.syncOne(result.input);
  if (synced.status !== "synced") {
    const conflictChanges: Partial<PendingSale> = {
      status: "conflict",
      message: synced.message ?? "La venta sigue pendiente de revisión.",
    };
    await dependencies.updateLocal(sale.id, conflictChanges);
    return { ...result, changes: { ...changes, ...conflictChanges }, synced };
  }
  await dependencies.recordResolution({
    offlineUuid: sale.input.offlineUuid,
    action: "reprice",
    previousTotal,
    currentTotal: result.total,
    reason: "Catálogo, promociones y ajustes actualizados antes del reintento.",
  });
  await dependencies.deleteLocal(sale.id);
  return { ...result, changes, synced };
}

/** Registra el motivo en el servidor antes de borrar la única copia local. */
export async function discardPendingSale(
  sale: PendingSale,
  reason: string,
  dependencies: {
    recordResolution: RecordResolution;
    deleteLocal: (id: string) => Promise<unknown>;
  },
) {
  await dependencies.recordResolution({
    offlineUuid: sale.input.offlineUuid,
    action: "discard",
    previousTotal: Number(sale.input.expectedTotal ?? sale.receipt?.total ?? 0),
    reason,
  });
  await dependencies.deleteLocal(sale.id);
}
