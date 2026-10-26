// Reglas de dinero de GV compartidas por inscripciones (gv.ts) y citas
// (gv-citas.ts), según la auditoría docs/coordinacion/AUDITORIA_GV_CHATGPT.md:
// - lo pagado cuenta sólo lo verificado; «por verificar» va aparte (GV-08);
// - ningún cobro supera el total y el total no baja de lo cobrado (GV-09);
// - transferencia con banco y referencia (GV-07);
// - estados cerrados no aceptan pagos y el reembolso se registra (GV-13);
// - en la importación, cada pago con su clave, sin mover pagos entre dueñas
//   ni cambiar pagos ya revisados (GV-10/11/12).
import { Prisma } from "@prisma/client";
import { d, moneyAmount, z } from "@fitstore/shared";
import { Actor, audit, bad } from "./common";

export const GV_CONCEPTS = [
  "separo",
  "restante",
  "segundo",
  "tercero",
  "otro",
] as const;
export const GV_METHODS = ["efectivo", "transferencia", "tarjeta"] as const;
export const GV_CLOSED = new Set(["cancelada", "reembolsada"]);

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
  .refine(
    (v) => new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
    "no es una fecha válida",
  );
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
};
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
export const gvPaymentInput = <T extends z.ZodRawShape>(extra: T) =>
  z
    .object({ ...gvPaymentFields, ...extra })
    .superRefine((v, ctx) => transferDetails(v as GvPaymentData, ctx));
export type GvPaymentData = {
  date: string;
  amount: number;
  concept: (typeof GV_CONCEPTS)[number];
  method: (typeof GV_METHODS)[number];
  bank: string | null;
  reference: string | null;
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
};
const sum = (rows: PaymentLike[]): Prisma.Decimal =>
  rows.reduce((s, p) => s.plus(p.amount), d(0));
/** Pagos vigentes (verificados o por verificar): lo que ya está comprometido. */
export const committed = (payments: PaymentLike[]): Prisma.Decimal =>
  sum(payments.filter((p) => !p.rejectedAt));

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
) {
  const valid = payments.filter((p) => !p.rejectedAt);
  const paid = sum(valid.filter((p) => p.verified));
  const unverified = sum(valid.filter((p) => !p.verified));
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
  await tx.$queryRawUnsafe(
    `SELECT id FROM ${o.table} WHERE id = $1::uuid AND "branchId" = $2 FOR UPDATE`,
    id,
    branchId,
  );
  const row = await tx[o.model].findFirst({
    where: { id, branchId },
    include: { payments: true },
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
export async function createGvPayment(
  tx: any,
  actor: Actor,
  kind: GvOwnerKind,
  ownerId: string,
  operationId: string,
  data: GvPaymentData,
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
  const room = d(owner[o.total]).minus(committed(owner.payments));
  if (d(data.amount).gt(room))
    bad(
      `El pago supera lo pendiente (RD$ ${Prisma.Decimal.max(0, room).toFixed(2)}, contando lo por verificar).`,
    );
  // La transferencia queda por verificar; efectivo y tarjeta, verificados.
  const verified = data.method !== "transferencia";
  const row = await tx.gvPayment.create({
    data: {
      ...data,
      date: dateOnly(data.date),
      operationId,
      [o.field]: ownerId,
      verified,
      ...(verified ? { verifiedBy: actor.id, verifiedAt: new Date() } : {}),
      branchId: actor.branchId,
      createdBy: actor.id,
    },
  });
  await audit(
    tx,
    actor,
    "gv_payment_create",
    "gv_payment",
    row.id,
    undefined,
    row,
  );
  return row;
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
  if (total !== undefined && d(total).lt(committed(before.payments)))
    bad(
      `El total no puede ser menor que lo ya cobrado (RD$ ${committed(before.payments).toFixed(2)}).`,
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
  const paid = gvTotals(0, before.payments).paid;
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
    await db.$queryRawUnsafe(
      `SELECT id FROM ${OWNER[kind].table} WHERE "branchId" = $1 AND "externalId" = ANY($2::text[]) FOR UPDATE`,
      branchId,
      ownerKeys,
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
    return tx.gvPayment.create({
      data: {
        ...fields,
        ...review,
        date: dateOnly(date),
        [field]: ownerId,
        externalId: key,
        branchId: actor.branchId,
        createdBy: actor.id,
      },
    });
  // Un pago ya verificado o rechazado no cambia (planGvImportPayments ya
  // rechazó cualquier diferencia).
  if (old.rejectedAt || old.verified) return old;
  return tx.gvPayment.update({
    where: { id: old.id },
    data: {
      ...fields,
      date: dateOnly(date),
      // La verificación hecha en el sistema sólo cambia si el archivo la trae.
      ...(verified === undefined ? {} : review),
    },
  });
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
