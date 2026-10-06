import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
} from "@nestjs/common";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  parse,
  uuid,
  amount,
  reason,
  audit,
  bad,
  conflict,
  json,
} from "./common";
import { can, z, stockQty } from "@fitstore/shared";
import { passwordHash } from "./auth";

const customerSchema = z.object({
  creditLimit: amount.optional(),
  name: z.string().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  legalId: z.string().max(30).optional(),
  birthday: z.string().datetime().optional(),
  notes: z.string().max(1000).default(""),
});
const supplierSchema = z.object({
  name: z.string().min(2).max(120),
  legalId: z.string().max(30).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  paymentTermsDays: z.number().int().min(0).max(365).default(30),
  leadTimeDays: z.number().int().min(0).max(365).default(7),
});
const configSchema = z.object({
  name: z.string().min(2).max(100),
  legalId: z.string().max(30),
  address: z.string().max(200),
  phone: z.string().max(30),
  currency: z.literal("DOP"),
  taxIncluded: z.boolean(),
  sellerDiscountLimit: z.number().min(0).max(100),
  cardFeePercent: z.number().min(0).max(100),
  returnDays: z.number().int().min(0).max(365),
  idleDays: z.number().int().min(1).max(365),
  expiryDays: z.number().int().min(1).max(365),
  lowMargin: z.number().min(0).max(100),
  cashDifferenceLimit: amount,
  receiptWidth: z.enum(["58", "80"]),
  sessionTimeoutMinutes: z.number().min(1).max(480),
  allowNegativeStock: z.boolean().default(false),
  allowCreditSales: z.boolean().default(false),
  creditApprovalThreshold: amount.default(1000),
  unusualDiscountCount: z.number().int().min(1).max(1000).default(10),
  unusualDiscountPercent: z.number().min(0).max(100).default(25),
  lowSalesDropPercent: z.number().min(0).max(100).default(50),
  ncfMode: z.enum(["disabled", "prepared"]).default("disabled"),
});

