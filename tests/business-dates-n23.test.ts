import { describe, expect, it } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { tenantScope } from "../apps/api/src/tenant-context";
import { CourierController } from "../apps/api/src/courier";
import { Database } from "../apps/api/src/common";
import { createRequire } from "node:module";
import supertest from "supertest";
import {
  businessTimeZone,
  formatBusinessDateTime,
  formatBusinessDate,
} from "../apps/web/src/businessDates";

describe("N23 · fechas por empresa", () => {
  it("el ajuste leído incluye la zona de la empresa autenticada, no la del dispositivo", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000023";
    const db: any = {
      settings: { findUniqueOrThrow: async () => ({ data: { name: "Casa" } }) },
      $queryRaw: async (query: TemplateStringsArray, actualTenant: string) => {
        expect(query.join("?")).toContain('FROM "Tenant"');
        expect(actualTenant).toBe(tenantId);
        return [{ currency: "DOP", timeZone: "Pacific/Kiritimati" }];
      },
    };
    const controller = new AdminController(db);
    const settings = await tenantScope.run({ tenantId }, () =>
      controller.settings({ branchId: "main" } as any));
    expect(settings.timeZone).toBe("Pacific/Kiritimati");
  });

  it("respeta el límite del día de la empresa en vez del día del navegador", () => {
    const instant = "2026-10-25T10:30:00.000Z";
    expect(formatBusinessDate(instant, "Pacific/Kiritimati")).toBe("26/10/2026");
    expect(formatBusinessDate(instant, "America/Santo_Domingo")).toBe("25/10/2026");
    expect(formatBusinessDateTime(instant, "Pacific/Kiritimati")).toContain("26/10/26");
  });

  it("usa una zona segura si la configuración anterior no trae una zona válida", () => {
    expect(businessTimeZone(undefined)).toBe("America/Santo_Domingo");
    expect(businessTimeZone("zona/inexistente")).toBe("America/Santo_Domingo");
  });

  it("la ruta de envíos filtra el día civil de la empresa, incluido su límite final", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000023";
    let actual: any;
    const db: any = {
      tenant: { findUnique: async ({ where }: any) => {
        expect(where).toEqual({ id: tenantId });
        return { timeZone: "Pacific/Kiritimati" };
      } },
      sale: { findMany: async ({ where }: any) => {
        actual = where.createdAt;
        return [];
      } },
    };
    const controller = new CourierController(db);
    await tenantScope.run({ tenantId }, () => controller.pending(
      { from: "2026-10-26", to: "2026-10-26" },
      { branchId: "main" } as any,
    ));
    expect(actual).toEqual({
      gte: new Date("2026-10-25T10:00:00.000Z"),
      lt: new Date("2026-10-26T10:00:00.000Z"),
    });
  });

  it("el historial conserva el día de 23 horas cuando cambia el horario de verano", async () => {
    let actual: any;
    const db: any = {
      tenant: { findUnique: async () => ({ timeZone: "America/New_York" }) },
      courierPayout: { findMany: async ({ where }: any) => {
        actual = where.createdAt;
        return [];
      } },
    };
    const controller = new CourierController(db);
    await tenantScope.run({ tenantId: "00000000-0000-0000-0000-000000000023" }, () =>
      controller.history({ from: "2026-03-08", to: "2026-03-08" }, { branchId: "main" } as any));
    expect(actual).toEqual({
      gte: new Date("2026-03-08T05:00:00.000Z"),
      lt: new Date("2026-03-09T04:00:00.000Z"),
    });
  });

  it("GET /courier/pending aplica el límite por empresa en una petición HTTP", async () => {
    const tenantId = "00000000-0000-0000-0000-000000000023";
    let actual: any;
    const db: any = {
      tenant: { findUnique: async () => ({ timeZone: "Pacific/Kiritimati" }) },
      sale: { findMany: async ({ where }: any) => {
        actual = where.createdAt;
        return [];
      } },
    };
    class TestModule {}
    const fromApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
    const { Module } = fromApi("@nestjs/common");
    const { NestFactory } = fromApi("@nestjs/core");
    Module({ controllers: [CourierController], providers: [{ provide: Database, useValue: db }] })(TestModule);
    const app = await NestFactory.create(TestModule, { logger: false });
    app.use((req: any, _res: any, next: () => void) => {
      req.actor = { branchId: "main", permissions: ["*"] };
      tenantScope.run({ tenantId }, next);
    });
    try {
      await app.init();
      const res = await supertest(app.getHttpServer())
        .get("/courier/pending?from=2026-10-26&to=2026-10-26");
      expect(res.status).toBe(200);
      expect(actual).toEqual({
        gte: new Date("2026-10-25T10:00:00.000Z"),
        lt: new Date("2026-10-26T10:00:00.000Z"),
      });
      const invalid = await supertest(app.getHttpServer())
        .get("/courier/pending?from=2026-02-30");
      expect(invalid.status).toBe(400);
    } finally {
      await app.close();
    }
  });
});
