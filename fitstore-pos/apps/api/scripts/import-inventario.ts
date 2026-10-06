// Carga el inventario de la tienda desde el Excel "INVENTARIO 2026" (hoja con
// ID, DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y
// PRECIO DETALLE).
//
//   pnpm --filter @fitstore/api inventory:import ../../INVENTARIO_2026.xlsx
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --dry-run
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --actualizar-precios
//
// - Un producto por fila. El ID es el código para cobrar: se escribe en la caja
//   y Enter. Si la descripción trae "Barcode 0815…", ese es el código de barras.
// - Las existencias entran como "Inventario inicial" en el kardex, con su costo.
// - Productos sin precio o sin costo quedan inactivos (no se venden) y salen en
//   el reporte de revisión junto con márgenes bajos y agotados.
// - Rechaza códigos que ya son de otro producto en la base y números
//   ambiguos. Si una categoría existente exige lote, se detiene; --sin-lotes
//   desactiva ese control (queda en la bitácora).
// - Repetirlo no duplica ni pisa lo editado en la app: sólo crea los nuevos,
//   activa los que estaban inactivos por falta de precio o costo y, con
//   --actualizar-precios, cambia precios (queda en la bitácora). Las
//   existencias de productos ya cargados nunca se tocan.
import { config } from "dotenv";
import { Prisma, PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
config({ path: "../../.env", quiet: true });

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

type Row = {
  id: string;
  /** REFERENCIA cuando no coincide con el ID (en 6 filas es un código de barras). */
  ref: string | null;
  name: string;
  barcode: string | null;
  category: string;
  qty: number;
  cost: number;
  price: number;
};

// Lo que muestra una celda, sin los envoltorios de ExcelJS: el resultado de
// una fórmula, el texto de un hipervínculo o de un texto con formato. Un error
// de Excel (#N/A, #REF!…), una fórmula sin valor calculado (archivo guardado
// por un programa) o un valor desconocido se informan; nunca se convierten en
// "[object Object]" (R9-importador-1).
type Plain = string | number | boolean | Date | null;
type Problem = { problem: string };
const isProblem = (v: Plain | Problem): v is Problem =>
  typeof v === "object" && v !== null && "problem" in v;
const NO_RESULT =
  "fórmula sin valor calculado; abre el archivo en Excel y guárdalo";
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

export async function readInventory(file: string): Promise<Row[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet =
    wb.worksheets.find((s) => /inventario/i.test(s.name)) ?? wb.worksheets[0];
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
  if (missing.length)
    throw new Error(
      "Faltan columnas en el Excel: " + missing.map(([k]) => k).join(", "),
    );
  const rows: Row[] = [];
  const errors: string[] = [];
  // Existencia: no negativa, como máximo 3 decimales. Dinero: no negativo,
  // como máximo 2 decimales.
  const read = (
    cell: Plain | Problem,
    label: string,
    who: string,
    decimals: number,
  ) => {
    const v = toNumber(cell);
    if (typeof v === "string") {
      errors.push(who + ", " + label + ": " + v);
      return 0;
    }
    const f = 10 ** decimals;
    const max = decimals === 2 ? MAX_MONEY : MAX_QTY;
    if (!Number.isFinite(v) || v > max) {
      errors.push(who + ", " + label + ": " + v + " (máximo " + max + ")");
      return 0;
    }
    if (v < 0 || Math.abs(v * f - Math.round(v * f)) > 1e-6) {
      errors.push(
        who +
          ", " +
          label +
          ": " +
          v +
          " (debe ser 0 o más, con como máximo " +
          decimals +
          " decimales)",
      );
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
      if (isProblem(v)) errors.push(who + ", " + label + ": " + v.problem);
    const lacks = [
      !id && !isProblem(idCell) && "ID",
      !raw && !isProblem(nameCell) && "DESCRIPCION",
    ].filter(Boolean);
    if (lacks.length)
      errors.push(
        "fila " +
          n +
          " del Excel" +
          (id ? " (ID " + id + ")" : "") +
          ": falta " +
          lacks.join(" y "),
      );
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
      qty: read(qty, "EXISTENCIA", who, 3),
      cost: read(cost, "COSTO", who, 2),
      price: read(price, "PRECIO DETALLE", who, 2),
    });
  });
  if (errors.length)
    throw new Error(
      "Corrige el Excel antes de importar:\n- " +
        errors.slice(0, 30).join("\n- ") +
        (errors.length > 30 ? "\n- … y " + (errors.length - 30) + " más" : ""),
    );
  return rows;
}

