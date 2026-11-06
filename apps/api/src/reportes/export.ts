import { can } from "@fitstore/shared";
import { bad } from "../common";
import type { ReportDef, Row } from "./base";
import { GUIA_REPORTES, type Guia } from "./guia";

// Motor común de exportación (PDF y Excel). Recibe las mismas filas que la
// pantalla (`def.run`), así que las cifras son idénticas. Sólo presenta: los
// textos y nombres amigables salen de guia.ts.

export type Grafica =
  | {
      tipo: "barras" | "linea";
      titulo: string;
      etiqueta: string;
      valor: string;
      filtro?: (fila: Row) => boolean;
      /** Suma los valores de filas con la misma etiqueta. */
      agrupar?: boolean;
      maximo?: number;
    }
  | {
      tipo: "pastel";
      titulo: string;
      columnas: string[];
      filtro?: (fila: Row) => boolean;
    };

// Presentación específica de un reporte (resúmenes, totales, gráficas). Sin
// entrada: detalle, importes según la guía y una gráfica automática de barras
// si hay una columna de texto y otra de importe.
export type Presentacion = {
  moneda?: string[];
  esResumen?: (fila: Row) => boolean;
  tituloResumen?: string;
  tituloDetalle?: string;
  totales?: string[];
  grafica?: Grafica;
};
export type Formato = "moneda" | "entero" | "decimal" | "porcentaje" | "texto";
export type Columna = {
  clave: string;
  etiqueta: string;
  formato: Formato;
  significa?: string;
};
export type Seccion = {
  titulo: string;
  columnas: Columna[];
  filas: Row[];
  totales: Record<string, number> | null;
};
export type Punto = { nombre: string; valor: number };
export type GraficaModelo = {
  titulo: string;
  etiqueta: string;
  valor: string;
  puntos: Punto[];
} & ({ tipo: "barras" | "linea" } | { tipo: "pastel" });
export type Modelo = {
  nombre: string;
  titulo: string;
  negocio: string;
  periodo: string;
  emitido: string;
  generadoPor: string;
  queEs: string;
  paraQueSirve: string;
  comoSeLee: string;
  cifras: { etiqueta: string; valor: number; formato: Formato }[];
  secciones: Seccion[];
  grafica: GraficaModelo | null;
};

// Presentación de los reportes que la necesitan. Verificada contra su `run`.
export const PRESENTACION: Record<string, Presentacion> = {
  // Fila de total en PDF y Excel (hallazgo ventas-08). «Facturas» no se suma en
  // marca/categoría: una factura con 2 marcas cuenta en ambas (ventas-05).
  // unidades-por-factura ya trae su propia fila final de promedio y total.
  "ventas-por-hora": { totales: ["Facturas", "Ventas netas"] },
  "ventas-por-dia-semana": { totales: ["Facturas", "Ventas netas"] },
  "ranking-cajeras": { totales: ["Facturas", "Unidades", "Ventas netas"] },
  "top-clientes": { totales: ["Facturas", "Ventas netas"] },
  "ventas-categoria-mes": { totales: ["Unidades", "Ventas netas"] },
  "ventas-por-marca": { totales: ["Unidades", "Ventas netas"] },
  "ticket-promedio": {
    moneda: ["Ventas netas", "Ticket promedio"],
    esResumen: (f) => f.Tipo === "Mes",
    tituloResumen: "Por mes",
    tituloDetalle: "Por día",
    totales: ["Facturas", "Ventas netas"],
    grafica: {
      tipo: "linea",
      titulo: "Ventas netas por día",
      etiqueta: "Período",
      valor: "Ventas netas",
      filtro: (f) => f.Tipo === "Día",
    },
  },
  "formas-pago-mes": {
    moneda: [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Crédito/contraentrega",
      "Otros",
      "Total",
    ],
    totales: [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Crédito/contraentrega",
      "Otros",
      "Total",
    ],
    grafica: {
      tipo: "pastel",
      titulo: "Participación de cada forma de pago",
      columnas: [
        "Efectivo",
        "Transferencia",
        "Tarjeta",
        "Crédito/contraentrega",
        "Otros",
      ],
    },
  },
  "margen-por-producto": {
    moneda: ["Venta", "Costo", "Utilidad"],
    totales: ["Unidades", "Venta", "Costo", "Utilidad"],
    grafica: {
      tipo: "barras",
      titulo: "Venta de los productos que más venden",
      etiqueta: "Producto",
      valor: "Venta",
      maximo: 15,
    },
  },
  "valor-inventario-almacen": {
    moneda: ["Valor a costo"],
    totales: ["Unidades", "Valor a costo"],
    grafica: {
      tipo: "barras",
      titulo: "Valor a costo por almacén",
      etiqueta: "Almacén",
      valor: "Valor a costo",
      agrupar: true,
    },
  },
  "creditos-por-antiguedad": {
    moneda: ["Saldo"],
    esResumen: (f) => f.Factura === "Resumen",
    tituloResumen: "Por tramo de antigüedad",
    tituloDetalle: "Facturas",
    totales: ["Facturas", "Saldo"],
    grafica: {
      tipo: "barras",
      titulo: "Saldo pendiente por tramo",
      etiqueta: "Tramo",
      valor: "Saldo",
      filtro: (f) => f.Factura === "Resumen",
    },
  },
};

