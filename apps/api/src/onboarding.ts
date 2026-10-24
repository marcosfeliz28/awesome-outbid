import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { z } from "@fitstore/shared";
import { Actor, CurrentUser, Database, Permit, parse } from "./common";
import { tenantUnique } from "./tenant-context";

const change = z.object({ dismissed: z.boolean() }).strict();

/** El progreso se deduce de los datos reales; sólo se guarda si se ocultó. */
@Controller("onboarding")
export class OnboardingController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get() @Permit("*")
  async status(@CurrentUser() actor: Actor) {
    const settings = await this.db.settings.findUnique({ where: tenantUnique("id", actor.branchId) });
    const data = (settings?.data ?? {}) as Record<string, any>;
    const [categories, products, cashiers, terminals, cashSessions] = await Promise.all([
      this.db.category.count({ where: { branchId: actor.branchId } }),
      this.db.product.count({ where: { branchId: actor.branchId } }),
      this.db.user.count({ where: { branchId: actor.branchId, role: { name: "seller" } } }),
      this.db.terminal.count({ where: { branchId: actor.branchId, revokedAt: null } }),
      this.db.cashSession.count({ where: { branchId: actor.branchId } }),
    ]);
    return {
      available: !!data.onboarding,
      dismissed: data.onboarding?.dismissed === true,
      businessType: data.businessType ?? "general",
      categories, products, cashiers, terminals, cashSessions,
    };
  }

  @Post() @Permit("*")
  async setDismissed(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { dismissed } = parse(change, body);
    return this.db.$transaction(async tx => {
      const current = await tx.settings.findUniqueOrThrow({ where: tenantUnique("id", actor.branchId) });
      const data = current.data as Record<string, any>;
      if (!data.onboarding) return { available: false, dismissed: true };
      await tx.settings.update({ where: tenantUnique("id", actor.branchId), data: {
        data: { ...data, onboarding: { dismissed } },
      } });
      return { available: true, dismissed };
    });
  }
}
