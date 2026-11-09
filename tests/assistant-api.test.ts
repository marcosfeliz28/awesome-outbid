// T33 · IA de ventas contra la API real (:3001) y la base de pruebas: las 5 preguntas de
// ejemplo, con un cliente de IA falso, llaman a las herramientas con los parámetros correctos
// y devuelven las MISMAS cifras que /dashboard/breakdown del mismo rango.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  ask,
  liveDeps,
  usageStore,
  IA_ANALISTA_FEATURE,
  IA_VENTAS_FEATURE,
  type AssistantDeps,
} from "../apps/api/src/assistant";
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
const DAILY_LIMIT = 30;
const mine = (userId: string) => ({ userId, feature: IA_VENTAS_FEATURE });

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
  await db.aiUsage.deleteMany({ where: mine(admin.id) });
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
        limit: DAILY_LIMIT,
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
  it("ask: sin llave 503 con mensaje claro; con llave, el almacén recibe 403", async () => {
    const st = (await call("/assistant/status", tokens.admin)).body;
    if (!process.env.ANTHROPIC_API_KEY) {
      expect(st.enabled).toBe(false);
      expect(st.motivo).toMatch(/clave/);
    }
    const r = await call("/assistant/ask", tokens.almacen, {
      question: "[test-t33] hola",
    });
    expect(r.status).toBe(st.enabled ? 403 : 503);
    expect((await call("/assistant/ask", "", { question: "x" })).status).toBe(
      401,
    );
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
      limit: DAILY_LIMIT,
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

// Orden de la dueña: sin memoria y sin guardar consultas; el tope es solo un contador.
describe("sin texto guardado y tope por contador", () => {
  const reports = new ReportsController(db);
  const SECRETO = "[test-t33] pregunta-secreta-91827";
  const RESPUESTA = "respuesta-secreta-55102";
  const build = (who: any, seenParams: any[]): AssistantDeps => ({
    client: {
      create: async (p: any) => {
        seenParams.push(p);
        return {
          content: [{ type: "text", text: RESPUESTA }],
          stop_reason: "end_turn",
          usage: { input_tokens: 100, output_tokens: 20 },
        };
      },
    } as any,
    breakdown: (a, f, t) => reports.dashboardBreakdown({ from: f, to: t }, a),
    mine: (a, p) => mySales(db, a, p),
    usage: usageStore(db),
    limit: DAILY_LIMIT,
    now: () => NOW,
  });
  const rows = (userId = admin.id) =>
    db.aiUsage.findMany({ where: mine(userId) });
  it("tras usarla, ninguna tabla contiene la pregunta ni la respuesta; cada pregunta va sola", async () => {
    await db.aiUsage.deleteMany({ where: mine(admin.id) });
    const seen: any[] = [];
    await ask(admin, SECRETO, build(admin, seen));
    await ask(admin, "otra cosa", build(admin, seen));
    // sin historial: cada llamada lleva solo su pregunta (1 mensaje) y nada de la anterior
    expect(seen).toHaveLength(2);
    expect(seen[1].messages).toEqual([{ role: "user", content: "otra cosa" }]);
    expect(JSON.stringify(seen[1])).not.toContain("secreta");
    // medidor: 2 filas ia_ventas con tokens, sin columnas de texto
    const rs = await rows();
    expect(rs).toHaveLength(2);
    expect(rs.every((r) => r.ok && r.inputTokens === 100)).toBe(true);
    expect(rs.every((r) => r.branchId === admin.branchId)).toBe(true);
    expect(JSON.stringify(rs)).not.toContain("secreta");
  });
  it("el tope de 30 sigue funcionando con el contador (y no llama a la IA)", async () => {
    await db.aiUsage.deleteMany({ where: mine(admin.id) });
    const seen: any[] = [];
    for (let i = 0; i < DAILY_LIMIT; i++)
      expect(
        (await ask(admin, "p" + i, build(admin, seen))).limited,
      ).toBeFalsy();
    const r = await ask(admin, "p31", build(admin, seen));
    expect(r.limited).toBe(true);
    expect(seen).toHaveLength(DAILY_LIMIT);
    expect(await rows()).toHaveLength(DAILY_LIMIT);
  });
  it("simultáneas: 35 a la vez nunca pasan de 30 respuestas", async () => {
    await db.aiUsage.deleteMany({ where: mine(admin.id) });
    const seen: any[] = [];
    const rs = await Promise.all(
      Array.from({ length: 35 }, (_, i) =>
        ask(admin, "c" + i, build(admin, seen)),
      ),
    );
    expect(rs.filter((r) => !r.limited)).toHaveLength(DAILY_LIMIT);
    expect(seen).toHaveLength(DAILY_LIMIT);
  });
  it("la cajera solo ve lo suyo y su contador es aparte", async () => {
    const seller = await db.user.findFirst({
      where: { email: "vendedor@fitstore.demo" },
      include: { role: true },
    });
    const cajera: any = {
      id: seller!.id,
      role: "seller",
      permissions: ["sales:create"],
      branchId: seller!.branchId ?? "main",
    };
    const seen: any[] = [];
    await ask(cajera, "mis ventas de hoy", build(cajera, seen));
    expect(seen[0].tools.map((t: any) => t.name)).toEqual(["mis_ventas"]);
    expect(await rows(cajera.id)).toHaveLength(1);
    await db.aiUsage.deleteMany({ where: mine(cajera.id) });
  });
});

// Plan analista con las lecturas REALES (liveDeps = las mismas del controlador):
// cada doble lectura cuadra con los datos de la semilla y la cajera queda en cierre ciego.
describe("plan analista contra la base real", () => {
  const run = async (actor: any, calls: { name: string; input: any }[]) => {
    const create = async (p: any) =>
      p.messages.length === 1
        ? {
            content: calls.map((c, i) => ({
              type: "tool_use",
              id: "a" + i,
              ...c,
            })),
            usage: { input_tokens: 1, output_tokens: 1 },
          }
        : {
            content: [{ type: "text", text: "ok" }],
            usage: { input_tokens: 1, output_tokens: 1 },
          };
    const reserved: any[] = [];
    const r = await ask(actor, "[test-analista] cuadre", {
      client: { create },
      ...liveDeps(db),
      usage: {
        reserve: async (...a: any[]) => (
          reserved.push(a[3]),
          { id: "q", used: 1 }
        ),
        settle: async () => {},
      },
      limit: DAILY_LIMIT,
      plan: "analista",
    } as AssistantDeps);
    return { used: r.used as any[], reserved };
  };
  it("cuadre, resumen e inventario: las dos lecturas cuadran", async () => {
    const { used, reserved } = await run(admin, [
      { name: "cuadre_dia", input: { periodo: "mes" } },
      { name: "resumen_ventas", input: { periodo: "mes" } },
      { name: "inventario_bajo", input: {} },
      { name: "cierres_caja", input: { periodo: "mes" } },
    ]);
    expect(reserved[0].feature).toBe(IA_ANALISTA_FEATURE);
    for (const u of used) {
      expect(u.error).toBeUndefined();
      expect(u.result.verificacion.cuadra).toBe(true);
    }
    const c = used[0].result;
    expect(c.verificacion.lecturas.desgloseVentas).toBe(c.ventasNetas);
    const more = await run(admin, [
      { name: "transferencias_pendientes", input: {} },
      { name: "productos_sin_ventas", input: { dias: 30 } },
      {
        name: "explicar_reporte",
        input: { reporte: "formas-pago-mes", periodo: "mes" },
      },
    ]);
    for (const u of more.used) expect(u.error).toBeUndefined();
    const pend = await db.payment.count({
      where: {
        method: "transfer",
        status: "pending_verification",
        sale: { branchId: admin.branchId },
      },
    });
    expect(more.used[0].result.cantidad).toBe(pend);
  });
  it("la cajera: solo sus cajas, sin esperado ni diferencia; el resto se rechaza", async () => {
    const seller = await db.user.findFirst({
      where: { email: "vendedor@fitstore.demo" },
    });
    const cajera: any = {
      id: seller!.id,
      role: "seller",
      permissions: ["catalog:read", "sale:write", "cash:write"],
      branchId: seller!.branchId ?? "main",
    };
    const { used } = await run(cajera, [
      { name: "cierres_caja", input: { periodo: "mes" } },
      { name: "cuadre_dia", input: {} },
      { name: "transferencias_pendientes", input: {} },
      { name: "inventario_bajo", input: {} },
    ]);
    expect(used[0].error).toBeUndefined();
    const text = JSON.stringify(used[0].result.cajas);
    for (const k of ["esperado", "diferencia", "expected", "difference"])
      expect(text).not.toContain(k);
    for (const c of used[0].result.cajas) expect(c.usuario).toBe(seller!.name);
    for (const u of used.slice(1)) expect(u.error).toMatch(/permiso/);
  });
});
