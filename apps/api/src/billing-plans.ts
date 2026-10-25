import { HttpException } from "@nestjs/common";
import { currentTenantId } from "./tenant-context";

export const BILLING_PLANS = {
  autoservicio: { label: "Autoservicio", monthlyDop: 1250, annualDop: 12500, branches: 1, boxes: 1, users: 2, aiQueries: 100 },
  basico: { label: "Básico", monthlyDop: 2000, annualDop: 20000, branches: 1, boxes: 2, users: 3, aiQueries: 250 },
  pro: { label: "Pro", monthlyDop: 4000, annualDop: 40000, branches: 2, boxes: 6, users: 10, aiQueries: 600 },
  premium: { label: "Premium", monthlyDop: 7000, annualDop: 70000, branches: 5, boxes: 20, users: 30, aiQueries: 1500 },
} as const;
export type BillingPlan = keyof typeof BILLING_PLANS;

export function billingPlan(value: string): BillingPlan {
  return Object.prototype.hasOwnProperty.call(BILLING_PLANS, value)
    ? value as BillingPlan
    : "autoservicio";
}

type QuotaDb = {
  user: { count(args: unknown): Promise<number>; findMany(args: unknown): Promise<{ branchId: string }[]> };
  terminal: { count(args: unknown): Promise<number>; findMany(args: unknown): Promise<{ branchId: string }[]> };
  cashSession: { count(args: unknown): Promise<number> };
  $queryRaw: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

/** Must run inside the same transaction as the create/approval it protects. */
export async function enforcePlanQuota(
  tx: QuotaDb,
  resource: "users" | "boxes" | "cashBoxes" | "branches",
  newBranch?: string,
) {
  if (process.env.PRODUCT_TENANCY !== "required") return;
  const tenantId = currentTenantId();
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${tenantId}`}))::text`;
  // Tenant has no tenantId column, so the generic tenant database proxy cannot
  // build a Prisma tenant.findUnique query. PostgreSQL RLS still scopes this read.
  const tenants = await tx.$queryRaw`SELECT plan FROM "Tenant" WHERE id=${tenantId}::uuid` as { plan: string }[];
  if (tenants.length !== 1) throw new HttpException("Empresa no disponible.", 403);
  const plan = BILLING_PLANS[billingPlan(tenants[0].plan)];
  if (resource === "users") {
    const active = await tx.user.count({ where: { tenantId, active: true } });
    if (active >= plan.users) throw new HttpException(`El plan ${plan.label} permite ${plan.users} usuarios activos.`, 409);
  } else if (resource === "boxes") {
    const approved = await tx.terminal.count({ where: { tenantId, approvedAt: { not: null }, revokedAt: null } });
    if (approved >= plan.boxes) throw new HttpException(`El plan ${plan.label} permite ${plan.boxes} equipos aprobados.`, 409);
  } else if (resource === "cashBoxes") {
    // Un equipo puede compartirlo más de un cajero (W6). Limitar sólo
    // Terminal aprobados no limita el número de cajas operando a la vez.
    const open = await tx.cashSession.count({ where: { tenantId, closedAt: null } });
    if (open >= plan.boxes) throw new HttpException(
      `El plan ${plan.label} permite ${plan.boxes} ${plan.boxes === 1 ? "caja abierta" : "cajas abiertas"} simultáneamente.`, 409,
    );
  } else {
    const [users, terminals] = await Promise.all([
      tx.user.findMany({ where: { tenantId, active: true }, select: { branchId: true } }),
      tx.terminal.findMany({ where: { tenantId, revokedAt: null }, select: { branchId: true } }),
    ]);
    const branches = new Set([...users, ...terminals].map(row => row.branchId));
    if (newBranch && !branches.has(newBranch) && branches.size >= plan.branches)
      throw new HttpException(`El plan ${plan.label} permite ${plan.branches} sucursales.`, 409);
  }
}
