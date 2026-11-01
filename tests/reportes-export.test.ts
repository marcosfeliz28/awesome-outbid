// Motor común de exportación de reportes (PDF y Excel): cifras del detalle,
// fórmulas inyectadas neutralizadas, nombre de archivo seguro, límite de filas,
// permiso de costo/margen, archivos que se generan y se pueden abrir, y que no
// dependen de internet (instalador sin red).
import { createRequire } from "node:module";
import { resolve } from "node:path";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
import {
  EXPORT_ROW_LIMIT,
  GUIA_MINIMA,
  comprobarLimite,
  construirModelo,
  neutralizar,
  nombreArchivo,
  puedeVerReporte,
} from "../apps/api/src/reportes/export";
import { renderXlsx } from "../apps/api/src/reportes/export-xlsx";
import { renderPdf } from "../apps/api/src/reportes/export-pdf";

const ExcelJS = createRequire(resolve("apps/api/package.json"))("exceljs");

const creditos = [
  {
    Tramo: "0 a 30 días",
    Factura: "Resumen",
    Tipo: null,
    Cliente: null,
    Teléfono: null,
    Fecha: null,
    Vence: null,
    Días: null,
    Facturas: 2,
    Saldo: 300,
  },
  {
    Tramo: "0 a 30 días",
    Factura: "FS-0000001",
    Tipo: "Crédito",
    Cliente: '=HYPERLINK("http://malo.example")',
    Teléfono: null,
    Fecha: "2026-10-01",
    Vence: "2026-10-31",
    Días: 5,
    Facturas: 1,
    Saldo: 100,
  },
  {
    Tramo: "0 a 30 días",
    Factura: "FS-0000002",
    Tipo: "Contraentrega",
    Cliente: "+cliente",
    Teléfono: null,
    Fecha: "2026-10-03",
    Vence: null,
    Días: 3,
    Facturas: 1,
    Saldo: 200,
  },
];

function modelo(filas: Record<string, unknown>[] = creditos) {
  return construirModelo({
    nombre: "creditos-por-antiguedad",
    guia: GUIA_MINIMA["creditos-por-antiguedad"],
    titulo: "Créditos y contraentregas por antigüedad",
    filas: filas as any,
    negocio: "Tienda de prueba",
    desde: "2026-10-01",
    hasta: "2026-10-31",
    generadoPor: "Ana Pérez",
    emitido: "1 de noviembre de 2026, 9:00 a. m.",
  });
}

describe("motor de exportación de reportes", () => {
  it("las cifras clave suman solo el detalle, no el resumen", () => {
    const m = modelo();
    const saldo = m.cifras.find((c) => c.etiqueta === "Total saldo");
    expect(saldo?.valor).toBe(300);
    expect(m.secciones).toHaveLength(2);
    expect(m.secciones[1].filas).toHaveLength(2);
  });

  it("neutraliza celdas que Excel leería como fórmula", () => {
    expect(neutralizar('=HYPERLINK("x")')).toBe('\'=HYPERLINK("x")');
    expect(neutralizar("+cliente")).toBe("'+cliente");
    expect(neutralizar("-1+1")).toBe("'-1+1");
    expect(neutralizar("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(neutralizar("\t=cmd")).toBe("'\t=cmd");
    expect(neutralizar("Ana Pérez")).toBe("Ana Pérez");
    expect(neutralizar(-25)).toBe(-25);
    expect(neutralizar(null)).toBe(null);
  });

  it("el nombre de archivo es seguro aunque la entrada no lo sea", () => {
    expect(
      nombreArchivo("margen-por-producto", "2026-10-01", "2026-10-31", "pdf"),
    ).toBe("nexora-margen-por-producto-2026-10-01-2026-10-31.pdf");
    const malo = nombreArchivo("../../etc", '2026-10-01"; rm', "x", "xlsx");
    expect(malo).toMatch(/^[a-z0-9._-]+\.xlsx$/);
    expect(malo).not.toContain("/");
    expect(malo).not.toContain('"');
  });

  it("límite de filas: 20.000 se permite, 20.001 se rechaza", () => {
    expect(EXPORT_ROW_LIMIT).toBe(20000);
    expect(() => comprobarLimite(20000)).not.toThrow();
    expect(() => comprobarLimite(20001)).toThrow(/20\.000|20000/);
  });

  it("costo y margen solo con profit:read", () => {
    const conMargen = { margin: true } as any;
    const sinMargen = { margin: false } as any;
    expect(puedeVerReporte(conMargen, ["reports:read"])).toBe(false);
    expect(puedeVerReporte(conMargen, ["reports:read", "profit:read"])).toBe(
      true,
    );
    expect(puedeVerReporte(sinMargen, ["reports:read"])).toBe(true);
  });

  it("Excel: hojas Resumen, detalle y Guía; sin fórmulas inyectadas; encabezados fijos", async () => {
    const buf = await renderXlsx(modelo());
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(buf);
    const nombres = libro.worksheets.map((h) => h.name);
    expect(nombres[0]).toBe("Resumen");
    expect(nombres.at(-1)).toBe("Guía");
    // Hojas: Resumen, una por sección (resumen y detalle), Guía.
    const detalle = libro.worksheets[2];
    let inyectadas = 0;
    let totales = 0;
    detalle.eachRow((fila) =>
      fila.eachCell((celda) => {
        if (celda.type === ExcelJS.ValueType.Formula) {
          if (String(celda.formula).startsWith("SUBTOTAL(9,")) totales++;
          else inyectadas++;
        }
        if (String(celda.value).includes('HYPERLINK("http://malo'))
          expect(String(celda.value).startsWith("'")).toBe(true);
      }),
    );
    expect(inyectadas).toBe(0);
    expect(totales).toBeGreaterThan(0);
    expect(detalle.views?.[0]?.state).toBe("frozen");
  });

  it("PDF: archivo válido de varias páginas", async () => {
    const filas = Array.from({ length: 120 }, (_, i) => ({
      Tramo: "0 a 30 días",
      Factura: "FS-" + String(i).padStart(7, "0"),
      Tipo: "Crédito",
      Cliente: "Cliente número " + i + " ñandú",
      Teléfono: null,
      Fecha: "2026-10-01",
      Vence: "2026-10-31",
      Días: i % 40,
      Facturas: 1,
      Saldo: 10 + i,
    }));
    const buf = await renderPdf(modelo(filas));
    expect(buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(buf.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    const paginas = buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas.length).toBeGreaterThanOrEqual(3);
  });

  // Instalador sin internet: PDF y Excel no pueden tocar la red.
  it("PDF y Excel se generan con la red bloqueada", async () => {
    const sinRed = () => {
      throw new Error("red bloqueada durante la exportación");
    };
    vi.spyOn(net.Socket.prototype, "connect").mockImplementation(sinRed as any);
    vi.spyOn(dns, "lookup").mockImplementation(sinRed as any);
    vi.spyOn(http, "request").mockImplementation(sinRed as any);
    vi.spyOn(https, "request").mockImplementation(sinRed as any);
    vi.stubGlobal("fetch", sinRed);
    const m = modelo();
    const pdf = await renderPdf(m);
    const xlsx = await renderXlsx(m);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(xlsx.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
