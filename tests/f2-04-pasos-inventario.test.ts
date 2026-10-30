import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { merchandiseStep } from "../apps/web/src/merchandiseSteps";

it("Mercancía: el paso sale de lo que ya hay en pantalla", () => {
  expect(merchandiseStep({ lines: 0, hasDraft: false, done: false })).toBe(2);
  expect(merchandiseStep({ lines: 2, hasDraft: false, done: false })).toBe(3);
  expect(merchandiseStep({ lines: 0, hasDraft: true, done: false })).toBe(3);
  expect(merchandiseStep({ lines: 2, hasDraft: true, done: true })).toBe(4);
});

it("Inventario: tres pestañas y el panel de almacenes solo en la tercera", () => {
  const src = readFileSync("apps/web/src/Management.tsx", "utf8");
  for (const t of ["Stock actual", "Conteos físicos", "Almacenes y traspasos"])
    expect(src).toContain(t);
  expect(src.match(/<WarehousesPanel/g)).toHaveLength(1);
  expect(src).toMatch(/mode === "warehouses" \? \(\s*<WarehousesPanel/);
});
