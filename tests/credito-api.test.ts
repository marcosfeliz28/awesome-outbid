// W7 · Crédito sin pago y cobro por la administración, contra la API real:
// venta a crédito con cero pago o pago parcial, cobro mixto (transferencia +
// efectivo), solo administración, idempotencia, cierre con quién y cuándo, caja
// del administrador que cobra y reportes (la venta cuenta el día de la venta,
// el dinero el día del cobro, sin contarse dos veces). Fechas siempre
// relativas a hoy.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
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
async function person(
  label: string,
  role: "seller" | "admin",
  withCash = true,
): Promise<Actor> {
  const roles = await ok("/roles", owner);
  const email = `qa-cred-${label}-${suffix}@example.test`;
  const name = `QA ${label} ${suffix}`;
  const user = await ok("/users", owner, {
    name,
    email,
    password: TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === role).id,
  });
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: TEMPORARY,
    newPassword: PASSWORD,
    confirmPassword: PASSWORD,
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
    });
  if (originalSettings)
    await request("/settings", owner, originalSettings, "PUT");
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("W7 · venta a crédito sin pago", () => {
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

describe("W7 · cobro de créditos solo para administración", () => {
  it("cajera y gerente reciben 403 al listar y al cobrar", async () => {
    const s = (await sale(ana, 100, [{ method: "cod", amount: 100 }])).body;
    for (const who of [ana.token, manager]) {
      expect((await request("/cod/pending", who)).status).toBe(403);
      const r = await request("/sales/" + s.id + "/credit-collections", who, {
        operationId: randomUUID(),
        lines: [line("transfer", 100)],
      });
      expect(r.status).toBe(403);
    }
    expect(
      Number((await db.sale.findUnique({ where: { id: s.id } })).creditBalance),
    ).toBe(100);
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

describe("W7 · reportes: la venta cuenta el día de la venta, el dinero el día del cobro", () => {
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
