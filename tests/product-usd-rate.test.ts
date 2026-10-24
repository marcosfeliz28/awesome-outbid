import { afterEach, expect, it, vi } from "vitest";
import { currentTenantId } from "../apps/api/src/tenant-context";
import { UsdRateWorker } from "../apps/api/src/usd-rate";

const A = "00000000-0000-0000-0000-000000000011";
const B = "00000000-0000-0000-0000-000000000012";
const oldMode = process.env.PRODUCT_TENANCY;

afterEach(() => {
  if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
  else process.env.PRODUCT_TENANCY = oldMode;
  vi.unstubAllGlobals();
});

it("PC-15: una consulta USD actualiza todas las sucursales de las empresas activas sin cruzar datos", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const saved: string[] = [];
  const audit: string[] = [];
  const fetchRate = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { DOP: 63 } }) });
  vi.stubGlobal("fetch", fetchRate);
  const db = {
    activeTenantIds: async () => [A, B],
    settings: {
      findMany: async () => (currentTenantId() === A ? [{ id: "main" }, { id: "norte" }] : [{ id: "main" }]),
      findUnique: async () => null,
    },
    $transaction: async (task: (tx: unknown) => Promise<unknown>) => task({
      settings: {
        findUnique: async () => null,
        upsert: async ({ where, create }: any) => {
          expect(where.tenantId_id.tenantId).toBe(currentTenantId());
          saved.push(`${currentTenantId()}:${create.id}:${create.data.usdRate}`);
        },
      },
      variant: { findMany: async () => [] },
      auditLog: { create: async () => audit.push(currentTenantId()) },
    }),
  };
  await new UsdRateWorker(db as never).run();
  expect(fetchRate).toHaveBeenCalledTimes(1);
  expect(saved).toEqual([`${A}:main:63`, `${A}:norte:63`, `${B}:main:63`]);
  expect(audit).toEqual([A, A, B]);
});
