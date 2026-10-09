import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
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
  imageType,
  lockActiveCustomer,
} from "./common";
import {
  can,
  d,
  z,
  stockQty,
  isImageDataUrl,
  LOGO_MAX_BYTES,
} from "@fitstore/shared";
import { normalizeUsername, passwordHash } from "./auth";
import { strongPasswordSchema } from "./password-policy";

const customerSchema = z.object({
  creditLimit: amount.optional(),
  name: z.string().trim().min(2).max(120),
  phone: z.string().max(30).optional(),
  email: z.string().email().or(z.literal("")).optional(),
  legalId: z.string().max(30).optional(),
  notes: z.string().max(1000).default(""),
});
const anonymizeCustomerSchema = z.object({
  reason,
  requestRef: z.string().trim().min(3).max(100),
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
  // En varias cajas desconectadas no existe una autoridad común que pueda
  // reservar la última unidad. Por seguridad se exige una decisión explícita.
  allowOfflineSales: z.boolean().default(false),
  allowCreditSales: z.boolean().default(false),
  creditApprovalThreshold: amount.default(1000),
  // Salidas de efectivo del turno que una cajera registra sin PIN de gerente
  // (D-04). Sin la clave se conserva el valor guardado (RD$ 1,000 si no hay).
  cashMovementApprovalLimit: amount.optional(),
  unusualDiscountCount: z.number().int().min(1).max(1000).default(10),
  unusualDiscountPercent: z.number().min(0).max(100).default(25),
  lowSalesDropPercent: z.number().min(0).max(100).default(50),
  ncfMode: z.enum(["disabled", "prepared"]).default("disabled"),
  // Encabezado de lo impreso (tienda): sucursal, WhatsApp y logo.
  branchName: z.string().max(100).default(""),
  phone2: z.string().max(30).default(""),
  // Data URL de una imagen de hasta 200 KB. Si no se envía se conserva el
  // logo guardado; "" o null lo quita.
  logo: z
    .string()
    .max(300000)
    .refine(
      (v) => v === "" || isImageDataUrl(v),
      "debe ser una imagen PNG, JPEG, WebP o GIF de hasta 200 KB",
    )
    .nullable()
    .optional(),
  autoPrintReceipt: z.boolean().default(false),
  // Toda factura debe identificar a una persona o empresa; puede crearse
  // desde el selector de clientes del POS.
  requireCustomer: z.boolean().default(true),
  // Tasa del día (RD$ por unidad) para el efectivo en dólares y euros.
  usdRate: z.number().positive().max(10000).nullable().optional(),
  eurRate: z.number().positive().max(10000).nullable().optional(),
});
const cashMovementLimit = (data: Record<string, unknown> | undefined) =>
  typeof data?.cashMovementApprovalLimit === "number"
    ? data.cashMovementApprovalLimit
    : 1000;
function checkLogo(logo: string) {
  const [head, data] = logo.split(",");
  if (imageType(Buffer.from(data, "base64")) !== head.slice(11, -7))
    bad("El logo debe ser una imagen PNG, JPEG, WebP o GIF.");
}
// La bitácora no guarda la imagen completa, sólo que cambió.
const auditSettings = (data: any) =>
  data?.logo
    ? { ...data, logo: `(imagen de ${Math.round(data.logo.length / 1365)} KB)` }
    : data;