// Cada código debe identificar una sola fila: IDs únicos, y una REFERENCIA o
// código de barras no puede repetirse ni ser el ID de otra fila (si no, una
// fila tomaría el producto de otra y la segunda nunca se crearía).
export function checkCodes(rows: Row[]) {
  const problems: string[] = [];
  // Sin distinguir mayúsculas, como la caja (R8-01).
  const k = (c: string) => c.toLowerCase();
  const ids = new Map<string, number>();
  rows.forEach((r) => ids.set(k(r.id), (ids.get(k(r.id)) ?? 0) + 1));
  for (const [id, n] of ids)
    if (n > 1) problems.push("el ID " + id + " está repetido " + n + " veces");
  const codes = new Map<string, string[]>();
  for (const r of rows)
    for (const code of new Set(
      ([r.ref, r.barcode].filter(Boolean) as string[]).map(k),
    ))
      codes.set(code, [...(codes.get(code) ?? []), r.id]);
  for (const [code, owners] of codes) {
    if (owners.length > 1)
      problems.push(
        "el código " + code + " aparece en los IDs " + owners.join(", "),
      );
    if (ids.has(code) && !owners.some((o) => k(o) === code))
      problems.push(
        "el código " +
          code +
          " de la fila " +
          owners[0] +
          " es el ID de otra fila",
      );
  }
  return problems;
}

// "Producto - Marca - Presentación" → Marca (formato de Suplementos).
export const brandOf = (row: Row) => {
  const parts = row.name.split(" - ").map((p) => p.trim());
  return row.category === "Suplementos" && parts.length >= 3 ? parts[1] : "";
};

// Margen sobre el precio sin ITBIS (los precios de la tienda incluyen ITBIS).
export const marginOf = (row: Row, taxRate = 18) =>
  row.price > 0 ? 1 - row.cost / (row.price / (1 + taxRate / 100)) : -1;

export function reviewOf(row: Row) {
  const notes: string[] = [];
  if (row.price <= 0) notes.push("sin precio (queda inactivo)");
  if (row.cost <= 0) notes.push("sin costo (queda inactivo)");
  if (row.price > 0 && row.cost > 0 && row.price <= row.cost)
    notes.push("precio igual o menor al costo");
  else if (row.price > 0 && row.cost > 0 && marginOf(row) < LOW_MARGIN)
    notes.push(
      "margen bajo (" + Math.round(marginOf(row) * 100) + "% sin ITBIS)",
    );
  if (row.qty <= 0) notes.push("sin existencia");
  return notes;
}

