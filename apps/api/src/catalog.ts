import {
  d,
  formatAmount,
  money,
  quantity,
  z,
  stockQty,
} from "@fitstore/shared";
import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import type { Response } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import ExcelJS from "exceljs";
import type { Prisma } from "@prisma/client";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  parse,
  safe,
  audit,
  bad,
  uuid,
  amount,
  json,
} from "./common";
import { expiredQty } from "./inventory";
import { assertSafeXlsx, assertSheetCells, cellCodeText } from "./xlsx-guard";

// Paso 04: el catálogo que cargan la caja y Mercancía da como `stock` lo
// vendible (sin lotes vencidos, que la venta no toma); lo físico y lo vencido
// van aparte para mostrar "vencido: N".
function sellable<
  V extends {
    stock: unknown;
    lots: { qty: unknown; expiryDate: Date | null }[];
  },
>(variant: V, category: { requiresExpiry: boolean }) {
  const blocked = expiredQty(variant.lots, category);
  return {
    ...variant,
    stock: String(quantity(d(String(variant.stock)).minus(blocked))),
    physicalStock: String(variant.stock),
    expiredStock: String(blocked),
  };
}

// Un código (SKU o código de barras) es de una sola variante (R9-codigos-1).
// La caja y Mercancía lo buscan sin distinguir mayúsculas y en los dos
// campos, pero los índices únicos de la base distinguen mayúsculas y van cada
// uno por su lado: «ABC-1» en las barras de un producto y «abc-1» en el SKU de
// otro entraban, y la caja dejaba de agregar los dos por código. Cada elemento
// es una variante; sus propios códigos pueden coincidir entre sí (el SKU igual
// a las barras, como el ID del inventario) e `id` es la variante que se edita.
export async function assertCodesFree(
  tx: Prisma.TransactionClient,
  branchId: string,
  variants: { id?: string; codes: (string | undefined)[] }[],
) {
  const owners = new Map<string, { code: string; index: number }>();
  variants.forEach((v, index) => {
    for (const code of v.codes) {
      if (!code?.trim()) continue;
      const key = code.trim().toLowerCase();
      const seen = owners.get(key);
      if (seen && seen.index !== index)
        bad(
          "El código " +
            code.trim() +
            " se repite en más de una variante (sin distinguir mayúsculas). Cada código debe ser de un solo producto.",
        );
      owners.set(key, { code: code.trim(), index });
    }
  });
  if (!owners.size) return;
  const keys = [...owners.keys()].sort();
  const codes = keys.map((k) => owners.get(k)!.code);
  const except = variants.flatMap((v) => (v.id ? [v.id] : []));
  // Un bloqueo por código, siempre en el mismo orden: dos altas a la vez con
  // el mismo código en otras mayúsculas no pasan las dos la revisión.
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('variant-code'), hashtext(k))::text)::int AS locked FROM unnest(${keys}::text[]) AS k`;
  // Misma expresión que los índices únicos de K2 (lower(btrim(...)) con su
  // condición): la búsqueda usa el índice y ve también un código heredado con
  // espacios a los lados.
  const [taken] = await tx.$queryRaw<
    { code: string; name: string; branchId: string }[]
  >`WITH wanted AS (SELECT code, lower(code) AS k FROM unnest(${codes}::text[]) AS code)
    SELECT w.code, p.name, v."branchId" FROM wanted w
      JOIN "Variant" v ON lower(btrim(v.sku)) = w.k AND btrim(v.sku) <> ''
      JOIN "Product" p ON p.id = v."productId"
      WHERE v.id <> ALL(${except}::uuid[])
    UNION ALL
    SELECT w.code, p.name, v."branchId" FROM wanted w
      JOIN "Variant" v ON lower(btrim(v.barcode)) = w.k AND btrim(v.barcode) <> ''
      JOIN "Product" p ON p.id = v."productId"
      WHERE v.id <> ALL(${except}::uuid[])
    LIMIT 1`;
  if (taken)
    bad(
      taken.branchId === branchId
        ? "El código " +
            taken.code +
            " ya es de «" +
            taken.name +
            "». Usa otro código o corrige el de ese producto en Productos."
        : "El código " + taken.code + " ya se usa en otra sucursal.",
    );
}

// K2: la base también impone los códigos (índices únicos lower(btrim(...)) de
// la migración 202610170001). Si otra escritura confirma el mismo código en
// otras mayúsculas entre la revisión y el INSERT, el índice responde 23505
// (P2002). Tras el rollback se revisa de nuevo con una consulta nueva para dar
// el mismo mensaje de R9-codigos; si no es un código, sigue el error original
// (409 genérico del filtro global).
export async function explainCodeConflict(
  db: Prisma.TransactionClient,
  branchId: string,
  variants: { id?: string; codes: (string | undefined)[] }[],
  error: any,
): Promise<never> {
  if (
    error?.code === "P2002" ||
    error?.code === "23505" ||
    (error?.code === "P2010" && String(error?.meta?.code) === "23505")
  )
    await assertCodesFree(db, branchId, variants);
  throw error;
}

// La categoría de un producto debe ser de la sucursal de quien lo crea: el
// importador y el formulario aceptaban cualquier ID (o uno inexistente, que
// terminaba en un error 500 de la base).
async function assertCategoriesInBranch(
  tx: any,
  branchId: string,
  ids: (string | undefined)[],
) {
  const wanted = [...new Set(ids.filter(Boolean))] as string[];
  if (!wanted.length) return;
  const found = await tx.category.findMany({
    where: { id: { in: wanted }, branchId },
    select: { id: true },
  });
  if (found.length !== wanted.length)
    bad(
      "La categoría " +
        wanted.find((id) => !found.some((c: any) => c.id === id)) +
        " no existe en tu sucursal. Copia el ID de la hoja «Categorías» de la plantilla.",
    );
}

const variantSchema = z.object({
  sku: z.string().trim().min(1).max(80),
  barcode: z.string().trim().min(1).max(80),
  attributes: z.record(z.string()).default({}),
  price: amount,
  costAvg: amount,
  wholesalePrice: amount.optional(),
});
const productSchema = z.object({
  name: z.string().trim().min(2).max(150),
  sku: z.string().trim().min(1).max(80),
  categoryId: uuid,
  brand: z.string().max(80).default("Nexora"),
  supplierId: uuid.nullable().optional(),
  description: z.string().max(3000).default(""),
  imageUrl: z.string().max(1000).optional(),
  taxRate: z.number().min(0).max(100).default(18),
  minStock: amount.default(5),
  maxStock: amount.default(80),
  location: z.string().max(80).default(""),
  variants: z.array(variantSchema).min(1).max(500),
});

@Controller()
export class CatalogController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("catalog-template.xlsx")
  @Permit("catalog:write")
  async template(@Res() res: Response) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Productos");
    sheet.addRow([
      "Nombre",
      "SKU",
      "ID categoría",
      "Código de barras",
      "Precio",
      "Costo",
    ]);
    sheet.addRow([
      "Producto de ejemplo",
      "SKU-001",
      "Pegar ID de categoría",
      "7700000000010",
      1500,
      800,
    ]);
    sheet.columns.forEach((c) => (c.width = 24));
    const cats = workbook.addWorksheet("Categorías");
    cats.addRow(["ID", "Nombre"]);
    for (const c of await this.db.category.findMany())
      cats.addRow([c.id, c.name]);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="plantilla-productos.xlsx"',
    );
    res.end(Buffer.from(await workbook.xlsx.writeBuffer()));
  }
  @Get("categories")
  @Permit("catalog:read")
  categories() {
    return this.db.category.findMany({ orderBy: { createdAt: "asc" } });
  }
  @Post("categories")
  @Permit("catalog:write")
  async category(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        name: z.string().min(2),
        requiresLot: z.boolean().default(false),
        requiresExpiry: z.boolean().default(false),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#7C3AED"),
        attributes: z.array(z.string()).default([]),
      }),
      body,
    );
    const row = await this.db.category.create({
      data: { ...data, createdBy: actor.id, branchId: actor.branchId },
    });
    await audit(this.db, actor, "create", "category", row.id, undefined, row);
    return row;
  }
  @Get("brands")
  @Permit("catalog:read")
  brands() {
    return this.db.brand.findMany();
  }
  @Post("brands")
  @Permit("catalog:write")
  brand(@Body() body: unknown) {
    return this.db.brand.create({
      data: parse(z.object({ name: z.string().min(2).max(80) }), body),
    });
  }
  @Get("products")
  @Permit("catalog:read")
  async list(
    @Query() query: Record<string, string>,
    @CurrentUser() actor: Actor,
  ) {
    const q = query.q?.trim().slice(0, 100);
    const page = Math.max(1, Number(query.page) || 1),
      limit = Math.min(200, Math.max(1, Number(query.limit) || 60));
    const where: any = {
      branchId: actor.branchId,
      active: query.active === "false" ? false : true,
      ...(query.categoryId
        ? { categoryId: parse(uuid, query.categoryId) }
        : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { sku: { contains: q, mode: "insensitive" } },
              {
                variants: {
                  some: {
                    OR: [
                      { barcode: q },
                      { sku: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.db.product.findMany({
        where,
        include: {
          category: true,
          variants: {
            where: { active: true },
            include: {
              lots: {
                where: { qty: { gt: 0 } },
                orderBy: { expiryDate: "asc" },
              },
            },
          },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.db.product.count({ where }),
    ]);
    return safe(
      {
        items: items.map((p) => ({
          ...p,
          variants: p.variants.map((v) => sellable(v, p.category)),
        })),
        total,
        page,
        limit,
      },
      actor,
    );
  }
  @Get("products/:id")
  @Permit("catalog:read")
  async detail(@Param("id") id: string, @CurrentUser() actor: Actor) {
    const row = await this.db.product.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
      include: {
        category: true,
        variants: {
          include: {
            lots: true,
            movements: { orderBy: { createdAt: "desc" }, take: 100 },
          },
        },
      },
    });
    // El detalle conserva `stock` físico y agrega lo vencido y lo vendible.
    return safe(
      {
        ...row,
        variants: row.variants.map((v) => {
          const s = sellable(v, row.category);
          return {
            ...v,
            expiredStock: s.expiredStock,
            sellableStock: s.stock,
          };
        }),
      },
      actor,
    );
  }
  @Post("products")
  @Permit("catalog:write")
  async create(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { variants, ...data } = parse(productSchema, body);
    const codes = variants.map((v) => ({ codes: [v.sku, v.barcode] }));
    const write = this.db.$transaction(async (tx) => {
      await assertCategoriesInBranch(tx, actor.branchId, [data.categoryId]);
      await assertCodesFree(tx, actor.branchId, codes);
      const row = await tx.product.create({
        data: {
          ...data,
          createdBy: actor.id,
          branchId: actor.branchId,
          variants: {
            create: variants.map((v) => ({
              ...v,
              createdBy: actor.id,
              branchId: actor.branchId,
            })),
          },
        },
        include: { variants: true },
      });
      await audit(tx, actor, "create", "product", row.id, undefined, row);
      return safe(row, actor);
    });
    return write.catch((error) =>
      explainCodeConflict(this.db, actor.branchId, codes, error),
    );
  }
  @Patch("products/:id")
  @Permit("catalog:write")
  async update(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      productSchema
        .omit({ variants: true })
        .partial()
        .extend({ active: z.boolean().optional() }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const before = await tx.product.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      await assertCategoriesInBranch(tx, actor.branchId, [data.categoryId]);
      const row = await tx.product.update({ where: { id }, data });
      await audit(tx, actor, "update", "product", id, before, row);
      return safe(row, actor);
    });
  }
  @Post("products/:id/variants")
  @Permit("catalog:write")
  async variants(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        attributes: z.record(z.array(z.string().min(1)).min(1).max(30)),
        price: amount,
        costAvg: amount,
      }),
      body,
    );
    const product = await this.db.product.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    let combinations: Record<string, string>[] = [{}];
    for (const [key, values] of Object.entries(data.attributes))
      combinations = combinations.flatMap((item) =>
        values.map((value) => ({ ...item, [key]: value })),
      );
    if (combinations.length > 500)
      bad("La matriz no puede exceder 500 variantes.");
    let codes: string[] = [];
    const write = this.db.$transaction(async (tx) => {
      const count = await tx.variant.count({ where: { productId: id } });
      codes = combinations.map((_, i) => product.sku + "-" + (count + i + 1));
      await assertCodesFree(
        tx,
        actor.branchId,
        codes.map((code) => ({ codes: [code] })),
      );
      const rows = [];
      for (let i = 0; i < combinations.length; i++)
        rows.push(
          await tx.variant.create({
            data: {
              productId: id,
              sku: codes[i],
              barcode: codes[i],
              attributes: combinations[i],
              price: data.price,
              costAvg: data.costAvg,
              branchId: actor.branchId,
              createdBy: actor.id,
            },
          }),
        );
      await audit(tx, actor, "matrix", "product", id, undefined, {
        count: rows.length,
      });
      return safe(rows, actor);
    });
    return write.catch((error) =>
      explainCodeConflict(
        this.db,
        actor.branchId,
        codes.map((code) => ({ codes: [code] })),
        error,
      ),
    );
  }
  @Patch("variants/:id")
  @Permit("catalog:write")
  async variant(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      variantSchema.partial().extend({ active: z.boolean().optional() }),
      body,
    );
    const write = this.db.$transaction(async (tx) => {
      const before = await tx.variant.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      // Sólo los códigos que cambian: reenviar los mismos al editar el precio
      // no se bloquea por un choque heredado (R9-codigos-1).
      await assertCodesFree(tx, actor.branchId, [
        {
          id: before.id,
          codes: [
            data.sku !== before.sku ? data.sku : undefined,
            data.barcode !== before.barcode ? data.barcode : undefined,
          ],
        },
      ]);
      const row = await tx.variant.update({ where: { id }, data });
      await audit(tx, actor, "price_change", "variant", id, before, row);
      // B-7 (auditoría 01): el costo promedio cambiado a mano, con existencias,
      // revalúa el inventario y la utilidad de las ventas siguientes sin
      // movimiento de inventario. Se permite (corrige errores de carga), pero
      // queda como «cost_change» en la bitácora y en una alerta alta.
      if (
        data.costAvg !== undefined &&
        !d(data.costAvg).eq(before.costAvg) &&
        Number(before.stock) > 0
      ) {
        const impact = money(
          d(before.stock).times(d(data.costAvg).minus(before.costAvg)),
        );
        await audit(
          tx,
          actor,
          "cost_change",
          "variant",
          id,
          { costAvg: Number(before.costAvg), stock: Number(before.stock) },
          { costAvg: Number(row.costAvg), inventoryImpact: impact },
        );
        const product = await tx.product.findUnique({
          where: { id: before.productId },
          select: { name: true },
        });
        const message =
          `${product?.name ?? before.sku}: costo promedio cambiado a mano de RD$ ${formatAmount(Number(before.costAvg))} ` +
          `a RD$ ${formatAmount(Number(row.costAvg))} con ${Number(before.stock)} en existencia ` +
          `(valor del inventario ${impact < 0 ? "−" : "+"}RD$ ${formatAmount(Math.abs(impact))}) · ${actor.name}.`;
        await tx.alert.upsert({
          where: { key: "cost-change:" + id },
          create: {
            key: "cost-change:" + id,
            type: "cost_change",
            severity: "high",
            entityId: id,
            branchId: actor.branchId,
            message,
          },
          update: { message, status: "new" },
        });
      }
      return safe(row, actor);
    });
    return write.catch((error) =>
      explainCodeConflict(
        this.db,
        actor.branchId,
        [{ id, codes: [data.sku, data.barcode] }],
        error,
      ),
    );
  }
  @Post("products/import")
  @Permit("catalog:write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async import(@UploadedFile() file: any, @CurrentUser() actor: Actor) {
    if (!file) bad("Selecciona un archivo Excel.");
    // SEC-01: valida el ZIP antes de que ExcelJS lo descomprima en memoria.
    assertSafeXlsx(file.buffer);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 501) bad("Máximo 500 filas por archivo.");
    assertSheetCells(sheet);
    const rows: any[] = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      rows.push({
        name: String(row.getCell(1).text),
        sku: cellCodeText(row.getCell(2)),
        categoryId: String(row.getCell(3).text),
        variants: [
          {
            sku: cellCodeText(row.getCell(2)),
            barcode: cellCodeText(row.getCell(4)),
            price: Number(row.getCell(5).value),
            costAvg: Number(row.getCell(6).value),
          },
        ],
      });
    });
    const validated = rows.map((row) => parse(productSchema, row));
    const codes = validated.flatMap((row) =>
      row.variants.map((v) => ({ codes: [v.sku, v.barcode] })),
    );
    const write = this.db.$transaction(async (tx) => {
      await assertCategoriesInBranch(
        tx,
        actor.branchId,
        validated.map((row) => row.categoryId),
      );
      // Todas las filas a la vez, contra la base y entre ellas: un choque
      // detiene la carga sin escribir ninguna (R9-codigos-1).
      await assertCodesFree(tx, actor.branchId, codes);
      for (const { variants, ...data } of validated)
        await tx.product.create({
          data: {
            ...data,
            branchId: actor.branchId,
            createdBy: actor.id,
            variants: {
              create: variants.map((v) => ({ ...v, branchId: actor.branchId })),
            },
          },
        });
      await audit(tx, actor, "import", "product", "batch", undefined, {
        count: validated.length,
      });
    });
    await write.catch((error) =>
      explainCodeConflict(this.db, actor.branchId, codes, error),
    );
    return { imported: validated.length };
  }
  @Post("kits")
  @Permit("catalog:write")
  async kit(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        kitVariantId: uuid,
        components: z
          .array(z.object({ componentVariantId: uuid, qty: stockQty(10000) }))
          .min(1),
      }),
      body,
    );
    if (data.components.some((c) => c.componentVariantId === data.kitVariantId))
      bad("Un combo no puede incluirse a sí mismo.");
    return this.db.$transaction(async (tx) => {
      const variant = await tx.variant.findFirstOrThrow({
        where: { id: data.kitVariantId, branchId: actor.branchId },
        include: { product: true },
      });
      const parts = await tx.variant.findMany({
        where: {
          id: { in: data.components.map((c) => c.componentVariantId) },
          branchId: actor.branchId,
        },
        include: { product: true },
      });
      if (
        parts.length !== data.components.length ||
        parts.some((p) => p.product.isKit)
      )
        bad("Usa componentes únicos y simples.");
      await tx.product.update({
        where: { id: variant.productId },
        data: { isKit: true },
      });
      await tx.kitComponent.deleteMany({ where: { kitVariantId: variant.id } });
      await tx.kitComponent.createMany({
        data: data.components.map((c) => ({ ...c, kitVariantId: variant.id })),
      });
      await audit(
        tx,
        actor,
        "kit_components",
        "product",
        variant.productId,
        undefined,
        json(data),
      );
      return { ok: true };
    });
  }
}
