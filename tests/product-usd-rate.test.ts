import { afterEach, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { businessDate } from "../packages/shared/src/index";
import { AlertsController } from "../apps/api/src/alerts";
import { currentTenantId, tenantScope } from "../apps/api/src/tenant-context";
import {
  applyUsdRate,
  confirmBlockedUsdRate,
  UsdRateWorker,
} from "../apps/api/src/usd-rate";

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

function rateFixture(initialRate = 100) {
  let data: any = { usdRate: initialRate };
  const update = vi.fn().mockResolvedValue({ count: 1 });
  const alerts: any[] = [];
  const actions: string[] = [];
  const tx = {
    $queryRaw: async () => [{ locked: "" }],
    settings: {
      findUnique: async () => ({ data }),
      upsert: async ({ create, update: next }: any) => {
        data = (next ?? create).data;
      },
    },
    variant: {
      findMany: async () => [
        {
          id: `v-${currentTenantId()}`,
          price: initialRate * 10,
          costAvg: 400,
          attributes: { usd: 10 },
        },
      ],
      updateMany: update,
    },
    alert: {
      upsert: vi.fn(async (input: any) => alerts.push(input)),
    },
    auditLog: {
      create: async ({ data: row }: any) => actions.push(row.action),
    },
  };
  const db = {
    $transaction: async (task: any) => task(tx),
    settings: { findUnique: async () => ({ data }) },
  };
  return {
    db,
    data: () => data,
    update,
    alerts,
    actions,
  };
}

it("CPC-10: un salto de 4 % se aplica sin alerta", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 104, "QA", "2026-10-25"),
  );
  expect(result).toMatchObject({ blocked: false, changed: 1 });
  expect(fixture.data()).toMatchObject({
    usdRate: 104,
    usdRateDate: "2026-10-25",
  });
  expect(fixture.alerts).toHaveLength(0);
});

it("CPC-10: un salto de 10 % se aplica y crea una alerta media", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 110, "QA", "2026-10-25"),
  );
  expect(result).toMatchObject({ blocked: false, changed: 1 });
  expect(fixture.data().usdRate).toBe(110);
  expect(fixture.update).toHaveBeenCalledOnce();
  expect(fixture.alerts[0].create).toMatchObject({
    tenantId: A,
    type: "usd_rate_change",
    severity: "medium",
    branchId: "main",
  });
  expect(fixture.alerts[0].create.message).toMatch(/10[,.]00 %.*aplicó/i);
});

it("CPC-10: un salto de 25 % exacto se aplica y alerta", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 125, "QA", "2026-10-25"),
  );
  expect(result).toMatchObject({ blocked: false, changed: 1 });
  expect(fixture.data().usdRate).toBe(125);
  expect(fixture.alerts[0].create.severity).toBe("medium");
});

it("CPC-10: un salto de 30 % no cambia tasa ni precios y crea alerta alta", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 130, "QA", "2026-10-25"),
  );
  expect(result).toMatchObject({ blocked: true, changed: 0 });
  expect(fixture.update).not.toHaveBeenCalled();
  expect(fixture.data().usdRate).toBe(100);
  expect(fixture.data().usdRateDate).toBeUndefined();
  expect(fixture.data().usdRateBlocked).toMatchObject({
    rate: 130,
    previousRate: 100,
    day: "2026-10-25",
    source: "QA",
  });
  expect(fixture.alerts[0].create).toMatchObject({
    tenantId: A,
    type: "usd_rate_change",
    severity: "high",
  });
  expect(fixture.alerts[0].create.message).toMatch(
    /30[,.]00 %.*no se aplicaron.*mañana/i,
  );
  expect(fixture.actions).toEqual(["usd_rate_blocked"]);
});

it("CPC-10: un salto negativo mayor de 25 % se retiene igual", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  const result = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 70, "QA", "2026-10-25"),
  );
  expect(result).toMatchObject({ blocked: true, changed: 0 });
  expect(fixture.data().usdRate).toBe(100);
  expect(fixture.update).not.toHaveBeenCalled();
  expect(fixture.alerts[0].create.severity).toBe("high");
});

it("CPC-10: administración confirma la propuesta guardada, sin tasa ni fuente del cliente", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 130, "fuente-servidor", "2026-10-25"),
  );
  const confirmed = await tenantScope.run({ tenantId: A }, () =>
    confirmBlockedUsdRate(fixture.db, "main", "dueña"),
  );
  expect(confirmed).toMatchObject({ blocked: false, changed: 1 });
  expect(fixture.data().usdRate).toBe(130);
  expect(fixture.data().usdRateBlocked).toBeUndefined();
  expect(fixture.alerts[1].update).toMatchObject({
    severity: "high",
    status: "resolved",
  });
});

