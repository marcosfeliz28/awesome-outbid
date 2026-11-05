// Reglas de dinero de GV compartidas por inscripciones (gv.ts) y citas
// (gv-citas.ts), según la auditoría docs/coordinacion/AUDITORIA_GV_CHATGPT.md:
// - lo pagado cuenta sólo lo verificado; «por verificar» va aparte (GV-08);
// - ningún cobro supera el total y el total no baja de lo cobrado (GV-09);
// - transferencia con banco y referencia (GV-07);
// - estados cerrados no aceptan pagos y el reembolso se registra (GV-13);
// - en la importación, cada pago con su clave, sin mover pagos entre dueñas
//   ni cambiar pagos ya revisados (GV-10/11/12).
import { Prisma } from "@prisma/client";
import { businessDate, can, d, moneyAmount, z } from "@fitstore/shared";
import { Actor, audit, bad, denied, imageType } from "./common";
import { managerPinApproval } from "./security";

export const GV_CONCEPTS = [
  "separo",
  "completo",
  "restante",
  "segundo",
  "tercero",
  "otro",
] as const;
export const GV_METHODS = ["efectivo", "transferencia", "tarjeta"] as const;
export const GV_CLOSED = new Set(["cancelada", "reembolsada"]);
export const GV_CURRENCIES = ["DOP", "USD"] as const;

// Catálogo de cursos de Génesis (docs/operacion/GV_CATALOGO_CURSOS.md), con
// monto fijo del incentivo en RD$ por alumna. Se empata por nombre exacto.
// shortcut: catálogo en código, no en base; cambiarlo exige un despliegue.
export type CursoGv = {
  tipo: "automaquillaje" | "brazilian" | "personalizado";
  nombre: string;
  precio: number;
  moneda: "RD$" | "US$";
  incentivo: number;
};
// DUDA: la asignación del incentivo por curso es lectura de N1 del catálogo.
// Brazilian touch (curso 8): incentivo 0; lo lleva Yaisa aparte.
export const GV_CATALOGO: CursoGv[] = [
  {
    tipo: "personalizado",
    nombre: "Curso de maquilladora profesional personalizado",
    precio: 70000,
    moneda: "RD$",
    incentivo: 1000,
  },
  {
    tipo: "personalizado",
    nombre: "Curso maquilladora profesional personalizado",
    precio: 55000,
    moneda: "RD$",
    incentivo: 1000,
  },
  {
    tipo: "automaquillaje",
    nombre: "Curso de automaquillaje básico grupal",
    precio: 4500,
    moneda: "RD$",
    incentivo: 50,
  },
  {
    tipo: "automaquillaje",
    nombre: "Curso de automaquillaje básico personalizado",
    precio: 200,
    moneda: "US$",
    incentivo: 50,
  },
  {
    tipo: "automaquillaje",
    nombre: "Curso de automaquillaje básico personalizado avanzado",
    precio: 270,
    moneda: "US$",
    incentivo: 50,
  },
  {
    tipo: "automaquillaje",
    nombre: "Curso automaquillaje básico modalidad 2 clases",
    precio: 350,
    moneda: "US$",
    incentivo: 50,
  },
  {
    tipo: "automaquillaje",
    nombre: "Curso de automaquillaje básico personalizado 3 clases",
    precio: 450,
    moneda: "US$",
    incentivo: 50,
  },
  {
    tipo: "brazilian",
    nombre: "Perfeccionamiento para maquilladores grupal Brazilian touch",
    precio: 18000,
    moneda: "RD$",
    incentivo: 0,
  },
  {
    tipo: "personalizado",
    nombre:
      "Perfeccionamiento para maquilladores VIP personalizado: piel blindada + ojos social con delineado o novias",
    precio: 18000,
    moneda: "RD$",
    incentivo: 500,
  },
  {
    tipo: "personalizado",
    nombre: "Perfeccionamiento para maquilladores: piel glow + ojos social",
    precio: 15000,
    moneda: "RD$",
    incentivo: 500,
  },
];
/** Opciones del formulario «nuevo curso»: sin incentivo ni costos. */
export const catalogoOpciones = () =>
  GV_CATALOGO.map(({ nombre, precio, moneda, tipo }) => ({
    nombre,
    precio,
    moneda,
    tipo,
  }));
