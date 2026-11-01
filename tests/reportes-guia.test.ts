// Guía de los reportes: cada reporte registrado tiene su explicación completa y
// cada columna que devuelve tiene nombre amigable y significado. Las columnas se
// leen del propio código: el reporte corre contra una base falsa que devuelve
// una fila de ejemplo, así que sus encabezados salen tal cual los escribió.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REPORTES } from "../apps/api/src/reportes";
import {
  GUIA_INFORMES,
  GUIA_LEGACY,
  GUIA_REPORTES,
} from "../apps/api/src/reportes/guia";

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
});

// Reportes antiguos de Management.tsx (reportList) con sus encabezados según reports.ts.
const LEGACY: Record<string, string[]> = {
  sales: [
    "Factura",
    "Fecha",
    "Vendedor",
    "Total",
    "ITBIS",
    "Saldo_crédito",
    "NCF",
    "Tipo_NCF",
    "Estado_fiscal",
    "Devoluciones",
  ],
  "monthly-consumption": ["Mes_Producto", "Unidades"],
  profit: [
    "Producto",
    "Categoría",
    "Ventas",
    "Costo",
    "Unidades",
    "Utilidad",
    "Margen",
  ],
  "inventory-value": [
    "SKU",
    "Producto",
    "Categoría",
    "Stock",
    "Costo",
    "Precio",
    "Casa",
    "Total",
    "Valor",
  ],
  kardex: [
    "Fecha",
    "SKU",
    "Producto",
    "Tipo",
    "Cantidad",
    "Saldo",
    "Costo",
    "Motivo",
  ],
  "low-stock": [
    "SKU",
    "Producto",
    "Categoría",
    "Stock",
    "Costo",
    "Precio",
    "Casa",
    "Total",
    "Valor",
    "Sugerido",
  ],
  "no-movement": [
    "SKU",
    "Producto",
    "Categoría",
    "Stock",
    "Costo",
    "Precio",
    "Casa",
    "Total",
    "Valor",
  ],
  expiring: ["SKU", "Producto", "Lote", "Vencimiento", "Cantidad"],
  abc: [
    "Producto",
    "Categoría",
    "Ventas",
    "Costo",
    "Unidades",
    "Utilidad",
    "Margen",
    "Clasificación",
  ],
  expenses: ["Fecha", "Categoría", "Descripción", "Monto", "Presupuesto"],
  "income-statement": ["Concepto", "Monto"],
  cash: [
    "Fecha",
    "Usuario",
    "Estado",
    "Esperado",
    "Contado",
    "Diferencia_efectivo",
    "Diferencia_tarjeta",
    "Diferencia_transferencia",
  ],
  "by-seller": ["Vendedor", "Ventas"],
  "by-payment": ["Método", "Ventas", "Cobros_de_crédito"],
  "returns-discounts": ["Fecha", "Evento", "Usuario", "Referencia", "Detalle"],
  customers: ["Cliente", "Ventas"],
  purchases: [
    "Proveedor",
    "Ordenado",
    "Compras",
    "Pagado",
    "Pendiente",
    "Sin_conciliar",
  ],
  "ventas-categoria-forma-pago": ["Categoría", "Forma de pago", "Monto", "%"],
};
const CONCEPTOS_ESTADO = [
  "Ventas sin ITBIS",
  "Costo de lo vendido",
  "Ganancia bruta",
  "Gastos",
  "Comisiones bancarias",
  "Mermas, ajustes y devoluciones a proveedor de inventario (a costo)",
  "Ganancia neta",
];

describe("guía de reportes antiguos (Management)", () => {
  it("cada reporte de la lista de Management.tsx tiene guía", () => {
    const src = readFileSync(
      new URL("../apps/web/src/Management.tsx", import.meta.url),
      "utf8",
    );
    const ini = src.indexOf("const reportList = [");
    const bloque = src.slice(ini, src.indexOf("];", ini));
    const enPantalla = [...bloque.matchAll(/\[\s*"([a-z-]+)"/g)].map(
      (m) => m[1],
    );
    // income-by-day y formal tienen guía como informes (GUIA_INFORMES).
    const sinInformes = enPantalla.filter(
      (n) => n !== "income-by-day" && n !== "formal",
    );
    expect(sinInformes.sort()).toEqual(Object.keys(GUIA_LEGACY).sort());
    expect(enPantalla.length).toBeGreaterThan(15);
  });

  it("hay guía para cada reporte antiguo y ninguna de más", () => {
    expect(Object.keys(GUIA_LEGACY).sort()).toEqual(Object.keys(LEGACY).sort());
  });

  it.each(Object.keys(LEGACY))(
    "%s tiene guía completa y explica cada columna",
    (nombre) => {
      const g = GUIA_LEGACY[nombre];
      expect(hayTexto(g?.queEs), nombre).toBe(true);
      expect(hayTexto(g?.paraQueSirve), nombre).toBe(true);
      expect(hayTexto(g?.comoSeLee), nombre).toBe(true);
      const claves = [
        ...LEGACY[nombre],
        ...(nombre === "income-statement" ? CONCEPTOS_ESTADO : []),
      ];
      const sinExplicar = claves.filter((k) => {
        const e = g.columnas[k];
        return !(hayTexto(e?.nombreAmigable) && hayTexto(e?.significa));
      });
      expect(sinExplicar).toEqual([]);
    },
  );
});
