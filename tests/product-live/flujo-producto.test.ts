// Flujo REAL del producto contra la API compilada en modo producto
// (PRODUCT_TENANCY=required, RLS, registro público cerrado) sobre PostgreSQL
// desechable: dos empresas ficticias A y B por invitación del operador, con
// administradora y cajera cada una. Lo arranca scripts/verify-product.mjs.
// Ni dinero real ni datos reales.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ADMIN_PASSWORD,
  ADMIN_PIN,
  CASHIER_PASSWORD,
  call,
  createCompany,
  login,
  ok,
  type Company,
} from "./fixture";

const run = Date.now().toString(36);

type Books = {
  company: Company;
  categoryId: string;
  productId: string;
  productName: string;
  variantId: string;
  customerId: string;
  customerName: string;
  cashierCash: string;
  adminCash: string;
  sales: { cash: string; card: string; credit: string; discount: string };
  creditAccountId: string;
  branchId: string;
};
const books: Record<"A" | "B", Books> = {} as any;

async function prepare(key: "A" | "B") {
  const company = await createCompany(`ci-${key.toLowerCase()}-${run}`);
  const admin = company.admin;
  const category = await ok("POST", "/categories", {
    token: admin,
    body: { name: `Categoría ${key} ${run}` },
  });
  const productName = `Producto secreto ${key} ${run}`;
  const tag = `${key}${run}`.toUpperCase();
  const product = await ok("POST", "/products", {
    token: admin,
    body: {
      name: productName,
      sku: `SKU-${tag}`,
      categoryId: category.id,
      taxRate: 0,
      variants: [
        { sku: `V-${tag}`, barcode: `B-${tag}`, price: 100, costAvg: 40 },
      ],
    },
  });
  const variantId = product.variants[0].id;
  await ok("POST", "/inventory/adjustments", {
    token: admin,
    body: { variantId, qty: 50, reason: "Existencia inicial ficticia de CI" },
  });
  const settings = await ok("GET", "/settings", { token: admin });
  await ok("PUT", "/settings", {
    token: admin,
    body: {
      ...settings,
      allowCreditSales: true,
      creditApprovalThreshold: 1000000,
      receivableShiftLimit: 1000000,
    },
  });
  const customerName = `Cliente secreto ${key} ${run}`;
  const customer = await ok("POST", "/customers", {
    token: admin,
    body: { name: customerName },
  });
  books[key] = {
    company,
    categoryId: category.id,
    productId: product.id,
    productName,
    variantId,
    customerId: customer.id,
    customerName,
    cashierCash: "",
    adminCash: "",
    sales: { cash: "", card: "", credit: "", discount: "" },
    creditAccountId: "",
    branchId: "",
  };
}