const literalPattern = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function redactKnownCustomerPii(value: unknown, customer: any): unknown {
  const known = [
    { value: customer.name, tokenBoundaries: true },
    { value: customer.phone, tokenBoundaries: false },
    { value: customer.email, tokenBoundaries: false },
    { value: customer.legalId, tokenBoundaries: false },
    { value: customer.notes, tokenBoundaries: false },
  ]
    .filter(
      (item): item is { value: string; tokenBoundaries: boolean } =>
        typeof item.value === "string" && Boolean(item.value.trim()),
    )
    .map((item) => ({ ...item, value: item.value.trim() }))
    .sort((a, b) => b.value.length - a.value.length);
  const sensitiveDigits = [customer.phone, customer.legalId]
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\D/g, ""))
    .filter((item) => item.length >= 6);
  const redact = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(redact);
    if (!current || typeof current !== "object") {
      if (typeof current !== "string") return current;
      const compact = current.replace(/\D/g, "");
      if (sensitiveDigits.some((digits) => compact.includes(digits)))
        return "[dato anonimizado]";
      return known.reduce((text, item) => {
        const literal = literalPattern(item.value);
        const pattern = item.tokenBoundaries
          ? `(?<![\\p{L}\\p{N}])${literal}(?![\\p{L}\\p{N}])`
          : literal;
        return text.replace(new RegExp(pattern, "giu"), "[dato anonimizado]");
      }, current);
    }
    return Object.fromEntries(
      Object.entries(current).map(([key, nested]) => [key, redact(nested)]),
    );
  };
  return redact(json(value));
}
const cashierNumber = z.number().int().min(1).max(999999);

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
    const customerId = parse(uuid, id);
    const data = parse(customerSchema.partial(), body);
    if (
      data.creditLimit !== undefined &&
      !can(actor.permissions, "sale:manage")
    )
      bad("Sólo un gerente puede cambiar el límite de crédito.");
    return this.db.$transaction(async (tx) => {
      // PATCH y anonimización comparten el mismo bloqueo. Si PATCH entra
      // primero, la anonimización limpia después; si entra segundo, ve el
      // marcador irreversible y jamás puede reidentificar al cliente.
      await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId}::uuid AND "branchId" = ${actor.branchId} FOR UPDATE`;
      const before = await tx.customer.findFirstOrThrow({
        where: { id: customerId, branchId: actor.branchId },
      });
      if (before.anonymizedAt)
        conflict("El cliente ya fue anonimizado y no puede modificarse.");
      const row = await tx.customer.update({
        where: { id: customerId },
        data,
      });
      const changedFields = Object.keys(data).filter(
        (field) =>
          JSON.stringify((before as any)[field]) !==
          JSON.stringify((row as any)[field]),
      );
      await audit(
        tx,
        actor,
        "update",
        "customer",
        customerId,
        { changedFields },
        { changedFields },
      );
      return row;
    });
  }

  @Post("customers/:id/anonymize")
  @Permit("customers:erase")
  async anonymizeCustomer(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const customerId = parse(uuid, id);
    const request = parse(anonymizeCustomerSchema, body);
    return this.db.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${customerId}::uuid AND "branchId" = ${actor.branchId} FOR UPDATE`;
        const customer = await tx.customer.findFirstOrThrow({
          where: { id: customerId, branchId: actor.branchId },
        });
        if (customer.anonymizedAt) conflict("El cliente ya fue anonimizado.");
        const [debt, creditNotes] = await Promise.all([
          tx.sale.aggregate({
            where: {
              customerId,
              branchId: actor.branchId,
              status: "completed",
              creditBalance: { gt: 0 },
            },
            _sum: { creditBalance: true },
          }),
          tx.creditNote.aggregate({
            where: { customerId, balance: { gt: 0 } },
            _sum: { balance: true },
          }),
        ]);
        if (
          Number(debt._sum.creditBalance ?? 0) > 0 ||
          Number(creditNotes._sum.balance ?? 0) > 0
        )
          conflict(
            "No se puede anonimizar: el cliente tiene crédito, contraentrega o una nota de crédito pendiente.",
          );

        const marker = { customerId, anonymized: true };
        await tx.auditLog.updateMany({
          where: {
            branchId: actor.branchId,
            entity: "customer",
            entityId: customerId,
          },
          data: { before: marker, after: marker },
        });
        await tx.quote.updateMany({
          where: { branchId: actor.branchId, customerId },
          data: { notes: "" },
        });
        const sales = await tx.sale.findMany({
          where: { branchId: actor.branchId, customerId },
          select: { id: true },
        });
        const saleIds = sales.map((sale) => sale.id);
        if (saleIds.length) {
          // Los números, fechas, NCF e importes se conservan para la trazabilidad
          // contable. Sólo se eliminan campos libres o identificadores personales.
          await tx.sale.updateMany({
            where: { id: { in: saleIds } },
            data: { recipientLegalId: null, notes: "" },
          });
          const saleAudits = await tx.auditLog.findMany({
            where: {
              branchId: actor.branchId,
              entity: "sale",
              entityId: { in: saleIds },
            },
            select: { id: true, before: true, after: true },
          });
          for (const entry of saleAudits) {
            const cleaned: Record<string, unknown> = {};
            if (entry.before != null)
              cleaned.before = redactKnownCustomerPii(entry.before, customer);
            if (entry.after != null)
              cleaned.after = redactKnownCustomerPii(entry.after, customer);
            if (Object.keys(cleaned).length)
              await tx.auditLog.update({
                where: { id: entry.id },
                data: cleaned,
              });
          }
          await tx.alert.updateMany({
            where: { branchId: actor.branchId, entityId: { in: saleIds } },
            data: {
              message: "Cuenta por cobrar cerrada de cliente anonimizado.",
              status: "resolved",
            },
          });
        }
        const row = await tx.customer.update({
          where: { id: customerId },
          data: {
            name: `Cliente anonimizado ${customerId.slice(0, 8)}`,
            phone: null,
            email: null,
            legalId: null,
            notes: "",
            creditLimit: 0,
            active: false,
            anonymizedAt: new Date(),
          },
        });
        await audit(tx, actor, "anonymize", "customer", customerId, undefined, {
          reasonRecorded: true,
          requestReferenceRecorded: Boolean(request.requestRef),
        });
        return row;
      },
      { timeout: 20_000 },
    );
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
    const prices = new Map(
      (
        await this.db.variant.findMany({
          where: { id: { in: data.items.map((i) => i.variantId) } },
          select: { id: true, price: true },
        })
      ).map((v) => [v.id, String(v.price)]),
    );
    // Con decimales exactos: 3 × 0.70 son 2.10, no 2.0999…
    for (const i of data.items)
      if (
        d(i.discountAmount ?? 0).gt(
          d(prices.get(i.variantId) ?? 0).times(i.qty),
        )
      )
        bad("El descuento por monto supera el importe de la línea.");
    return this.db.$transaction(async (tx) => {
      if (data.customerId) await lockActiveCustomer(tx, actor, data.customerId);
      return tx.quote.create({
        data: {
          ...data,
          items: json(data.items),
          userId: actor.id,
          branchId: actor.branchId,
        },
      });
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
    const data = (
      await this.db.settings.findUniqueOrThrow({
        where: { id: actor.branchId },
      })
    ).data as Record<string, unknown>;
    // Instalaciones anteriores no tienen esta clave. El cliente y cualquier
    // integración reciben siempre el valor efectivo seguro, no undefined.
    return {
      ...data,
      allowOfflineSales: data.allowOfflineSales === true,
      cashMovementApprovalLimit: cashMovementLimit(data),
      requireCustomer: true,
    };
  }
  @Put("settings")
  @Permit("*")
  async setSettings(@Body() body: unknown, @CurrentUser() actor: Actor) {
    // Una PWA anterior puede seguir abierta durante una actualización y no
    // enviar la clave nueva. Guardar cualquier otro ajuste no debe cambiar una
    // decisión que el propietario ya tomó expresamente.
    const hasOfflineSales =
      typeof body === "object" &&
      body !== null &&
      Object.prototype.hasOwnProperty.call(body, "allowOfflineSales");
    const { logo, ...config } = parse(configSchema, body);
    if (logo) checkLogo(logo);
    return this.db.$transaction(async (tx) => {
      const before = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      // El formulario puede omitir el logo (pesa mucho para reenviarlo).
      const kept =
        logo === undefined ? (before?.data as any)?.logo : logo || undefined;
      const previous = before?.data as Record<string, unknown> | undefined;
      const data = {
        ...config,
        allowOfflineSales: hasOfflineSales
          ? config.allowOfflineSales
          : previous?.allowOfflineSales === true,
        // Una PWA anterior no envía el límite: no se afloja ni se endurece.
        cashMovementApprovalLimit:
          config.cashMovementApprovalLimit ?? cashMovementLimit(previous),
        // Compatibilidad con clientes anteriores, pero la regla comercial es
        // invariable: toda venta se guarda a nombre de un cliente.
        requireCustomer: true,
        ...(kept ? { logo: kept } : {}),
      };
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
        auditSettings(before?.data),
        auditSettings(data),
      );
      return row.data;
    });
  }
  // Subida del logo como archivo: un JSON con una imagen de 200 KB superaría
  // el límite de 100 KB del cuerpo de la API.
  @Post("settings/logo")
  @Permit("*")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 1024 * 1024, files: 1 } }),
  )
  async setLogo(@UploadedFile() file: any, @CurrentUser() actor: Actor) {
    if (!file?.buffer?.length) bad("Adjunta la imagen del logo.");
    if (file.size > LOGO_MAX_BYTES)
      bad("El logo debe pesar como máximo 200 KB.");
    const type = imageType(file.buffer);
    if (!type) bad("El logo debe ser una imagen PNG, JPEG, WebP o GIF.");
    const logo = `data:image/${type};base64,${file.buffer.toString("base64")}`;
    return this.db.$transaction(async (tx) => {
      const row = await tx.settings.findUniqueOrThrow({
        where: { id: actor.branchId },
      });
      await tx.settings.update({
        where: { id: actor.branchId },
        data: { data: { ...(row.data as any), logo } },
      });
      await audit(
        tx,
        actor,
        "settings_logo",
        "settings",
        actor.branchId,
        {
          logo: !!(row.data as any)?.logo,
        },
        { logo: auditSettings({ logo }).logo },
      );
      return { logo };
    });
  }
  // Número y nombre de la caja que se imprimen en el cuadre (p. ej. 4012
  // «GPRO STORE RD»). El nombre del equipo sigue siendo el del dispositivo.
  @Patch("terminals/:id/register")
  @Permit("*")
  async registerInfo(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        registerNumber: z
          .number()
          .int()
          .min(1)
          .max(999999)
          .nullable()
          .optional(),
        registerName: z.string().trim().max(80).nullable().optional(),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const terminal = await tx.terminal.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      if (data.registerNumber) {
        const used = await tx.terminal.findFirst({
          where: {
            branchId: actor.branchId,
            registerNumber: data.registerNumber,
            revokedAt: null,
            id: { not: terminal.id },
          },
        });
        if (used)
          bad(
            `El número de caja ${data.registerNumber} ya lo usa «${used.registerName || used.name}».`,
          );
      }
      const row = await tx.terminal.update({
        where: { id: terminal.id },
        data: {
          ...(data.registerNumber !== undefined
            ? { registerNumber: data.registerNumber }
            : {}),
          ...(data.registerName !== undefined
            ? { registerName: data.registerName || null }
            : {}),
        },
      });
      await audit(
        tx,
        actor,
        "register_info",
        "terminal",
        terminal.id,
        {
          registerNumber: terminal.registerNumber,
          registerName: terminal.registerName,
        },
        data,
      );
      return {
        id: row.id,
        name: row.name,
        registerNumber: row.registerNumber,
        registerName: row.registerName,
      };
    });
  }
  @Get("staff") @Permit("sale:write") staff(@CurrentUser() actor: Actor) {
    return this.db.user.findMany({
      where: { branchId: actor.branchId, active: true },
      select: {
        id: true,
        name: true,
        cashierNumber: true,
        role: { select: { name: true } },
      },
    });
  }
  @Get("users") @Permit("*") users(@CurrentUser() actor: Actor) {
    return this.db.user.findMany({
      where: { branchId: actor.branchId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        active: true,
        roleId: true,
        role: true,
        cashierNumber: true,
      },
    });
  }
  // Dos cajeros activos de la sucursal no comparten número.
  private async freeCashierNumber(
    actor: Actor,
    value: number | null | undefined,
    self?: string,
  ) {
    if (!value) return;
    const used = await this.db.user.findFirst({
      where: {
        branchId: actor.branchId,
        active: true,
        cashierNumber: value,
        ...(self ? { id: { not: self } } : {}),
      },
    });
    if (used) bad(`El número de cajero ${value} ya lo tiene ${used.name}.`);
  }
  @Post("users")
  @Permit("*")
  async user(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        name: z.string().min(2),
        username: z.string().trim().min(2).max(80).optional(),
        email: z.string().email().optional(),
        password: strongPasswordSchema,
        pin: z.string().regex(/^\d{4,6}$/),
        roleId: uuid,
        cashierNumber: cashierNumber.optional(),
      }),
      body,
    );
    await this.freeCashierNumber(actor, data.cashierNumber);
    const requestedUsername =
      data.username?.trim() || data.email?.split("@")[0] || data.name;
    const usernameKey = normalizeUsername(requestedUsername);
    const generatedEmail =
      usernameKey.replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "") +
      "@nexora.local";
    const row = await this.db.user.create({
      data: {
        name: data.name,
        username: requestedUsername,
        usernameKey,
        email: (data.email || generatedEmail).toLowerCase(),
        passwordHash: await passwordHash(data.password),
        mustChangePassword: true,
        pinHash: await passwordHash(data.pin),
        roleId: data.roleId,
        branchId: actor.branchId,
        cashierNumber: data.cashierNumber,
      },
    });
    await audit(this.db, actor, "create", "user", row.id, undefined, {
      name: row.name,
      roleId: row.roleId,
      cashierNumber: row.cashierNumber,
    });
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      email: row.email,
      cashierNumber: row.cashierNumber,
    };
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
        username: z.string().trim().min(2).max(80).optional(),
        roleId: uuid.optional(),
        active: z.boolean().optional(),
        password: strongPasswordSchema.optional(),
        pin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
        cashierNumber: cashierNumber.nullable().optional(),
      }),
      body,
    );
    if (id === actor.id && (data.active === false || data.roleId))
      bad("Otro administrador debe cambiar tu acceso.");
    const { password, pin, username, ...rest } = data;
    await this.db.user.findFirstOrThrow({
      where: { id: parse(uuid, id), branchId: actor.branchId },
    });
    await this.freeCashierNumber(actor, data.cashierNumber, id);
    const passwordValue = password ? await passwordHash(password) : undefined;
    const pinValue = pin ? await passwordHash(pin) : undefined;
    const row = await this.db.$transaction(async (tx) => {
      const row = await tx.user.update({
        where: { id },
        data: {
          ...rest,
          ...(username
            ? {
                username: username.trim(),
                usernameKey: normalizeUsername(username),
              }
            : {}),
          ...(passwordValue ? { passwordHash: passwordValue } : {}),
          ...(passwordValue ? { mustChangePassword: true } : {}),
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
    return {
      id: row.id,
      name: row.name,
      username: row.username,
      active: row.active,
      cashierNumber: row.cashierNumber,
    };
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
