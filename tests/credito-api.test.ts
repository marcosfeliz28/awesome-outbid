// W7 · Crédito sin pago y cobro por la administración, contra la API real:
// venta a crédito con cero pago o pago parcial, cobro mixto (transferencia +
// efectivo), solo administración, idempotencia, cierre con quién y cuándo, caja
// del administrador que cobra y reportes (la venta cuenta el día de la venta,
// el dinero el día del cobro, sin contarse dos veces). Fechas siempre
// relativas a hoy.
import { conClave } from "./setup/con-clave";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.9." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-Cred-2026!";
const PASSWORD = "FitStore-QA-Cred-Definitiva-2026!";
const CASHIER_TEMPORARY = "739205";
const CASHIER_PASSWORD = "583904";

async function request(
  path: string,
  as: string,
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined
      ? {}
      : { body: JSON.stringify(conClave(path, data)) }),
  });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* binario o texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

function extractPdfText(buffer: Buffer) {
  const raw = buffer.toString("latin1");
  const output: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      output.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return output.join("");
}

type Actor = { id: string; token: string; cash: any; name: string };
let owner = "",
  manager = "",
  customerId = "",
  variantId = "",
  productId = "",
  ana: Actor,
  adminA: Actor,
  adminB: Actor,
  adminNoCash: Actor;
let originalSettings: any;
let longProductId = "";

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA crédito " + label + " " + suffix,
    secret: "qa-cred-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
// Usuarias de prueba: se desactivan al terminar (la aprobación con PIN
// compara contra todas las activas con bcrypt y alentaría otras pruebas).
const createdUsers: string[] = [];
async function person(
  label: string,
  role: "seller" | "admin",
  withCash = true,
): Promise<Actor> {
  const roles = await ok("/roles", owner);
  const email = `qa-cred-${label}-${suffix}@example.test`;
  const name = `QA ${label} ${suffix}`;
  const temporaryPassword = role === "seller" ? CASHIER_TEMPORARY : TEMPORARY;
  const newPassword = role === "seller" ? CASHIER_PASSWORD : PASSWORD;
  const user = await ok("/users", owner, {
    name,
    email,
    password: temporaryPassword,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === role).id,
  });
  createdUsers.push(user.id);
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: temporaryPassword,
    newPassword,
    confirmPassword: newPassword,
  });
  await terminal(login.accessToken, label);
  const cash = withCash
    ? await ok("/cash-sessions/open", login.accessToken, {
        registerId: "qa-cred-" + label + "-" + suffix,
        openingAmount: 0,
      })
    : null;
  return { id: user.id, token: login.accessToken, cash, name };
}

const bizDay = (daysAgo: number) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  }).format(new Date(Date.now() - daysAgo * 86400000));
const dashboard = (from: string, to: string) =>
  ok(`/dashboard/summary?from=${from}&to=${to}`, owner);
const expectedOf = async (who: Actor) =>
  (await ok("/cash-sessions", owner)).find((s: any) => s.id === who.cash.id)
    .expected as { cash: number; card: number; transfer: number };
const sale = (
  who: Actor,
  total: number,
  payments: any[],
  extra: Record<string, unknown> = {},
) =>
  request("/sales", who.token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: who.cash.id,
    items: [{ variantId, qty: total / 100 }],
    payments,
    expectedTotal: total,
    ...extra,
  });
const pendingList = (state = "pending") =>
  ok("/cod/pending?state=" + state, owner);
const line = (method: string, amount: number) => ({
  method,
  amount,
  ...(method === "transfer"
    ? { bank: "Banco QA", reference: "REF-" + randomUUID().slice(0, 6) }
    : method === "card"
      ? { reference: "VCH-" + randomUUID().slice(0, 6) }
      : {}),
});
const collect = (
  who: Actor,
  saleId: string,
  lines: any[],
  operationId = randomUUID(),
  cashId: string | null | undefined = who.cash?.id,
) =>
  request("/sales/" + saleId + "/credit-collections", who.token, {
    operationId,
    ...(cashId ? { cashSessionId: cashId } : {}),
    lines,
  });

beforeAll(async () => {
  const login = (email: string) =>
    ok("/auth/login", "", { email, password: DEMO }).then(
      (r: any) => r.accessToken,
    );
  owner = await login("admin@fitstore.demo");
  manager = await login("gerente@fitstore.demo");
  await terminal(owner, "dueña");
  originalSettings = await ok("/settings", owner);
  await ok(
    "/settings",
    owner,
    {
      ...originalSettings,
      allowCreditSales: true,
      creditApprovalThreshold: 1000000,
      receivableShiftLimit: 1000000,
    },
    "PUT",
  );
  customerId = (await ok("/customers", owner, { name: "QA crédito " + suffix }))
    .id;
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA crédito prod " + suffix,
    sku: "QAC-" + tag,
    categoryId: cats.find((c: any) => c.name === "Fajas").id,
    taxRate: 0,
    variants: [
      { sku: "QAC-V-" + tag, barcode: "QAC-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 500,
    reason: "QA crédito",
  });
  ana = await person("ana", "seller");
  adminA = await person("adminA", "admin");
  adminB = await person("adminB", "admin");
  adminNoCash = await person("adminSinCaja", "admin", false);
}, 180000);

