// Carga el inventario de la tienda desde el Excel "INVENTARIO 2026" (hoja con
// ID, DESCRIPCION, REFERENCIA, SUB-GRUPO DE ARTICULO, EXISTENCIA, COSTO y
// PRECIO DETALLE).
//
//   pnpm --filter @fitstore/api inventory:import ../../INVENTARIO_2026.xlsx
//   pnpm --filter @fitstore/api inventory:import archivo.xlsx --dry-run
//
// - Un producto por fila. El ID es el código para cobrar: se escribe en la caja
//   y Enter. Si la descripción trae "Barcode 0815…", ese es el código de barras.
// - Las existencias entran como "Inventario inicial" en el kardex, con su costo.
// - Productos sin precio o sin costo quedan inactivos (no se venden) y salen en
//   el reporte de revisión junto con márgenes bajos y agotados.
// - Repetirlo no duplica: actualiza nombre, precio, costo y categoría, y sólo
//   toca existencias de productos nuevos.
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
    const id =
      text(r.getCell(need.ref!).value) || text(r.getCell(need.id!).value);
    const raw = text(r.getCell(need.name!).value);
    if (!id || !raw) return;
    const barcode = raw.match(/barcode\s*[:#]?\s*(\d{6,14})/i)?.[1] ?? null;
    rows.push({
      id,
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
  if (!file) throw new Error("Indica el archivo .xlsx del inventario.");
  const rows = await readInventory(resolve(process.cwd(), file));
  const dup = rows.filter((r, i) => rows.findIndex((x) => x.id === r.id) !== i);
  if (dup.length)
    throw new Error("IDs repetidos: " + dup.map((r) => r.id).join(", "));

  const db = new PrismaClient();
  const admin = await db.user.findFirst({
    where: { active: true, role: { name: "admin" } },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) throw new Error("Crea primero el administrador (admin:create).");
  const branchId = admin.branchId;
  const summary = { nuevos: 0, actualizados: 0, inactivos: 0, unidades: 0 };
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
    const existing = await db.variant.findUnique({
      where: { sku: row.id },
      include: { product: true },
    });
    const productData = {
      name: row.name,
      categoryId,
      brand: brandOf(row) || "",
      active,
      minStock: 1,
      maxStock: Math.max(10, row.qty * 3),
    };
    if (existing) {
      await db.product.update({
        where: { id: existing.productId },
        data: productData,
      });
      await db.variant.update({
        where: { id: existing.id },
        data: { price: row.price, costAvg: row.cost, active },
      });
      summary.actualizados++;
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
      " nuevos · " +
      summary.actualizados +
      " actualizados · " +
      summary.inactivos +
      " inactivos por falta de precio o costo · " +
      summary.unidades +
      " unidades cargadas.",
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