/** Moneda de precio del curso; un curso fuera del catálogo se cobra en RD$. */
export const monedaDeCurso = (nombre: string | null | undefined) =>
  GV_CATALOGO.find((c) => c.nombre === nombre)?.moneda ?? "RD$";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
export const gvDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "debe tener el formato AAAA-MM-DD")
  .refine((v) => {
    const t = new Date(v + "T00:00:00Z");
    // Fecha inválida (mes 13) hace que toISOString lance: se revisa antes.
    return (
      Number.isFinite(t.getTime()) &&
      t.toISOString().slice(0, 10) === v &&
      t.getUTCFullYear() >= 1900
    );
  }, "no es una fecha válida (entre 1900 y 9999)");
export const dateOnly = (value: string) => new Date(value + "T00:00:00Z");
export const dayText = (value: Date) => value.toISOString().slice(0, 10);

// Importe exacto con 2 decimales como máximo (sin la tolerancia de
// moneyAmount: 0.1 + 0.2 = 0.30000000000000004 se rechaza).
export const gvMoney = (allowZero = false) =>
  moneyAmount(10000000, allowZero).refine(
    (v) => d(v).decimalPlaces() <= 2,
    "debe tener como máximo 2 decimales",
  );
export const gvPaymentFields = {
  date: gvDay,
  amount: gvMoney(),
  concept: z.enum(GV_CONCEPTS),
  method: z.enum(GV_METHODS),
  bank: optionalText(120),
  reference: optionalText(120),
  // Moneda del pago (por defecto pesos). En US$ la tasa es obligatoria.
  currency: z.enum(GV_CURRENCIES).default("DOP"),
  rate: z.number().positive().max(100000).nullish(),
};
// Bancos de GV (orden de la dueña, 28-oct): la misma lista de la caja
// (Configuración → cuentas de banco), agrupada por empresa según su nombre.
export async function gvBankOptions(tx: any, branchId: string) {
  const row = await tx.settings.findUnique({ where: { id: branchId } });
  const data = (row?.data ?? {}) as Record<string, unknown>;
  const all = [data.transferAccounts, data.cardTerminals].flatMap((v) =>
    Array.isArray(v) ? (v as string[]) : [],
  );
  const genesis = (b: string) => /g[eé]nesis/i.test(b);
  return {
    genesis: all.filter(genesis),
    macgen: all.filter((b) => !genesis(b)),
    // Terminales de tarjeta (Configuración); con tarjeta no se elige banco.
    terminals: Array.isArray(data.cardTerminals)
      ? (data.cardTerminals as string[])
      : [],
  };
}
// Con lista en Configuración, el banco debe ser de la lista; sin lista no se
// exige (igual que la caja).
export function assertGvBank(
  banks: { genesis: string[]; macgen: string[]; terminals?: string[] },
  bank: string | null,
) {
  const listed = [...banks.genesis, ...banks.macgen];
  if (listed.length && (!bank || !listed.includes(bank)))
    bad("Elige el banco de la lista.");
}
// GV-07: una transferencia sin banco o sin referencia no se puede conciliar.
export const transferDetails = (
  p: { method: string; bank: string | null; reference: string | null },
  ctx: z.RefinementCtx,
) => {
  if (p.method !== "transferencia") return;
  if (!p.bank)
    ctx.addIssue({
      code: "custom",
      path: ["bank"],
      message: "es obligatorio en una transferencia",
    });
  if (!p.reference)
    ctx.addIssue({
      code: "custom",
      path: ["reference"],
      message: "es obligatoria en una transferencia",
    });
};
export const GV_TERMINAL = "Terminal GV";
export const GV_CARD_DESTINATION = "gv";
// Tarjeta: sin banco; la referencia (aprobación, lote o voucher) identifica el
// cobro en la conciliación.
export const cardDetails = (
  p: { method: string; reference: string | null },
  ctx: z.RefinementCtx,
) => {
  if (p.method === "tarjeta" && !p.reference)
    ctx.addIssue({
      code: "custom",
      path: ["reference"],
      message: "es obligatoria con tarjeta (aprobación, lote o voucher)",
    });
};
export const usdRate = (
  p: { currency?: string; rate?: number | null },
  ctx: z.RefinementCtx,
) => {
  if (p.currency === "USD" && !p.rate)
    ctx.addIssue({
      code: "custom",
      path: ["rate"],
      message: "es obligatoria en US$ (pesos por dólar)",
    });
};
/** Qué se trae de GvProof en las listas: nunca los bytes. */
export const PROOF_INFO = { select: { contentType: true, size: true } };
export const GV_PROOF_MAX = 2 * 1024 * 1024;
export const GV_PROOF_DATA_MAX = 3_000_000; // 2 MB en base64 + encabezado
/**
 * Foto o PDF de evidencia (data URL base64): tipo REAL por los primeros bytes
 * (jpeg, png, webp o pdf; no gif), debe coincidir con el declarado, máx. 2 MB.
 * Nada sale del servidor: se guarda en la base (GvProof).
 */
