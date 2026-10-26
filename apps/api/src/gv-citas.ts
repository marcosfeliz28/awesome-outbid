// GV Makeup Studio · citas de maquillaje e interesadas
// (docs/coordinacion/MODULO-GV.md §3-§5). Los pagos de una cita son GvPayment
// con appointmentId: mismo formato, verificación y reportes que los de las
// inscripciones (gv.ts). El pendiente es total − pagos no rechazados.
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  parse,
  uuid,
} from "./common";
import {
  gvImportUpsert,
  gvMoney,
  GV_CLOSED,
  applyGvImportPayment,
  checkGvOwnerEdit,
  createGvPayment,
  gvImportPayment,
  gvPaymentInput,
  gvRefundFields,
  gvTotals,
  lockGvOwner,
  planGvImportPayments,
} from "./gv-money";

export const GV_SERVICES = [
  "sencillo",
  "social",
  "glam",
  "correctivo",
  "novia",
  "con_peinado",
  "boda",
  "otro",
] as const;
export const GV_ARTISTS = ["Génesis", "Maryori", "Camila", "Evelin"] as const;
export const GV_APPOINTMENT_STATUS = [
  "agendada",
  "realizada",
  "cancelada",
  "reembolsada",
] as const;
export const GV_LEAD_STATUS = [
  "por_contactar",
  "contactada",
  "inscrita",
  "descartada",
] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "debe tener el formato AAAA-MM-DD")
  .refine(
    (v) => new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v,
    "no es una fecha válida",
  );
const price = gvMoney(true);
const dateOnly = (value: string) => new Date(value + "T00:00:00Z");
const dayText = (value: Date) => value.toISOString().slice(0, 10);

const appointmentFields = {
  // Fecha y hora con zona (p. ej. 2026-10-25T15:00:00-04:00).
  date: z
    .string()
    .datetime({ offset: true })
    .transform((v) => new Date(v)),
  clientName: text(160),
  phone: optionalText(40),
  instagram: optionalText(80),
  service: z.enum(GV_SERVICES),
  artists: z
    .array(z.enum(GV_ARTISTS))
    .max(GV_ARTISTS.length)
    .default([])
    .transform((v) => [...new Set(v)]),
  afterHours: z.boolean().default(false),
  total: price,
  tip: price.default(0),
  status: z.enum(GV_APPOINTMENT_STATUS).default("agendada"),
  note: optionalText(1000),
  // Boda (opcional): cotización, lugar y cantidad de personas.
  weddingQuote: price.nullish(),
  venue: optionalText(200),
  people: z.number().int().positive().max(1000).nullish(),
};
const leadFields = {
  name: text(160),
  phone: optionalText(40),
  interest: optionalText(200),
  action: optionalText(300),
  status: z.enum(GV_LEAD_STATUS).default("por_contactar"),
  note: optionalText(1000),
};
// Alta desde la pantalla (operationId) o de otro sistema (externalId): un
// reenvío con la misma clave devuelve el mismo registro.
const createKeys = {
  operationId: uuid.optional(),
  externalId: text(120).optional(),
};
const keyOf = (k: { operationId?: string; externalId?: string }) =>
  k.externalId ?? (k.operationId ? "op:" + k.operationId : null);

const money = (v: { toFixed(n: number): string } | null) =>
  v === null ? null : v.toFixed(2);
function appointmentView(row: any) {
  const payments = (row.payments ?? []) as any[];
  return {
    ...row,
    total: money(row.total),
    tip: money(row.tip),
    weddingQuote: money(row.weddingQuote),
    refundAmount: money(row.refundAmount ?? null),
    refundDate: row.refundDate ? dayText(row.refundDate) : null,
    ...gvTotals(row.total, payments, row),
    payments: payments.map((p) => ({
      ...p,
      date: dayText(p.date),
      amount: p.amount.toFixed(2),
    })),
  };
}
const paymentsOrder = {
  orderBy: [{ date: "asc" as const }, { createdAt: "asc" as const }],
};

// ── Importación (la llama POST /gv/import de gv.ts, misma transacción) ──
export const gvAppointmentImport = z.object({
  key: text(120),
  ...appointmentFields,
  ...gvRefundFields,
  payments: z.array(gvImportPayment).max(50).default([]),
});
export const gvLeadImport = z.object({ key: text(120), ...leadFields });
type AppointmentImport = z.infer<typeof gvAppointmentImport>;
type LeadImport = z.infer<typeof gvLeadImport>;

/**
 * Valida cada cita e interesada, revisa claves repetidas y cuenta altas y
 * cambios. `paymentKeys` trae las claves de pagos de inscripciones del mismo
 * archivo: comparten tabla. Los errores se agregan a `errors`.
 */
