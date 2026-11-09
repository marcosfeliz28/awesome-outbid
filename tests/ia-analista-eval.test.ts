// Asistente analista: las 100 preguntas de docs/ia/ASISTENTE_ANALISTA_EVAL_100.md
// sin llamar a Anthropic (modelo guionado, datos fijos «Demo Uno · Centro»).
import { describe, expect, it, vi } from "vitest";
import { BLOQUEANTES, CASOS, evaluar } from "./ia-analista/casos";
import {
  IA_ANALISTA_FEATURE,
  IA_COSTO_TOPE_USD,
  ask,
  featureOf,
  toolsFor,
} from "../apps/api/src/assistant";

// Sin huecos: las 8 preguntas que pedían cifras brutas se comprueban en neto
// (regla D-05); el bruto se deriva de neto + devoluciones. Ver docs/sistema/IA_ANALISTA.md.
const HUECOS: string[] = [];

describe("evaluación de 100 preguntas (sin Anthropic)", async () => {
  const filas = await evaluar();
  const pasan = filas.filter((f) => f.pasa).length;
  console.log(
    `[ia-analista] precisión ${pasan}/100 · ` +
      ["dato", "derivado", "rechazo", "prompt"]
        .map(
          (t) =>
            `${t} ${filas.filter((f) => f.tipo === t && f.pasa).length}/${filas.filter((f) => f.tipo === t).length}`,
        )
        .join(" · ") +
      "\n" +
      filas
        .filter((f) => !f.pasa)
        .map((f) => `  ${f.id}: ${f.motivo}`)
        .join("\n"),
  );
  it("son 100 casos con id único", () => {
    expect(new Set(CASOS.map((c) => c.id)).size).toBe(100);
  });
  it("los casos bloqueantes de seguridad pasan todos", () => {
    expect(filas.filter((f) => BLOQUEANTES.includes(f.id) && !f.pasa)).toEqual(
      [],
    );
  });
  it("no falla ninguna pregunta", () => {
    expect(filas.filter((f) => !f.pasa).map((f) => f.id)).toEqual(HUECOS);
  });
  it("los avisos del servidor llegan completos al modelo (no se recortan a 80)", () => {
    const r = filas.find((f) => f.id === "AA-095")!.corrida!;
    expect(r.alModelo).toContain(
      "no des una cifra como segura; muestra las lecturas y la diferencia.",
    );
  });
  it("cada pregunta mide con feature ia_analista y no guarda texto", () => {
    for (const f of filas) {
      const r = f.corrida!;
      expect(r.reservas[0][3]).toEqual({
        feature: IA_ANALISTA_FEATURE,
        maxCostUsd: IA_COSTO_TOPE_USD.analista,
      });
      const pregunta = CASOS.find((c) => c.id === f.id)!.pregunta;
      expect(JSON.stringify([r.reservas, r.cierres])).not.toContain(pregunta);
      expect(Object.keys(r.cierres[0][1]).sort()).toEqual([
        "inputTokens",
        "ok",
        "outputTokens",
      ]);
    }
  });
});

describe("plan y medidor del analista", () => {
  const dueña = {
    id: "u",
    role: "admin",
    permissions: ["*"],
    branchId: "centro",
  } as any;
  it("las herramientas nuevas solo existen con plan analista", () => {
    expect(toolsFor(dueña, "completo").map((t) => t.name)).toEqual([
      "resumen_ventas",
      "top_productos",
      "cobros",
      "comparar_periodos",
    ]);
    expect(toolsFor(dueña, "analista").length).toBe(10);
    expect(featureOf("completo")).toBe("ia_ventas");
    expect(featureOf("analista")).toBe("ia_analista");
  });
  it("ningún esquema acepta sucursal, empresa ni usuario", () => {
    const props = JSON.stringify(
      toolsFor(dueña, "analista").map((t) => t.input_schema),
    );
    for (const k of [
      "branch",
      "sucursal",
      "empresa",
      "tenant",
      "company",
      "userId",
      "usuario",
    ])
      expect(props).not.toContain(k);
  });
  it("tope de costo: no se llama al modelo y se avisa", async () => {
    const create = vi.fn();
    const r = await ask(dueña, "hola", {
      client: { create },
      breakdown: vi.fn(),
      mine: vi.fn(),
      usage: {
        reserve: async () => ({ id: null, used: 3, byCost: true }),
        settle: vi.fn(),
      },
      limit: 30,
      plan: "analista",
    } as any);
    expect(create).not.toHaveBeenCalled();
    expect(r).toMatchObject({ limited: true });
    expect(r.answer).toMatch(/tope de costo/);
  });
  it("más de 4 herramientas en una ronda: las demás reciben error", async () => {
    let n = 0;
    const create = async () =>
      ++n === 1
        ? {
            content: Array.from({ length: 6 }, (_, i) => ({
              type: "tool_use",
              id: "t" + i,
              name: "inventario_bajo",
              input: {},
            })),
            usage: {},
          }
        : { content: [{ type: "text", text: "ok" }], usage: {} };
    const r = await ask(dueña, "x", {
      client: { create },
      breakdown: vi.fn(),
      mine: vi.fn(),
      stock: async () => [],
      report: async () => ({ rows: [] }),
      usage: {
        reserve: async () => ({ id: "q", used: 1 }),
        settle: async () => {},
      },
      limit: 30,
      plan: "analista",
    } as any);
    expect(
      r.used.filter((u: any) => /Máximo 4/.test(u.error ?? "")),
    ).toHaveLength(2);
  });
});
