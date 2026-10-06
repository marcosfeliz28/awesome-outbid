import Decimal from "decimal.js";
import { z } from "zod";
// La API usa esta misma instancia de zod. Con la API compilada (CommonJS) un
// import directo de "zod" cargaría otra copia y sus errores no se reconocerían
// (R4-08).
export { z, ZodError } from "zod";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });
export const d = (value: Decimal.Value) => new Decimal(value);
export const money = (value: Decimal.Value) =>
  d(value).toDecimalPlaces(2).toNumber();
export const quantity = (value: Decimal.Value) =>
  d(value).toDecimalPlaces(3).toNumber();
// Las existencias se guardan con 3 decimales. Una cantidad más fina se
// redondearía en el stock pero no en el costo (R4-03): se rechaza siempre.
export const isStockQty = (value: number) =>
  Number.isFinite(value) &&
  Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6;
const QTY_PRECISION = "debe tener como máximo 3 decimales";
/** Cantidad de mercancía positiva: mínimo 0.001 y como máximo 3 decimales. */
export const stockQty = (max = 1000000) =>
  z
    .number()
    .min(0.001, "debe ser al menos 0.001")
    .max(max)
    .refine(isStockQty, QTY_PRECISION);
/**
 * Cantidad derivada exacta, por ejemplo componente × combos vendidos (R6-01).
 * Devuelve null si el resultado no cabe en el stock: menor que 0.001 o con más
 * de 3 decimales. Nunca redondea: redondear desconecta el cobro del consumo.
 */
export const derivedStockQty = (...factors: Decimal.Value[]) => {
  const value = factors.reduce<Decimal>((acc, f) => acc.times(f), d(1));
  return value.gte(0.001) && value.decimalPlaces() <= 3
    ? value.toNumber()
    : null;
};
// Reparto exacto de una devolución entre las asignaciones de stock de la línea
// (lotes y componentes de combo), en milésimas y sin redondeos acumulados
// (R6-01). Por cada variante, lo devuelto hasta ahora corresponde a la
// proporción acumulada de la línea; las asignaciones se llenan en orden, así
// varias devoluciones parciales suman exactamente lo que se tomó de cada lote.
export function returnShares(
  allocations: { variantId: string; qty: number; [k: string]: any }[],
  lineQty: Decimal.Value,
  returnedBefore: Decimal.Value,
  returning: Decimal.Value,
) {
  const out: { allocation: (typeof allocations)[number]; qty: number }[] = [];
  const before = d(returnedBefore),
    after = before.plus(returning);
  const groups = new Map<string, typeof allocations>();
  for (const a of allocations)
    groups.set(a.variantId, [...(groups.get(a.variantId) ?? []), a]);
  for (const list of groups.values()) {
    const taken = list.reduce((s, a) => s.plus(a.qty), d(0));
    const target = (returned: Decimal) =>
      d(quantity(taken.times(returned).div(lineQty)));
    let restBefore = target(before),
      restAfter = target(after);
    for (const allocation of list) {
      const cap = d(allocation.qty);
      const clamp = (v: Decimal) => (v.lt(0) ? d(0) : v.gt(cap) ? cap : v);
      const qty = clamp(restAfter).minus(clamp(restBefore));
      restBefore = restBefore.minus(cap);
      restAfter = restAfter.minus(cap);
      if (qty.gt(0)) out.push({ allocation, qty: qty.toNumber() });
    }
  }
  return out;
}
/**
 * Costo exacto de una línea vendida: lo que valían sus asignaciones de stock
 * (lotes o componentes de combo). En combos, unitCost está redondeado a
 * centavos por unidad; las asignaciones no. Un combo anterior a la ronda 7
 * vendido en fracción guardó cantidades redondeadas (sin "exact"): para él vale
 * el costo registrado, unitCost × qty.
 */
export function allocationCost(line: {
  qty: Decimal.Value;
  unitCost: Decimal.Value;
  variantId?: string;
  stockAllocations?: unknown;
}) {
  const allocations = Array.isArray(line.stockAllocations)
    ? (line.stockAllocations as {
        qty?: unknown;
        unitCost?: unknown;
        variantId?: unknown;
        exact?: unknown;
      }[])
    : [];
  const kit = allocations.some(
    (a) => line.variantId !== undefined && a?.variantId !== line.variantId,
  );
  if (
    allocations.length &&
    allocations.every(
      (a) => typeof a?.qty === "number" && typeof a?.unitCost === "number",
    ) &&
    // Combos antiguos: sus cantidades eran exactas si se vendieron enteros
    // (componente con 3 decimales × unidades enteras).
    (!kit ||
      allocations.every((a) => a?.exact === true) ||
      d(line.qty).isInteger())
  )
    return allocations.reduce(
      (s, a) => s.plus(d(a.qty as number).times(a.unitCost as number)),
      d(0),
    );
  return d(line.unitCost).times(line.qty);
}
/** Cantidad contada (puede ser 0), con como máximo 3 decimales. */
export const countedQty = (max = 1000000) =>
  z.number().min(0).max(max).refine(isStockQty, QTY_PRECISION);
