import ExcelJS from "exceljs";
import { neutralizar, type Columna, type Formato, type Modelo } from "./export";

// Excel del reporte: Resumen, una hoja por sección y Guía. Totales con SUBTOTAL
// (respetan filtros). Sin gráficas: exceljs no crea gráficas nativas aquí.
const FORMATO_XLSX: Record<Formato, string> = {
  moneda: '"RD$" #,##0.00',
  entero: "#,##0",
  decimal: "#,##0.00",
  porcentaje: '0.0"%"',
  texto: "General",
};
const CABECERA = {
  bold: true,
  color: { argb: "FF000000" },
} as const;
const RELLENO = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FFD9E1E5" },
};
const nombreHoja = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

export async function renderXlsx(m: Modelo): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = "Nexora POS";
  libro.created = new Date();
  libro.title = m.titulo;

  // Resumen
  const resumen = libro.addWorksheet("Resumen", {
    views: [{ showGridLines: false }],
  });
  resumen.columns = [{ width: 36 }, { width: 24 }, { width: 60 }];
  resumen.addRow([neutralizar(m.negocio)]).font = { bold: true, size: 14 };
  resumen.addRow([neutralizar(m.titulo)]).font = { bold: true, size: 12 };
  resumen.addRow(["Período", neutralizar(m.periodo)]);
  resumen.addRow(["Emitido", neutralizar(m.emitido)]);
  resumen.addRow(["Generado por", neutralizar(m.generadoPor)]);
  resumen.addRow([]);
  resumen.addRow(["De qué trata este reporte"]).font = CABECERA;
  const queEs = resumen.addRow([neutralizar(m.queEs)]);
  resumen.mergeCells(`A${queEs.number}:C${queEs.number}`);
  queEs.alignment = { wrapText: true, vertical: "top" };
  queEs.height = 32;
  resumen.addRow([]);
  if (m.cifras.length) {
    const cab = resumen.addRow(["Cifra clave", "Valor"]);
    cab.font = CABECERA;
    cab.eachCell((c) => (c.fill = RELLENO));
    for (const c of m.cifras) {
      const fila = resumen.addRow([neutralizar(c.etiqueta), c.valor]);
      fila.getCell(2).numFmt = FORMATO_XLSX[c.formato];
    }
    resumen.addRow([]);
  }
  resumen.addRow(["Cómo leerlo"]).font = CABECERA;
  const como = resumen.addRow([neutralizar(m.comoSeLee)]);
  resumen.mergeCells(`A${como.number}:C${como.number}`);
  como.alignment = { wrapText: true, vertical: "top" };
  como.height = 32;
  for (const nota of m.notas) {
    const f = resumen.addRow(["• " + neutralizar(nota)]);
    resumen.mergeCells(`A${f.number}:C${f.number}`);
  }

  // Una hoja por sección, con encabezados fijos.
  for (const sec of m.secciones) {
    const hoja = libro.addWorksheet(nombreHoja(sec.titulo));
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.columns = sec.columnas.map((c) => ({
      header: c.clave,
      key: c.clave,
      width: Math.min(Math.max(c.clave.length + 4, 14), 40),
    }));
    hoja.getRow(1).font = CABECERA;
    hoja.getRow(1).eachCell((c) => (c.fill = RELLENO));
    for (const f of sec.filas)
      hoja.addRow(
        Object.fromEntries(
          sec.columnas.map((c) => [c.clave, neutralizar(f[c.clave])]),
        ),
      );
    sec.columnas.forEach((c, i) => {
      const col = hoja.getColumn(i + 1);
      col.numFmt = FORMATO_XLSX[c.formato];
    });
    if (sec.totales && sec.filas.length) {
      const fila = hoja.addRow(
        sec.columnas.map((_, i) => (i === 0 ? "Total" : null)),
      );
      fila.font = CABECERA;
      sec.columnas.forEach((c, i) => {
        if (!(c.clave in sec.totales!)) return;
        const letra = colLetra(i + 1);
        const ultima = sec.filas.length + 1;
        fila.getCell(i + 1).value = {
          formula: `SUBTOTAL(9,${letra}2:${letra}${ultima})`,
        };
        fila.getCell(i + 1).numFmt = FORMATO_XLSX[c.formato];
      });
    }
  }

  // Guía: qué significa cada columna.
  const guia = libro.addWorksheet("Guía", {
    views: [{ showGridLines: false }],
  });
  guia.columns = [{ width: 36 }, { width: 90 }];
  guia.addRow(["Concepto", "Qué significa"]).font = CABECERA;
  guia.addRow(["De qué trata", neutralizar(m.queEs)]);
  guia.addRow(["Cómo se lee", neutralizar(m.comoSeLee)]);
  for (const sec of m.secciones)
    for (const c of sec.columnas as Columna[])
      guia.addRow([
        neutralizar(`${sec.titulo}: ${c.clave}`),
        neutralizar(c.significa ?? "Por confirmar."),
      ]);
  for (const hoja of [resumen, guia])
    hoja.getColumn(1).alignment = { wrapText: true, vertical: "top" };

  return Buffer.from(await libro.xlsx.writeBuffer());
}

const colLetra = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26))
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
