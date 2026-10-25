import { afterEach, expect, it, vi } from "vitest";
import { currentTenantId, tenantScope } from "../apps/api/src/tenant-context";
import { applyUsdRate, usdPrice, UsdRateWorker } from "../apps/api/src/usd-rate";
import { Database } from "../apps/api/src/common";
import { AdminController } from "../apps/api/src/admin";
import { AlertsController } from "../apps/api/src/alerts";

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
  const alerts: string[] = [];
  const fetchRate = vi
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { DOP: 63 } }),
    });
  vi.stubGlobal("fetch", fetchRate);
  const db = {
    activeTenantIds: async () => [A, B],
    user: { findMany: async () => [{ branchId: "main" }] },
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
          findUnique: async ({ where }: any) => {
            const branchId = where.tenantId_id.id;
            const rate =
              currentTenantId() === A && branchId === "main"
                ? 62
                : currentTenantId() === A
                  ? 58
                  : 70;
            return { data: { usdRate: rate } };
          },
          upsert: async ({ where, create }: any) => {
            expect(where.tenantId_id.tenantId).toBe(currentTenantId());
            saved.push(
              `${currentTenantId()}:${create.id}:${create.data.usdRate}`,
            );
          },
        },
        variant: { findMany: async () => [] },
        alert: {
          upsert: async ({ where, create }: any) => {
            expect(where.tenantId_key.tenantId).toBe(currentTenantId());
            alerts.push(`${currentTenantId()}:${create.key}`);
          },
        },
        auditLog: { create: async () => audit.push(currentTenantId()) },
      }),
  };
  await new UsdRateWorker(db as never).run();
  expect(fetchRate).toHaveBeenCalledTimes(1);
  expect(saved).toEqual([`${A}:main:63`, `${A}:norte:63`, `${B}:main:63`]);
  expect(alerts).toHaveLength(2);
  expect(alerts[0]).toMatch(
    new RegExp(`^${A}:usd-rate-change:norte:\\d{4}-\\d{2}-\\d{2}$`),
  );
  expect(alerts[1]).toMatch(
    new RegExp(`^${B}:usd-rate-change:main:\\d{4}-\\d{2}-\\d{2}$`),
  );
  expect(audit).toEqual([A, A, B]);
});

it("PC-15: un salto mayor de 5 % actualiza la tasa y deja un aviso para la dueña", async () => {
  process.env.PRODUCT_TENANCY = "required";
  let data: any = { usdRate: 63 };
  const update = vi.fn().mockResolvedValue({ count: 1 });
  const actions: string[] = [];
  let alert: any;
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
    alert: {
      upsert: async ({ create }: any) => {
        alert = create;
      },
    },
  };
  const db = { $transaction: async (task: any) => task(tx) };

  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(db, "main", 67, "QA", "2026-10-24"),
  );
  expect(result).toMatchObject({
    applied: true,
    changed: 1,
    largeChange: true,
  });
  expect(update).toHaveBeenCalledOnce();
  expect(data.usdRate).toBe(67);
  expect(data.usdRateHeld).toBeUndefined();
  expect(actions).toEqual(["usd_rate_updated"]);
  expect(alert).toMatchObject({
    key: "usd-rate-change:main:2026-10-24",
    type: "usd_rate_change",
    severity: "medium",
    entityId: "main",
    branchId: "main",
  });
  expect(alert.message).toContain("63");
  expect(alert.message).toContain("67");
});

// CPC-10: <5 % en silencio; 5–25 % se aplica con aviso; >25 % se retiene
// con aviso alto y no cambia precios hasta que «*» lo confirme.
function rateTx(before: number) {
  const state: any = { data: { usdRate: before }, alerts: [], audits: [], updates: 0 };
  state.tx = {
    $queryRaw: async () => [{ locked: "" }],
    settings: {
      findUnique: async () => ({ data: state.data }),
      upsert: async ({ update }: any) => { state.data = update.data; },
    },
    variant: {
      findMany: async () => [{ id: "v1", price: before * 10, costAvg: 100, attributes: { usd: 10 } }],
      updateMany: async () => { state.updates++; return { count: 1 }; },
    },
    alert: { upsert: async ({ create, update }: any) => state.alerts.push({ create, update }) },
    auditLog: { create: async ({ data }: any) => state.audits.push(data) },
  };
  state.db = { $transaction: async (task: any) => task(state.tx) };
  return state;
}

