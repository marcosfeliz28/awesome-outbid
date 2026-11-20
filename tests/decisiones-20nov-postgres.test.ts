import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { businessDate, saleSchema } from "../packages/shared/src/index";
import { SalesController } from "../apps/api/src/sales";
import { CashController } from "../apps/api/src/cash";
import { GvController } from "../apps/api/src/gv";
import { GvCajaController } from "../apps/api/src/gv-caja";
import { GV_CATALOGO } from "../apps/api/src/gv-money";
import { OWNER_ONLY_ALERT_TYPES } from "../apps/api/src/alerts";

// Decisiones de la dueña del 20-nov-2026 (1 a 4 y la caja cerrada), contra
// PostgreSQL real. Cada caso dice qué pasaba antes y qué pasa ahora.
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const bcrypt = requireApi("bcryptjs");
requireApi("reflect-metadata");
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const DB_NAME = "nexora_decisiones_20nov";
const port = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      server.close(() =>
        typeof a === "object" && a ? done(a.port) : fail(new Error("No port")),
      );
    });
  });
let database: any, db: any, dataDir: string;
let sales: SalesController, cash: CashController;
let gv: GvController, gvCaja: GvCajaController;
let owner: any, manager: any, cashier: any, gvCashier: any;
let customerId: string;
let category: string;
const MANAGER_PIN = "246813";

const n = (v: unknown) => Number(v);
const message = async (p: Promise<unknown>) => {
  try {
    await p;
    return "";
  } catch (e: any) {
    return String(e?.response?.message ?? e?.message ?? e);
  }
};
async function person(name: string, permissions: string[], pin = "135791") {
  const role = await db.role.create({
    data: { name: name + " " + randomUUID(), permissions },
  });
  const user = await db.user.create({
    data: {
      name,
      email: `qa-${randomUUID()}@example.invalid`,
      passwordHash: "x",
      pinHash: await bcrypt.hash(pin, 4),
      roleId: role.id,
    },
  });
  return {
    id: user.id,
    name,
    email: user.email,
    role: name,
    permissions,
    branchId: "main",
  };
}
async function setSettings(data: Record<string, unknown>) {
  const current = await db.settings.findUnique({ where: { id: "main" } });
  const merged = { ...((current?.data as any) ?? {}), ...data };
  await db.settings.upsert({
    where: { id: "main" },
    create: { id: "main", data: merged },
    update: { data: merged },
  });
}
async function variant(cost: number, price: number, name = "Producto") {
  const product = await db.product.create({
    data: {
      name: name + " " + randomUUID().slice(0, 6),
      sku: "P-" + randomUUID(),
      categoryId: category,
    },
  });
  return (
    await db.variant.create({
      data: {
        productId: product.id,
        sku: "V-" + randomUUID(),
        barcode: "B-" + randomUUID(),
        costAvg: cost,
        price,
        stock: 50,
      },
    })
  ).id as string;
}
async function openCash(userId: string, openedAt = new Date()) {
  // Una caja abierta por persona: la anterior de la prueba queda cerrada.
  await db.cashSession.updateMany({
    where: { userId, closedAt: null },
    data: { closedAt: new Date() },
  });
  return (
    await db.cashSession.create({
      data: { userId, registerId: "terminal-1", openingAmount: 0, openedAt },
    })
  ).id as string;
}
const saleInput = (
  cashSessionId: string,
  variantId: string,
  total: number,
  extra: Record<string, unknown> = {},
) =>
  saleSchema.parse({
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId,
    items: [{ variantId, qty: 1, ...((extra.item as object) ?? {}) }],
    payments: [{ method: "cash", amount: total, tendered: total }],
    ...Object.fromEntries(
      Object.entries(extra).filter(([key]) => key !== "item"),
    ),
  });