afterAll(async () => {
  for (const who of [ana, adminA, adminB].filter(Boolean))
    await request("/cash-sessions/" + who.cash.id + "/close", owner, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "Cierre de pruebas de crédito",
      differenceReason: "QA: cierre de limpieza de la prueba",
    });
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  if (longProductId)
    await request(
      "/products/" + longProductId,
      owner,
      { active: false },
      "PATCH",
    );
  for (const id of createdUsers)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("W7 · venta a crédito sin pago", () => {
  it("descarga recibos reales de crédito, mixto, contado, anulado y largo", async () => {
    const getPdfText = async (id: string, token = ana.token) => {
      const response = await fetch(base + "/sales/" + id + "/receipt.pdf", {
        headers: { Authorization: "Bearer " + token },
      });
      const buffer = Buffer.from(await response.arrayBuffer());
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/pdf");
      expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
      return { buffer, text: extractPdfText(buffer) };
    };

    const credit = (await sale(ana, 200, [{ method: "cod", amount: 200 }]))
      .body;
    const creditPdf = await getPdfText(credit.id);
    expect(creditPdf.text).toContain("Venta a crédito");
    expect(creditPdf.text).toContain("Pagado hoy: RD$ 0.00");
    expect(creditPdf.text).toContain("Saldo pendiente: RD$ 200.00");
    expect(creditPdf.text).not.toMatch(/Recibido|Cambio|Autorizó|cod:/i);

    const otherSeller = await person("otra-vendedora", "seller", false);
    const denied = await request(
      "/sales/" + credit.id + "/receipt.pdf",
      otherSeller.token,
    );
    expect(denied.status).toBe(404);

    const mixed = (
      await sale(ana, 300, [
        { method: "cash", amount: 100 },
        { method: "cod", amount: 200 },
      ])
    ).body;
    const mixedPdf = await getPdfText(mixed.id);
    expect(mixedPdf.text).toContain("Pagado hoy: RD$ 100.00");
    expect(mixedPdf.text).toContain("Saldo pendiente: RD$ 200.00");
    expect(mixedPdf.text).toContain("Pagado por: Efectivo RD$ 100.00");
    expect(mixedPdf.text).not.toMatch(/Recibido|Cambio|Autorizó|cod:/i);

    const cash = (await sale(ana, 100, [{ method: "cash", amount: 100 }])).body;
    const cashPdf = await getPdfText(cash.id);
    expect(cashPdf.text).toContain("Recibo de venta");
    expect(cashPdf.text).toContain("Forma de pago: Efectivo RD$ 100.00");

    const voided = (await sale(ana, 100, [{ method: "cod", amount: 100 }]))
      .body;
    const voidResult = await request("/sales/" + voided.id + "/void", owner, {
      reason: "Anulación de prueba 3u",
    });
    expect(voidResult.status).toBeLessThan(300);
    const voidPdf = await getPdfText(voided.id);
    expect(voidPdf.text).toContain("ANULADA");
    expect(voidPdf.text).toContain("Anulación de prueba 3u");

    const category = (await ok("/categories", owner)).find(
      (row: any) => row.name === "Fajas",
    );
    const longName = "Producto QA ñ & detalle largo ".repeat(5).trim();
    const longProduct = await ok("/products", owner, {
      name: longName,
      sku: "QAL-" + randomUUID().slice(0, 8),
      categoryId: category.id,
      taxRate: 0,
      variants: [
        {
          sku: "QAL-V-" + randomUUID().slice(0, 8),
          barcode: "QAL-B-" + randomUUID().slice(0, 8),
          price: 100,
          costAvg: 40,
        },
      ],
    });
    longProductId = longProduct.id;
    await ok("/inventory/adjustments", owner, {
      variantId: longProduct.variants[0].id,
      qty: 200,
      reason: "QA PDF 3u",
    });
    const manyLines = await ok("/sales", ana.token, {
      offlineUuid: randomUUID(),
      customerId,
      cashSessionId: ana.cash.id,
      items: Array.from({ length: 100 }, () => ({
        variantId: longProduct.variants[0].id,
        qty: 1,
      })),
      payments: [{ method: "cash", amount: 10000 }],
      expectedTotal: 10000,
    });
    const longPdf = await getPdfText(manyLines.id);
    const pageCount =
      longPdf.buffer.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pageCount).toBeGreaterThan(1);
    expect(longPdf.text).toContain("Producto QA ñ");
    expect(longPdf.text).toContain("Página 2 de");
  }, 60000);

  it("cero pago ahora: es una venta normal, queda pendiente, la caja no recibe dinero y el incentivo es de la cajera", async () => {
    const before = await expectedOf(ana);
    const r = await sale(ana, 200, [{ method: "cod", amount: 200 }]);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const s = r.body;
    expect(s.status).toBe("completed");
    expect(Number(s.creditBalance)).toBe(200);
    expect(s.customerId).toBe(customerId);
    expect(s.sellerId).toBe(ana.id);
    const pay = await db.payment.findMany({ where: { saleId: s.id } });
    expect(pay).toHaveLength(1);
    expect(pay[0].method).toBe("cod");
    expect(pay[0].status).toBe("pending");
    expect(await expectedOf(ana)).toEqual(before);
    const inc = await db.incentiveEntry.findMany({ where: { saleId: s.id } });
    expect(inc.length).toBeGreaterThan(0);
    expect(inc.every((e: any) => e.userId === ana.id)).toBe(true);
    const row = (await pendingList()).find((x: any) => x.saleId === s.id);
    expect(row).toMatchObject({
      status: "open",
      pending: 200,
      collected: 0,
      ageDays: 0,
    });
    expect(row.customer.name).toContain("QA crédito");
    expect(row.seller.id).toBe(ana.id);
    const pdf = await fetch(base + "/sales/" + s.id + "/receipt.pdf", {
      headers: { Authorization: "Bearer " + ana.token },
    });
    expect(pdf.status).toBe(200);
  });

  it("pago parcial: lo pagado entra a la caja y el resto queda como crédito", async () => {
    const before = await expectedOf(ana);
    const r = await sale(ana, 300, [
      { method: "cash", amount: 100 },
      { method: "cod", amount: 200 },
    ]);
    expect(r.status).toBeLessThan(300);
    expect(Number(r.body.creditBalance)).toBe(200);
    expect((await expectedOf(ana)).cash).toBe(before.cash + 100);
  });

  it("sin cliente no se vende a crédito, y el límite del cliente se respeta", async () => {
    const none = await sale(ana, 100, [{ method: "cod", amount: 100 }], {
      customerId: undefined,
    });
    expect(none.status).toBe(400);
    expect(JSON.stringify(none.body)).toContain("cliente");
    const limited = (
      await ok("/customers", owner, {
        name: "QA límite " + suffix,
        creditLimit: 150,
      })
    ).id;
    const over = await sale(ana, 200, [{ method: "cod", amount: 200 }], {
      customerId: limited,
    });
    expect(over.status).toBe(400);
    expect(JSON.stringify(over.body)).toContain("límite de crédito");
  });

  it("sin la opción activada en Ajustes, la cajera necesita el PIN de un gerente", async () => {
    await ok(
      "/settings",
      owner,
      { ...originalSettings, allowCreditSales: false },
      "PUT",
    );
    try {
      const denied = await sale(ana, 100, [{ method: "cod", amount: 100 }]);
      expect(denied.status).toBe(400);
      expect(JSON.stringify(denied.body)).toContain("PIN");
    } finally {
      await ok(
        "/settings",
        owner,
        {
          ...originalSettings,
          allowCreditSales: true,
          creditApprovalThreshold: 1000000,
          receivableShiftLimit: 1000000,
        },
        "PUT",
      );
    }
  });
});

