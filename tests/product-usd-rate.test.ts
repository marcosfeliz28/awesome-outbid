import { afterEach, expect, it, vi } from "vitest";
import { currentTenantId, tenantScope } from "../apps/api/src/tenant-context";
import { applyUsdRate, UsdRateWorker } from "../apps/api/src/usd-rate";

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
  const fetchRate = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { DOP: 63 } }),
    });
  vi.stubGlobal("fetch", fetchRate);
  const db = {
    activeTenantIds: async () => [A, B],
    settings: {
      findMany: async () =>
        currentTenantId() === A
          ? [{ id: "main" }, { id: "norte" }]
          : [{ id: "main" }],
      findUnique: async () => null,
    },
    $transaction: async (task: (tx: unknown) => Promise<unknown>) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => null,
          upsert: async ({ where, create }: any) => {
            expect(where.tenantId_id.tenantId).toBe(currentTenantId());
            saved.push(
              `${currentTenantId()}:${create.id}:${create.data.usdRate}`,
            );
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

it("PC-15: retiene un salto mayor de 5 % hasta confirmación y no cambia precios", async () => {
  process.env.PRODUCT_TENANCY = "required";
  let data: any = { usdRate: 63 };
  const update = vi.fn().mockResolvedValue({ count: 1 });
  const actions: string[] = [];
  const tx = {
    $queryRaw: async () => [{ locked: "" }],
    settings: {
      findUnique: async () => ({ data }),
      upsert: async ({ update: next }: any) => {
        data = next.data;
      },
    },
    variant: {
      findMany: async () => [
        { id: "v1", price: 630, costAvg: 400, attributes: { usd: 10 } },
      ],
      updateMany: update,
    },
    auditLog: {
      create: async ({ data: row }: any) => actions.push(row.action),
    },
  };
  const db = { $transaction: async (task: any) => task(tx) };

  const held = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(db, "main", 400, "QA", "2026-10-24"),
  );
  expect(held).toMatchObject({ confirmationRequired: true, changed: 0 });
  expect(update).not.toHaveBeenCalled();
  expect(data.usdRate).toBe(63);
  expect(data.usdRatePending.rate).toBe(400);

  const confirmed = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(db, "main", 400, "QA", "2026-10-24", {
      confirmed: true,
      userId: "dueña",
    }),
  );
  expect(confirmed.confirmationRequired).toBe(false);
  expect(update).toHaveBeenCalledOnce();
  expect(data.usdRate).toBe(400);
  expect(data.usdRatePending).toBeUndefined();
  expect(actions).toEqual([
    "usd_rate_confirmation_required",
    "usd_rate_updated",
  ]);
});

it("PC-15: avisa y audita si el precio nuevo queda bajo 15 % de margen", async () => {
  process.env.PRODUCT_TENANCY = "required";
  let saved: any;
  let audit: any;
  const db = {
    $transaction: async (task: any) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => ({ data: { usdRate: 62 } }),
          upsert: async ({ update }: any) => {
            saved = update.data;
          },
        },
        variant: {
          findMany: async () => [
            { id: "bajo", price: 620, costAvg: 560, attributes: { usd: 10 } },
          ],
          updateMany: async () => ({ count: 1 }),
        },
        auditLog: { create: async ({ data }: any) => (audit = data) },
      }),
  };
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(db, "main", 60, "QA", "2026-10-24"),
  );
  expect(result.lowMargin).toHaveLength(1);
  expect(result.lowMargin[0].margin).toBeCloseTo((600 - 560) / 600);
  expect(saved.usdRateLowMargin.count).toBe(1);
  expect(audit.after.lowMargin).toHaveLength(1);
});

it("PC-15: un fallo de una empresa no impide actualizar la siguiente", async () => {
  process.env.PRODUCT_TENANCY = "required";
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { DOP: 63 } }),
    }),
  );
  const saved: string[] = [];
  const db = {
    activeTenantIds: async () => [A, B],
    settings: {
      findMany: async () => {
        if (currentTenantId() === A) throw new Error("empresa A no disponible");
        return [{ id: "main", data: {} }];
      },
    },
    $transaction: async (task: any) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => null,
          upsert: async () => saved.push(currentTenantId()),
        },
        variant: { findMany: async () => [] },
        auditLog: { create: async () => undefined },
      }),
  };
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  await new UsdRateWorker(db as never).run();
  expect(saved).toEqual([B]);
  expect(warn).toHaveBeenCalledWith(expect.stringContaining(`empresa ${A}`));
  warn.mockRestore();
});