export function gvProofParse(dataUrl: string, what = "foto") {
  const m = /^data:([a-z]+\/[a-z.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    dataUrl,
  );
  if (!m) bad(`Adjunta la ${what} como imagen (JPG, PNG, WebP) o PDF.`);
  const bytes = Buffer.from(m[2], "base64");
  if (!bytes.length) bad(`La ${what} está vacía.`);
  if (bytes.length > GV_PROOF_MAX)
    bad(`La ${what} debe pesar como máximo 2 MB.`);
  const img = imageType(bytes);
  const contentType =
    img && img !== "gif"
      ? "image/" + img
      : bytes.subarray(0, 5).toString("latin1") === "%PDF-"
        ? "application/pdf"
        : null;
  if (!contentType || contentType !== m[1])
    bad(`La ${what} debe ser una imagen JPG, PNG o WebP, o un PDF.`);
  return { contentType, bytes, size: bytes.length };
}
/** Campos de comprobante de un pago (como las ventas): sin los bytes. */
export function gvProofFields<T extends { proof?: any }>(p: T) {
  const { proof, ...rest } = p;
  return {
    ...rest,
    hasProof: !!proof,
    proofContentType: (proof?.contentType as string | undefined) ?? null,
    proofBytes: (proof?.size as number | undefined) ?? null,
  };
}
export const gvPaymentInput = <T extends z.ZodRawShape>(extra: T) =>
  z
    .object({
      ...gvPaymentFields,
      // Solo la dueña ("*") puede cobrar sin caja abierta, y con motivo escrito.
      cashlessReason: z.string().trim().max(300).optional(),
      // Foto o PDF del voucher/comprobante como data URL (obligatoria con
      // tarjeta o transferencia; ver gvProofParse).
      proof: z.string().max(GV_PROOF_DATA_MAX).optional(),
      ...extra,
    })
    .superRefine((v, ctx) => {
      transferDetails(v as GvPaymentData, ctx);
      cardDetails(v as GvPaymentData, ctx);
      usdRate(v as GvPaymentData, ctx);
    });
export type GvPaymentData = {
  date: string;
  amount: number;
  concept: (typeof GV_CONCEPTS)[number];
  method: (typeof GV_METHODS)[number];
  bank: string | null;
  reference: string | null;
  currency?: (typeof GV_CURRENCIES)[number];
  rate?: number | null;
  cashlessReason?: string;
  proof?: string;
};
// Reembolso de una inscripción o cita «reembolsada» (GV-13).
export const gvRefundFields = {
  refundAmount: gvMoney().nullish(),
  refundDate: gvDay.nullish(),
};

type PaymentLike = {
  amount: Prisma.Decimal.Value;
  verified: boolean;
  rejectedAt?: Date | string | null;
  currency?: string | null;
  amountDop?: Prisma.Decimal.Value | null;
  rate?: Prisma.Decimal.Value | null;
};
type Moneda = "RD$" | "US$";

/**
 * Valor de un pago en la moneda del curso (decisiones de la dueña, 31-oct):
 * RD$ → pesos (el equivalente si el pago fue en US$); US$ → dólares, sólo
 * si el pago fue en US$. Null si no se puede convertir (no cuenta).
 */
export function valorEnMoneda(
  p: PaymentLike,
  moneda: Moneda,
): Prisma.Decimal | null {
  const usd = p.currency === "USD";
  if (moneda === "US$") {
    if (usd) return d(p.amount);
    // Pesos en un curso en US$: sólo con la tasa de ESE pago (sin tasa, no cuenta).
    return p.rate && d(p.rate).gt(0)
      ? d(p.amount).div(p.rate).toDecimalPlaces(2)
      : null;
  }
  if (!usd) return d(p.amount);
  return p.amountDop == null ? null : d(p.amountDop);
}
/** Valor en pesos para reportes: el equivalente guardado, o el monto si es en pesos. */
export const valorPesos = (p: PaymentLike): Prisma.Decimal =>
  p.currency === "USD" && p.amountDop != null ? d(p.amountDop) : d(p.amount);

const sum = (rows: PaymentLike[], moneda: Moneda = "RD$"): Prisma.Decimal =>
  rows.reduce((s, p) => s.plus(valorEnMoneda(p, moneda) ?? 0), d(0));
/** Pagos vigentes (verificados o por verificar): lo que ya está comprometido. */
export const committed = (
  payments: PaymentLike[],
  moneda: Moneda = "RD$",
): Prisma.Decimal =>
  sum(
    payments.filter((p) => !p.rejectedAt),
    moneda,
  );

/**
 * pagado = sólo lo verificado; por verificar aparte; pendiente = total −
 * pagado, nunca negativo y 0 si está cancelada o reembolsada.
 */
export function gvTotals(
  total: Prisma.Decimal.Value,
  payments: PaymentLike[],
  owner: {
    status?: string;
    refundAmount?: Prisma.Decimal.Value | null;
  } = {},
  moneda: Moneda = "RD$",
) {
  const valid = payments.filter((p) => !p.rejectedAt);
  const paid = sum(
    valid.filter((p) => p.verified),
    moneda,
  );
  const unverified = sum(
    valid.filter((p) => !p.verified),
    moneda,
  );
  const pending =
    owner.status && GV_CLOSED.has(owner.status)
      ? d(0)
      : Prisma.Decimal.max(0, d(total).minus(paid));
  return {
    paid: paid.toFixed(2),
    unverified: unverified.toFixed(2),
    refunded: d(owner.refundAmount ?? 0).toFixed(2),
    pending: pending.toFixed(2),
  };
}

export type GvOwnerKind = "enrollment" | "appointment";
const OWNER = {
  enrollment: {
    table: '"GvEnrollment"',
    model: "gvEnrollment",
    field: "enrollmentId",
    total: "agreedPrice",
    label: "La inscripción",
  },
  appointment: {
    table: '"GvAppointment"',
    model: "gvAppointment",
    field: "appointmentId",
    total: "total",
    label: "La cita",
  },
} as const;

/** Bloquea la inscripción o cita (FOR UPDATE) y la relee con sus pagos. */
export async function lockGvOwner(
  tx: any,
  kind: GvOwnerKind,
  id: string,
  branchId: string,
) {
  const o = OWNER[kind];
  await tx.$queryRaw(
    Prisma.sql`SELECT id FROM ${Prisma.raw(o.table)} WHERE id = ${id}::uuid AND "branchId" = ${branchId} FOR UPDATE`,
  );
  const row = await tx[o.model].findFirst({
    where: { id, branchId },
    include: {
      payments: true,
      ...(kind === "enrollment" ? { course: { select: { name: true } } } : {}),
    },
  });
  if (!row)
    bad(
      kind === "enrollment"
        ? "Inscripción no encontrada."
        : "Cita no encontrada.",
    );
  return row;
}

/** Alta de un pago con bloqueo, idempotencia y tope de saldo. */
/** Esperado de una caja GV por método, en pesos (pagos no anulados ni rechazados). */
export async function gvCajaEsperado(
  tx: any,
  sessionId: string,
): Promise<{
  efectivo: string;
  tarjeta: string;
  transferencia: string;
  count: number;
}> {
  const rows = await tx.gvPayment.findMany({
    where: { cashSessionId: sessionId, rejectedAt: null },
    select: { method: true, amount: true, amountDop: true },
  });
  const out = { efectivo: d(0), tarjeta: d(0), transferencia: d(0) };
  for (const r of rows)
    out[r.method as keyof typeof out] = out[r.method as keyof typeof out].plus(
      d(r.amountDop ?? r.amount),
    );
  return {
    efectivo: out.efectivo.toFixed(2),
    tarjeta: out.tarjeta.toFixed(2),
    transferencia: out.transferencia.toFixed(2),
    count: rows.length,
  };
}

export async function createGvPayment(
  tx: any,
  actor: Actor,
  kind: GvOwnerKind,
  ownerId: string,
  operationId: string,
  { cashlessReason, proof, ...data }: GvPaymentData,
) {
  const o = OWNER[kind];
  const owner = await lockGvOwner(tx, kind, ownerId, actor.branchId);
  const existing = await tx.gvPayment.findUnique({ where: { operationId } });
  if (existing) {
    if (
      existing.branchId !== actor.branchId ||
      existing[o.field] !== ownerId ||
      !d(existing.amount).eq(data.amount) ||
      existing.method !== data.method
    )
      bad("La clave de la operación ya corresponde a otro pago.");
    return existing;
  }
  if (GV_CLOSED.has(owner.status))
    bad(`${o.label} está ${owner.status}: no acepta pagos.`);
  // Tarjeta o transferencia: sin foto del voucher/comprobante no se guarda.
  if (data.method !== "efectivo" && !proof)
    bad(
      data.method === "tarjeta"
        ? "Adjunta la foto del voucher de la tarjeta."
        : "Adjunta la foto del comprobante de la transferencia.",
    );
  const proofFile = proof
    ? gvProofParse(
        proof,
        data.method === "tarjeta" ? "foto del voucher" : "foto del comprobante",
      )
    : null;
  if (data.method === "transferencia")
    assertGvBank(await gvBankOptions(tx, actor.branchId), data.bank);
  else if (data.method === "tarjeta") {
    // El «banco» de una tarjeta es la terminal: con lista, de la lista; sin
    // lista y sin terminal, el texto fijo «Terminal GV».
    const { terminals } = await gvBankOptions(tx, actor.branchId);
    if (data.bank && terminals.length && !terminals.includes(data.bank))
      bad("Elige la terminal de la lista.");
    data = { ...data, bank: data.bank || GV_TERMINAL };
  }
  const moneda =
    kind === "enrollment" ? monedaDeCurso(owner.course?.name) : "RD$";
  const usd = data.currency === "USD";
  if (moneda === "US$" && !usd && !data.rate)
    bad(
      "Este curso se cobra en US$: indica la tasa (pesos por dólar) del pago.",
    );
  // Equivalente en pesos con la tasa de este pago (en pesos, el mismo monto).
  const amountDop = usd
    ? d(data.amount)
        .times(data.rate ?? 0)
        .toDecimalPlaces(2)
    : d(data.amount);
  // El tope se compara en la moneda del curso.
  const valor =
    moneda === "US$"
      ? usd
        ? d(data.amount)
        : d(data.amount)
            .div(data.rate ?? 1)
            .toDecimalPlaces(2)
      : amountDop;
  const room = d(owner[o.total]).minus(committed(owner.payments, moneda));
  if (valor.gt(room))
    bad(
      `El pago supera lo pendiente (${moneda} ${Prisma.Decimal.max(0, room).toFixed(2)}, contando lo por verificar).`,
    );
  // Caja propia de GV: con la caja de un día anterior abierta no se cobra.
  const cash = await tx.gvCashSession.findFirst({
    where: { branchId: actor.branchId, closedAt: null },
    select: { id: true, openedAt: true },
  });
  if (cash && businessDate(cash.openedAt) < businessDate(new Date()))
    bad(
      "Cierra la caja de GV del día anterior antes de registrar pagos nuevos.",
    );
  // Sin caja abierta no se cobra (orden de la dueña, 5-nov); ella sí, con motivo.
  if (!cash) {
    if (!can(actor.permissions, "*"))
      bad("Abre tu caja de GV antes de cobrar.");
    if ((cashlessReason ?? "").length < 3)
      bad("Para cobrar sin caja abierta escribe el motivo.");
  }
  // Recibo interno numerado con el contador de la sucursal (sin NCF: GV aún no tiene RNC).
  const counter = await tx.counter.upsert({
    where: { key: "gvrecibo:" + actor.branchId },
    create: { key: "gvrecibo:" + actor.branchId, value: 1 },
    update: { value: { increment: 1 } },
  });
  // La transferencia queda por verificar; efectivo y tarjeta, verificados.
  const verified = data.method !== "transferencia";
  // El dinero de tarjeta se registra en el área GV, sin elegir cuenta de banco.
  const destination = data.method === "tarjeta" ? GV_CARD_DESTINATION : null;
  const row = await tx.gvPayment.create({
    data: {
      ...data,
      currency: usd ? "USD" : "DOP",
      rate: usd || moneda === "US$" ? (data.rate ?? null) : null,
      amountDop: amountDop.toFixed(2),
      destination,
      date: dateOnly(data.date),
      operationId,
      [o.field]: ownerId,
      verified,
      cashSessionId: cash?.id ?? null,
      receiptNumber: "GV-" + String(counter.value).padStart(7, "0"),
      ...(verified ? { verifiedBy: actor.id, verifiedAt: new Date() } : {}),
      branchId: actor.branchId,
      createdBy: actor.id,
    },
  });
  if (proofFile)
    await tx.gvProof.create({
      data: {
        paymentId: row.id,
        contentType: proofFile.contentType,
        size: proofFile.size,
        data: proofFile.bytes,
        createdBy: actor.id,
      },
    });
  await audit(tx, actor, "gv_payment_create", "gv_payment", row.id, undefined, {
    ...row,
    ...(cash ? {} : { cashlessReason }),
    ...(proofFile
      ? { proof: `(${proofFile.contentType}, ${proofFile.size} bytes)` }
      : {}),
  });
  return {
    ...row,
    hasProof: !!proofFile,
    proofContentType: proofFile?.contentType ?? null,
    proofBytes: proofFile?.size ?? null,
  };
}

/**
 * Edición de una inscripción o cita ya bloqueada: el total no baja de lo
 * cobrado; «reembolsada» exige monto (≤ lo verificado) y fecha y es final.
 */
export function checkGvOwnerEdit(
  kind: GvOwnerKind,
  before: any,
  data: {
    status?: string;
    refundAmount?: number | null;
    refundDate?: string | null;
  } & Record<string, unknown>,
) {
  const o = OWNER[kind];
  const total = data[o.total] as number | undefined;
  const moneda =
    kind === "enrollment" ? monedaDeCurso(before.course?.name) : "RD$";
  if (total !== undefined && d(total).lt(committed(before.payments, moneda)))
    bad(
      `El total no puede ser menor que lo ya cobrado (${moneda} ${committed(before.payments, moneda).toFixed(2)}).`,
    );
  const status = data.status ?? before.status;
  if (before.status === "reembolsada" && status !== "reembolsada")
    bad(`${o.label} ya fue reembolsada: su estado no cambia.`);
  const refunding = status === "reembolsada" && before.status !== "reembolsada";
  if (!refunding) {
    if (data.refundAmount != null || data.refundDate != null)
      bad("El reembolso sólo se registra al marcarla «reembolsada».");
    const { refundAmount: _a, refundDate: _b, ...rest } = data;
    void _a;
    void _b;
    return rest;
  }
  if (!data.refundAmount || !data.refundDate)
    bad(
      "Para marcarla «reembolsada» indica el monto y la fecha del reembolso.",
    );
  // El reembolso es siempre en RD$ (orden 106): se valida contra lo pagado en pesos.
  const paid = gvTotals(0, before.payments, {}, "RD$").paid;
  if (d(data.refundAmount).gt(paid))
    bad(`El reembolso no puede superar lo pagado verificado (RD$ ${paid}).`);
  return { ...data, refundDate: dateOnly(data.refundDate) };
}

// ── Importación ──
export const gvImportPayment = z
  .object({
    key: z.string().trim().min(1).max(120),
    ...gvPaymentFields,
    verified: z.boolean().optional(),
  })
  .superRefine(transferDetails);
export type GvImportPayment = z.infer<typeof gvImportPayment>;
type ImportOwner = {
  kind: GvOwnerKind;
  key: string;
  path: string;
  total: number;
  status: string;
  refundAmount?: number | null;
  refundDate?: string | null;
  payments: GvImportPayment[];
};
const sameMoney = (a: Prisma.Decimal.Value, b: Prisma.Decimal.Value) =>
  d(a).eq(b);

/**
 * Revisa los pagos importados contra la base. Devuelve los existentes por
 * clave. Errores en `errors` (el dryRun los muestra; sin dryRun no se guarda).
 */
export async function planGvImportPayments(
  db: any,
  branchId: string,
  owners: ImportOwner[],
  errors: string[],
) {
  const keys = owners.flatMap((o) => o.payments.map((p) => p.key));
  const existing = new Map<string, any>(
    (
      await db.gvPayment.findMany({
        where: { branchId, externalId: { in: keys } },
        include: {
          enrollment: { select: { externalId: true } },
          appointment: { select: { externalId: true } },
        },
      })
    ).map((p: any) => [p.externalId, p]),
  );
  // Inscripciones o citas que ya existen, con TODOS sus pagos (los hechos en
  // el sistema también cuentan para el tope y el reembolso).
  const owned = new Map<string, any>();
  for (const kind of ["enrollment", "appointment"] as const) {
    const ownerKeys = owners.filter((o) => o.kind === kind).map((o) => o.key);
    if (!ownerKeys.length) continue;
    // Bloqueadas hasta el final de la importación: nadie cobra en ellas entre
    // la validación y la escritura.
    await db.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw(OWNER[kind].table)} WHERE "branchId" = ${branchId} AND "externalId" = ANY(${ownerKeys}::text[]) FOR UPDATE`,
    );
    for (const row of await db[OWNER[kind].model].findMany({
      where: { branchId, externalId: { in: ownerKeys } },
      include: { payments: true },
    }))
      owned.set(kind + ":" + row.externalId, row);
  }
  for (const o of owners) {
    const before = owned.get(o.kind + ":" + o.key);
    const fileKeys = new Set(o.payments.map((p) => p.key));
    const dbOnly = ((before?.payments ?? []) as any[]).filter(
      (p) => !p.rejectedAt && !fileKeys.has(p.externalId),
    );
    const fromFile = o.payments
      .filter((p) => !existing.get(p.key)?.rejectedAt)
      .map((p) => {
        const old = existing.get(p.key);
        return {
          amount: p.amount,
          verified: old
            ? old.verified || p.verified === true
            : (p.verified ?? p.method !== "transferencia"),
        };
      });
    const all = [...dbOnly, ...fromFile];
    if (sum(all).gt(o.total))
      errors.push(
        `${o.path}.payments: los pagos (en el sistema y en el archivo) superan el total`,
      );
    const verifiedPaid = sum(all.filter((p) => p.verified));
    if (before?.status === "reembolsada") {
      if (o.status !== "reembolsada")
        errors.push(`${o.path}.status: ya fue reembolsada y no se reabre`);
      else if (
        !before.refundAmount ||
        !o.refundAmount ||
        !d(before.refundAmount).eq(o.refundAmount) ||
        dayText(before.refundDate) !== o.refundDate
      )
        errors.push(
          `${o.path}.refundAmount: el reembolso ya registrado no cambia`,
        );
      if (o.payments.some((p) => !existing.has(p.key)))
        errors.push(
          `${o.path}.payments: una reembolsada no acepta pagos nuevos`,
        );
    } else if (o.status === "reembolsada") {
      if (!o.refundAmount || !o.refundDate)
        errors.push(`${o.path}: «reembolsada» exige refundAmount y refundDate`);
      else if (d(o.refundAmount).gt(verifiedPaid))
        errors.push(`${o.path}.refundAmount: supera lo pagado verificado`);
    } else if (o.refundAmount != null)
      errors.push(`${o.path}.refundAmount: sólo con estado «reembolsada»`);
    o.payments.forEach((p, j) => {
      const old = existing.get(p.key);
      if (!old) return;
      const where = `${o.path}.payments.${j}.key`;
      const oldOwner =
        o.kind === "enrollment"
          ? old.enrollment?.externalId
          : old.appointment?.externalId;
      if (oldOwner !== o.key) {
        errors.push(`${where}: el pago «${p.key}» ya es de otra clienta`);
        return;
      }
      const reviewed = old.rejectedAt || old.verified;
      const same =
        sameMoney(old.amount, p.amount) &&
        old.method === p.method &&
        (old.bank ?? null) === p.bank &&
        (old.reference ?? null) === p.reference &&
        dayText(old.date) === p.date &&
        old.concept === p.concept;
      if (reviewed && !same)
        errors.push(
          `${where}: el pago «${p.key}» ya fue ${old.rejectedAt ? "rechazado" : "verificado"} y no se puede cambiar`,
        );
    });
  }
  return existing;
}

/**
 * Alta o cambio de una fila importada con su asiento en la bitácora (valor
 * anterior y nuevo), en la misma transacción.
 */
export async function gvImportUpsert(
  tx: any,
  actor: Actor,
  model: "gvCourse" | "gvEnrollment" | "gvAppointment" | "gvLead",
  entity: string,
  key: string,
  args: { where: unknown; create: unknown; update: unknown },
) {
  const before = await tx[model].findUnique({ where: args.where });
  const row = await tx[model].upsert(args);
  await audit(
    tx,
    actor,
    before ? "gv_import_update" : "gv_import_create",
    entity,
    row.id,
    before ?? undefined,
    { ...row, externalId: key },
  );
  return row;
}

export async function applyGvImportPayment(
  tx: any,
  actor: Actor,
  kind: GvOwnerKind,
  ownerId: string,
  p: GvImportPayment,
  old: any,
) {
  const { key, verified, date, ...fields } = p;
  const isVerified = verified ?? fields.method !== "transferencia";
  const review = isVerified
    ? { verified: true, verifiedBy: actor.id, verifiedAt: new Date() }
    : { verified: false, verifiedBy: null, verifiedAt: null };
  const field = OWNER[kind].field;
  const logged = async (before: any, row: any) => {
    await audit(
      tx,
      actor,
      before ? "gv_import_update" : "gv_import_create",
      "gv_payment",
      row.id,
      before,
      row,
    );
    return row;
  };
  if (old) {
    // Releer bajo bloqueo: una verificación o rechazo hecho mientras se
    // importaba gana; si el archivo trae otra cosa, la importación se deshace.
    await tx.$queryRaw`SELECT id FROM "GvPayment" WHERE id = ${old.id}::uuid FOR UPDATE`;
    old = await tx.gvPayment.findUnique({ where: { id: old.id } });
    if (old.rejectedAt || old.verified) {
      const same =
        sameMoney(old.amount, p.amount) &&
        old.method === p.method &&
        (old.bank ?? null) === p.bank &&
        (old.reference ?? null) === p.reference &&
        dayText(old.date) === p.date &&
        old.concept === p.concept;
      if (!same)
        bad(
          `El pago «${key}» fue revisado mientras se importaba; vuelve a intentarlo.`,
        );
      return old;
    }
  }
  if (!old)
    return logged(
      undefined,
      await tx.gvPayment.create({
        data: {
          ...fields,
          ...review,
          date: dateOnly(date),
          [field]: ownerId,
          externalId: key,
          branchId: actor.branchId,
          createdBy: actor.id,
        },
      }),
    );
  // Un pago ya verificado o rechazado no cambia (planGvImportPayments ya
  // rechazó cualquier diferencia).
  if (old.rejectedAt || old.verified) return old;
  return logged(
    old,
    await tx.gvPayment.update({
      where: { id: old.id },
      data: {
        ...fields,
        date: dateOnly(date),
        // La verificación hecha en el sistema sólo cambia si el archivo la trae.
        ...(verified === undefined ? {} : review),
      },
    }),
  );
}

/**
 * GV-03: nombres visibles en GV sólo de usuarias de GV o de administración
 * («*»); cualquier otra cuenta de Macgen aparece como «Gerencia».
 */
export async function gvUserNames(db: any, ids: string[]) {
  const unique = [...new Set(ids.filter((u) => /^[0-9a-f-]{36}$/.test(u)))];
  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: {
      id: true,
      name: true,
      role: { select: { name: true, permissions: true } },
    },
  });
  const names = new Map<string, string>();
  for (const u of users)
    names.set(
      u.id,
      u.role.name === "gv" || u.role.permissions.includes("*")
        ? u.name
        : "Gerencia",
    );
  return (id: string | null | undefined) =>
    id ? (names.get(id) ?? "Gerencia") : null;
}

/** PIN de la dueña en el cuerpo de anular/reembolsar. */
export const approverPin = z
  .string()
  .regex(/^\d{4,6}$/)
  .optional();

/**
 * PENDIENTE DE VISTO BUENO DE LA DUEÑA (4-nov): anular o devolver un pago de GV
 * lo aprueba la dueña («*») con su PIN; ella misma no lo necesita. Devuelve quién aprobó.
 */
export async function gvAprobacionDuena(
  db: any,
  actor: Actor,
  pin: string | undefined,
): Promise<string> {
  if (can(actor.permissions, "*")) return actor.id;
  if (!pin) denied("Anular o devolver un pago necesita el PIN de la dueña.");
  const approver = await managerPinApproval(db, actor, pin);
  const user = await db.user.findUnique({
    where: { id: approver },
    include: { role: true },
  });
  if (!can(user?.role.permissions ?? [], "*"))
    denied("Solo la dueña (administración) aprueba anular o devolver un pago.");
  return approver;
}
