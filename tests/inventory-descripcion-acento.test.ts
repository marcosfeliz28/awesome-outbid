// La cabecera «DESCRIPCIÓN» (con tilde) del Excel de la tienda debe mapear a la
// misma columna de nombre que «DESCRIPCION»: la clave de cabecera ignora tildes.
import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { readInventory } from "../apps/api/src/inventory-import-core";

const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");

async function book(header: string) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario");
  ws.addRow([
    "ID",
    header,
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIO DETALLE",
  ]);
  ws.addRow([1001, "Proteína vainilla", "", "Suplementos", 2, 10, 20]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("importador de inventario · cabecera DESCRIPCION con o sin tilde", () => {
  it.each(["DESCRIPCION", "DESCRIPCIÓN"])(
    "la cabecera «%s» mapea al nombre del producto",
    async (header) => {
      const rows = await readInventory(await book(header));
      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("Proteína vainilla");
    },
  );
});
