import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { ApiExceptionFilter, Database } from "../apps/api/src/common";
import { CatalogController } from "../apps/api/src/catalog";
import { InventoryController } from "../apps/api/src/inventory";
import { SalesController } from "../apps/api/src/sales";
import { ReportsController } from "../apps/api/src/reports";
import { CashController } from "../apps/api/src/cash";
import { FormalReportController } from "../apps/api/src/formal-report";
import { IncomeReportController } from "../apps/api/src/income-report";
import { IncentivesController } from "../apps/api/src/incentives";
import { InventoryImportController } from "../apps/api/src/inventory-import";
import {
  DriveBackupController,
  DriveBackupService,
} from "../apps/api/src/drive-backup";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("reflect-metadata");
const { Module, HttpException } = requireApi("@nestjs/common");
const { NestFactory } = requireApi("@nestjs/core");
const ID = "c84ed8d8-fb39-4577-a324-7d5cf8ee8142";
const actor = { id: ID, role: "admin", branchId: "main", permissions: ["*"] };
let app: any;
const calls: string[] = [];
const db: any = new Proxy(
  {},
  {
    get: (_, model) =>
      model === "$transaction"
        ? async (fn: any) => fn(db)
        : new Proxy(
            {},
            {
              get: (_, method) => async () => {
                calls.push(String(model) + "." + String(method));
                if (["count", "updateMany"].includes(String(method))) return 0;
                if (["aggregate", "groupBy"].includes(String(method)))
                  return { _sum: {}, _count: {} };
                return String(method) === "findMany" ? [] : null;
              },
            },
          ),
  },
);

// Los controladores y el filtro son los de producción; la base sólo registra
// accesos. Se aísla validación, y autorización se prueba en el bloque 1.
const driveCallback = vi.fn(async () => "connected");
class InputTestModule {}
Module({
  controllers: [
    CatalogController,
    InventoryController,
    SalesController,
    CashController,
    FormalReportController,
    IncomeReportController,
    ReportsController,
    InventoryImportController,
    IncentivesController,
    DriveBackupController,
  ],
  providers: [
    { provide: Database, useValue: db },
    { provide: DriveBackupService, useValue: { callback: driveCallback } },
  ],
})(InputTestModule);

