// W6 · Una caja pertenece a un usuario (decisión 38). Contra la API real:
// Marcos (administrador) abre su caja en la computadora T1; Lisbeth (cajera)
// inicia sesión en esa misma T1 y debe ver «sin caja», abrir la suya y vender
// sólo con ella. La gerencia ve y cierra las dos; el cierre queda a nombre de
// quien la cerró y de la dueña de la caja. Sin fechas fijas: todo se calcula
// con el reloj y un sufijo único por corrida.
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
const STRONG_TEMPORARY = "FitStore-QA-Caja-2026!";
const STRONG_PASSWORD = "FitStore-QA-Caja-Definitiva-2026!";
const CASHIER_TEMPORARY = "583904";
const CASHIER_PASSWORD = "739205";
const MANAGER_PIN = "135792";

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

type Person = { id: string; name: string; token: string };
let owner = "",
  customerId = "",
  variantId = "",
  productId = "";
const T1 = randomUUID();
const T2 = randomUUID();
const created: string[] = [];
let marcos: Person, lisbeth: Person, gerente: Person;
let marcosCash: any, lisbethCash: any;

async function enroll(token: string, id: string, name: string) {
  const t = await ok("/terminals/register", token, {
    id,
    name,
    secret: "qa-caja-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", owner, {});
}
async function person(
  label: string,
  role: string,
  pin = "246813",
): Promise<Person> {
  const roles = await ok("/roles", owner);
  const email = `qa-caja-${label}-${suffix}@example.test`;
  const name = `QA ${label} ${suffix}`;
  const isSeller = role === "seller";
  const temporaryPassword = isSeller ? CASHIER_TEMPORARY : STRONG_TEMPORARY;
  const password = isSeller ? CASHIER_PASSWORD : STRONG_PASSWORD;
  const user = await ok("/users", owner, {
    name,
    email,
    password: temporaryPassword,
    pin,
    roleId: roles.find((r: any) => r.name === role).id,
  });
  const login = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: temporaryPassword,
    newPassword: password,
    confirmPassword: password,
  });
  created.push(user.id);
  return { id: user.id, name, token: login.accessToken };
}
const saleBody = (
  cashSessionId: string,
  extra: Record<string, unknown> = {},
) => ({
  offlineUuid: randomUUID(),
  customerId,
  cashSessionId,
  items: [{ variantId, qty: 1 }],
  payments: [{ method: "cash", amount: 100 }],
  expectedTotal: 100,
  ...extra,
});
const open = (who: Person, amount = 1000) =>
  request("/cash-sessions/open", who.token, {
    openingAmount: amount,
    // Sólo se usan si el fondo es menor que lo dejado en el último cierre.
    openingNote: "QA: fondo de la prueba",
    managerPin: MANAGER_PIN,
  });
const openSessions = async (who: Person) =>
  (await ok("/cash-sessions", who.token)).filter(
    (s: any) => !s.closedAt && s.userId === who.id,
  );

beforeAll(async () => {
  owner = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await enroll(owner, randomUUID(), "QA dueña caja " + suffix);
  customerId = (
    await ok("/customers", owner, { name: "QA caja por usuario " + suffix })
  ).id;
  const cats = await ok("/categories", owner);
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", owner, {
    name: "QA caja usuario " + suffix,
    sku: "QCU-" + tag,
    categoryId: cats.find((c: any) => c.name === "Suplementos").id,
    taxRate: 0,
    variants: [
      { sku: "QCU-V-" + tag, barcode: "QCU-B-" + tag, price: 100, costAvg: 40 },
    ],
  });
  productId = p.id;
  variantId = p.variants[0].id;
  await ok("/inventory/adjustments", owner, {
    variantId,
    qty: 200,
    reason: "QA caja por usuario",
    lotNumber: "QCU-" + tag,
    expiryDate: new Date(Date.now() + 300 * 86400000).toISOString(),
  });
  marcos = await person("marcos", "admin", "987123");
  lisbeth = await person("lisbeth", "seller");
  gerente = await person("gerente", "manager", MANAGER_PIN);
  // La misma computadora T1 para las tres personas.
  for (const who of [marcos, lisbeth, gerente])
    await enroll(who.token, T1, "Computadora T1 " + suffix);
}, 120000);

afterAll(async () => {
  for (const who of [marcos, lisbeth])
    for (const s of who ? await openSessions(who).catch(() => []) : [])
      await request("/cash-sessions/" + s.id + "/close", owner, {
        countedCash: 0,
        countedCard: 0,
        countedTransfer: 0,
        notes: "Cierre de pruebas de caja por usuario",
      });
  if (productId)
    await request("/products/" + productId, owner, { active: false }, "PATCH");
  // La aprobación con PIN compara contra todas las usuarias activas (bcrypt
  // por cada una): las de prueba se desactivan para no alentar otras pruebas.
  for (const id of created)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
}, 60000);

