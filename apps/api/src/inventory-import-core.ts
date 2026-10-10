// Carga inicial de inventario desde el Excel de la tienda (hoja con ID,
// DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y PRECIO
// DETALLE). Lógica compartida por el script de línea de comandos
// (scripts/import-inventario.ts) y por la pantalla «Importar inventario»
// (inventory-import.ts): una sola implementación, sin copias.
//
// - Un producto por fila. El ID es el código para cobrar: se escribe en la caja
//   y Enter. Si la descripción trae "Barcode 0815…", ese es el código de barras.
// - Las existencias entran como "Inventario inicial" en el kardex, con su costo.
// - Productos sin precio o sin costo quedan inactivos (no se venden).
// - Rechaza códigos que ya son de otro producto en la base, números
//   ambiguos, celdas con error de Excel o fórmulas sin calcular, y filas con
//   datos sin ID o sin DESCRIPCION. Si una categoría existente exige lote, se
//   detiene (opción disableLots lo desactiva).
// - La simulación (dryRun) da las mismas cifras que la carga real y no escribe.
// - Repetirlo no duplica ni pisa lo editado en la app: sólo crea los nuevos,
//   activa los que estaban inactivos por falta de precio o costo (completando
//   sólo lo que falta) y, con updatePrices, cambia precios. Las existencias de
//   productos ya cargados nunca se tocan.
// - Nunca se evalúa una fórmula: se lee el valor que Excel dejó guardado.
import type { Prisma, PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";

const COLORS: Record<string, string> = {
  Suplementos: "#7C3AED",
  Maquillaje: "#E11D48",
  Fajas: "#EC4899",
  "Ropa deportiva": "#0EA5E9",
  "Accesorios de gym": "#F97316",
};
const ATTRIBUTES: Record<string, string[]> = {
  Suplementos: ["sabor", "tamaño"],
  Maquillaje: ["tono"],
  Fajas: ["talla", "color"],
};
const LOW_MARGIN = 0.15;
// Límites de la base (R8-03): Decimal(14,3) para cantidades y Decimal(14,2)
// para dinero.
const MAX_QTY = 99999999999.999;
const MAX_MONEY = 999999999999.99;

export type Row = {
  id: string;
  /** REFERENCIA cuando no coincide con el ID (en 6 filas es un código de barras). */
  ref: string | null;
  name: string;
  barcode: string | null;
  category: string;
  qty: number;
  cost: number;
  price: number;
  /** Número de fila en el Excel (la 1 es el encabezado). */
  line?: number;
};

/** Un problema del archivo, con su fila del Excel cuando se conoce. */
export type FileProblem = { row?: number; message: string };

/** El Excel tiene errores: `problems` los lista (con fila) y `message` los resume. */
export class InventoryFileError extends Error {
  constructor(
    message: string,
    readonly problems: FileProblem[],
  ) {
    super(message);
    this.name = "InventoryFileError";
  }
}
/** La carga no se puede hacer tal cual (códigos ya usados, categoría con lote…). */
export class InventoryBlockedError extends Error {
  constructor(
    message: string,
    readonly problems: FileProblem[],
  ) {
    super(message);
    this.name = "InventoryBlockedError";
  }
}
/** Otra carga está en curso. */
export class InventoryBusyError extends Error {
  constructor() {
    super(
      "Ya hay otra carga de inventario en curso. Espera a que termine y vuelve a intentar.",
    );
    this.name = "InventoryBusyError";
  }
}

// Lo que muestra una celda, sin los envoltorios de ExcelJS: el resultado de
// una fórmula, el texto de un hipervínculo o de un texto con formato. Un error
// de Excel (#N/A, #REF!…), una fórmula sin valor calculado (archivo guardado
// por un programa) o un valor desconocido se informan; nunca se convierten en
// "[object Object]" (R9-importador-1).
type Plain = string | number | boolean | Date | null;
type Problem = { problem: string };
const isProblem = (v: Plain | Problem): v is Problem =>
  typeof v === "object" && v !== null && "problem" in v;
// ExcelJS no distingue una fórmula sin calcular de una que da "": el mensaje
// sirve para las dos.
const NO_RESULT =
  "fórmula sin valor calculado; abre el archivo en Excel y guárdalo, o escribe el valor en lugar de la fórmula";
function plain(v: ExcelJS.CellValue): Plain | Problem {
  if (v == null) return null;
  if (typeof v !== "object" || v instanceof Date) return v;
  if ("error" in v) return { problem: "la celda tiene el error " + v.error };
  if ("formula" in v || "sharedFormula" in v)
    return v.result === undefined
      ? { problem: NO_RESULT }
      : plain(v.result as ExcelJS.CellValue);
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("hyperlink" in v) return plain(v.text as ExcelJS.CellValue);
  return { problem: "la celda tiene un valor que no se puede leer" };
}
// ExcelJS quita de cell.value el resultado 0 o "" de una fórmula; cell.result
// lo conserva.
const cellPlain = (c: ExcelJS.Cell) =>
  c.type === ExcelJS.ValueType.Formula
    ? c.result === undefined
      ? { problem: NO_RESULT }
      : plain(c.result as ExcelJS.CellValue)
    : plain(c.value);
const text = (v: Plain | Problem): string =>
  v == null || isProblem(v) ? "" : String(v).trim();
// Números del Excel. Una celda numérica se usa tal cual. En texto se aceptan
// "1500", "1,5", "1.5", "1.250,50" y "1,250.50" (el último separador es el
// decimal). "1.250" o "1,250" son ambiguos (¿mil doscientos cincuenta o uno
// con veinticinco?) y se rechazan: nunca se cambia un número en silencio.
export const parseNumber = (v: ExcelJS.CellValue) => toNumber(plain(v));
function toNumber(v: Plain | Problem): number | string {
  if (typeof v === "number") return v;
  if (v != null && isProblem(v)) return v.problem;
  const raw = text(v)
    .replace(/^(rd)?\$\s*/i, "")
    .replace(/\s+/g, "");
  if (raw === "") return 0;
  if (/^-?\d+$/.test(raw)) return Number(raw);
  const lastDot = raw.lastIndexOf("."),
    lastComma = raw.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? "." : ",",
      group = dec === "." ? "," : ".";
    const re = new RegExp(
      "^-?\\d{1,3}(\\" + group + "\\d{3})*\\" + dec + "\\d+$",
    );
    if (!re.test(raw)) return "número no válido «" + raw + "»";
    return Number(raw.split(group).join("").replace(dec, "."));
  }
  const sep = lastDot >= 0 ? "." : ",";
  if (new RegExp("^-?\\d{1,3}(\\" + sep + "\\d{3})+$").test(raw))
    return (
      "«" + raw + "» es ambiguo; escríbelo sin separador de miles (1250 o 1,25)"
    );
  if (!new RegExp("^-?\\d+\\" + sep + "\\d+$").test(raw))
    return "número no válido «" + raw + "»";
  return Number(raw.replace(sep, "."));
}
const key = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

