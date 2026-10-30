// IA de ventas (solo lectura): las herramientas dan las mismas cifras que el desglose del mes,
// con los permisos aplicados en el servidor, y el tope diario de preguntas se cumple.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { permissions } from "../packages/shared/src";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { Database } = await import("../apps/api/src/common");
const { ReportsController } = await import("../apps/api/src/reports");
const { AssistantController, assistantTools, resolvePeriod, DAILY_LIMIT } =
  await import("../apps/api/src/assistant");

const db = new Database();
const reports = new ReportsController(db);
const as = (role: string, id: string, branchId: string) =>
  ({
    id,
    name: role,
    email: role + "@x",
    role,
    branchId,
    permissions: permissions[role] ?? [],
  }) as any;
let admin: any, manager: any, seller: any;

beforeAll(async () => {
  const u = await db.user.findFirstOrThrow({
    where: { email: "admin@fitstore.demo" },
  });
  admin = { ...as("admin", u.id, u.branchId), permissions: ["*"] };
  manager = as("manager", u.id, u.branchId);
  const s = await db.user.findFirstOrThrow({
    where: { email: "vendedor@fitstore.demo" },
  });
  seller = as("seller", s.id, u.branchId);
}, 60000);
afterAll(async () => {
  if (seller)
    await db.assistantQuery.deleteMany({ where: { userId: seller.id } });
  await db.$disconnect();
});

const bd = (p: any, actor = admin) => {
  const r = resolvePeriod(p);
  return reports.dashboardBreakdown(
    { from: r.from, to: r.to },
    actor,
  ) as Promise<any>;
};

describe("IA de ventas: mismas cifras que el desglose", () => {
  it("1. ¿cuánto vendí en suplementos este mes?", async () => {
    const t: any = assistantTools(db, reports, admin);
    const out: any = await t.ventas_periodo.run({
      periodo: "mes",
      categoria: "suplementos",
    });
    const c = (await bd({ periodo: "mes" })).categories.find(
      (x: any) => x.name === "Suplementos",
    );
    expect(out.ventaBruta).toBe(c.revenue);
    expect(out.unidades).toBe(c.units);
  });
  it("2. top 10 de fajas en octubre, por unidades y por monto", async () => {
    const t: any = assistantTools(db, reports, admin);
    const p = { desde: "2026-10-01", hasta: "2026-10-31" };
    const g = (await bd(p)).topByCategory.find(
      (x: any) => x.category === "Fajas",
    );
    const u: any = await t.top_productos.run({ ...p, categoria: "fajas" });
    const m: any = await t.top_productos.run({
      ...p,
      categoria: "fajas",
      por: "monto",
    });
    expect(u.top).toEqual(g.byUnits);
    expect(m.top).toEqual(g.byAmount);
    expect(u.top.length).toBeLessThanOrEqual(10);
  });
  it("3. entrada por método y por banco esta semana", async () => {
    const t: any = assistantTools(db, reports, admin);
    const out: any = await t.cobros_por_metodo_y_banco.run({
      periodo: "semana",
    });
    const b = await bd({ periodo: "semana" });
    const sum = Object.values(out.porMetodo).reduce(
      (a: number, v: any) => a + v,
      0,
    );
    expect(sum).toBeCloseTo(b.revenue, 1);
    const bank = b.payments
      .filter((p: any) => p.bank)
      .reduce((a: number, p: any) => a + p.amount, 0);
    expect(
      Object.values(out.porBanco).reduce((a: number, v: any) => a + v, 0),
    ).toBeCloseTo(bank, 1);
  });
  it("4. unidades de una categoría ayer", async () => {
    const t: any = assistantTools(db, reports, admin);
    const b = await bd({ periodo: "ayer" });
    const c = b.categories.find((x: any) => x.name === "Maquillaje");
    if (!c)
      return expect(
        t.ventas_periodo.run({ periodo: "ayer", categoria: "maquillaje" }),
      ).rejects.toThrow(/No hay ventas/);
    expect(
      (await t.ventas_periodo.run({ periodo: "ayer", categoria: "maquillaje" }))
        .unidades,
    ).toBe(c.units);
  });
  it("5. una categoría este mes vs el pasado", async () => {
    const t: any = assistantTools(db, reports, admin);
    const out: any = await t.comparar_periodos.run({
      a: { periodo: "mes" },
      b: { periodo: "mes_pasado" },
      categoria: "ropa deportiva",
    });
    const f = async (p: any) =>
      (await bd(p)).categories.find((x: any) => x.name === "Ropa deportiva");
    expect(out.a.ventaBruta).toBe((await f({ periodo: "mes" }))?.revenue);
    expect(out.b.ventaBruta).toBe(
      (await f({ periodo: "mes_pasado" }))?.revenue,
    );
  });
});

describe("IA de ventas: permisos en el servidor", () => {
  it("la cajera solo tiene mis_ventas; sin tienda, cobros ni ganancia", async () => {
    const t: any = assistantTools(db, reports, seller);
    expect(Object.keys(t)).toEqual(["mis_ventas"]);
    expect(
      JSON.stringify(await t.mis_ventas.run({ periodo: "hoy" })),
    ).not.toMatch(/profit|cost|margin/i);
  });
  it("sin profit:read no hay ganancia ni margen en las herramientas", async () => {
    const noProfit = {
      ...manager,
      permissions: ["reports:read", "sale:manage"],
    };
    const t: any = assistantTools(db, reports, noProfit);
    const out = JSON.stringify([
      await t.ventas_periodo.run({ periodo: "mes", categoria: "suplementos" }),
      await t.top_productos.run({ periodo: "mes", categoria: "suplementos" }),
    ]);
    expect(out).not.toMatch(/ganancia|profit|cost|margin/i);
    const withProfit: any = await assistantTools(
      db,
      reports,
      manager,
    ).ventas_periodo.run({
      periodo: "mes",
      categoria: "suplementos",
    });
    expect(withProfit.ganancia).toBeDefined();
  });
  it("sin canViewCashExpected no hay herramienta de cobros", () => {
    const t: any = assistantTools(db, reports, {
      ...manager,
      permissions: ["reports:read"],
    });
    expect(t.cobros_por_metodo_y_banco).toBeUndefined();
  });
  it("tope diario: la pregunta 31 se rechaza con 429 antes de llamar al modelo", async () => {
    process.env.ANTHROPIC_API_KEY ||= "qa-no-se-usa";
    const day = resolvePeriod({ periodo: "hoy" }).from;
    await db.assistantQuery.createMany({
      data: Array.from({ length: DAILY_LIMIT }, () => ({
        userId: seller.id,
        day,
        question: "qa",
      })),
    });
    const c = new AssistantController(db, reports);
    await expect(
      c.ask({ question: "¿cuánto vendí hoy?" }, seller),
    ).rejects.toMatchObject({ status: 429 });
    expect(
      await db.assistantQuery.count({ where: { userId: seller.id, day } }),
    ).toBe(DAILY_LIMIT);
  });
});
