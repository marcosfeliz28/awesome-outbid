import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { readInvoiceTable } from "../apps/api/src/invoice";

const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");
const path = new URL(
  "../docs/plantillas/ENTRADA-MERCANCIA-LOTES.xlsx",
  import.meta.url,
);
const mapping = {
  code: "codigo",
  description: "descripcion",
  qty: "cantidad",
  unitCost: "costo",
};

it("plantilla vacía: columnas reales, códigos texto y aviso de lote manual", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path));
  const sheet = workbook.worksheets[0];
  expect(sheet.name).toBe("Mercancia");
  expect(sheet.getRow(1).values.slice(1)).toEqual([
    "codigo",
    "descripcion",
    "cantidad",
    "costo",
    "lote",
    "vencimiento",
  ]);
  expect(sheet.getCell("A2").numFmt).toBe("@");
  expect(sheet.getCell("E2").numFmt).toBe("@");
  expect(sheet.getCell("F2").numFmt).toBe("yyyy-mm-dd");
  expect(sheet.getCell("A2").value).toBeNull();
  expect(workbook.getWorksheet("Instrucciones").getCell("B5").value).toContain(
    "no importa lote ni vencimiento",
  );
  await expect(
    readInvoiceTable(readFileSync(path), "xlsx", mapping),
  ).rejects.toThrow("No encontramos líneas");
});

it("roundtrip: llenado y lector real conservan ceros, decimales y columnas auxiliares", async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(readFileSync(path));
  workbook.worksheets[0].getRow(2).values = [
    "001033",
    "Producto de prueba",
    2.5,
    800.25,
    "0007",
    new Date("2028-06-30T00:00:00Z"),
  ];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const result = await readInvoiceTable(buffer, "xlsx", mapping);
  expect(result.lines).toHaveLength(1);
  expect(result.lines[0]).toMatchObject({
    code: "001033",
    description: "Producto de prueba",
    qty: 2.5,
    unitCost: 800.25,
  });
  expect(result.lines[0].lotNumber).toBeUndefined();
  expect(result.lines[0].expiryDate).toBeUndefined();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(buffer);
  expect(reopened.worksheets[0].getCell("E2").value).toBe("0007");
  expect(
    reopened.worksheets[0].getCell("F2").value.toISOString().slice(0, 10),
  ).toBe("2028-06-30");
});
