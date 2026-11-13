import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { filterCredits } from "../apps/web/src/codPendingSearch";

const rows = [
  {
    number: "FS-0000101",
    customer: { name: "María Pérez", phone: "809-555-0101" },
  },
  {
    number: "FS-0000102",
    customer: { name: "Jose Núñez", phone: "(829) 555 0102" },
  },
  { number: "FS-0000103", customer: null },
];

// COM-08: buscar créditos pendientes por cliente, factura o teléfono.
it("sin texto devuelve todas las filas", () => {
  expect(filterCredits(rows, "")).toHaveLength(3);
  expect(filterCredits(rows, "   ")).toHaveLength(3);
});

it("busca el nombre con o sin acento y sin importar mayúsculas", () => {
  expect(filterCredits(rows, "maria").map((r) => r.number)).toEqual([
    "FS-0000101",
  ]);
  expect(filterCredits(rows, "MARÍA pérez")).toHaveLength(1);
  expect(filterCredits(rows, "nunez")[0].number).toBe("FS-0000102");
});

it("busca por número de factura, completo o parcial", () => {
  expect(filterCredits(rows, "FS-0000103")).toHaveLength(1);
  expect(filterCredits(rows, "0000102")).toHaveLength(1);
});

it("busca por teléfono ignorando guiones, espacios y paréntesis", () => {
  expect(filterCredits(rows, "8295550102")).toHaveLength(1);
  expect(filterCredits(rows, "809 555")).toHaveLength(1);
  expect(filterCredits(rows, "55")).toHaveLength(0);
});

it("una fila sin cliente no rompe la búsqueda y sin coincidencias devuelve vacío", () => {
  expect(filterCredits(rows, "zzz")).toEqual([]);
});

it("la pantalla filtra lo ya cargado y distingue «sin coincidencias» de «sin créditos»", () => {
  const src = readFileSync("apps/web/src/Tienda.tsx", "utf8");
  expect(src).toContain("const shown = filterCredits(rows, search)");
  expect(src).toContain("Buscar por cliente, factura o teléfono");
  expect(src).toContain("No hay coincidencias");
  expect(src).toContain("en los resultados cargados");
  expect(src).toContain("{shown.map((r) => (");
});