describe("W7 · cobro de créditos: la cajera solo en efectivo", () => {
  it("la cajera ve los créditos y los cierra en efectivo en su caja; tarjeta y transferencia solo la administración", async () => {
    const s = (await sale(ana, 100, [{ method: "cod", amount: 100 }])).body;
    expect((await request("/cod/pending", ana.token)).status).toBe(200);
    const refused = await request(
      "/sales/" + s.id + "/credit-collections",
      ana.token,
      {
        operationId: randomUUID(),
        cashSessionId: ana.cash.id,
        lines: [line("transfer", 100)],
      },
    );
    expect(refused.status).toBe(400);
    const balance = async () =>
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance);
    expect(await balance()).toBe(100);
    const before = await expectedOf(ana);
    const paid = await collect(ana, s.id, [line("cash", 100)]);
    expect(paid.status, JSON.stringify(paid.body)).toBeLessThan(300);
    expect(paid.body.closed).toBe(true);
    expect(await balance()).toBe(0);
    // El efectivo cobrado entra a la caja de la cajera que lo recibió.
    expect((await expectedOf(ana)).cash).toBe(before.cash + 100);
  });

  it("cobro mixto 50 % transferencia + 50 % efectivo: efectivo a la caja de quien cobra, idempotente, cierra al verificar", async () => {
    const s = (await sale(ana, 400, [{ method: "cod", amount: 400 }])).body;
    const beforeA = await expectedOf(adminA);
    const beforeB = await expectedOf(adminB);
    const op = randomUUID();
    const lines = [line("transfer", 200), line("cash", 200)];
    const first = await collect(adminA, s.id, lines, op);
    expect(first.status, JSON.stringify(first.body)).toBeLessThan(300);
    expect(first.body.closed).toBe(false);
    expect(first.body.pending).toBe(200); // la transferencia espera verificación
    // Mismo envío: devuelve los mismos pagos y no descuenta otra vez.
    const again = await collect(adminA, s.id, lines, op);
    expect(again.status).toBeLessThan(300);
    expect(again.body.payments.map((p: any) => p.id)).toEqual(
      first.body.payments.map((p: any) => p.id),
    );
    expect(again.body.pending).toBe(200);
    expect(
      await db.payment.count({
        where: { saleId: s.id, entryType: "installment" },
      }),
    ).toBe(2);
    // El mismo operationId con otros datos se rechaza.
    expect((await collect(adminA, s.id, [line("cash", 100)], op)).status).toBe(
      400,
    );
    // Efectivo en la caja de A; B no cambia; la transferencia aún no cuenta.
    const afterA = await expectedOf(adminA);
    expect(afterA.cash).toBe(beforeA.cash + 200);
    expect(afterA.transfer).toBe(beforeA.transfer);
    expect(await expectedOf(adminB)).toEqual(beforeB);
    const pays = await db.payment.findMany({
      where: { saleId: s.id, entryType: "installment" },
    });
    expect(pays.every((p: any) => p.receivedById === adminA.id)).toBe(true);
    // Otro administrador verifica la transferencia: se cierra una sola vez.
    const transfer = pays.find((p: any) => p.method === "transfer");
    await ok("/payments/" + transfer.id + "/verify", adminB.token, {});
    await ok("/payments/" + transfer.id + "/verify", adminB.token, {});
    const closed = await db.sale.findUnique({ where: { id: s.id } });
    expect(Number(closed.creditBalance)).toBe(0);
    expect(closed.creditClosedAt).toBeTruthy();
    expect(closed.creditClosedById).toBe(adminB.id);
    expect(closed.sellerId).toBe(ana.id);
    expect(closed.customerId).toBe(customerId);
    expect((await expectedOf(adminA)).transfer).toBe(beforeA.transfer + 200);
    expect(
      await db.auditLog.count({
        where: { action: "credit_closed", entityId: s.id },
      }),
    ).toBe(1);
    const done = (await pendingList("closed")).find(
      (x: any) => x.saleId === s.id,
    );
    expect(done).toMatchObject({
      status: "closed",
      pending: 0,
      collected: 400,
    });
    expect(done.closedBy).toContain("adminB");
    expect((await pendingList()).some((x: any) => x.saleId === s.id)).toBe(
      false,
    );
    // Cobrar de más ya no es posible.
    expect((await collect(adminA, s.id, [line("cash", 1)])).status).toBe(400);
    // El incentivo no cambia por cobrar ni se le da a quien cobra.
    const inc = await db.incentiveEntry.findMany({ where: { saleId: s.id } });
    expect(inc.every((e: any) => e.userId === ana.id)).toBe(true);
  });

  it("otro administrador puede completar un cobro parcial: el efectivo entra a SU caja y la venta conserva vendedora, cliente y fecha", async () => {
    const s = (await sale(ana, 300, [{ method: "cod", amount: 300 }])).body;
    const created = (await db.sale.findUnique({ where: { id: s.id } }))
      .createdAt;
    const partial = await collect(adminA, s.id, [line("card", 100)]);
    expect(partial.body).toMatchObject({ pending: 200, closed: false });
    expect(
      (await pendingList()).find((x: any) => x.saleId === s.id).status,
    ).toBe("partial");
    const beforeB = await expectedOf(adminB);
    const beforeA = await expectedOf(adminA);
    const rest = await collect(adminB, s.id, [line("cash", 200)]);
    expect(rest.body).toMatchObject({ pending: 0, closed: true });
    expect((await expectedOf(adminB)).cash).toBe(beforeB.cash + 200);
    expect(await expectedOf(adminA)).toEqual(beforeA);
    const after = await db.sale.findUnique({ where: { id: s.id } });
    expect(after.createdAt).toEqual(created);
    expect(after.sellerId).toBe(ana.id);
    expect(after.customerId).toBe(customerId);
    expect(after.creditClosedById).toBe(adminB.id);
  });

  it("sin caja abierta: el efectivo se rechaza con aviso claro y tarjeta/transferencia sí se registran", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const cash = await collect(
      adminNoCash,
      s.id,
      [line("cash", 100)],
      undefined,
      null,
    );
    expect(cash.status).toBe(400);
    expect(JSON.stringify(cash.body)).toContain("caja abierta");
    const card = await collect(
      adminNoCash,
      s.id,
      [line("card", 100)],
      undefined,
      null,
    );
    expect(card.status, JSON.stringify(card.body)).toBeLessThan(300);
    expect(card.body.payments[0].cashSessionId).toBeNull();
    expect(card.body.pending).toBe(100);
  });

  it("la suma de las líneas no puede pasar del pendiente y es todo o nada", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const r = await collect(adminA, s.id, [
      line("cash", 150),
      line("transfer", 100),
    ]);
    expect(r.status).toBe(400);
    expect(
      await db.payment.count({
        where: { saleId: s.id, entryType: "installment" },
      }),
    ).toBe(0);
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(200);
  });
});

