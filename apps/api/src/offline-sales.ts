import { Body, Controller, Inject, Post } from "@nestjs/common";
import { z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  RequireTerminal,
  audit,
  parse,
} from "./common";

const resolution = z.object({
  offlineUuid: z.string().uuid(),
  action: z.enum(["reprice", "discard"]),
  previousTotal: z.number().nonnegative().max(100000000),
  currentTotal: z.number().nonnegative().max(100000000).optional(),
  reason: z.string().trim().min(3).max(300),
});

@Controller()
export class OfflineSalesController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Post("sales/offline-resolution")
  @Permit("sale:write")
  @RequireTerminal()
  async record(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(resolution, body);
    await audit(
      this.db,
      actor,
      data.action === "discard"
        ? "offline_sale_discarded"
        : "offline_sale_repriced",
      "offline_sale",
      data.offlineUuid,
      { total: data.previousTotal },
      {
        ...(data.currentTotal === undefined
          ? {}
          : { total: data.currentTotal }),
        reason: data.reason,
      },
    );
    return { ok: true };
  }
}
