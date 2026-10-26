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
import { d, moneyAmount, z } from "@fitstore/shared";
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
import { GV_CONCEPTS, GV_METHODS, gvTotals } from "./gv";

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
const price = moneyAmount(10000000, true);
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
const paymentFields = {
  date: day,
  amount: moneyAmount(10000000),
  concept: z.enum(GV_CONCEPTS),
  method: z.enum(GV_METHODS),
  bank: optionalText(120),
  reference: optionalText(120),
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
    ...gvTotals(row.total, payments),
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
const importPayment = z.object({
  key: text(120).optional(),
  ...paymentFields,
  verified: z.boolean().optional(),
});
export const gvAppointmentImport = z.object({
  key: text(120),
  ...appointmentFields,
  payments: z.array(importPayment).max(50).default([]),
});
export const gvLeadImport = z.object({ key: text(120), ...leadFields });
type AppointmentImport = z.infer<typeof gvAppointmentImport>;
type LeadImport = z.infer<typeof gvLeadImport>;
const paymentKey = (a: { key: string }, p: { key?: string }, j: number) =>
  p.key ?? `${a.key}#${j + 1}`;

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
      const key = paymentKey(a, p, j);
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
  const [oldA, oldP, oldL] = await Promise.all([
    existing("gvAppointment", aKeys),
    existing("gvPayment", pKeys),
    existing("gvLead", lKeys),
  ]);
  const count = (keys: Set<string>, old: Set<string>) => ({
    create: [...keys].filter((k) => !old.has(k)).length,
    update: [...keys].filter((k) => old.has(k)).length,
  });
  return {
    counts: {
      appointments: count(aKeys, oldA),
      appointmentPayments: count(pKeys, oldP),
      leads: count(lKeys, oldL),
    },
    appointments,
    leads,
  };
}

export async function applyGvCitasImport(
  tx: any,
  actor: Actor,
  appointments: AppointmentImport[],
  leads: LeadImport[],
) {
  const branchId = actor.branchId;
  for (const { key, payments, ...a } of appointments) {
    const row = await tx.gvAppointment.upsert({
      where: { branchId_externalId: { branchId, externalId: key } },
      create: { ...a, externalId: key, branchId, createdBy: actor.id },
      update: a,
    });
    for (const [j, p] of payments.entries()) {
      const { key: _key, verified, date, ...fields } = p;
      void _key;
      const externalId = paymentKey({ key }, p, j);
      const isVerified = verified ?? fields.method !== "transferencia";
      const review = isVerified
        ? { verified: true, verifiedBy: actor.id, verifiedAt: new Date() }
        : { verified: false, verifiedBy: null, verifiedAt: null };
      await tx.gvPayment.upsert({
        where: { branchId_externalId: { branchId, externalId } },
        create: {
          ...fields,
          ...review,
          date: dateOnly(date),
          appointmentId: row.id,
          externalId,
          branchId,
          createdBy: actor.id,
        },
        // La verificación hecha en el sistema no se pisa salvo que el archivo
        // la indique (igual que los pagos de inscripciones).
        update: {
          ...fields,
          date: dateOnly(date),
          appointmentId: row.id,
          ...(verified === undefined ? {} : review),
        },
      });
    }
  }
  for (const { key, ...l } of leads)
    await tx.gvLead.upsert({
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
    const data = parse(z.object(appointmentFields).partial(), body);
    return this.db.$transaction(async (tx) => {
      const before = await this.appointment(tx, actor, id);
      const row = await tx.gvAppointment.update({
        where: { id: before.id },
        data,
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
      z.object({ operationId: uuid, ...paymentFields }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const appointment = await this.appointment(tx, actor, id);
      const existing = await tx.gvPayment.findUnique({
        where: { operationId },
      });
      if (existing) {
        if (
          existing.branchId !== actor.branchId ||
          existing.appointmentId !== appointment.id ||
          !d(existing.amount).eq(data.amount) ||
          existing.method !== data.method
        )
          bad("La clave de la operación ya corresponde a otro pago.");
        return { ...existing, date: dayText(existing.date) };
      }
      const verified = data.method !== "transferencia";
      const row = await tx.gvPayment.create({
        data: {
          ...data,
          date: dateOnly(data.date),
          operationId,
          appointmentId: appointment.id,
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
