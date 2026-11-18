import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { marginHint } from "../apps/web/src/productMargin";

// COM-03: aviso del margen al escribir precio y costo (solo informa).
it("precio 100 y costo 85 = 15 %: cumple el mínimo", () => {
  const t = marginHint("100", "85");
  expect(t).toContain("Margen: 15 %");
  expect(t).toContain("Cumple el mínimo de 15 %");
});

it("precio 100 y costo 86 = 14 %: avisa que está por debajo", () => {
  const t = marginHint(100, 86);
  expect(t).toContain("Margen: 14 %");
  expect(t).toContain("por debajo del mínimo de 15 %");
});

it("precio 100 y costo 84 = 16 %: cumple", () => {
  expect(marginHint(100, 84)).toContain("Cumple el mínimo");
});

it("la fórmula no resta ITBIS y lo dice", () => {
  expect(marginHint(118, 59)).toContain("Margen: 50 %");
  expect(marginHint(118, 59)).toContain("sin restar ITBIS");
});

it("costo 0 da 100 % y costo mayor que el precio da un margen negativo", () => {
  expect(marginHint(100, 0)).toContain("Margen: 100 %");
  const t = marginHint(100, 120);
  expect(t).toContain("Margen: -20 %");
  expect(t).toContain("por debajo");
});

it("precio vacío, cero o inválido, o costo vacío o negativo, no muestran un margen", () => {
  for (const [p, c] of [
    ["", "50"],
    ["0", "50"],
    ["abc", "50"],
    ["100", ""],
    ["100", "-1"],
    [null, 10],
    [100, undefined],
  ] as const)
    expect(marginHint(p, c)).toBe("");
});

it("respeta el mínimo configurado y usa 15 % si no hay uno válido", () => {
  expect(marginHint(100, 75, 30)).toContain("por debajo del mínimo de 30 %");
  expect(marginHint(100, 75, 20)).toContain("Cumple el mínimo de 20 %");
  expect(marginHint(100, 86, undefined)).toContain("mínimo de 15 %");
  expect(marginHint(100, 86, "basura")).toContain("mínimo de 15 %");
});

it("los formularios de alta de producto y de edición de variante usan el aviso", () => {
  const src = readFileSync("apps/web/src/Management.tsx", "utf8");
  expect(src).toContain("fields={withMargin(fields)}");
  expect(src).toContain("withMargin([");
  expect(src).toContain('f.key === "costAvg"');
  expect(src).toContain("marginHint(values.price, values.costAvg, lowMargin, en)");
});

it("English keeps the same margin and threshold, only labels change", () => {
  expect(marginHint(100,86,15,true)).toBe("Margin: 14 % (price − cost) ÷ price, without subtracting ITBIS. Below the minimum of 15 %.");
  expect(marginHint(100,85,15,true)).toContain("Meets the minimum of 15 %.");
  expect(marginHint("",85,15,true)).toBe("");
});
