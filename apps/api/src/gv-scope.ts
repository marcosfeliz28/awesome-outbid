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

// GV es un negocio interno de la tienda: en el producto (multiempresa) una
// categoría «GV …» de un cliente es una categoría más y nada se aparta.
export const gvApartado = () => process.env.PRODUCT_TENANCY !== "required";

/** SQL: la venta «s» ES de GV. */
export const saleIsGvSql = () => (gvApartado() ? gvItemExists : Prisma.sql`FALSE`);
/** SQL: la venta «s» NO es de GV (cuenta para Macgen). */
export const saleNotGvSql = () =>
  gvApartado() ? Prisma.sql`NOT ${gvItemExists}` : Prisma.sql`TRUE`;

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
/** Prisma where de Sale: la venta NO es de GV. Getter: en el producto no filtra. */
export const saleNotGvWhere: Prisma.SaleWhereInput = Object.defineProperty(
  {},
  "NOT",
  { enumerable: true, get: () => (gvApartado() ? gvItems : undefined) },
);

// GV va aparte (no suma con Macgen): lo vendido en el período menos lo
// devuelto de esas ventas, como «revenue».
export async function gvTotals(
  db: Database,
  actor: Actor,
  range: { gte: Date; lte: Date },
  // Filtro extra de la venta (p. ej. sin cajas de prueba en el reporte formal).
  extra: Prisma.SaleWhereInput = {},
) {
  if (!gvApartado()) return { total: money(0), count: 0 };
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
