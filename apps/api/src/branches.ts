import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { z } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  conflict,
  isSupportAccount,
  parse,
  sameName,
  uuid,
} from "./common";
import { BILLING_PLANS, billingPlan } from "./billing-plans";
import { currentTenantId, tenantUnique } from "./tenant-context";

// Sucursales (orden de la dueña, 19-nov). Diseño: docs/coordinacion/SUCURSALES_19NOV.md.
// Toda la operación ya se filtra por actor.branchId (= User.branchId); aquí sólo
// se registran sucursales y se mueve gente entre ellas.

const branchId = z.string().regex(/^[a-z0-9-]{1,40}$/, "Sucursal no válida.");
const branchName = z.string().trim().min(2).max(60);

/** Número de documento por sucursal. 'main' conserva el formato de siempre
 * (FS-0000001); las demás llevan su código para no chocar con la principal,
 * porque Sale.number y SaleReturn.number son únicos por empresa. */
export function branchDocumentNumber(
  prefix: string,
  branch: string,
  value: number,
  width: number,
) {
  return `${prefix}-${branch === "main" ? "" : branch.toUpperCase() + "-"}${String(value).padStart(width, "0")}`;
}

/** Código corto para una sucursal nueva: s2, s3… el primero libre. */
export function nextBranchId(existing: string[]) {
  const used = new Set(existing);
  let n = 2;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

// Ajustes de la principal que NO se copian: estado de la guía de inicio y una
// tasa del dólar retenida pendiente de aprobar en la principal.
const NOT_COPIED = ["onboarding", "usdRateHeld"];

@Controller("branches")
export class BranchesController {
  constructor(@Inject(Database) private readonly db: Database) {}

  // Mismo candado que enforcePlanQuota: altas de usuarios, equipos y
  // sucursales de una empresa no se cruzan.
  private async assertBranchQuota(tx: any) {
    if (process.env.PRODUCT_TENANCY !== "required") return;
    const tenantId = currentTenantId();
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${tenantId}`}))::text`;
    const tenants =
      (await tx.$queryRaw`SELECT plan FROM "Tenant" WHERE id=${tenantId}::uuid`) as {
        plan: string;
      }[];
    if (tenants.length !== 1)
      throw new HttpException("Empresa no disponible.", 403);
    const plan = BILLING_PLANS[billingPlan(tenants[0].plan)];
    const active = await tx.branch.count({ where: { active: true } });
    if (active >= plan.branches)
      conflict(
        `El plan ${plan.label} permite ${plan.branches} ${plan.branches === 1 ? "sucursal" : "sucursales"}. Desactiva una o cambia de plan en «Plan y facturación».`,
      );
  }

  // Empresas creadas sin ajustes (o antes del alta con trigger) igual tienen principal.
  private ensureMain(tx: any) {
    return tx.$executeRaw`INSERT INTO "Branch" ("tenantId", id, name, "updatedAt") VALUES (${currentTenantId()}::uuid, 'main', 'Principal', now()) ON CONFLICT DO NOTHING`;
  }

  @Get()
  @Permit("*")
  async list(@CurrentUser() actor: Actor) {
    const [branches, users] = await Promise.all([
      this.db.branch.findMany({ orderBy: { createdAt: "asc" } }),
      this.db.user.findMany({
        where: { active: true },
        select: {
          id: true,
          name: true,
          email: true,
          branchId: true,
          role: { select: { name: true } },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    const rows = branches.some((b) => b.id === "main")
      ? branches
      : [{ id: "main", name: "Principal", active: true }, ...branches];
    const staff = users.filter((u) => !isSupportAccount(u));
    return rows.map((b) => ({
      id: b.id,
      name: b.name,
      active: b.active,
      current: b.id === actor.branchId,
      users: staff
        .filter((u) => u.branchId === b.id)
        .map((u) => ({ id: u.id, name: u.name, role: u.role.name })),
    }));
  }

  @Post()
  @Permit("*")
  async create(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const input = parse(z.object({ name: branchName }), body);
    return this.db.$transaction(async (tx) => {
      await this.ensureMain(tx);
      await this.assertBranchQuota(tx);
      const existing = await tx.branch.findMany({
        select: { id: true, name: true },
      });
      if (sameName(existing, input.name))
        conflict(`Ya existe la sucursal «${input.name}».`);
      const id = nextBranchId(existing.map((b) => b.id));
      const row = await tx.branch.create({
        data: { tenantId: currentTenantId(), id, name: input.name },
      });
      const main = await tx.settings.findUnique({
        where: tenantUnique("id", "main"),
      });
      const data = Object.fromEntries(
        Object.entries((main?.data ?? {}) as Record<string, unknown>).filter(
          ([key]) => !NOT_COPIED.includes(key),
        ),
      );
      // JSON plano: la copia de la principal ya es un objeto serializable.
      await tx.settings.create({ data: { id, data: data as any } });
      await tx.warehouse.create({
        data: { branchId: id, name: "Tienda", kind: "store", sellable: true },
      });
      await audit(tx, actor, "branch_create", "branch", id, undefined, {
        name: row.name,
      });
      return { id: row.id, name: row.name, active: row.active };
    });
  }

  @Patch(":id")
  @Permit("*")
  async update(
    @Param("id") raw: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const id = parse(branchId, raw);
    const input = parse(
      z.object({ name: branchName.optional(), active: z.boolean().optional() }),
      body,
    );
    if (input.name === undefined && input.active === undefined)
      bad("Indica el nombre o el estado.");
    return this.db.$transaction(async (tx) => {
      await this.ensureMain(tx);
      const before = await tx.branch.findUnique({
        where: tenantUnique("id", id),
      });
      if (!before) throw new HttpException("Sucursal no encontrada.", 404);
      if (input.name !== undefined) {
        const others = await tx.branch.findMany({
          where: { id: { not: id } },
          select: { name: true },
        });
        if (sameName(others, input.name))
          conflict(`Ya existe la sucursal «${input.name}».`);
      }
      if (input.active === false && before.active) {
        if (id === "main") conflict("La sucursal principal no se desactiva.");
        if (id === actor.branchId)
          conflict("Cámbiate a otra sucursal antes de desactivar esta.");
        const people = await tx.user.findMany({
          where: { branchId: id, active: true },
          include: { role: true },
        });
        if (people.some((u) => !isSupportAccount(u)))
          conflict("Mueve primero a las personas de esta sucursal a otra.");
        if (
          await tx.cashSession.count({
            where: { branchId: id, closedAt: null },
          })
        )
          conflict("Esta sucursal tiene una caja abierta; ciérrala antes.");
      }
      if (input.active === true && !before.active)
        await this.assertBranchQuota(tx);
      const row = await tx.branch.update({
        where: tenantUnique("id", id),
        data: input,
      });
      await audit(
        tx,
        actor,
        "branch_update",
        "branch",
        id,
        { name: before.name, active: before.active },
        { name: row.name, active: row.active },
      );
      return { id: row.id, name: row.name, active: row.active };
    });
  }

  /** Asigna una persona a la sucursal. Con su propio id, la administradora se
   * cambia de sucursal para ver y operar la otra (el selector). */
  @Post(":id/users")
  @Permit("*")
  async assign(
    @Param("id") raw: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const id = parse(branchId, raw);
    const { userId } = parse(z.object({ userId: uuid }), body);
    const self = userId === actor.id;
    // El equipo registrado pertenece a una sucursal: la sesión no lo puede seguir.
    if (self && actor.terminalId)
      conflict(
        "Este equipo está registrado en tu sucursal actual. Cambia de sucursal desde un navegador sin equipo registrado.",
      );
    return this.db.$transaction(async (tx) => {
      await this.ensureMain(tx);
      const branch = await tx.branch.findUnique({
        where: tenantUnique("id", id),
      });
      if (!branch) throw new HttpException("Sucursal no encontrada.", 404);
      if (!branch.active) conflict("La sucursal está desactivada.");
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { role: true },
      });
      if (!user) throw new HttpException("Usuario no encontrado.", 404);
      if (isSupportAccount(user))
        bad("La cuenta de soporte se maneja solo en «Soporte de Norexos».");
      if (user.branchId === id) return { userId, branchId: id };
      if (await tx.cashSession.count({ where: { userId, closedAt: null } }))
        conflict(
          `${user.name} tiene una caja abierta; ciérrala antes de cambiarla de sucursal.`,
        );
      if (user.cashierNumber) {
        const used = await tx.user.findFirst({
          where: {
            branchId: id,
            active: true,
            cashierNumber: user.cashierNumber,
          },
        });
        if (used)
          conflict(
            `El número de cajero ${user.cashierNumber} ya lo tiene ${used.name} en esa sucursal.`,
          );
      }
      // A otra persona se le cierran las sesiones: entra de nuevo ya en su sucursal.
      await tx.user.update({
        where: { id: userId },
        data: {
          branchId: id,
          ...(self ? {} : { authVersion: { increment: 1 } }),
        },
      });
      await audit(
        tx,
        actor,
        "branch_assign_user",
        "user",
        userId,
        { branchId: user.branchId },
        { branchId: id },
      );
      return { userId, branchId: id };
    });
  }
}
