// T33 · IA de ventas: permisos, límites y solo lectura (sin red, con cliente de IA falso).
import { describe, expect, it, vi } from "vitest";
import {
  DAILY_LIMIT,
  assistantEnabled,
  assistantModel,
  ask,
  toolsFor,
  type AssistantDeps,
} from "../apps/api/src/assistant";

const NOW = new Date("2026-10-30T16:00:00Z"); // viernes 30-oct, 12:00 en Santo Domingo
const actor = (role: string, permissions: string[]) =>
  ({ id: "u1", role, permissions, branchId: "main" }) as any;
const admin = actor("admin", ["*"]);
const gerente = actor("manager", ["reports:read", "profit:read", "sale:manage"]);
const soloVentas = actor("custom", ["reports:read"]);
const cajera = actor("seller", ["catalog:read", "sale:write", "cash:write"]);
const almacen = actor("warehouse", ["catalog:read", "inventory:write"]);

const breakdown = {
  invoices: 2,
  revenue: 300,
  units: 3,
  cost: 150,
  profit: 150,
  margin: 50,
  categories: [{ name: "Fajas", revenue: 300, units: 3, cost: 150, profit: 150, margin: 50 }],
  topByCategory: [],
  top: [],
  payments: [],
};
function setup(calls: any[], used = 0) {
  const create = vi.fn(async (_p: any) => {
    const n = create.mock.calls.length;
    return n === 1 && calls.length
      ? {
          content: calls.map((c, i) => ({ type: "tool_use", id: "t" + i, name: c.name, input: c.input })),
          stop_reason: "tool_use",
          usage: { input_tokens: 100, output_tokens: 20 },
        }
      : {
          content: [{ type: "text", text: "Listo." }],
          stop_reason: "end_turn",
          usage: { input_tokens: 50, output_tokens: 10 },
        };
  });
  const deps = {
    client: { create },
    breakdown: vi.fn(async () => structuredClone(breakdown)),
    mine: vi.fn(async () => ({ invoices: 1, total: 100, hiddenUntilClose: false })),
    usage: { countToday: vi.fn(async () => used), record: vi.fn(async () => {}) },
    now: () => NOW,
  } as unknown as AssistantDeps & { client: { create: typeof create } };
  return { create, deps };
}
const toolResults = (create: any) =>
  (create.mock.calls[1]?.[0].messages.at(-1)?.content ?? []).map((b: any) => JSON.parse(b.content));