// Reportes exportables: los que tienen guía (los 40 de la pantalla).
export const exportable = (name: string) => Object.hasOwn(GUIA_REPORTES, name);

// Límite de filas por exportación (seguridad-20): protege memoria y tiempo.
export const EXPORT_ROW_LIMIT = 20000;
const NO_FORMULA = /^[=+\-@\t\r]/;
const ALLOWED_FORMAT = ["pdf", "xlsx"] as const;
export type ExportFormat = (typeof ALLOWED_FORMAT)[number];
export const esFormato = (f: unknown): f is ExportFormat =>
  ALLOWED_FORMAT.includes(f as ExportFormat);

// Excel trataría como fórmula una celda que empieza por = + - @: se antepone
// un apóstrofo para que se muestre y se guarde como texto.
export function neutralizar<T>(valor: T): T | string {
  return typeof valor === "string" && NO_FORMULA.test(valor)
    ? "'" + valor
    : valor;
}

// Nombre de archivo: sólo letras, números y guiones; las fechas, sólo dígitos.
export function nombreArchivo(
  nombre: string,
  desde: string | undefined,
  hasta: string | undefined,
  formato: ExportFormat,
) {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const fecha = (s: string | undefined) =>
    (s ?? "").replace(/[^0-9-]/g, "").slice(0, 10);
  return (
    ["nexora", slug(nombre), fecha(desde), fecha(hasta)]
      .filter(Boolean)
      .join("-") + `.${formato}`
  );
}

const miles = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
export function comprobarLimite(filas: number) {
  if (filas > EXPORT_ROW_LIMIT)
    bad(
      `El reporte tiene ${miles(filas)} filas y el máximo para exportar es ${miles(EXPORT_ROW_LIMIT)}. Selecciona un período más corto.`,
    );
}

// Mismo criterio que la pantalla: un informe con costo o margen sólo para quien
// tiene profit:read.
export const puedeVerReporte = (def: ReportDef, permisos: string[]) =>
  !def.margin || can(permisos, "profit:read");

export const fmt = (valor: unknown, formato: Formato): string => {
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor !== "number") return String(valor);
  const d = (min: number, max: number) =>
    valor.toLocaleString("en-US", {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
    });
  if (formato === "moneda") return "RD$ " + d(2, 2);
  if (formato === "porcentaje") return d(1, 1) + " %";
  if (formato === "entero") return d(0, 0);
  return d(2, 2);
};

const redondea = (n: number) => Math.round(n * 100) / 100;
const textoFecha = (v: Date | string) =>
  typeof v === "string"
    ? v
    : v.toLocaleDateString("es-DO", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "America/Santo_Domingo",
      });

// Importe según el nombre y el significado de la columna. Cantidades, porcentajes
// y días no cuentan como importe.
const IMPORTE =
  /RD\$|dinero|pesos|cobrad|vendid|costo|venta|saldo|ticket|utilidad|valor|monto|pagad|precio|reembols|efectivo|transferencia|tarjeta|crédito|contraentrega/i;
const NO_IMPORTE =
  /%|cantidad|unidades|piezas|facturas|días|número|veces|porcentaje/i;
const esImporte = (texto: string) =>
  IMPORTE.test(texto) && !NO_IMPORTE.test(texto);

function formatoDe(
  clave: string,
  filas: Row[],
  pres: Presentacion,
  significa: string | undefined,
): Formato {
  if (pres.moneda?.includes(clave)) return "moneda";
  if (clave.includes("%")) return "porcentaje";
  const valores = filas
    .map((f) => f[clave])
    .filter((v) => v !== null && v !== undefined);
  if (!valores.length || !valores.every((v) => typeof v === "number"))
    return "texto";
  if (esImporte(clave + " " + (significa ?? ""))) return "moneda";
  return valores.every((v) => Number.isInteger(v)) ? "entero" : "decimal";
}

