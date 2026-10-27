// Módulo GV Makeup Studio (docs/coordinacion/MODULO-GV.md): cursos,
// inscripciones y cobros. Es un registro de seguimiento: no crea ventas de la
// caja ni comprobantes fiscales (los productos de los cursos se venden en la
// caja normal de Macgen). Reglas de dinero en gv-money.ts.
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
import { can, d, z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  denied,
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
  dateOnly,
  dayText,
  gvDay as day,
  gvImportPayment,
  gvPaymentInput,
  gvRefundFields,
  gvTotals,
  gvUserNames,
  lockGvOwner,
  planGvImportPayments,
} from "./gv-money";

export { GV_CONCEPTS, GV_METHODS, gvTotals } from "./gv-money";
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

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);
const price = gvMoney(true);

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
// Ocupan cupo las inscritas que no cancelaron ni pasaron a personalizado.
const OCCUPIES = new Set(["activa", "no_asistio"]);

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
        ...gvRefundFields,
        payments: z.array(gvImportPayment).max(50).default([]),
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
            refundAmount: true,
            payments: {
              select: { amount: true, verified: true, rejectedAt: true },
            },
          },
        },
      },
      orderBy: [{ date: "desc" }, { name: "asc" }],
    });
    return rows.map(({ enrollments, ...course }) => {
      const totals = enrollments.map((e) =>
        gvTotals(e.agreedPrice, e.payments, e),
      );
      const sum = (key: "paid" | "pending" | "unverified" | "refunded") =>
        totals.reduce((s, t) => s.plus(t[key]), d(0)).toFixed(2);
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
        refunded: sum("refunded"),
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
    const name = await gvUserNames(
      this.db,
      enrollments.flatMap((e) => [
        e.createdBy,
        ...e.payments.flatMap((p) => [
          p.createdBy,
          p.verifiedBy ?? "",
          p.rejectedBy ?? "",
        ]),
      ]),
    );
    return {
      ...course,
      date: dayText(course.date),
      price: course.price.toFixed(2),
      enrollments: enrollments.map(({ payments, ...e }) => ({
        ...e,
        createdBy: undefined,
        agreedPrice: e.agreedPrice.toFixed(2),
        refundAmount: e.refundAmount?.toFixed(2) ?? null,
        refundDate: e.refundDate ? dayText(e.refundDate) : null,
        createdByName: name(e.createdBy),
        ...gvTotals(e.agreedPrice, payments, e),
        payments: payments.map((p) => paymentView(p, name)),
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
    if (GV_CLOSED.has(data.status))
      bad("Una inscripción nueva no puede empezar cancelada o reembolsada.");
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
      z
        .object({ courseId: uuid, ...enrollmentFields, ...gvRefundFields })
        .partial(),
      body,
    );
    // partial(): lo que no llega queda undefined (sin los valores por defecto
    // del alta) y Prisma no lo cambia.
    if (data.courseId) await this.course(actor, data.courseId);
    const enrollmentId = parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      const locked = await lockGvOwner(
        tx,
        "enrollment",
        enrollmentId,
        actor.branchId,
      );
      const { payments: _p, ...before } = locked;
      void _p;
      const row = await tx.gvEnrollment.update({
        where: { id: before.id },
        data: checkGvOwnerEdit("enrollment", locked, data) as any,
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
      gvPaymentInput({ operationId: uuid, enrollmentId: uuid }),
      body,
    );
    return this.db.$transaction((tx) =>
      createGvPayment(tx, actor, "enrollment", enrollmentId, operationId, data),
    );
  }

  // Verificar o rechazar una transferencia (GV-05/06): sólo gv:verify
  // (administración y gerencia), nunca quien la registró salvo «*», una sola
  // vez y con la fila bloqueada. Rechazada deja de contar.
  @Post("payments/:id/review")
  @Permit("gv:verify")
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
    const paymentId = parse(uuid, id);
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "GvPayment" WHERE id = ${paymentId}::uuid AND "branchId" = ${actor.branchId} FOR UPDATE`;
      const before = await tx.gvPayment.findFirst({
        where: { id: paymentId, branchId: actor.branchId },
      });
      if (!before) bad("Pago no encontrado.");
      if (before.method !== "transferencia")
        bad("Sólo las transferencias se verifican o rechazan.");
      // Una inscripción o cita reembolsada queda cerrada: ni verificar ni
      // rechazar sus pagos cambia lo ya devuelto.
      const owner = before.enrollmentId
        ? await tx.gvEnrollment.findUnique({
            where: { id: before.enrollmentId },
          })
        : await tx.gvAppointment.findUnique({
            where: { id: before.appointmentId! },
          });
      if (owner?.status === "reembolsada")
        bad("Está reembolsada: sus pagos ya no se verifican ni rechazan.");
      if (before.createdBy === actor.id && !can(actor.permissions, "*"))
        denied("No puedes verificar un pago que registraste tú.");
      if (before.rejectedAt) {
        if (!data.verified) return before; // repetir el rechazo: igual.
        bad("Esta transferencia ya fue rechazada.");
      }
      if (before.verified) {
        if (data.verified) return before; // repetir la verificación: igual.
        bad("Esta transferencia ya fue verificada.");
      }
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

  // Reportes de GV: ingresos verificados por día, método, banco y empleada
  // (menos reembolsos); pendientes por curso, clienta y cita; ocupación.
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
    const range =
      from || to
        ? {
            ...(from ? { gte: dateOnly(from) } : {}),
            ...(to ? { lte: dateOnly(to) } : {}),
          }
        : undefined;
    const payments = await this.db.gvPayment.findMany({
      where: {
        branchId: actor.branchId,
        rejectedAt: null,
        ...(range ? { date: range } : {}),
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
    const verified = payments.filter((p) => p.verified);
    const name = await gvUserNames(
      this.db,
      verified.map((p) => p.createdBy),
    );
    const group = (key: (p: (typeof payments)[number]) => string) => {
      const map = new Map<string, { total: Prisma.Decimal; count: number }>();
      for (const p of verified) {
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
    const total = verified.reduce((s, p) => s.plus(p.amount), d(0));
    const unverified = payments
      .filter((p) => !p.verified)
      .reduce((s, p) => s.plus(p.amount), d(0));
    const refundWhere = {
      branchId: actor.branchId,
      refundAmount: { not: null },
      ...(range ? { refundDate: range } : {}),
    };
    const [refundE, refundA] = await Promise.all([
      this.db.gvEnrollment.aggregate({
        where: refundWhere,
        _sum: { refundAmount: true },
      }),
      this.db.gvAppointment.aggregate({
        where: refundWhere,
        _sum: { refundAmount: true },
      }),
    ]);
    const refunds = d(refundE._sum.refundAmount ?? 0).plus(
      refundA._sum.refundAmount ?? 0,
    );
    const courses = await this.courses(actor);
    const select = {
      payments: { select: { amount: true, verified: true, rejectedAt: true } },
    };
    const [openEnrollments, openAppointments] = await Promise.all([
      this.db.gvEnrollment.findMany({
        where: { branchId: actor.branchId, status: { notIn: [...GV_CLOSED] } },
        include: { ...select, course: { select: { name: true, date: true } } },
        orderBy: { clientName: "asc" },
      }),
      this.db.gvAppointment.findMany({
        where: { branchId: actor.branchId, status: { notIn: [...GV_CLOSED] } },
        include: select,
        orderBy: { clientName: "asc" },
      }),
    ]);
    return {
      income: {
        // Sólo lo verificado (efectivo y tarjeta lo están al registrarse).
        total: total.toFixed(2),
        unverified: unverified.toFixed(2),
        refunds: refunds.toFixed(2),
        net: total.minus(refunds).toFixed(2),
        byDay: group((p) => dayText(p.date)),
        byMethod: group((p) => p.method),
        byBank: group((p) => p.bank || "Sin banco"),
        byEmployee: group((p) => name(p.createdBy) ?? "Gerencia"),
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
      pendingByClient: [
        ...openEnrollments.map((e) => ({
          id: e.id,
          kind: "curso" as const,
          clientName: e.clientName,
          phone: e.phone,
          course: e.course.name,
          courseDate: dayText(e.course.date),
          ...gvTotals(e.agreedPrice, e.payments, e),
        })),
        ...openAppointments.map((a) => ({
          id: a.id,
          kind: "cita" as const,
          clientName: a.clientName,
          phone: a.phone,
          course: "Cita · " + a.service,
          courseDate: a.date.toISOString().slice(0, 10),
          ...gvTotals(a.total, a.payments, a),
        })),
      ].filter((e) => d(e.pending).gt(0)),
    };
  }

  @Get("transfers/pending")
  @Permit("gv:read")
  async pendingTransfers(@CurrentUser() actor: Actor) {
    const rows = await this.db.gvPayment.findMany({
      where: {
        branchId: actor.branchId,
        method: "transferencia",
        verified: false,
        rejectedAt: null,
      },
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
    const name = await gvUserNames(
      this.db,
      rows.map((p) => p.createdBy),
    );
    return rows.map((p) => paymentView(p, name));
  }

  // Importación del Excel de GV (sólo administración, «*»). Idempotente: cada
  // elemento y cada pago traen su clave (externalId, única por sucursal);
  // reimportar actualiza y nunca duplica. ?dryRun=1 valida y cuenta sin
  // escribir. Todo o nada: una transacción, una importación a la vez.
  @Post("import")
  @Permit("*")
  async import(
    @Body() body: unknown,
    @Query("dryRun") dryRunQuery: unknown,
    @CurrentUser() actor: Actor,
  ) {
    // Un dryRun mal escrito (TRUE, yes, repetido…) nunca importa de verdad.
    if (
      dryRunQuery !== undefined &&
      !["0", "1", "true", "false"].includes(dryRunQuery as string)
    )
      bad("dryRun debe ser 0, 1, true o false (una sola vez).");
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
    // Todo dentro de una transacción con el candado de la sucursal tomado
    // ANTES de planear: lo que se valida es lo que se escribe.
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"gv-import:" + branchId}))`;
        const courseKeys = new Set<string>();
        keys.courses.forEach((c, i) => {
          if (courseKeys.has(c.key))
            errors.push(`courses.${i}.key: clave repetida «${c.key}»`);
          courseKeys.add(c.key);
        });
        const enrollmentKeys = new Set<string>();
        const paymentKeys = new Set<string>();
        const knownCourses = new Map(
          (
            await tx.gvCourse.findMany({
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
            if (!p.key) return; // el esquema ya lo reporta
            if (paymentKeys.has(p.key))
              errors.push(
                `enrollments.${i}.payments.${j}.key: clave repetida «${p.key}»`,
              );
            paymentKeys.add(p.key);
          });
        });
        const existingPayments = await planGvImportPayments(
          tx,
          branchId,
          input.enrollments.map((e, i) => ({
            kind: "enrollment" as const,
            key: e.key,
            path: `enrollments.${i}`,
            total: e.agreedPrice,
            status: e.status,
            refundAmount: e.refundAmount,
            refundDate: e.refundDate,
            payments: e.payments,
          })),
          errors,
        );
        const existing = async (
          model: "gvCourse" | "gvEnrollment",
          keys: Set<string>,
        ) =>
          new Set<string>(
            (
              await (tx[model] as any).findMany({
                where: { branchId, externalId: { in: [...keys] } },
                select: { externalId: true },
              })
            ).map((r: any) => r.externalId as string),
          );
        const [oldCourses, oldEnrollments] = await Promise.all([
          existing("gvCourse", courseKeys),
          existing("gvEnrollment", enrollmentKeys),
        ]);
        const count = (
          keys: Set<string>,
          old: { has(k: string): boolean },
        ) => ({
          create: [...keys].filter((k) => !old.has(k)).length,
          update: [...keys].filter((k) => old.has(k)).length,
        });
        // Import diferido: gv-citas.ts usa constantes de este archivo.
        const citas = await import("./gv-citas");
        const citasPlan = await citas.planGvCitasImport(
          tx,
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
          payments: count(paymentKeys, existingPayments),
          ...citasPlan.counts,
          errors,
        };
        if (dryRun) return summary;
        if (errors.length)
          bad(
            "La importación tiene errores (no se guardó nada): " +
              errors.slice(0, 20).join("; "),
          );
        const courseIds = new Map(knownCourses);
        for (const { key, date, ...c } of input.courses) {
          const row = await gvImportUpsert(
            tx,
            actor,
            "gvCourse",
            "gv_course",
            key,
            {
              where: { branchId_externalId: { branchId, externalId: key } },
              create: {
                ...c,
                date: dateOnly(date),
                externalId: key,
                branchId,
                createdBy: actor.id,
              },
              update: { ...c, date: dateOnly(date) },
            },
          );
          courseIds.set(key, row.id);
        }
        for (const {
          key,
          courseKey,
          payments,
          refundDate,
          ...e
        } of input.enrollments) {
          const fields = {
            ...e,
            refundDate: refundDate ? dateOnly(refundDate) : null,
            courseId: courseIds.get(courseKey)!,
          };
          const row = await gvImportUpsert(
            tx,
            actor,
            "gvEnrollment",
            "gv_enrollment",
            key,
            {
              where: { branchId_externalId: { branchId, externalId: key } },
              create: {
                ...fields,
                externalId: key,
                branchId,
                createdBy: actor.id,
              },
              update: fields,
            },
          );
          for (const p of payments)
            await applyGvImportPayment(
              tx,
              actor,
              "enrollment",
              row.id,
              p,
              existingPayments.get(p.key),
            );
        }
        await citas.applyGvCitasImport(
          tx,
          actor,
          citasPlan.appointments,
          citasPlan.leads,
          citasPlan.existingPayments,
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
        return summary;
      },
      { timeout: 120000, maxWait: 10000 },
    );
  }
}

export function paymentView(
  p: any,
  name: (id: string | null | undefined) => string | null,
) {
  const { createdBy, verifiedBy, rejectedBy, ...rest } = p;
  return {
    ...rest,
    date: dayText(p.date),
    amount: p.amount.toFixed(2),
    createdByName: name(createdBy),
    verifiedByName: name(verifiedBy),
    rejectedByName: name(rejectedBy),
  };
}