export async function planGvCitasImport(
  db: any,
  branchId: string,
  rawAppointments: unknown[],
  rawLeads: unknown[],
  paymentKeys: Set<string>,
  errors: string[],
) {
  const valid = <T>(
    schema: z.ZodType<T, any, any>,
    rows: unknown[],
    name: string,
  ) =>
    rows.flatMap((row, i) => {
      const r = schema.safeParse(row);
      if (r.success) return [r.data];
      for (const issue of r.error.issues.slice(0, 20))
        errors.push(`${name}.${i}.${issue.path.join(".")}: ${issue.message}`);
      return [];
    });
  const appointments = valid(
    gvAppointmentImport,
    rawAppointments,
    "appointments",
  );
  const leads = valid(gvLeadImport, rawLeads, "leads");
  const aKeys = new Set<string>();
  const pKeys = new Set<string>();
  appointments.forEach((a, i) => {
    if (aKeys.has(a.key))
      errors.push(`appointments.${i}.key: clave repetida «${a.key}»`);
    aKeys.add(a.key);
    a.payments.forEach((p, j) => {
      const key = p.key;
      if (pKeys.has(key) || paymentKeys.has(key))
        errors.push(
          `appointments.${i}.payments.${j}.key: clave repetida «${key}»`,
        );
      pKeys.add(key);
    });
  });
  const lKeys = new Set<string>();
  leads.forEach((l, i) => {
    if (lKeys.has(l.key))
      errors.push(`leads.${i}.key: clave repetida «${l.key}»`);
    lKeys.add(l.key);
  });
  const existing = async (model: string, keys: Set<string>) =>
    new Set<string>(
      (
        await db[model].findMany({
          where: { branchId, externalId: { in: [...keys] } },
          select: { externalId: true },
        })
      ).map((r: any) => r.externalId as string),
    );
  const existingPayments = await planGvImportPayments(
    db,
    branchId,
    appointments.map((a, i) => ({
      kind: "appointment" as const,
      key: a.key,
      path: `appointments.${i}`,
      total: a.total,
      status: a.status,
      refundAmount: a.refundAmount,
      refundDate: a.refundDate,
      payments: a.payments,
    })),
    errors,
  );
  const [oldA, oldL] = await Promise.all([
    existing("gvAppointment", aKeys),
    existing("gvLead", lKeys),
  ]);
  const count = (keys: Set<string>, old: { has(k: string): boolean }) => ({
    create: [...keys].filter((k) => !old.has(k)).length,
    update: [...keys].filter((k) => old.has(k)).length,
  });
  return {
    counts: {
      appointments: count(aKeys, oldA),
      appointmentPayments: count(pKeys, existingPayments),
      leads: count(lKeys, oldL),
    },
    appointments,
    leads,
    existingPayments,
  };
}

export async function applyGvCitasImport(
  tx: any,
  actor: Actor,
  appointments: AppointmentImport[],
  leads: LeadImport[],
  existingPayments: Map<string, any>,
) {
  const branchId = actor.branchId;
  for (const { key, payments, refundDate, ...rest } of appointments) {
    const a = { ...rest, refundDate: refundDate ? dateOnly(refundDate) : null };
    const row = await gvImportUpsert(
      tx,
      actor,
      "gvAppointment",
      "gv_appointment",
      key,
      {
        where: { branchId_externalId: { branchId, externalId: key } },
        create: { ...a, externalId: key, branchId, createdBy: actor.id },
        update: a,
      },
    );
    for (const p of payments)
      await applyGvImportPayment(
        tx,
        actor,
        "appointment",
        row.id,
        p,
        existingPayments.get(p.key),
      );
  }
  for (const { key, ...l } of leads)
    await gvImportUpsert(tx, actor, "gvLead", "gv_lead", key, {
      where: { branchId_externalId: { branchId, externalId: key } },
      create: { ...l, externalId: key, branchId, createdBy: actor.id },
      update: l,
    });
}

@Controller("gv")
export class GvCitasController {
  constructor(@Inject(Database) private readonly db: Database) {}

