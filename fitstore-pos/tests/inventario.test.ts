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
  // Revisión adversarial R9 (docs/validacion/ronda9-revision-adversarial.json).
  it("R9-importador-1: hipervínculos, errores de Excel y fórmulas se leen o se rechazan con diagnóstico, nunca como «[object Object]»", async () => {
    expect(parseNumber({ error: "#N/A" } as any)).toMatch(/error #N\/A/);
    expect(
      parseNumber({ formula: "1/0", result: { error: "#DIV/0!" } } as any),
    ).toMatch(/error #DIV\/0!/);
    expect(parseNumber({ formula: "F2*2" } as any)).toMatch(
      /fórmula sin valor calculado/,
    );
    expect(parseNumber({ sharedFormula: "E2" } as any)).toMatch(
      /fórmula sin valor calculado/,
    );
    expect(parseNumber({ formula: "E2*2", result: 8 } as any)).toBe(8);
    // Hipervínculo (también con texto con formato) y fórmulas con resultado,
    // incluido 0, que ExcelJS quita de cell.value.
    const ok = await readInventory(
      await workbook([
        [
          2001,
          {
            text: "Faja Colombiana Talla M",
            hyperlink: "https://proveedor.example/faja",
          },
          "2001",
          "Fajas",
          4,
          900,
          1800,
        ],
        [
          { formula: "1001+1001", result: 2002 },
          {
            text: { richText: [{ text: "Corrector " }, { text: "Fawn" }] },
            hyperlink: "https://proveedor.example/fawn",
          },
          { formula: 'A3&""', result: "2002" },
          { formula: 'IF(1,"Maquillaje")', result: "Maquillaje" },
          { formula: "E2*0", result: 0 },
          { formula: "F2/3", result: 300 },
          450,
        ],
      ]),
    );
    expect(
      ok.map((r) => [r.id, r.name, r.category, r.qty, r.cost, r.price]),
    ).toEqual([
      ["2001", "Faja Colombiana Talla M", "Fajas", 4, 900, 1800],
      ["2002", "Corrector Fawn", "Maquillaje", 0, 300, 450],
    ]);
    const bad = readInventory(
      await workbook([
        [
          2003,
          "Corrector Fawn",
          "2003",
          { formula: "VLOOKUP(A4,X:Y,2,0)", result: { error: "#N/A" } },
          6,
          200,
          450,
        ],
        [2004, { error: "#REF!" }, "2004", "Fajas", 1, 900, 1800],
        [
          { formula: "A3+1", result: 2005 },
          "Faja sin calcular",
          "2005",
          "Fajas",
          1,
          900,
          { formula: "F4*2" },
        ],
        // Fórmula compartida copiada de A4 y guardada sin calcular.
        [{ sharedFormula: "A4" }, "Sin ID calculado", "", "Fajas", 1, 1, 2],
      ]),
    );
    await expect(bad).rejects.toThrow(
      /fila 2003, SUB-GRUPO: la celda tiene el error #N\/A[\s\S]*fila 2004, DESCRIPCION: la celda tiene el error #REF![\s\S]*fila 2005, PRECIO DETALLE: fórmula sin valor calculado; abre el archivo en Excel y guárdalo[\s\S]*fila 5 del Excel, ID: fórmula sin valor calculado/,
    );
    await expect(bad).rejects.not.toThrow(/object/);
  });
  it("R9-importador-2: una fila con datos sin ID o sin DESCRIPCION detiene la carga; la fila TOTAL y las vacías se ignoran", async () => {
    const total = [
      { formula: "COUNTA(A2:A4)", result: 2 },
      null,
      null,
      "TOTAL",
      { formula: "SUM(E2:E4)", result: 9 },
      null,
      null,
    ];
    await expect(
      readInventory(
        await workbook([
          [1700, "", "1700", "Fajas", 5, 900, 1800],
          [null, "Faja sin código", null, "Fajas", 3, 900, 1800],
          [1701, "Faja ok", "1701", "Fajas", 1, 900, 1800],
          [null, null, null, "Fajas", 2, null, null],
          total,
        ]),
      ),
    ).rejects.toThrow(
      /fila 2 del Excel \(ID 1700\): falta DESCRIPCION[\s\S]*fila 3 del Excel: falta ID[\s\S]*fila 5 del Excel: falta ID y DESCRIPCION/,
    );
    const rows = await readInventory(
      await workbook([
        [1701, "Faja ok", "1701", "Fajas", 1, 900, 1800],
        ["", "", "", "", "", "", ""],
        [null, null, null, "Fajas", null, null, null],
        [1702, "Faja ok 2", "1702", "Fajas", 8, 900, 1800],
        total,
      ]),
    );
    expect(rows.map((r) => r.id)).toEqual(["1701", "1702"]);
  });
});