@Controller()
export class AdminController {
  constructor(@Inject(Database) private db: Database) {}
  @Get("customers")
  @Permit("customers:write")
  async customers(@CurrentUser() actor: Actor) {
    const customers = await this.db.customer.findMany({
      where: { branchId: actor.branchId, active: true },
      orderBy: { name: "asc" },
    });
    const sales = await this.db.sale.groupBy({
      by: ["customerId"],
      where: { branchId: actor.branchId, status: "completed" },
      _sum: { total: true },
      _count: true,
      _max: { createdAt: true },
    });
    return customers.map((c) => ({
      ...c,
      totalSpent: Number(
        sales.find((s) => s.customerId === c.id)?._sum.total ?? 0,
      ),
      purchases: sales.find((s) => s.customerId === c.id)?._count ?? 0,
      lastPurchase: sales.find((s) => s.customerId === c.id)?._max.createdAt,
    }));
  }
  @Post("customers")
  @Permit("customers:write")
  async customer(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(customerSchema, body);
    if (
      data.creditLimit !== undefined &&
      !can(actor.permissions, "sale:manage")
    )
      bad("Sólo un gerente puede definir el límite de crédito.");
    const row = await this.db.customer.create({
      data: {
        ...data,
        birthday: data.birthday ? new Date(data.birthday) : null,
        createdBy: actor.id,
        branchId: actor.branchId,
      },
    });
    await audit(this.db, actor, "create", "customer", row.id, undefined, row);
    return row;
  }
  @Patch("customers/:id")
  @Permit("customers:write")
  async editCustomer(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(customerSchema.partial(), body);
    if (
      data.creditLimit !== undefined &&
      !can(actor.permissions, "sale:manage")
    )
      bad("Sólo un gerente puede cambiar el límite de crédito.");
    await this.db.customer.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    return this.db.customer.update({
      where: { id },
      data: {
        ...data,
        ...(data.birthday ? { birthday: new Date(data.birthday) } : {}),
      },
    });
  }
  @Get("suppliers") @Permit("purchase:write") suppliers(
    @CurrentUser() actor: Actor,
  ) {
    return this.db.supplier.findMany({
      where: { branchId: actor.branchId, active: true },
      orderBy: { name: "asc" },
    });
  }
  @Post("suppliers")
  @Permit("purchase:write")
  supplier(@Body() body: unknown, @CurrentUser() actor: Actor) {
    return this.db.supplier.create({
      data: {
        ...parse(supplierSchema, body),
        createdBy: actor.id,
        branchId: actor.branchId,
      },
    });
  }
  @Post("supplier-payments")
  @Permit("purchase:write")
  async supplierPayment(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        supplierId: uuid,
        amount: z.number().positive(),
        method: z.enum(["cash", "card", "transfer"]),
        reference: z.string().optional(),
      }),
      body,
    );
    await this.db.supplier.findFirstOrThrow({
      where: { id: data.supplierId, branchId: actor.branchId },
    });
    const row = await this.db.supplierPayment.create({
      data: { ...data, createdBy: actor.id, branchId: actor.branchId },
    });
    await audit(
      this.db,
      actor,
      "payment",
      "supplier",
      data.supplierId,
      undefined,
      row,
    );
    return row;
  }
  @Get("expense-categories") @Permit("expense:write") expenseCategories() {
    return this.db.expenseCategory.findMany({ orderBy: { name: "asc" } });
  }
  @Post("expense-categories") @Permit("expense:write") expenseCategory(
    @Body() body: unknown,
  ) {
    return this.db.expenseCategory.create({
      data: parse(
        z.object({ name: z.string().min(2), monthlyBudget: amount }),
        body,
      ),
    });
  }
  @Patch("expense-categories/:id") @Permit("expense:write") budget(
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.db.expenseCategory.update({
      where: { id: parse(uuid, id) },
      data: parse(z.object({ monthlyBudget: amount }), body),
    });
  }
  @Get("expenses") @Permit("expense:write") expenses(
    @CurrentUser() actor: Actor,
  ) {
    return this.db.expense.findMany({
      where: { branchId: actor.branchId, voided: false },
      include: { category: true },
      orderBy: { date: "desc" },
      take: 300,
    });
  }
  @Post("expenses")
  @Permit("expense:write")
  async expense(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        categoryId: uuid,
        amount: z.number().positive(),
        description: reason,
        date: z.string().datetime().optional(),
        method: z.enum(["cash", "card", "transfer"]),
        receiptUrl: z.string().max(1000).optional(),
        recurring: z.boolean().default(false),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const row = await tx.expense.create({
        data: {
          ...data,
          date: data.date ? new Date(data.date) : new Date(),
          createdBy: actor.id,
          branchId: actor.branchId,
        },
      });
      await audit(tx, actor, "create", "expense", row.id, undefined, row);
      return row;
    });
  }
  @Post("expenses/:id/void")
  @Permit("expense:write")
  async voidExpense(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object({ reason }), body);
    return this.db.$transaction(async (tx) => {
      const row = await tx.expense.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId, voided: false },
      });
      await tx.expense.update({ where: { id }, data: { voided: true } });
      await audit(tx, actor, "void", "expense", id, row, data);
      return { ok: true };
    });
  }
  @Get("quotes") @Permit("sale:write") quotes(@CurrentUser() actor: Actor) {
    return this.db.quote.findMany({
      where: { branchId: actor.branchId, userId: actor.id, status: "open" },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("quotes") @Permit("sale:write") async quote(
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    // La venta en espera guarda los mismos descuentos que la venta: por monto
    // en cada línea y el global (R9-caja-4). El nombre sólo sirve para avisar
    // qué artículo falta si luego se desactiva (R9-caja-5).
    const data = parse(
      z.object({
        type: z.enum(["quote", "held"]).default("quote"),
        customerId: uuid.nullable().optional(),
        notes: z.string().max(1000).default(""),
        globalDiscount: z.number().min(0).max(100).default(0),
        items: z
          .array(
            z.object({
              variantId: uuid,
              qty: stockQty(10000),
              discountPercent: z.number().min(0).max(100).default(0),
              discountAmount: amount.optional(),
              name: z.string().max(300).optional(),
            }),
          )
          .min(1),
      }),
      body,
    );
    const prices = new Map<string, number>(
      (
        await this.db.variant.findMany({
          where: { id: { in: data.items.map((i) => i.variantId) } },
          select: { id: true, price: true },
        })
      ).map((v) => [v.id, Number(v.price)]),
    );
    for (const i of data.items)
      if ((i.discountAmount ?? 0) > (prices.get(i.variantId) ?? 0) * i.qty)
        bad("El descuento por monto supera el importe de la línea.");
    return this.db.quote.create({
      data: {
        ...data,
        items: json(data.items),
        userId: actor.id,
        branchId: actor.branchId,
      },
    });
  }
  @Post("quotes/:id/convert")
  @Permit("sale:write")
  async convert(@Param("id") id: string, @CurrentUser() actor: Actor) {
    const where = {
      id: parse(uuid, id),
      userId: actor.id,
      branchId: actor.branchId,
      status: "open",
    };
    const row = await this.db.quote.findFirstOrThrow({ where });
    // Sólo se recupera una vez: dos clics a la vez no cargan la misma venta
    // en dos carritos (R9-caja-5).
    const { count } = await this.db.quote.updateMany({
      where,
      data: { status: "converted" },
    });
    if (!count) conflict("Esta venta ya se recuperó.");
    return row;
  }
  @Get("settings") @Permit("catalog:read") async settings(
    @CurrentUser() actor: Actor,
  ) {
    return (
      await this.db.settings.findUniqueOrThrow({
        where: { id: actor.branchId },
      })
    ).data;
  }
  @Put("settings")
  @Permit("*")
  async setSettings(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(configSchema, body);
    return this.db.$transaction(async (tx) => {
      const before = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      const row = await tx.settings.upsert({
        where: { id: actor.branchId },
        create: { id: actor.branchId, data },
        update: { data },
      });
      await audit(
        tx,
        actor,
        "settings",
        "settings",
        actor.branchId,
        before?.data,
        data,
      );
      return row.data;
    });
  }
  @Get("staff") @Permit("sale:write") staff(@CurrentUser() actor: Actor) {
    return this.db.user.findMany({
      where: { branchId: actor.branchId, active: true },
      select: { id: true, name: true, role: { select: { name: true } } },
    });
  }
  @Get("users") @Permit("*") users(@CurrentUser() actor: Actor) {
    return this.db.user.findMany({
      where: { branchId: actor.branchId },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        roleId: true,
        role: true,
      },
    });
  }
  @Post("users")
  @Permit("*")
  async user(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(12).max(128),
        pin: z.string().regex(/^\d{4,6}$/),
        roleId: uuid,
      }),
      body,
    );
    const row = await this.db.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        passwordHash: await passwordHash(data.password),
        pinHash: await passwordHash(data.pin),
        roleId: data.roleId,
        branchId: actor.branchId,
      },
    });
    await audit(this.db, actor, "create", "user", row.id, undefined, {
      name: row.name,
      roleId: row.roleId,
    });
    return { id: row.id, name: row.name, email: row.email };
  }
  @Patch("users/:id")
  @Permit("*")
  async editUser(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        name: z.string().min(2).optional(),
        roleId: uuid.optional(),
        active: z.boolean().optional(),
        password: z.string().min(12).max(128).optional(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
      }),
      body,
    );
    if (id === actor.id && (data.active === false || data.roleId))
      bad("Otro administrador debe cambiar tu acceso.");
    const { password, pin, ...rest } = data;
    await this.db.user.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    const passwordValue = password ? await passwordHash(password) : undefined;
    const pinValue = pin ? await passwordHash(pin) : undefined;
    const row = await this.db.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(passwordValue ? { passwordHash: passwordValue } : {}),
          ...(pinValue ? { pinHash: pinValue } : {}),
          ...(password || pin || data.active === false
            ? { authVersion: { increment: 1 } }
            : {}),
        },
      });
      if (password || pin || data.active === false) {
        await tx.refreshToken.deleteMany({ where: { userId: id } });
        await tx.authSession.deleteMany({ where: { userId: id } });
      }
      return row;
    });
    await audit(this.db, actor, "access_change", "user", id, undefined, rest);
    return { id: row.id, name: row.name, active: row.active };
  }
  @Get("roles") @Permit("*") roles() {
    return this.db.role.findMany();
  }
  @Put("roles/:id")
  @Permit("*")
  async role(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({ permissions: z.array(z.string().min(1)).max(100) }),
      body,
    );
    const role = await this.db.role.findUniqueOrThrow({
      where: { id: parse(uuid, id) },
    });
    if (role.name === "admin" && !data.permissions.includes("*"))
      bad("El rol administrador debe conservar acceso completo.");
    return this.db.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data });
      await audit(tx, actor, "permissions", "role", id, role, updated);
      return updated;
    });
  }
  @Get("audit-log") @Permit("*") auditLog(@CurrentUser() actor: Actor) {
    return this.db.auditLog.findMany({
      where: { branchId: actor.branchId },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
  }
  @Get("promotions") @Permit("catalog:read") promotions(
    @CurrentUser() actor: Actor,
  ) {
    return this.db.promotion.findMany({
      where: { branchId: actor.branchId },
      orderBy: { createdAt: "desc" },
    });
  }
  @Post("promotions")
  @Permit("promotions:write")
  async promotion(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        name: z.string().min(2).max(150),
        type: z.enum([
          "percent",
          "amount",
          "nxm",
          "second_half",
          "special_price",
        ]),
        value: amount,
        startsAt: z.string().datetime(),
        endsAt: z.string().datetime(),
        scope: z.object({
          variantId: uuid.optional(),
          productId: uuid.optional(),
          categoryId: uuid.optional(),
          brand: z.string().optional(),
          buy: z.number().int().min(2).max(20).optional(),
          pay: z.number().int().min(1).max(19).optional(),
        }),
        isClearance: z.boolean().default(false),
      }),
      body,
    );
    if (new Date(data.endsAt) <= new Date(data.startsAt))
      bad("La fecha final debe ser posterior al inicio.");
    if (data.type === "percent" && data.value > 100)
      bad("El descuento máximo es 100%.");
    if (data.type === "nxm" && (data.scope.pay ?? 1) >= (data.scope.buy ?? 2))
      bad("La promoción debe regalar al menos una unidad.");
    const row = await this.db.promotion.create({
      data: {
        ...data,
        startsAt: new Date(data.startsAt),
        endsAt: new Date(data.endsAt),
        createdBy: actor.id,
        branchId: actor.branchId,
      },
    });
    await audit(this.db, actor, "create", "promotion", row.id, undefined, row);
    return row;
  }
  @Patch("promotions/:id")
  @Permit("promotions:write")
  async deactivate(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(z.object({ active: z.boolean() }), body);
    await this.db.promotion.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    const row = await this.db.promotion.update({ where: { id }, data });
    await audit(this.db, actor, "state", "promotion", id, undefined, data);
    return row;
  }
}