const sale = (b: Books, token: string, cash: string, extra: object) =>
  call("POST", "/sales", {
    token,
    body: {
      offlineUuid: randomUUID(),
      customerId: b.customerId,
      cashSessionId: cash,
      items: [{ variantId: b.variantId, qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
      ...extra,
    },
  });
const created = (reply: { status: number; body: any }, label: string) => {
  expect(reply.status, `${label}: ${JSON.stringify(reply.body)}`).toBe(201);
  return reply.body;
};

beforeAll(async () => {
  await prepare("A");
  await prepare("B");
});

describe("producto en vivo: dos empresas ficticias", () => {
  it("el registro público está cerrado y las rutas GV no existen", async () => {
    const slug = `abierta-${run}`;
    const register = await call("POST", "/auth/register", {
      body: {
        businessName: "Abierta",
        ownerName: "Nadie",
        email: `${slug}@example.invalid`,
        password: ADMIN_PASSWORD,
        managerPin: ADMIN_PIN,
        businessType: "retail",
        companyCode: slug,
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: "t1",
        privacyVersion: "p1",
      },
    });
    expect(register.status, JSON.stringify(register.body)).toBe(404);
    const tenants = await ok("GET", "/platform/tenants", { platform: true });
    expect(tenants.map((t: any) => t.slug)).not.toContain(slug);
    expect(tenants.map((t: any) => t.slug)).toEqual(
      expect.arrayContaining([books.A.company.slug, books.B.company.slug]),
    );
    for (const [method, path] of [
      ["GET", "/gv/catalog"],
      ["GET", "/gv/courses"],
      ["POST", "/gv/courses"],
      ["GET", "/gv/appointments"],
      ["POST", "/gv/appointments"],
      ["GET", "/gv/cash/current"],
      ["POST", "/gv/cash/open"],
    ])
      expect(
        (
          await call(method, path, {
            token: books.A.company.admin,
            body: method === "POST" ? {} : undefined,
          })
        ).status,
        `${method} ${path}`,
      ).toBe(404);
    // Sin empresa no hay producto ni login.
    expect((await call("GET", "/products")).status).toBe(400);
    expect(
      (
        await call("POST", "/auth/login", {
          body: { login: books.A.company.adminEmail, password: ADMIN_PASSWORD },
        })
      ).status,
    ).not.toBe(201);
  });

  it("cada empresa abre caja, vende en efectivo, tarjeta y crédito, con descuento por PIN, anula y cierra", async () => {
    for (const key of ["A", "B"] as const) {
      const b = books[key];
      const { admin, cashier } = b.company;
      b.cashierCash = created(
        await call("POST", "/cash-sessions/open", {
          token: cashier,
          body: { openingAmount: 500 },
        }),
        `${key} abre caja cajera`,
      ).id;
      b.adminCash = created(
        await call("POST", "/cash-sessions/open", {
          token: admin,
          body: { openingAmount: 0 },
        }),
        `${key} abre caja dueña`,
      ).id;
      b.sales.cash = created(
        await sale(b, cashier, b.cashierCash, {}),
        `${key} efectivo`,
      ).id;
      b.sales.card = created(
        await sale(b, cashier, b.cashierCash, {
          payments: [
            {
              method: "card",
              amount: 100,
              reference: "VCH-CI-1",
              cardLast4: "4242",
              approvalCode: "APR-CI-1",
            },
          ],
        }),
        `${key} tarjeta`,
      ).id;
      const credit = created(
        await sale(b, admin, b.adminCash, {
          payments: [{ method: "credit", amount: 100 }],
          creditDueDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        }),
        `${key} crédito`,
      );
      b.sales.credit = credit.id;
      // Descuento sobre el límite de la cajera: sin PIN no; con el de la dueña sí.
      const discounted = {
        items: [{ variantId: b.variantId, qty: 1, discountPercent: 30 }],
        payments: [{ method: "cash", amount: 70 }],
        discountReason: "Descuento ficticio de CI",
      };
      const noPin = await sale(b, cashier, b.cashierCash, discounted);
      expect(noPin.status, JSON.stringify(noPin.body)).toBe(400);
      expect(noPin.body.message).toContain("PIN");
      const wrongPin = await sale(b, cashier, b.cashierCash, {
        ...discounted,
        managerPin: "000000",
      });
      expect(wrongPin.status).not.toBe(201);
      const withPin = created(
        await sale(b, cashier, b.cashierCash, {
          ...discounted,
          managerPin: ADMIN_PIN,
        }),
        `${key} descuento con PIN`,
      );
      expect(Number(withPin.total)).toBe(70);
      b.sales.discount = withPin.id;

      // Anulación: la cajera no puede; la dueña sí.
      const voidBody = { reason: "Anulación ficticia de CI" };
      expect(
        (
          await call("POST", `/sales/${b.sales.cash}/void`, {
            token: cashier,
            body: voidBody,
          })
        ).status,
      ).toBe(403);
      created(
        await call("POST", `/sales/${b.sales.cash}/void`, {
          token: admin,
          body: voidBody,
        }),
        `${key} anula`,
      );
      const sales = await ok("GET", "/sales", { token: admin });
      const list = sales.items ?? sales;
      expect(list).toHaveLength(4);
      expect(list.find((s: any) => s.id === b.sales.cash).status).toBe(
        "voided",
      );

      // La cuenta por cobrar del cliente (id = cliente) queda con 100 pendientes.
      const accounts = await ok("GET", "/credit-accounts", { token: admin });
      expect(JSON.stringify(accounts.rows)).toContain(b.customerId);
      b.creditAccountId = b.customerId;
      const statement = await ok("GET", `/credit-accounts/${b.customerId}`, {
        token: admin,
      });
      expect(JSON.stringify(statement)).toContain(b.sales.credit);

      // Cierre de la caja de la cajera: efectivo 500 + 70 (la venta anulada no cuenta).
      created(
        await call("POST", `/cash-sessions/${b.cashierCash}/close`, {
          token: cashier,
          body: {
            countedCash: 570,
            countedCard: 100,
            countedTransfer: 0,
            batchNumber: "LOTE-CI",
            notes: "Cierre ficticio de CI",
          },
        }),
        `${key} cierra caja`,
      );
      const sessions = await ok("GET", "/cash-sessions", { token: admin });
      expect(
        sessions.find((s: any) => s.id === b.cashierCash).closedAt,
      ).toBeTruthy();
      // Con la caja cerrada no se vende en ella.
      expect(
        (await sale(b, cashier, b.cashierCash, {})).status,
      ).toBeGreaterThanOrEqual(400);
      // La cajera vuelve a entrar con su clave definitiva.
      expect(
        (await login(b.company.slug, b.company.cashierEmail, CASHIER_PASSWORD))
          .status,
      ).toBe(201);
    }
  });

  it("la cajera recibe 403 en las rutas de administración", async () => {
    const { cashier } = books.A.company;
    for (const [method, path, body] of [
      ["GET", "/users"],
      ["POST", "/users", {}],
      ["GET", "/roles"],
      ["GET", "/audit-log"],
      ["GET", "/tenant/export?format=json"],
      ["GET", "/branches"],
      ["POST", "/branches", { name: "Robada" }],
      ["PUT", "/settings", {}],
      ["POST", "/categories", { name: "Prohibida" }],
      ["GET", "/billing/requests"],
      ["POST", `/sales/${books.A.sales.card}/void`, { reason: "No permitido" }],
    ] as const)
      expect(
        (await call(method, path, { token: cashier, body })).status,
        `${method} ${path}`,
      ).toBe(403);
  });

  it("la dueña abre una sucursal nueva que la otra empresa no ve", async () => {
    const before = await ok("GET", "/branches", {
      token: books.A.company.admin,
    });
    const branch = created(
      await call("POST", "/branches", {
        token: books.A.company.admin,
        body: { name: `Sucursal secreta A ${run}` },
      }),
      "A sucursal",
    );
    books.A.branchId = branch.id;
    const after = await ok("GET", "/branches", {
      token: books.A.company.admin,
    });
    expect(after).toHaveLength(before.length + 1);
    const seenByB = await ok("GET", "/branches", {
      token: books.B.company.admin,
    });
    expect(JSON.stringify(seenByB)).not.toContain("Sucursal secreta A");
    expect(
      (
        await call("PATCH", `/branches/${branch.id}`, {
          token: books.B.company.admin,
          body: { name: "Robada" },
        })
      ).status,
    ).toBe(404);
  });

  it("cada empresa exporta sus datos y solo los suyos", async () => {
    for (const [key, other] of [
      ["A", "B"],
      ["B", "A"],
    ] as const) {
      const exported = await call("GET", "/tenant/export?format=json", {
        token: books[key].company.admin,
      });
      expect(exported.status, JSON.stringify(exported.body).slice(0, 300)).toBe(
        200,
      );
      const text = JSON.stringify(exported.body);
      expect(text).toContain(books[key].productName);
      expect(text).toContain(books[key].customerName);
      expect(text).not.toContain(books[other].productName);
      expect(text).not.toContain(books[other].customerName);
      expect(text).not.toContain(books[other].company.tenantId);
      const xlsx = await call("GET", "/tenant/export?format=xlsx", {
        token: books[key].company.admin,
        raw: true,
      });
      expect(xlsx.status).toBe(200);
      expect((xlsx.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    }
  });

  it("B no ve ni toca nada de A", async () => {
    const a = books.A;
    const tokenB = books.B.company.admin;
    const cashierB = books.B.company.cashier;
    const secretA = [a.productName, a.customerName, a.company.tenantId];
    const leaks = (body: unknown) =>
      secretA.filter((s) => JSON.stringify(body).includes(s));
    // Control: A sí ve lo suyo en las mismas listas (si no, «no se filtra» no prueba nada).
    for (const [path, secret] of [
      ["/products", a.productName],
      ["/customers", a.customerName],
      ["/sales", a.sales.card],
      ["/cash-sessions", a.cashierCash],
      ["/audit-log", a.productId],
    ])
      expect(
        JSON.stringify(await ok("GET", path, { token: a.company.admin })),
        `A GET ${path}`,
      ).toContain(secret);
    for (const path of [
      "/products",
      "/sales",
      "/customers",
      "/cash-sessions",
      "/credit-accounts",
      "/alerts",
      "/audit-log",
      "/categories",
      "/inventory/stock",
      "/inventory/movements",
      "/dashboard/summary",
      "/users",
      "/branches",
    ]) {
      const reply = await call("GET", path, { token: tokenB });
      expect(reply.status, `B GET ${path}`).toBe(200);
      expect(leaks(reply.body), `B GET ${path} muestra datos de A`).toEqual([]);
      const ids = JSON.stringify(reply.body);
      for (const id of [
        a.productId,
        a.customerId,
        a.cashierCash,
        a.adminCash,
        ...Object.values(a.sales),
      ])
        expect(ids, `B GET ${path} trae un id de A`).not.toContain(id);
    }
    for (const [method, path, body] of [
      ["GET", `/products/${a.productId}`],
      ["PATCH", `/products/${a.productId}`, { name: "Robado" }],
      ["GET", `/credit-accounts/${a.creditAccountId}`],
      ["GET", `/credit-accounts/${a.creditAccountId}/statement.pdf`],
      ["GET", `/cash-sessions/${a.cashierCash}/cuadre`],
      ["POST", `/sales/${a.sales.card}/void`, { reason: "Anulación ajena" }],
      [
        "POST",
        `/cash-sessions/${a.adminCash}/close`,
        { countedCash: 0, countedCard: 0, countedTransfer: 0, notes: "Ajena" },
      ],
      [
        "POST",
        "/inventory/adjustments",
        { variantId: a.variantId, qty: 1, reason: "Ajuste ajeno de CI" },
      ],
    ] as const) {
      const reply = await call(method, path, { token: tokenB, body });
      expect(
        [400, 403, 404],
        `B ${method} ${path}: ${reply.status} ${JSON.stringify(reply.body)}`,
      ).toContain(reply.status);
    }
    // Una venta de B con artículo, cliente o caja de A no pasa.
    for (const extra of [
      { items: [{ variantId: a.variantId, qty: 1 }] },
      { customerId: a.customerId },
      { cashSessionId: a.adminCash },
    ]) {
      const reply = await call("POST", "/sales", {
        token: tokenB,
        body: {
          offlineUuid: randomUUID(),
          customerId: books.B.customerId,
          cashSessionId: books.B.adminCash,
          items: [{ variantId: books.B.variantId, qty: 1 }],
          payments: [{ method: "cash", amount: 100 }],
          ...extra,
        },
      });
      expect(reply.status, JSON.stringify(extra)).toBeGreaterThanOrEqual(400);
    }
    // La cajera de B tampoco, y nadie de A entra con el código de B.
    expect(
      (await call("GET", `/products/${a.productId}`, { token: cashierB }))
        .status,
    ).toBe(404);
    expect(
      (await login(books.B.company.slug, a.company.adminEmail, ADMIN_PASSWORD))
        .status,
    ).not.toBe(201);
    // A sigue intacta.
    const product = await ok("GET", `/products/${a.productId}`, {
      token: a.company.admin,
    });
    expect(product.name).toBe(a.productName);
    const salesA = await ok("GET", "/sales", { token: a.company.admin });
    expect(
      (salesA.items ?? salesA).find((s: any) => s.id === a.sales.card).status,
    ).not.toBe("voided");
  });

  it("una empresa suspendida queda en solo lectura, exporta y puede pedir pago", async () => {
    const b = books.B;
    const { admin } = b.company;
    await suspend(b.company.tenantId);
    const status = await ok("GET", "/tenant/status", { token: admin });
    expect(status.status).toBe("suspended");
    for (const path of ["/products", "/sales", "/cash-sessions"])
      expect((await call("GET", path, { token: admin })).status, path).toBe(
        200,
      );
    expect(
      (await call("GET", "/tenant/export?format=json", { token: admin }))
        .status,
    ).toBe(200);
    expect(
      (
        await call("POST", "/categories", {
          token: admin,
          body: { name: "Prohibida" },
        })
      ).status,
    ).toBe(403);
    expect(
      (await call("POST", "/sales", { token: admin, body: {} })).status,
    ).toBe(403);
    expect(
      (
        await call("POST", "/cash-sessions/open", {
          token: b.company.cashier,
          body: { openingAmount: 0 },
        })
      ).status,
    ).toBe(403);
    const payment = await call("POST", "/billing/requests", {
      token: admin,
      body: { plan: "pro", provider: "bank_transfer" },
    });
    expect(payment.status, JSON.stringify(payment.body)).toBe(201);
    expect(payment.body.status).toBe("pending_proof");
    // A no queda afectada.
    expect(
      (await ok("GET", "/tenant/status", { token: books.A.company.admin }))
        .status,
    ).toBe("trial");
    expect(
      (
        await call("POST", "/categories", {
          token: books.A.company.admin,
          body: { name: `Otra categoría A ${run}` },
        })
      ).status,
    ).toBe(201);
  });
});

// La suspensión real llega por vencimiento (tenant-lifecycle); aquí se
// adelanta la fecha en la base desechable, como en las suites product-*.
const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
let sql: any;
async function suspend(tenantId: string) {
  const url = process.env.NEXORA_CI_DATABASE_URL;
  if (!url) throw new Error("Falta NEXORA_CI_DATABASE_URL.");
  const { PrismaClient } = apiRequire("@prisma/client");
  sql ??= new PrismaClient({ datasources: { db: { url } } });
  await sql.$executeRawUnsafe(
    `UPDATE "Tenant" SET "trialEndsAt"=now()-interval '8 days', "pastDueAt"=now()-interval '8 days', status='past_due' WHERE id=$1::uuid`,
    tenantId,
  );
}
afterAll(async () => {
  await sql?.$disconnect();
});
