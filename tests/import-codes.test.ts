// Códigos con ceros iniciales en el importador de facturas: Excel guarda
// 00123 como el número 123 con formato «00000»; el CSV trae el texto tal cual.
// En ambos casos el código debe llegar con sus ceros para encontrar el
// producto.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readInvoiceTable } from "../apps/api/src/invoice";

const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");
const map = {
  code: "codigo",
  description: "descripcion",
  qty: "cantidad",
  unitCost: "costo",
};

describe("Importador: códigos con ceros iniciales", () => {
  it("XLSX: un código numérico con formato de relleno conserva sus ceros", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factura");
    ws.addRow(["Codigo", "Descripcion", "Cantidad", "Costo"]);
    ws.addRow([123, "Proteína", 2, 100]);
    ws.addRow(["000456", "Creatina", 1, 50]);
    ws.addRow([7501234567890, "Barra", 3, 10]);
    ws.getCell("A2").numFmt = "00000";
    const out = await readInvoiceTable(
      Buffer.from(await wb.xlsx.writeBuffer()),
      "xlsx",
      map,
    );
    expect(out.lines.map((l: any) => l.code)).toEqual([
      "00123",
      "000456",
      "7501234567890",
    ]);
  });
  it("CSV: el código se conserva como texto", async () => {
    const csv = "Codigo,Descripcion,Cantidad,Costo\n00123,Proteína,2,100\n";
    const out = await readInvoiceTable(Buffer.from(csv), "csv", map);
    expect(out.lines[0].code).toBe("00123");
  });
});