describe("3v · créditos por persona", () => {
  it("no expone cuentas de otra sucursal ni teléfono/identificación completos", async () => {
    const other = await db.customer.create({
      data: {
        name: "QA otra sucursal " + suffix,
        branchId: "qa-other-" + suffix,
        phone: "8095551234",
        legalId: "00112345678",
      },
    });
    expect((await request("/credit-accounts/" + other.id, owner)).status).toBe(
      404,
    );
    expect(
      (await request("/credit-accounts/" + other.id + "/statement.pdf", owner))
        .status,
    ).toBe(404);
    const visible = await ok("/customers", owner, {
      name: "QA privacidad " + suffix,
      phone: "8095551234",
      legalId: "00112345678",
    });
    await sale(ana, 100, [{ method: "cod", amount: 100 }], {
      customerId: visible.id,
    });
    const account = await ok("/credit-accounts/" + visible.id, owner);
    expect(JSON.stringify(account.customer)).not.toContain("8095551234");
    expect(JSON.stringify(account.customer)).not.toContain("00112345678");
  });

  it("agrupa por cliente, muestra historial, reparte y rechaza sobrepago/reenvío distinto", async () => {
    const customer = await ok("/customers", owner, {
      name: "QA persona " + suffix,
    });
    const a = (
      await sale(ana, 100, [{ method: "cod", amount: 100 }], {
        customerId: customer.id,
      })
    ).body;
    const b = (
      await sale(ana, 200, [{ method: "cod", amount: 200 }], {
        customerId: customer.id,
      })
    ).body;
    for (const token of [ana.token, manager]) {
      expect((await request("/credit-accounts", token)).status).toBe(403);
      expect(
        (await request("/credit-accounts/" + customer.id, token)).status,
      ).toBe(403);
    }
    const list = await ok("/credit-accounts?search=QA%20persona", owner);
    expect(
      list.rows.find((row: any) => row.customer.id === customer.id),
    ).toMatchObject({ balance: 300, openSales: 2 });
    const statement = await ok("/credit-accounts/" + customer.id, owner);
    expect(statement.sales.map((row: any) => row.id)).toEqual([a.id, b.id]);
    const pdf = await fetch(
      base + "/credit-accounts/" + customer.id + "/statement.pdf",
      { headers: { Authorization: "Bearer " + owner } },
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    const path = "/credit-accounts/" + customer.id + "/collections";
    const op = randomUUID();
    const body = {
      operationId: op,
      cashSessionId: adminA.cash.id,
      lines: [line("cash", 101)],
    };
    const first = await ok(path, adminA.token, body);
    expect(
      first.allocated.map((row: any) => [row.saleId, Number(row.amount)]),
    ).toEqual([
      [a.id, 100],
      [b.id, 1],
    ]);
    expect(
      (await ok(path, adminA.token, body)).payments.map((row: any) => row.id),
    ).toEqual(first.payments.map((row: any) => row.id));
    expect(
      (await request(path, adminA.token, { ...body, lines: [line("cash", 1)] }))
        .status,
    ).toBe(400);
    expect((await request(path, adminB.token, body)).status).toBe(403);
    expect(
      (
        await request(path, adminA.token, {
          operationId: randomUUID(),
          cashSessionId: adminA.cash.id,
          lines: [line("cash", 200)],
        })
      ).status,
    ).toBe(400);
    expect(
      Number((await db.sale.findUnique({ where: { id: a.id } })).creditBalance),
    ).toBe(0);
    expect(
      Number((await db.sale.findUnique({ where: { id: b.id } })).creditBalance),
    ).toBe(199);
  });

  it("dos cobros simultáneos no cobran más que el saldo", async () => {
    const customer = await ok("/customers", owner, {
      name: "QA carrera " + suffix,
    });
    const s = (
      await sale(ana, 100, [{ method: "cod", amount: 100 }], {
        customerId: customer.id,
      })
    ).body;
    const path = "/credit-accounts/" + customer.id + "/collections";
    const make = () =>
      request(path, adminA.token, {
        operationId: randomUUID(),
        cashSessionId: adminA.cash.id,
        lines: [line("cash", 100)],
      });
    const results = await Promise.all([make(), make()]);
    expect(results.filter((r) => r.status < 300)).toHaveLength(1);
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(0);
    expect(
      await db.payment.count({
        where: { saleId: s.id, entryType: "installment" },
      }),
    ).toBe(1);
  });
});

describe("W7 · reportes: la venta cuenta el día de la venta, el dinero el día del cobro", () => {
  it("3z: informe diario y mensual formal, sin cajas QA y con PDF", async () => {
    const date = bizDay(0);
    const path = `/reports/formal?period=day&date=${date}`;
    expect((await request(path, ana.token)).status).toBe(403);
    expect(
      (await request("/reports/formal?period=day&date=2026-02-30", owner))
        .status,
    ).toBe(400);
    const daily = await ok(path, owner);
    expect(daily.title).toContain("Informe formal");
    expect(daily.cash.every((c: any) => !/^qa[-_]/i.test(c.register))).toBe(
      true,
    );
    expect(daily.totals.margin).toBeDefined();
    const monthly = await ok(
      `/reports/formal?period=month&date=${date.slice(0, 7)}`,
      owner,
    );
    expect(monthly.from).toBe(date.slice(0, 7) + "-01");
    const pdf = await fetch(base + path + "&format=pdf", {
      headers: { Authorization: "Bearer " + owner },
    });
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get("content-type")).toContain("application/pdf");
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("3w: separa crédito antiguo y cobro actual; exporta CSV y Excel", async () => {
    const past = bizDay(3),
      current = bizDay(0);
    const params = `from=${past}&to=${current}`;
    const before = await ok("/reports/income-by-day?" + params, owner);
    const day = (data: any, date: string) =>
      data.rows.find((row: any) => row.day === date) ?? {};
    const s = (await sale(ana, 100, [{ method: "cod", amount: 100 }])).body;
    await db.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date(Date.now() - 3 * 86400000) },
    });
    await collect(adminA, s.id, [line("cash", 100)]);
    const after = await ok("/reports/income-by-day?" + params, owner);
    expect(day(after, past).sold - day(before, past).sold).toBe(100);
    expect(
      day(after, past).creditGenerated - day(before, past).creditGenerated,
    ).toBe(100);
    expect(
      day(after, current).collectionCash - day(before, current).collectionCash,
    ).toBe(100);
    expect(day(after, current).moneyIn - day(before, current).moneyIn).toBe(
      100,
    );
    const csv = await fetch(
      base + "/reports/income-by-day?" + params + "&format=csv",
      { headers: { Authorization: "Bearer " + owner } },
    );
    expect(csv.status).toBe(200);
    // fetch().text() descarta el BOM: se comprueban los bytes del CSV.
    const csvBytes = Buffer.from(await csv.arrayBuffer());
    expect([...csvBytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csvBody = csvBytes.toString("utf8");
    expect(csvBody).toContain("Fecha ISO,Efectivo,Tarjeta");
    const xlsx = await fetch(
      base + "/reports/income-by-day?" + params + "&format=xlsx",
      { headers: { Authorization: "Bearer " + owner } },
    );
    expect(xlsx.status).toBe(200);
    const ExcelJS = requireApi("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await xlsx.arrayBuffer()));
    expect(workbook.worksheets.map((sheet: any) => sheet.name)).toEqual([
      "Resumen por día",
      "Detalle de movimientos",
    ]);
    expect(
      (
        await request(
          "/reports/income-by-day?" +
            params +
            "&scope=session&scopeId=" +
            adminA.cash.id,
          ana.token,
        )
      ).status,
    ).toBe(403);
  });

  it("backdated 3 días: ingreso/ganancia en el día de la venta; cobrar hoy mueve la caja y no los ingresos", async () => {
    const dayOld = bizDay(3),
      today = bizDay(0);
    const oldBefore = await dashboard(dayOld, dayOld);
    const s = (await sale(ana, 400, [{ method: "cod", amount: 400 }])).body;
    // Se fecha la venta hace tres días (relativo a hoy).
    await db.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date(Date.now() - 3 * 86400000) },
    });
    const oldAfter = await dashboard(dayOld, dayOld);
    expect(oldAfter.revenue - oldBefore.revenue).toBeCloseTo(400, 2);
    expect(oldAfter.grossProfit - oldBefore.grossProfit).toBeCloseTo(240, 2); // 400 - costo 160
    const credit = (name: string, d: any) =>
      d.payments.find((p: any) => p.name === name)?.amount ?? 0;
    expect(credit("cod", oldAfter) - credit("cod", oldBefore)).toBeCloseTo(
      400,
      2,
    );
    const todayBefore = await dashboard(today, today);
    const cashBefore = await expectedOf(adminA);
    const r = await collect(adminA, s.id, [line("cash", 400)]);
    expect(r.body.closed).toBe(true);
    // Cobrar hoy no cambia ingresos ni ganancia de ningún día ni suma el método de venta otra vez.
    const oldEnd = await dashboard(dayOld, dayOld);
    const todayAfter = await dashboard(today, today);
    expect(oldEnd.revenue).toBeCloseTo(oldAfter.revenue, 2);
    expect(oldEnd.grossProfit).toBeCloseTo(oldAfter.grossProfit, 2);
    expect(credit("cod", oldEnd)).toBeCloseTo(credit("cod", oldAfter), 2);
    expect(todayAfter.revenue).toBeCloseTo(todayBefore.revenue, 2);
    expect(todayAfter.invoices).toBe(todayBefore.invoices);
    // El dinero sí entra hoy en la caja de quien cobra.
    expect((await expectedOf(adminA)).cash).toBe(cashBefore.cash + 400);
    // Cuentas por cobrar: ya no figura.
    expect((await pendingList()).some((x: any) => x.saleId === s.id)).toBe(
      false,
    );
  });
});

