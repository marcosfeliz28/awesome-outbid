import { Controller, Get, Inject } from "@nestjs/common";
import { Actor, CurrentUser, Database, Permit } from "./common";

/** Contacto de soporte para el botón «Ayuda»: solo lo público del servidor. */
export function supportInfo(env: NodeJS.ProcessEnv = process.env) {
  const whatsapp = env.SUPPORT_WHATSAPP?.replace(/\D/g, "") ?? "";
  return {
    whatsapp: whatsapp || null,
    email: env.SUPPORT_EMAIL?.trim() || null,
    hours: env.SUPPORT_HOURS?.trim() || null,
  };
}

@Controller("support-info")
export class SupportController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Permit("authenticated")
  @Get()
  async get(@CurrentUser() actor: Actor) {
    // RLS: la empresa solo ve su propia fila.
    const [company] = (await this.db.$queryRaw`
      SELECT name, slug FROM "Tenant" WHERE id = ${actor.tenantId}::uuid`) as {
      name: string;
      slug: string;
    }[];
    return { ...supportInfo(), company: company ?? null };
  }
}