it("CPC-10: relee la fecha bajo el candado y no repite tasa, alerta ni bitácora", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const fixture = rateFixture();
  await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 110, "QA", "2026-10-25"),
  );
  const repeated = await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(fixture.db, "main", 120, "QA", "2026-10-25"),
  );
  expect(repeated).toMatchObject({ skipped: true, changed: 0 });
  expect(fixture.data().usdRate).toBe(110);
  expect(fixture.update).toHaveBeenCalledTimes(1);
  expect(fixture.alerts).toHaveLength(1);
  expect(fixture.actions).toEqual(["usd_rate_updated"]);
});

it("CPC-10: un bloqueo no se reintenta el mismo día y sí al día siguiente", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const today = businessDate();
  const applied: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rates: { DOP: 110 } }),
    }),
  );
  const db = {
    activeTenantIds: async () => [A],
    settings: {
      findMany: async () => [
        { id: "bloqueada-hoy", data: { usdRateBlocked: { day: today } } },
        {
          id: "bloqueada-ayer",
          data: { usdRateBlocked: { day: "1900-01-01" } },
        },
      ],
    },
    $transaction: async (task: any) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => ({ data: { usdRate: 100 } }),
          upsert: async ({ create }: any) => applied.push(create.id),
        },
        variant: { findMany: async () => [] },
        alert: { upsert: async () => undefined },
        auditLog: { create: async () => undefined },
      }),
  };
  await new UsdRateWorker(db as never).run();
  expect(applied).toEqual(["bloqueada-ayer"]);
});

it("CPC-10: alertas, bloqueos y precios quedan aislados por empresa", async () => {
  process.env.PRODUCT_TENANCY = "required";
  const alerts: any[] = [];
  const prices: string[] = [];
  const settings = new Map([
    [A, { usdRate: 100 }],
    [B, { usdRate: 100 }],
  ]);
  const db = {
    $transaction: async (task: any) =>
      task({
        $queryRaw: async () => [{ locked: "" }],
        settings: {
          findUnique: async () => ({ data: settings.get(currentTenantId()) }),
          upsert: async ({ where, update }: any) => {
            expect(where.tenantId_id.tenantId).toBe(currentTenantId());
            settings.set(currentTenantId(), update.data);
          },
        },
        variant: {
          findMany: async () => [
            { id: "misma-variante", price: 1000, costAvg: 400, attributes: { usd: 10 } },
          ],
          updateMany: async ({ where }: any) => {
            expect(where.tenantId).toBe(currentTenantId());
            prices.push(currentTenantId());
            return { count: 1 };
          },
        },
        alert: {
          upsert: async (input: any) => {
            expect(input.where.tenantId_key.tenantId).toBe(currentTenantId());
            expect(input.create.tenantId).toBe(currentTenantId());
            alerts.push(input.create);
          },
        },
        auditLog: { create: async () => undefined },
      }),
  };
  await tenantScope.run({ tenantId: A }, () =>
    applyUsdRate(db, "main", 110, "QA", "2026-10-25"),
  );
  await tenantScope.run({ tenantId: B }, () =>
    applyUsdRate(db, "main", 130, "QA", "2026-10-25"),
  );
  expect(prices).toEqual([A]);
  expect(alerts.map((row) => [row.tenantId, row.severity])).toEqual([
    [A, "medium"],
    [B, "high"],
  ]);
  expect(settings.get(A)?.usdRate).toBe(110);
  expect(settings.get(B)?.usdRate).toBe(100);
});

it("CPC-10: usd_rate_change solo puede verse o modificarse con permiso *", async () => {
  const listWhere: any[] = [];
  const stateWhere: any[] = [];
  const db = {
    alert: {
      findMany: async ({ where }: any) => {
        listWhere.push(where);
        return [];
      },
      findFirstOrThrow: async ({ where }: any) => {
        stateWhere.push(where);
        throw new Error("oculta");
      },
    },
  };
  const controller = new AlertsController(db as never, {
    evaluate: async () => [],
  } as never);
  const manager = { branchId: "main", permissions: ["alerts:write"] } as any;
  const owner = { branchId: "main", permissions: ["*"] } as any;
  await controller.alerts(manager, {});
  await controller.alerts(owner, {});
  await expect(
    controller.state(
      "00000000-0000-4000-8000-000000000099",
      { status: "seen" },
      manager,
    ),
  ).rejects.toThrow("oculta");
  expect(listWhere[0].AND[0].type.notIn).toContain("usd_rate_change");
  expect(listWhere[1].AND).toBeUndefined();
  expect(stateWhere[0].type.notIn).toContain("usd_rate_change");
});

it("CPC-10: no queda el flujo muerto de confirmación humana", async () => {
  const sources = await Promise.all(
    [
      "apps/api/src/usd-rate.ts",
      "apps/api/src/admin.ts",
      "apps/web/src/Management.tsx",
    ].map((path) => readFile(path, "utf8")),
  );
  expect(sources[1] + sources[2]).not.toContain("usdRatePending");
  expect(sources[0].match(/usdRatePending/g)).toHaveLength(1);
  expect(sources.join("\n")).not.toMatch(
    /confirmación humana|próxima comprobación automática/,
  );
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
