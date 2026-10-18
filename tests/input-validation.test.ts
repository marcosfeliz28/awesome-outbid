import { describe, expect, it } from "vitest";
import { saleSchema, z } from "../packages/shared/src/index";
import { AlertsController } from "../apps/api/src/alerts";
import { parse } from "../apps/api/src/common";

const ID = "c84ed8d8-fb39-4577-a324-7d5cf8ee8142";

describe("3ag · entradas estrictas y acotadas", () => {
  it("rechaza campos extra en la raíz y en objetos anidados sin perder refinamientos", () => {
    const schema = z
      .object({
        customer: z.object({ name: z.string().trim().min(2) }).optional(),
        lines: z.array(z.object({ qty: z.number().positive() })).min(1),
      })
      .refine((value) => value.lines.length > 0, "sin líneas");
    expect(() =>
      parse(schema, {
        customer: { name: " Ana " },
        lines: [{ qty: 1 }],
        role: "admin",
      }),
    ).toThrow();
    expect(() =>
      parse(schema, {
        customer: { name: " Ana ", branchId: "otra" },
        lines: [{ qty: 1 }],
      }),
    ).toThrow();
    expect(() => parse(schema, { lines: [{ qty: 1, price: 0 }] })).toThrow();
    expect(
      parse(schema, { customer: { name: " Ana " }, lines: [{ qty: 1 }] }),
    ).toEqual({ customer: { name: "Ana" }, lines: [{ qty: 1 }] });
    expect(() => parse(schema, { lines: [{ qty: -1 }] })).toThrow();
  });

  it("acota listas y diccionarios aunque el esquema original no ponga máximo", () => {
    const schema = z.object({
      values: z.array(z.string()),
      attributes: z.record(z.string()),
    });
    expect(() =>
      parse(schema, { values: Array(1001).fill("a"), attributes: {} }),
    ).toThrow();
    expect(() =>
      parse(schema, {
        values: [],
        attributes: Object.fromEntries(
          Array.from({ length: 1001 }, (_, i) => [String(i), "a"]),
        ),
      }),
    ).toThrow();
    expect(
      parse(schema, {
        values: Array(1000).fill("a"),
        attributes: { talla: "M" },
      }).values,
    ).toHaveLength(1000);
  });

  it("rechaza árboles excesivamente profundos y texto enorme antes de zod", () => {
    let nested: unknown = "fin";
    for (let i = 0; i < 25; i++) nested = { child: nested };
    expect(() => parse(z.unknown(), nested)).toThrow();
    expect(() => parse(z.string(), "a".repeat(300001))).toThrow();
  });

  it("conserva defaults, objetos parciales, records, uniones y límites de negocio", () => {
    const schema = z.object({
      name: z.string().trim().default("Nexora"),
      detail: z
        .object({ id: z.string(), qty: z.number().positive() })
        .partial(),
      attributes: z.record(z.string()),
      variant: z.union([
        z.object({ mode: z.literal("a"), qty: z.number() }),
        z.object({ mode: z.literal("b"), label: z.string() }),
      ]),
    });
    expect(
      parse(schema, {
        detail: {},
        attributes: { talla: "M" },
        variant: { mode: "a", qty: 2 },
      }),
    ).toEqual({
      name: "Nexora",
      detail: {},
      attributes: { talla: "M" },
      variant: { mode: "a", qty: 2 },
    });
    expect(() =>
      parse(schema, {
        detail: {},
        attributes: {},
        variant: { mode: "a", qty: 2, branchId: "otro" },
      }),
    ).toThrow();
    expect(() => parse(saleSchema, { offlineUuid: ID, items: [] })).toThrow();
  });

  it("mantiene el sobre passthrough explícito de sincronización para validar cada venta por separado", () => {
    const schema = z.object({
      sales: z
        .array(z.object({ offlineUuid: z.string().uuid() }).passthrough())
        .max(100),
    });
    const input = { sales: [{ offlineUuid: ID, items: [{ qty: 1 }] }] };
    expect(parse(schema, input)).toEqual(input);
    expect(() => parse(schema, { ...input, admin: true })).toThrow();
  });
  it("la paginación de alertas no convierte listas en un escalar", async () => {
    const controller = new AlertsController(
      {} as any,
      { evaluate: async () => {} } as any,
    );
    await expect(
      controller.alerts({ branchId: "main" } as any, { limit: ["2"] }),
    ).rejects.toMatchObject({ name: "ZodError" });
  });
});
