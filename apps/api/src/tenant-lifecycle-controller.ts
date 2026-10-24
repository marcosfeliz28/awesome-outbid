import { Controller, Get, Inject } from "@nestjs/common";
import { Actor, CurrentUser, Permit } from "./common";
import { TenantLifecycleService } from "./tenant-lifecycle";

@Controller("tenant")
export class TenantLifecycleController {
  constructor(@Inject(TenantLifecycleService) private readonly lifecycle: TenantLifecycleService) {}
  @Permit("authenticated") @Get("status")
  status(@CurrentUser() actor: Actor) { return this.lifecycle.statusForTenant(actor.tenantId); }
}
