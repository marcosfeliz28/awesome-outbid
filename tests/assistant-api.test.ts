// T33 · IA de ventas contra la API real (:3001) y la base de pruebas: las 5 preguntas de
// ejemplo, con un cliente de IA falso, llaman a las herramientas con los parámetros correctos
// y devuelven las MISMAS cifras que /dashboard/breakdown del mismo rango.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ask, type AssistantDeps } from "../apps/api/src/assistant";
import { Database } from "../apps/api/src/common";
import { ReportsController, mySales } from "../apps/api/src/reports";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const ip = "198.18.97." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const NOW = new Date("2026-10-30T16:00:00Z");
const db = new Database();

async function call(path: string, token: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texto */
  }
  return { status: r.status, body };
}
const login = async (email: string) =>
  (await call("/auth/login", "", { email, password: demo })).body
    .accessToken as string;

let admin: any;
const tokens: Record<string, string> = {};
const records: any[] = [];
beforeAll(async () => {
  tokens.admin = await login("admin@fitstore.demo");
  tokens.vendedor = await login("vendedor@fitstore.demo");
  tokens.almacen = await login("almacen@fitstore.demo");
  const me = (await call("/auth/me", tokens.admin)).body;
  const user = await db.user.findFirst({
    where: { email: "admin@fitstore.demo" },
    include: { role: true },
  });
  admin = {
    id: user!.id,
    role: "admin",
    permissions: ["*"],
    branchId: user!.branchId ?? me.branchId ?? "main",
  };
});
afterAll(async () => {
  await db.assistantQuery.deleteMany({
    where: { question: { startsWith: "[test-t33]" } },
  });
  await db.$disconnect();
});

const QUESTIONS: [string, { name: string; input: any }, string, string][] = [
  [
    "¿cuánto vendí en suplementos este mes?",
    {
      name: "resumen_ventas",
      input: { periodo: "mes", categoria: "Suplementos" },
    },
    "2026-10-01",
    "2026-10-30",
  ],
  [
    "top 10 de fajas en octubre",
    {
      name: "top_productos",
      input: {
        desde: "2026-10-01",
        hasta: "2026-10-31",
        categoria: "Fajas",
        orden: "unidades",
        limite: 10,
      },
    },
    "2026-10-01",
    "2026-10-31",
  ],
  [
    "cuánto entró por transferencia y por cada banco esta semana",
    { name: "cobros", input: { periodo: "semana", metodo: "transfer" } },
    "2026-10-26",
    "2026-10-30",
  ],
  [
    "unidades de maquillaje ayer",
    {
      name: "resumen_ventas",
      input: { periodo: "ayer", categoria: "Maquillaje" },
    },
    "2026-10-29",
    "2026-10-29",
  ],
  [
    "ropa deportiva este mes comparado con el pasado",
    {
      name: "comparar_periodos",
      input: {
        categoria: "Ropa deportiva",
        a: { periodo: "mes" },
        b: { periodo: "mes_pasado" },
      },
    },
    "2026-10-01",
    "2026-10-30",
  ],
];

