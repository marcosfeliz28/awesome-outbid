// Exportación de los reportes de GV (cursos y citas): las cifras salen del mismo
// objeto que la pantalla, el neto es verificado menos reembolsos y los textos
// que llegan de la clienta no se convierten en fórmulas de Excel.
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderPdf } from "../apps/api/src/reportes/export-pdf";
import { renderXlsx } from "../apps/api/src/reportes/export-xlsx";
import {
  GUIA_GV,
  modeloGv,
  type RepGv,
} from "../apps/api/src/reportes/gv-export";

const ExcelJS = createRequire(resolve("apps/api/package.json"))("exceljs");

const rep: RepGv = {
  income: {
    total: "1500.00",
    unverified: "300.00",
    refunds: "200.00",
    net: "1300.00",
    byDay: [
      { key: "2026-10-01", total: "1000.00", count: 2 },
      { key: "2026-10-02", total: "500.00", count: 1 },
    ],
    byMethod: [{ key: "Efectivo", total: "1500.00", count: 3 }],
    byBank: [{ key: "Sin banco", total: "1500.00", count: 3 }],
    byEmployee: [{ key: "Gerencia", total: "1500.00", count: 3 }],
  },
  courses: [
    {
      name: "Curso maquillaje",
      date: "2026-10-10",
      capacity: 10,
      enrolled: 6,
      attended: 5,
      brushSets: 2,
      paid: "900.00",
      pending: "100.00",
      unverified: "0.00",
    },
  ],
  pendingByClient: [
    {
      clientName: '=HYPERLINK("http://malo.example")',
      kind: "curso",
      course: "Curso maquillaje",
      courseDate: "2026-10-10",
      paid: "900.00",
      unverified: "0.00",
      pending: "100.00",
    },
  ],
};
const meta = {
  negocio: "GV Makeup Studio",
  desde: "2026-10-01",
  hasta: "2026-10-31",
  generadoPor: "Ana",
  emitido: "1 nov 2026",
};

describe("reportes de GV en PDF y Excel", () => {
  it("el neto es verificado menos reembolsos y coincide con la pantalla", () => {
    const m = modeloGv(rep, meta);
    expect(m.cifras.find((c) => c.etiqueta === "Neto")?.valor).toBe(1300);
    const dias = m.secciones[0];
    expect(dias.totales?.Total).toBe(1500);
    expect(dias.totales?.Pagos).toBe(3);
    expect(m.secciones).toHaveLength(6);
  });

  it("la guía de GV explica cada columna que usa el reporte", () => {
    const m = modeloGv(rep, meta);
    for (const s of m.secciones)
      for (const c of s.columnas) expect(c.significa, c.clave).toBeTruthy();
    expect(GUIA_GV.columnas.Pendiente.significa).toContain(
      "nunca baja de cero",
    );
  });

  it("PDF y Excel se generan; el texto de la clienta no se vuelve fórmula", async () => {
    const m = modeloGv(rep, meta);
    expect((await renderPdf(m)).subarray(0, 4).toString("latin1")).toBe("%PDF");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await renderXlsx(m));
    let formulasMalas = 0;
    libro.worksheets.forEach((h: any) =>
      h.eachRow((f: any) =>
        f.eachCell((c: any) => {
          if (
            c.type === ExcelJS.ValueType.Formula &&
            !String(c.formula).startsWith("SUBTOTAL(")
          )
            formulasMalas++;
        }),
      ),
    );
    expect(formulasMalas).toBe(0);
  });
});