beforeAll(async () => {
  app = await NestFactory.create(InputTestModule, { logger: false });
  app.use((req: any, _res: any, next: () => void) => {
    req.actor = actor;
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
});
afterAll(async () => {
  await app?.close();
});

describe("3ag · entradas HTTP reales antes de acceder a datos", () => {
  for (const url of [
    "/products?page=1.5",
    "/products?limit=2&limit=3",
    "/products?role=admin",
    "/inventory/movements?variantId=" + ID + "&role=admin",
    "/goods-receipts?from=2026-02-31",
    "/goods-receipts?role=admin",
    "/dashboard/summary?from=2026-02-31",
    "/dashboard/summary?role=admin",
    "/dashboard/year?year=2026&role=admin",
    "/dashboard/breakdown?role=admin",
    "/reports/sales?format=html",
    "/reports/sales?page=1.5",
    "/reports/sales?role=admin",
    "/reports/sales?method=desconocido",
    "/reports/no-existe",
    "/cash-sessions/" + ID + "/reports/venta-diaria-usuario?role=admin",
    "/reports/formal?period=day&date=2026-10-17&role=admin",
    "/reports/income-by-day?from=2026-10-01&to=2026-10-17&page=2.5",
    "/credit-accounts?sort=desconocido",
    "/credit-accounts?search=x&search=y",
    "/credit-accounts?role=admin",
    "/cod/pending?state=desconocido",
    "/cod/pending?role=admin",
    "/credit-notes?role=admin",
    "/void-requests?role=admin",
    "/incentives/receipt.pdf?month=2026-10&userId=" + ID + "&role=admin",
  ])
    it(url + " → 400 sin consultar ni escribir", async () => {
      calls.length = 0;
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const reply = await request(app.getHttpServer()).get(url);
        expect(reply.status, JSON.stringify(reply.body)).toBe(400);
        expect(reply.body.message).toContain("Revisa los campos:");
        expect(calls).toEqual([]);
      } finally {
        quiet.mockRestore();
      }
    });

  it("body: rechaza campos extra y permite el campo declarado", async () => {
    calls.length = 0;
    const invalid = await request(app.getHttpServer())
      .post("/brands")
      .send({ name: "Nexora", role: "admin" });
    expect(invalid.status).toBe(400);
    expect(calls).toEqual([]);
    const valid = await request(app.getHttpServer())
      .post("/brands")
      .send({ name: "Nexora" });
    expect(valid.status).toBe(201);
    expect(calls).toEqual(["brand.create"]);
  });

  it("multipart: rechaza campos extra y booleanos ambiguos antes de leer el XLSX", async () => {
    calls.length = 0;
    for (const fields of [
      { updatePrices: "quizás" },
      { updateStock: "true", role: "admin" },
    ]) {
      let req = request(app.getHttpServer()).post("/inventory-import/preview");
      for (const [key, value] of Object.entries(fields))
        req = req.field(key, value);
      const reply = await req;
      expect(reply.status, JSON.stringify(reply.body)).toBe(400);
      expect(reply.body.message).toContain("Revisa los campos:");
    }
    expect(calls).toEqual([]);
  });

  it("multipart completo: cinco campos y archivo llegan al lector del inventario", async () => {
    calls.length = 0;
    const reader = vi
      .spyOn(InventoryImportController.prototype as any, "read")
      .mockRejectedValue(
        new HttpException("El lector recibió el archivo de prueba.", 422),
      );
    try {
      const reply = await request(app.getHttpServer())
        .post("/inventory-import/apply")
        .attach("file", Buffer.alloc(256 * 1024, 65), "inventario.xlsx")
        .field("updatePrices", "true")
        .field("updateStock", "true")
        .field("withoutLots", "false")
        .field("hash", "a".repeat(64))
        .field("state", "b".repeat(64));
      expect(reply.status, JSON.stringify(reply.body)).toBe(422);
      expect(reply.body.message).toBe(
        "El lector recibió el archivo de prueba.",
      );
      expect(reader).toHaveBeenCalledTimes(1);
      expect(calls).toEqual([]);
    } finally {
      reader.mockRestore();
    }
  });

  it("Casa vista previa rechaza texto extra antes de leer el archivo o consultar datos", async () => {
    calls.length = 0;
    const reader = vi
      .spyOn(InventoryImportController.prototype as any, "read")
      .mockRejectedValue(
        new HttpException("El lector recibió el archivo de prueba.", 422),
      );
    try {
      const reply = await request(app.getHttpServer())
        .post("/inventory-import/casa/preview")
        .field("role", "admin")
        .attach("file", Buffer.from("archivo de prueba"), "inventario.xlsx");
      expect(reply.status, JSON.stringify(reply.body)).toBe(400);
      expect(reader).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    } finally {
      reader.mockRestore();
    }
  });

  it("Casa vista previa con sólo un archivo conserva el acceso al lector", async () => {
    const reader = vi
      .spyOn(InventoryImportController.prototype as any, "read")
      .mockRejectedValue(
        new HttpException("El lector recibió el archivo de prueba.", 422),
      );
    try {
      const reply = await request(app.getHttpServer())
        .post("/inventory-import/casa/preview")
        .attach("file", Buffer.from("archivo de prueba"), "inventario.xlsx");
      expect(reply.status, JSON.stringify(reply.body)).toBe(422);
      expect(reply.body.message).toBe(
        "El lector recibió el archivo de prueba.",
      );
      expect(reader).toHaveBeenCalledTimes(1);
    } finally {
      reader.mockRestore();
    }
  });

  it("query válida conserva el paginado y filtro de sucursal del catálogo", async () => {
    calls.length = 0;
    const reply = await request(app.getHttpServer()).get(
      "/products?page=2&limit=25&q=vestido&active=true",
    );
    expect(reply.status).toBe(200);
    expect(reply.body).toMatchObject({ page: 2, limit: 25 });
    expect(calls).toEqual(["product.findMany", "product.count"]);
  });
  it("sync rechaza campos extra por venta y conserva las demás ventas del lote", async () => {
    const complete = vi
      .spyOn(SalesController.prototype as any, "complete")
      .mockImplementation(async (_actor: any, sale: any) => ({
        id: sale.offlineUuid,
      }));
    const sale = {
      offlineUuid: ID,
      cashSessionId: ID,
      items: [{ variantId: ID, qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
    };
    try {
      const reply = await request(app.getHttpServer())
        .post("/sales/sync")
        .send({
          sales: [
            { ...sale, items: [{ variantId: ID, qty: 1, price: 0 }] },
            { ...sale, offlineUuid: "364c67f4-5d3a-471e-b91f-3d1bf46dbf99" },
          ],
        });
      expect(reply.status, JSON.stringify(reply.body)).toBe(201);
      expect(reply.body.results.map((result: any) => result.status)).toEqual([
        "conflict",
        "synced",
      ]);
      expect(complete).toHaveBeenCalledTimes(1);
    } finally {
      complete.mockRestore();
    }
  });
  it("OAuth acepta los campos acotados del callback de Google sin perder state ni code", async () => {
    driveCallback.mockClear();
    const query = {
      state: "estado-firmado-de-prueba",
      code: "codigo-de-prueba",
      scope: "https://www.googleapis.com/auth/drive.file",
      authuser: "0",
      prompt: "consent",
    };
    const reply = await request(app.getHttpServer())
      .get("/backups/google/callback")
      .query(query);
    expect(reply.status).toBe(302);
    expect(reply.headers.location).toMatch(/\?drive=connected#settings$/);
    expect(driveCallback).toHaveBeenCalledExactlyOnceWith(query, undefined);
  });

  it("OAuth rechaza parámetros desconocidos antes de resolver state, canjear code o acceder a datos", async () => {
    driveCallback.mockClear();
    calls.length = 0;
    const quiet = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const reply = await request(app.getHttpServer())
        .get("/backups/google/callback")
        .query({
          state: "estado-firmado",
          code: "codigo-de-prueba",
          role: "admin",
        });
      expect(reply.status).toBe(302);
      expect(reply.headers.location).toMatch(/\?drive=error#settings$/);
      expect(driveCallback).not.toHaveBeenCalled();
      expect(calls).toEqual([]);
    } finally {
      quiet.mockRestore();
    }
  });
});
