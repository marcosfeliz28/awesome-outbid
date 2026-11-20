// Guía de los reportes: cada reporte registrado tiene su explicación completa y
// cada columna que devuelve tiene nombre amigable y significado. Las columnas se
// leen del propio código: el reporte corre contra una base falsa que devuelve
// una fila de ejemplo, así que sus encabezados salen tal cual los escribió.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORTES } from "../apps/api/src/reportes";
import { GUIA_INFORMES, GUIA_REPORTES } from "../apps/api/src/reportes/guia";

const FILA = {
  id: "x",
  customerId: "c1",
  name: "Ejemplo",
  phone: "8091234567",
  sku: "S1",
  number: "FS-1",
  balance: 10,
  days: 5,
  sold: "2026-10-01",
  due: null,
  cod: false,
  kind: "credit",
  cashSessionId: null,
};
const db: any = {
  $queryRaw: async () => [FILA],
  cashSession: { findFirst: async () => null },
  user: { findMany: async () => [] },
  terminal: { findMany: async () => [] },
};
const actor: any = {
  id: "u1",
  name: "Prueba",
  email: "prueba@ejemplo.do",
  role: "owner",
  permissions: ["*"],
  branchId: "b1",
};
const range = {
  gte: new Date("2026-10-01T00:00:00-04:00"),
  lte: new Date("2026-10-31T23:59:59-04:00"),
};
const encabezados = async (run: any) =>
  [
    ...new Set(
      (await run(db, actor, range, {})).flatMap((r: object) => Object.keys(r)),
    ),
  ] as string[];
const hayTexto = (valor: unknown) =>
  typeof valor === "string" && valor.trim().length > 0;

describe("guía de reportes", () => {
  it("hay una guía por cada reporte registrado y ninguna de más", () => {
    expect(Object.keys(GUIA_REPORTES).sort()).toEqual(
      Object.keys(REPORTES).sort(),
    );
  });

  it.each(Object.keys(REPORTES))(
    "%s tiene qué es, para qué sirve y cómo se lee",
    (nombre) => {
      const guia = GUIA_REPORTES[nombre];
      expect(hayTexto(guia?.queEs)).toBe(true);
      expect(hayTexto(guia?.paraQueSirve)).toBe(true);
      expect(hayTexto(guia?.comoSeLee)).toBe(true);
    },
  );

  it.each(Object.keys(REPORTES))(
    "%s explica cada columna que devuelve",
    async (nombre) => {
      const columnas = await encabezados(REPORTES[nombre].run);
      expect(columnas.length).toBeGreaterThan(0);
      const sinExplicar = columnas.filter((c) => {
        const explicacion = GUIA_REPORTES[nombre]?.columnas[c];
        return !(
          hayTexto(explicacion?.nombreAmigable) &&
          hayTexto(explicacion?.significa)
        );
      });
      expect(sinExplicar).toEqual([]);
    },
  );

  it.each(Object.keys(REPORTES).filter((n) => !REPORTES[n].margin))(
    "%s no menciona costo ni margen (no los muestra)",
    (nombre) => {
      const g = GUIA_REPORTES[nombre];
      const texto = [
        g.queEs,
        g.paraQueSirve,
        g.comoSeLee,
        ...Object.values(g.columnas).flatMap((c) => [
          c.nombreAmigable,
          c.significa,
        ]),
      ].join(" ");
      expect(texto).not.toMatch(/costo|margen|ganancia|utilidad/i);
    },
  );

  it("los informes formales tienen guía y cada columna o sección explicada", () => {
    expect(Object.keys(GUIA_INFORMES).sort()).toEqual([
      "cierre-caja",
      "gv-reportes",
      "informe-anual",
      "informe-formal",
      "informe-mensual",
      "ingresos-por-dia",
      "tienda-venta-diaria-usuario",
      "tienda-venta-por-forma-pago",
      "tienda-ventas-categoria-forma-pago",
    ]);
    for (const [nombre, guia] of Object.entries(GUIA_INFORMES)) {
      expect(hayTexto(guia.queEs), nombre).toBe(true);
      expect(hayTexto(guia.paraQueSirve), nombre).toBe(true);
      expect(hayTexto(guia.comoSeLee), nombre).toBe(true);
      const sinExplicar = Object.entries(guia.columnas).filter(
        ([, c]) => !hayTexto(c.nombreAmigable) || !hayTexto(c.significa),
      );
      expect(
        sinExplicar.map(([k]) => k),
        nombre,
      ).toEqual([]);
    }
    // Encabezados del CSV/Excel de ingresos por día (income-report.ts).
    expect(Object.keys(GUIA_INFORMES["ingresos-por-dia"].columnas)).toEqual(
      expect.arrayContaining([
        "Fecha ISO",
        "Efectivo",
        "Tarjeta",
        "Transferencia",
        "Crédito generado",
        "Cobro crédito efectivo",
        "Cobro crédito tarjeta",
        "Cobro crédito transferencia",
        "Devoluciones",
        "Dinero ingresado",
        "Vendido neto",
      ]),
    );
  });

  it("los reportes de ventas dicen que incluyen ITBIS y no el envío", () => {
    for (const n of Object.keys(REPORTES).filter(
      (k) => REPORTES[k].group === "Ventas",
    )) {
      const g = GUIA_REPORTES[n].comoSeLee;
      expect(g, n).toContain("ITBIS");
      expect(g, n).toContain("envío");
    }
    expect(GUIA_REPORTES["ventas-categoria-mes"].queEs).not.toContain("ropa");
  });
});