describe("cifras de las herramientas = desglose del mes", () => {
  for (const [q, tool, from, to] of QUESTIONS) {
    it(q, async () => {
      const create = async (p: any) =>
        p.messages.length === 1
          ? {
              content: [
                {
                  type: "tool_use",
                  id: "t1",
                  name: tool.name,
                  input: tool.input,
                },
              ],
              stop_reason: "tool_use",
              usage: { input_tokens: 1, output_tokens: 1 },
            }
          : {
              content: [{ type: "text", text: "ok" }],
              stop_reason: "end_turn",
              usage: { input_tokens: 1, output_tokens: 1 },
            };
      const reports = new ReportsController(db);
      const seen: [string, string][] = [];
      const deps: AssistantDeps = {
        client: { create } as any,
        breakdown: (a, f, t) => (
          seen.push([f, t]),
          reports.dashboardBreakdown({ from: f, to: t }, a)
        ),
        mine: (a, p) => mySales(db, a, p),
        usage: {
          reserve: async () => ({ id: "q", used: 1 }),
          settle: async (_id, r) => void records.push(r),
        },
        now: () => NOW,
      };
      const r = await ask(admin, "[test-t33] " + q, deps);
      const u = r.used[0];
      expect(u.tool).toBe(tool.name);
      expect(u.range).toEqual({ from, to });
      expect(seen[0]).toEqual([from, to]);
      const live = (
        await call(`/dashboard/breakdown?from=${from}&to=${to}`, tokens.admin)
      ).body;
      const cat = (n: string) => live.categories.find((c: any) => c.name === n);
      if (tool.name === "resumen_ventas") {
        const c = cat(tool.input.categoria);
        expect(u.result.revenue).toBe(c?.revenue ?? 0);
        expect(u.result.units).toBe(c?.units ?? 0);
      } else if (tool.name === "top_productos") {
        const g = live.topByCategory.find(
          (c: any) => c.category === tool.input.categoria,
        );
        expect(
          u.result.productos.map((p: any) => [p.sku, p.units, p.revenue]),
        ).toEqual(
          (g?.byUnits ?? []).map((p: any) => [p.sku, p.units, p.revenue]),
        );
      } else if (tool.name === "cobros") {
        const sum = live.payments
          .filter((p: any) => p.method === "transfer")
          .reduce((a: number, p: any) => a + p.amount, 0);
        expect(u.result.total).toBeCloseTo(sum, 2);
        const banks = new Set(
          live.payments
            .filter((p: any) => p.method === "transfer")
            .map((p: any) => p.bank ?? "Sin banco"),
        );
        expect(new Set(u.result.porBanco.map((b: any) => b.banco))).toEqual(
          banks,
        );
      } else {
        const prev = (
          await call(
            `/dashboard/breakdown?from=2026-09-01&to=2026-09-30`,
            tokens.admin,
          )
        ).body;
        const pc = prev.categories.find(
          (c: any) => c.name === tool.input.categoria,
        );
        expect(u.result.a.revenue).toBe(
          cat(tool.input.categoria)?.revenue ?? 0,
        );
        expect(u.result.b.revenue).toBe(pc?.revenue ?? 0);
        expect(u.result.a.range).toEqual({
          from: "2026-10-01",
          to: "2026-10-30",
        });
        expect(u.result.b.range).toEqual({
          from: "2026-09-01",
          to: "2026-09-30",
        });
      }
    });
  }
});

describe("rutas /assistant", () => {
  it("status responde a quien puede y a quien no", async () => {
    const a = await call("/assistant/status", tokens.admin);
    expect(a.status).toBe(200);
    expect(typeof a.body.enabled).toBe("boolean");
    expect(a.body.canUse).toBe(true);
    expect((await call("/assistant/status", tokens.vendedor)).body.canUse).toBe(
      true,
    );
    expect((await call("/assistant/status", tokens.almacen)).body.canUse).toBe(
      false,
    );
  });
  it("ask: sin llave 404; con llave, el almacén recibe 403", async () => {
    const enabled = (await call("/assistant/status", tokens.admin)).body
      .enabled;
    const r = await call("/assistant/ask", tokens.almacen, {
      question: "[test-t33] hola",
    });
    expect(r.status).toBe(enabled ? 403 : 404);
    expect((await call("/assistant/ask", "", { question: "x" })).status).toBe(
      401,
    );
  });
  it("con 30 preguntas hechas hoy avisa y no llama a la IA", async () => {
    const enabled = (await call("/assistant/status", tokens.admin)).body
      .enabled;
    if (!enabled) return; // sin llave el endpoint no existe (404); lo cubre la unitaria
    await db.assistantQuery.createMany({
      data: Array.from({ length: 30 }, () => ({
        userId: admin.id,
        branchId: admin.branchId,
        question: "[test-t33] relleno",
        model: "m",
        status: "ok",
      })),
    });
    const r = await call("/assistant/ask", tokens.admin, {
      question: "[test-t33] otra",
    });
    expect(r.status).toBe(201);
    expect(r.body.limited).toBe(true);
  });
});

