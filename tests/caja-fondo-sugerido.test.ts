// W8 · Fondo sugerido al abrir (decisión 40), contra la API real: sale del
// último cierre de la propia persona (en cualquier equipo); si nunca cerró,
// del último cierre del equipo; si tampoco hay, 0. Sin fechas fijas.
import { afterAll, describe, expect, it } from "vitest";
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
let owner = "";
const T1 = randomUUID();
const T2 = randomUUID();
const created: string[] = [];
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
const suggestion = (who: Person) =>
  ok("/cash-sessions/opening-suggestion", who.token);
const openAs = (who: Person, openingAmount: number) =>
  ok("/cash-sessions/open", who.token, { openingAmount });
const closeAs = (who: Person, id: string, counted: number, delivered = 0) =>
  ok("/cash-sessions/" + id + "/close", who.token, {
    countedCash: counted,
    countedCard: 0,
    countedTransfer: 0,
    delivered,
  });

describe("W8 · fondo sugerido por persona", () => {
  it("cada persona recibe su propio último cierre, con respaldo en el equipo y luego 0", async () => {
    owner = (
      await ok("/auth/login", "", {
        email: "admin@fitstore.demo",
        password: DEMO,
      })
    ).accessToken;
    await enroll(owner, randomUUID(), "QA dueña fondo " + suffix);
    const ana = await person("ana", "seller");
    const bea = await person("bea", "seller");
    await enroll(ana.token, T1, "Computadora T1 " + suffix);
    await enroll(bea.token, T1, "Computadora T1 " + suffix);
    // Sin ningún cierre: 0.
    for (const who of [ana, bea])
      expect(await suggestion(who)).toEqual({
        amount: 0,
        fromSessionId: null,
      });
    // Ana abre con 1000 y cierra dejando 600 (entrega 400).
    const a1 = await openAs(ana, 1000);
    await closeAs(ana, a1.id, 1000, 400);
    expect(await suggestion(ana)).toEqual({
      amount: 600,
      fromSessionId: a1.id,
    });
    // Bea nunca cerró: cae al último cierre del equipo (el de Ana).
    expect(await suggestion(bea)).toEqual({
      amount: 600,
      fromSessionId: a1.id,
    });
    // Bea abre y cierra dejando 900: su cierre es más reciente en el equipo.
    const b1 = await openAs(bea, 900);
    await closeAs(bea, b1.id, 900);
    expect(await suggestion(bea)).toEqual({
      amount: 900,
      fromSessionId: b1.id,
    });
    // Ana sigue viendo el suyo (600), no el más reciente del equipo (900).
    expect(await suggestion(ana)).toEqual({
      amount: 600,
      fromSessionId: a1.id,
    });
    // En otro equipo, Ana conserva su propio fondo...
    await enroll(ana.token, T2, "Computadora T2 " + suffix);
    expect(await suggestion(ana)).toEqual({
      amount: 600,
      fromSessionId: a1.id,
    });
    // ...y una persona nueva en un equipo sin cierres recibe 0.
    const cris = await person("cris", "seller");
    await enroll(cris.token, randomUUID(), "Equipo sin cierres " + suffix);
    expect(await suggestion(cris)).toEqual({
      amount: 0,
      fromSessionId: null,
    });
    // Abrir con menos que el propio fondo exige nota (D-03 sobre el propio cierre).
    const low = await request("/cash-sessions/open", ana.token, {
      openingAmount: 100,
    });
    expect(low.status).toBe(400);
    expect(JSON.stringify(low.body)).toMatch(/menor que lo dejado/);
  });
});

afterAll(async () => {
  // Las usuarias de prueba se desactivan: la aprobación con PIN compara contra
  // todas las gerentes activas (bcrypt) y alentaría otras pruebas.
  for (const id of created)
    await request("/users/" + id, owner, { active: false }, "PATCH");
  await db.$disconnect();
});