export type ReadOptions = {
  /** Máximo de productos (filas con datos) que acepta el archivo. */
  maxRows?: number;
  /** Se ejecuta con la hoja ya leída, antes de recorrerla (p. ej. tope de celdas). */
  inspect?: (sheet: ExcelJS.Worksheet) => void;
};

/** Lee el Excel (ruta o contenido en memoria). Nunca escribe en disco. */
export async function readInventory(
  source: string | Buffer,
  options: ReadOptions = {},
): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  if (typeof source === "string") await wb.xlsx.readFile(source);
  else await wb.xlsx.load(source as unknown as ArrayBuffer);
  const sheet =
    wb.worksheets.find((s) => /inventario/i.test(s.name)) ?? wb.worksheets[0];
  if (!sheet) throw new Error("El Excel no tiene hojas.");
  options.inspect?.(sheet);
  const header = sheet.getRow(1);
  const col: Record<string, number> = {};
  header.eachCell((cell, n) => (col[key(text(cellPlain(cell)))] = n));
  const need = {
    id: col.ID,
    name: col.DESCRIPCION,
    ref: col.REFERENCIA,
    group: Object.entries(col).find(([k]) => k.startsWith("SUBGRUPO"))?.[1],
    qty: col.EXISTENCIA,
    cost: col.COSTO,
    price: col.PRECIODETALLE,
  };
  const missing = Object.entries(need).filter(([, v]) => !v);
  if (missing.length) {
    const message =
      "Faltan columnas en el Excel: " + missing.map(([k]) => k).join(", ");
    throw new InventoryFileError(message, [{ message }]);
  }
  const rows: Row[] = [];
  const errors: FileProblem[] = [];
  // Existencia: no negativa, como máximo 3 decimales. Dinero: no negativo,
  // como máximo 2 decimales.
  const read = (
    cell: Plain | Problem,
    label: string,
    who: string,
    decimals: number,
    n: number,
  ) => {
    const v = toNumber(cell);
    if (typeof v === "string") {
      errors.push({ row: n, message: who + ", " + label + ": " + v });
      return 0;
    }
    const f = 10 ** decimals;
    const max = decimals === 2 ? MAX_MONEY : MAX_QTY;
    if (!Number.isFinite(v) || v > max) {
      errors.push({
        row: n,
        message: who + ", " + label + ": " + v + " (máximo " + max + ")",
      });
      return 0;
    }
    if (v < 0 || Math.abs(v * f - Math.round(v * f)) > 1e-6) {
      errors.push({
        row: n,
        message:
          who +
          ", " +
          label +
          ": " +
          v +
          " (debe ser 0 o más, con como máximo " +
          decimals +
          " decimales)",
      });
      return 0;
    }
    return v;
  };
  sheet.eachRow((r, n) => {
    if (n === 1) return;
    const [idCell, refCell, nameCell, group, qty, cost, price] = [
      need.id,
      need.ref,
      need.name,
      need.group,
      need.qty,
      need.cost,
      need.price,
    ].map((c) => cellPlain(r.getCell(c!)));
    // Una fórmula sin valor puede ser una que da "" (Excel la guarda igual):
    // sola no hace que la fila tenga datos.
    const filled = (v: Plain | Problem) =>
      isProblem(v) ? v.problem !== NO_RESULT : text(v) !== "";
    // El ID es siempre el código que la caja escribe (1001, 1223…). La
    // REFERENCIA o el "Barcode …" de la descripción, si traen otro número,
    // son el código de barras.
    const ref = text(refCell);
    const id = text(idCell) || ref;
    const raw = text(nameCell);
    // Sólo se ignoran las filas vacías y la de totales (SUB-GRUPO «TOTAL», o
    // un ID calculado sin descripción, como el COUNTA del Excel de la tienda).
    // Otra fila sin ID o sin DESCRIPCION detiene la carga: si no, ese producto
    // y sus existencias se perderían sin aviso (R9-importador-2).
    if (![idCell, refCell, nameCell, qty, cost, price].some(filled)) return;
    if (
      key(text(group)) === "TOTAL" ||
      (r.getCell(need.id!).type === ExcelJS.ValueType.Formula &&
        !filled(nameCell))
    )
      return;
    const who =
      id && !isProblem(idCell) ? "fila " + id : "fila " + n + " del Excel";
    for (const [label, v] of [
      ["ID", idCell],
      ["REFERENCIA", refCell],
      ["DESCRIPCION", nameCell],
      ["SUB-GRUPO", group],
    ] as const)
      if (isProblem(v))
        errors.push({
          row: n,
          message: who + ", " + label + ": " + v.problem,
        });
    const lacks = [
      !id && !isProblem(idCell) && "ID",
      !raw && !isProblem(nameCell) && "DESCRIPCION",
    ].filter(Boolean);
    if (lacks.length)
      errors.push({
        row: n,
        message:
          "fila " +
          n +
          " del Excel" +
          (id ? " (ID " + id + ")" : "") +
          ": falta " +
          lacks.join(" y "),
      });
    if (!id || !raw) return;
    const barcode =
      raw.match(/barcode\s*[:#]?\s*(\d{6,14})/i)?.[1] ??
      (ref && ref !== id ? ref : null);
    rows.push({
      id,
      ref: ref && ref !== id ? ref : null,
      name: raw
        .replace(/\s*\|?\s*barcode\s*[:#]?\s*\d{6,14}/i, "")
        .replace(/\s+/g, " ")
        .trim(),
      barcode,
      category: text(group) || "Sin categoría",
      qty: read(qty, "EXISTENCIA", who, 3, n),
      cost: read(cost, "COSTO", who, 2, n),
      price: read(price, "PRECIO DETALLE", who, 2, n),
      line: n,
    });
  });
  if (errors.length)
    throw new InventoryFileError(
      "Corrige el Excel antes de importar:\n- " +
        errors
          .slice(0, 30)
          .map((e) => e.message)
          .join("\n- ") +
        (errors.length > 30 ? "\n- … y " + (errors.length - 30) + " más" : ""),
      errors,
    );
  if (options.maxRows !== undefined && rows.length > options.maxRows) {
    const message =
      "El archivo tiene " +
      rows.length +
      " productos y el máximo por carga es " +
      options.maxRows +
      ". Divídelo en varios archivos.";
    throw new InventoryFileError(message, [{ message }]);
  }
  return rows;
}

// Cada código debe identificar una sola fila: IDs únicos, y una REFERENCIA o
// código de barras no puede repetirse ni ser el ID de otra fila (si no, una
// fila tomaría el producto de otra y la segunda nunca se crearía).
export function checkCodesDetailed(rows: Row[]): FileProblem[] {
  const problems: { message: string; ids: string[] }[] = [];
  // Sin distinguir mayúsculas, como la caja (R8-01).
  const k = (c: string) => c.toLowerCase();
  const ids = new Map<string, number>();
  rows.forEach((r) => ids.set(k(r.id), (ids.get(k(r.id)) ?? 0) + 1));
  for (const [id, n] of ids)
    if (n > 1)
      problems.push({
        message: "el ID " + id + " está repetido " + n + " veces",
        ids: [id],
      });
  const codes = new Map<string, string[]>();
  for (const r of rows)
    for (const code of new Set(
      ([r.ref, r.barcode].filter(Boolean) as string[]).map(k),
    ))
      codes.set(code, [...(codes.get(code) ?? []), r.id]);
  for (const [code, owners] of codes) {
    if (owners.length > 1)
      problems.push({
        message:
          "el código " + code + " aparece en los IDs " + owners.join(", "),
        ids: owners,
      });
    if (ids.has(code) && !owners.some((o) => k(o) === code))
      problems.push({
        message:
          "el código " +
          code +
          " de la fila " +
          owners[0] +
          " es el ID de otra fila",
        ids: [owners[0]],
      });
  }
  return problems.map((p) => ({
    message: p.message,
    row: rows.find((r) => k(r.id) === k(p.ids[0]))?.line,
  }));
}
export const checkCodes = (rows: Row[]) =>
  checkCodesDetailed(rows).map((p) => p.message);

// "Producto - Marca - Presentación" → Marca (formato de Suplementos).
export const brandOf = (row: Row) => {
  const parts = row.name.split(" - ").map((p) => p.trim());
  return row.category === "Suplementos" && parts.length >= 3 ? parts[1] : "";
};

// Margen sobre el precio sin ITBIS (los precios de la tienda incluyen ITBIS).
export const marginOf = (row: Row, taxRate = 18) =>
  row.price > 0 ? 1 - row.cost / (row.price / (1 + taxRate / 100)) : -1;

export const lacksCommercialData = (row: Pick<Row, "price" | "cost">) =>
  row.price <= 0 || row.cost <= 0;

export const priceAtOrBelowCost = (row: Pick<Row, "price" | "cost">) =>
  row.price > 0 && row.cost > 0 && row.price <= row.cost;

const lowMargin = (row: Row) =>
  row.price > 0 &&
  row.cost > 0 &&
  row.price > row.cost &&
  marginOf(row) < LOW_MARGIN;

/**
 * Decide únicamente el estado de venta; nunca corrige ni sustituye los importes.
 * Sin la política explícita se conserva el comportamiento histórico.
 */
export const activeForImport = (
  row: Pick<Row, "price" | "cost">,
  inactivatePriceAtOrBelowCost = false,
) =>
  !lacksCommercialData(row) &&
  (!inactivatePriceAtOrBelowCost || !priceAtOrBelowCost(row));

export function reviewOf(row: Row, inactivatePriceAtOrBelowCost = false) {
  const notes: string[] = [];
  if (row.price <= 0) notes.push("sin precio (queda inactivo)");
  if (row.cost <= 0) notes.push("sin costo (queda inactivo)");
  if (row.price > 0 && row.cost > 0 && row.price <= row.cost)
    notes.push(
      "precio igual o menor al costo" +
        (inactivatePriceAtOrBelowCost
          ? " (queda inactivo por política segura)"
          : ""),
    );
  else if (row.price > 0 && row.cost > 0 && marginOf(row) < LOW_MARGIN)
    notes.push(
      "margen bajo (" + Math.round(marginOf(row) * 100) + "% sin ITBIS)",
    );
  if (row.qty <= 0) notes.push("sin existencia");
  return notes;
}

export type ImportOptions = {
  updatePrices?: boolean;
  disableLots?: boolean;
  inactivatePriceAtOrBelowCost?: boolean;
  /** Con updatePrices, también reemplaza el costo de los productos ya cargados. */
  updateCosts?: boolean;
  /**
   * Actualización de existencias de productos ya cargados: cada diferencia
   * pasa por la ruta de conteo del sistema (apply) con su motivo. Sin esto
   * (línea de comandos) las existencias de productos cargados no se tocan.
   */
  stockCount?: {
    reason: string;
    apply: (
      tx: Prisma.TransactionClient,
      holder: Holder,
      delta: number,
      newQty: number,
    ) => Promise<void>;
  };
  /** Texto cuando una categoría con lote detiene la carga (por defecto, el de la línea de comandos). */
  lotStopMessage?: (category: string) => string;
};
export type ImportActor = { id: string; branchId: string };
export type ImportSummary = {
  leidos: number;
  nuevos: number;
  nuevosActivos: number;
  nuevosInactivos: number;
  sinCambios: number;
  activados: number;
  desactivados: number;
  precios: number;
  costos: number;
  existencias: number;
  unidadesSuben: number;
  unidadesBajan: number;
  noVienen: number;
  sinDatos: number;
  precioNoRentable: number;
  margenBajo: number;
  agotados: number;
  unidades: number;
};
export type ReviewLine = {
  id: string;
  name: string;
  category: string;
  qty: number;
  cost: number;
  price: number;
  active: boolean;
  notes: string[];
};
export type ChangeLine = {
  id: string;
  name: string;
  category: string;
  kind: "existencia" | "precio" | "costo";
  before: number;
  after: number;
};
export type CategoryLine = {
  name: string;
  nuevos: number;
  existencias: number;
  precios: number;
  costos: number;
  sinCambios: number;
  noVienen: number;
};
export type ImportReport = {
  /** Huella del estado de la base que se revisó (existencias y movimientos). */
  state: string;
  changes: ChangeLine[];
  categories: CategoryLine[];
  summary: ImportSummary;
  review: ReviewLine[];
  notices: string[];
  /** Categorías que la carga crearía (o creó). */
  newCategories: string[];
  /** Categorías cuyo lote/vencimiento se desactivaría (sólo con disableLots). */
  lotCategories: string[];
  /** Motivos por los que la carga real se detendría, con su fila. */
  blocking: FileProblem[];
};

type Db = PrismaClient | Prisma.TransactionClient;
export type Holder = Prisma.VariantGetPayload<{
  include: { product: { include: { category: true } } };
}>;
type CategoryPlan = {
  name: string;
  existing: Prisma.CategoryGetPayload<object> | null;
  disable: boolean;
};

// Códigos contra la base (R7-01, R8-01): el ID, la REFERENCIA o el código de
// barras de una fila no pueden pertenecer ya a otro producto. La caja compara
// sin distinguir mayúsculas, así que aquí también. Todo se revisa antes de
// escribir; un conflicto detiene la carga sin cambios.
async function prepare(
  db: Db,
  rows: Row[],
  actor: ImportActor,
  options: ImportOptions,
  dryRun: boolean,
) {
  const low = (c: string) => c.toLowerCase();
  const allCodes = [
    ...new Set(
      rows.flatMap((r) =>
        ([r.id, r.ref, r.barcode].filter(Boolean) as string[]).map(low),
      ),
    ),
  ];
  const holderIds = allCodes.length
    ? await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Variant"
        WHERE lower(sku) = ANY(${allCodes}) OR lower(barcode) = ANY(${allCodes})`
    : [];
  // La carga real bloquea las variantes que va a tocar: una venta que llegue
  // ahora espera, y lo que se lee a continuación ya incluye lo que se vendió.
  if (!dryRun && options.stockCount && holderIds.length)
    await db.$queryRaw`SELECT id FROM "Variant" WHERE id = ANY(${holderIds.map((h) => h.id)}::uuid[]) ORDER BY id FOR UPDATE`;
  const holders = await db.variant.findMany({
    where: { id: { in: holderIds.map((h) => h.id) } },
    include: { product: { include: { category: true } } },
  });
  const codeProblems: FileProblem[] = [];
  const ownOf = new Map<string, Holder | undefined>();
  for (const row of rows) {
    const own = holders.find((v) => v.sku === row.id);
    ownOf.set(row.id, own);
    for (const code of [row.id, row.ref, row.barcode].filter(
      Boolean,
    ) as string[]) {
      const other = holders.find(
        (v) =>
          (low(v.sku) === low(code) || low(v.barcode) === low(code)) &&
          v.id !== own?.id,
      );
      if (other)
        codeProblems.push({
          row: row.line,
          message:
            "fila " +
            row.id +
            ": el código " +
            code +
            " ya es de «" +
            other.product.name +
            "» (" +
            other.sku +
            ")",
        });
    }
  }
  // Existencias con lote: el conteo del sistema no las ajusta desde aquí.
  if (options.stockCount) {
    const lots = await db.lot.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: holders.map((h) => h.id) },
        qty: { gt: 0 },
      },
      _sum: { qty: true },
    });
    for (const row of rows) {
      const own = ownOf.get(row.id);
      if (!own || Number(own.stock) === row.qty) continue;
      const lotQty = Number(
        lots.find((l) => l.variantId === own.id)?._sum.qty ?? 0,
      );
      if (own.product.category.requiresLot)
        codeProblems.push({
          row: row.line,
          message:
            "fila " +
            row.id +
            ": «" +
            own.product.name +
            "» se controla por lotes; ajusta su existencia desde el lote en Inventario",
        });
      else if (row.qty < lotQty)
        codeProblems.push({
          row: row.line,
          message:
            "fila " +
            row.id +
            ": la existencia (" +
            row.qty +
            ") queda por debajo de lo que tiene en lotes (" +
            lotQty +
            "); ajusta el lote en Inventario",
        });
    }
  }
  // Productos de la base que el archivo no trae: nunca se tocan.
  const inFile = new Set(rows.map((r) => r.id));
  const others = await db.variant.findMany({
    where: { branchId: actor.branchId },
    select: {
      sku: true,
      product: { select: { category: { select: { name: true } } } },
    },
  });
  const notInFile = new Map<string, number>();
  for (const v of others)
    if (!inFile.has(v.sku))
      notInFile.set(
        v.product.category.name,
        (notInFile.get(v.product.category.name) ?? 0) + 1,
      );
  // Huella del estado revisado: existencias, precios, costos, estado y
  // movimientos de kardex de cada producto del archivo. Si cambia entre la
  // vista previa y la carga (una venta, una compra, un ajuste), la carga se
  // detiene en vez de aplicar diferencias calculadas sobre datos viejos.
  const movements = await db.inventoryMovement.groupBy({
    by: ["variantId"],
    where: { variantId: { in: holders.map((h) => h.id) } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const state = createHash("sha256")
    .update(
      JSON.stringify([
        [
          !!options.updatePrices,
          !!options.updateCosts,
          !!options.stockCount,
          !!options.disableLots,
          !!options.inactivatePriceAtOrBelowCost,
        ],
        rows
          .map((r) => {
            const h = ownOf.get(r.id);
            const m = h && movements.find((x) => x.variantId === h.id);
            return h
              ? [
                  r.id,
                  h.id,
                  String(h.stock),
                  String(h.price),
                  String(h.costAvg),
                  h.product.active,
                  h.active,
                  m?._count._all ?? 0,
                  m?._max.createdAt?.toISOString() ?? null,
                ]
              : [r.id];
          })
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ]),
    )
    .digest("hex");
  // Categorías (R7-03): se revisan todas antes de escribir nada (R8-03).
  // La simulación dice qué haría y, si la carga real se detendría por el
  // lote, lo avisa y sigue para mostrarse completa (R9-importador-3).
  const notices: string[] = [];
  const stops: string[] = [];
  const plan: CategoryPlan[] = [];
  for (const name of [...new Set(rows.map((r) => r.category))]) {
    const existing = await db.category.findUnique({ where: { name } });
    const disable =
      !!existing &&
      (existing.requiresLot || existing.requiresExpiry) &&
      rows.some((r) => r.category === name && r.qty > 0 && !ownOf.get(r.id));
    if (disable && !options.disableLots) {
      const stop = options.lotStopMessage
        ? options.lotStopMessage(name)
        : "La categoría «" +
          name +
          "» exige lote o vencimiento y el Excel no los trae. Desactívalo en " +
          "Productos › Categorías o repite con --sin-lotes (queda en la bitácora).";
      stops.push(stop);
      if (dryRun) notices.push("Aviso: la carga real se detendría. " + stop);
    } else if (dryRun && disable)
      notices.push("Desactivaría lote y vencimiento en «" + name + "».");
    if (dryRun && !existing)
      notices.push("Crearía la categoría «" + name + "».");
    plan.push({ name, existing, disable });
  }
  return {
    ownOf,
    plan,
    notices,
    stops,
    codeProblems,
    state,
    notInFile: [...notInFile].map(([name, count]) => ({ name, count })),
  };
}

/** Los datos cambiaron entre la vista previa y la carga. */
export class InventoryChangedError extends Error {
  constructor() {
    super(
      "Hubo ventas, compras o ajustes de inventario (o cambios en los productos) después de la vista previa. No se cargó nada: sube el archivo otra vez y revisa la vista previa nueva.",
    );
    this.name = "InventoryChangedError";
  }
}

/** Mensaje único de un conjunto de problemas que detiene la carga real. */
function blockedError(
  prepared: Awaited<ReturnType<typeof prepare>>,
): InventoryBlockedError | null {
  if (prepared.codeProblems.length)
    return new InventoryBlockedError(
      "Corrige el Excel o el catálogo antes de importar:\n- " +
        prepared.codeProblems
          .slice(0, 30)
          .map((p) => p.message)
          .join("\n- "),
      prepared.codeProblems,
    );
  if (prepared.stops.length)
    return new InventoryBlockedError(
      prepared.stops[0],
      prepared.stops.map((message) => ({ message })),
    );
  return null;
}

export type RunOptions = ImportOptions & {
  dryRun: boolean;
  /** Nombre del archivo, para el kardex y la bitácora. Nunca se guarda el archivo. */
  origen: string;
  /** Una sola carga a la vez (candado de PostgreSQL); la simulación no lo usa. */
  lock?: boolean;
  /** Huella de la vista previa: si la base ya es otra, la carga real se detiene. */
  expectState?: string;
  /** Se ejecuta dentro de la misma transacción, tras escribir (bitácora). */
  afterWrite?: (
    tx: Prisma.TransactionClient,
    report: ImportReport,
  ) => Promise<void>;
  transaction?: { maxWait?: number; timeout?: number };
};

/**
 * Valida y carga (o simula) las filas. La carga real es una sola transacción:
 * o se carga todo, o nada; vuelve a validar contra la base dentro de ella.
 */
export async function importInventory(
  db: PrismaClient,
  rows: Row[],
  actor: ImportActor,
  run: RunOptions,
): Promise<ImportReport> {
  const fileProblems = checkCodesDetailed(rows);
  if (fileProblems.length)
    throw new InventoryFileError(
      "Corrige el Excel antes de importar:\n- " +
        fileProblems.map((p) => p.message).join("\n- "),
      fileProblems,
    );
  if (run.dryRun) {
    const prepared = await prepare(db, rows, actor, run, true);
    if (prepared.codeProblems.length) throw blockedError(prepared);
    return load(db, rows, actor, run, prepared);
  }
  return db.$transaction(
    async (tx) => {
      if (run.lock) {
        const [{ locked }] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext('nexora-inventory-import')) AS locked`;
        if (!locked) throw new InventoryBusyError();
      }
      const prepared = await prepare(tx, rows, actor, run, false);
      if (run.expectState !== undefined && prepared.state !== run.expectState)
        throw new InventoryChangedError();
      const blocked = blockedError(prepared);
      if (blocked) throw blocked;
      const report = await load(tx, rows, actor, run, prepared);
      await run.afterWrite?.(tx, report);
      return report;
    },
    {
      maxWait: run.transaction?.maxWait ?? 20000,
      timeout: run.transaction?.timeout ?? 600000,
    },
  );
}