describe("W7 · anulación de un crédito que nunca se cobró", () => {
  it("no hay incentivo que revertir: la anulación no crea montos negativos y deja de ser cuenta por cobrar", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const v = await request("/sales/" + s.id + "/void", owner, {
      reason: "QA: crédito nunca cobrado",
    });
    expect(v.status, JSON.stringify(v.body)).toBeLessThan(300);
    const all = await db.incentiveEntry.findMany({ where: { saleId: s.id } });
    expect(all.every((e: any) => Number(e.amount) === 0)).toBe(true);
    expect((await pendingList()).some((x: any) => x.saleId === s.id)).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Incentivo al cobrar (decisión de la dueña): a la cajera de la venta, en el
// mes del pago, prorrateado y sin redondeos perdidos.
const entriesOf = (saleId: string) =>
  db.incentiveEntry.findMany({
    where: { saleId },
    orderBy: { createdAt: "asc" },
  });
const totalOf = async (saleId: string) =>
  Math.round(
    (await entriesOf(saleId)).reduce(
      (a: number, e: any) => a + Number(e.amount),
      0,
    ) * 100,
  ) / 100;
const thisMonth = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .slice(0, 7);
const previousMonth = () => {
  const [y, m] = thisMonth().split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const nextMonthOf = (p: string) => {
  const [y, m] = p.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};
const mineOf = (who: Actor) => ok("/incentives/me", who.token);

describe("W7 · incentivo al cobrar", () => {
  it("100 % crédito: 0 de incentivo hasta cobrar y aparece como pendiente estimado separado", async () => {
    const before = await mineOf(ana);
    const s = (await sale(ana, 400, [{ method: "cod", amount: 400 }])).body;
    expect(await totalOf(s.id)).toBe(0);
    const after = await mineOf(ana);
    expect(after.row.net).toBeCloseTo(before.row.net, 2);
    expect(after.pendingEstimate).toBeCloseTo(
      (before.pendingEstimate ?? 0) + 200,
      2,
    );
  });

  it("la parte pagada al vender genera su fracción en el acto", async () => {
    const s = (
      await sale(ana, 500, [
        { method: "cash", amount: 200 },
        { method: "cod", amount: 300 },
      ])
    ).body;
    expect(await totalOf(s.id)).toBe(100); // 40 % de 250
  });

  it("cobro parcial y luego el resto, por administradores distintos: suma exacta y todo a la cajera", async () => {
    const s = (await sale(ana, 300, [{ method: "cod", amount: 300 }])).body; // incentivo total 150
    await collect(adminA, s.id, [line("cash", 33.33)]);
    expect(await totalOf(s.id)).toBe(16.67);
    await collect(adminB, s.id, [line("cash", 266.67)]);
    expect(await totalOf(s.id)).toBe(150);
    const rows = await entriesOf(s.id);
    expect(rows.every((e: any) => e.userId === ana.id)).toBe(true);
    expect(rows.filter((e: any) => e.kind === "collection")).toHaveLength(2);
    expect(rows.every((e: any) => e.period === thisMonth())).toBe(true);
  });

  it("marcar una venta a crédito como mayorista después: el incentivo pasa a la mitad, también lo ya cobrado", async () => {
    const s = (await sale(ana, 400, [{ method: "cod", amount: 400 }])).body; // incentivo total 200
    await collect(adminA, s.id, [line("cash", 200)]);
    expect(await totalOf(s.id)).toBe(100);
    const mark = (who: Actor) =>
      request("/sales/" + s.id + "/mark-wholesale", who.token, {
        reason: "Era una venta al por mayor",
      });
    expect((await mark(ana)).status).toBe(403);
    const done = await mark(adminA);
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    // Mitad del incentivo (100) por la mitad cobrada: 50.
    expect(await totalOf(s.id)).toBe(50);
    expect((await mark(adminA)).status).toBeLessThan(300);
    expect(await totalOf(s.id)).toBe(50);
    await collect(adminB, s.id, [line("cash", 200)]);
    expect(await totalOf(s.id)).toBe(100);
    expect((await db.sale.findUnique({ where: { id: s.id } })).wholesale).toBe(
      true,
    );
  });

  it("A1/A2 (18-oct): cambiar vendedora y marcar/desmarcar por mayor una venta de contado, con motivo y hasta 7 días", async () => {
    const s = (await sale(ana, 400, [{ method: "cash", amount: 400 }])).body;
    expect(await totalOf(s.id)).toBe(200);
    const wholesale = (on: boolean, who = adminA) =>
      request("/sales/" + s.id + "/mark-wholesale", who.token, {
        reason: "Corrección de la dueña",
        wholesale: on,
      });
    expect((await wholesale(true, ana)).status).toBe(403);
    expect((await wholesale(true)).status).toBeLessThan(300);
    expect(await totalOf(s.id)).toBe(100);
    expect((await wholesale(false)).status).toBeLessThan(300);
    expect(await totalOf(s.id)).toBe(200);
    expect((await db.sale.findUnique({ where: { id: s.id } })).wholesale).toBe(
      false,
    );

    const seller = (
      sellerId: string,
      who = adminA,
      reason = "La vendió otra",
    ) => request("/sales/" + s.id + "/seller", who.token, { sellerId, reason });
    expect((await seller(adminB.id, ana)).status).toBe(403);
    expect((await seller(adminB.id, adminA, "")).status).toBe(400);
    const moved = await seller(adminB.id);
    expect(moved.status, JSON.stringify(moved.body)).toBeLessThan(300);
    const rows = await entriesOf(s.id);
    expect(rows.every((e: any) => e.userId === adminB.id)).toBe(true);
    expect(await totalOf(s.id)).toBe(200);
    expect((await db.sale.findUnique({ where: { id: s.id } })).sellerId).toBe(
      adminB.id,
    );
    expect(
      await db.auditLog.count({
        where: { action: "sale_seller_changed", entityId: s.id },
      }),
    ).toBe(1);

    // Incentivo en un mes cerrado: no se cambia la vendedora.
    const closedMonth = `20${10 + (Date.now() % 80)}-0${1 + (Date.now() % 9)}`;
    await db.incentiveEntry.updateMany({
      where: { saleId: s.id },
      data: { period: closedMonth },
    });
    const close = await db.incentivePeriodClose.create({
      data: { branchId: "main", period: closedMonth, closedBy: adminA.id },
    });
    try {
      const refused = await seller(ana.id);
      expect(refused.status).toBe(400);
      expect(refused.body.message).toMatch(/mes cerrado/);
    } finally {
      await db.incentivePeriodClose.delete({ where: { id: close.id } });
    }

    // Más de 7 días: ni vendedora ni por mayor.
    await db.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date(Date.now() - 8 * 86400000) },
    });
    expect((await seller(ana.id)).status).toBe(400);
    expect((await wholesale(true)).status).toBe(400);
  });

  it("A3 (18-oct): el envío no se cambia si la caja de la venta ya cerró", async () => {
    const s = (
      await sale(ana, 200, [
        {
          method: "transfer",
          amount: 200,
          bank: "Banco QA",
          reference: "REF-" + randomUUID().slice(0, 6),
        },
      ])
    ).body;
    const fee = (value: number) =>
      request(
        "/sales/" + s.id + "/courier",
        adminA.token,
        { fee: value, reason: "Envío corregido" },
        "PATCH",
      );
    expect((await fee(300)).status).toBe(200);
    await db.cashSession.update({
      where: { id: ana.cash.id },
      data: { closedAt: new Date() },
    });
    try {
      const refused = await fee(350);
      expect(refused.status).toBe(400);
      expect(refused.body.message).toMatch(/caja de esta venta ya cerró/);
    } finally {
      await db.cashSession.update({
        where: { id: ana.cash.id },
        data: { closedAt: null },
      });
    }
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).courierFee),
    ).toBe(300);
  });

  it("cobro en un mes posterior: cae en el mes del pago, con el origen de la venta", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const old = previousMonth();
    await db.incentiveEntry.updateMany({
      where: { saleId: s.id },
      data: { period: old, originPeriod: old },
    });
    await collect(adminA, s.id, [line("cash", 200)]);
    const rows = await entriesOf(s.id);
    const paid = rows.find((e: any) => e.kind === "collection");
    expect(Number(paid.amount)).toBe(100);
    expect(paid.period).toBe(thisMonth());
    expect(paid.originPeriod).toBe(old);
    expect(rows.find((e: any) => e.kind === "sale").period).toBe(old);
  });

  it("transferencia sin verificar no acredita; al verificarla sí, una sola vez", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const r = await collect(adminA, s.id, [line("transfer", 200)]);
    expect(await totalOf(s.id)).toBe(0);
    await ok(
      "/payments/" + r.body.payments[0].id + "/verify",
      adminB.token,
      {},
    );
    expect(await totalOf(s.id)).toBe(100);
    await ok(
      "/payments/" + r.body.payments[0].id + "/verify",
      adminB.token,
      {},
    );
    expect(await totalOf(s.id)).toBe(100);
    expect(
      (await entriesOf(s.id)).filter((e: any) => e.kind === "collection"),
    ).toHaveLength(1);
  });

  it("la administración puede dar por recibida una transferencia sin referencia ni verificación y el cliente pasa a «ya pagaron»", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const r = await collect(adminA, s.id, [
      {
        method: "transfer",
        amount: 200,
        bank: "Popular",
        ownerConfirmed: true,
      },
    ]);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.closed).toBe(true);
    const paid = await db.payment.findFirst({
      where: { saleId: s.id, entryType: "installment" },
    });
    expect(paid.status).toBe("ok");
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(0);
    expect(await totalOf(s.id)).toBe(100);
    const done = await ok("/credit-accounts?view=paid", owner);
    expect(done.rows.some((row: any) => row.customer.id === customerId)).toBe(
      true,
    );
  });

  it("la dueña cierra una transferencia sin depender de su caja (ni de otro equipo) y debe indicar el banco", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const sinBanco = await collect(adminA, s.id, [
      { method: "transfer", amount: 200, ownerConfirmed: true },
    ]);
    expect(sinBanco.status).toBe(400);
    const r = await collect(
      adminA,
      s.id,
      [
        {
          method: "transfer",
          amount: 200,
          bank: "Popular",
          ownerConfirmed: true,
        },
      ],
      randomUUID(),
      randomUUID(), // una caja que no es de este equipo: no debe importar
    );
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    const paid = await db.payment.findFirst({
      where: { saleId: s.id, entryType: "installment" },
    });
    expect(paid.status).toBe("ok");
    expect(paid.cashSessionId).toBeNull();
  });

  it("la dueña cierra en efectivo lo que recibió en la mano, sin caja; una cajera no puede", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    // La cajera sin caja y sin PIN de gerente no puede (A1, 24-oct: con el
    // PIN sí, ver la prueba «A1» al final del archivo).
    const cajera = await collect(
      ana,
      s.id,
      [{ method: "cash", amount: 200, ownerConfirmed: true }],
      randomUUID(),
      null,
    );
    expect(cajera.status).toBe(400);
    expect(cajera.body.message).toMatch(/PIN de un gerente/i);
    const r = await collect(
      adminA,
      s.id,
      [{ method: "cash", amount: 200, ownerConfirmed: true }],
      randomUUID(),
      null,
    );
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(r.body.closed).toBe(true);
    const paid = await db.payment.findFirst({
      where: { saleId: s.id, entryType: "installment" },
    });
    expect(paid.status).toBe("ok");
    expect(paid.cashSessionId).toBeNull();
    expect(paid.reference).toBe("Recibido por la dueña");
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(0);
  });

  it("devolución después de un cobro parcial: descuenta sólo lo acreditado y el resto sigue proporcional", async () => {
    const s = (await sale(ana, 400, [{ method: "cod", amount: 400 }])).body; // incentivo 200
    await collect(adminA, s.id, [line("cash", 200)]);
    expect(await totalOf(s.id)).toBe(100);
    const item = await db.saleItem.findFirst({ where: { saleId: s.id } });
    const ret = await request("/returns", adminA.token, {
      operationId: randomUUID(),
      saleId: s.id,
      cashSessionId: adminA.cash.id,
      reason: "QA devolución de un crédito",
      refundMethod: "credit_note",
      items: [{ saleItemId: item.id, qty: 1, restock: true }],
    });
    expect(ret.status, JSON.stringify(ret.body)).toBeLessThan(300);
    // 1 de 4 unidades devuelta con 200 cobrados: queda proporcional (100 sigue acreditado).
    expect(await totalOf(s.id)).toBe(100);
    const left = (await db.sale.findUnique({ where: { id: s.id } }))
      .creditBalance;
    await collect(adminB, s.id, [line("cash", Number(left))]);
    expect(await totalOf(s.id)).toBe(150); // 3 unidades × 50
    expect((await entriesOf(s.id)).every((e: any) => e.userId === ana.id)).toBe(
      true,
    );
  });

  it("mes cerrado: el cobro cae en el siguiente mes abierto con nota", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const close = await db.incentivePeriodClose.create({
      data: { branchId: "main", period: thisMonth(), closedBy: adminA.id },
    });
    try {
      await collect(adminA, s.id, [line("cash", 200)]);
    } finally {
      await db.incentivePeriodClose.delete({ where: { id: close.id } });
    }
    const paid = (await entriesOf(s.id)).find(
      (e: any) => e.kind === "collection",
    );
    expect(paid.period).toBe(nextMonthOf(thisMonth()));
    expect(paid.note).toContain("ya estaba cerrado");
    await db.incentiveEntry.deleteMany({
      where: { saleId: s.id, kind: "collection" },
    });
  });
});

