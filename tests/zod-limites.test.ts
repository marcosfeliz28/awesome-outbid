// Mitigación del aviso de zod (seguridad 16): las colecciones que llegan en el cuerpo
// tienen tope. Un array enorme se rechaza antes de tocar la base; un uso normal no cambia.
import { describe, expect, it } from "vitest";
import { alertRulesBody } from "../apps/api/src/alerts";
import { categoryBody } from "../apps/api/src/catalog";

const rule = { type: "low_margin", active: true, threshold: { min: 15 } };

describe("tope de colecciones en el cuerpo (zod)", () => {
  it("reglas de alerta: 100 pasan, 101 se rechazan", () => {
    expect(alertRulesBody.safeParse({ rules: Array(100).fill(rule) }).success).toBe(true);
    expect(alertRulesBody.safeParse({ rules: Array(101).fill(rule) }).success).toBe(false);
    expect(alertRulesBody.safeParse({ rules: [] }).success).toBe(true);
  });

  it("categorías: 30 atributos pasan, 31 se rechazan; el valor por defecto sigue", () => {
    const base = { name: "Proteínas" };
    expect(categoryBody.safeParse({ ...base, attributes: Array(30).fill("sabor") }).success).toBe(true);
    expect(categoryBody.safeParse({ ...base, attributes: Array(31).fill("sabor") }).success).toBe(false);
    const parsed = categoryBody.parse(base);
    expect(parsed.attributes).toEqual([]);
    expect(parsed.color).toBe("#7C3AED");
  });
});
