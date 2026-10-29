import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Actor, CurrentUser, Database, Permit, audit, parse } from "./common";
import { changeRequestInput } from "./change-request-input";
import { currentTenantId } from "./tenant-context";

// «Pedir un cambio»: cualquier persona de la empresa escribe una solicitud y ve las suyas;
// la administración ve las de su empresa (la RLS separa empresas).
@Controller("change-requests")
export class ChangeRequestsController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Post()
  @Permit("authenticated")
  async create(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const input = parse(changeRequestInput, body);
    return this.db.$transaction(async (tx) => {
      const row = await tx.changeRequest.create({
        data: {
          id: randomUUID(),
          tenantId: currentTenantId(),
          userId: actor.id,
          ...input,
        },
      });
      await audit(
        tx,
        actor,
        "change_request_create",
        "change_request",
        row.id,
        undefined,
        row,
      );
      return row;
    });
  }

  @Get()
  @Permit("authenticated")
  async list(@CurrentUser() actor: Actor) {
    const admin = actor.permissions.includes("*");
    return this.db.changeRequest.findMany({
      where: admin ? {} : { userId: actor.id },
      orderBy: { createdAt: "desc" },
    });
  }
}