// ---------------------------------------------------------------------------
// Recordatorio semanal de créditos por cobrar, con reloj inyectado.
import {
  CreditReminderService,
  isoWeekKey,
  reminderDue,
  renderReminder,
  summarizeCredits,
} from "../apps/api/src/credit-reminder";

// Lunes (hora de Santo Domingo, UTC-4 todo el año) dentro de `weeks` semanas.
const mondayAt = (weeks: number, hour: number, minute = 0) => {
  const day = new Date(Date.now() + weeks * 7 * 86400000);
  const local = new Date(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santo_Domingo",
    }).format(day) + "T12:00:00-04:00",
  );
  const back = (local.getUTCDay() + 6) % 7; // días desde el lunes
  const monday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santo_Domingo",
  }).format(new Date(+local - back * 86400000));
  return new Date(
    `${monday}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00-04:00`,
  );
};

describe("W7 · recordatorio semanal de créditos", () => {
  it("semana ISO y hora de aviso (lunes 8:00 de Santo Domingo)", () => {
    const monday = mondayAt(30, 9);
    expect(isoWeekKey(new Date(+monday + 3 * 86400000))).toBe(
      isoWeekKey(monday),
    );
    expect(isoWeekKey(new Date(+monday - 86400000))).not.toBe(
      isoWeekKey(monday),
    );
    expect(isoWeekKey(new Date("2021-01-03T15:00:00-04:00"))).toBe("2020-W53");
    expect(isoWeekKey(new Date("2021-01-04T00:30:00-04:00"))).toBe("2021-W01");
    expect(reminderDue(mondayAt(30, 7, 59))).toBe(false);
    expect(reminderDue(mondayAt(30, 8))).toBe(true);
    expect(reminderDue(new Date(+monday + 2 * 86400000))).toBe(true);
  });

  it("resumen: mayor saldo primero, antigüedad solo informativa y sin datos sensibles", () => {
    const at = mondayAt(30, 9);
    const day = 86400000;
    const s = summarizeCredits(
      [
        {
          customerId: "a",
          customerName: "Ana <b>",
          pending: 100,
          createdAt: new Date(+at - 90 * day),
        },
        {
          customerId: "b",
          customerName: "Beto",
          pending: 300,
          createdAt: new Date(+at - 2 * day),
        },
        {
          customerId: "a",
          customerName: "Ana <b>",
          pending: 50.25,
          createdAt: new Date(+at - 5 * day),
        },
      ],
      at,
    );
    expect(s).toMatchObject({ total: 450.25, customers: 2 });
    expect(s.lines.map((l) => l.name)).toEqual(["Beto", "Ana <b>"]);
    expect(s.lines[1]).toMatchObject({
      pending: 150.25,
      ageDays: 90,
      sales: 2,
    });
    const html = renderReminder("2099-W01", s, true);
    expect(html).toContain("Ana &lt;b&gt;");
    expect(html).not.toMatch(/tel|cédula|@/i);
    expect(renderReminder("2099-W01", s)).toContain(
      "Caja › Créditos pendientes",
    );
  });

  it("una sola alerta por semana aunque se ejecute dos veces; sin crédito abierto no se avisa", async () => {
    await sale(ana, 100, [{ method: "cod", amount: 100 }]);
    const service = new CreditReminderService(db);
    const monday = mondayAt(40, 8);
    const week = isoWeekKey(monday);
    const key = `credit-reminder:main:${week}`;
    const nextKey = `credit-reminder:main:${isoWeekKey(mondayAt(41, 9))}`;
    try {
      expect(
        (await service.run(mondayAt(40, 7, 59), { telegram: true })).created,
      ).toEqual([]);
      const [a, b] = await Promise.all([
        service.run(monday, { telegram: true }),
        service.run(new Date(+monday + 60000), { telegram: true }),
      ]);
      expect([...a.created, ...b.created]).toEqual([key]);
      expect(
        (
          await service.run(new Date(+monday + 2 * 86400000), {
            telegram: true,
          })
        ).created,
      ).toEqual([]);
      const alerts = await db.alert.findMany({ where: { key } });
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        type: "credit_reminder",
        status: "new",
        entityId: week,
      });
      expect(alerts[0].message).toContain("QA crédito");
      expect(alerts[0].message).toMatch(/RD\$/);
      expect(
        await db.notificationOutbox.count({
          where: { eventType: "credit_reminder", refId: "main:" + week },
        }),
      ).toBe(1);
      // Resolver la alerta no la hace reaparecer esa semana.
      await db.alert.update({ where: { key }, data: { status: "resolved" } });
      expect((await service.run(monday, { telegram: true })).created).toEqual(
        [],
      );
      // La semana siguiente sí, y sin Telegram solo queda la alerta.
      expect(
        (await service.run(mondayAt(41, 9), { telegram: false })).created,
      ).toEqual([nextKey]);
      expect(
        await db.notificationOutbox.count({
          where: {
            eventType: "credit_reminder",
            refId: "main:" + isoWeekKey(mondayAt(41, 9)),
          },
        }),
      ).toBe(0);
      // La evaluación automática no la resuelve sola.
      await ok("/alerts/evaluate", owner, {});
      expect(
        (await db.alert.findUnique({ where: { key: nextKey } })).status,
      ).toBe("new");
    } finally {
      await db.alert.deleteMany({ where: { key: { in: [key, nextKey] } } });
      await db.notificationOutbox.deleteMany({
        where: { eventType: "credit_reminder" },
      });
    }
    const empty = new CreditReminderService({
      sale: { findMany: async () => [] },
    } as any);
    expect((await empty.run(monday, { telegram: true })).created).toEqual([]);
  });
});

