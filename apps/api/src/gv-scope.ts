import { Prisma } from "@prisma/client";
import { d, money } from "@fitstore/shared";
import type { Actor, Database } from "./common";

// GV (categorías «GV …») es otra empresa: sus ventas no se suman con Grupo
// Macgen en reportes ni dashboards; van aparte (orden de la dueña, 18-nov-2026).
// Regla por venta: es GV si tiene algún artículo de una categoría «GV %».
// shortcut: medido en producción 0 ventas mezcladas; si llega a haberlas, una
// venta mixta contaría entera como GV y habría que repartir por línea.
export const GV_CATEGORY_PREFIX = "GV ";

// Sobre la venta con alias «s», como el resto de los reportes.
const gvItemExists = Prisma.sql`EXISTS (SELECT 1 FROM "SaleItem" gi JOIN "Variant" gvv ON gvv.id = gi."variantId" JOIN "Product" gp ON gp.id = gvv."productId" JOIN "Category" gc ON gc.id = gp."categoryId" WHERE gi."saleId" = s.id AND gc.name ILIKE 'GV %')`;

/** SQL: la venta «s» ES de GV. */
export const saleIsGvSql = () => gvItemExists;
/** SQL: la venta «s» NO es de GV (cuenta para Macgen). */
export const saleNotGvSql = () => Prisma.sql`NOT ${gvItemExists}`;

const gvItems = {
  items: {
    some: {
      variant: {
        product: {
          category: {
            name: { startsWith: GV_CATEGORY_PREFIX, mode: "insensitive" },
          },
        },
      },
    },
  },
} satisfies Prisma.SaleWhereInput;

/** Prisma where de Sale: la venta ES de GV. */
export const saleIsGvWhere: Prisma.SaleWhereInput = gvItems;
/** Prisma where de Sale: la venta NO es de GV. */
export const saleNotGvWhere: Prisma.SaleWhereInput = { NOT: gvItems };

// GV va aparte (no suma con Macgen): lo vendido en el período menos lo
// devuelto de esas ventas, como «revenue».
export async function gvTotals(
  db: Database,
  actor: Actor,
  range: { gte: Date; lte: Date },
  // Filtro extra de la venta (p. ej. sin cajas de prueba en el reporte formal).
  extra: Prisma.SaleWhereInput = {},
) {
  const sale = {
    ...extra,
    branchId: actor.branchId,
    createdAt: range,
    ...saleIsGvWhere,
  };
  const [sold, back] = await Promise.all([
    db.sale.aggregate({
      where: { ...sale, status: "completed" },
      _sum: { total: true },
      _count: true,
    }),
    db.saleReturn.aggregate({
      where: { branchId: actor.branchId, sale },
      _sum: { total: true },
    }),
  ]);
  return {
    total: money(d(sold._sum.total ?? 0).minus(back._sum.total ?? 0)),
    count: sold._count,
  };
}