describe("guía de inventario (auditoría 2-nov)", () => {
  it("perdidas-conteo aclara qué es pérdida real y qué no", () => {
    const g: any = GUIA_REPORTES["perdidas-conteo"];
    expect(g.comoSeLee).toMatch(/Solo la «Salida real» es dinero perdido/);
    expect(g.comoSeLee).toMatch(/no se suma como pérdida/);
  });
});

describe("contrato documental del diseño de reportes del 20-nov", () => {
  const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const salidas = ["Pantalla", "Excel", "PDF", "CSV"];

  it("fija tokens, tipografía, cabecera, números, fechas, página y estados", () => {
    const spec = read("docs/auditoria-ui/REPORTES_ESPECIFICACION_20NOV.md");
    for (const required of [
      "#6d28d9",
      "--fs-min",
      "14 px",
      "America/Santo_Domingo",
      "RD$ 1,500.00",
      "A4",
      "nombre del negocio",
      "logo",
      "vacío",
      "cargando",
      "error",
      "Reintentar",
    ]) {
      expect(spec, required).toContain(required);
    }
  });

  it("mantiene una fila pendiente por cada reporte registrado y salida", () => {
    const matrix = read("docs/auditoria-ui/REPORTES_DISENO_20NOV.md");
    const rows = matrix
      .split("\n")
      .filter((line) => line.startsWith("| R40-"))
      .map((line) =>
        line
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim()),
      );

    expect(rows).toHaveLength(Object.keys(REPORTES).length * salidas.length);
    for (const report of Object.keys(REPORTES)) {
      for (const output of salidas) {
        const row = rows.find(
          (cells) => cells[1] === report && cells[3] === output,
        );
        expect(row, `${report}/${output}`).toBeDefined();
        expect(row).toContain("PENDIENTE");
      }
    }
  });

  it("no declara OK ni falla sin una evidencia enlazada", () => {
    const matrix = read("docs/auditoria-ui/REPORTES_DISENO_20NOV.md");
    const rows = matrix
      .split("\n")
      .filter((line) => /^\| (?:R40|ESP)-/.test(line));
    for (const row of rows) {
      const cells = row
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());
      const status = cells.at(-2);
      const evidence = cells.at(-3);
      if (status === "OK" || status === "FALLA") {
        expect(evidence).not.toBe("—");
        expect(evidence).not.toBe("PENDIENTE");
      }
    }
  });
});