/** Ajuste con signo, distinto de 0 y con como máximo 3 decimales. */
export const signedStockQty = (max = 100000) =>
  z
    .number()
    .refine((v) => v !== 0 && Math.abs(v) <= max, "debe ser distinta de 0")
    .refine((v) => Math.abs(v) >= 0.001 && isStockQty(v), QTY_PRECISION);
export const weightedCost = (
  stock: Decimal.Value,
  cost: Decimal.Value,
  received: Decimal.Value,
  receivedCost: Decimal.Value,
) => {
  const total = d(stock).plus(received);
  return total.isZero()
    ? 0
    : money(
        d(stock).times(cost).plus(d(received).times(receivedCost)).div(total),
      );
};
export const landedCosts = (
  items: { qty: number; cost: number }[],
  additional: number,
  by: "value" | "units" = "value",
) => {
  const weights = items.map((i) => d(i.qty).times(by === "value" ? i.cost : 1));
  const total = weights.reduce((a, b) => a.plus(b), d(0));
  if (total.lte(0))
    throw new Error("La recepción debe tener cantidades y valores positivos.");
  return items.map((i, index) =>
    money(
      d(i.cost).plus(d(additional).times(weights[index]).div(total).div(i.qty)),
    ),
  );
};
export const lineTotals = (
  qty: number,
  price: number,
  discountPercent = 0,
  taxRate = 18,
  taxIncluded = true,
  discountAmount = 0,
) => {
  const gross = d(qty).times(price);
  if (discountAmount < 0 || discountAmount > gross.toNumber())
    throw new Error("El descuento por monto supera el importe de la línea.");
  const discount = Decimal.max(
    gross.times(discountPercent).div(100),
    discountAmount,
  );
  const amount = gross.minus(discount);
  const tax = taxIncluded
    ? amount.minus(amount.div(d(1).plus(d(taxRate).div(100))))
    : amount.times(taxRate).div(100);
  // Se redondean el bruto, el importe y el ITBIS; descuento y neto (o total)
  // salen por diferencia para que el resumen cuadre al centavo:
  // subtotal − descuento = total (o neto) y neto + ITBIS = total (R9-dinero-11).
  const subtotal = d(money(gross)),
    charged = d(money(amount)),
    taxed = d(money(tax));
  return {
    subtotal: subtotal.toNumber(),
    discount: money(subtotal.minus(charged)),
    tax: taxed.toNumber(),
    net: money(taxIncluded ? charged.minus(taxed) : charged),
    total: money(taxIncluded ? charged : charged.plus(taxed)),
  };
};
export const paymentTotals = (
  total: number,
  payments: { method: string; amount: number }[],
) => {
  const paid = payments.reduce((a, p) => a.plus(p.amount), d(0));
  const nonCash = payments
    .filter((p) => p.method !== "cash")
    .reduce((a, p) => a.plus(p.amount), d(0));
  if (nonCash.gt(total))
    throw new Error(
      "Los pagos distintos de efectivo no pueden generar cambio.",
    );
  return {
    paid: money(paid),
    pending: money(Decimal.max(0, d(total).minus(paid))),
    change: money(Decimal.max(0, paid.minus(total))),
  };
};
export const grossProfit = (net: number, cost: number) =>
  money(d(net).minus(cost));
export const margin = (net: number, cost: number) =>
  net <= 0 ? 0 : money(d(net).minus(cost).div(net).times(100));
export const markup = (price: number, cost: number) =>
  cost <= 0 ? 0 : money(d(price).minus(cost).div(cost).times(100));
export const netProfit = (
  net: number,
  cost: number,
  expenses: number,
  fees = 0,
) => money(d(net).minus(cost).minus(expenses).minus(fees));
export const breakEven = (fixedExpenses: number, marginPercent: number) =>
  marginPercent <= 0
    ? null
    : money(d(fixedExpenses).div(d(marginPercent).div(100)));
export const turnover = (costOfSales: number, averageInventory: number) =>
  averageInventory <= 0 ? 0 : money(d(costOfSales).div(averageInventory));
export const inventoryDays = (stock: number, averageDaily: number) =>
  averageDaily <= 0 ? null : money(d(stock).div(averageDaily));
