import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CASHIER_SURVEY, surveyAnswers } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit } from "./common";
import { currentTenantId, tenantUnique } from "./tenant-context";

// Encuesta de la caja: cada persona ve y edita solo la suya; la administración
// ve el resumen de su empresa (la RLS y tenantId separan empresas).
@Controller("survey")
export class CashierSurveyController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("mine")
  @Permit("sale:write")
  async mine(@CurrentUser() actor: Actor) {
    const row = await this.db.cashierSurvey.findUnique({
      where: tenantUnique("userId", actor.id),
    });
    return { answers: row?.answers ?? null, updatedAt: row?.updatedAt ?? null };
  }

  @Post("mine")
  @Permit("sale:write")
  async save(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const answers = surveyAnswers((body as any)?.answers);
    const row = await this.db.cashierSurvey.upsert({
      where: tenantUnique("userId", actor.id),
      create: {
        id: randomUUID(),
        tenantId: currentTenantId(),
        userId: actor.id,
        branchId: actor.branchId,
        answers,
      },
      update: { answers, branchId: actor.branchId },
    });
    return { answers: row.answers, updatedAt: row.updatedAt };
  }

  @Get("summary")
  @Permit("*")
  async summary(@CurrentUser() actor: Actor) {
    const rows = await this.db.cashierSurvey.findMany({
      where: { branchId: actor.branchId },
      orderBy: { updatedAt: "desc" },
    });
    const users = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: rows.map((r) => r.userId) } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return {
      responses: rows.length,
      questions: CASHIER_SURVEY.map((q) => {
        const values = rows
          .map((r) => ({
            name: users.get(r.userId) ?? "",
            value: (r.answers as Record<string, unknown>)[q.id],
          }))
          .filter((v) => v.value !== undefined && v.value !== "");
        const counts: Record<string, number> = {};
        if (q.kind !== "text")
          for (const v of values)
            counts[String(v.value)] = (counts[String(v.value)] ?? 0) + 1;
        return {
          id: q.id,
          text: q.text,
          kind: q.kind,
          answered: values.length,
          counts,
          average:
            q.kind === "scale" && values.length
              ? Math.round(
                  (values.reduce((a, v) => a + Number(v.value), 0) /
                    values.length) *
                    10,
                ) / 10
              : null,
          texts:
            q.kind === "text"
              ? values.map((v) => ({ name: v.name, text: String(v.value) }))
              : [],
        };
      }),
    };
  }
}
