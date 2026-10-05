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
import { z } from "zod";
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
  brand: z.string().max(80).default("FitStore"),
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
    return safe({ items, total, page, limit }, actor);
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
    return safe(row, actor);
  }
  @Post("products")
  @Permit("catalog:write")
  async create(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const { variants, ...data } = parse(productSchema, body);
    return this.db.$transaction(async (tx) => {
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
    return this.db.$transaction(async (tx) => {
      const count = await tx.variant.count({ where: { productId: id } });
      const rows = [];
      for (let i = 0; i < combinations.length; i++)
        rows.push(
          await tx.variant.create({
            data: {
              productId: id,
              sku: product.sku + "-" + (count + i + 1),
              barcode: product.sku + "-" + (count + i + 1),
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
    return this.db.$transaction(async (tx) => {
      const before = await tx.variant.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      const row = await tx.variant.update({ where: { id }, data });
      await audit(tx, actor, "price_change", "variant", id, before, row);
      return safe(row, actor);
    });
  }
  @Post("products/import")
  @Permit("catalog:write")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async import(@UploadedFile() file: any, @CurrentUser() actor: Actor) {
    if (!file) bad("Selecciona un archivo Excel.");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount > 501) bad("Máximo 500 filas por archivo.");
    const rows: any[] = [];
    sheet.eachRow((row, n) => {
      if (n === 1) return;
      rows.push({
        name: String(row.getCell(1).text),
        sku: String(row.getCell(2).text),
        categoryId: String(row.getCell(3).text),
        variants: [
          {
            sku: String(row.getCell(2).text),
            barcode: String(row.getCell(4).text),
            price: Number(row.getCell(5).value),
            costAvg: Number(row.getCell(6).value),
          },
        ],
      });
    });
    const validated = rows.map((row) => parse(productSchema, row));
    await this.db.$transaction(async (tx) => {
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
    return { imported: validated.length };
  }
  @Post("kits")
  @Permit("catalog:write")
  async kit(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        kitVariantId: uuid,
        components: z
          .array(
            z.object({ componentVariantId: uuid, qty: z.number().positive() }),
          )
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
