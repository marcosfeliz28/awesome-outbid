// Lector del Excel de inventario de la tienda (apps/api/scripts/import-inventario.ts).
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brandOf,
  checkCodes,
  parseNumber,
  readInventory,
  reviewOf,
} from "../apps/api/scripts/import-inventario";
const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");

async function workbook(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario 2026");
  ws.addRow([
    "ID",
    "DESCRIPCION",
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIO DETALLE",
  ]);
  rows.forEach((r) => ws.addRow(r));
  const file = join(mkdtempSync(join(tmpdir(), "inv-")), "inventario.xlsx");
  await wb.xlsx.writeFile(file);
  return file;
}

describe("importador de inventario · lectura del Excel", () => {
  it("el ID es el código; REFERENCIA o 'Barcode …' distintos son el código de barras", async () => {
    const rows = await readInventory(
      await workbook([
        [
          1001,
          "Opti-Men - Optimum Nutrition - 90 tabletas",
          "1001",
          "Suplementos",
          2,
          1250,
          1950,
        ],
        [
          1223,
          "L.A. Girl PRO.conceal HD GC983 Fawn | Barcode 081555969837",
          "081555969837",
          "Maquillaje",
          24,
          350,
          800,
        ],
        [1261, "Brocha doble", "6933045219981", "Maquillaje", 3, 130, 300],
        [1609, "Panty Negro M", "1609", "Fajas", 0, 1200, 2200],
        [1203, "Dollys Milk", "1203", "Maquillaje", 1, 0, 0],
      ]),
    );
    expect(rows.map((r) => [r.id, r.barcode])).toEqual([
      ["1001", null],
      ["1223", "081555969837"],
      ["1261", "6933045219981"],
      ["1609", null],
      ["1203", null],
    ]);
    expect(rows[1].name).toBe("L.A. Girl PRO.conceal HD GC983 Fawn");
    expect(rows[1].ref).toBe("081555969837");
    expect(brandOf(rows[0])).toBe("Optimum Nutrition");
    expect(reviewOf(rows[3])).toContain("sin existencia");
    expect(reviewOf(rows[4]).join(" ")).toMatch(/sin precio.*sin costo/);
  });
  it("faltando una columna avisa cuál", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Inventario").addRow(["ID", "DESCRIPCION"]);
    const file = join(mkdtempSync(join(tmpdir(), "inv-")), "x.xlsx");
    await wb.xlsx.writeFile(file);
    await expect(readInventory(file)).rejects.toThrow(/Faltan columnas/);
  });
  it("rechaza códigos que no identifican una sola fila", async () => {
    const rows = await readInventory(
      await workbook([
        [1261, "Brocha A", "6933045219981", "Maquillaje", 3, 130, 300],
        [1262, "Brocha B", "6933045219981", "Maquillaje", 5, 140, 320],
        [1299, "Producto 1299", "1299", "Maquillaje", 4, 10, 20],
        [1300, "Producto 1300", "1299", "Maquillaje", 6, 10, 20],
        [1301, "Producto 1301", "1301", "Maquillaje", 1, 10, 20],
        [1301, "Producto 1301 bis", "1301", "Maquillaje", 1, 10, 20],
      ]),
    );
    const problems = checkCodes(rows).join(" | ");
    expect(problems).toMatch(/6933045219981 aparece en los IDs 1261, 1262/);
    expect(problems).toMatch(/1299 de la fila 1300 es el ID de otra fila/);
    expect(problems).toMatch(/ID 1301 está repetido/);
  });
  // Sólo corre donde está el Excel real de la tienda (no va en el repositorio).
  const realFile =
    "/root/.claude/uploads/23da593f-ec17-5878-b235-b46f46c0ca44/42b04d18-INVENTARIO_2026_Actualizado.xlsx";
  it.skipIf(!existsSync(realFile))(
    "el inventario real de la tienda no tiene códigos ambiguos",
    async () => {
      const rows = await readInventory(realFile);
      expect(rows).toHaveLength(616);
      expect(checkCodes(rows)).toEqual([]);
    },
  );
  // Auditoría R7 (ChatGPT) · R7-02: números en texto.
  it("números en texto: formatos admitidos y ambiguos", () => {
    expect(parseNumber("1500")).toBe(1500);
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1.5")).toBe(1.5);
    expect(parseNumber("1.250,50")).toBe(1250.5);
    expect(parseNumber("1,250.50")).toBe(1250.5);
    expect(parseNumber("2.500,75")).toBe(2500.75);
    expect(parseNumber("RD$ 1.250,50")).toBe(1250.5);
    expect(parseNumber(12.5)).toBe(12.5);
    expect(parseNumber("1.250")).toMatch(/ambiguo/);
    expect(parseNumber("1,250")).toMatch(/ambiguo/);
    expect(parseNumber("1.2.3")).toMatch(/no válido/);
    expect(parseNumber("abc")).toMatch(/no válido/);
  });
  it("el Excel de QA de ChatGPT se lee bien o se rechaza con diagnóstico", async () => {
    const ok = await readInventory(
      await workbook([
        [9001, "QA texto", "9001", "Fajas", "1,5", "1.250,50", "2.500,75"],
      ]),
    );
    expect(ok[0]).toMatchObject({ qty: 1.5, cost: 1250.5, price: 2500.75 });
    await expect(
      readInventory(
        await workbook([
          [9002, "Ambiguo", "9002", "Fajas", "2", "1.250", "2000"],
          [9003, "Negativo", "9003", "Fajas", "-1", "10", "20"],
          [9004, "Fino", "9004", "Fajas", "1,0005", "10", "20"],
          [9005, "Centavos", "9005", "Fajas", "1", "10,555", "20"],
        ]),
      ),
    ).rejects.toThrow(
      /9002, COSTO: «1\.250» es ambiguo[\s\S]*9003, EXISTENCIA[\s\S]*9004, EXISTENCIA[\s\S]*9005, COSTO/,
    );
  });
});