/** Lo que haría la carga real, sin escribir; incluye los motivos de bloqueo. */
export async function previewInventory(
  db: PrismaClient,
  rows: Row[],
  actor: ImportActor,
  options: ImportOptions & { origen: string },
): Promise<ImportReport> {
  const fileProblems = checkCodesDetailed(rows);
  const prepared = await prepare(db, rows, actor, options, true);
  const report = await load(
    db,
    rows,
    actor,
    { ...options, dryRun: true },
    prepared,
  );
  report.blocking = [
    ...fileProblems,
    ...prepared.codeProblems,
    ...prepared.stops.map((message) => ({ message })),
  ];
  return report;
}

async function load(
  db: Db,
  rows: Row[],
  actor: ImportActor,
  run: RunOptions,
  prepared: Awaited<ReturnType<typeof prepare>>,
): Promise<ImportReport> {
  const { dryRun, origen, updatePrices, inactivatePriceAtOrBelowCost } = run;
  const { ownOf, plan, notices } = prepared;
  const { branchId } = actor;
  const summary: ImportSummary = {
    leidos: rows.length,
    nuevos: 0,
    nuevosActivos: 0,
    nuevosInactivos: 0,
    sinCambios: 0,
    activados: 0,
    desactivados: 0,
    precios: 0,
    costos: 0,
    existencias: 0,
    unidadesSuben: 0,
    unidadesBajan: 0,
    noVienen: prepared.notInFile.reduce((n, c) => n + c.count, 0),
    sinDatos: 0,
    precioNoRentable: 0,
    margenBajo: 0,
    agotados: 0,
    unidades: 0,
  };
  const review: ReviewLine[] = [];
  const changeLines: ChangeLine[] = [];
  const byCategory = new Map<string, CategoryLine>();
  const cat = (name: string) => {
    let line = byCategory.get(name);
    if (!line) {
      line = {
        name,
        nuevos: 0,
        existencias: 0,
        precios: 0,
        costos: 0,
        sinCambios: 0,
        noVienen: 0,
      };
      byCategory.set(name, line);
    }
    return line;
  };
  for (const c of prepared.notInFile) cat(c.name).noVienen = c.count;
  // Una carga repetida no pisa lo que se editó en la app. Sólo activa
  // productos que estaban inactivos por no tener precio o costo y, con
  // updatePrices, cambia el precio (queda en la bitácora). Al activar se
  // completa sólo lo que falta: un precio puesto en la app se respeta, y se
  // activa si con lo completado tiene precio y costo (R9-importador-5).
  const changesFor = (
    existing: Holder,
    row: Row,
  ): { price?: number; costAvg?: number; active?: boolean } => {
    const price = Number(existing.price),
      costAvg = Number(existing.costAvg);
    const changes: {
      price?: number;
      costAvg?: number;
      active?: boolean;
    } = {};
    if (updatePrices && row.price > 0 && price !== row.price)
      changes.price = row.price;
    if (run.updateCosts && row.cost > 0 && costAvg !== row.cost)
      changes.costAvg = row.cost;
    if (!existing.product.active && (price <= 0 || costAvg <= 0)) {
      const fill = {
        price: price > 0 ? (changes.price ?? price) : row.price,
        costAvg: costAvg > 0 ? costAvg : row.cost,
      };
      if (fill.price > 0 && fill.costAvg > 0) {
        if (fill.price !== price) changes.price = fill.price;
        if (fill.costAvg !== costAvg) changes.costAvg = fill.costAvg;
      }
    }
    const final = {
      price: changes.price ?? price,
      cost: changes.costAvg ?? costAvg,
    };
    // Sólo reactiva los que estaban incompletos y ya quedaron vendibles. Un
    // producto desactivado manualmente con datos completos permanece así.
    if (
      !existing.product.active &&
      (price <= 0 || costAvg <= 0) &&
      activeForImport(final, inactivatePriceAtOrBelowCost)
    )
      changes.active = true;
    // La opción explícita también sanea una carga previa riesgosa, sin tocar
    // precio, costo ni existencia.
    if (
      inactivatePriceAtOrBelowCost &&
      existing.product.active &&
      !activeForImport(final, true)
    )
      changes.active = false;
    return changes;
  };
  for (const { name, existing, disable } of plan) {
    if (dryRun) continue;
    if (disable && existing) {
      await db.category.update({
        where: { name },
        data: { requiresLot: false, requiresExpiry: false },
      });
      await db.auditLog.create({
        data: {
          userId: actor.id,
          action: "category_lots_disabled_by_import",
          entity: "category",
          entityId: existing.id,
          before: {
            requiresLot: existing.requiresLot,
            requiresExpiry: existing.requiresExpiry,
          },
          after: { requiresLot: false, requiresExpiry: false, origen },
          branchId,
        },
      });
    } else if (!existing)
      await db.category.create({
        data: {
          name,
          branchId,
          createdBy: actor.id,
          color: COLORS[name] ?? "#7C3AED",
          attributes: ATTRIBUTES[name] ?? [],
        },
      });
  }
  const categories = dryRun ? [] : await db.category.findMany();
  for (const row of rows) {
    // Ya importado: se reconoce sólo por su ID.
    const existing = ownOf.get(row.id);
    const changes = existing ? changesFor(existing, row) : {};
    // Se revisa lo que queda: al activar con datos de la app, esos datos.
    const final = existing
      ? {
          ...row,
          price: changes.price ?? Number(existing.price),
          cost: changes.costAvg ?? Number(existing.costAvg),
        }
      : row;
    const active = existing
      ? (changes.active ?? existing.product.active)
      : activeForImport(final, inactivatePriceAtOrBelowCost);
    const notes = reviewOf(final, inactivatePriceAtOrBelowCost);
    if (!active && !notes.length)
      notes.push("permanece inactivo en el catálogo");
    if (notes.length)
      review.push({
        id: row.id,
        name: row.name,
        category: row.category,
        qty: row.qty,
        cost: final.cost,
        price: final.price,
        active,
        notes,
      });
    if (lacksCommercialData(final)) summary.sinDatos++;
    if (priceAtOrBelowCost(final)) summary.precioNoRentable++;
    if (lowMargin(final)) summary.margenBajo++;
    if (row.qty <= 0) summary.agotados++;
    if (existing) {
      const delta =
        run.stockCount && existing
          ? Math.round((row.qty - Number(existing.stock)) * 1000) / 1000
          : 0;
      const line = cat(row.category);
      const named = { id: row.id, name: row.name, category: row.category };
      if (delta !== 0) {
        summary.existencias++;
        if (delta > 0) summary.unidadesSuben += delta;
        else summary.unidadesBajan += -delta;
        line.existencias++;
        changeLines.push({
          ...named,
          kind: "existencia",
          before: Number(existing.stock),
          after: row.qty,
        });
      }
      if (changes.price !== undefined && Number(existing.price) > 0) {
        line.precios++;
        changeLines.push({
          ...named,
          kind: "precio",
          before: Number(existing.price),
          after: changes.price,
        });
      }
      if (changes.costAvg !== undefined && Number(existing.costAvg) > 0) {
        summary.costos++;
        line.costos++;
        changeLines.push({
          ...named,
          kind: "costo",
          before: Number(existing.costAvg),
          after: changes.costAvg,
        });
      }
      if (!Object.keys(changes).length && delta === 0) {
        summary.sinCambios++;
        line.sinCambios++;
        continue;
      }
      if (changes.active === true) summary.activados++;
      if (changes.active === false) summary.desactivados++;
      // Un precio que se cambia se cuenta aunque además se active; completar
      // uno que faltaba no.
      if (
        changes.price !== undefined &&
        (!changes.active || Number(existing.price) > 0)
      )
        summary.precios++;
      if (dryRun) continue;
      if (delta !== 0)
        await run.stockCount!.apply(
          db as Prisma.TransactionClient,
          existing,
          delta,
          row.qty,
        );
      if (!Object.keys(changes).length) continue;
      await db.variant.update({ where: { id: existing.id }, data: changes });
      if (changes.active !== undefined)
        await db.product.update({
          where: { id: existing.productId },
          data: { active: changes.active },
        });
      await db.auditLog.create({
        data: {
          userId: actor.id,
          action:
            changes.active === true
              ? "inventory_import_activate"
              : changes.active === false
                ? "inventory_import_deactivate_commercial_risk"
                : "price_change",
          entity: "variant",
          entityId: existing.id,
          before: {
            sku: existing.sku,
            price: Number(existing.price),
            costAvg: Number(existing.costAvg),
            active: existing.product.active,
          },
          after: { ...changes, origen },
          branchId,
        },
      });
      continue;
    }
    summary.nuevos++;
    cat(row.category).nuevos++;
    if (active) summary.nuevosActivos++;
    else summary.nuevosInactivos++;
    summary.unidades += Math.max(0, row.qty);
    if (dryRun) continue;
    const categoryId = categories.find((c) => c.name === row.category)!.id;
    const barcode = row.barcode ?? row.id;
    const product = await db.product.create({
      data: {
        name: row.name,
        categoryId,
        brand: brandOf(row) || "",
        active,
        minStock: 1,
        // Tres veces la existencia, sin pasar del límite de la columna: una
        // existencia válida no puede hacer fallar la carga real cuando la
        // simulación pasó (R9-importador-4).
        maxStock: Math.min(MAX_QTY, Math.max(10, row.qty * 3)),
        sku: "INV-" + row.id,
        branchId,
        createdBy: actor.id,
        variants: {
          create: {
            sku: row.id,
            barcode,
            price: row.price,
            costAvg: row.cost,
            stock: row.qty > 0 ? row.qty : 0,
            active,
            branchId,
            createdBy: actor.id,
          },
        },
      },
      include: { variants: true },
    });
    if (row.qty > 0)
      await db.inventoryMovement.create({
        data: {
          variantId: product.variants[0].id,
          type: "adjustment",
          qty: row.qty,
          unitCost: row.cost,
          balanceAfter: row.qty,
          reason: "Inventario inicial (" + origen + ")",
          userId: actor.id,
          branchId,
        },
      });
  }
  return {
    state: prepared.state,
    changes: changeLines,
    categories: [...byCategory.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    summary,
    review,
    notices,
    newCategories: plan.filter((p) => !p.existing).map((p) => p.name),
    lotCategories: plan.filter((p) => p.disable).map((p) => p.name),
    blocking: [],
  };
}
