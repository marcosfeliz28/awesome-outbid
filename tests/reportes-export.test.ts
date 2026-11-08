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
  PRESENTACION,
  comprobarLimite,
  construirModelo,
  neutralizar,
  nombreArchivo,
  exportable,
  puedeVerReporte,
} from "../apps/api/src/reportes/export";
import { REPORTES } from "../apps/api/src/reportes";
import { GUIA_REPORTES } from "../apps/api/src/reportes/guia";
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
    guia: GUIA_REPORTES["creditos-por-antiguedad"],
    presentacion: PRESENTACION["creditos-por-antiguedad"],
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
    const saldo = m.cifras.find((c) => c.valor === 300);
    expect(saldo?.formato).toBe("moneda");
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

  it("tildes, ñ y símbolos salen bien en PDF y en Excel", async () => {
    const texto = "áéíóú ñ ü ¿ ¡ RD$ US$";
    const m = modelo([{ ...creditos[1], Cliente: texto }]);
    m.queEs = texto;
    const pdf = (await renderPdf(m, { comprimir: false })).toString("latin1");
    // WinAnsi en hexadecimal: á é í ó ú = e1 e9 ed f3 fa; ñ ü = f1 fc; ¿ ¡ = bf a1.
    expect(pdf).toContain("e1e9edf3fa");
    expect(pdf).toContain("f120fc20bf20a1");
    expect(pdf).toContain("52442420555324");
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await renderXlsx(m));
    const celdas = libro.worksheets.flatMap((h: any) =>
      h.getSheetValues().flat(),
    );
    expect(celdas).toContain(texto);
  });

  // Todo reporte de la pantalla (con guía) sale en PDF y Excel.
  it("todos los reportes del registro con guía exportan a PDF y Excel", async () => {
    const nombres = Object.keys(GUIA_REPORTES).filter((n) =>
      Object.hasOwn(REPORTES, n),
    );
    // Toda entrada del registro tiene guía (el registro hoy tiene más de 40).
    expect(nombres).toHaveLength(Object.keys(REPORTES).length);
    for (const nombre of nombres) {
      expect(exportable(nombre)).toBe(true);
      const columnas = Object.keys(GUIA_REPORTES[nombre].columnas);
      const filas = [0, 1, 2].map((i) => ({
        ...Object.fromEntries(columnas.map((c) => [c, 10 * i + 5])),
        [columnas[0]]: "Ejemplo " + i,
      }));
      const m = construirModelo({
        nombre,
        guia: GUIA_REPORTES[nombre],
        presentacion: PRESENTACION[nombre],
        titulo: REPORTES[nombre].title,
        filas: filas as any,
        negocio: "Tienda de prueba",
        desde: "2026-10-01",
        hasta: "2026-10-31",
        generadoPor: "Ana Pérez",
        emitido: "1 de noviembre de 2026",
      });
      const pdf = await renderPdf(m);
      const xlsx = await renderXlsx(m);
      expect(pdf.subarray(0, 4).toString("latin1"), nombre).toBe("%PDF");
      expect(xlsx.subarray(0, 2).toString("latin1"), nombre).toBe("PK");
    }
  });
  // Sincronía 2-nov: lo que vio la contable en los PDF.
  const hex = (t: string) => Buffer.from(t, "latin1").toString("hex");
  const paginas = (pdf: Buffer) =>
    (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  const de = (nombre: string, filas: Record<string, unknown>[]) =>
    construirModelo({
      nombre,
      guia: GUIA_REPORTES[nombre],
      presentacion: PRESENTACION[nombre],
      titulo: REPORTES[nombre].title,
      filas: filas as any,
      negocio: "Tienda de prueba",
      desde: "2026-10-01",
      hasta: "2026-10-31",
      generadoPor: "Ana Pérez",
      emitido: "2 de noviembre de 2026",
    });

  it("PDF: un monto de millones sale completo y sin página en blanco", async () => {
    const pdf = await renderPdf(
      de("utilidad-bruta-por-mes", [
        {
          Mes: "2026-10",
          Facturas: 356,
          Venta: 1465804.5,
          Costo: 777664.04,
          Utilidad: 688140.46,
          "Margen %": 46.9,
        },
      ]),
      { comprimir: false },
    );
    expect(pdf.toString("latin1")).toContain(hex("1,465,804.50"));
    // Portada + una hoja de contenido; el pie va en esa hoja, no en otra nueva.
    expect(paginas(pdf)).toBe(2);
  });

  it("PDF: una tabla de 11 columnas cabe en la hoja y no corta montos", async () => {
    const pdf = (
      await renderPdf(
        de("formas-pago-mes", [
          {
            Mes: "2026-10",
            Efectivo: 202900,
            Transferencia: 562214.5,
            Tarjeta: 326990,
            "Crédito/contraentrega": 373700,
            Otros: 0,
            Total: 1465804.5,
            "% Efectivo": 13.8,
            "% Transferencia": 38.4,
            "% Tarjeta": 22.3,
            "% Crédito/contraentrega": 25.5,
          },
        ]),
        { comprimir: false },
      )
    ).toString("latin1");
    for (const monto of ["562,214.50", "373,700.00", "1,465,804.50"])
      expect(pdf, monto).toContain(hex(monto));
  });
  it("«Venta» y «Descuento total» son dinero; la gráfica de margen usa la venta", () => {
    const margen = de("margen-por-categoria", [
      {
        Categoría: "A",
        Unidades: 3,
        Venta: 900,
        Costo: 400,
        Utilidad: 500,
        "Margen %": 55.6,
      },
      {
        Categoría: "B",
        Unidades: 1,
        Venta: 300,
        Costo: 200,
        Utilidad: 100,
        "Margen %": 33.3,
      },
    ]);
    const col = (m: any, k: string) =>
      m.secciones.at(-1).columnas.find((c: any) => c.clave === k).formato;
    expect(col(margen, "Venta")).toBe("moneda");
    expect(margen.grafica?.valor).toBe("Venta");
    const desc = de("descuentos-cajera", [
      {
        Cajera: "Ana",
        "Facturas con descuento": 2,
        "Descuento total": 150,
        "Ventas netas": 900,
        "% de sus ventas": 16.7,
        "Aprobados por ella misma": 1,
      },
      {
        Cajera: "Eva",
        "Facturas con descuento": 1,
        "Descuento total": 50,
        "Ventas netas": 500,
        "% de sus ventas": 10,
        "Aprobados por ella misma": 0,
      },
    ]);
    expect(col(desc, "Descuento total")).toBe("moneda");
    expect(col(desc, "Aprobados por ella misma")).toBe("entero");
  });

  it("reportes de Ventas: fila de total, sin sumar «Facturas» por marca/categoría", () => {
    const m = (nombre: string) =>
      construirModelo({
        nombre,
        guia: GUIA_REPORTES[nombre],
        presentacion: PRESENTACION[nombre],
        titulo: nombre,
        filas: [
          { Marca: "A", Facturas: 2, Unidades: 3, "Ventas netas": 100 },
          { Marca: "B", Facturas: 2, Unidades: 4, "Ventas netas": 50 },
        ] as any,
        negocio: "T",
        desde: "2026-10-01",
        hasta: "2026-10-31",
        generadoPor: "Ana",
        emitido: "1 de noviembre de 2026",
      }).secciones[0].totales;
    expect(m("ventas-por-marca")).toEqual({ Unidades: 7, "Ventas netas": 150 });
    expect(m("ventas-categoria-mes")).toEqual({
      Unidades: 7,
      "Ventas netas": 150,
    });
    expect(m("ranking-cajeras")).toMatchObject({ Facturas: 4 });
    expect(m("ventas-por-hora")).toEqual({ Facturas: 4, "Ventas netas": 150 });
    expect(
      GUIA_REPORTES["ventas-por-marca"].columnas.Facturas.significa,
    ).toMatch(/no se suma/);
    expect(GUIA_REPORTES["ventas-mes-anterior"].comoSeLee).toMatch(/Desde/);
  });
});

describe("PDF de los informes de siempre", () => {
  it("encabezado una vez, filas con valores y total con margen en utilidad", async () => {
    const { pdfLines } = await import("../apps/api/src/reports");
    const rows = [
      {
        Producto: "A",
        Ventas: 118,
        Costo: 50,
        Unidades: 1,
        Utilidad: 68,
        Margen: 57.63,
      },
      {
        Producto: "B",
        Ventas: 236,
        Costo: 100,
        Unidades: 2,
        Utilidad: 136,
        Margen: 57.63,
      },
    ];
    const lines = pdfLines(rows, true);
    expect(lines[0]).toBe(
      "Producto | Ventas | Costo | Unidades | Utilidad | Margen",
    );
    expect(lines[1]).toBe("A | 118 | 50 | 1 | 68 | 57.63");
    expect(lines.at(-1)).toBe("Total | 354 | 150 | 3 | 204 | 57.63");
    expect(pdfLines([], false)).toEqual(["Sin datos en este período."]);
  });
});
