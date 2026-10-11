import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";

// Usar exactamente el lector instalado de la API, sin runtime externo.
const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");
const { values } = parseArgs({
  options: { output: { type: "string" }, help: { type: "boolean" } },
});
if (values.help) {
  console.log(
    "Uso: node scripts/create-merchandise-template.mjs --output <carpeta-de-salida>",
  );
  process.exit(0);
}
if (!values.output?.trim()) {
  throw new Error(
    "Indica --output <carpeta-de-salida>. El generador no reemplaza la plantilla publicada por defecto.",
  );
}
const output = path.resolve(values.output);
const workbook = new ExcelJS.Workbook();
workbook.creator = "Nexora";
const sheet = workbook.addWorksheet("Mercancia", {
  views: [
    {
      state: "frozen",
      xSplit: 1,
      ySplit: 1,
      topLeftCell: "B2",
      showGridLines: false,
    },
  ],
});
const headers = [
  "codigo",
  "descripcion",
  "cantidad",
  "costo",
  "lote",
  "vencimiento",
];
const widths = [18, 44, 15, 18, 22, 22];
const formats = ["@", "General", "0.###", "0.00", "@", "yyyy-mm-dd"];
const bodyFont = { name: "Arial", size: 11, color: { argb: "FF172033" } };
for (let column = 1; column <= 6; column++)
  sheet.getColumn(column).width = widths[column - 1];
sheet.getRow(1).values = headers;
sheet.getRow(1).height = 30;
for (let column = 1; column <= 6; column++) {
  const cell = sheet.getCell(1, column);
  cell.font = { ...bodyFont, bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF3730A3" },
  };
  cell.alignment = { horizontal: "center", vertical: "middle" };
}
// 200 filas reservadas, sin productos de ejemplo ni formulas.
for (let row = 2; row <= 201; row++) {
  sheet.getRow(row).height = 23;
  for (let column = 1; column <= 6; column++) {
    const cell = sheet.getCell(row, column);
    cell.font = bodyFont;
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFBE6" },
    };
    cell.numFmt = formats[column - 1];
    cell.alignment = {
      horizontal:
        column === 3 || column === 4 || column === 6 ? "right" : "left",
      vertical: "middle",
    };
  }
}
const instructions = workbook.addWorksheet("Instrucciones", {
  views: [{ showGridLines: false }],
});
instructions.getColumn(1).width = 25;
instructions.getColumn(2).width = 104;
for (let row = 1; row <= 16; row++) {
  instructions.getRow(row).height = 28;
  for (let column = 1; column <= 2; column++) {
    instructions.getCell(row, column).font = bodyFont;
    instructions.getCell(row, column).alignment = {
      horizontal: "left",
      vertical: "middle",
    };
  }
}
instructions.getCell("A2").value = "Entrada de mercancía";
instructions.getCell("A2").font = { ...bodyFont, size: 16, bold: true };
const guidance = [
  [
    "Dónde usarla",
    "Mercancía > Entrada > Importar factura. Selecciona Excel (.xlsx).",
  ],
  [
    "Antes de confirmar",
    "El Excel no importa lote ni vencimiento automáticamente. Escríbelos en cada línea de revisión.",
  ],
  [
    "Mapeo",
    "Código: codigo. Descripción: descripcion. Cantidad: cantidad. Costo unitario: costo.",
  ],
  [
    "Código y lote",
    "Escríbelos como texto para conservar ceros iniciales. Ejemplo de código: 001033.",
  ],
  [
    "Cantidad",
    "Unidades recibidas mayores que 0. No incluyas subtotales ni filas de totales.",
  ],
  [
    "Costo",
    "Costo unitario antes de impuestos, en RD$. Número mayor que 0, sin símbolos.",
  ],
  [
    "Lote",
    "Número del lote en el empaque. Una fila por producto y lote. No inventes el lote.",
  ],
  [
    "Vencimiento",
    "Fecha real del empaque, AAAA-MM-DD. No uses una fecha ficticia si no está disponible.",
  ],
  [
    "Límites",
    "Hasta 200 líneas por archivo. Para más productos, crea archivos separados.",
  ],
  [
    "Revisión",
    "Confirma producto, cantidad, costo, lote y vencimiento antes de guardar la entrada.",
  ],
  [
    "Archivo vacío",
    "La hoja Mercancia no trae productos de ejemplo. Llena desde la fila 2, sin cambiar encabezados.",
  ],
];
for (const [index, content] of guidance.entries()) {
  instructions.getRow(index + 4).values = content;
  instructions.getCell(index + 4, 1).font = {
    ...bodyFont,
    bold: true,
    color: { argb: "FF3730A3" },
  };
}
await fs.mkdir(output, { recursive: true });
const filename = path.join(output, "ENTRADA-MERCANCIA-LOTES.xlsx");
// Nunca pisar silenciosamente un archivo que ya tenga datos o este publicado.
await fs.writeFile(filename, Buffer.from(await workbook.xlsx.writeBuffer()), {
  flag: "wx",
});
console.log(`Plantilla generada: ${filename}`);
