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

/**
 * 05-A2: qué hacer con una venta sin conexión que el servidor no aceptó, en
 * palabras de la caja. Sale del mensaje de la sincronización.
 */
export function conflictHelp(message?: string) {
  const text = message ?? "";
  if (isPendingPriceConflict(text))
    return "Cambió un precio o una promoción: pulsa «Actualizar precios y reintentar».";
  if (/stock|existencia|unidades|lote/i.test(text))
    return "Falta inventario. Pide a gerencia que ajuste el inventario y pulsa «Reintentar». Si no hay unidades, gerencia la descarta con su PIN.";
  if (/48 horas/i.test(text))
    return "Pasó el plazo de 48 horas: ya no se puede reintentar. Pide a gerencia que la descarte con su PIN y, si corresponde, vuelve a cobrarla en línea.";
  // 05-N4: el reloj de este equipo no coincide con el horario de la caja (o la
  // caja ya se cerró): el servidor la rechaza siempre igual.
  if (/horario de esta caja/i.test(text))
    return "La hora en que se cobró no corresponde al horario de esa caja (revisa el reloj del equipo o la caja ya se cerró): ya no se puede reintentar. Pide a gerencia que la descarte con su PIN y, si corresponde, vuelve a cobrarla en línea.";
  if (/ventas sin conexi[oó]n est[aá]n desactivadas/i.test(text))
    return "Las ventas sin conexión están desactivadas: ya no se puede reintentar. Pide a gerencia que la descarte con su PIN y, si corresponde, vuelve a cobrarla en línea.";
  if (/cliente/i.test(text))
    return "Revisa el cliente y pulsa «Reintentar». Si no se puede, pide a gerencia que la descarte con su PIN.";
  return "Pulsa «Reintentar». Si vuelve a fallar, avisa a gerencia: puede descartarla con su PIN.";
}

/** Lo que la caja guardó de la venta, para la bitácora del descarte. */
export function pendingSaleDetail(sale: PendingSale) {
  const snapshot: any[] = Array.isArray(sale.receipt?.snapshot)
    ? sale.receipt.snapshot
    : [];
  const money2 = (value: unknown) =>
    Math.max(0, Math.round(Number(value ?? 0) * 100) / 100) || 0;
  return {
    receiptNumber: String(sale.receipt?.number ?? sale.id.slice(0, 8)).slice(
      0,
      40,
    ),
    total: money2(sale.receipt?.total ?? sale.input.expectedTotal),
    capturedAt: sale.input.capturedAt
      ? String(sale.input.capturedAt).slice(0, 40)
      : undefined,
    items: (snapshot.length
      ? snapshot.map((line) => ({
          variantId: line.variantId,
          name: String(line.name ?? "Artículo").slice(0, 300),
          sku: line.sku ? String(line.sku).slice(0, 100) : undefined,
          qty: Number(line.qty) || 1,
          unitPrice: money2(line.unitPrice),
          lineTotal: money2(line.lineTotal),
        }))
      : sale.input.items.map((item) => ({
          variantId: item.variantId,
          name: "Artículo",
          qty: Number(item.qty) || 1,
        }))
    ).slice(0, 200),
    payments: sale.input.payments.slice(0, 20).map((payment) => ({
      method: String(payment.method).slice(0, 20),
      amount: money2(payment.amount),
    })),
  };
}

/**
 * 05-A2: descarta con aprobación de gerencia (su PIN en el equipo de la
 * cajera, o su propia sesión). Primero queda la bitácora en el servidor y
 * sólo después se borra la copia local.
 */
export async function discardWithApproval(
  sale: PendingSale,
  reason: string,
  managerPin: string | undefined,
  dependencies: {
    post: (path: string, body: unknown) => Promise<unknown>;
    deleteLocal: (id: string) => Promise<unknown>;
  },
  // M-6: «delivered» = el cliente se llevó la mercancía y pagó; el servidor
  // registra la salida de inventario y la entrada de caja.
  outcome: "returned" | "delivered" = "returned",
) {
  await dependencies.post("/sales/offline-review/discard", {
    offlineUuid: sale.input.offlineUuid,
    reason: reason.trim(),
    ...(outcome === "delivered" ? { outcome } : {}),
    ...(managerPin ? { managerPin } : {}),
    detail: pendingSaleDetail(sale),
  });
  await dependencies.deleteLocal(sale.id);
}

/** 05-A2: aviso del cierre de caja cuando quedan ventas en este equipo. */
export function pendingCloseMessage(total: number, conflicts: number) {
  if (!total) return "";
  return (
    (total === 1
      ? "Hay 1 venta guardada"
      : "Hay " + total + " ventas guardadas") +
    " en este equipo sin registrar en el servidor" +
    (conflicts
      ? " (" +
        conflicts +
        (conflicts === 1 ? " requiere revisión)" : " requieren revisión)")
      : "") +
    ". Antes de cerrar: en Caja › Ventas guardadas en este dispositivo pulsa «Sincronizar»; si alguna requiere revisión, la cajera la reintenta o gerencia la descarta con su PIN."
  );
}
