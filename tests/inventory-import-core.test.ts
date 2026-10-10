// Módulo compartido de importación de inventario (sin base de datos).
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  InventoryFileError,
  checkCodesDetailed,
  readInventory,
} from "../apps/api/src/inventory-import-core";
import { countReason } from "../apps/api/src/inventory-import";

const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");
async function book(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario");
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
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("importador de inventario · módulo compartido", () => {
  it("lee desde memoria y conserva el número de fila del Excel", async () => {
    const rows = await readInventory(
      await book([
        [1, "Uno", "", "Fajas", 2, 10, 20],
        [2, "Dos", "", "Fajas", 3, 10, 20],
      ]),
    );
    expect(rows.map((r) => [r.id, r.line])).toEqual([
      ["1", 2],
      ["2", 3],
    ]);
  });
  it("los errores de celda traen la fila y el texto de siempre", async () => {
    const error = await readInventory(
      await book([[1, "Uno", "", "Fajas", "x", 10, 20]]),
    ).catch((e) => e);
    expect(error).toBeInstanceOf(InventoryFileError);
    expect(error.problems[0].row).toBe(2);
    expect(error.message).toContain("Corrige el Excel antes de importar");
  });
  it("respeta el máximo de filas", async () => {
    const buffer = await book(
      Array.from({ length: 5 }, (_, i) => [
        i + 1,
        "P" + i,
        "",
        "Fajas",
        1,
        1,
        2,
      ]),
    );
    await expect(readInventory(buffer, { maxRows: 4 })).rejects.toThrow(
      /máximo por carga es 4/,
    );
    await expect(readInventory(buffer, { maxRows: 5 })).resolves.toHaveLength(
      5,
    );
  });
  it("no evalúa fórmulas: usa el valor guardado y avisa si no hay", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario");
    ws.addRow([
      "ID",
      "DESCRIPCION",
      "REFERENCIA",
      "SUB-GRUPO DE ARTICULO",
      "EXISTENCIA",
      "COSTO",
      "PRECIO DETALLE",
    ]);
    ws.addRow([
      1,
      "Con valor",
      "",
      "Fajas",
      1,
      5,
      { formula: "2+2", result: 9 },
    ]);
    const ok = await readInventory(Buffer.from(await wb.xlsx.writeBuffer()));
    expect(ok[0].price).toBe(9);
    ws.addRow([2, "Sin valor", "", "Fajas", 1, 5, { formula: "2+2" }]);
    await expect(
      readInventory(Buffer.from(await wb.xlsx.writeBuffer())),
    ).rejects.toThrow(/fórmula sin valor calculado/);
  });
  it("los códigos repetidos señalan la fila", async () => {
    const rows = await readInventory(
      await book([
        [1, "Uno", "777", "Fajas", 1, 1, 2],
        [2, "Dos", "777", "Fajas", 1, 1, 2],
      ]),
    );
    const problems = checkCodesDetailed(rows);
    expect(problems).toHaveLength(1);
    expect(problems[0].row).toBe(2);
  });
  it("el motivo del conteo usa la fecha del negocio (Santo Domingo), sin fechas fijas", () => {
    expect(countReason(new Date("2031-03-05T03:00:00Z"))).toBe(
      "Conteo 4-mar-2031",
    );
    expect(countReason(new Date("2031-12-31T12:00:00Z"))).toBe(
      "Conteo 31-dic-2031",
    );
    expect(countReason()).toMatch(/^Conteo \d{1,2}-[a-z]{3}-\d{4}$/);
  });
});