describe("W6 · cada usuario tiene su propia caja", () => {
  it("Marcos abre su caja en T1; Lisbeth en T1 ve «sin caja» y abre la suya", async () => {
    const r = await open(marcos, 1000);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    marcosCash = r.body;
    expect(marcosCash.registerId).toBe(T1);
    // Lisbeth no ve ni rastro de la caja de Marcos.
    const antes = await ok("/cash-sessions", lisbeth.token);
    expect(antes.filter((s: any) => !s.closedAt)).toEqual([]);
    expect(JSON.stringify(antes)).not.toContain(marcosCash.id);
    // Y puede abrir la suya en la misma computadora.
    const propia = await open(lisbeth, 500);
    expect(propia.status, JSON.stringify(propia.body)).toBe(201);
    lisbethCash = propia.body;
    expect(lisbethCash.userId).toBe(lisbeth.id);
    expect(lisbethCash.registerId).toBe(T1);
    expect(lisbethCash.id).not.toBe(marcosCash.id);
    // Repetir «Abrir» devuelve su misma caja, nunca la de Marcos.
    const otra = await open(lisbeth, 777);
    expect(otra.body.id).toBe(lisbethCash.id);
    const mias = await openSessions(lisbeth);
    expect(mias.map((s: any) => s.id)).toEqual([lisbethCash.id]);
  });

  it("la cajera sólo lista su caja; gerencia ve las dos con dueño y equipo", async () => {
    for (const who of [lisbeth]) {
      const all = await ok("/cash-sessions", who.token);
      expect(all.every((s: any) => s.userId === lisbeth.id)).toBe(true);
    }
    const seen = (await ok("/cash-sessions", gerente.token)).filter(
      (s: any) => !s.closedAt,
    );
    const ids = seen.map((s: any) => s.id);
    expect(ids).toContain(marcosCash.id);
    expect(ids).toContain(lisbethCash.id);
    const m = seen.find((s: any) => s.id === marcosCash.id);
    expect(m.userName).toBe(marcos.name);
    expect(m.registerName).toContain("Computadora T1");
  });

  it("vender, mover dinero, cobrar deuda y cerrar sólo con la caja propia", async () => {
    // Lisbeth contra la caja de Marcos: 403 en todas las rutas de dinero.
    expect(
      (await request("/sales", lisbeth.token, saleBody(marcosCash.id))).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/cash-sessions/" + marcosCash.id + "/movements",
          lisbeth.token,
          {
            type: "in",
            amount: 10,
            reason: "No debería poder",
            operationId: randomUUID(),
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/cash-sessions/" + marcosCash.id + "/close",
          lisbeth.token,
          {
            countedCash: 1000,
            countedCard: 0,
            countedTransfer: 0,
          },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/cash-sessions/" + marcosCash.id + "/cuadre",
          lisbeth.token,
        )
      ).status,
    ).toBe(403);
    // Venta offline con la caja de otra persona: igual rechazo.
    expect(
      (
        await request(
          "/sales",
          lisbeth.token,
          saleBody(marcosCash.id, {
            offline: true,
            capturedAt: new Date(Date.now() - 5).toISOString(),
          }),
        )
      ).status,
    ).toBe(403);
    // Marcos tampoco vende en la de Lisbeth.
    expect(
      (await request("/sales", marcos.token, saleBody(lisbethCash.id))).status,
    ).toBe(403);
    // Cada una vende en la suya, desde la misma computadora.
    const a = await request("/sales", lisbeth.token, saleBody(lisbethCash.id));
    expect(a.status, JSON.stringify(a.body)).toBe(201);
    const b = await request("/sales", marcos.token, saleBody(marcosCash.id));
    expect(b.status, JSON.stringify(b.body)).toBe(201);
    expect(a.body.sellerId).toBe(lisbeth.id);
    expect(b.body.sellerId).toBe(marcos.id);
    // Invariante: el vendedor de cada venta es el dueño de su caja.
    const rows = await db.sale.findMany({
      where: { id: { in: [a.body.id, b.body.id] } },
      include: { cashSession: true },
    });
    for (const sale of rows)
      expect(sale.sellerId).toBe(sale.cashSession.userId);
  });

  it("incentivos: cada venta se atribuye a quien la cobró, en su caja", async () => {
    const mine = async (who: Person) =>
      (
        await db.incentiveEntry.findMany({
          where: { userId: who.id, kind: "sale" },
        })
      ).length;
    expect(await mine(lisbeth)).toBe(1);
    expect(await mine(marcos)).toBe(1);
  });

  it("cambiar de usuario con PIN cambia de caja: B nunca vende contra la de A", async () => {
    // El gerente abre su caja, cambia con PIN a Lisbeth (menos privilegios).
    const g = await open(gerente, 300);
    expect(g.status, JSON.stringify(g.body)).toBe(201);
    const switched = await ok("/auth/pin", gerente.token, {
      userId: lisbeth.id,
      pin: "246813",
    });
    expect(switched.user.id).toBe(lisbeth.id);
    const asLisbeth = switched.accessToken as string;
    // Como hace la web al cambiar de usuario: registra el equipo en la sesión.
    await enroll(asLisbeth, T1, "Computadora T1 " + suffix);
    // La sesión nueva es de Lisbeth: la caja del gerente le está vedada...
    expect(
      (await request("/sales", asLisbeth, saleBody(g.body.id))).status,
    ).toBe(403);
    // ...y su única caja es la suya.
    const mine = (await ok("/cash-sessions", asLisbeth)).filter(
      (s: any) => !s.closedAt,
    );
    expect(mine.map((s: any) => s.id)).toEqual([lisbethCash.id]);
    const sold = await request("/sales", asLisbeth, saleBody(lisbethCash.id));
    expect(sold.status, JSON.stringify(sold.body)).toBe(201);
    // Cierra la del gerente: el dueño la cierra con su propia sesión.
    await ok("/cash-sessions/" + g.body.id + "/close", gerente.token, {
      countedCash: 300,
      countedCard: 0,
      countedTransfer: 0,
    });
  });

  it("gerencia cierra la caja de Lisbeth: bitácora y cuadre nombran a ambos", async () => {
    const expected = (await ok("/cash-sessions", gerente.token)).find(
      (s: any) => s.id === lisbethCash.id,
    ).expected;
    const closed = await request(
      "/cash-sessions/" + lisbethCash.id + "/close",
      gerente.token,
      {
        countedCash: expected.cash,
        countedCard: expected.card,
        countedTransfer: expected.transfer,
        notes: "Cierre de emergencia: la caja quedó abierta",
      },
    );
    expect(closed.status, JSON.stringify(closed.body)).toBe(201);
    const log = await db.auditLog.findMany({
      where: { entityId: lisbethCash.id, action: "close_on_behalf" },
    });
    expect(log).toHaveLength(1);
    expect(JSON.stringify(log[0].after)).toContain(lisbeth.id);
    const cuadre = await ok(
      "/cash-sessions/" + lisbethCash.id + "/cuadre",
      gerente.token,
    );
    expect(cuadre.cashier.name).toBe(lisbeth.name);
    expect(cuadre.closedBy.name).toBe(gerente.name);
    expect(cuadre.closedBy.onBehalfOf).toBe(true);
    expect(cuadre.nonFiscalNotice).toMatch(/NO FISCAL/);
    // Lisbeth ve su cuadre sin esperado ni diferencias (cierre ciego).
    const suyo = await ok(
      "/cash-sessions/" + lisbethCash.id + "/cuadre",
      lisbeth.token,
    );
    expect(suyo.closedBy.name).toBe(gerente.name);
    expect(
      suyo.lines.some((l: any) => String(l.key).startsWith("difference")),
    ).toBe(false);
    // La caja de Marcos sigue abierta y es sólo suya.
    expect((await openSessions(marcos)).map((s: any) => s.id)).toEqual([
      marcosCash.id,
    ]);
  });

  it("un cierre normal del dueño no es «en nombre de»", async () => {
    const own = await request(
      "/cash-sessions/" + marcosCash.id + "/close",
      marcos.token,
      { countedCash: 1100, countedCard: 0, countedTransfer: 0 },
    );
    expect(own.status, JSON.stringify(own.body)).toBe(201);
    expect(
      await db.auditLog.count({
        where: { entityId: marcosCash.id, action: "close_on_behalf" },
      }),
    ).toBe(0);
    const cuadre = await ok(
      "/cash-sessions/" + marcosCash.id + "/cuadre",
      marcos.token,
    );
    expect(cuadre.closedBy.onBehalfOf).toBe(false);
    expect(cuadre.closedBy.name).toBe(marcos.name);
  });

  it("la caja puede estar en otro equipo: Lisbeth la reabre en T2 y no ve la ajena", async () => {
    const mine = await open(lisbeth, 100);
    expect(mine.status, JSON.stringify(mine.body)).toBe(201);
    await enroll(lisbeth.token, T2, "Computadora T2 " + suffix);
    const t = await request(
      "/cash-sessions/" + mine.body.id + "/transfer",
      lisbeth.token,
      { managerPin: MANAGER_PIN },
    );
    expect(t.status, JSON.stringify(t.body)).toBeLessThan(300);
  });
});
