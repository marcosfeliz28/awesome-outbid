import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

// Run with the bundled Node runtime. Dependencies stay outside the repository.
const dependencyRoot = process.env.NEXORA_ARTIFACT_DEPENDENCIES;
if (!dependencyRoot)
  throw new Error(
    "Define NEXORA_ARTIFACT_DEPENDENCIES con el node_modules del runtime bundled.",
  );
const require = createRequire(path.join(dependencyRoot, "runtime.cjs"));
const { Workbook, SpreadsheetFile } = await import(
  pathToFileURL(require.resolve("@oai/artifact-tool")).href
);
const output = path.resolve("docs/plantillas");
await fs.mkdir(output, { recursive: true });
const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Mercancia");
sheet.showGridLines = false;
sheet.getRange("A1:F1").values = [
  ["codigo", "descripcion", "cantidad", "costo", "lote", "vencimiento"],
];
sheet.getRange("A1:F201").format.font = {
  name: "Arial",
  size: 11,
  color: "#172033",
};
sheet.getRange("A1:F1").format = {
  fill: "#3730A3",
  font: { name: "Arial", size: 11, bold: true, color: "#FFFFFF" },
  rowHeight: 30,
  horizontalAlignment: "center",
};
sheet.getRange("A2:F201").format = {
  fill: "#FFFBE6",
  rowHeight: 23,
  verticalAlignment: "center",
};
for (const [column, width] of [
  ["A", 18],
  ["B", 44],
  ["C", 15],
  ["D", 18],
  ["E", 22],
  ["F", 22],
])
  sheet.getRange(`${column}1:${column}201`).format.columnWidth = width;
sheet.getRange("A2:A201").setNumberFormat("@");
sheet.getRange("E2:E201").setNumberFormat("@");
sheet.getRange("C2:C201").setNumberFormat("0.###");
sheet.getRange("D2:D201").setNumberFormat("0.00");
sheet.getRange("F2:F201").setNumberFormat("yyyy-mm-dd");
sheet.freezePanes.freezeRows(1);
sheet.freezePanes.freezeColumns(1);
const instructions = workbook.worksheets.add("Instrucciones");
instructions.showGridLines = false;
instructions.getRange("A1:B16").format.font = {
  name: "Arial",
  size: 11,
  color: "#172033",
};
instructions.getRange("A1:A16").format.columnWidth = 25;
instructions.getRange("B1:B16").format.columnWidth = 104;
instructions.getRange("A1:B16").format.rowHeight = 28;
instructions.getRange("A2").values = [["Entrada de mercancía"]];
instructions.getRange("A2").format.font = {
  name: "Arial",
  size: 16,
  bold: true,
};
instructions.getRange("A4:B14").values = [
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
instructions.getRange("A4:A14").format.font = {
  name: "Arial",
  size: 11,
  bold: true,
  color: "#3730A3",
};
workbook.recalculate();
console.log(
  (
    await workbook.inspect({
      kind: "table",
      range: "Mercancia!A1:F3",
      include: "values,formulas",
      tableMaxRows: 3,
      tableMaxCols: 6,
    })
  ).ndjson,
);
console.log(
  (
    await workbook.inspect({
      kind: "match",
      searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
      options: { useRegex: true, maxResults: 20 },
    })
  ).ndjson,
);
for (const [sheetName, range] of [
  ["Mercancia", "A1:F8"],
  ["Instrucciones", "A1:B15"],
]) {
  const preview = await workbook.render({
    sheetName,
    range,
    scale: 1.3,
    format: "png",
  });
  await fs.writeFile(
    path.join(output, `${sheetName}-preview.png`),
    new Uint8Array(await preview.arrayBuffer()),
  );
}
await (
  await SpreadsheetFile.exportXlsx(workbook)
).save(path.join(output, "ENTRADA-MERCANCIA-LOTES.xlsx"));
// ExcelJS (the application's reader) requires the SpreadsheetML default
// namespace. Artifact exports an equivalent x: prefix that it cannot read.
// Normalize only that namespace, keeping worksheet values/styles untouched.
const JSZip = require("jszip");
const filename = path.join(output, "ENTRADA-MERCANCIA-LOTES.xlsx");
const zip = await JSZip.loadAsync(await fs.readFile(filename));
for (const entry of Object.values(zip.files)) {
  if (entry.dir || !entry.name.endsWith(".xml")) continue;
  const xml = await entry.async("string");
  if (
    !xml.includes(
      'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
    )
  )
    continue;
  zip.file(
    entry.name,
    xml
      .replaceAll(
        'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
        'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',
      )
      .replace(/(<\/?)(x:)/g, "$1"),
  );
}
await fs.writeFile(
  filename,
  await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
);