  private async appointment(tx: any, actor: Actor, id: string) {
    const row = await tx.gvAppointment.findFirst({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    if (!row) bad("Cita no encontrada.");
    return row;
  }
  private async lead(tx: any, actor: Actor, id: string) {
    const row = await tx.gvLead.findFirst({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    if (!row) bad("Interesada no encontrada.");
    return row;
  }

  // ?from=AAAA-MM-DD&to=AAAA-MM-DD (días completos en UTC) y ?status=.
  @Get("appointments")
  @Permit("gv:read")
  async appointments(@Query() query: unknown, @CurrentUser() actor: Actor) {
    const q = parse(
      z.object({
        from: day.optional(),
        to: day.optional(),
        status: z.enum(GV_APPOINTMENT_STATUS).optional(),
      }),
      query,
    );
    const rows = await this.db.gvAppointment.findMany({
      where: {
        branchId: actor.branchId,
        ...(q.status ? { status: q.status } : {}),
        ...(q.from || q.to
          ? {
              date: {
                ...(q.from ? { gte: dateOnly(q.from) } : {}),
                ...(q.to
                  ? { lt: new Date(dateOnly(q.to).getTime() + 86400000) }
                  : {}),
              },
            }
          : {}),
      },
      include: { payments: paymentsOrder },
      orderBy: { date: "desc" },
      take: 1000,
    });
    return rows.map(appointmentView);
  }

  @Get("appointments/:id")
  @Permit("gv:read")
  async appointmentDetail(
    @Param("id") id: string,
    @CurrentUser() actor: Actor,
  ) {
    const row = await this.appointment(this.db, actor, id);
    return appointmentView({
      ...row,
      payments: await this.db.gvPayment.findMany({
        where: { appointmentId: row.id },
        ...paymentsOrder,
      }),
    });
  }

  @Post("appointments")
  @Permit("gv:write")
  async createAppointment(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { operationId, externalId, ...data } = parse(
      z.object({ ...createKeys, ...appointmentFields }),
      body,
    );
    if (GV_CLOSED.has(data.status))
      bad("Una cita nueva no puede empezar cancelada o reembolsada.");
    const key = keyOf({ operationId, externalId });
    return this.db.$transaction(async (tx) => {
      if (key) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"gv-appointment:" + key}))`;
        const existing = await tx.gvAppointment.findUnique({
          where: {
            branchId_externalId: { branchId: actor.branchId, externalId: key },
          },
          include: { payments: paymentsOrder },
        });
        if (existing) return appointmentView(existing);
      }
      const row = await tx.gvAppointment.create({
        data: {
          ...data,
          externalId: key,
          branchId: actor.branchId,
          createdBy: actor.id,
        },
      });
      await audit(
        tx,
        actor,
        "gv_appointment_create",
        "gv_appointment",
        row.id,
        undefined,
        row,
      );
      return appointmentView({ ...row, payments: [] });
    });
  }

  @Patch("appointments/:id")
  @Permit("gv:write")
  async editAppointment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    // partial(): lo que no llega queda undefined y Prisma no lo cambia.
    const data = parse(
      z.object({ ...appointmentFields, ...gvRefundFields }).partial(),
      body,
    );
    const appointmentId = parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      const locked = await lockGvOwner(
        tx,
        "appointment",
        appointmentId,
        actor.branchId,
      );
      const { payments: _old, ...before } = locked;
      void _old;
      const row = await tx.gvAppointment.update({
        where: { id: before.id },
        data: checkGvOwnerEdit("appointment", locked, data) as any,
        include: { payments: paymentsOrder },
      });
      const { payments: _p, ...after } = row;
      void _p;
      await audit(
        tx,
        actor,
        "gv_appointment_edit",
        "gv_appointment",
        row.id,
        before,
        after,
      );
      return appointmentView(row);
    });
  }

  // Pago de una cita: mismo formato y verificación que los de inscripciones
  // (se revisan con POST /gv/payments/:id/review).
  @Post("appointments/:id/payments")
  @Permit("gv:write")
  async createPayment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const { operationId, ...data } = parse(
      gvPaymentInput({ operationId: uuid }),
      body,
    );
    const appointmentId = parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      const row = await createGvPayment(
        tx,
        actor,
        "appointment",
        appointmentId,
        operationId,
        data,
      );
      return { ...row, date: dayText(row.date) };
    });
  }

  @Get("leads")
  @Permit("gv:read")
  async leads(@Query() query: unknown, @CurrentUser() actor: Actor) {
    const q = parse(
      z.object({ status: z.enum(GV_LEAD_STATUS).optional() }),
      query,
    );
    return this.db.gvLead.findMany({
      where: {
        branchId: actor.branchId,
        ...(q.status ? { status: q.status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
  }

  @Post("leads")
  @Permit("gv:write")
  async createLead(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { operationId, externalId, ...data } = parse(
      z.object({ ...createKeys, ...leadFields }),
      body,
    );
    const key = keyOf({ operationId, externalId });
    return this.db.$transaction(async (tx) => {
      if (key) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"gv-lead:" + key}))`;
        const existing = await tx.gvLead.findUnique({
          where: {
            branchId_externalId: { branchId: actor.branchId, externalId: key },
          },
        });
        if (existing) return existing;
      }
      const row = await tx.gvLead.create({
        data: {
          ...data,
          externalId: key,
          branchId: actor.branchId,
          createdBy: actor.id,
        },
      });
      await audit(
        tx,
        actor,
        "gv_lead_create",
        "gv_lead",
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }

  @Patch("leads/:id")
  @Permit("gv:write")
  async editLead(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object(leadFields).partial(), body);
    return this.db.$transaction(async (tx) => {
      const before = await this.lead(tx, actor, id);
      const row = await tx.gvLead.update({ where: { id: before.id }, data });
      await audit(tx, actor, "gv_lead_edit", "gv_lead", row.id, before, row);
      return row;
    });
  }
}