// Revisión adversarial de permisos con el cálculo real (safe() incluido).
describe("permisos con datos reales", () => {
  const reports = new ReportsController(db);
  const run = async (who: any, name: string, input: any) => {
    const seen: any[] = [];
    const create = async (p: any) =>
      p.messages.length === 1
        ? {
            content: [{ type: "tool_use", id: "t", name, input }],
            stop_reason: "tool_use",
            usage: { input_tokens: 1, output_tokens: 1 },
          }
        : {
            content: [{ type: "text", text: "ok" }],
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          };
    const deps: AssistantDeps = {
      client: { create } as any,
      breakdown: (a, f, t) => (
        seen.push([f, t]),
        reports.dashboardBreakdown({ from: f, to: t }, a)
      ),
      mine: (a, p) => mySales(db, a, p),
      usage: {
        reserve: async () => ({ id: "q", used: 1 }),
        settle: async () => {},
      },
      now: () => NOW,
    };
    const r = await ask(who, "[test-t33] adversarial", deps);
    return { r, seen };
  };
  const as = (role: string, permissions: string[]) => ({
    ...admin,
    role,
    permissions,
  });
  const COSTS = /"(cost|profit|margin|unitCost)"/;

  it("reports:read sin profit:read: hay ventas por línea y top, pero nunca costo, ganancia ni margen", async () => {
    const who = as("custom", ["reports:read"]);
    const a = await run(who, "resumen_ventas", {
      periodo: "mes",
      categoria: "Suplementos",
    });
    expect(a.r.used[0].error).toBeUndefined();
    expect(typeof a.r.used[0].result.revenue).toBe("number");
    expect(JSON.stringify(a.r.used)).not.toMatch(COSTS);
    const t = await run(who, "top_productos", {
      periodo: "mes",
      categoria: "Fajas",
    });
    expect(t.r.used[0].error).toBeUndefined();
    expect(JSON.stringify(t.r.used)).not.toMatch(COSTS);
    const c = await run(who, "comparar_periodos", {
      categoria: "Maquillaje",
      a: { periodo: "mes" },
      b: { periodo: "mes_pasado" },
    });
    expect(JSON.stringify(c.r.used)).not.toMatch(COSTS);
  });
  it("con profit:read sí ve margen", async () => {
    const a = await run(
      as("manager", ["reports:read", "profit:read"]),
      "resumen_ventas",
      { periodo: "mes", categoria: "Suplementos" },
    );
    expect(a.r.used[0].result).toHaveProperty("margin");
  });
  it("reports:read sin ver el esperado de caja: cobros no se entregan", async () => {
    const a = await run(as("custom", ["reports:read"]), "cobros", {
      periodo: "mes",
    });
    expect(a.r.used[0].error).toBeTruthy();
    expect(a.r.used[0].result).toBeUndefined();
  });
  it("cajera con reports:read y profit:read: ni total de tienda ni costos", async () => {
    const who = as("seller", ["sale:write", "reports:read", "profit:read"]);
    for (const [name, input] of [
      ["resumen_ventas", { periodo: "mes" }],
      ["top_productos", { periodo: "mes" }],
      ["cobros", { periodo: "mes" }],
    ] as const) {
      const a = await run(who, name, input);
      expect(a.seen).toEqual([]);
      expect(a.r.used[0].error).toBeTruthy();
    }
    const mine = await run(who, "mis_ventas", { periodo: "semana" });
    expect(JSON.stringify(mine.r.used)).not.toMatch(COSTS);
  });
  it("sin reports:read ni ser cajera: 403 y no se llama a nada", async () => {
    await expect(
      run(as("warehouse", ["catalog:read"]), "resumen_ventas", {}),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("pedirle cambiar un precio no cambia nada en la base", async () => {
    const sum = async () =>
      JSON.stringify(
        await db.variant.findMany({
          orderBy: { id: "asc" },
          select: { id: true, price: true, stock: true },
        }),
      );
    const before = await sum();
    const a = await run(admin, "cambiar_precio", { sku: "X", precio: 1 });
    expect(a.r.used[0].error).toBeTruthy();
    expect(await sum()).toBe(before);
  });
});
