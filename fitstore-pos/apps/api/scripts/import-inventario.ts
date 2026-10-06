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

const text = (v: ExcelJS.CellValue): string => {
  if (v == null) return "";
  if (typeof v === "object" && "result" in v) return text(v.result as any);
  if (typeof v === "object" && "richText" in v)
    return v.richText.map((t) => t.text).join("");
  return String(v).trim();
};
// Números del Excel. Una celda numérica se usa tal cual. En texto se aceptan
// "1500", "1,5", "1.5", "1.250,50" y "1,250.50" (el último separador es el
// decimal). "1.250" o "1,250" son ambiguos (¿mil doscientos cincuenta o uno
// con veinticinco?) y se rechazan: nunca se cambia un número en silencio.
export function parseNumber(v: ExcelJS.CellValue): number | string {
  if (typeof v === "number") return v;
  if (v && typeof v === "object" && "result" in v)
    return parseNumber(v.result as ExcelJS.CellValue);
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
  header.eachCell((cell, n) => (col[key(text(cell.value))] = n));
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
    r: ExcelJS.Row,
    col: number,
    label: string,
    id: string,
    decimals: number,
  ) => {
    const v = parseNumber(r.getCell(col).value);
    if (typeof v === "string") {
      errors.push("fila " + id + ", " + label + ": " + v);
      return 0;
    }
    const f = 10 ** decimals;
    // Límites de la base (R8-03): Decimal(14,2) y Decimal(14,3).
    const max = decimals === 2 ? 999999999999.99 : 99999999999.999;
    if (!Number.isFinite(v) || v > max) {
      errors.push(
        "fila " + id + ", " + label + ": " + v + " (máximo " + max + ")",
      );
      return 0;
    }
    if (v < 0 || Math.abs(v * f - Math.round(v * f)) > 1e-6) {
      errors.push(
        "fila " +
          id +
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
    // El ID es siempre el código que la caja escribe (1001, 1223…). La
    // REFERENCIA o el "Barcode …" de la descripción, si traen otro número,
    // son el código de barras.
    const ref = text(r.getCell(need.ref!).value);
    const id = text(r.getCell(need.id!).value) || ref;
    const raw = text(r.getCell(need.name!).value);
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
      category: text(r.getCell(need.group!).value) || "Sin categoría",
      qty: read(r, need.qty!, "EXISTENCIA", id, 3),
      cost: read(r, need.cost!, "COSTO", id, 2),
      price: read(r, need.price!, "PRECIO DETALLE", id, 2),
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
    if (disable && !disableLots)
      throw new Error(
        "La categoría «" +
          name +
          "» exige lote o vencimiento y el Excel no los trae. Desactívalo en " +
          "Productos › Categorías o repite con --sin-lotes (queda en la bitácora).",
      );
    plan.push({ name, existing, disable });
  }
  const origen = file.split(/[\\/]/).pop();
  // Una sola transacción (R8-03): o se carga todo, o nada.
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
    const categories = await tx.category.findMany();
    for (const row of rows) {
      const notes = reviewOf(row);
      if (notes.length)
        review.push([
          row.id,
          row.name,
          row.category,
          String(row.qty),
          String(row.cost),
          String(row.price),
          notes.join("; "),
        ]);
      const active = row.price > 0 && row.cost > 0;
      if (!active) summary.inactivos++;
      if (dryRun) continue;
      const categoryId = categories.find((c) => c.name === row.category)!.id;
      const barcode = row.barcode ?? row.id;
      // Ya importado: se reconoce sólo por su ID.
      const existing = ownOf.get(row.id);
      if (existing) {
        // Una carga repetida no pisa lo que se editó en la app. Sólo activa
        // productos que estaban inactivos por no tener precio o costo y, con
        // --actualizar-precios, cambia el precio (queda en la bitácora).
        const changes: Record<string, unknown> = {};
        const missingData =
          !existing.product.active &&
          (Number(existing.price) <= 0 || Number(existing.costAvg) <= 0);
        if (missingData && active) {
          changes.price = row.price;
          if (Number(existing.costAvg) <= 0) changes.costAvg = row.cost;
          changes.active = true;
        } else if (
          updatePrices &&
          row.price > 0 &&
          Number(existing.price) !== row.price
        )
          changes.price = row.price;
        if (!Object.keys(changes).length) {
          summary.sinCambios++;
          continue;
        }
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
        if (changes.active) summary.activados++;
        else summary.precios++;
        continue;
      }
      const product = await tx.product.create({
        data: {
          name: row.name,
          categoryId,
          brand: brandOf(row) || "",
          active,
          minStock: 1,
          maxStock: Math.max(10, row.qty * 3),
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
      summary.nuevos++;
      summary.unidades += Math.max(0, row.qty);
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