async function main() {
  const file = process.argv.find((a) => /\.xlsx$/i.test(a));
  const dryRun = process.argv.includes("--dry-run");
  const updatePrices = process.argv.includes("--actualizar-precios");
  const disableLots = process.argv.includes("--sin-lotes");
  if (!file) throw new Error("Indica el archivo .xlsx del inventario.");
  const rows = await readInventory(resolve(process.cwd(), file));
  const problems = checkCodes(rows);
  if (problems.length)
    throw new Error(
      "Corrige el Excel antes de importar:\n- " + problems.join("\n- "),
    );

  const db = new PrismaClient();
  const admin = await db.user.findFirst({
    where: { active: true, role: { name: "admin" } },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Crea primero el administrador (admin:create).");
  const branchId = admin.branchId;
  const summary = {
    nuevos: 0,
    sinCambios: 0,
    activados: 0,
    precios: 0,
    inactivos: 0,
    unidades: 0,
  };
  const review: string[][] = [
    ["ID", "Producto", "Categoría", "Existencia", "Costo", "Precio", "Revisar"],
  ];

  // Códigos contra la base (R7-01, R8-01): el ID, la REFERENCIA o el código
  // de barras de una fila no pueden pertenecer ya a otro producto. La caja
  // compara sin distinguir mayúsculas, así que aquí también. Todo se revisa
  // antes de escribir; un conflicto detiene la carga sin cambios.
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
  const holders = await db.variant.findMany({
    where: { id: { in: holderIds.map((h) => h.id) } },
    include: { product: true },
  });
  const codeProblems: string[] = [];
  const ownOf = new Map<string, (typeof holders)[number] | undefined>();
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
        codeProblems.push(
          "fila " +
            row.id +
            ": el código " +
            code +
            " ya es de «" +
            other.product.name +
            "» (" +
            other.sku +
            ")",
        );
    }
  }
  if (codeProblems.length)
    throw new Error(
      "Corrige el Excel o el catálogo antes de importar:\n- " +
        codeProblems.slice(0, 30).join("\n- "),
    );
  // Categorías (R7-03): se revisan todas antes de escribir nada (R8-03).
  // La simulación dice qué haría y, si la carga real se detendría por el
  // lote, lo avisa y sigue para mostrarse completa (R9-importador-3).
  const notices: string[] = [];
  const plan: {
    name: string;
    existing: Awaited<ReturnType<typeof db.category.findUnique>>;
    disable: boolean;
  }[] = [];
  for (const name of [...new Set(rows.map((r) => r.category))]) {
    const existing = await db.category.findUnique({ where: { name } });
    const disable =
      !!existing &&
      (existing.requiresLot || existing.requiresExpiry) &&
      rows.some((r) => r.category === name && r.qty > 0 && !ownOf.get(r.id));
    if (disable && !disableLots) {
      const stop =
        "La categoría «" +
        name +
        "» exige lote o vencimiento y el Excel no los trae. Desactívalo en " +
        "Productos › Categorías o repite con --sin-lotes (queda en la bitácora).";
      if (!dryRun) throw new Error(stop);
      notices.push("Aviso: la carga real se detendría. " + stop);
    } else if (dryRun && disable)
      notices.push("Desactivaría lote y vencimiento en «" + name + "».");
    if (dryRun && !existing)
      notices.push("Crearía la categoría «" + name + "».");
    plan.push({ name, existing, disable });
  }
  // Una carga repetida no pisa lo que se editó en la app. Sólo activa
  // productos que estaban inactivos por no tener precio o costo y, con
  // --actualizar-precios, cambia el precio (queda en la bitácora).
  // Al activar se completa sólo lo que falta: un precio puesto en la app se
  // respeta, y se activa si con lo completado tiene precio y costo
  // (R9-importador-5).
  const changesFor = (
    existing: (typeof holders)[number],
    row: Row,
  ): { price?: number; costAvg?: number; active?: true } => {
    const price = Number(existing.price),
      costAvg = Number(existing.costAvg);
    const changes: { price?: number; costAvg?: number; active?: true } = {};
    if (updatePrices && row.price > 0 && price !== row.price)
      changes.price = row.price;
    if (!existing.product.active && (price <= 0 || costAvg <= 0)) {
      const fill = {
        price: price > 0 ? (changes.price ?? price) : row.price,
        costAvg: costAvg > 0 ? costAvg : row.cost,
      };
      if (fill.price > 0 && fill.costAvg > 0) {
        if (fill.price !== price) changes.price = fill.price;
        if (fill.costAvg !== costAvg) changes.costAvg = fill.costAvg;
        changes.active = true;
      }
    }
    return changes;
  };
  const origen = file.split(/[\\/]/).pop();
  // Una sola transacción (R8-03): o se carga todo, o nada. La simulación
  // recorre lo mismo y cuenta igual, sólo que no escribe (R9-importador-3).
  const load = async (tx: Prisma.TransactionClient | PrismaClient) => {
    for (const { name, existing, disable } of plan) {
      if (dryRun) continue;
      if (disable && existing) {
        await tx.category.update({
          where: { name },
          data: { requiresLot: false, requiresExpiry: false },
        });
        await tx.auditLog.create({
          data: {
            userId: admin.id,
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
        await tx.category.create({
          data: {
            name,
            branchId,
            createdBy: admin.id,
            color: COLORS[name] ?? "#7C3AED",
            attributes: ATTRIBUTES[name] ?? [],
          },
        });
    }
    const categories = dryRun ? [] : await tx.category.findMany();
    for (const row of rows) {
      // Ya importado: se reconoce sólo por su ID.
      const existing = ownOf.get(row.id);
      const changes = existing ? changesFor(existing, row) : {};
      // Se revisa lo que queda: al activar con datos de la app, esos datos.
      const final =
        existing && changes.active
          ? {
              ...row,
              price: changes.price ?? Number(existing.price),
              cost: changes.costAvg ?? Number(existing.costAvg),
            }
          : row;
      const notes = reviewOf(final);
      if (notes.length)
        review.push([
          row.id,
          row.name,
          row.category,
          String(row.qty),
          String(final.cost),
          String(final.price),
          notes.join("; "),
        ]);
      const active = final.price > 0 && final.cost > 0;
      if (!active) summary.inactivos++;
      if (existing) {
        if (!Object.keys(changes).length) {
          summary.sinCambios++;
          continue;
        }
        if (changes.active) summary.activados++;
        // Un precio que se cambia se cuenta aunque además se active; completar
        // uno que faltaba no.
        if (
          changes.price !== undefined &&
          (!changes.active || Number(existing.price) > 0)
        )
          summary.precios++;
        if (dryRun) continue;
        await tx.variant.update({ where: { id: existing.id }, data: changes });
        if (changes.active)
          await tx.product.update({
            where: { id: existing.productId },
            data: { active: true },
          });
        await tx.auditLog.create({
          data: {
            userId: admin.id,
            action: changes.active
              ? "inventory_import_activate"
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
      summary.unidades += Math.max(0, row.qty);
      if (dryRun) continue;
      const categoryId = categories.find((c) => c.name === row.category)!.id;
      const barcode = row.barcode ?? row.id;
      const product = await tx.product.create({
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
          createdBy: admin.id,
          variants: {
            create: {
              sku: row.id,
              barcode,
              price: row.price,
              costAvg: row.cost,
              stock: row.qty > 0 ? row.qty : 0,
              active,
              branchId,
              createdBy: admin.id,
            },
          },
        },
        include: { variants: true },
      });
      if (row.qty > 0)
        await tx.inventoryMovement.create({
          data: {
            variantId: product.variants[0].id,
            type: "adjustment",
            qty: row.qty,
            unitCost: row.cost,
            balanceAfter: row.qty,
            reason: "Inventario inicial (" + origen + ")",
            userId: admin.id,
            branchId,
          },
        });
    }
  };
  if (dryRun) await load(db);
  else
    await db.$transaction((tx) => load(tx), {
      maxWait: 20000,
      timeout: 600000,
    });
  const out = resolve(process.cwd(), "revision-inventario.csv");
  writeFileSync(
    out,
    "﻿" +
      review
        .map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(";"))
        .join("\r\n"),
  );
  for (const notice of notices) console.log(notice);
  console.log(
    (dryRun ? "Simulación: " : "") +
      rows.length +
      " productos leídos · " +
      summary.nuevos +
      " nuevos (" +
      summary.unidades +
      " unidades) · " +
      summary.sinCambios +
      " ya cargados sin cambios · " +
      summary.activados +
      " activados · " +
      summary.precios +
      " precios actualizados · " +
      summary.inactivos +
      " sin precio o costo en el Excel (inactivos).",
  );
  console.log(
    review.length -
      1 +
      " productos para revisar en " +
      out +
      " (ábrelo en Excel).",
  );
  await db.$disconnect();
}
if (process.argv[1]?.includes("import-inventario"))
  void main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