it.each([
  { label: "4 %", next: 62.4, applied: true, alert: null },
  { label: "10 %", next: 66, applied: true, alert: "medium" },
  { label: "30 %", next: 78, applied: false, alert: "high" },
])("CPC-10: un salto de $label", async ({ next, applied, alert }) => {
  const state = rateTx(60);
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(state.db, "main", next, "QA", "2026-10-25"),
  );
  expect(result.applied).toBe(applied);
  expect(state.data.usdRate).toBe(applied ? next : 60);
  expect(state.updates).toBe(applied ? 1 : 0);
  expect(state.audits).toHaveLength(applied ? 1 : 0);
  expect(state.alerts.map((row: any) => row.create.severity)).toEqual(alert ? [alert] : []);
  // El reintento de cada 3 horas no reabre un aviso ya visto.
  for (const row of state.alerts) expect(row.update.status).toBeUndefined();
  if (!applied) {
    expect(state.data.usdRateHeld).toMatchObject({ rate: next, before: 60, day: "2026-10-25" });
    expect(state.alerts[0].create.type).toBe("usd_rate_change");
    expect(state.alerts[0].create.message).toMatch(/NO se aplicó/);
  } else expect(state.data.usdRateHeld).toBeUndefined();
});

it("CPC-10: la tasa retenida solo se aplica al confirmarla", async () => {
  const state = rateTx(60);
  await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(state.db, "main", 400, "QA", "2026-10-25"),
  );
  expect(state.data.usdRate).toBe(60);
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(state.db, "main", 400, "QA", "2026-10-25", { userId: "duena", confirmed: true }),
  );
  expect(result.applied).toBe(true);
  expect(state.data.usdRate).toBe(400);
  expect(state.data.usdRateHeld).toBeUndefined();
  expect(state.audits[0]).toMatchObject({ userId: "duena", after: expect.objectContaining({ confirmed: true }) });
  expect(Reflect.getMetadata("permission", AdminController.prototype.confirmUsdRate)).toBe("*");
});

it("CPC-10: los avisos del dólar solo los ve quien tiene «*»", async () => {
  const wheres: any[] = [];
  const db = { alert: { findMany: async ({ where }: any) => { wheres.push(where); return []; } } };
  const controller = new AlertsController(db as never, { evaluate: async () => undefined } as never);
  const base = { id: "u", branchId: "main", tenantId: A, name: "x", email: "x", role: "manager", ip: "", terminalId: null } as any;
  await controller.alerts({ ...base, permissions: ["alerts:write"] }, {});
  await controller.alerts({ ...base, permissions: ["*"] }, {});
  expect(JSON.stringify(wheres[0])).toContain("usd_rate_change");
  expect(JSON.stringify(wheres[1])).not.toContain("usd_rate_change");
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
    user: { findMany: async () => [{ branchId: "main" }] },
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

it("CPC-8: una sucursal con usuarios pero sin fila en Settings también recibe la tasa", async () => {
  process.env.PRODUCT_TENANCY = "required";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ rates: { DOP: 63 } }) }));
  const saved: string[] = [];
  const db = {
    activeTenantIds: async () => [A],
    settings: { findMany: async () => [{ id: "main", data: {} }] },
    user: { findMany: async () => [{ branchId: "main" }, { branchId: "sur" }] },
    $transaction: async (task: any) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => null,
          upsert: async ({ create }: any) => saved.push(create.id),
        },
        variant: { findMany: async () => [] },
        alert: { upsert: async () => undefined },
        auditLog: { create: async () => undefined },
      }),
  };
  await new UsdRateWorker(db as never).run();
  expect(saved.sort()).toEqual(["main", "sur"]);
});

it("CPC-8: el precio en dólares redondea al centavo sin errores de coma flotante", () => {
  // 0.31 x 63.5 = 19.685 -> 19.69 (antes 19.68); 0.04 x 61.125 = 2.445 -> 2.45.
  expect(usdPrice(0.31, 63.5)).toBe(19.69);
  expect(usdPrice(0.04, 61.125)).toBe(2.45);
  expect(usdPrice(200, 63)).toBe(12600);
});

it("CPC-8: una prueba vencida fuera de gracia ya no cuenta como empresa activa", async () => {
  const now = Date.now();
  const rows = [
    { id: A, status: "trial", trialEndsAt: new Date(now + 86400000), paidThroughAt: null, pastDueAt: null },
    { id: B, status: "trial", trialEndsAt: new Date(now - 30 * 86400000), paidThroughAt: null, pastDueAt: null },
  ];
  const fake = { tenant: { findMany: async () => rows } };
  expect(await Database.prototype.activeTenantIds.call(fake as never)).toEqual([A]);
});