// Q-02 (auditoría de cobertura): reenvíos SIMULTÁNEOS con la misma clave en
// las tres rutas que mueven dinero o stock de una venta ya hecha. Cada par sale
// a la vez; debe quedar un solo cobro/devolución, el saldo no baja de cero y
// la misma clave con otros datos se rechaza sin escribir.
describe("Q-02 · reenvíos simultáneos con la misma clave", () => {
  const installments = (saleId: string) =>
    db.payment.findMany({ where: { saleId, entryType: "installment" } });
  const balanceOf = async (saleId: string) =>
    Number((await db.sale.findUnique({ where: { id: saleId } })).creditBalance);

  it("POST /sales/:id/credit-collections: un solo abono", async () => {
    const s = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const op = randomUUID();
    const before = await expectedOf(adminA);
    const both = await Promise.all([
      collect(adminA, s.id, [line("cash", 100)], op),
      collect(adminA, s.id, [line("cash", 100)], op),
    ]);
    for (const r of both)
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(both[1].body.payments.map((p: any) => p.id)).toEqual(
      both[0].body.payments.map((p: any) => p.id),
    );
    expect(await installments(s.id)).toHaveLength(1);
    expect(await balanceOf(s.id)).toBe(100);
    expect((await expectedOf(adminA)).cash).toBe(before.cash + 100);
    const other = await collect(adminA, s.id, [line("cash", 50)], op);
    expect(other.status).toBe(400);
    expect(await installments(s.id)).toHaveLength(1);
    expect(await balanceOf(s.id)).toBe(100);
    expect((await expectedOf(adminA)).cash).toBe(before.cash + 100);
  });

  it("POST /sales/:id/cod-collections: un solo cobro de la contraentrega", async () => {
    const s = (await sale(ana, 100, [{ method: "cod", amount: 100 }])).body;
    const body = {
      offlineUuid: randomUUID(),
      cashSessionId: adminA.cash.id,
      amount: 100,
      method: "cash",
    };
    const path = "/sales/" + s.id + "/cod-collections";
    const before = await expectedOf(adminA);
    const both = await Promise.all([
      request(path, adminA.token, body),
      request(path, adminA.token, body),
    ]);
    for (const r of both)
      expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
    expect(both[1].body.id).toBe(both[0].body.id);
    expect(await installments(s.id)).toHaveLength(1);
    expect(await balanceOf(s.id)).toBe(0);
    expect((await expectedOf(adminA)).cash).toBe(before.cash + 100);
    const other = await request(path, adminA.token, { ...body, amount: 50 });
    expect(other.status).toBe(400);
    expect(await installments(s.id)).toHaveLength(1);
    expect(await balanceOf(s.id)).toBe(0);
    expect((await expectedOf(adminA)).cash).toBe(before.cash + 100);
  });

  // api.test.ts (R9-A01) ya prueba seis envíos simultáneos con nota de
  // crédito; aquí el reembolso sale en efectivo de la caja.
  it("POST /returns: una sola devolución, un solo reembolso y el stock sube una vez", async () => {
    const s = (await sale(adminA, 200, [{ method: "cash", amount: 200 }])).body;
    const stock = async () =>
      Number(
        (await db.variant.findUniqueOrThrow({ where: { id: variantId } }))
          .stock,
      );
    const body = {
      operationId: randomUUID(),
      saleId: s.id,
      cashSessionId: adminA.cash.id,
      reason: "Q-02 reenvío simultáneo",
      refundMethod: "cash",
      items: [{ saleItemId: s.items[0].id, qty: 1, restock: true }],
    };
    const stockBefore = await stock();
    const cashBefore = await expectedOf(adminA);
    const both = await Promise.all([
      request("/returns", adminA.token, body),
      request("/returns", adminA.token, body),
    ]);
    for (const r of both) expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(both[1].body.id).toBe(both[0].body.id);
    const returns = () => db.saleReturn.findMany({ where: { saleId: s.id } });
    expect(await returns()).toHaveLength(1);
    expect(await stock()).toBe(stockBefore + 1);
    const after = await expectedOf(adminA);
    expect(after.cash).toBe(cashBefore.cash - 100);
    expect(after.cash).toBeGreaterThanOrEqual(0);
    const other = await request("/returns", adminA.token, {
      ...body,
      items: [{ saleItemId: s.items[0].id, qty: 2, restock: true }],
    });
    expect(other.status).toBe(400);
    expect(await returns()).toHaveLength(1);
    expect(await stock()).toBe(stockBefore + 1);
    expect((await expectedOf(adminA)).cash).toBe(cashBefore.cash - 100);
  });
});

