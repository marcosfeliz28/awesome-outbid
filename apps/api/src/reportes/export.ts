import { can } from "@fitstore/shared";
import { bad } from "../common";
import type { ReportDef, Row } from "./base";

// Motor común de exportación (PDF y Excel). Recibe las mismas filas que la
// pantalla (`def.run`), así que las cifras son idénticas. Sólo presenta.

// shortcut: textos mínimos de la guía; la pieza B (guia.ts) los reemplaza.
export type ReportGuide = {
  queEs: string;
  paraQueSirve: string;
  comoSeLee: string;
  notas?: string[];
  /** Columnas con importes en RD$. */
  moneda?: string[];
  /** Qué significa cada columna. */
  columnas?: Record<string, string>;
  /** Filas de resumen: van en su propia sección y no suman en los totales. */
  esResumen?: (fila: Row) => boolean;
  tituloResumen?: string;
  tituloDetalle?: string;
  /** Columnas del detalle que se suman (sólo filas de detalle). */
  totales?: string[];
  grafica?: Grafica;
};
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
export type Formato = "moneda" | "entero" | "decimal" | "porcentaje" | "texto";
export type Columna = { clave: string; formato: Formato; significa?: string };
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
  notas: string[];
  cifras: { etiqueta: string; valor: number; formato: Formato }[];
  secciones: Seccion[];
  grafica: GraficaModelo | null;
};

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