export const reorderPoint = (
  averageDaily: number,
  leadDays: number,
  safety: number,
) => quantity(d(averageDaily).times(leadDays).plus(safety));
export const averageTicket = (sales: number, invoices: number) =>
  invoices <= 0 ? 0 : money(d(sales).div(invoices));
export const abc = <T extends { revenue: number }>(items: T[]) => {
  const sorted = [...items].sort((a, b) => b.revenue - a.revenue);
  const total = sorted.reduce((a, i) => a.plus(i.revenue), d(0));
  let cumulative = d(0);
  return sorted.map((i) => {
    const start = total.isZero() ? 1 : cumulative.div(total).toNumber();
    cumulative = cumulative.plus(i.revenue);
    return { ...i, class: start < 0.8 ? "A" : start < 0.95 ? "B" : "C" };
  });
};
export const clearanceScore = (
  daysIdle: number,
  daysToExpiry: number | null,
  stock: number,
  cost: number,
) =>
  money(
    Math.min(daysIdle, 180) / 3 +
      (daysToExpiry === null ? 0 : Math.max(0, 60 - daysToExpiry) * 2) +
      Math.min((stock * cost) / 1000, 40),
  );
export const safeDiscount = (price: number, cost: number, taxRate = 18) =>
  Math.max(
    0,
    Math.min(50, Math.floor(margin(price / (1 + taxRate / 100), cost))),
  );
export const saleSchema = z.object({
  offlineUuid: z.string().uuid(),
  capturedAt: z.string().datetime().optional(),
  customerId: z.string().uuid().nullable().optional(),
  cashSessionId: z.string().uuid(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        qty: stockQty(10000),
        discountPercent: z.number().min(0).max(100).default(0),
        discountAmount: z.number().nonnegative().max(100000000).optional(),
      }),
    )
    .min(1)
    .max(200),
  globalDiscount: z.number().min(0).max(100).default(0),
  expectedTotal: z.number().nonnegative().optional(),
  managerPin: z
    .string()
    .regex(/^\d{4,6}$/)
    .optional(),
  creditDueDate: z.string().datetime().optional(),
  ncfType: z.enum(["B01", "B02", "B14", "B15", "E31", "E32"]).optional(),
  recipientLegalId: z.string().min(9).max(11).regex(/^\d+$/).optional(),
  notes: z.string().max(1000).optional(),
  payments: z
    .array(
      z.object({
        method: z.enum(["cash", "card", "transfer", "credit_note", "credit"]),
        creditNoteId: z.string().uuid().optional(),
        creditNoteCode: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[0-9A-F]{32}$/)
          .optional(),
        amount: z.number().positive().max(100000000),
        bank: z.string().max(100).optional(),
        reference: z.string().max(100).optional(),
        cardBrand: z.string().max(40).optional(),
        cardLast4: z
          .string()
          .regex(/^\d{4}$/)
          .optional(),
        cardType: z.enum(["credit", "debit"]).optional(),
        approvalCode: z.string().max(100).optional(),
      }),
    )
    .min(1)
    .max(20),
});
export type SaleInput = z.infer<typeof saleSchema>;
export const permissions: Record<string, string[]> = {
  admin: ["*"],
  manager: [
    "catalog:read",
    "catalog:write",
    "inventory:write",
    "purchase:write",
    "sale:write",
    "sale:manage",
    "cash:write",
    "expense:write",
    "reports:read",
    "profit:read",
    "customers:write",
    "promotions:write",
    "alerts:write",
  ],
  seller: ["catalog:read", "sale:write", "cash:write", "customers:write"],
  warehouse: ["catalog:read", "inventory:write", "purchase:write"],
};
export const can = (grants: string[], permission: string) =>
  grants.includes("*") || grants.includes(permission);
export const categories = [
  "Suplementos",
  "Ropa deportiva",
  "Fajas",
  "Accesorios de gym",
  "Maquillaje",
];
export const formatMoney = (value: number | string) =>
  "RD$ " +
  Number(value).toLocaleString("es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const BUSINESS_TIME_ZONE = "America/Santo_Domingo";
export const businessDate = (value: Date | string | number = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
// Los vencimientos son fechas civiles: vencen al terminar ese día en Santo Domingo.
export const expired = (
  value: Date | string | null | undefined,
  now: Date = new Date(),
) => !!value && businessDate(value) < businessDate(now);
export const expiryDays = (value: Date | string, now: Date = new Date()) =>
  Math.round(
    (Date.parse(businessDate(value) + "T12:00:00Z") -
      Date.parse(businessDate(now) + "T12:00:00Z")) /
      86400000,
  );
export const weekStart = (value: Date = new Date()) => {
  const day = new Date(businessDate(value) + "T12:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
};