// Lo que se ve en pantalla, en el orden de la pantalla, con totales del detalle.
export function construirModelo(p: {
  nombre: string;
  guia: Guia;
  presentacion?: Presentacion;
  titulo: string;
  filas: Row[];
  negocio: string;
  desde: Date | string;
  hasta: Date | string;
  generadoPor: string;
  emitido: string;
}): Modelo {
  const g = p.guia;
  const pres = p.presentacion ?? {};
  const esResumen = pres.esResumen ?? (() => false);
  const resumen = p.filas.filter(esResumen);
  const detalle = p.filas.filter((f) => !esResumen(f));
  const claves = [...new Set(p.filas.flatMap((f) => Object.keys(f)))];
  const explicacion = (clave: string) => g.columnas[clave];
  const formatos = new Map(
    claves.map((c) => [
      c,
      formatoDe(c, p.filas, pres, explicacion(c)?.significa),
    ]),
  );
  const columnaDe = (clave: string): Columna => ({
    clave,
    etiqueta: explicacion(clave)?.nombreAmigable ?? clave,
    formato: formatos.get(clave) ?? "texto",
    significa: explicacion(clave)?.significa,
  });

  const seccion = (
    titulo: string,
    filas: Row[],
    conTotales: boolean,
  ): Seccion => {
    const columnas = claves
      .filter((c) => filas.some((f) => f[c] !== null && f[c] !== undefined))
      .map(columnaDe);
    const totales =
      conTotales && pres.totales
        ? Object.fromEntries(
            pres.totales
              .filter((c) => columnas.some((x) => x.clave === c))
              .map((c) => [
                c,
                redondea(filas.reduce((t, f) => t + (Number(f[c]) || 0), 0)),
              ]),
          )
        : null;
    return { titulo, columnas, filas, totales };
  };

  const secciones = resumen.length
    ? [
        seccion(pres.tituloResumen ?? "Totales", resumen, false),
        seccion(pres.tituloDetalle ?? "Detalle", detalle, true),
      ]
    : [seccion(pres.tituloDetalle ?? "Detalle", detalle, true)];

  const ultima = secciones.at(-1)!;
  const cifras = ultima.totales
    ? Object.entries(ultima.totales).map(([clave, valor]) => ({
        etiqueta:
          clave === "Total"
            ? "Gran total"
            : "Total " + columnaDe(clave).etiqueta.toLowerCase(),
        valor,
        formato: formatos.get(clave) ?? "decimal",
      }))
    : [];

  return {
    nombre: p.nombre,
    titulo: p.titulo,
    negocio: p.negocio,
    periodo: `Del ${textoFecha(p.desde)} al ${textoFecha(p.hasta)}`,
    emitido: p.emitido,
    generadoPor: p.generadoPor,
    queEs: g.queEs,
    paraQueSirve: g.paraQueSirve,
    comoSeLee: g.comoSeLee,
    cifras,
    secciones,
    grafica: construirGrafica(pres.grafica, p.filas, ultima),
  };
}

// Gráfica de la presentación; si no hay, barras automáticas de la primera
// columna de texto contra la primera de importe (con al menos dos filas).
function construirGrafica(
  g: Grafica | undefined,
  filas: Row[],
  detalle: Seccion,
): GraficaModelo | null {
  if (g) return graficaDe(g, filas);
  const texto = detalle.columnas.find((c) => c.formato === "texto");
  const importe = detalle.columnas.find((c) => c.formato === "moneda");
  if (!texto || !importe || detalle.filas.length < 2) return null;
  return graficaDe(
    {
      tipo: "barras",
      titulo: importe.etiqueta,
      etiqueta: texto.clave,
      valor: importe.clave,
      maximo: 15,
    },
    detalle.filas,
  );
}

function graficaDe(g: Grafica, filas: Row[]): GraficaModelo | null {
  const base = g.filtro ? filas.filter(g.filtro) : filas;
  if (g.tipo === "pastel") {
    const puntos = g.columnas
      .map((c) => ({
        nombre: c,
        valor: redondea(base.reduce((t, f) => t + (Number(f[c]) || 0), 0)),
      }))
      .filter((p) => p.valor > 0);
    return {
      tipo: "pastel",
      titulo: g.titulo,
      etiqueta: "",
      valor: "",
      puntos,
    };
  }
  const suma = new Map<string, number>();
  for (const f of base) {
    const nombre = String(f[g.etiqueta] ?? "");
    const valor = Number(f[g.valor]);
    if (!Number.isFinite(valor)) continue;
    suma.set(nombre, g.agrupar ? (suma.get(nombre) ?? 0) + valor : valor);
  }
  const maximo = g.maximo ?? (g.tipo === "linea" ? 31 : 15);
  return {
    tipo: g.tipo,
    titulo: g.titulo,
    etiqueta: g.etiqueta,
    valor: g.valor,
    puntos: [...suma].slice(0, maximo).map(([nombre, valor]) => ({
      nombre,
      valor: redondea(valor),
    })),
  };
}
