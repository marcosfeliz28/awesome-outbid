import { afterEach, expect, it } from "vitest";
import { BILLING_PLANS, enforcePlanQuota } from "../apps/api/src/billing-plans";
import { tenantScope } from "../apps/api/src/tenant-context";

const previous = process.env.PRODUCT_TENANCY;
afterEach(() => {
  if (previous === undefined) delete process.env.PRODUCT_TENANCY;
  else process.env.PRODUCT_TENANCY = previous;
});

it("tiene los cuatro precios y límites mensuales acordados", () => {
  expect(Object.fromEntries(Object.entries(BILLING_PLANS).map(([key, value]) =>
    [key, [value.monthlyDop, value.branches, value.boxes, value.users, value.aiQueries]])))
    .toEqual({
      autoservicio: [1250, 1, 1, 2, 100],
      basico: [2000, 1, 2, 3, 250],
      pro: [4000, 2, 6, 10, 600],
      premium: [7000, 5, 20, 30, 1500],
    });
});

it("impide aprobar más equipos y crear más usuarios que el plan, pero no bloquea la tienda original", async () => {
  const fake = {
    $queryRaw: async (strings: TemplateStringsArray) => strings[0].startsWith("SELECT plan") ? [{ plan: "autoservicio" }] : [],
    user: { count: async () => 2, findMany: async () => [{ branchId: "main" }] },
    terminal: { count: async () => 1, findMany: async () => [{ branchId: "main" }] },
  };
  process.env.PRODUCT_TENANCY = "required";
  await tenantScope.run({ tenantId: "00000000-0000-0000-0000-000000000002" }, async () => {
    await expect(enforcePlanQuota(fake as any, "users")).rejects.toMatchObject({ status: 409 });
    await expect(enforcePlanQuota(fake as any, "boxes")).rejects.toMatchObject({ status: 409 });
    await expect(enforcePlanQuota(fake as any, "branches", "segunda")).rejects.toMatchObject({ status: 409 });
    await expect(enforcePlanQuota(fake as any, "branches", "main")).resolves.toBeUndefined();
  });
  delete process.env.PRODUCT_TENANCY;
  await expect(enforcePlanQuota(fake as any, "boxes")).resolves.toBeUndefined();
});