beforeAll(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "nexora-decisiones-"));
  let url = process.env.NEXORA_TEST_PG_URL;
  if (url) {
    const admin = new PrismaClient({ datasources: { db: { url } } });
    await admin.$executeRawUnsafe(
      `DROP DATABASE IF EXISTS "${DB_NAME}" WITH (FORCE)`,
    );
    await admin.$executeRawUnsafe(`CREATE DATABASE "${DB_NAME}"`);
    await admin.$disconnect();
    const target = new URL(url);
    target.pathname = "/" + DB_NAME;
    url = target.toString();
  } else {
    const p = await port();
    database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port: p,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase(DB_NAME);
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/${DB_NAME}`;
  }
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps/api/prisma/schema.prisma"),
    ],
    { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  owner = await person("Dueña prueba", ["*"]);
  manager = await person(
    "Gerente prueba",
    ["sale:write", "sale:manage", "cash:write", "profit:read", "alerts:write"],
    MANAGER_PIN,
  );
  cashier = await person("Cajera prueba", ["sale:write", "cash:write"]);
  gvCashier = await person("Cajera GV prueba", [
    "gv:read",
    "gv:write",
    "gv:reports",
  ]);
  await setSettings({ allowOfflineSales: true, taxIncluded: true });
  customerId = (await db.customer.create({ data: { name: "Clienta 20nov" } }))
    .id;
  category = (
    await db.category.create({ data: { name: "Suplementos " + randomUUID() } })
  ).id;
  sales = new SalesController(db as any);
  cash = new CashController(db as any);
  gv = new GvController(db as any);
  gvCaja = new GvCajaController(db as any);
}, 240_000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  await rm(dataDir, { recursive: true, force: true });
});

describe("Decisión 1 · venta sin conexión sincronizada con productos sin costo", () => {
  it("entra (no se pierde) y deja aviso propio para gerencia y el reporte de ventas sin costo", async () => {
    // ANTES: con «No vender sin costo» apagado (lo normal hoy) entraba sin
    // aviso ni bitácora. AHORA: aviso `offline_zero_cost_sale` (lo ve
    // gerencia, no solo la dueña) y fila en el reporte de costos pendientes.
    const sid = await openCash(cashier.id, new Date(Date.now() - 3600_000));
    const noCost = await variant(0, 500, "Brochas");
    const input = saleInput(sid, noCost, 500, {
      capturedAt: new Date(Date.now() - 600_000).toISOString(),
    });
    const result = await sales.sync({ sales: [input] }, cashier);
    expect(result.results[0].status).toBe("synced");
    const sale = await db.sale.findUniqueOrThrow({
      where: { offlineUuid: input.offlineUuid },
    });
    expect(n(sale.total)).toBe(500);
    const alert = await db.alert.findUniqueOrThrow({
      where: { key: "zero-cost-sale:" + sale.id },
    });
    expect(alert).toMatchObject({
      type: "offline_zero_cost_sale",
      status: "new",
      severity: "high",
    });
    expect(alert.message).toContain(sale.number);
    expect(alert.message).toContain("Cajera prueba");
    expect(OWNER_ONLY_ALERT_TYPES).not.toContain("offline_zero_cost_sale");
    expect(
      await db.auditLog.count({
        where: { action: "sale_zero_cost_accepted", entityId: sale.id },
      }),
    ).toBe(1);
    const report: any = await sales.costRecalc({}, manager);
    expect(report.pendingNoCost.map((r: any) => r.number)).toContain(
      sale.number,
    );
    // Un aviso viejo `zero_cost_sale` (solo de la dueña) no le sale a gerencia.
    await db.alert.update({
      where: { key: "zero-cost-sale:" + sale.id },
      data: { type: "zero_cost_sale" },
    });
    expect(
      ((await sales.costRecalc({}, manager)) as any).pendingNoCost,
    ).toEqual([]);
    expect(
      ((await sales.costRecalc({}, owner)) as any).pendingNoCost.map(
        (r: any) => r.number,
      ),
    ).toContain(sale.number);
    await db.alert.update({
      where: { key: "zero-cost-sale:" + sale.id },
      data: { type: "offline_zero_cost_sale" },
    });
  });

  it("en línea (POST /sales) con el bloqueo encendido sigue rechazándose", async () => {
    await setSettings({ blockZeroCostSales: true });
    try {
      const sid = await openCash(cashier.id);
      const noCost = await variant(0, 300, "Sin costo");
      expect(
        await message(sales.complete(cashier, saleInput(sid, noCost, 300))),
      ).toMatch(/no tiene costo/);
    } finally {
      await setSettings({ blockZeroCostSales: false });
    }
  });
});

describe("Decisión 4 · descuento de cajera bajo el 15 % de margen", () => {
  it("se cobra normal, sin PIN ni cambio de precio, y avisa a dueña y gerencia con el detalle", async () => {
    // ANTES: sin aviso. Precio RD$ 100, costo RD$ 90, 10 % de descuento:
    // se cobran RD$ 90 → margen (90 − 90) ÷ 90 = 0 % < 15 %.
    const sid = await openCash(cashier.id);
    const v = await variant(90, 100, "Faja");
    const sale: any = await sales.complete(
      cashier,
      saleInput(sid, v, 90, {
        item: { discountPercent: 10 },
        discountReason: "Clienta frecuente",
      }),
    );
    expect(n(sale.total)).toBe(90);
    const price = await db.variant.findUniqueOrThrow({ where: { id: v } });
    expect(n(price.price)).toBe(100);
    const alert = await db.alert.findUniqueOrThrow({
      where: { key: "low-margin:" + sale.id },
    });
    expect(alert.type).toBe("low_margin_discount");
    expect(OWNER_ONLY_ALERT_TYPES).not.toContain("low_margin_discount");
    for (const text of [
      sale.number,
      "Cajera prueba",
      "Faja",
      "precio RD$ 100.00",
      "cobrado RD$ 90.00",
      "costo RD$ 90.00",
      "margen 0 %",
    ])
      expect(alert.message).toContain(text);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "sale_low_margin_discount", entityId: sale.id },
    });
    expect((log.after as any).saleMargin).toBe(0);
  });

  it("sin costo cuenta como margen bajo; con margen suficiente o sin descuento no avisa", async () => {
    const sid = await openCash(cashier.id);
    const noCost = await variant(0, 200, "Paleta");
    const a: any = await sales.complete(
      cashier,
      saleInput(sid, noCost, 190, {
        item: { discountPercent: 5 },
        discountReason: "Promo",
      }),
    );
    expect(
      (await db.alert.findUnique({ where: { key: "low-margin:" + a.id } }))
        ?.message,
    ).toContain("sin costo");
    // Costo 50, precio 100, 10 %: (90 − 50) ÷ 90 = 44.44 % → sin aviso.
    const ok = await variant(50, 100, "Proteína");
    const b: any = await sales.complete(
      cashier,
      saleInput(sid, ok, 90, {
        item: { discountPercent: 10 },
        discountReason: "Promo",
      }),
    );
    expect(
      await db.alert.findUnique({ where: { key: "low-margin:" + b.id } }),
    ).toBeNull();
    // Sin descuento, aunque el margen sea bajo, no es un descuento de cajera.
    const thin = await variant(95, 100, "Agua");
    const c: any = await sales.complete(cashier, saleInput(sid, thin, 100));
    expect(
      await db.alert.findUnique({ where: { key: "low-margin:" + c.id } }),
    ).toBeNull();
  });

  it("el descuento de gerencia no deja este aviso", async () => {
    const sid = await openCash(manager.id);
    const v = await variant(90, 100, "Faja gerencia");
    const sale: any = await sales.complete(
      manager,
      saleInput(sid, v, 90, {
        item: { discountPercent: 10 },
        discountReason: "Gerencia",
      }),
    );
    expect(
      await db.alert.findUnique({ where: { key: "low-margin:" + sale.id } }),
    ).toBeNull();
  });
});

describe("Decisión 2 · caja de GV: tasa de Configuración y dólares aparte", () => {
  const usdCourse = GV_CATALOGO.find((c) => c.moneda === "US$")!;
  let enrollmentId = "";
  const pay = (data: Record<string, unknown>) =>
    gv.createPayment(
      {
        operationId: randomUUID(),
        enrollmentId,
        date: businessDate(),
        concept: "separo",
        method: "efectivo",
        ...data,
      },
      gvCashier,
    );

  it("sin tasa en Configuración no se cobra en dólares", async () => {
    const course = await db.gvCourse.create({
      data: {
        name: usdCourse.nombre,
        type: "personalizado",
        date: new Date(businessDate() + "T00:00:00Z"),
        price: 450,
        capacity: 10,
        createdBy: owner.id,
      },
    });
    enrollmentId = (
      await db.gvEnrollment.create({
        data: {
          courseId: course.id,
          clientName: "Alumna US$",
          agreedPrice: 450,
          createdBy: owner.id,
        },
      })
    ).id;
    await gvCaja.open({ openingAmount: 1000 }, gvCashier);
    expect(
      await message(pay({ amount: 100, currency: "USD", rate: 60 })),
    ).toMatch(/No hay tasa del dólar en Configuración/);
  });

  it("usa la tasa de Configuración aunque la pantalla mande otra, y la guarda en el pago", async () => {
    // ANTES: la cajera escribía 50 y valía 50. AHORA: Configuración = 60.
    await setSettings({ usdRate: 60 });
    const usd: any = await pay({ amount: 100, currency: "USD", rate: 50 });
    expect(n(usd.rate)).toBe(60);
    expect(n(usd.amountDop)).toBe(6000);
    // RD$ 6,000 en pesos sobre el curso en US$: US$ 100 a 60 (con 50 eran 120).
    const dop: any = await pay({ amount: 6000, rate: 50 });
    expect(n(dop.rate)).toBe(60);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "gv_payment_create", entityId: usd.id },
    });
    expect((log.after as any).clientRate).toBe(50);
  });

  it("la caja espera y cuenta los US$ aparte, sin sumarlos a los pesos", async () => {
    const current: any = await gvCaja.current(gvCashier);
    // Caja ciega para la cajera de GV: no recibe lo esperado.
    expect(current.expected).toBeUndefined();
    expect(current.usdPayments).toBe(1);
    const asManager: any = await gvCaja.current({
      ...gvCashier,
      permissions: ["gv:read", "gv:verify"],
    });
    // ANTES: efectivo esperado = 1,000 + 6,000 + 6,000 (los US$ en pesos).
    expect(asManager.expected).toEqual({
      efectivo: "7000.00",
      tarjeta: "0.00",
      transferencia: "0.00",
      usd: "100.00",
    });
    // US$ contados de menos: es descuadre y pide justificación.
    expect(
      await message(
        gvCaja.close(
          {
            countedCash: 7000,
            countedCard: 0,
            countedTransfer: 0,
            countedUsd: 90,
          },
          gvCashier,
        ),
      ),
    ).toMatch(/no cuadra/);
    const closed: any = await gvCaja.close(
      {
        countedCash: 7000,
        countedCard: 0,
        countedTransfer: 0,
        countedUsd: 100,
      },
      gvCashier,
    );
    // Caja ciega: la cajera de GV no recibe esperado ni diferencias (ni en
    // US$) al cerrar ni en la lista de cierres; el cierre sí los guarda.
    expect(closed.differences).toBeUndefined();
    expect(closed.session.expectedCash).toBeUndefined();
    expect(closed.session.difference).toBeUndefined();
    expect(closed.session.closeDetails).toEqual({
      usdSeparate: true,
      countedUsd: "100.00",
    });
    const mine = (await gvCaja.list(gvCashier)).find(
      (c: any) => c.id === closed.session.id,
    );
    expect(mine).toBeTruthy();
    expect(mine.expectedCash).toBeUndefined();
    expect(mine.closeDetails).toEqual({
      usdSeparate: true,
      countedUsd: "100.00",
    });
    const row = await db.gvCashSession.findUniqueOrThrow({
      where: { id: closed.session.id },
    });
    expect(row.closeDetails).toEqual({
      usdSeparate: true,
      expectedUsd: "100.00",
      countedUsd: "100.00",
      differenceUsd: "0.00",
    });
    expect(n(row.expectedCash)).toBe(7000);
    expect(n(row.difference)).toBe(0);
    // Quien verifica GV ve todo en la lista.
    const full = (
      await gvCaja.list({
        ...gvCashier,
        permissions: ["gv:reports", "gv:verify"],
      })
    ).find((c: any) => c.id === closed.session.id);
    expect(n(full.expectedCash)).toBe(7000);
    expect(full.closeDetails.expectedUsd).toBe("100.00");
  });
});

describe("Decisión 3 · caja ciega por defecto mientras la cajera cuenta y cierra", () => {
  it("la cajera no recibe lo esperado de su caja abierta; si la dueña la apaga, sí", async () => {
    const sid = await openCash(cashier.id);
    const list: any[] = await cash.sessions(cashier);
    const mine = list.find((s) => s.id === sid);
    expect(mine).toBeTruthy();
    expect(mine.expected).toBeUndefined();
    expect(mine.expectedCash).toBeUndefined();
    expect(await message(cash.cuadre(sid, cashier))).toMatch(
      /Cierra la caja para consultar el cuadre/,
    );
    const open = { ...cashier, cashBlind: false };
    const visible = (await cash.sessions(open)).find((s: any) => s.id === sid);
    expect(visible.expected).toBeTruthy();
    const report: any = await cash.cuadre(sid, open);
    expect(
      report.lines.some((l: any) => String(l.key).startsWith("difference")),
    ).toBe(true);
    // Gerencia siempre lo ve.
    const asManager = (await cash.sessions(manager)).find(
      (s: any) => s.id === sid,
    );
    expect(asManager.expected).toBeTruthy();
  });
});

describe("Caja cerrada con descuadre: la cajera no la cambia", () => {
  it("cerrar con diferencia exige justificación y el PIN de otra persona, y avisa a la dueña", async () => {
    const sid = await openCash(cashier.id);
    const v = await variant(50, 1000, "Cierre");
    await sales.complete(cashier, saleInput(sid, v, 1000));
    // Sin PIN: no cierra (mensaje sin montos).
    expect(
      await message(
        cash.close(
          sid,
          { countedCash: 500, countedCard: 0, countedTransfer: 0 },
          cashier,
        ),
      ),
    ).toMatch(/PIN de un gerente/);
    // Con PIN pero sin justificación: no cierra.
    expect(
      await message(
        cash.close(
          sid,
          {
            countedCash: 500,
            countedCard: 0,
            countedTransfer: 0,
            managerPin: MANAGER_PIN,
          },
          cashier,
        ),
      ),
    ).toMatch(/justificación/);
    const closed: any = await cash.close(
      sid,
      {
        countedCash: 500,
        countedCard: 0,
        countedTransfer: 0,
        managerPin: MANAGER_PIN,
        differenceReason: "Faltan 500 pesos, se revisa con la cajera",
        notes: "Descuadre",
      },
      cashier,
    );
    // La cajera no recibe montos en la respuesta del cierre (ciega).
    expect(Object.keys(closed).sort()).toEqual(["closedAt", "id"]);
    const row = await db.cashSession.findUniqueOrThrow({ where: { id: sid } });
    expect((row.closeDetails as any).cashApprovedBy).toBe(manager.id);
    const alert = await db.alert.findUniqueOrThrow({
      where: { key: "cash:" + sid },
    });
    expect(alert.type).toBe("cash_difference");
    // Ya cerrada: la cajera sí ve su cuadre (lo imprime).
    expect((await cash.cuadre(sid, cashier)).lines.length).toBeGreaterThan(0);
    // No puede registrar ventas ni salidas en ella.
    expect(
      await message(sales.complete(cashier, saleInput(sid, v, 1000))),
    ).toMatch(/cerr/);
    expect(
      await message(
        cash.movement(
          sid,
          {
            operationId: randomUUID(),
            type: "out",
            amount: 10,
            reason: "Prueba de salida",
          },
          cashier,
        ),
      ),
    ).toMatch(/cerrada/);
  });

  it("las rutas que cambian una caja cerrada son solo de la dueña o gerencia", () => {
    const permission = (proto: any, method: string) =>
      Reflect.getMetadata("permission", proto[method]);
    for (const method of [
      "correctPaymentMethod",
      "replacePayments",
      "voidSale",
      "moveCashSession",
      "verify",
      "unverify",
      "correctTransfer",
      "reject",
      "correctItemCost",
    ])
      expect(permission(SalesController.prototype, method), method).toBe("*");
    expect(permission(SalesController.prototype, "returnSale")).toBe(
      "sale:manage",
    );
    expect(permission(CashController.prototype, "resolveDifference")).toBe("*");
    // La cajera (sale:write + cash:write) no tiene ninguno de los dos.
    expect(cashier.permissions).not.toContain("*");
    expect(cashier.permissions).not.toContain("sale:manage");
  });
});