describe("Corregir el método de pago (dueña, 23-oct)", () => {
  it("efectivo → contraentrega con la caja cerrada: la caja cuadra, queda por cobrar y el incentivo no cambia", async () => {
    const wendy = await person("wendy", "seller");
    const s = (await sale(wendy, 300, [{ method: "cash", amount: 300 }])).body;
    const incentive = await totalOf(s.id);
    // Cierra sin los 300 (era contraentrega): diferencia −300.
    await ok("/cash-sessions/" + wendy.cash.id + "/close", owner, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
      notes: "QA cierre",
      differenceReason: "QA: faltan los 300 de la contraentrega",
    });
    const session = () =>
      db.cashSession.findUnique({ where: { id: wendy.cash.id } });
    expect(Number((await session()).differenceCash)).toBe(-300);
    const paymentId = (await db.payment.findFirst({ where: { saleId: s.id } }))
      .id;
    const correct = (who: Actor, data: Record<string, unknown>) =>
      request(
        `/sales/${s.id}/payments/${paymentId}/correct-method`,
        who.token,
        { reason: "Era contraentrega con Addison", ...data },
      );
    expect((await correct(ana, { method: "cod" })).status).toBe(403);
    expect((await correct(adminA, { method: "cod", reason: "" })).status).toBe(
      400,
    );
    const done = await correct(adminA, { method: "cod" });
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    expect(payment.method).toBe("cod");
    expect(payment.status).toBe("pending");
    expect(Number(payment.amount)).toBe(300);
    const row = await db.sale.findUnique({ where: { id: s.id } });
    expect(Number(row.creditBalance)).toBe(300);
    expect(row.receivableKind).toBe("cod");
    expect(row.status).toBe("completed");
    expect(Number((await session()).differenceCash)).toBe(0);
    expect(Number((await session()).expectedCash)).toBe(0);
    expect((await pendingList()).some((p: any) => p.saleId === s.id)).toBe(
      true,
    );
    expect(await totalOf(s.id)).toBe(incentive);
    // Repetir es inofensivo.
    expect((await correct(adminA, { method: "cod" })).status).toBeLessThan(300);
    expect(
      await db.auditLog.count({
        where: { action: "payment_method_corrected", entityId: s.id },
      }),
    ).toBe(1);
    // Se cobra como cualquier contraentrega, sin acreditar el incentivo dos veces.
    await ok("/sales/" + s.id + "/cod-collections", adminA.token, {
      offlineUuid: randomUUID(),
      cashSessionId: adminA.cash.id,
      amount: 300,
      method: "cash",
    });
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(0);
    expect(await totalOf(s.id)).toBe(incentive);
    // Con cobros registrados ya no se corrige.
    expect((await correct(adminA, { method: "cash" })).status).toBe(400);
  });

  it("efectivo → transferencia exige banco y referencia y queda por verificar", async () => {
    const s = (await sale(ana, 200, [{ method: "cash", amount: 200 }])).body;
    const paymentId = (await db.payment.findFirst({ where: { saleId: s.id } }))
      .id;
    const before = await expectedOf(ana);
    const path = `/sales/${s.id}/payments/${paymentId}/correct-method`;
    expect(
      (
        await request(path, adminA.token, {
          method: "transfer",
          reason: "Pagó por transferencia",
        })
      ).status,
    ).toBe(400);
    await ok(path, adminA.token, {
      method: "transfer",
      bank: "Banreservas",
      reference: "REF-QA",
      reason: "Pagó por transferencia",
    });
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    expect(payment.status).toBe("pending_verification");
    const after = await expectedOf(ana);
    expect(after.cash).toBe(before.cash - 200);
    expect(after.transfer).toBe(before.transfer + 200);
  });
});

describe("A1 · efectivo que ya tiene la dueña, registrado por la cajera con PIN de gerente (24-oct)", () => {
  it("sin PIN 400, PIN malo rechazado, con PIN salda sin tocar la gaveta y el reenvío no duplica", async () => {
    const s = (await sale(ana, 300, [{ method: "cod", amount: 300 }])).body;
    const before = await expectedOf(ana);
    const operationId = randomUUID();
    const send = (managerPin?: string, op = operationId) =>
      request("/sales/" + s.id + "/credit-collections", ana.token, {
        operationId: op,
        cashSessionId: ana.cash.id,
        ...(managerPin ? { managerPin } : {}),
        lines: [{ method: "cash", amount: 300, ownerConfirmed: true }],
      });
    expect((await send()).status).toBe(400);
    expect((await send("111111", randomUUID())).status).toBeGreaterThanOrEqual(
      400,
    );
    const done = await send("246813");
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    const payments = await db.payment.findMany({
      where: { saleId: s.id, entryType: "installment" },
    });
    expect(payments).toHaveLength(1);
    expect(payments[0].cashSessionId).toBeNull();
    expect(payments[0].receivedById).not.toBe(ana.id);
    expect([adminA.id, adminB.id, adminNoCash.id]).toContain(
      payments[0].receivedById,
    );
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(0);
    expect((await expectedOf(ana)).cash).toBe(before.cash);
    // A2: el cuadre lo lista aparte, sin sumarlo al esperado.
    const cuadre = await ok("/cash-sessions/" + ana.cash.id + "/cuadre", owner);
    expect(
      cuadre.ownerReceived.some(
        (r: any) => r.number === s.number && r.amount === 300,
      ),
    ).toBe(true);
    const again = await send("246813");
    expect(again.status, JSON.stringify(again.body)).toBeLessThan(300);
    expect(
      await db.payment.count({
        where: { saleId: s.id, entryType: "installment" },
      }),
    ).toBe(1);
    // Una referencia propia no quita la marca (hallazgo de Claude PC, 25-oct).
    const s2 = (await sale(ana, 200, [{ method: "cod", amount: 200 }])).body;
    const tagged = await request(
      "/sales/" + s2.id + "/credit-collections",
      ana.token,
      {
        operationId: randomUUID(),
        cashSessionId: ana.cash.id,
        managerPin: "246813",
        lines: [
          {
            method: "cash",
            amount: 200,
            ownerConfirmed: true,
            reference: "sin marca",
          },
        ],
      },
    );
    expect(tagged.status, JSON.stringify(tagged.body)).toBeLessThan(300);
    const p2 = await db.payment.findFirst({
      where: { saleId: s2.id, entryType: "installment" },
    });
    expect(p2.reference).toBe("Recibido por la dueña · sin marca");
    expect((await expectedOf(ana)).cash).toBe(before.cash);
    const cuadre2 = await ok(
      "/cash-sessions/" + ana.cash.id + "/cuadre",
      owner,
    );
    expect(cuadre2.ownerReceived.some((r: any) => r.number === s2.number)).toBe(
      true,
    );
  });

  it("con dos cajas abiertas a la vez, el cobro de la dueña sale solo en el cuadre de la caja que lo registró (CPC-1)", async () => {
    const s = (await sale(ana, 150, [{ method: "cod", amount: 150 }])).body;
    const done = await request(
      "/sales/" + s.id + "/credit-collections",
      ana.token,
      {
        operationId: randomUUID(),
        cashSessionId: ana.cash.id,
        managerPin: "246813",
        lines: [{ method: "cash", amount: 150, ownerConfirmed: true }],
      },
    );
    expect(done.status, JSON.stringify(done.body)).toBeLessThan(300);
    const seen = async (who: Actor) =>
      (
        await ok("/cash-sessions/" + who.cash.id + "/cuadre", owner)
      ).ownerReceived.some((r: any) => r.number === s.number);
    expect(await seen(ana)).toBe(true);
    expect(await seen(adminA)).toBe(false);
    expect(await seen(adminB)).toBe(false);
  });
});
