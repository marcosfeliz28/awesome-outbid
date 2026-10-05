// Lector del Excel de inventario de la tienda (apps/api/scripts/import-inventario.ts).
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  brandOf,
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
});