describe("permisos (en el servidor, antes de la IA)", () => {
  it("sin reports:read y sin ser cajera: rechazo y no se llama a la IA", async () => {
    const { create, deps } = setup([]);
    await expect(ask(almacen, "¿cuánto vendí?", deps)).rejects.toMatchObject({ status: 403 });
    expect(() => toolsFor(almacen)).toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("la cajera solo recibe mis_ventas", () => {
    expect(toolsFor(cajera).map((t) => t.name)).toEqual(["mis_ventas"]);
    expect(toolsFor(admin).map((t) => t.name)).not.toContain("mis_ventas");
  });
  it("la cajera pide ganancia o el total de la tienda: la herramienta se rechaza y no se calcula nada", async () => {
    const { create, deps } = setup([
      { name: "resumen_ventas", input: { periodo: "mes" } },
      { name: "top_productos", input: { periodo: "mes" } },
    ]);
    await ask(cajera, "¿cuánto ganó la tienda este mes?", deps);
    expect(deps.breakdown).not.toHaveBeenCalled();
    expect(toolResults(create).every((r: any) => r.error)).toBe(true);
    expect(JSON.stringify(create.mock.calls[0][0].tools)).not.toContain("resumen_ventas");
  });
  it("la cajera con profit:read tampoco ve costos ni ganancia", async () => {
    const c = actor("seller", ["sale:write", "profit:read", "reports:read"]);
    expect(toolsFor(c).map((t) => t.name)).toEqual(["mis_ventas"]);
    const { create, deps } = setup([{ name: "mis_ventas", input: { periodo: "hoy" } }]);
    (deps.mine as any).mockResolvedValue({ total: 100, cost: 40, profit: 60, margin: 60 });
    await ask(c, "¿cuánto vendí hoy?", deps);
    const [r] = toolResults(create);
    expect(r.total).toBe(100);
    expect(r).not.toHaveProperty("profit");
    expect(r).not.toHaveProperty("cost");
    expect(r).not.toHaveProperty("margin");
  });
  it("sin profit:read no hay costo, ganancia ni margen; con profit:read sí", async () => {
    const sin = setup([{ name: "resumen_ventas", input: { periodo: "mes" } }]);
    await ask(soloVentas, "ventas del mes", sin.deps);
    const [a] = toolResults(sin.create);
    expect(a.revenue).toBe(300);
    for (const k of ["cost", "profit", "margin"]) expect(JSON.stringify(a)).not.toContain(`"${k}"`);
    const con = setup([{ name: "resumen_ventas", input: { periodo: "mes" } }]);
    await ask(gerente, "ventas del mes", con.deps);
    const [b] = toolResults(con.create);
    expect(b.margin).toBe(50);
    expect(b.profit).toBe(150);
  });
});

describe("límites", () => {
  it(`tras ${DAILY_LIMIT} preguntas avisa y NO llama a la IA`, async () => {
    const { create, deps } = setup([], DAILY_LIMIT);
    const r = await ask(admin, "¿cuánto vendí hoy?", deps);
    expect(r.limited).toBe(true);
    expect(r.answer).toContain(String(DAILY_LIMIT));
    expect(r.remaining).toBe(0);
    expect(create).not.toHaveBeenCalled();
  });
  it("con 29 preguntas todavía contesta y registra tokens", async () => {
    const { create, deps } = setup([], DAILY_LIMIT - 1);
    const r = await ask(admin, "hola", deps);
    expect(r.limited).toBeFalsy();
    expect(create).toHaveBeenCalled();
    expect(deps.usage.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", status: "ok", inputTokens: 50, outputTokens: 10 }),
    );
  });
  it("max_tokens ≤ 1000 y timeout; el modelo no es el de las facturas", async () => {
    const { create, deps } = setup([]);
    await ask(admin, "hola", deps);
    expect(create.mock.calls[0][0].max_tokens).toBeLessThanOrEqual(1000);
    expect(assistantModel({ ANTHROPIC_MODEL: "claude-opus-5-5" } as any)).not.toBe("claude-opus-5-5");
    expect(assistantModel({ ASSISTANT_MODEL: "x-modelo" } as any)).toBe("x-modelo");
  });
  it("sin ANTHROPIC_API_KEY queda desactivada", () => {
    expect(assistantEnabled({} as any)).toBe(false);
    expect(assistantEnabled({ ANTHROPIC_API_KEY: "k" } as any)).toBe(true);
  });
});

describe("solo lectura", () => {
  it("pedirle cambiar un precio no cambia nada: la herramienta no existe", async () => {
    const { create, deps } = setup([
      { name: "cambiar_precio", input: { sku: "X", precio: 1 } },
      { name: "resumen_ventas", input: { periodo: "mes", accion: "borrar" } },
    ]);
    await ask(admin, "sube el precio de las fajas a 1 peso", deps);
    expect(deps.breakdown).not.toHaveBeenCalled();
    expect(toolResults(create).every((r: any) => r.error)).toBe(true);
  });
  it("ninguna herramienta ofrecida escribe", () => {
    const names = toolsFor(admin).map((t) => t.name);
    expect(names).toEqual(["resumen_ventas", "top_productos", "cobros", "comparar_periodos"]);
    expect(names.join()).not.toMatch(/cambiar|crear|borrar|anular|ajustar|escribir/);
  });
});
