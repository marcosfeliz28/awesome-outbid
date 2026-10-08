import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const apiRequire = createRequire(path.resolve("apps/api/package.json"));
const ExcelJS = apiRequire("exceljs");
const { version: exceljsVersion } = apiRequire("exceljs/package.json");
if (!exceljsVersion.startsWith("4.4.")) {
  throw new Error(`Se requiere ExcelJS 4.4; se encontró ${exceljsVersion}.`);
}

const [referencePath, latestPath, outputPath] = process.argv.slice(2);
if (!referencePath || !latestPath || !outputPath) {
  throw new Error(
    "Uso: node scripts/build-inventory-import.mjs referencias.xls ultimo.xls salida.xlsx",
  );
}

const extractor = path.resolve("scripts/extract-legacy-inventory.ps1");
const raw = execFileSync(
  "powershell.exe",
  [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    extractor,
    "-ReferencePath",
    referencePath,
    "-LatestPath",
    latestPath,
  ],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);
const data = JSON.parse(raw.replace(/^\uFEFF/, ""));

const workbook = new ExcelJS.Workbook();
const inventory = workbook.addWorksheet("Inventario", {
  views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
});
const adjustments = workbook.addWorksheet("Ajustes", {
  views: [{ state: "frozen", ySplit: 1, showGridLines: false }],
});
const fontFamily = "Arial";

const headers = [
  "ID",
  "DESCRIPCION",
  "REFERENCIA",
  "SUB-GRUPO DE ARTICULO",
  "UNIDAD",
  "EXISTENCIA",
  "COSTO",
  "PRECIO DETALLE",
  "FILA ORIGEN",
  "AJUSTE APLICADO",
];
const rows = data.rows.map((row) => [
  String(row.id ?? ""),
  row.name,
  String(row.reference ?? ""),
  row.category,
  row.unit,
  row.qty,
  row.cost,
  row.price,
  row.sourceRow,
  row.adjustment,
]);
inventory.addTable({
  name: "InventarioImportacion",
  ref: "A1",
  headerRow: true,
  totalsRow: false,
  style: { theme: "TableStyleMedium2", showRowStripes: true },
  columns: headers.map((name) => ({ name })),
  rows,
});

const widths = [13, 58, 20, 25, 10, 13, 15, 17, 12, 52];
for (let col = 1; col <= widths.length; col += 1) {
  inventory.getColumn(col).width = widths[col - 1];
}
inventory.getColumn(1).numFmt = "@";
inventory.getColumn(3).numFmt = "@";
inventory.getColumn(6).numFmt = "#,##0.###";
inventory.getColumn(7).numFmt = '"RD$"#,##0.00';
inventory.getColumn(8).numFmt = '"RD$"#,##0.00';
inventory.getColumn(9).numFmt = "0";
inventory.eachRow((row, rowNumber) => {
  for (let col = 1; col <= headers.length; col += 1) {
    const cell = row.getCell(col);
    cell.font = { name: fontFamily, size: 10, color: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", wrapText: false };
  }
  if (rowNumber === 1) {
    row.height = 32;
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF312E81" },
      };
      cell.font = {
        name: fontFamily,
        size: 10,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
  }
});

const adjustmentHeaders = [
  "FILA ORIGEN",
  "ID",
  "PRODUCTO",
  "GRUPO",
  "AJUSTE APLICADO",
];
const adjustmentRows = data.adjustments.map((row) => [
  row.sourceRow,
  String(row.id ?? ""),
  row.product,
  row.category,
  row.adjustment,
]);
if (adjustmentRows.length) {
  adjustments.addTable({
    name: "AjustesImportacion",
    ref: "A1",
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: adjustmentHeaders.map((name) => ({ name })),
    rows: adjustmentRows,
  });
} else {
  adjustments.addRow(adjustmentHeaders);
}
const adjustmentWidths = [12, 13, 58, 25, 66];
for (let col = 1; col <= adjustmentWidths.length; col += 1) {
  adjustments.getColumn(col).width = adjustmentWidths[col - 1];
}
adjustments.getColumn(2).numFmt = "@";
adjustments.eachRow((row, rowNumber) => {
  for (let col = 1; col <= adjustmentHeaders.length; col += 1) {
    const cell = row.getCell(col);
    cell.font = { name: fontFamily, size: 10, color: { argb: "FF111827" } };
    cell.alignment = { vertical: "middle", wrapText: false };
  }
  if (rowNumber === 1) {
    row.height = 32;
    row.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF92400E" },
      };
      cell.font = {
        name: fontFamily,
        size: 10,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });
  }
});

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await workbook.xlsx.writeFile(outputPath);

console.log(
  JSON.stringify(
    {
      outputPath,
      exceljsVersion,
      rows: data.rows.length,
      adjustments: data.adjustments.length,
    },
    null,
    2,
  ),
);
