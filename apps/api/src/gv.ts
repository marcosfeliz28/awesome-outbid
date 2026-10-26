// Módulo GV Makeup Studio (docs/coordinacion/MODULO-GV.md): cursos,
// inscripciones y cobros. Es un registro de seguimiento: no crea ventas de la
// caja ni comprobantes fiscales (los productos de los cursos se venden en la
// caja normal de Macgen).
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
import { Prisma } from "@prisma/client";
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

export const GV_COURSE_TYPES = [
  "automaquillaje",
  "brazilian",
  "personalizado",
  "otro",
] as const;
export const GV_ENROLLMENT_STATUS = [
  "activa",
  "no_asistio",
  "personalizado",
  "cancelada",
  "reembolsada",
] as const;
export const GV_CONCEPTS = [
  "separo",
  "restante",
  "segundo",
  "tercero",
  "otro",
] as const;
export const GV_METHODS = ["efectivo", "transferencia", "tarjeta"] as const;

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

const courseFields = {
  name: text(160),
  type: z.enum(GV_COURSE_TYPES),
  date: day,
  price,
  capacity: z.number().int().min(0).max(10000),
};
const courseInput = z.object({
  ...courseFields,
  active: z.boolean().optional(),
});
const enrollmentFields = {
  clientName: text(160),
  phone: optionalText(40),
  instagram: optionalText(80),
  agreedPrice: price,
  status: z.enum(GV_ENROLLMENT_STATUS).default("activa"),
  attended: z.boolean().nullable().default(null),
  boughtBrushSet: z.boolean().default(false),
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

/** Pagado (sin los rechazados), por verificar y pendiente de una inscripción. */
export function gvTotals(
  agreedPrice: Prisma.Decimal.Value,
  payments: {
    amount: Prisma.Decimal.Value;
    verified: boolean;
    rejectedAt?: Date | string | null;
  }[],
) {
  const valid = payments.filter((p) => !p.rejectedAt);
  const paid = valid.reduce((sum, p) => sum.plus(p.amount), d(0));
  const unverified = valid
    .filter((p) => !p.verified)
    .reduce((sum, p) => sum.plus(p.amount), d(0));
  return {
    paid: paid.toFixed(2),
    unverified: unverified.toFixed(2),
    pending: d(agreedPrice).minus(paid).toFixed(2),
  };
}
// Ocupan cupo las inscritas que no cancelaron ni pasaron a personalizado.
const OCCUPIES = new Set(["activa", "no_asistio"]);
const CLOSED = new Set(["cancelada", "reembolsada"]);
const dateOnly = (value: string) => new Date(value + "T00:00:00Z");
const dayText = (value: Date) => value.toISOString().slice(0, 10);

const importPayment = z.object({
  key: text(120).optional(),
  ...paymentFields,
  verified: z.boolean().optional(),
});
const importSchema = z.object({
  courses: z
    .array(
      z.object({
        key: text(120),
        ...courseFields,
        active: z.boolean().optional(),
      }),
    )
    .max(500)
    .default([]),
  enrollments: z
    .array(
      z.object({
        key: text(120),
        courseKey: text(120),
        ...enrollmentFields,
        payments: z.array(importPayment).max(50).default([]),
      }),
    )
    .max(5000)
    .default([]),
  // Citas e interesadas: las valida y guarda gv-citas.ts (misma transacción).
  appointments: z.array(z.unknown()).max(5000).default([]),
  leads: z.array(z.unknown()).max(5000).default([]),
});

const importKeys = z.object({
  courses: z.array(z.object({ key: z.string() })).catch([]),
  enrollments: z
    .array(
      z.object({
        key: z.string(),
        courseKey: z.string(),
        payments: z.array(z.object({ key: z.string().optional() })).catch([]),
      }),
    )
    .catch([]),
});

@Controller("gv")
export class GvController {
  constructor(@Inject(Database) private readonly db: Database) {}

  private async course(actor: Actor, id: string) {
    const row = await this.db.gvCourse.findFirst({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    if (!row) bad("Curso no encontrado.");
    return row;
  }
  private async enrollment(tx: any, actor: Actor, id: string) {
    const row = await tx.gvEnrollment.findFirst({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    if (!row) bad("Inscripción no encontrada.");
    return row;
  }

  @Get("courses")
  @Permit("gv:read")
  async courses(@CurrentUser() actor: Actor) {
    const rows = await this.db.gvCourse.findMany({
      where: { branchId: actor.branchId },
      include: {
        enrollments: {
          select: {
            agreedPrice: true,
            status: true,
            attended: true,
            boughtBrushSet: true,
            payments: {
              select: { amount: true, verified: true, rejectedAt: true },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { name: "asc" }],
    });
    return rows.map(({ enrollments, ...course }) => {
      const totals = enrollments.map((e) => ({
        ...gvTotals(e.agreedPrice, e.payments),
        closed: CLOSED.has(e.status),
      }));
      // Lo pendiente de una cancelada o reembolsada no se cobra.
      const sum = (key: "paid" | "pending" | "unverified") =>
        totals
          .filter((t) => key !== "pending" || !t.closed)
          .reduce((s, t) => s.plus(t[key]), d(0))
          .toFixed(2);
      return {
        ...course,
        date: dayText(course.date),
        price: course.price.toFixed(2),
        enrolled: enrollments.filter((e) => OCCUPIES.has(e.status)).length,
        attended: enrollments.filter((e) => e.attended === true).length,
        brushSets: enrollments.filter((e) => e.boughtBrushSet).length,
        paid: sum("paid"),
        pending: sum("pending"),
        unverified: sum("unverified"),
      };
    });
  }

  @Post("courses")
  @Permit("gv:write")
  async createCourse(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(courseInput, body);
    return this.db.$transaction(async (tx) => {
      const row = await tx.gvCourse.create({
        data: {
          ...data,
          date: dateOnly(data.date),
          branchId: actor.branchId,
          createdBy: actor.id,
        },
      });
      await audit(
        tx,
        actor,
        "gv_course_create",
        "gv_course",
        row.id,
        undefined,
        row,
      );
      return { ...row, date: dayText(row.date) };
    });
  }

  @Patch("courses/:id")
  @Permit("gv:write")
  async editCourse(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(courseInput.partial(), body);
    const before = await this.course(actor, id);
    return this.db.$transaction(async (tx) => {
      const row = await tx.gvCourse.update({
        where: { id: before.id },
        data: { ...data, ...(data.date ? { date: dateOnly(data.date) } : {}) },
      });
      await audit(
        tx,
        actor,
        "gv_course_edit",
        "gv_course",
        row.id,
        before,
        row,
      );
      return { ...row, date: dayText(row.date) };
    });
  }

  @Get("courses/:id")
  @Permit("gv:read")
  async courseDetail(@Param("id") id: string, @CurrentUser() actor: Actor) {
    const course = await this.course(actor, id);
    const enrollments = await this.db.gvEnrollment.findMany({
      where: { courseId: course.id, branchId: actor.branchId },
      include: {
        payments: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
      },
      orderBy: { clientName: "asc" },
    });
    const userIds = [
      ...new Set(
        enrollments.flatMap((e) => [
          e.createdBy,
          ...e.payments.flatMap((p) => [p.createdBy, p.verifiedBy ?? ""]),
        ]),
      ),
    ].filter(Boolean);
    const users = new Map(
      (
        await this.db.user.findMany({
          where: {
            id: { in: userIds.filter((u) => /^[0-9a-f-]{36}$/.test(u)) },
          },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return {
      ...course,
      date: dayText(course.date),
      price: course.price.toFixed(2),
      enrollments: enrollments.map((e) => ({
        ...e,
        agreedPrice: e.agreedPrice.toFixed(2),
        createdByName: users.get(e.createdBy) ?? null,
        ...gvTotals(e.agreedPrice, e.payments),
        payments: e.payments.map((p) => ({
          ...p,
          date: dayText(p.date),
          amount: p.amount.toFixed(2),
          createdByName: users.get(p.createdBy) ?? null,
          verifiedByName: p.verifiedBy
            ? (users.get(p.verifiedBy) ?? null)
            : null,
        })),
      })),
    };
  }

  @Post("enrollments")
  @Permit("gv:write")
  async createEnrollment(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { operationId, courseId, ...data } = parse(
      z.object({ operationId: uuid, courseId: uuid, ...enrollmentFields }),
      body,
    );
    await this.course(actor, courseId);
    return this.db.$transaction(async (tx) => {
      // Un reintento con la misma clave devuelve la misma inscripción.
      const existing = await tx.gvEnrollment.findUnique({
        where: { operationId },
      });
      if (existing) {
        if (
          existing.branchId !== actor.branchId ||
          existing.courseId !== courseId
        )
          bad("La clave de la operación ya corresponde a otra inscripción.");
        return existing;
      }
      const row = await tx.gvEnrollment.create({
        data: {
          ...data,
          operationId,
          courseId,
          branchId: actor.branchId,
          createdBy: actor.id,
        },
      });
      await audit(
        tx,
        actor,
        "gv_enrollment_create",
        "gv_enrollment",
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }

  @Patch("enrollments/:id")
  @Permit("gv:write")
  async editEnrollment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({ courseId: uuid, ...enrollmentFields }).partial(),
      body,
    );
    // partial(): lo que no llega queda undefined (sin los valores por defecto
    // del alta) y Prisma no lo cambia.
    if (data.courseId) await this.course(actor, data.courseId);
    return this.db.$transaction(async (tx) => {
      const before = await this.enrollment(tx, actor, id);
      const row = await tx.gvEnrollment.update({
        where: { id: before.id },
        data,
      });
      await audit(
        tx,
        actor,
        "gv_enrollment_edit",
        "gv_enrollment",
        row.id,
        before,
        row,
      );
      return row;
    });
  }

  @Post("payments")
  @Permit("gv:write")
  async createPayment(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { operationId, enrollmentId, ...data } = parse(
      z.object({ operationId: uuid, enrollmentId: uuid, ...paymentFields }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const existing = await tx.gvPayment.findUnique({
        where: { operationId },
      });
      if (existing) {
        if (
          existing.branchId !== actor.branchId ||
          existing.enrollmentId !== enrollmentId ||
          !d(existing.amount).eq(data.amount) ||
          existing.method !== data.method
        )
          bad("La clave de la operación ya corresponde a otro pago.");
        return existing;
      }
      await this.enrollment(tx, actor, enrollmentId);
      // La transferencia queda por verificar; efectivo y tarjeta, verificados.
      const verified = data.method !== "transferencia";
      const row = await tx.gvPayment.create({
        data: {
          ...data,
          date: dateOnly(data.date),
          operationId,
          enrollmentId,
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
    });
  }

  // Verificar o rechazar un pago (transferencia que llegó o no). Un pago
  // rechazado deja de contar como pagado; queda en la bitácora con quién.
  @Post("payments/:id/review")
  @Permit("gv:write")
  async reviewPayment(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.discriminatedUnion("verified", [
        z.object({ verified: z.literal(true) }),
        z.object({
          verified: z.literal(false),
          reason: z.string().trim().min(3).max(500),
        }),
      ]),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const before = await tx.gvPayment.findFirst({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      if (!before) bad("Pago no encontrado.");
      if (before.rejectedAt) bad("Este pago ya fue rechazado.");
      if (data.verified && before.verified) return before;
      const row = await tx.gvPayment.update({
        where: { id: before.id },
        data: data.verified
          ? { verified: true, verifiedBy: actor.id, verifiedAt: new Date() }
          : {
              rejectedAt: new Date(),
              rejectedBy: actor.id,
              rejectReason: data.reason,
            },
      });
      await audit(
        tx,
        actor,
        data.verified ? "gv_payment_verify" : "gv_payment_reject",
        "gv_payment",
        row.id,
        before,
        row,
      );
      return row;
    });
  }

  // Reportes de GV: ingresos por día, método, banco y empleada; pendientes por
  // curso y por clienta; transferencias por verificar y ocupación.
  @Get("reports")
  @Permit("gv:reports")
  async reports(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    const { from, to } = parse(
      z.object({ from: day.optional(), to: day.optional() }),
      query,
    );
    if (from && to && from > to)
      bad("La fecha inicial no puede ser posterior a la final.");
    const payments = await this.db.gvPayment.findMany({
      where: {
        branchId: actor.branchId,
        rejectedAt: null,
        ...(from || to
          ? {
              date: {
                ...(from ? { gte: dateOnly(from) } : {}),
                ...(to ? { lte: dateOnly(to) } : {}),
              },
            }
          : {}),
      },
      select: {
        date: true,
        amount: true,
        method: true,
        bank: true,
        verified: true,
        createdBy: true,
      },
    });
    const names = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: [...new Set(payments.map((p) => p.createdBy))] } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    const group = (key: (p: (typeof payments)[number]) => string) => {
      const map = new Map<string, { total: Prisma.Decimal; count: number }>();
      for (const p of payments) {
        const k = key(p);
        const row = map.get(k) ?? { total: d(0), count: 0 };
        row.total = row.total.plus(p.amount);
        row.count++;
        map.set(k, row);
      }
      return [...map]
        .map(([k, v]) => ({
          key: k,
          total: v.total.toFixed(2),
          count: v.count,
        }))
        .sort((a, b) => a.key.localeCompare(b.key));
    };
    const total = payments.reduce((s, p) => s.plus(p.amount), d(0));
    const unverified = payments
      .filter((p) => !p.verified)
      .reduce((s, p) => s.plus(p.amount), d(0));
    const courses = await this.courses(actor);
    const open = await this.db.gvEnrollment.findMany({
      where: {
        branchId: actor.branchId,
        status: { notIn: [...CLOSED] },
      },
      include: {
        payments: {
          select: { amount: true, verified: true, rejectedAt: true },
        },
        course: { select: { name: true, date: true } },
      },
      orderBy: { clientName: "asc" },
    });
    return {
      income: {
        total: total.toFixed(2),
        unverified: unverified.toFixed(2),
        byDay: group((p) => dayText(p.date)),
        byMethod: group((p) => p.method),
        byBank: group((p) => p.bank || "Sin banco"),
        byEmployee: group((p) => names.get(p.createdBy) ?? "Otro usuario"),
      },
      courses: courses.map((c) => ({
        id: c.id,
        name: c.name,
        date: c.date,
        capacity: c.capacity,
        enrolled: c.enrolled,
        attended: c.attended,
        brushSets: c.brushSets,
        paid: c.paid,
        pending: c.pending,
        unverified: c.unverified,
      })),
      pendingByClient: open
        .map((e) => ({
          id: e.id,
          clientName: e.clientName,
          phone: e.phone,
          course: e.course.name,
          courseDate: dayText(e.course.date),
          ...gvTotals(e.agreedPrice, e.payments),
        }))
        .filter((e) => d(e.pending).gt(0)),
    };
  }

  @Get("transfers/pending")
  @Permit("gv:read")
  async pendingTransfers(@CurrentUser() actor: Actor) {
    const rows = await this.db.gvPayment.findMany({
      where: { branchId: actor.branchId, verified: false, rejectedAt: null },
      include: {
        enrollment: {
          select: {
            clientName: true,
            course: { select: { id: true, name: true } },
          },
        },
        appointment: { select: { clientName: true, service: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((p) => ({
      ...p,
      date: dayText(p.date),
      amount: p.amount.toFixed(2),
    }));
  }

  // Importación del Excel de GV (sólo administración, «*»). Idempotente: cada
  // elemento trae su clave (externalId, única por sucursal); reimportar
  // actualiza y nunca duplica. ?dryRun=1 valida y cuenta sin escribir. Todo o
  // nada: una transacción.
  @Post("import")
  @Permit("*")
  async import(
    @Body() body: unknown,
    @Query("dryRun") dryRunQuery: string | undefined,
    @CurrentUser() actor: Actor,
  ) {
    const dryRun = dryRunQuery === "1" || dryRunQuery === "true";
    const parsed = importSchema.safeParse(body);
    const errors: string[] = [];
    if (!parsed.success)
      for (const issue of parsed.error.issues.slice(0, 100))
        errors.push(issue.path.join(".") + ": " + issue.message);
    const input = parsed.success
      ? parsed.data
      : {
          courses: [],
          enrollments: [] as z.infer<typeof importSchema>["enrollments"],
        };
    // Claves y referencias se revisan aunque falle algún campo, para dar
    // todos los errores en una sola pasada.
    const keys = parsed.success
      ? parsed.data
      : (importKeys.safeParse(body).data ?? { courses: [], enrollments: [] });
    const branchId = actor.branchId;
    const courseKeys = new Set<string>();
    keys.courses.forEach((c, i) => {
      if (courseKeys.has(c.key))
        errors.push(`courses.${i}.key: clave repetida «${c.key}»`);
      courseKeys.add(c.key);
    });
    const enrollmentKeys = new Set<string>();
    const paymentKeys = new Set<string>();
    const paymentKey = (e: { key: string }, p: { key?: string }, j: number) =>
      p.key ?? `${e.key}#${j + 1}`;
    const knownCourses = new Map(
      (
        await this.db.gvCourse.findMany({
          where: { branchId, externalId: { not: null } },
          select: { id: true, externalId: true },
        })
      ).map((c) => [c.externalId!, c.id]),
    );
    keys.enrollments.forEach((e, i) => {
      if (enrollmentKeys.has(e.key))
        errors.push(`enrollments.${i}.key: clave repetida «${e.key}»`);
      enrollmentKeys.add(e.key);
      if (!courseKeys.has(e.courseKey) && !knownCourses.has(e.courseKey))
        errors.push(
          `enrollments.${i}.courseKey: curso «${e.courseKey}» no existe`,
        );
      e.payments.forEach((p, j) => {
        const key = paymentKey(e, p, j);
        if (paymentKeys.has(key))
          errors.push(
            `enrollments.${i}.payments.${j}.key: clave repetida «${key}»`,
          );
        paymentKeys.add(key);
      });
    });
    const existing = async (
      model: "gvCourse" | "gvEnrollment" | "gvPayment",
      keys: Set<string>,
    ) =>
      new Set<string>(
        (
          await (this.db[model] as any).findMany({
            where: { branchId, externalId: { in: [...keys] } },
            select: { externalId: true },
          })
        ).map((r: any) => r.externalId as string),
      );
    const [oldCourses, oldEnrollments, oldPayments] = await Promise.all([
      existing("gvCourse", courseKeys),
      existing("gvEnrollment", enrollmentKeys),
      existing("gvPayment", paymentKeys),
    ]);
    const count = (keys: Set<string>, old: Set<string>) => ({
      create: [...keys].filter((k) => !old.has(k)).length,
      update: [...keys].filter((k) => old.has(k)).length,
    });
    // Import diferido: gv-citas.ts usa constantes de este archivo.
    const citas = await import("./gv-citas");
    const citasPlan = await citas.planGvCitasImport(
      this.db,
      branchId,
      parsed.success ? parsed.data.appointments : [],
      parsed.success ? parsed.data.leads : [],
      paymentKeys,
      errors,
    );
    const summary = {
      dryRun,
      courses: count(courseKeys, oldCourses),
      enrollments: count(enrollmentKeys, oldEnrollments),
      payments: count(paymentKeys, oldPayments),
      ...citasPlan.counts,
      errors,
    };
    if (dryRun) return summary;
    if (errors.length)
      bad(
        "La importación tiene errores (no se guardó nada): " +
          errors.slice(0, 20).join("; "),
      );
    await this.db.$transaction(
      async (tx) => {
        const courseIds = new Map(knownCourses);
        for (const { key, date, ...c } of input.courses) {
          const row = await tx.gvCourse.upsert({
            where: { branchId_externalId: { branchId, externalId: key } },
            create: {
              ...c,
              date: dateOnly(date),
              externalId: key,
              branchId,
              createdBy: actor.id,
            },
            update: { ...c, date: dateOnly(date) },
          });
          courseIds.set(key, row.id);
        }
        for (const { key, courseKey, payments, ...e } of input.enrollments) {
          const row = await tx.gvEnrollment.upsert({
            where: { branchId_externalId: { branchId, externalId: key } },
            create: {
              ...e,
              courseId: courseIds.get(courseKey)!,
              externalId: key,
              branchId,
              createdBy: actor.id,
            },
            update: { ...e, courseId: courseIds.get(courseKey)! },
          });
          for (const [j, p] of payments.entries()) {
            const { key: _key, verified, date, ...fields } = p;
            void _key;
            const isVerified = verified ?? fields.method !== "transferencia";
            const review = isVerified
              ? { verified: true, verifiedBy: actor.id, verifiedAt: new Date() }
              : { verified: false, verifiedBy: null, verifiedAt: null };
            await tx.gvPayment.upsert({
              where: {
                branchId_externalId: {
                  branchId,
                  externalId: paymentKey({ key }, p, j),
                },
              },
              create: {
                ...fields,
                ...review,
                date: dateOnly(date),
                enrollmentId: row.id,
                externalId: paymentKey({ key }, p, j),
                branchId,
                createdBy: actor.id,
              },
              // La verificación hecha en el sistema no se pisa salvo que el
              // archivo la indique.
              update: {
                ...fields,
                date: dateOnly(date),
                enrollmentId: row.id,
                ...(verified === undefined ? {} : review),
              },
            });
          }
        }
        await citas.applyGvCitasImport(
          tx,
          actor,
          citasPlan.appointments,
          citasPlan.leads,
        );
        await audit(
          tx,
          actor,
          "gv_import",
          "gv_import",
          branchId,
          undefined,
          summary,
        );
      },
      { timeout: 120000, maxWait: 10000 },
    );
    return summary;
  }
}
