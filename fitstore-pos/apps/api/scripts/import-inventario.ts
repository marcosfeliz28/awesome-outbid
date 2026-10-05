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
// - Repetirlo no duplica ni pisa lo editado en la app: sólo crea los nuevos,
//   activa los que estaban inactivos por falta de precio o costo y, con
//   --actualizar-precios, cambia precios (queda en la bitácora). Las
//   existencias de productos ya cargados nunca se tocan.
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
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
const num = (v: ExcelJS.CellValue) => {
  const n = Number(text(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
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
      qty: num(r.getCell(need.qty!).value),
      cost: num(r.getCell(need.cost!).value),
      price: num(r.getCell(need.price!).value),
    });
  });
  return rows;
}

// Cada código debe identificar una sola fila: IDs únicos, y una REFERENCIA o
// código de barras no puede repetirse ni ser el ID de otra fila (si no, una
// fila tomaría el producto de otra y la segunda nunca se crearía).
export function checkCodes(rows: Row[]) {
  const problems: string[] = [];
  const ids = new Map<string, number>();
  rows.forEach((r) => ids.set(r.id, (ids.get(r.id) ?? 0) + 1));
  for (const [id, n] of ids)
    if (n > 1) problems.push("el ID " + id + " está repetido " + n + " veces");
  const codes = new Map<string, string[]>();
  for (const r of rows)
    for (const code of new Set([r.ref, r.barcode].filter(Boolean) as string[]))
      codes.set(code, [...(codes.get(code) ?? []), r.id]);
  for (const [code, owners] of codes) {
    if (owners.length > 1)
      problems.push(
        "el código " + code + " aparece en los IDs " + owners.join(", "),
      );
    if (ids.has(code) && !owners.includes(code))
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
    codigos: 0,
    inactivos: 0,
    unidades: 0,
  };
  const review: string[][] = [
    ["ID", "Producto", "Categoría", "Existencia", "Costo", "Precio", "Revisar"],
  ];

  for (const name of [...new Set(rows.map((r) => r.category))]) {
    const existing = await db.category.findUnique({ where: { name } });
    if (dryRun) continue;
    // El Excel no trae lotes ni vencimientos: la categoría no los exige, para
    // que la caja venda sin pedir datos extra. Se pueden activar después en
    // Productos › Categorías cuando se reciba mercancía con lote.
    if (existing)
      await db.category.update({
        where: { name },
        data: { requiresLot: false, requiresExpiry: false },
      });
    else
      await db.category.create({
        data: {
          name,
          branchId,
          createdBy: admin.id,
          color: COLORS[name] ?? "#7C3AED",
          attributes: ATTRIBUTES[name] ?? [],
        },
      });
  }
  const categories = await db.category.findMany();

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
    // Ya importado: por ID, o por la clave de una carga anterior que usaba la
    // REFERENCIA (código de barras) como código. Nunca se carga dos veces.
    const existing =
      (await db.variant.findUnique({
        where: { sku: row.id },
        include: { product: true },
      })) ??
      // El importador anterior guardaba la REFERENCIA en el sku; un código de
      // barras igual en otro producto no identifica esta fila.
      (row.ref
        ? await db.variant.findUnique({
            where: { sku: row.ref },
            include: { product: true },
          })
        : null);
    const productData = {
      name: row.name,
      categoryId,
      brand: brandOf(row) || "",
      active,
      minStock: 1,
      maxStock: Math.max(10, row.qty * 3),
    };
    if (existing) {
      // Una carga repetida no pisa lo que se editó en la app (costo promedio,
      // precio, mínimos, activo). Sólo:
      // - corrige el código si la carga anterior usó la REFERENCIA;
      // - activa productos que estaban inactivos por no tener precio o costo;
      // - con --actualizar-precios, cambia el precio y lo deja en bitácora.
      const changes: Record<string, unknown> = {};
      if (existing.sku !== row.id) changes.sku = row.id;
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
      await db.$transaction(async (tx) => {
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
              : changes.price !== undefined
                ? "price_change"
                : "inventory_import_code",
            entity: "variant",
            entityId: existing.id,
            before: {
              sku: existing.sku,
              price: Number(existing.price),
              costAvg: Number(existing.costAvg),
              active: existing.product.active,
            },
            after: { ...changes, origen: file.split(/[\\/]/).pop() },
            branchId,
          },
        });
      });
      if (changes.active) summary.activados++;
      else if (changes.price !== undefined) summary.precios++;
      else summary.codigos++;
      continue;
    }
    const clash = await db.variant.findUnique({ where: { barcode } });
    await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          sku: "INV-" + row.id,
          branchId,
          createdBy: admin.id,
          variants: {
            create: {
              sku: row.id,
              // Si el código de barras ya existe en otro producto, se usa el ID.
              barcode: clash ? "INV-" + row.id : barcode,
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
            reason: "Inventario inicial (" + file.split(/[\\/]/).pop() + ")",
            userId: admin.id,
            branchId,
          },
        });
    });
    summary.nuevos++;
    summary.unidades += Math.max(0, row.qty);
  }
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
      summary.codigos +
      " códigos corregidos · " +
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