export function comprobarLimite(filas: number) {
  if (filas > EXPORT_ROW_LIMIT)
    bad(
      `El reporte tiene ${String(filas).replace(/\B(?=(\d{3})+(?!\d))/g, ".")} filas y el máximo para exportar es ${String(EXPORT_ROW_LIMIT).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}. Selecciona un período más corto.`,
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

function formatoDe(clave: string, filas: Row[], guia: ReportGuide): Formato {
  if (guia.moneda?.includes(clave)) return "moneda";
  if (clave.includes("%")) return "porcentaje";
  const valores = filas
    .map((f) => f[clave])
    .filter((v) => v !== null && v !== undefined);
  if (!valores.length || !valores.every((v) => typeof v === "number"))
    return "texto";
  return valores.every((v) => Number.isInteger(v)) ? "entero" : "decimal";
}

// Lo que se ve en pantalla, en el orden de la pantalla, con totales del detalle.
export function construirModelo(p: {
  nombre: string;
  guia: ReportGuide;
  titulo: string;
  filas: Row[];
  negocio: string;
  desde: Date | string;
  hasta: Date | string;
  generadoPor: string;
  emitido: string;
}): Modelo {
  const g = p.guia;
  const esResumen = g.esResumen ?? (() => false);
  const resumen = p.filas.filter(esResumen);
  const detalle = p.filas.filter((f) => !esResumen(f));
  const claves = [...new Set(p.filas.flatMap((f) => Object.keys(f)))];
  const formatos = new Map(claves.map((c) => [c, formatoDe(c, p.filas, g)]));

  const seccion = (
    titulo: string,
    filas: Row[],
    conTotales: boolean,
  ): Seccion => {
    const columnas: Columna[] = claves
      .filter((c) => filas.some((f) => f[c] !== null && f[c] !== undefined))
      .map((clave) => ({
        clave,
        formato: formatos.get(clave) ?? "texto",
        significa: g.columnas?.[clave],
      }));
    const totales =
      conTotales && g.totales
        ? Object.fromEntries(
            g.totales
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
        seccion(g.tituloResumen ?? "Totales", resumen, false),
        seccion(g.tituloDetalle ?? "Detalle", detalle, true),
      ]
    : [seccion(g.tituloDetalle ?? "Detalle", detalle, true)];

  const cifras = secciones.at(-1)!.totales
    ? Object.entries(secciones.at(-1)!.totales!).map(([clave, valor]) => ({
        etiqueta:
          clave === "Total" ? "Gran total" : "Total " + clave.toLowerCase(),
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
    notas: g.notas ?? [],
    cifras,
    secciones,
    grafica: construirGrafica(g.grafica, p.filas),
  };
}

function construirGrafica(
  g: Grafica | undefined,
  filas: Row[],
): GraficaModelo | null {
  if (!g) return null;
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

// Textos mínimos por reporte exportable. La pieza B los reemplaza por guia.ts.
const MONEDA_VENTAS = ["Ventas netas", "Ticket promedio"];
export const GUIA_MINIMA: Record<string, ReportGuide> = {
  "ticket-promedio": {
    queEs:
      "Cuánto se vendió en la tienda por día y por mes, y cuánto gasta en promedio cada compra.",
    paraQueSirve:
      "Ver si las ventas suben o bajan y el valor típico de una factura.",
    comoSeLee:
      "Cada fila «Día» es un día; cada fila «Mes» es el mes completo. Ticket promedio = ventas netas entre facturas.",
    notas: ["Ventas netas: facturas vigentes menos devoluciones."],
    moneda: MONEDA_VENTAS,
    columnas: {
      Tipo: "Si la fila es un día o un mes completo.",
      Período: "Fecha del día o nombre del mes.",
      Facturas: "Cantidad de facturas vigentes del período.",
      "Ventas netas": "Dinero vendido, menos lo devuelto.",
      "Ticket promedio": "Ventas netas dividido entre facturas.",
    },
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
    queEs:
      "Cuánto entró por cada forma de pago en cada mes: efectivo, transferencia, tarjeta y crédito o contraentrega.",
    paraQueSirve: "Ver cómo cobra la tienda y cuánto está pendiente de cobrar.",
    comoSeLee:
      "Cada fila es un mes. Las devoluciones restan en el mes en que se hicieron, con la forma en que se reembolsaron.",
    notas: [
      "Si no tienes permiso para ver el arqueo y hay una caja abierta, el reporte no se muestra.",
    ],
    moneda: [
      "Efectivo",
      "Transferencia",
      "Tarjeta",
      "Crédito/contraentrega",
      "Otros",
      "Total",
    ],
    columnas: {
      Mes: "Mes de negocio (año y mes).",
      Efectivo: "Cobrado en efectivo.",
      Transferencia: "Cobrado por transferencia.",
      Tarjeta: "Cobrado con tarjeta.",
      "Crédito/contraentrega": "Quedó a crédito o se cobra contra entrega.",
      Otros: "Otras formas de pago.",
      Total: "Suma de las formas de pago del mes.",
    },
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
    queEs:
      "Cuánto se vendió de cada producto, cuánto costó y cuánta ganancia dejó.",
    paraQueSirve:
      "Saber qué productos dejan más ganancia y cuáles casi no dejan nada.",
    comoSeLee:
      "Margen % = (venta − costo) entre venta, sin restar el ITBIS. Las devoluciones ya están descontadas.",
    notas: [
      "Este reporte muestra costos: solo lo ve quien tiene permiso de ganancia.",
    ],
    moneda: ["Venta", "Costo", "Utilidad"],
    columnas: {
      Producto: "Nombre del producto.",
      Unidades: "Unidades vendidas, menos las devueltas.",
      Venta: "Dinero vendido del producto.",
      Costo: "Costo de lo que se vendió.",
      Utilidad: "Venta menos costo.",
      "Margen %": "Utilidad como porcentaje de la venta.",
    },
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
    queEs:
      "Cuánto vale la mercancía en existencia, por categoría y almacén, según su costo.",
    paraQueSirve: "Saber cuánto dinero está guardado en inventario.",
    comoSeLee:
      "Valor a costo = unidades × costo promedio. Las existencias negativas restan.",
    notas: [
      "Este reporte muestra costos: solo lo ve quien tiene permiso de ganancia.",
    ],
    moneda: ["Valor a costo"],
    columnas: {
      Categoría: "Categoría del producto.",
      Almacén: "Dónde está la mercancía (Casa o Tienda).",
      Unidades: "Piezas en existencia.",
      "Valor a costo": "Piezas por costo promedio.",
    },
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
    queEs:
      "Lo que los clientes deben por compras a crédito o contra entrega, según cuántos días pasaron desde la venta.",
    paraQueSirve: "Saber qué cobrar primero y qué facturas ya están vencidas.",
    comoSeLee:
      "La primera tabla resume por tramo de antigüedad. El detalle lista cada factura con su saldo. Los totales son del detalle.",
    moneda: ["Saldo"],
    columnas: {
      Tramo: "Tiempo transcurrido desde la venta.",
      Factura: "Número de factura.",
      Tipo: "Crédito o contraentrega.",
      Cliente: "Cliente de la factura.",
      Teléfono: "Teléfono del cliente.",
      Fecha: "Fecha de la venta.",
      Vence: "Fecha en que vence el pago.",
      Días: "Días desde la venta.",
      Facturas: "Cantidad de facturas.",
      Saldo: "Lo que falta por cobrar.",
    },
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
