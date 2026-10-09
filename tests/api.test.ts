import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { xlsxBomb } from "./fixtures/xlsx-zip";
import {
  PASSWORD_CHANGE_CONFIRMATION,
  forcePasswordChangeAtStartup,
  safelyForcePasswordChangeAtStartup,
} from "../apps/api/src/require-password-change";
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
describe("E1 · credenciales indistinguibles contra API real", () => {
  it("cuentas ausentes, inactivas y activas fallan y bloquean con el mismo mensaje", async () => {
    const role = await fixtureDb.role.findFirstOrThrow({
      where: { name: "seller" },
    });
    const branchId = "main";
    const passwordHash = await requireApi("bcryptjs").hash(randomUUID(), 12);
    const prefix = "e1-" + randomUUID();
    const users = await Promise.all(
      [false, true].map((active, index) =>
        fixtureDb.user.create({
          data: {
            name: "QA E1",
            username: prefix + index,
            usernameKey: prefix + index,
            email: prefix + index + "@example.test",
            passwordHash,
            pinHash: passwordHash,
            active,
            branchId,
            roleId: role.id,
          },
        }),
      ),
    );
    try {
      const identifiers = [
        prefix + "ausente",
        ...users.map((user: any) => user.username),
      ];
      for (let attempt = 0; attempt < 6; attempt++) {
        const responses = await Promise.all(
          identifiers.map((login) =>
            request(
              "/auth/login",
              { login, password: "Incorrecta-QA-2026!" },
              "",
            ),
          ),
        );
        expect(responses.every((response) => response.status === 400)).toBe(
          true,
        );
        expect(responses[1].body).toEqual(responses[0].body);
        expect(responses[2].body).toEqual(responses[0].body);
        expect(JSON.stringify(responses[0].body)).toContain(
          attempt < 5
            ? "Usuario o contraseña incorrectos."
            : "Cuenta bloqueada temporalmente.",
        );
      }
    } finally {
      await fixtureDb.user.deleteMany({
        where: { id: { in: users.map((user: any) => user.id) } },
      });
    }
  });
});
// fileURLToPath y no URL.pathname: en Windows pathname es "/C:/…", una ruta
// que no existe, y .env no se cargaba.
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});

const apiDir = fileURLToPath(new URL("../apps/api", import.meta.url));
// Ejecuta node en apps/api sin bloquear este proceso. Con spawnSync el bucle
// de eventos se detiene: si pasan más de 5 s, la API cierra las conexiones
// inactivas sin que la prueba lo vea y la petición siguiente falla con
// ECONNRESET.
function runNode(args: string[], env: NodeJS.ProcessEnv, timeout?: number) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd: apiDir,
        env,
        timeout,
      });
      let stdout = "",
        stderr = "";
      child.stdout.setEncoding("utf8").on("data", (d) => (stdout += d));
      child.stderr.setEncoding("utf8").on("data", (d) => (stderr += d));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    },
  );
}
const { PrismaClient } = requireApi("@prisma/client");
const fixtureDb = new PrismaClient();
const expectedForCash = async (id: string) => {
  const cash = (await ok("/cash-sessions", undefined, ownerToken)).find(
    (session: any) => session.id === id,
  );
  if (!cash?.expected)
    throw new Error(
      "La administración no recibió el esperado de la caja " + id,
    );
  return cash.expected as { cash: number; card: number; transfer: number };
};
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
let token = "",
  ownerToken = "",
  sellerToken = "",
  managerToken = "";
let supplierId = "",
  defaultCustomerId = "",
  session: any,
  sellerSession: any,
  supplement: any,
  clothing: any,
  sale: any;
const actors: any[] = [],
  products: any[] = [];
const suffix = Date.now().toString(36);
const testIp = "192.0.2." + ((Date.now() % 250) + 1);
const authIp = "203.0.113." + ((Date.now() % 250) + 1);
const rateIp = "198.51.100." + ((Date.now() % 250) + 1);
const QA_ACTIVE_PASSWORD = "FitStore-QA-Activa-2026!";
const qaPasswords = new Map<string, { initial: string; active: string }>();
const loginKey = (data: any) =>
  String(data?.login ?? data?.email ?? "")
    .trim()
    .toLocaleLowerCase("es");
const withActiveTestPassword = (path: string, data: any) => {
  if (path !== "/auth/login" || !data || typeof data !== "object") return data;
  const known = qaPasswords.get(loginKey(data));
  return known && data.password === known.initial
    ? { ...data, password: known.active }
    : data;
};
const prepareTestPayload = (path: string, data: any) => {
  return withActiveTestPassword(path, data);
};
async function completeRequiredPasswordChange(
  path: string,
  data: any,
  response: { status: number; body: any },
  send: (path: string, data: unknown) => Promise<{ status: number; body: any }>,
) {
  if (path !== "/auth/login" || !response.body?.requiresPasswordChange)
    return response;
  const key = loginKey(data);
  const initial = String(data?.password ?? "");
  const changed = await send("/auth/change-password", {
    login: String(data?.login ?? data?.email ?? ""),
    currentPassword: initial,
    newPassword: QA_ACTIVE_PASSWORD,
    confirmPassword: QA_ACTIVE_PASSWORD,
  });
  if (changed.status < 400)
    qaPasswords.set(key, { initial, active: QA_ACTIVE_PASSWORD });
  return changed;
}
async function request(
  path: string,
  data?: unknown,
  as = token,
  method = data === undefined ? "GET" : "POST",
) {
  data = prepareTestPayload(path, data);
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": testIp,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path: string, data?: unknown, as = token, method?: string) {
  let r = await request(path, data, as, method);
  r = await completeRequiredPasswordChange(path, data, r, (next, payload) =>
    request(next, payload, ""),
  );
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
const input = (id: string, total: number, s = session) => ({
  offlineUuid: randomUUID(),
  customerId: defaultCustomerId,
  cashSessionId: s.id,
  items: [{ variantId: id, qty: 1 }],
  discountReason: "Descuento autorizado en pruebas",
  payments: [{ method: "cash", amount: total }],
  expectedTotal: total,
});
// Ronda 4: toda operación de stock o caja exige un equipo aprobado.
const secretOf = (id: string) => "qa-secret-" + id;
const tokenTerminal = new Map<string, string>();
async function registerTerminal(as: string, id: string, name: string) {
  const t = await ok(
    "/terminals/register",
    { id, name, secret: secretOf(id) },
    as,
  );
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", {}, ownerToken);
  tokenTerminal.set(as, id);
  return id;
}
const enroll = (as: string, name = "QA equipo " + randomUUID().slice(0, 6)) =>
  registerTerminal(as, randomUUID(), name);
beforeAll(async () => {
  ownerToken = token = (
    await ok(
      "/auth/login",
      {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      },
      "",
    )
  ).accessToken;
  await enroll(ownerToken, "QA dueño");
  const roles = await ok("/roles");
  for (const role of ["admin", "seller", "manager"]) {
    const u = await ok("/users", {
      name: "QA " + role + " " + suffix,
      email: `qa-${role}-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: role === "manager" ? "987654" : "876543",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    let auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    if (auth.requiresPasswordChange)
      auth = await ok(
        "/auth/change-password",
        {
          login: u.email,
          currentPassword: "FitStore-QA-2026!",
          newPassword: "FitStore-QA-Nueva-2026!",
          confirmPassword: "FitStore-QA-Nueva-2026!",
        },
        "",
      );
    await enroll(auth.accessToken, "QA " + role);
    if (role === "admin") token = auth.accessToken;
    if (role === "seller") sellerToken = auth.accessToken;
    if (role === "manager") managerToken = auth.accessToken;
  }
  defaultCustomerId = (
    await ok("/customers", { name: "QA Cliente ventas " + suffix })
  ).id;
  const cats = await ok("/categories");
  supplierId = (await ok("/suppliers"))[0].id;
  supplement = await ok("/products", {
    name: "QA Proteína " + suffix,
    sku: "QA-S-" + suffix,
    categoryId: cats.find((c: any) => c.name === "Suplementos").id,
    variants: [
      {
        sku: "QA-SV-" + suffix,
        barcode: "QA-SB-" + suffix,
        costAvg: 100,
        price: 236,
      },
    ],
  });
  products.push(supplement);
  clothing = await ok("/products", {
    name: "QA Legging " + suffix,
    sku: "QA-C-" + suffix,
    categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
    variants: [
      {
        sku: "QA-CV-" + suffix,
        barcode: "QA-CB-" + suffix,
        costAvg: 40,
        price: 118,
        attributes: { talla: "M", color: "Negro" },
      },
    ],
  });
  products.push(clothing);
  for (const [lot, days] of [
    ["QA-B", 90],
    ["QA-A", 45],
  ] as const)
    await ok("/inventory/adjustments", {
      variantId: supplement.variants[0].id,
      qty: 5,
      reason: "QA lote",
      lotNumber: lot,
      expiryDate: new Date(Date.now() + days * 86400000).toISOString(),
    });
  await ok("/inventory/adjustments", {
    variantId: clothing.variants[0].id,
    qty: 10,
    reason: "QA apertura",
  });
  session = await ok("/cash-sessions/open", {
    registerId: "qa-admin-" + suffix,
    openingAmount: 500,
  });
  sellerSession = await ok(
    "/cash-sessions/open",
    { registerId: "qa-seller-" + suffix, openingAmount: 100 },
    sellerToken,
  );
});
afterAll(async () => {
  for (const [s, t] of [
    [session, token],
    [sellerSession, sellerToken],
  ])
    if (s) {
      const current = (await ok("/cash-sessions", undefined, t)).find(
        (i: any) => i.id === s.id,
      );
      if (!current.closedAt)
        await ok(
          "/cash-sessions/" + s.id + "/close",
          {
            // El arqueo es ciego para la cajera; la limpieza tampoco debe
            // depender de importes que la API oculta correctamente.
            countedCash: Math.max(0, current.expected?.cash ?? 0),
            countedCard: Math.max(0, current.expected?.card ?? 0),
            countedTransfer: Math.max(0, current.expected?.transfer ?? 0),
            notes: "Cierre de pruebas",
          },
          t,
        );
    }
  for (const p of products)
    await request("/products/" + p.id, { active: false }, ownerToken, "PATCH");
  for (const u of actors)
    await request("/users/" + u.id, { active: false }, ownerToken, "PATCH");
});
describe("Aceptación financiera y permisos", () => {
  it("T5: el arranque marca sólo las cuentas configuradas y sin variables no cambia ninguna", async () => {
    const role = await fixtureDb.role.findUniqueOrThrow({
      where: { name: "seller" },
    });
    const prefix = `t5-${randomUUID()}`;
    const created = await Promise.all(
      [
        { username: null, key: "correo", mustChangePassword: false },
        {
          username: `${prefix}-usuario`,
          key: "usuario",
          mustChangePassword: false,
        },
        { username: null, key: "marcado", mustChangePassword: true },
        { username: null, key: "intacto", mustChangePassword: false },
        { username: null, key: "concurrente", mustChangePassword: false },
        {
          username: `${prefix}-ambiguo@example.invalid`,
          key: "ambiguo-usuario",
          email: `${prefix}-otro@example.invalid`,
          mustChangePassword: false,
        },
        {
          username: null,
          key: "ambiguo-correo",
          email: `${prefix}-ambiguo@example.invalid`,
          mustChangePassword: false,
        },
      ].map((entry) =>
        fixtureDb.user.create({
          data: {
            name: "T5 arranque",
            username: entry.username,
            usernameKey: entry.username,
            email: entry.email ?? `${prefix}-${entry.key}@example.invalid`,
            passwordHash: "no-se-usa-en-esta-prueba",
            pinHash: "no-se-usa-en-esta-prueba",
            roleId: role.id,
            mustChangePassword: entry.mustChangePassword,
          },
        }),
      ),
    );
    const [
      emailTarget,
      usernameTarget,
      alreadyMarked,
      untouched,
      concurrentTarget,
      ambiguousUsername,
      ambiguousEmail,
    ] = created;
    const logs: string[] = [];

    try {
      expect(
        await forcePasswordChangeAtStartup(fixtureDb, {}, (line) =>
          logs.push(line),
        ),
      ).toBe(0);
      expect(
        await fixtureDb.user.findUniqueOrThrow({
          where: { id: emailTarget.id },
        }),
      ).toMatchObject({ mustChangePassword: false, authVersion: 0 });

      expect(
        await forcePasswordChangeAtStartup(
          fixtureDb,
          {
            FORCE_PASSWORD_CHANGE_USERNAMES: `${emailTarget.email}, ${usernameTarget.username}, ${alreadyMarked.email}`,
            FORCE_PASSWORD_CHANGE_CONFIRM: PASSWORD_CHANGE_CONFIRMATION,
          },
          (line) => logs.push(line),
        ),
      ).toBe(2);

      const users = await fixtureDb.user.findMany({
        where: { id: { in: created.map((user) => user.id) } },
        orderBy: { username: "asc" },
      });
      for (const target of [emailTarget, usernameTarget])
        expect(users.find((user: any) => user.id === target.id)).toMatchObject({
          mustChangePassword: true,
          authVersion: 1,
        });
      expect(
        users.find((user: any) => user.id === alreadyMarked.id),
      ).toMatchObject({ mustChangePassword: true, authVersion: 0 });
      expect(users.find((user: any) => user.id === untouched.id)).toMatchObject(
        { mustChangePassword: false, authVersion: 0 },
      );
      expect(logs).toEqual([
        "2 cuenta(s) requieren cambio de contraseña al iniciar.",
      ]);
      expect(logs.join(" ")).not.toContain(emailTarget.email);
      expect(logs.join(" ")).not.toContain(usernameTarget.username);

      expect(
        await forcePasswordChangeAtStartup(
          fixtureDb,
          {
            FORCE_PASSWORD_CHANGE_USERNAMES: `${emailTarget.email},${usernameTarget.username},${alreadyMarked.email}`,
            FORCE_PASSWORD_CHANGE_CONFIRM: PASSWORD_CHANGE_CONFIRMATION,
          },
          () => undefined,
        ),
      ).toBe(0);

      const concurrent = await Promise.all(
        [1, 2].map(() =>
          forcePasswordChangeAtStartup(
            fixtureDb,
            {
              FORCE_PASSWORD_CHANGE_USERNAMES: concurrentTarget.email,
              FORCE_PASSWORD_CHANGE_CONFIRM: PASSWORD_CHANGE_CONFIRMATION,
            },
            () => undefined,
          ),
        ),
      );
      expect(concurrent.sort()).toEqual([0, 1]);
      expect(
        await fixtureDb.user.findUniqueOrThrow({
          where: { id: concurrentTarget.id },
        }),
      ).toMatchObject({ mustChangePassword: true, authVersion: 1 });
      expect(
        await fixtureDb.auditLog.count({
          where: {
            action: "require_password_change",
            entityId: concurrentTarget.id,
          },
        }),
      ).toBe(1);

      await expect(
        forcePasswordChangeAtStartup(
          fixtureDb,
          {
            FORCE_PASSWORD_CHANGE_USERNAMES: ambiguousEmail.email,
            FORCE_PASSWORD_CHANGE_CONFIRM: PASSWORD_CHANGE_CONFIRMATION,
          },
          () => undefined,
        ),
      ).rejects.toThrow(/exactamente.*sin cuentas repetidas/i);
      for (const user of [ambiguousUsername, ambiguousEmail])
        expect(
          await fixtureDb.user.findUniqueOrThrow({ where: { id: user.id } }),
        ).toMatchObject({ mustChangePassword: false, authVersion: 0 });

      const configuredSecret = "clave-que-no-debe-aparecer";
      const warnings: string[] = [];
      const invalidEnv = {
        FORCE_PASSWORD_CHANGE_USERNAMES: `inexistente-${configuredSecret}`,
        FORCE_PASSWORD_CHANGE_CONFIRM: PASSWORD_CHANGE_CONFIRMATION,
      };
      await expect(
        forcePasswordChangeAtStartup(fixtureDb, invalidEnv, () => undefined),
      ).rejects.toThrow(/exactamente/i);
      expect(
        await safelyForcePasswordChangeAtStartup(
          fixtureDb,
          invalidEnv,
          () => undefined,
          (line) => warnings.push(line),
        ),
      ).toBe(0);
      expect(warnings).toEqual([
        "No se pudo aplicar el cambio obligatorio de contraseña; revisa la lista configurada.",
      ]);
      expect(warnings.join(" ")).not.toContain(configuredSecret);
      expect(warnings.join(" ")).not.toMatch(/hash/i);
    } finally {
      await fixtureDb.auditLog.deleteMany({
        where: { entity: "user", entityId: { in: created.map((u) => u.id) } },
      });
      await fixtureDb.user.deleteMany({
        where: { id: { in: created.map((user) => user.id) } },
      });
    }
  });

  it("la contraseña temporal no abre sesión hasta que el usuario la reemplaza", async () => {
    const email = `qa-temporal-${randomUUID()}@example.test`;
    const initial = "FitStore-QA-Temporal-2026!";
    const active = "FitStore-QA-Definitiva-2026!";
    const roles = await ok("/roles");
    const user = await ok("/users", {
      name: "QA contraseña temporal " + suffix,
      email,
      password: initial,
      pin: "246810",
      roleId: roles.find((role: any) => role.name === "seller").id,
    });
    actors.push(user);

    const first = await request(
      "/auth/login",
      { email, password: initial },
      "",
    );
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ requiresPasswordChange: true });
    expect(first.body.accessToken).toBeUndefined();
    expect(
      (
        await request(
          "/auth/me",
          undefined,
          first.body.accessToken ?? "token-temporal-inutilizable",
        )
      ).status,
    ).toBe(401);

    const changed = await request(
      "/auth/change-password",
      {
        login: email,
        currentPassword: initial,
        newPassword: active,
        confirmPassword: active,
      },
      "",
    );
    expect(changed.status).toBe(201);
    expect(changed.body.accessToken).toBeTruthy();
    expect(
      (await request("/auth/me", undefined, changed.body.accessToken)).status,
    ).toBe(200);
    expect(
      (await request("/auth/login", { email, password: initial }, "")).status,
    ).toBe(400);
    const second = await request(
      "/auth/login",
      { email, password: active },
      "",
    );
    expect(second.status).toBe(201);
    expect(second.body.accessToken).toBeTruthy();
  });

  it("rechaza una venta sin cliente identificado antes de modificar inventario", async () => {
    const before = Number(
      (await ok("/products/" + clothing.id)).variants[0].stock,
    );
    const response = await request("/sales", {
      ...input(clothing.variants[0].id, 118),
      customerId: null,
    });
    expect(response.status).toBe(400);
    expect(response.body.message).toContain(
      "Selecciona o crea un cliente antes de vender",
    );
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(before);
  });
  it("requiere sesión y el vendedor nunca recibe costos", async () => {
    expect((await request("/products", undefined, "")).status).toBe(401);
    const catalog = JSON.stringify(
      await ok("/products", undefined, sellerToken),
    );
    expect(catalog).not.toContain("costAvg");
    expect(catalog).not.toContain('"cost"');
    expect(
      JSON.stringify(await ok("/inventory/movements", undefined, sellerToken)),
    ).not.toContain("unitCost");
    expect(
      (await request("/dashboard/summary", undefined, sellerToken)).status,
    ).toBe(403);
    expect((await request("/users", undefined, sellerToken)).status).toBe(403);
  });
  // Contrato cambiado a propósito por D-02: antes el administrador anulaba sin
  // caja abierta y la caja cerrada quedaba con un sobrante de 118 (esperado
  // 200, diferencia +118) sin que ninguna caja registrara el reembolso. Ahora
  // el efectivo sale de su caja abierta y el cierre anterior no cambia.
  it("solo un administrador anula una venta antigua; con la caja cerrada, el reembolso en efectivo sale de su caja abierta", async () => {
    const roles = await ok("/roles", undefined, ownerToken);
    const cashier = await ok(
      "/users",
      {
        name: "QA admin anulación " + suffix,
        email: "qa-void-" + suffix + "@example.test",
        password: "FitStore-QA-2026!",
        pin: "345678",
        roleId: roles.find((r: any) => r.name === "admin").id,
      },
      ownerToken,
    );
    actors.push(cashier);
    const cashierToken = (
      await ok(
        "/auth/login",
        { email: cashier.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    await enroll(cashierToken, "QA caja para anulación histórica");
    const oldCash = await ok(
      "/cash-sessions/open",
      { registerId: "qa-void-" + suffix, openingAmount: 200 },
      cashierToken,
    );
    const stockBefore = Number(
      (await ok("/products/" + clothing.id)).variants[0].stock,
    );
    const sold = await ok(
      "/sales",
      input(clothing.variants[0].id, 118, oldCash),
      cashierToken,
    );
    const cashBeforeClose = (
      await ok("/cash-sessions", undefined, cashierToken)
    ).find((c: any) => c.id === oldCash.id);
    await ok(
      "/cash-sessions/" + oldCash.id + "/close",
      {
        countedCash: cashBeforeClose.expected.cash,
        countedCard: cashBeforeClose.expected.card,
        countedTransfer: cashBeforeClose.expected.transfer,
        notes: "QA cierre previo a anulación histórica",
      },
      cashierToken,
    );
    const oldDate = new Date("2025-01-15T12:00:00.000Z");
    await fixtureDb.sale.update({
      where: { id: sold.id },
      data: { createdAt: oldDate },
    });

    expect(
      (
        await request(
          "/sales/" + sold.id + "/void",
          { reason: "QA intento de cajero" },
          sellerToken,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/sales/" + sold.id + "/void",
          { reason: "QA intento de gerente" },
          managerToken,
        )
      ).status,
    ).toBe(403);

    const owner = await ok("/auth/me", undefined, ownerToken);
    const withoutCash = await request(
      "/sales/" + sold.id + "/void",
      { reason: "QA factura antigua anulada por administrador" },
      ownerToken,
    );
    expect(withoutCash.status).toBe(400);
    expect(withoutCash.body.message).toMatch(/Abre tu caja/);
    const refundCash = await ok(
      "/cash-sessions/open",
      { openingAmount: 200 },
      ownerToken,
    );
    await ok(
      "/sales/" + sold.id + "/void",
      { reason: "QA factura antigua anulada por administrador" },
      ownerToken,
    );
    const saved = await fixtureDb.sale.findUniqueOrThrow({
      where: { id: sold.id },
    });
    expect(saved.status).toBe("voided");
    expect(saved.voidedBy).toBe(owner.id);
    expect(saved.voidedReason).toBe(
      "QA factura antigua anulada por administrador",
    );
    expect(saved.createdAt.toISOString()).toBe(oldDate.toISOString());
    expect(
      (
        await ok(
          "/sales?date=2025-01-15&q=" + encodeURIComponent(sold.number),
          undefined,
          ownerToken,
        )
      ).map((row: any) => row.id),
    ).toContain(sold.id);
    expect(
      (await request("/sales?date=2025-02-31", undefined, ownerToken)).status,
    ).toBe(400);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(stockBefore);

    const closedCash = await fixtureDb.cashSession.findUniqueOrThrow({
      where: { id: oldCash.id },
    });
    expect(Number(closedCash.expectedCash)).toBe(318);
    expect(Number(closedCash.differenceCash)).toBe(0);
    expect((await expectedForCash(refundCash.id)).cash).toBe(82);
    await ok(
      "/cash-sessions/" + refundCash.id + "/close",
      {
        countedCash: 82,
        countedCard: 0,
        countedTransfer: 0,
        notes: "QA cierre de la caja que reembolsó",
      },
      ownerToken,
    );
    const audits = await ok("/audit-log", undefined, ownerToken);
    expect(
      audits.some(
        (a: any) =>
          a.action === "void" &&
          a.entityId === sold.id &&
          a.userId === owner.id &&
          a.after?.reason === "QA factura antigua anulada por administrador",
      ),
    ).toBe(true);
    expect(
      audits.some(
        (a: any) =>
          a.action === "void_after_close" &&
          a.entityId === oldCash.id &&
          a.after?.saleId === sold.id,
      ),
    ).toBe(true);
  });
  it("vende proteína y legging con FEFO y pago dividido", async () => {
    sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items: [
        { variantId: supplement.variants[0].id, qty: 1 },
        { variantId: clothing.variants[0].id, qty: 1 },
      ],
      payments: [
        { method: "cash", amount: 250 },
        {
          method: "card",
          amount: 150,
          cardLast4: "4242",
          approvalCode: "QA-001",
        },
      ],
      expectedTotal: 354,
    });
    expect(Number(sale.total)).toBe(354);
    expect(Number(sale.taxTotal)).toBe(54);
    expect(Number(sale.costTotal)).toBe(140);
    expect(
      Number(sale.payments.find((p: any) => p.method === "cash").change),
    ).toBe(46);
    const p = await ok("/products/" + supplement.id);
    expect(Number(p.variants[0].stock)).toBe(9);
    expect(
      Number(p.variants[0].lots.find((l: any) => l.lotNumber === "QA-A").qty),
    ).toBe(4);
    expect(
      Number(p.variants[0].lots.find((l: any) => l.lotNumber === "QA-B").qty),
    ).toBe(5);
  });
  it("rechaza pagos y stock inválidos sin crear huecos ni movimientos", async () => {
    const before = (await ok("/sales"))[0].number;
    const valid = input(clothing.variants[0].id, 118);
    expect(
      (
        await request("/sales", {
          ...valid,
          payments: [{ method: "cash", amount: 1 }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/sales", {
          ...valid,
          payments: [
            {
              method: "card",
              amount: 200,
              cardLast4: "4242",
              approvalCode: "QA",
            },
          ],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request("/sales", {
          ...valid,
          items: [{ variantId: clothing.variants[0].id, qty: 1000 }],
          payments: [{ method: "cash", amount: 118000 }],
          expectedTotal: 118000,
        })
      ).status,
    ).toBe(400);
    expect((await ok("/sales"))[0].number).toBe(before);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(9);
  });
  it("es idempotente ante peticiones concurrentes y sync", async () => {
    const payload = input(clothing.variants[0].id, 118);
    const [a, b] = await Promise.all([
      ok("/sales", payload),
      ok("/sales", payload),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(8);
    expect(
      (await ok("/sales/sync", { sales: [payload] })).results[0].sale.id,
    ).toBe(a.id);
    expect(
      (
        await request("/sales", {
          ...payload,
          payments: [{ method: "cash", amount: 200 }],
        })
      ).status,
    ).toBe(400);
  });
  it("25% requiere PIN del gerente y queda auditado", async () => {
    const payload = {
      ...input(clothing.variants[0].id, 88.5, sellerSession),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountPercent: 25 },
      ],
    };
    expect((await request("/sales", payload, sellerToken)).status).toBe(400);
    const r = await ok(
      "/sales",
      { ...payload, managerPin: "987654" },
      sellerToken,
    );
    expect(Number(r.total)).toBe(88.5);
    expect(JSON.stringify(r)).not.toContain("unitCost");
    expect(
      (await ok("/audit-log")).some(
        (a: any) => a.action === "discount_approved" && a.entityId === r.id,
      ),
    ).toBe(true);
  });
  it("prorratea flete, recalcula promedio y conserva costo histórico", async () => {
    const po = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: supplement.variants[0].id, qty: 3, unitCost: 150 }],
    });
    await ok("/purchase-orders/" + po.id + "/receive", {
      operationId: randomUUID(),
      freight: 30,
      items: [
        {
          itemId: po.items[0].id,
          qty: 3,
          lotNumber: "QA-C",
          expiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
        },
      ],
    });
    const p = await ok("/products/" + supplement.id);
    expect(Number(p.variants[0].stock)).toBe(12);
    expect(Number(p.variants[0].costAvg)).toBe(115);
    const sold = (await ok("/sales")).find((s: any) => s.id === sale.id);
    expect(
      Number(
        sold.items.find((i: any) => i.variantId === supplement.variants[0].id)
          .unitCost,
      ),
    ).toBe(100);
  });
  it("protege devoluciones abiertas y repetidas", async () => {
    const line = sale.items.find(
      (i: any) => i.variantId === supplement.variants[0].id,
    );
    const payload = {
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución",
      refundMethod: "cash",
      items: [{ saleItemId: line.id, qty: 1, restock: true, opened: true }],
    };
    expect((await request("/returns", payload)).status).toBe(400);
    const fixed = {
      ...payload,
      items: [{ saleItemId: line.id, qty: 1, restock: true, opened: false }],
    };
    expect(Number((await ok("/returns", fixed)).total)).toBe(236);
    expect((await request("/returns", fixed)).status).toBe(400);
    expect(
      (
        await request("/sales/" + sale.id + "/void", {
          reason: "QA anular",
          cashSessionId: session.id,
        })
      ).status,
    ).toBe(400);
  });
  it("evalúa vencimiento, rotación y presupuesto", async () => {
    expect(
      (await ok("/promotions/clearance-candidates")).some(
        (c: any) => c.daysIdle >= 60,
      ),
    ).toBe(true);
    const alerts = await ok("/alerts");
    expect(alerts.some((a: any) => a.type === "expiring")).toBe(true);
    expect(
      (await ok("/alerts?type=expense_budget")).some(
        (a: any) => a.type === "expense_budget",
      ),
    ).toBe(true);
  });
  it("conserva conflictos offline sin stock negativo", async () => {
    const payload = {
      ...input(clothing.variants[0].id, 118000),
      items: [{ variantId: clothing.variants[0].id, qty: 1000 }],
    };
    expect(
      (await ok("/sales/sync", { sales: [payload] })).results[0].status,
    ).toBe("conflict");
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBeGreaterThanOrEqual(0);
    expect(
      (await ok("/alerts?entityId=" + payload.offlineUuid)).some(
        (a: any) => a.entityId === payload.offlineUuid,
      ),
    ).toBe(true);
  });
  it("exporta los 17 reportes, PDF y Excel", async () => {
    for (const name of [
      "sales",
      "monthly-consumption",
      "profit",
      "inventory-value",
      "kardex",
      "low-stock",
      "no-movement",
      "expiring",
      "abc",
      "expenses",
      "income-statement",
      "cash",
      "by-seller",
      "by-payment",
      "returns-discounts",
      "customers",
      "purchases",
    ])
      expect(Array.isArray((await ok("/reports/" + name)).rows)).toBe(true);
    for (const [path, magic] of [
      ["/sales/" + sale.id + "/receipt.pdf", "%PDF"],
      ["/reports/sales?format=pdf", "%PDF"],
      ["/reports/sales?format=xlsx", "PK"],
      ["/catalog-template.xlsx", "PK"],
    ]) {
      const r = await fetch(base + path, {
        headers: { Authorization: "Bearer " + token },
      });
      expect(r.ok).toBe(true);
      expect(
        Buffer.from(await r.arrayBuffer())
          .subarray(0, magic.length)
          .toString(),
      ).toBe(magic);
    }
  });
  it("calcula arqueo por método aunque se compensen diferencias", async () => {
    const s = (await ok("/cash-sessions")).find(
      (s: any) => s.id === session.id,
    );
    const r = await ok("/cash-sessions/" + s.id + "/close", {
      countedCash: s.expected.cash + 10,
      countedCard: s.expected.card - 10,
      countedTransfer: s.expected.transfer,
    });
    expect(Number(r.difference)).toBe(0);
    expect(r.differences.cash).toBe(10);
    expect(r.differences.card).toBe(-10);
    expect(
      (await request("/sales", input(clothing.variants[0].id, 118))).status,
    ).toBe(404);
  });
});

describe("Regresiones de Claude", () => {
  beforeAll(async () => {
    session = await ok("/cash-sessions/open", {
      registerId: "qa-regression-" + suffix,
      openingAmount: 500,
    });
  });
  it("1 y 2: diez PIN concurrentes bloquean solo al solicitante y contraseña no los reinicia", async () => {
    // SEC-03: el destino es una compañera del mismo rol; hacia la gerencia el
    // cambio por PIN ya se rechaza antes de comprobar el PIN.
    const target = await ok("/users", {
      name: "QA compañera " + suffix,
      email: `qa-companera-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: "987654",
      roleId: (await ok("/roles")).find((r: any) => r.name === "seller").id,
    });
    actors.push(target);
    await ok(
      "/auth/login",
      { email: target.email, password: "FitStore-QA-2026!" },
      "",
    );
    try {
      await Promise.all(
        Array.from({ length: 10 }, () =>
          request(
            "/auth/pin",
            { userId: target.id, pin: "000000" },
            sellerToken,
          ),
        ),
      );
      expect(
        (
          await request(
            "/auth/pin",
            { userId: target.id, pin: "987654" },
            sellerToken,
          )
        ).body.message,
      ).toMatch(/bloquead/i);
      expect(
        (
          await request(
            "/auth/login",
            { email: target.email, password: "FitStore-QA-2026!" },
            "",
          )
        ).status,
      ).toBe(201);
      expect((await request("/auth/me", undefined, sellerToken)).status).toBe(
        200,
      );
      expect(
        (
          await request(
            "/auth/pin",
            { userId: target.id, pin: "987654" },
            sellerToken,
          )
        ).body.message,
      ).toMatch(/bloquead/i);
    } finally {
      await fixtureDb.user.update({
        where: { id: target.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
    }
  });
  it("3: rechaza ajustes vencidos y acepta el día dominicano vigente", async () => {
    const r = await request("/inventory/adjustments", {
      variantId: supplement.variants[0].id,
      qty: 1,
      reason: "QA vencimiento",
      lotNumber: "QA-EXPIRED",
      expiryDate: "2000-01-01T12:00:00.000Z",
    });
    expect(r.status).toBe(400);
    expect(r.body.message).toMatch(/vencid/i);
  });
  it("4: stock sin lote convive con lotes; conteo no destruye la trazabilidad", async () => {
    const id = clothing.variants[0].id;
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 10,
      reason: "QA sin lote",
    });
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 1,
      reason: "QA con lote",
      lotNumber: "QA-OPTIONAL",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const p = await ok("/products/" + clothing.id);
    expect(p.variants[0].lots.some((l) => l.lotNumber === "QA-OPTIONAL")).toBe(
      true,
    );
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: 0 }],
    });
    expect(
      (await request("/inventory/counts/" + count.id + "/apply", {})).status,
    ).toBe(400);
    const sold = await ok("/sales", {
      ...input(id, 236),
      items: [{ variantId: id, qty: 2 }],
    });
    expect(Number(sold.total)).toBe(236);
  });
  it("5: gerente cierra caja ajena; diferencias compensadas persisten y se auditan", async () => {
    const c = (await ok("/cash-sessions", undefined, sellerToken)).find(
      (s) => s.id === sellerSession.id,
    );
    expect(c.expected).toBeUndefined();
    const expected = await expectedForCash(c.id);
    const r = await request("/cash-sessions/" + c.id + "/close", {
      countedCash: expected.cash - 10,
      countedCard: expected.card + 10,
      countedTransfer: expected.transfer,
      notes: "Diferencias compensadas verificadas en QA",
    });
    expect(r.status).toBe(201);
    const closed = (await ok("/cash-sessions")).find((s) => s.id === c.id);
    expect(Number(closed.differenceCash)).toBe(-10);
    expect(Number(closed.differenceCard)).toBe(10);
    expect(
      (await ok("/audit-log")).some(
        (a) => a.entityId === c.id && a.action === "close_difference",
      ),
    ).toBe(true);
  });
  it("6: producción rechaza secretos de ejemplo o repetidos antes de conectar", async () => {
    for (const secret of [
      "replace-with-a-random-secret-of-at-least-32-characters",
      "a".repeat(64),
      "0123456789abcdef".repeat(4),
    ]) {
      // Cada arranque tarda unos 2 s en Windows sin carga: 4 s de límite no
      // dejaban margen con el equipo ocupado.
      const c = await runNode(
        ["dist/main.js"],
        {
          ...process.env,
          NODE_ENV: "production",
          WEB_ORIGIN: "https://qa.example.test",
          JWT_SECRET: secret,
          DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/invalid",
        },
        20000,
      );
      expect(c.status).toBe(1);
      expect(c.stderr).toContain("JWT_SECRET");
      expect(c.stderr).not.toContain("Prisma");
    }
  }, 70000);
  it("7: conflicto offline devuelve español seguro", async () => {
    const r = await ok("/sales/sync", { sales: [input(randomUUID(), 118)] });
    expect(r.results[0].status).toBe("conflict");
    expect(r.results[0].message).not.toMatch(
      /Prisma|findFirst|Invocation|Record|\.ts:/i,
    );
    expect(r.results[0].message).toMatch(/registro|operación|existe/i);
  });
  it("8: pagos del reporte compras pertenecen al mismo rango", async () => {
    const r = await ok("/reports/purchases?from=2000-01-01&to=2000-01-02");
    expect(r.rows.every((row) => row.Pagado === 0 && row.Compras === 0)).toBe(
      true,
    );
  });
  it("9: consumo agrupa por mes dominicano al cruzar medianoche UTC", async () => {
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await fixtureDb.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date("2026-09-01T02:00:00Z") },
    });
    const r = await ok(
      "/reports/monthly-consumption?from=2026-08-31&to=2026-09-01",
    );
    expect(
      r.rows.some((row) => row.Mes_Producto === "2026-08 · " + clothing.name),
    ).toBe(true);
  });
  it("10: utilidad conserva costo de devolución sin reingreso", async () => {
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await ok("/returns", {
      saleId: s.id,
      cashSessionId: session.id,
      reason: "QA dañado",
      refundMethod: "cash",
      items: [
        { saleItemId: s.items[0].id, qty: 1, restock: false, damaged: true },
      ],
    });
    const r = await ok("/reports/profit");
    const lines = await fixtureDb.saleItem.findMany({
      where: {
        variantId: clothing.variants[0].id,
        sale: {
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
          status: "completed",
        },
      },
    });
    expect(r.rows.find((row) => row.Producto === clothing.name).Costo).toBe(
      lines.reduce((sum, l) => sum + Number(l.qty) * Number(l.unitCost), 0),
    );
  });
  it("11: reintentar venta aprobada no requiere de nuevo PIN", async () => {
    // La regresión 5 ya cerró la caja original de la vendedora. Esta prueba
    // abre una propia para no depender del orden ni reutilizar una caja cerrada.
    const retryCash = await ok(
      "/cash-sessions/open",
      { openingAmount: 0 },
      sellerToken,
    );
    const approved = {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: retryCash.id,
      items: [
        {
          variantId: clothing.variants[0].id,
          qty: 1,
          discountPercent: 25,
        },
      ],
      payments: [{ method: "cash", amount: 88.5 }],
      expectedTotal: 88.5,
      discountReason: "Descuento autorizado en pruebas",
    };
    try {
      expect(
        (
          await request(
            "/sales",
            { ...approved, managerPin: "987654" },
            sellerToken,
          )
        ).status,
      ).toBe(201);
      expect((await request("/sales", approved, sellerToken)).status).toBe(201);
    } finally {
      const expected = await expectedForCash(retryCash.id);
      await ok(
        "/cash-sessions/" + retryCash.id + "/close",
        {
          countedCash: expected.cash,
          countedCard: expected.card,
          countedTransfer: expected.transfer,
        },
        sellerToken,
      );
    }
  });
  it("12: índice parcial impide apertura concurrente de terminal", async () => {
    const manager = actors.find((u) => u.email.includes("qa-manager"));
    const auth = await ok(
      "/auth/login",
      { email: manager.email, password: "FitStore-QA-2026!" },
      "",
    );
    // Con equipos, la caja usa el equipo de la sesión: dos usuarios en el
    // mismo equipo no pueden tener cajas abiertas a la vez.
    await registerTerminal(
      auth.accessToken,
      session.registerId,
      "QA compartido",
    );
    expect(
      (
        await request(
          "/cash-sessions/open",
          { registerId: session.registerId, openingAmount: 0 },
          auth.accessToken,
        )
      ).status,
    ).toBeGreaterThanOrEqual(400);
    expect(
      await fixtureDb.cashSession.count({
        where: { registerId: session.registerId, closedAt: null },
      }),
    ).toBe(1);
  });
  it("aperturas simultáneas en el mismo equipo devuelven un conflicto claro", async () => {
    const sellerRole = (await ok("/roles")).find(
      (role: any) => role.name === "seller",
    );
    const temporaryUsers = await Promise.all(
      ["A", "B"].map(async (suffixLetter) => {
        const user = await ok("/users", {
          name: `QA caja simultánea ${suffixLetter} ${suffix}`,
          email: `qa-cash-race-${suffixLetter}-${suffix}@example.test`,
          password: "FitStore-QA-2026!",
          pin: "876543",
          roleId: sellerRole.id,
        });
        actors.push(user);
        const auth = await ok(
          "/auth/login",
          { email: user.email, password: "FitStore-QA-2026!" },
          "",
        );
        return { user, token: auth.accessToken };
      }),
    );
    const registerId = randomUUID();
    await Promise.all(
      temporaryUsers.map(({ token: userToken }) =>
        registerTerminal(userToken, registerId, "QA apertura simultánea"),
      ),
    );

    const results = await Promise.all(
      temporaryUsers.map(({ token: userToken }, index) =>
        request(
          "/cash-sessions/open",
          { openingAmount: 100 + index },
          userToken,
        ),
      ),
    );
    const created = results.filter((result) => result.status === 201);
    const rejected = results.filter((result) => result.status >= 400);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].status).toBe(409);
    expect(rejected[0].body.message).toContain(
      "Este equipo ya tiene otra caja abierta.",
    );
    expect(JSON.stringify(rejected[0].body)).not.toMatch(/Prisma|P2002/i);
    await ok(
      "/cash-sessions/" + created[0].body.id + "/close",
      {
        countedCash: Number(created[0].body.openingAmount),
        countedCard: 0,
        countedTransfer: 0,
      },
      temporaryUsers.find((entry) => entry.user.id === created[0].body.userId)!
        .token,
    );
  });
  it("reintentar abrir la caja devuelve la sesión existente", async () => {
    const repeated = await ok(
      "/cash-sessions/open",
      { registerId: session.registerId, openingAmount: 999 },
      token,
    );
    expect(repeated.id).toBe(session.id);
    expect(Number(repeated.openingAmount)).not.toBe(999);
    expect(
      await fixtureDb.cashSession.count({
        where: { userId: repeated.userId, closedAt: null },
      }),
    ).toBe(1);
  });
});
afterAll(async () => {
  await fixtureDb.$disconnect();
});

describe("Seguridad, offline y funciones completadas", () => {
  async function loginRaw(user: any, password = "FitStore-QA-2026!") {
    const credentials = prepareTestPayload("/auth/login", {
      email: user.email,
      password,
    });
    return fetch(base + "/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": authIp,
      },
      body: JSON.stringify(credentials),
    });
  }
  async function newUser(role = "seller") {
    const roles = await ok("/roles");
    const user = await ok("/users", {
      name: "QA extensión",
      email: randomUUID() + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "876543",
      roleId: roles.find((r) => r.name === role).id,
    });
    actors.push(user);
    // Activa la contraseña temporal una sola vez. Las pruebas posteriores usan
    // loginRaw, que resuelve la contraseña activa mediante qaPasswords.
    await ok(
      "/auth/login",
      { email: user.email, password: "FitStore-QA-2026!" },
      "",
    );
    return user;
  }
  it("1: contraseñas concurrentes incrementan atómicamente y bloquean tras cinco", async () => {
    const u = await newUser();
    await Promise.all(
      Array.from({ length: 10 }, () => loginRaw(u, "incorrecta")),
    );
    const r = await loginRaw(u);
    expect(r.status).toBe(400);
    expect((await r.json()).message).toMatch(/bloquead/i);
    // El contador es por cuenta y dirección IP, ya no global en User
    // (R9-seguridad-1).
    const stored = await fixtureDb.authAttempt.findMany({
      where: { key: { startsWith: "login:" + u.id + ":" } },
    });
    expect(stored.map((a: any) => a.failedAttempts)).toEqual([5]);
  });
  it("1–2: PIN de gerente tiene contador propio sin cerrar sesión del vendedor", async () => {
    // Usa sesión propia: el objetivo es medir exclusivamente el contador de
    // PIN, no heredar el límite HTTP acumulado por sellerToken en otros casos.
    const pinSeller = await newUser("seller");
    const pinAuth = await loginRaw(pinSeller);
    expect(pinAuth.status).toBe(201);
    const pinSellerToken = (await pinAuth.json()).accessToken as string;
    await enroll(pinSellerToken, "QA vendedor contador PIN");
    const pinSession = await ok(
      "/cash-sessions/open",
      { registerId: "qa-approval-" + suffix, openingAmount: 0 },
      pinSellerToken,
    );
    const payload = () => ({
      ...input(clothing.variants[0].id, 88.5, pinSession),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountPercent: 25 },
      ],
      managerPin: "000000",
    });
    try {
      const errors = await Promise.all(
        Array.from({ length: 10 }, () =>
          request("/sales", payload(), pinSellerToken),
        ),
      );
      expect(
        errors.map((r) => ({ status: r.status, message: r.body?.message })),
      ).toEqual(
        Array.from({ length: 10 }, () => ({
          status: 400,
          message: expect.stringMatching(/PIN (incorrecto|bloqueado)/i),
        })),
      );
      const attempt = await fixtureDb.authAttempt.findUniqueOrThrow({
        where: { key: "approval:" + pinSeller.id },
      });
      expect(attempt.failedAttempts).toBe(5);
      expect(attempt.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
      const blocked = await request(
        "/sales",
        { ...payload(), managerPin: "987654" },
        pinSellerToken,
      );
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toMatch(/bloquead/i);
      expect(
        (await request("/auth/me", undefined, pinSellerToken)).status,
      ).toBe(200);
    } finally {
      await request(
        "/cash-sessions/" + pinSession.id + "/close",
        { countedCash: 0, countedCard: 0, countedTransfer: 0 },
        pinSellerToken,
      );
      await fixtureDb.authAttempt.deleteMany({
        where: { key: "approval:" + pinSeller.id },
      });
    }
  });
  it("1: limita ventas por sesión aunque cambie la IP y no bloquea otra sesión", async () => {
    const login = async () => {
      const response = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "admin@fitstore.demo",
          password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
        }),
      });
      return (await response.json()).accessToken as string;
    };
    const limitedToken = await login();
    await enroll(limitedToken, "QA límite sesión A");
    const send = (ip: string, as = limitedToken) =>
      fetch(base + "/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + as,
          "X-Forwarded-For": ip,
        },
        body: "{}",
      });
    const results = [];
    for (let n = 0; n < 121; n++) results.push((await send(rateIp)).status);
    expect(results.slice(0, 120).every((n) => n === 400)).toBe(true);
    expect(results[120]).toBe(429);
    expect((await send("198.18.0.10")).status).toBe(429);
    const otherToken = await login();
    await enroll(otherToken, "QA límite sesión B");
    expect((await send("198.18.0.10", otherToken)).status).toBe(400);
  });
  it("3 y 9: lote vencido según Santo Domingo no se vende ni se recibe", async () => {
    const p = await ok("/products", {
      name: "QA vencimiento SD " + suffix,
      sku: "QA-SD-" + suffix,
      categoryId: supplement.categoryId,
      variants: [
        {
          sku: "QA-SDV-" + suffix,
          barcode: "QA-SDB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: 1,
      reason: "QA vencimiento",
      lotNumber: "QA-BOUNDARY",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const day = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    await fixtureDb.lot.updateMany({
      where: { variantId: p.variants[0].id },
      data: { expiryDate: new Date(day + "T02:00:00Z") },
    });
    expect((await request("/sales", input(p.variants[0].id, 118))).status).toBe(
      400,
    );
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: p.variants[0].id, qty: 1, unitCost: 10 }],
    });
    expect(
      (
        await request("/purchase-orders/" + order.id + "/receive", {
          operationId: randomUUID(),
          items: [
            {
              itemId: order.items[0].id,
              qty: 1,
              lotNumber: "QA-EXPIRED",
              expiryDate: "2000-01-01T12:00:00.000Z",
            },
          ],
        })
      ).status,
    ).toBe(400);
  });
  it("4: diez unidades sin lote más una con lote permiten vender dos", async () => {
    const id = clothing.variants[0].id;
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: 10 }],
    });
    await ok("/inventory/counts/" + count.id + "/apply", {});
    await ok("/inventory/adjustments", {
      variantId: id,
      qty: 1,
      reason: "QA lote opcional",
      lotNumber: "QA-MIXED",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const sold = await ok("/sales", {
      ...input(id, 236),
      items: [{ variantId: id, qty: 2 }],
    });
    expect(Number(sold.total)).toBe(236);
    expect(
      Number((await ok("/products/" + clothing.id)).variants[0].stock),
    ).toBe(9);
  });
  it("7: sincroniza en caja cerrada dentro de su horario y audita el reajuste", async () => {
    const cash = (await ok("/cash-sessions")).find((c) => c.id === session.id);
    const capturedAt = new Date().toISOString();
    const payload = { ...input(clothing.variants[0].id, 118), capturedAt };
    await ok("/cash-sessions/" + cash.id + "/close", {
      countedCash: cash.expected.cash,
      countedCard: cash.expected.card,
      countedTransfer: cash.expected.transfer,
    });
    expect((await request("/sales", payload)).status).toBe(404);
    const synced = await ok("/sales/sync", { sales: [payload] });
    expect(synced.results[0].status).toBe("synced");
    const adjusted = (await ok("/cash-sessions")).find((c) => c.id === cash.id);
    expect(Number(adjusted.differenceCash)).toBe(-118);
    expect(
      (await ok("/audit-log")).some(
        (a) => a.action === "offline_after_close" && a.entityId === cash.id,
      ),
    ).toBe(true);
    const outside = await ok("/sales/sync", {
      sales: [
        {
          ...payload,
          offlineUuid: randomUUID(),
          capturedAt: new Date(
            +new Date(adjusted.closedAt) + 1000,
          ).toISOString(),
        },
      ],
    });
    expect(outside.results[0].status).toBe("conflict");
    session = await ok("/cash-sessions/open", {
      registerId: "qa-extra-" + suffix,
      openingAmount: 500,
    });
  });
  it("8: pago actual no se resta en reporte de otro período", async () => {
    const payment = await fixtureDb.supplierPayment.create({
      data: {
        supplierId,
        amount: 123,
        method: "cash",
        createdBy: "QA temporal",
        branchId: "main",
      },
    });
    try {
      const r = await ok("/reports/purchases?from=2000-01-01&to=2000-01-02");
      expect(r.rows.every((row) => row.Pagado === 0)).toBe(true);
    } finally {
      await fixtureDb.supplierPayment.delete({ where: { id: payment.id } });
    }
  });
  it("descuento por monto recalcula impuesto y queda auditado", async () => {
    const s = await ok("/sales", {
      ...input(clothing.variants[0].id, 100),
      items: [
        { variantId: clothing.variants[0].id, qty: 1, discountAmount: 18 },
      ],
    });
    expect(Number(s.total)).toBe(100);
    expect(Number(s.discountTotal)).toBe(18);
    expect(Number(s.taxTotal)).toBe(15.25);
    expect(s.discountReason).toBe("Descuento autorizado en pruebas");
    expect(s.discountRule).toBe("administrator");
    expect(s.discountApprovedBy).toBeTruthy();
    expect(s.discountApprovedName).toBeTruthy();
    const discountAudit = (await ok("/audit-log")).find(
      (a) => a.action === "discount_approved" && a.entityId === s.id,
    );
    expect(discountAudit?.after.reason).toBe("Descuento autorizado en pruebas");
    expect(discountAudit?.after.authorizer?.name).toBeTruthy();
    expect(
      (
        await request("/sales", {
          ...input(clothing.variants[0].id, 0),
          items: [
            { variantId: clothing.variants[0].id, qty: 1, discountAmount: 119 },
          ],
        })
      ).status,
    ).toBe(400);
  });
  it("nota de crédito se consume una sola vez con saldo protegido", async () => {
    const customer = await ok("/customers", { name: "QA notas " + suffix });
    const sold = await ok("/sales", {
      ...input(clothing.variants[0].id, 118),
      customerId: customer.id,
    });
    const returned = await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA nota",
      refundMethod: "credit_note",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
    });
    const note = (await ok("/credit-notes")).find(
      (n) => n.returnId === returned.id,
    );
    const payment = {
      method: "credit_note",
      amount: 118,
      creditNoteId: note.id,
    };
    const payload = {
      ...input(clothing.variants[0].id, 118),
      customerId: customer.id,
      payments: [payment],
      managerPin: "987654",
    };
    const [a, b] = await Promise.all([
      ok("/sales", payload),
      ok("/sales", payload),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      Number(
        (await fixtureDb.creditNote.findUnique({ where: { id: note.id } }))
          .balance,
      ),
    ).toBe(0);
    expect(
      (await request("/sales", { ...payload, offlineUuid: randomUUID() }))
        .status,
    ).toBe(400);
    await ok("/sales/" + a.id + "/void", {
      reason: "QA restaurar nota",
      cashSessionId: session.id,
    });
    expect(
      Number(
        (await fixtureDb.creditNote.findUnique({ where: { id: note.id } }))
          .balance,
      ),
    ).toBe(118);
  });
  it("venta a crédito admite abonos idempotentes en caja posterior", async () => {
    const settings = await ok("/settings");
    await ok(
      "/settings",
      { ...settings, allowCreditSales: true },
      token,
      "PUT",
    );
    try {
      const customer = await ok("/customers", {
        name: "QA crédito " + suffix,
        creditLimit: 500,
      });
      const sold = await ok("/sales", {
        ...input(clothing.variants[0].id, 118),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      });
      expect(Number(sold.creditBalance)).toBe(118);
      const before = (await ok("/cash-sessions")).find(
        (c) => c.id === session.id,
      ).expected.cash;
      const payload = {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        method: "cash",
        amount: 50,
      };
      const [a, b] = await Promise.all([
        ok("/sales/" + sold.id + "/installments", payload),
        ok("/sales/" + sold.id + "/installments", payload),
      ]);
      expect(a.id).toBe(b.id);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(68);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .cash,
      ).toBe(before + 50);
      expect(
        (
          await request("/sales/" + sold.id + "/installments", {
            ...payload,
            offlineUuid: randomUUID(),
            amount: 69,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await request("/sales/" + sold.id + "/void", {
            cashSessionId: session.id,
            reason: "QA abonos",
          })
        ).status,
      ).toBe(400);
      const returned = await ok("/returns", {
        saleId: sold.id,
        cashSessionId: session.id,
        reason: "QA devolución crédito",
        refundMethod: "cash",
        items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
      });
      expect(Number(returned.refundAmount)).toBe(50);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(0);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("cambiar PIN o contraseña revoca refresh y acceso anteriores", async () => {
    for (const change of [
      { pin: "123456" },
      { password: "FitStore-New-QA-2026!" },
    ]) {
      const u = await newUser();
      const r = await loginRaw(u);
      const logged = await r.json();
      const cookie = r.headers.get("set-cookie")!.split(";")[0];
      await ok("/users/" + u.id, change, token, "PATCH");
      expect(
        (await request("/auth/me", undefined, logged.accessToken)).status,
      ).toBe(401);
      const refreshed = await fetch(base + "/auth/refresh", {
        method: "POST",
        headers: { Cookie: cookie, "X-Forwarded-For": authIp },
      });
      expect(refreshed.status).toBe(400);
      expect(
        await fixtureDb.refreshToken.count({ where: { userId: u.id } }),
      ).toBe(0);
    }
  });
  it("sessionTimeoutMinutes se aplica en API y respuesta de sesión", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, sessionTimeoutMinutes: 1 },
        token,
        "PUT",
      );
      const u = await newUser();
      const r = await loginRaw(u);
      const logged = await r.json();
      expect(logged.user.sessionTimeoutMinutes).toBe(1);
      await fixtureDb.authSession.updateMany({
        where: { userId: u.id },
        data: { lastActivityAt: new Date(Date.now() - 61000) },
      });
      expect(
        (await request("/auth/me", undefined, logged.accessToken)).status,
      ).toBe(401);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("stock negativo optativo conserva advertencia y prohíbe saltarse lotes", async () => {
    const settings = await ok("/settings");
    try {
      const p = await ok("/products", {
        name: "QA negativo " + suffix,
        sku: "QA-N-" + suffix,
        categoryId: clothing.categoryId,
        variants: [
          {
            sku: "QA-NV-" + suffix,
            barcode: "QA-NB-" + suffix,
            costAvg: 10,
            price: 118,
          },
        ],
      });
      products.push(p);
      expect(
        (await request("/sales", input(p.variants[0].id, 118))).status,
      ).toBe(400);
      await ok(
        "/settings",
        { ...settings, allowNegativeStock: true },
        token,
        "PUT",
      );
      await ok("/sales", input(p.variants[0].id, 118));
      expect(Number((await ok("/products/" + p.id)).variants[0].stock)).toBe(
        -1,
      );
      expect(
        (await ok("/alerts")).some(
          (a) => a.type === "negative_stock" && a.entityId === p.variants[0].id,
        ),
      ).toBe(true);
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: 1,
        reason: "QA conciliar stock",
      });
      expect(
        (
          await request("/sales", {
            ...input(supplement.variants[0].id, 236000),
            items: [{ variantId: supplement.variants[0].id, qty: 1000 }],
          })
        ).status,
      ).toBe(400);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("alerta efectivo aunque tarjeta lo compense", async () => {
    const settings = await ok("/settings");
    let alertCash: any;
    let alertToken = "";
    try {
      await ok(
        "/settings",
        { ...settings, cashDifferenceLimit: 1 },
        token,
        "PUT",
      );
      const alertSeller = await newUser("seller");
      const alertAuth = await loginRaw(alertSeller);
      expect(alertAuth.status).toBe(201);
      alertToken = (await alertAuth.json()).accessToken as string;
      await enroll(alertToken, "QA alerta diferencia efectivo");
      alertCash = await ok(
        "/cash-sessions/open",
        { registerId: "qa-cash-alert-" + suffix, openingAmount: 100 },
        alertToken,
      );
      const expected = await expectedForCash(alertCash.id);
      const closed = await ok(
        "/cash-sessions/" + alertCash.id + "/close",
        {
          countedCash: expected.cash - 10,
          countedCard: expected.card + 10,
          countedTransfer: expected.transfer,
          notes: "Diferencia de prueba explicada",
        },
        alertToken,
      );
      expect(closed).not.toHaveProperty("differenceCash");
      expect(closed).not.toHaveProperty("expectedCash");
      const stored = await fixtureDb.cashSession.findUniqueOrThrow({
        where: { id: alertCash.id },
      });
      expect(Number(stored.differenceCash)).toBe(-10);
      expect(Number(stored.differenceCard)).toBe(10);
      expect(Number(stored.difference)).toBe(0);
      const alert = await fixtureDb.alert.findUniqueOrThrow({
        where: { key: "cash:" + alertCash.id },
      });
      expect(alert).toMatchObject({
        type: "cash_difference",
        severity: "high",
        entityId: alertCash.id,
        status: "new",
      });
    } finally {
      if (alertCash?.id && alertToken) {
        const stored = await fixtureDb.cashSession.findUnique({
          where: { id: alertCash.id },
        });
        if (stored && !stored.closedAt)
          await request(
            "/cash-sessions/" + alertCash.id + "/close",
            { countedCash: 100, countedCard: 0, countedTransfer: 0 },
            alertToken,
          );
      }
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("NCF preparado conserva solicitud sin emitir un comprobante fiscal", async () => {
    const settings = await ok("/settings");
    try {
      await ok("/settings", { ...settings, ncfMode: "prepared" }, token, "PUT");
      expect(
        (
          await request("/sales", {
            ...input(clothing.variants[0].id, 118),
            ncfType: "B01",
          })
        ).status,
      ).toBe(400);
      const sold = await ok("/sales", {
        ...input(clothing.variants[0].id, 118),
        ncfType: "B01",
        recipientLegalId: "123456789",
      });
      expect(sold.ncfType).toBe("B01");
      expect(sold.ncf).toBeNull();
      expect(sold.fiscalStatus).toBe("not_issued");
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("dashboard incluye mapa dominicano y comparación del año anterior", async () => {
    const before = await ok("/dashboard/summary?from=2026-08-31&to=2026-09-01");
    const s = await ok("/sales", input(clothing.variants[0].id, 118));
    await fixtureDb.sale.update({
      where: { id: s.id },
      data: { createdAt: new Date("2025-08-31T22:00:00Z") },
    });
    const r = await ok("/dashboard/summary?from=2026-08-31&to=2026-09-01");
    expect(r.previousYearRevenue).toBe(before.previousYearRevenue + 118);
    expect(r.yearOverYear).not.toBeNull();
    expect(r.peakHours.some((row) => row.day === 1 && row.hour === 22)).toBe(
      true,
    );
    expect(r.daily.some((row) => row.day === "2026-08-31")).toBe(true);
  });
});

describe("Alertas de negocio y consistencia contable", () => {
  it("baja venta compara mes anterior con promedio de tres meses y cuenta descuentos diarios", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        {
          ...settings,
          lowSalesDropPercent: 50,
          unusualDiscountCount: 1,
          unusualDiscountPercent: 25,
        },
        token,
        "PUT",
      );
      const p = await ok("/products", {
        name: "QA alertas " + suffix,
        sku: "QA-A-" + suffix,
        categoryId: clothing.categoryId,
        variants: [
          {
            sku: "QA-AV-" + suffix,
            barcode: "QA-AB-" + suffix,
            costAvg: 10,
            price: 118,
          },
        ],
      });
      products.push(p);
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: 3,
        reason: "QA historial alertas",
      });
      const historical = await ok("/sales", input(p.variants[0].id, 118));
      const month = new Date(
        new Date()
          .toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
          .slice(0, 8) + "01T12:00:00-04:00",
      );
      month.setUTCMonth(month.getUTCMonth() - 2);
      await fixtureDb.sale.update({
        where: { id: historical.id },
        data: { createdAt: month },
      });
      const discounted = await ok("/sales", {
        ...input(p.variants[0].id, 88.5),
        items: [{ variantId: p.variants[0].id, qty: 1, discountPercent: 25 }],
      });
      const alerts = await ok("/alerts");
      expect(
        alerts.some(
          (a) => a.type === "low_sales" && a.entityId === p.variants[0].id,
        ),
      ).toBe(true);
      expect(
        alerts.some(
          (a) => a.type === "unusual_discount" && a.entityId === discounted.id,
        ),
      ).toBe(true);
      expect(
        alerts.some(
          (a) => a.type === "unusual_discount" && a.entityId === actors[0].id,
        ),
      ).toBe(true);
      expect(
        (await ok("/promotions/clearance-candidates")).some(
          (c) => c.variantId === p.variants[0].id && c.lowSales,
        ),
      ).toBe(true);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("devolución del período resta costo solo cuando reingresa y cuadra con dashboard", async () => {
    const sold = await ok("/sales", input(clothing.variants[0].id, 118));
    const yesterday = new Date(Date.now() - 86400000);
    await fixtureDb.sale.update({
      where: { id: sold.id },
      data: { createdAt: yesterday },
    });
    await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA costo de período",
      refundMethod: "cash",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: false }],
    });
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    const range = "?from=" + today + "&to=" + today;
    const dashboard = await ok("/dashboard/summary" + range);
    const report = await ok("/reports/profit" + range);
    expect(
      Math.abs(
        report.rows.reduce((sum, r) => sum + r.Costo, 0) - dashboard.costTotal,
      ),
    ).toBeLessThanOrEqual(0.02);
    expect(
      Math.abs(
        report.rows.reduce((sum, r) => sum + r.Utilidad, 0) -
          dashboard.grossProfit,
      ),
    ).toBeLessThanOrEqual(0.02);
  });
});

describe("Ronda 2 de Claude", () => {
  let variant: any, caller: any, callerToken: string, callerCash: any;
  beforeAll(async () => {
    variant = await ok("/products", {
      name: "QA ronda 2 " + suffix,
      sku: "QA-R2-" + suffix,
      categoryId: clothing.categoryId,
      variants: [
        {
          sku: "QA-R2V-" + suffix,
          barcode: "QA-R2B-" + suffix,
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(variant);
    await ok("/inventory/adjustments", {
      variantId: variant.variants[0].id,
      qty: 20,
      reason: "QA ronda 2",
    });
    const roles = await ok("/roles");
    caller = await ok("/users", {
      name: "QA R2 vendedor",
      email: randomUUID() + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "876543",
      roleId: roles.find((r) => r.name === "seller").id,
    });
    actors.push(caller);
    callerToken = (
      await ok(
        "/auth/login",
        { email: caller.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    await enroll(callerToken, "QA R2");
    callerCash = await ok(
      "/cash-sessions/open",
      { registerId: "qa-r2-" + suffix, openingAmount: 0 },
      callerToken,
    );
  });
  afterAll(async () => {
    if (callerCash) {
      const c = (await ok("/cash-sessions", undefined, callerToken)).find(
        (c) => c.id === callerCash.id,
      );
      if (!c.closedAt) {
        const expected = await expectedForCash(c.id);
        await ok(
          "/cash-sessions/" + c.id + "/close",
          {
            countedCash: expected.cash,
            countedCard: expected.card,
            countedTransfer: expected.transfer,
          },
          callerToken,
        );
      }
    }
  });
  const payload = (s = session) => input(variant.variants[0].id, 118, s);
  it("la API aplica la política offline y recalcula un precio manipulado", async () => {
    const settings = await ok("/settings");
    const offlineUuid = randomUUID();
    const stockBefore = Number(
      (
        await fixtureDb.variant.findUniqueOrThrow({
          where: { id: variant.variants[0].id },
        })
      ).stock,
    );
    const protectedCounts = async () => ({
      sales: await fixtureDb.sale.count({ where: { offlineUuid } }),
      payments: await fixtureDb.payment.count({
        where: { sale: { offlineUuid } },
      }),
      movements: await fixtureDb.inventoryMovement.count({
        where: { variantId: variant.variants[0].id },
      }),
      counter: (
        await fixtureDb.counter.findUnique({ where: { key: "sale:main" } })
      )?.value,
    });
    const countsBefore = await protectedCounts();
    const forged = {
      ...payload(),
      offlineUuid,
      capturedAt: new Date().toISOString(),
      items: [
        {
          variantId: variant.variants[0].id,
          qty: 1,
          discountPercent: 0,
          unitPrice: 0,
        },
      ],
    };
    try {
      await ok(
        "/settings",
        { ...settings, allowOfflineSales: false },
        token,
        "PUT",
      );
      const blocked = await ok("/sales/sync", { sales: [forged] });
      expect(blocked.results[0].status).toBe("conflict");
      expect(blocked.results[0].message).toMatch(/desactivadas/);
      expect(
        await fixtureDb.sale.findUnique({ where: { offlineUuid } }),
      ).toBeNull();
      expect(await protectedCounts()).toEqual(countsBefore);
      expect(
        Number(
          (
            await fixtureDb.variant.findUniqueOrThrow({
              where: { id: variant.variants[0].id },
            })
          ).stock,
        ),
      ).toBe(stockBefore);
      await fixtureDb.alert.update({
        where: { key: "offline:" + offlineUuid },
        data: { status: "seen" },
      });

      await ok(
        "/settings",
        { ...settings, allowOfflineSales: true },
        token,
        "PUT",
      );
      const accepted = await ok("/sales/sync", { sales: [forged] });
      expect(accepted.results[0].status).toBe("synced");
      const stored = await fixtureDb.sale.findUniqueOrThrow({
        where: { offlineUuid },
        include: { items: true },
      });
      expect(Number(stored.items[0].unitPrice)).toBe(118);
      expect(Number(stored.total)).toBe(118);
      expect(
        (
          await fixtureDb.alert.findUniqueOrThrow({
            where: { key: "offline:" + offlineUuid },
          })
        ).status,
      ).toBe("resolved");
      expect(
        Number(
          (
            await fixtureDb.variant.findUniqueOrThrow({
              where: { id: variant.variants[0].id },
            })
          ).stock,
        ),
      ).toBe(stockBefore - 1);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  async function note(customerId?: string) {
    const sold = await ok("/sales", {
      ...payload(),
      ...(customerId ? { customerId } : {}),
    });
    const returned = await ok("/returns", {
      saleId: sold.id,
      cashSessionId: session.id,
      reason: "QA código nota",
      refundMethod: "credit_note",
      items: [{ saleItemId: sold.items[0].id, qty: 1, restock: true }],
    });
    return (await ok("/credit-notes")).find((n) => n.returnId === returned.id);
  }
  it("1: notas requieren prueba de posesión o gerente, no se divulgan códigos y cada uso se audita", async () => {
    const customer = await ok("/customers", { name: "QA nota R2 " + suffix });
    const named = await note(customer.id);
    expect(await ok("/credit-notes", undefined, callerToken)).toEqual([]);
    const selected = await ok(
      "/credit-notes?customerId=" + customer.id,
      undefined,
      callerToken,
    );
    expect(selected.some((n) => n.id === named.id)).toBe(true);
    expect(JSON.stringify(selected)).not.toContain(named.redemptionCode);
    const pay = {
      ...payload(callerCash),
      customerId: customer.id,
      payments: [
        { method: "credit_note", amount: 118, creditNoteId: named.id },
      ],
    };
    expect((await request("/sales", pay, callerToken)).status).toBe(400);
    expect(
      (
        await request(
          "/sales",
          {
            ...pay,
            payments: [{ ...pay.payments[0], creditNoteCode: "0".repeat(32) }],
          },
          callerToken,
        )
      ).status,
    ).toBe(400);
    const sold = await ok(
      "/sales",
      {
        ...pay,
        payments: [
          { ...pay.payments[0], creditNoteCode: named.redemptionCode },
        ],
      },
      callerToken,
    );
    expect(
      (await ok("/audit-log")).some(
        (a) =>
          a.action === "credit_note_used" &&
          a.entityId === named.id &&
          a.after.saleId === sold.id,
      ),
    ).toBe(true);
    const approved = await note(customer.id);
    await ok(
      "/sales",
      {
        ...pay,
        offlineUuid: randomUUID(),
        managerPin: "987654",
        payments: [
          { method: "credit_note", amount: 118, creditNoteId: approved.id },
        ],
      },
      callerToken,
    );
    const codeProtectedNote = await note(customer.id);
    // Datos heredados podían contener notas sin cliente. Recreamos ese estado
    // de forma explícita sin permitir crear hoy una venta anónima.
    await fixtureDb.creditNote.update({
      where: { id: codeProtectedNote.id },
      data: { customerId: null },
    });
    const legacyPay = {
      ...pay,
      payments: [
        {
          ...pay.payments[0],
          creditNoteId: codeProtectedNote.id,
        },
      ],
    };
    expect(
      (
        await request(
          "/sales",
          { ...legacyPay, offlineUuid: randomUUID() },
          callerToken,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await ok(
          "/credit-notes?customerId=" + customer.id,
          undefined,
          callerToken,
        )
      ).some((n) => n.id === codeProtectedNote.id),
    ).toBe(false);
    const found = await ok(
      "/credit-notes?code=" + codeProtectedNote.redemptionCode,
      undefined,
      callerToken,
    );
    expect(found.map((n) => n.id)).toEqual([codeProtectedNote.id]);
    await ok(
      "/sales",
      {
        ...legacyPay,
        offlineUuid: randomUUID(),
        payments: [
          {
            ...legacyPay.payments[0],
            creditNoteId: codeProtectedNote.id,
            creditNoteCode: codeProtectedNote.redemptionCode,
          },
        ],
      },
      callerToken,
    );
    const pdf = await fetch(
      base + "/returns/" + codeProtectedNote.returnId + "/credit-note.pdf",
      { headers: { Authorization: "Bearer " + token } },
    );
    expect(pdf.ok).toBe(true);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString(),
    ).toBe("%PDF");
  });
  it("2: límite del cliente atómico y PIN por umbral, sólo gerente puede cambiar el límite", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, allowCreditSales: true, creditApprovalThreshold: 50 },
        token,
        "PUT",
      );
      const customer = await ok("/customers", {
        name: "QA límite R2 " + suffix,
        creditLimit: 236,
      });
      expect(
        (
          await request(
            "/customers/" + customer.id,
            { creditLimit: 9999 },
            callerToken,
            "PATCH",
          )
        ).status,
      ).toBe(400);
      const credit = {
        ...payload(callerCash),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      };
      expect((await request("/sales", credit, callerToken)).status).toBe(400);
      const first = await ok(
        "/sales",
        { ...credit, managerPin: "987654" },
        callerToken,
      );
      expect(
        (await ok("/audit-log")).some(
          (a) => a.action === "credit_approved" && a.entityId === first.id,
        ),
      ).toBe(true);
      const [a, b] = await Promise.all([
        request("/sales", {
          ...credit,
          cashSessionId: session.id,
          managerPin: "987654",
          offlineUuid: randomUUID(),
        }),
        request("/sales", {
          ...credit,
          cashSessionId: session.id,
          managerPin: "987654",
          offlineUuid: randomUUID(),
        }),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 400]);
      const total = await fixtureDb.sale.aggregate({
        where: { customerId: customer.id, status: "completed" },
        _sum: { creditBalance: true },
      });
      expect(Number(total._sum.creditBalance)).toBe(236);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("3: transferencia pendiente no reduce deuda ni caja; verificación concurrente aplica una sola vez", async () => {
    const settings = await ok("/settings");
    try {
      await ok(
        "/settings",
        { ...settings, allowCreditSales: true },
        token,
        "PUT",
      );
      const customer = await ok("/customers", {
        name: "QA abono R2 " + suffix,
        creditLimit: 500,
      });
      const sold = await ok("/sales", {
        ...payload(),
        customerId: customer.id,
        creditDueDate: "2030-01-01T12:00:00.000Z",
        payments: [{ method: "credit", amount: 118 }],
      });
      const expected = (await ok("/cash-sessions")).find(
        (c) => c.id === session.id,
      ).expected.transfer;
      const pending = await ok("/sales/" + sold.id + "/installments", {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        method: "transfer",
        amount: 50,
        bank: "QA banco",
        reference: "QA-R2",
      });
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(118);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .transfer,
      ).toBe(expected);
      expect(
        (
          await request("/sales/" + sold.id + "/installments", {
            offlineUuid: randomUUID(),
            cashSessionId: session.id,
            method: "cash",
            amount: 69,
          })
        ).status,
      ).toBe(400);
      await Promise.all([
        ok("/payments/" + pending.id + "/verify", {}),
        ok("/payments/" + pending.id + "/verify", {}),
      ]);
      expect(
        Number(
          (await fixtureDb.sale.findUnique({ where: { id: sold.id } }))
            .creditBalance,
        ),
      ).toBe(68);
      expect(
        (await ok("/cash-sessions")).find((c) => c.id === session.id).expected
          .transfer,
      ).toBe(expected + 50);
      expect(
        await fixtureDb.auditLog.count({
          where: { entityId: pending.id, action: "verify" },
        }),
      ).toBe(1);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
  it("4: offline máximo 48 horas y fecha anterior auditada", async () => {
    const old = await fixtureDb.cashSession.create({
      data: {
        registerId: "qa-old-" + suffix,
        userId: actors[0].id,
        branchId: "main",
        openingAmount: 0,
        openedAt: new Date(Date.now() - 72 * 3600000),
        closedAt: new Date(Date.now() - 70 * 3600000),
      },
    });
    const rejected = await ok("/sales/sync", {
      sales: [
        {
          ...payload(old),
          capturedAt: new Date(Date.now() - 71 * 3600000).toISOString(),
        },
      ],
    });
    expect(rejected.results[0].status).toBe("conflict");
    expect(rejected.results[0].message).toMatch(/48 horas/);
    const accepted = await ok("/sales/sync", {
      sales: [
        { ...payload(), capturedAt: new Date(Date.now() - 1000).toISOString() },
      ],
    });
    expect(accepted.results[0].status).toBe("synced");
    expect(
      (await ok("/audit-log")).some(
        (a) =>
          a.action === "offline_backdated" &&
          a.entityId === accepted.results[0].sale.id,
      ),
    ).toBe(true);
  });
  it("5: Compose sólo publica nginx y descarta IP suministrada por cliente", async () => {
    const { readFile } = await import("node:fs/promises");
    const compose = await readFile(
      new URL("../compose.yaml", import.meta.url),
      "utf8",
    );
    const api = compose.split("  api:\n")[1].split("  web:\n")[0];
    expect(api).not.toMatch(/^ {4}ports:/m);
    expect(api).toContain('"3001"');
    expect(compose.match(/^ {4}ports:/gm)).toHaveLength(1);
    const nginx = await readFile(
      new URL("../deploy/nginx.conf", import.meta.url),
      "utf8",
    );
    expect(nginx).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
  });
});

describe("Ronda 3 · tiempo real y mercancía", () => {
  let terminalId: string,
    warehouseToken: string,
    warehouseTerminal: string,
    product: any,
    lotProduct: any;
  const streams: AbortController[] = [];
  beforeAll(async () => {
    terminalId = tokenTerminal.get(token)!;
    await registerTerminal(token, terminalId, "Caja QA R3");
    const cats = await ok("/categories");
    product = await ok("/products", {
      name: "QA Mercancía R3 " + suffix,
      sku: "R3-P-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R3-V-" + suffix,
          barcode: "R3-B-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(product);
    lotProduct = await ok("/products", {
      name: "QA Lote R3 " + suffix,
      sku: "R3-LP-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Suplementos").id,
      variants: [
        {
          sku: "R3-LV-" + suffix,
          barcode: "R3-LB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(lotProduct);
    const role = (await ok("/roles")).find((r: any) => r.name === "warehouse");
    const u = await ok("/users", {
      name: "QA almacén R3",
      email: "r3-warehouse-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "834521",
      roleId: role.id,
    });
    actors.push(u);
    warehouseToken = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    warehouseTerminal = randomUUID();
    await registerTerminal(
      warehouseToken,
      warehouseTerminal,
      "Celular almacén QA",
    );
  });
  afterAll(() => {
    for (const s of streams) s.abort();
  });
  const goods = (extra: any = {}) => ({
    id: randomUUID(),
    direction: "entry",
    items: [{ variantId: product.variants[0].id, qty: 2, unitCost: 10 }],
    ...extra,
  });
  async function stream(as: string) {
    const controller = new AbortController();
    streams.push(controller);
    const response = await fetch(base + "/events", {
      headers: { Authorization: "Bearer " + as },
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const events: { type: string; data: any; at: number }[] = [];
    const reader = response.body!.getReader();
    let buf = "";
    const decoder = new TextDecoder();
    const reading = (async () => {
      try {
        for (;;) {
          const r = await reader.read();
          if (r.done) return;
          buf += decoder.decode(r.value, { stream: true });
          let end;
          while ((end = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, end);
            buf = buf.slice(end + 2);
            const type = frame
              .split("\n")
              .find((l) => l.startsWith("event:"))
              ?.slice(6)
              .trim();
            const text = frame
              .split("\n")
              .find((l) => l.startsWith("data:"))
              ?.slice(5)
              .trim();
            if (type && text)
              events.push({ type, data: JSON.parse(text), at: Date.now() });
          }
        }
      } catch {
        /* abort de limpieza */
      }
    })();
    await waitFor(() => events.some((e) => e.type === "ready"));
    return { events, controller, reading };
  }
  async function waitFor(fn: () => boolean, ms = 2000) {
    const until = Date.now() + ms;
    while (!fn()) {
      if (Date.now() > until)
        throw new Error("Evento no recibido dentro del plazo");
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  it("SSE autentica, filtra sucursal y no comunica operaciones revertidas", async () => {
    expect((await request("/events", undefined, "")).status).toBe(401);
    const s = await stream(token);
    const before = await fixtureDb.realtimeEvent.count();
    await fixtureDb
      .$transaction(async (tx: any) => {
        await tx.variant.update({
          where: { id: product.variants[0].id },
          data: { stock: 100 },
        });
        throw new Error("rollback");
      })
      .catch(() => {});
    expect(await fixtureDb.realtimeEvent.count()).toBe(before);
    const foreign = await fixtureDb.realtimeEvent.create({
      data: {
        branchId: "other-branch",
        type: "stock.changed",
        data: { variantId: "foreign", qtyOnHand: 99 },
      },
    });
    const alert = await fixtureDb.alert.create({
      data: {
        key: "r3-alert-" + suffix,
        type: "stock",
        severity: "low",
        entityId: product.id,
        message: "QA",
        branchId: "main",
      },
    });
    await waitFor(() =>
      s.events.some(
        (e) => e.type === "alert.created" && e.data.id === alert.id,
      ),
    );
    expect(s.events.some((e) => e.data.variantId === "foreign")).toBe(false);
    await fixtureDb.realtimeEvent.delete({ where: { id: foreign.id } });
    s.controller.abort();
  });
  it("tres cajas venden stock 5 y las tres reciben el saldo confirmado en menos de 2 segundos", async () => {
    const auths: string[] = [],
      cashes: any[] = [];
    for (let i = 0; i < 3; i++) {
      const role = (await ok("/roles")).find((r: any) => r.name === "admin");
      const u = await ok("/users", {
        name: "QA SSE " + i,
        email: `sse-${i}-${suffix}@example.test`,
        password: "FitStore-QA-2026!",
        pin: "234567",
        roleId: role.id,
      });
      actors.push(u);
      const t = (
        await ok(
          "/auth/login",
          { email: u.email, password: "FitStore-QA-2026!" },
          "",
        )
      ).accessToken;
      auths.push(t);
      await registerTerminal(t, randomUUID(), "Caja SSE " + i);
      cashes.push(await ok("/cash-sessions/open", { openingAmount: 0 }, t));
    }
    const p = await ok("/products", {
      name: "QA SSE cinco " + suffix,
      sku: "R3-SSE-" + suffix,
      categoryId: product.categoryId,
      variants: [
        {
          sku: "R3-SSEV-" + suffix,
          barcode: "R3-SSEB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: 5,
      reason: "QA SSE stock cinco",
    });
    const opened = await Promise.all(auths.map((t) => stream(t)));
    const started = Date.now();
    const results = await Promise.all(
      auths.map((t, i) =>
        request(
          "/sales",
          {
            offlineUuid: randomUUID(),
            customerId: defaultCustomerId,
            cashSessionId: cashes[i].id,
            items: [{ variantId: p.variants[0].id, qty: 2 }],
            payments: [{ method: "cash", amount: 236 }],
          },
          t,
        ),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 400]);
    expect(Number((await ok("/products/" + p.id)).variants[0].stock)).toBe(1);
    for (const s of opened) {
      await waitFor(
        () =>
          s.events.some(
            (e) =>
              e.type === "stock.changed" &&
              e.data.variantId === p.variants[0].id &&
              e.data.qtyOnHand === 1,
          ),
        Math.max(1, 2000 - (Date.now() - started)),
      );
      expect(
        s.events.find(
          (e) =>
            e.data.variantId === p.variants[0].id && e.data.qtyOnHand === 1,
        )!.at - started,
      ).toBeLessThan(2000);
      s.controller.abort();
    }
    for (let i = 0; i < 3; i++) {
      const c = (await ok("/cash-sessions", undefined, auths[i])).find(
        (c: any) => c.id === cashes[i].id,
      );
      await ok(
        "/cash-sessions/" + c.id + "/close",
        {
          countedCash: c.expected.cash,
          countedCard: 0,
          countedTransfer: 0,
          notes: "QA SSE cierre",
        },
        auths[i],
      );
    }
  });
  it("equipos muestran actividad y caja, renombrar y revocar invalida sesiones", async () => {
    const t = (await ok("/terminals")).find((t: any) => t.id === terminalId);
    expect(t.connected).toBe(true);
    expect(t.openCash.id).toBe(session.id);
    await ok("/terminals/" + terminalId + "/rename", { name: "Laptop QA R3" });
    expect(
      (await ok("/terminals")).find((t: any) => t.id === terminalId).name,
    ).toBe("Laptop QA R3");
    expect((await request("/terminals", undefined, sellerToken)).status).toBe(
      403,
    );
    const u = actors.find((u) => u.email.startsWith("sse-0-"));
    const as = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const id = randomUUID();
    await registerTerminal(as, id, "Revocar QA");
    await ok("/terminals/" + id + "/revoke", {});
    expect((await request("/inventory/stock", undefined, as)).status).toBe(401);
    expect(
      (
        await request("/terminals/register", {
          id,
          name: "Intento reactivar",
          secret: secretOf(id),
        })
      ).status,
    ).toBe(400);
  });
  it("entradas idempotentes con promedio, kardex y usuario/equipo; vendedor bloqueado y almacén sin ganancia", async () => {
    const op = goods({ freight: 4 });
    const before = Number(
      (await ok("/products/" + product.id)).variants[0].stock,
    );
    const [a, b] = await Promise.all([
      ok("/merchandise/operations", op, warehouseToken),
      ok("/merchandise/operations", op, warehouseToken),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.receiptId).toBeTruthy();
    expect(
      await fixtureDb.merchandiseOperation.count({ where: { id: op.id } }),
    ).toBe(1);
    expect(
      await fixtureDb.goodsReceipt.count({ where: { operationId: op.id } }),
    ).toBe(1);
    const v = (await ok("/products/" + product.id)).variants[0];
    expect(Number(v.stock)).toBe(before + 2);
    expect(Number(v.costAvg)).toBe(12);
    expect(
      (
        await request(
          "/merchandise/operations",
          { ...op, items: [{ ...op.items[0], qty: 3 }] },
          warehouseToken,
        )
      ).status,
    ).toBe(400);
    const audit = (await ok("/audit-log")).find(
      (a: any) => a.action === "merchandise_entry" && a.entityId === op.id,
    );
    expect(audit.terminalId).toBe(warehouseTerminal);
    expect(audit.userId).toBe(
      actors.find((u) => u.email.startsWith("r3-warehouse-")).id,
    );
    expect(audit.createdAt).toBeTruthy();
    expect(
      (await ok("/inventory/movements?variantId=" + v.id)).filter(
        (m: any) => m.refId === a.receiptId,
      ),
    ).toHaveLength(1);
    for (const path of [
      "/merchandise/options",
      "/merchandise/profiles/" + supplierId,
    ])
      expect((await request(path, undefined, sellerToken)).status).toBe(403);
    expect(
      (await request("/merchandise/operations", goods(), sellerToken)).status,
    ).toBe(403);
    expect(
      JSON.stringify(await ok("/inventory/stock", undefined, warehouseToken)),
    ).not.toContain("grossProfit");
    expect(
      (await request("/dashboard/summary", undefined, warehouseToken)).status,
    ).toBe(403);
  });
  it("salidas requieren motivo y existencias; todos los motivos quedan auditados", async () => {
    await ok(
      "/merchandise/operations",
      goods({
        items: [{ variantId: product.variants[0].id, qty: 10, unitCost: 12 }],
      }),
    );
    expect(
      (await request("/merchandise/operations", goods({ direction: "exit" })))
        .status,
    ).toBe(400);
    for (const reason of [
      "merma",
      "dañado",
      "vencido",
      "muestra",
      "uso interno",
      "devolución a proveedor",
    ]) {
      const op = goods({
        direction: "exit",
        reason,
        items: [{ variantId: product.variants[0].id, qty: 1, unitCost: 12 }],
      });
      await ok("/merchandise/operations", op, warehouseToken);
      expect(
        (await ok("/audit-log")).some(
          (a: any) =>
            a.entityId === op.id &&
            a.action === "merchandise_exit" &&
            a.terminalId === warehouseTerminal,
        ),
      ).toBe(true);
    }
    expect(
      (
        await request(
          "/merchandise/operations",
          goods({
            direction: "exit",
            reason: "merma",
            items: [
              { variantId: product.variants[0].id, qty: 999, unitCost: 12 },
            ],
          }),
        )
      ).status,
    ).toBe(400);
  });
  it("lotes y vencimiento obligatorios, salida de lote vencido y creación rápida atómica", async () => {
    const item = { variantId: lotProduct.variants[0].id, qty: 2, unitCost: 10 };
    expect(
      (await request("/merchandise/operations", goods({ items: [item] })))
        .status,
    ).toBe(400);
    const date = new Date(Date.now() + 86400000 * 60).toISOString();
    await ok(
      "/merchandise/operations",
      goods({ items: [{ ...item, lotNumber: "R3 lote", expiryDate: date }] }),
    );
    const lot = (await ok("/products/" + lotProduct.id)).variants[0].lots.find(
      (l: any) => l.lotNumberNormalized === "R3 LOTE",
    );
    await fixtureDb.lot.update({
      where: { id: lot.id },
      data: { expiryDate: new Date(Date.now() - 86400000 * 2) },
    });
    const out = await ok(
      "/merchandise/operations",
      goods({
        direction: "exit",
        reason: "vencido",
        items: [{ ...item, qty: 1, lotId: lot.id }],
      }),
    );
    expect(out.id).toBeTruthy();
    const quick = {
      name: "QA rápido " + suffix,
      categoryId: product.categoryId,
      barcode: "R3-QUICK-" + suffix,
      price: 118,
      cost: 20,
      variant: "Única",
    };
    const result = await ok(
      "/merchandise/operations",
      goods({ items: [{ quick, qty: 3, unitCost: 20 }] }),
      warehouseToken,
    );
    const v = await fixtureDb.variant.findUnique({
      where: { id: result.variantIds[0] },
      include: { product: true },
    });
    products.push(v.product);
    expect(Number(v.stock)).toBe(3);
  });
  async function upload(csv: string, as = token) {
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "factura.csv");
    form.set("supplierId", supplierId);
    form.set(
      "mapping",
      JSON.stringify({
        code: "codigo",
        description: "descripcion",
        qty: "cantidad",
        unitCost: "costo",
      }),
    );
    form.set("total", "36");
    const r = await fetch(base + "/merchandise/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + as },
      body: form,
    });
    return { status: r.status, body: await r.json() };
  }
  it("CSV: revisión sin stock, mapeo guardado, total validado, recepción, comprobante y equivalencia", async () => {
    const before = Number(
      (await ok("/products/" + product.id)).variants[0].stock,
    );
    // R9-facturas-2: el código de la tienda se acepta con una descripción del
    // producto; con una que no se le parece («Producto reconocido») ya no.
    const imported = await upload(
      `codigo,descripcion,cantidad,costo\nR3-B-${suffix},${product.name},2,15\nCOD-PROV-R3,${product.name},1,2\n`,
    );
    expect(imported.status).toBe(201);
    const d = imported.body;
    expect(d.lines[0].confidence).toBe(1);
    expect(d.lines[1].variantId).toBe(product.variants[0].id);
    expect(
      Number((await ok("/products/" + product.id)).variants[0].stock),
    ).toBe(before);
    expect((await ok("/merchandise/profiles/" + supplierId)).mapping.qty).toBe(
      "cantidad",
    );
    const op = goods({
      draftId: d.id,
      supplierId,
      items: d.lines.map((l: any) => ({
        variantId: l.variantId,
        qty: l.qty,
        unitCost: l.unitCost,
        supplierCode: l.code,
      })),
      freight: 4,
    });
    const saved = await ok("/merchandise/operations", op);
    expect(saved.attachmentId).toBe(d.attachmentId);
    expect(
      Number((await ok("/products/" + product.id)).variants[0].stock),
    ).toBe(before + 3);
    const attachment = await fetch(
      base + "/merchandise/attachments/" + d.attachmentId,
      { headers: { Authorization: "Bearer " + token } },
    );
    expect(attachment.status).toBe(200);
    expect(await attachment.text()).toContain("codigo");
    expect(
      (await request("/merchandise/operations", { ...op, id: randomUUID() }))
        .status,
    ).toBe(400);
    const second = await upload(
      "codigo,descripcion,cantidad,costo\nCOD-PROV-R3,Sin parecido,1,1\n",
    );
    expect(second.body.lines[0].confidence).toBe(1);
    expect(second.body.lines[0].variantId).toBe(product.variants[0].id);
    expect(
      (
        await upload(
          "codigo,descripcion,cantidad,costo\nunknown,Otro producto,1,1\n",
          sellerToken,
        )
      ).status,
    ).toBe(403);
  });
  it("factura con total distinto se rechaza hasta revisión explícita; línea sin pareja exige resolución", async () => {
    const d = (
      await upload(
        "codigo,descripcion,cantidad,costo\nNO-EXISTE,SIN-PAREJA-XYZ,1,1\n",
      )
    ).body;
    expect(d.lines[0].variantId).toBeNull();
    const op = goods({
      draftId: d.id,
      supplierId,
      items: [{ variantId: product.variants[0].id, qty: 1, unitCost: 1 }],
    });
    expect((await request("/merchandise/operations", op)).status).toBe(400);
    await ok("/merchandise/operations", { ...op, acknowledgeMismatch: true });
    expect(
      (await fixtureDb.invoiceDraft.findUnique({ where: { id: d.id } }))
        .confirmedOperationId,
    ).toBe(op.id);
  });
  it("entrada con orden respeta cantidades pendientes y no duplica recepciones", async () => {
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: product.variants[0].id, qty: 2, unitCost: 10 }],
    });
    const op = goods({
      orderId: order.id,
      supplierId,
      items: [
        {
          variantId: product.variants[0].id,
          itemId: order.items[0].id,
          qty: 2,
          unitCost: 10,
        },
      ],
    });
    await ok("/merchandise/operations", op);
    expect(
      (await fixtureDb.purchaseOrder.findUnique({ where: { id: order.id } }))
        .status,
    ).toBe("received");
    expect(
      (await request("/merchandise/operations", { ...op, id: randomUUID() }))
        .status,
    ).toBe(400);
  });
  it("SSE comunica recepción, devolución, anulación y conteo confirmados", async () => {
    const s = await stream(token),
      id = product.variants[0].id;
    const current = () => fixtureDb.variant.findUnique({ where: { id } });
    const waitStock = async (start: number, qty: number) => {
      await waitFor(() =>
        s.events
          .slice(start)
          .some(
            (e) =>
              e.type === "stock.changed" &&
              e.data.variantId === id &&
              e.data.qtyOnHand === qty,
          ),
      );
    };
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId: id, qty: 2, unitCost: 10 }],
    });
    let from = s.events.length;
    let qty = Number((await current()).stock) + 2;
    await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 2 }],
    });
    await waitStock(from, qty);
    const sale = await ok("/sales", input(id, 118));
    from = s.events.length;
    qty = Number((await current()).stock) + 1;
    await ok("/returns", {
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA eventos devolución",
      refundMethod: "cash",
      items: [
        { saleItemId: sale.items[0].id, qty: 1, restock: true, opened: false },
      ],
    });
    await waitStock(from, qty);
    const second = await ok("/sales", input(id, 118));
    from = s.events.length;
    qty = Number((await current()).stock) + 1;
    await ok("/sales/" + second.id + "/void", {
      reason: "QA eventos anulación",
      cashSessionId: session.id,
    });
    await waitStock(from, qty);
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: qty + 1 }],
    });
    from = s.events.length;
    await ok("/inventory/counts/" + count.id + "/apply", {});
    await waitStock(from, qty + 1);
    s.controller.abort();
  });
  it("eventos se publican en orden de commit aunque las transacciones empiecen al revés", async () => {
    const s = await stream(token);
    let release!: () => void, started!: () => void;
    const gate = new Promise<void>((r) => (release = r)),
      ready = new Promise<void>((r) => (started = r));
    const slow = fixtureDb.$transaction(async (tx: any) => {
      await tx.variant.update({
        where: { id: product.variants[0].id },
        data: { stock: { increment: 1 } },
      });
      started();
      await gate;
    });
    await ready;
    await fixtureDb.$transaction(async (tx: any) => {
      await tx.variant.update({
        where: { id: lotProduct.variants[0].id },
        data: { stock: { increment: 1 } },
      });
    });
    await waitFor(() =>
      s.events.some((e) => e.data.variantId === lotProduct.variants[0].id),
    );
    release();
    await slow;
    await waitFor(() =>
      s.events.some((e) => e.data.variantId === product.variants[0].id),
    );
    const ids = s.events
      .filter((e) => e.type === "stock.changed")
      .map((e) => e.data.variantId);
    expect(ids.indexOf(lotProduct.variants[0].id)).toBeLessThan(
      ids.indexOf(product.variants[0].id),
    );
    s.controller.abort();
  });
  it("nginx mantiene SSE sin buffering y sólo publica el proxy", async () => {
    const { readFile } = await import("node:fs/promises");
    const config = await readFile(
      new URL("../deploy/nginx.conf", import.meta.url),
      "utf8",
    );
    expect(config).toContain("location = /api/events");
    expect(config).toContain("proxy_buffering off;");
    expect(config).toContain("proxy_read_timeout 75s;");
  });
});
describe("Ronda 4 · Claude: caja y equipos", () => {
  let product: any,
    seller: any,
    manager: any,
    sellerA: string,
    sellerB: string,
    managerToken: string,
    cash: any;
  const terminalA = randomUUID(),
    terminalB = randomUUID(),
    terminalM = randomUUID();
  const login = async (email: string) =>
    (await ok("/auth/login", { email, password: "FitStore-QA-2026!" }, ""))
      .accessToken as string;
  beforeAll(async () => {
    const cats = await ok("/categories");
    product = await ok("/products", {
      name: "QA R4 caja " + suffix,
      sku: "R4-C-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R4-CV-" + suffix,
          barcode: "R4-CB-" + suffix,
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(product);
    await ok("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 10,
      reason: "QA ronda 4",
    });
    const roles = await ok("/roles");
    seller = await ok("/users", {
      name: "QA R4 vendedora",
      email: "r4-seller-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "640531",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    manager = await ok("/users", {
      name: "QA R4 gerente",
      email: "r4-manager-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "730142",
      roleId: roles.find((r: any) => r.name === "manager").id,
    });
    actors.push(seller, manager);
    sellerA = await login(seller.email);
    await registerTerminal(sellerA, terminalA, "Caja 1 QA");
    cash = await ok(
      "/cash-sessions/open",
      { openingAmount: 200, registerId: "Caja 1 QA" },
      sellerA,
    );
    sellerB = await login(seller.email);
    await registerTerminal(sellerB, terminalB, "Laptop 2 QA");
    managerToken = await login(manager.email);
    await registerTerminal(managerToken, terminalM, "PC gerencia QA");
  });
  const sale = (as: string) =>
    request("/sales", input(product.variants[0].id, 118, cash), as);
  it("la caja queda asignada al equipo y muestra su nombre", async () => {
    expect(cash.registerId).toBe(terminalA);
    const listed = (await ok("/cash-sessions", undefined, sellerB)).find(
      (s: any) => s.id === cash.id,
    );
    expect(listed.registerName).toBe("Caja 1 QA");
  });
  it("vender desde otro equipo explica dónde está la caja (409, no 403)", async () => {
    const r = await sale(sellerB);
    expect(r.status).toBe(409);
    expect(r.body.message).toContain("«Caja 1 QA»");
    expect((await sale(sellerA)).status).toBe(201);
  });
  it("trasladar exige PIN de gerente al vendedor y queda en bitácora", async () => {
    const path = "/cash-sessions/" + cash.id + "/transfer";
    expect((await request(path, {}, sellerB)).status).toBe(400);
    expect(
      (await request(path, { managerPin: "000000" }, sellerB)).status,
    ).toBe(400);
    const moved = await ok(path, { managerPin: "730142" }, sellerB);
    expect(moved.registerId).toBe(terminalB);
    expect(moved.registerName).toBe("Laptop 2 QA");
    expect((await sale(sellerB)).status).toBe(201);
    const old = await sale(sellerA);
    expect(old.status).toBe(409);
    expect(old.body.message).toContain("«Laptop 2 QA»");
    const log = await ok("/audit-log");
    const entry = log.find(
      (a: any) => a.entityId === cash.id && a.action === "cash_transferred",
    );
    expect(entry).toBeTruthy();
  });
  it("otro usuario no puede trasladar una caja ajena", async () => {
    const r = await request(
      "/cash-sessions/" + cash.id + "/transfer",
      {},
      managerToken,
    );
    expect(r.status).toBe(403);
  });
  it("el gerente cierra la caja de una vendedora desde su propio equipo", async () => {
    const current = (await ok("/cash-sessions", undefined, managerToken)).find(
      (s: any) => s.id === cash.id,
    );
    const r = await request(
      "/cash-sessions/" + cash.id + "/close",
      {
        countedCash: current.expected.cash,
        countedCard: current.expected.card,
        countedTransfer: current.expected.transfer,
        notes: "Cierre por gerencia QA",
      },
      managerToken,
    );
    expect(r.status).toBe(201);
  });
  it("la dueña puede cerrar su caja desde cualquier equipo", async () => {
    const own = await ok(
      "/cash-sessions/open",
      { openingAmount: 50, registerId: "Laptop 2 QA" },
      sellerB,
    );
    const r = await request(
      "/cash-sessions/" + own.id + "/close",
      { countedCash: 50, countedCard: 0, countedTransfer: 0 },
      sellerA,
    );
    expect(r.status).toBe(201);
  });
});
describe("Ronda 4 · auditoría de ChatGPT y propia", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[], clothingVariant: any, supplementVariant: any;
  const newProduct = async (name: string, category: string) => {
    const p = await ok("/products", {
      name: name + " " + suffix,
      sku: "R4A-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === category).id,
      variants: [
        {
          sku: "R4AV-" + randomUUID().slice(0, 8),
          barcode: "R4AB-" + randomUUID().slice(0, 8),
          costAvg: 40,
          price: 118,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const newUserToken = async (role: string, pin = "612345") => {
    const roles = await ok("/roles");
    const u = await ok("/users", {
      name: "QA R4 " + role,
      email: "r4a-" + role + "-" + randomUUID().slice(0, 6) + "@example.test",
      password: "FitStore-QA-2026!",
      pin,
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    const auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    return { user: u, token: auth.accessToken as string };
  };
  const stockOf = async (variantId: string) =>
    Number(
      (await fixtureDb.variant.findUnique({ where: { id: variantId } })).stock,
    );
  beforeAll(async () => {
    cats = await ok("/categories");
    clothingVariant = await newProduct("QA R4 ropa", "Ropa deportiva");
    supplementVariant = await newProduct("QA R4 suplemento", "Suplementos");
  });
  it("P1 compras: entrada sin orden se reporta una vez; orden no se duplica; fechas aplican", async () => {
    const supplier = await ok("/suppliers", {
      name: "QA Proveedor R4 " + suffix,
    });
    const report = async (from = today, to = today) =>
      (await ok(`/reports/purchases?from=${from}&to=${to}`)).rows.find(
        (r: any) => r.Proveedor === supplier.name,
      );
    const entry = {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      freight: 4,
      items: [{ variantId: clothingVariant.id, qty: 2, unitCost: 15 }],
    };
    await ok("/merchandise/operations", entry);
    expect(await report()).toMatchObject({ Compras: 34, Pendiente: 34 });
    // Repetir el UUID no crea otra recepción ni cambia el importe.
    await ok("/merchandise/operations", entry);
    expect(await report()).toMatchObject({ Compras: 34 });
    expect(
      await fixtureDb.goodsReceipt.count({ where: { operationId: entry.id } }),
    ).toBe(1);
    // Una compra con orden cuenta por la orden; su recepción no se suma otra vez.
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 50 }],
    });
    await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 1 }],
    });
    expect(await report()).toMatchObject({ Compras: 84, Pendiente: 84 });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 34,
      method: "transfer",
    });
    expect(await report()).toMatchObject({ Pagado: 34, Pendiente: 50 });
    expect(await report("2020-01-01", "2020-01-31")).toMatchObject({
      Compras: 0,
      Pagado: 0,
    });
  });
  it("P1 equipos: sin equipo, pendiente o revocado no mueve stock ni caja; aprobado sí y la bitácora guarda el equipo", async () => {
    const wh = await newUserToken("warehouse");
    const adjust = (as: string) =>
      request(
        "/inventory/adjustments",
        { variantId: clothingVariant.id, qty: 1, reason: "QA equipo R4" },
        as,
      );
    const goods = (as: string) =>
      request(
        "/merchandise/operations",
        {
          id: randomUUID(),
          direction: "entry",
          items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 10 }],
        },
        as,
      );
    const before = await stockOf(clothingVariant.id);
    for (const r of [await adjust(wh.token), await goods(wh.token)]) {
      expect(r.status).toBe(403);
      expect(r.body.code).toBe("TERMINAL_REQUIRED");
    }
    const seller = await newUserToken("seller");
    expect(
      (await request("/cash-sessions/open", { openingAmount: 0 }, seller.token))
        .body.code,
    ).toBe("TERMINAL_REQUIRED");
    // Equipo nuevo de almacén: queda pendiente y sigue sin operar.
    const device = randomUUID();
    const registered = await ok(
      "/terminals/register",
      { id: device, name: "Celular R4", secret: secretOf(device) },
      wh.token,
    );
    expect(registered.status).toBe("pending");
    expect((await adjust(wh.token)).body.code).toBe("TERMINAL_PENDING");
    // Otro dispositivo no puede reclamar ese equipo sin su secreto.
    expect(
      (
        await request(
          "/terminals/register",
          { id: device, name: "Intruso", secret: "otro-secreto-qa-0000" },
          seller.token,
        )
      ).status,
    ).toBe(403);
    // Aprobación en el equipo con PIN de gerente.
    expect(
      (
        await request(
          "/terminals/" + device + "/approve-with-pin",
          { managerPin: "000000" },
          wh.token,
        )
      ).status,
    ).toBe(400);
    const approved = await ok(
      "/terminals/" + device + "/approve-with-pin",
      { managerPin: "987654" },
      wh.token,
    );
    expect(approved.status).toBe("approved");
    expect((await adjust(wh.token)).status).toBe(201);
    expect(await stockOf(clothingVariant.id)).toBe(before + 1);
    const logged = await fixtureDb.auditLog.findFirst({
      where: { entityId: clothingVariant.id, userId: wh.user.id },
      orderBy: { createdAt: "desc" },
    });
    expect(logged.terminalId).toBe(device);
    // Revocar: la sesión cae, el mismo equipo no vuelve y uno nuevo espera aprobación.
    await ok("/terminals/" + device + "/revoke", {}, ownerToken);
    expect((await adjust(wh.token)).status).toBe(401);
    const again = (
      await ok(
        "/auth/login",
        { email: wh.user.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    expect((await adjust(again)).body.code).toBe("TERMINAL_REQUIRED");
    expect(
      (
        await request(
          "/terminals/register",
          { id: device, name: "Reintento", secret: secretOf(device) },
          again,
        )
      ).status,
    ).toBe(400);
    const other = randomUUID();
    await ok(
      "/terminals/register",
      { id: other, name: "Otro celular", secret: secretOf(other) },
      again,
    );
    expect((await adjust(again)).body.code).toBe("TERMINAL_PENDING");
    expect(await stockOf(clothingVariant.id)).toBe(before + 1);
  });
  it("P2 lotes: lotId inventado, ajeno o de otra variante se rechaza sin cambios; el número de lote queda coherente", async () => {
    const expiry = new Date(Date.now() + 200 * 86400000).toISOString();
    const lotNumber = "R4-L-" + suffix;
    const valid = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      items: [
        {
          variantId: supplementVariant.id,
          qty: 3,
          unitCost: 20,
          lotNumber,
          expiryDate: expiry,
        },
      ],
    });
    const lot = await fixtureDb.lot.findUnique({
      where: {
        variantId_lotNumberNormalized: {
          variantId: supplementVariant.id,
          lotNumberNormalized: lotNumber.toUpperCase(),
        },
      },
    });
    expect(Number(lot.qty)).toBe(3);
    expect(await stockOf(supplementVariant.id)).toBe(3);
    const movement = await fixtureDb.inventoryMovement.findFirst({
      where: { refId: valid.receiptId, variantId: supplementVariant.id },
    });
    expect(movement.lotId).toBe(lot.id);
    const beforeClothing = await stockOf(clothingVariant.id);
    const receiptsBefore = await fixtureDb.goodsReceipt.count();
    for (const lotId of [randomUUID(), lot.id]) {
      const r = await request("/merchandise/operations", {
        id: randomUUID(),
        direction: "entry",
        items: [{ variantId: clothingVariant.id, qty: 1, unitCost: 10, lotId }],
      });
      expect(r.status).toBe(400);
    }
    expect(await stockOf(clothingVariant.id)).toBe(beforeClothing);
    expect(await fixtureDb.goodsReceipt.count()).toBe(receiptsBefore);
    expect(
      Number((await fixtureDb.lot.findUnique({ where: { id: lot.id } })).qty),
    ).toBe(3);
    // Prueba negativa intencional: PostgreSQL registra
    // InventoryMovement_lotId_fkey en su log al rechazar este lote inexistente.
    await expect(
      fixtureDb.inventoryMovement.create({
        data: {
          variantId: clothingVariant.id,
          lotId: randomUUID(),
          type: "adjustment",
          qty: 0,
          unitCost: 0,
          balanceAfter: 0,
          reason: "QA FK",
          userId: "qa",
        },
      }),
    ).rejects.toMatchObject({ code: "P2003" });
  });
  it("almacén: producto rápido queda inactivo con alerta; cantidades finas se rechazan; kardex usa el costo recibido", async () => {
    const wh = await newUserToken("warehouse");
    await registerTerminal(wh.token, randomUUID(), "Almacén R4");
    const quick = await ok(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        items: [
          {
            quick: {
              name: "QA rápido R4 " + suffix,
              categoryId: cats.find((c: any) => c.name === "Accesorios de gym")
                .id,
              price: 1,
              cost: 2500,
              barcode: "R4Q-" + suffix,
              variant: "Única",
            },
            qty: 1,
            unitCost: 2500,
          },
        ],
      },
      wh.token,
    );
    const created = await fixtureDb.variant.findUnique({
      where: { id: quick.variantIds[0] },
      include: { product: true },
    });
    expect(created.product.active).toBe(false);
    expect(
      await fixtureDb.alert.count({
        where: { key: "new-product:" + created.productId },
      }),
    ).toBe(1);
    const tiny = await request(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        items: [{ variantId: clothingVariant.id, qty: 0.0004, unitCost: 1e6 }],
      },
      wh.token,
    );
    expect(tiny.status).toBe(400);
    // 2 a 15 + flete 4 => costo recibido 17 por unidad (no el nuevo promedio).
    const entry = await ok(
      "/merchandise/operations",
      {
        id: randomUUID(),
        direction: "entry",
        freight: 4,
        items: [{ variantId: clothingVariant.id, qty: 2, unitCost: 15 }],
      },
      wh.token,
    );
    const m = await fixtureDb.inventoryMovement.findFirst({
      where: { refId: entry.receiptId },
    });
    expect(Number(m.unitCost)).toBe(17);
  });
  it("SSE: como máximo dos conexiones por sesión", async () => {
    const controllers: AbortController[] = [];
    const open = async () => {
      const c = new AbortController();
      controllers.push(c);
      return fetch(base + "/events", {
        headers: { Authorization: "Bearer " + token },
        signal: c.signal,
      });
    };
    try {
      expect((await open()).status).toBe(200);
      expect((await open()).status).toBe(200);
      expect((await open()).status).toBe(429);
    } finally {
      for (const c of controllers) c.abort();
    }
  });
  it("importación: archivos grandes se rechazan sin leerlos", async () => {
    const upload = async (content: string) => {
      const form = new FormData();
      form.set("file", new Blob([content], { type: "text/csv" }), "f.csv");
      form.set(
        "mapping",
        JSON.stringify({
          code: "codigo",
          description: "descripcion",
          qty: "cantidad",
          unitCost: "costo",
        }),
      );
      const started = Date.now();
      const r = await fetch(base + "/merchandise/import", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "X-Forwarded-For": testIp,
        },
        body: form,
      });
      return {
        status: r.status,
        body: await r.json(),
        ms: Date.now() - started,
      };
    };
    const header = "codigo,descripcion,cantidad,costo\n";
    const big = await upload(header + "A,Producto,1,10\n".repeat(80000));
    expect(big.status).toBe(400);
    expect(big.body.message).toContain("1 MB");
    expect(big.ms).toBeLessThan(3000);
    const many = await upload(header + "A,Producto,1,10\n".repeat(1500));
    expect(many.status).toBe(400);
    expect(many.body.message).toContain("1000 filas");
  });
});

describe("Auditoría ronda 4 de ChatGPT", () => {
  it("P1: una caída abrupta del cliente libera su conexión de tiempo real", async () => {
    const { request: httpRequest } = await import("node:http");
    const url = new URL(base + "/events");
    const openRaw = () =>
      new Promise<{ status: number; drop: () => void }>((resolve, reject) => {
        const req = httpRequest(
          {
            host: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { Authorization: "Bearer " + token },
          },
          (res) =>
            resolve({ status: res.statusCode!, drop: () => req.destroy() }),
        );
        req.on("error", () => {});
        req.on("error", reject);
        req.end();
      });
    const first = await openRaw();
    const second = await openRaw();
    expect([first.status, second.status]).toEqual([200, 200]);
    expect((await openRaw()).status).toBe(429);
    // Caída abrupta: se destruye el socket sin cerrar el flujo SSE.
    first.drop();
    second.drop();
    await new Promise((r) => setTimeout(r, 300));
    const again = [await openRaw(), await openRaw()];
    expect(again.map((c) => c.status)).toEqual([200, 200]);
    for (const c of again) c.drop();
  });
  it("P2: el kardex tiene índice por lote (migración y base de datos)", async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/202610050002_lot_index/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain(
      'CREATE INDEX "InventoryMovement_lotId_idx" ON "InventoryMovement"("lotId")',
    );
    const rows: any[] = await fixtureDb.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'InventoryMovement' AND indexname = 'InventoryMovement_lotId_idx'`;
    expect(rows.length).toBe(1);
  });
});
// Ronda 6: regresiones exigidas por la auditoría R4 de ChatGPT
// (docs/AUDITORIA_RONDA4.md). Corren igual con tsx y con node dist/main.js.
describe("Ronda 6 · auditoría R4 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[], variant: any;
  const newVariant = async (name: string) => {
    const p = await ok("/products", {
      name: name + " " + suffix,
      sku: "R6-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R6V-" + randomUUID().slice(0, 8),
          barcode: "R6B-" + randomUUID().slice(0, 8),
          costAvg: 10,
          price: 118,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const newUser = async (role: string) => {
    const roles = await ok("/roles");
    const u = await ok("/users", {
      name: "QA R6 " + role + " " + randomUUID().slice(0, 4),
      email: "r6-" + role + "-" + randomUUID().slice(0, 6) + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "612345",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    actors.push(u);
    const auth = await ok(
      "/auth/login",
      { email: u.email, password: "FitStore-QA-2026!" },
      "",
    );
    return { user: u, token: auth.accessToken as string };
  };
  const sessionIdOf = (jwt: string) =>
    JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sid;
  // Ejecuta el SQL exacto de la migración de la ronda 6 (es re-ejecutable).
  const runRound6Sql = async () => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/202610060001_round6_audit/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()))
      if (statement) await fixtureDb.$executeRawUnsafe(statement);
  };
  const purchases = async (supplier: string, from = today, to = today) =>
    (await ok(`/reports/purchases?from=${from}&to=${to}`)).rows.find(
      (r: any) => r.Proveedor === supplier,
    );
  const adjust = (as: string) =>
    request(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 1, reason: "QA equipo R6" },
      as,
    );
  beforeAll(async () => {
    cats = await ok("/categories");
    variant = await newVariant("QA R6 base");
  });

  it("R4-01: un equipo R3 migrado no se puede reclamar ni operar sin aprobación del gerente", async () => {
    const original = await newUser("warehouse");
    const intruder = await newUser("warehouse");
    // Estado exacto tras la migración R4: aprobado, sin secreto ni creador.
    const legacyTerminal = async () => {
      const id = randomUUID();
      await fixtureDb.terminal.create({
        data: {
          id,
          name: "Equipo R3 " + id.slice(0, 4),
          branchId: "main",
          approvedAt: new Date(),
          lastUserId: original.user.id,
        },
      });
      return id;
    };
    const legacy = await legacyTerminal(),
      second = await legacyTerminal(),
      unclaimed = await legacyTerminal();
    // Sesión heredada ya enlazada a ese ID (como la dejaba la ronda 3).
    await fixtureDb.authSession.update({
      where: { id: sessionIdOf(original.token) },
      data: { terminalId: legacy },
    });
    await runRound6Sql();
    await runRound6Sql();
    for (const id of [legacy, second, unclaimed]) {
      const t = await fixtureDb.terminal.findUnique({ where: { id } });
      expect(t).toMatchObject({ legacy: true, approvedAt: null });
    }
    // La sesión heredada ya no opera.
    const heir = await adjust(original.token);
    expect(heir.status).toBe(403);
    expect(heir.body.code).toBe("TERMINAL_PENDING");
    // Otro usuario con el ID conocido y un secreto nuevo: queda pendiente.
    const claim = await ok(
      "/terminals/register",
      { id: legacy, name: "Intruso", secret: "intruso-secreto-" + legacy },
      intruder.token,
    );
    expect(claim).toMatchObject({ status: "pending", approvedBy: null });
    expect(claim.secretHash).toBeUndefined();
    const blocked = await adjust(intruder.token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("TERMINAL_PENDING");
    expect(
      await fixtureDb.auditLog.count({
        where: { entityId: legacy, action: "terminal_legacy_claimed" },
      }),
    ).toBe(1);
    // El gerente lo ve como equipo anterior reclamado por esa persona.
    const listed = (await ok("/terminals", undefined, ownerToken)).find(
      (t: any) => t.id === legacy,
    );
    expect(listed).toMatchObject({
      legacy: true,
      status: "pending",
      identified: true,
      createdByName: intruder.user.name,
    });
    // Revocarlo deja fuera al intruso; un revocado no se vuelve a reclamar.
    await ok("/terminals/" + legacy + "/revoke", {}, ownerToken);
    expect((await adjust(intruder.token)).status).toBe(401);
    expect(
      (
        await request(
          "/terminals/register",
          { id: legacy, name: "Otra vez", secret: "x".repeat(20) },
          original.token,
        )
      ).status,
    ).toBe(401);
    // Flujo autorizado: el dueño reclama el segundo y el gerente lo aprueba.
    const relog = await ok(
      "/auth/login",
      { email: original.user.email, password: "FitStore-QA-2026!" },
      "",
    );
    const mine = await ok(
      "/terminals/register",
      { id: second, name: "Mi equipo", secret: "propio-secreto-" + second },
      relog.accessToken,
    );
    expect(mine.status).toBe("pending");
    expect((await adjust(relog.accessToken)).status).toBe(403);
    await ok("/terminals/" + second + "/approve", {}, ownerToken);
    expect((await adjust(relog.accessToken)).status).toBe(201);
    // Un equipo anterior que nunca se identificó no se puede aprobar.
    const early = await request(
      "/terminals/" + unclaimed + "/approve",
      {},
      ownerToken,
    );
    expect(early.status).toBe(400);
    expect(
      (await fixtureDb.terminal.findUnique({ where: { id: unclaimed } }))
        .approvedAt,
    ).toBeNull();
    // Un gerente que reclama un equipo anterior lo aprueba él mismo, auditado.
    const manager = await newUser("manager");
    const managed = await legacyTerminal();
    await runRound6Sql();
    const byManager = await ok(
      "/terminals/register",
      { id: managed, name: "Caja anterior", secret: "gerente-" + managed },
      manager.token,
    );
    expect(byManager).toMatchObject({
      status: "approved",
      approvedBy: manager.user.id,
    });
  });

  it("R4-02: la compra R3 sin orden se recupera de la bitácora; reparación idempotente", async () => {
    const supplier = await ok("/suppliers", { name: "QA R6 legado " + suffix });
    const entry = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      freight: 4,
      items: [{ variantId: variant.id, qty: 2, unitCost: 15 }],
    });
    const ambiguous = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 1, unitCost: 7 }],
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 1, unitCost: 50 }],
    });
    await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 1 }],
    });
    const orderReceipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { orderId: order.id },
    });
    const ids = [entry.receiptId, ambiguous.receiptId, orderReceipt.id];
    // Estado de una base R3: la recepción no guardaba proveedor ni total.
    await fixtureDb.goodsReceipt.updateMany({
      where: { id: { in: ids } },
      data: {
        supplierId: null,
        total: null,
        attachmentId: null,
        operationId: null,
      },
    });
    // Evidencia ambigua: dos entradas de bitácora para la misma operación.
    const log = await fixtureDb.auditLog.findFirstOrThrow({
      where: { entityId: ambiguous.id, action: "merchandise_entry" },
    });
    await fixtureDb.auditLog.create({
      data: {
        userId: log.userId,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        after: { ...(log.after as any), supplierId: randomUUID() },
        branchId: log.branchId,
      },
    });
    // Antes de reparar: la recepción de la orden no tiene total y las de
    // Mercancía ni siquiera proveedor.
    expect(await purchases(supplier.name)).toMatchObject({
      Compras: 0,
      Sin_conciliar: 1,
    });
    const orphans = async () =>
      (await purchases("Recepciones sin proveedor (conciliar)"))
        ?.Sin_conciliar ?? 0;
    const orphanBefore = await orphans();
    expect(orphanBefore).toBeGreaterThanOrEqual(2);
    const count = await fixtureDb.goodsReceipt.count();
    await runRound6Sql();
    await runRound6Sql();
    expect(await fixtureDb.goodsReceipt.count()).toBe(count);
    const restored = await fixtureDb.goodsReceipt.findUnique({
      where: { id: entry.receiptId },
    });
    expect(restored).toMatchObject({
      supplierId: supplier.id,
      operationId: entry.id,
    });
    expect(Number(restored.total)).toBe(34);
    const fromOrder = await fixtureDb.goodsReceipt.findUnique({
      where: { id: orderReceipt.id },
    });
    expect(fromOrder.supplierId).toBe(supplier.id);
    expect(Number(fromOrder.total)).toBe(50);
    // Lo ambiguo no se inventa: queda para conciliación explícita.
    expect(
      await fixtureDb.goodsReceipt.findUnique({
        where: { id: ambiguous.receiptId },
      }),
    ).toMatchObject({ supplierId: null, total: null, operationId: null });
    expect(await purchases(supplier.name)).toMatchObject({
      Ordenado: 50,
      Compras: 84,
      Pendiente: 84,
      Sin_conciliar: 0,
    });
    // La recuperada sale de "sin proveedor"; la ambigua sigue ahí.
    expect(await orphans()).toBe(orphanBefore - 1);
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 84,
      method: "transfer",
    });
    expect(await purchases(supplier.name)).toMatchObject({
      Pagado: 84,
      Pendiente: 0,
    });
    expect(
      await purchases(supplier.name, "2020-01-01", "2020-01-31"),
    ).toMatchObject({ Compras: 0, Pagado: 0, Sin_conciliar: 0 });
  });

  it("R4-03: cantidades fuera de precisión dan 400 en todas las rutas y no tocan costo, stock ni kardex", async () => {
    const v = await newVariant("QA R6 precisión");
    await ok("/inventory/adjustments", {
      variantId: v.id,
      qty: 1,
      reason: "QA apertura R6",
    });
    const supplier = await ok("/suppliers", {
      name: "QA R6 precisión " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: v.id, qty: 1, unitCost: 1000000 }],
    });
    const snapshot = async () => {
      const row = await fixtureDb.variant.findUnique({ where: { id: v.id } });
      const item = await fixtureDb.purchaseItem.findUnique({
        where: { id: order.items[0].id },
      });
      return {
        stock: Number(row.stock),
        cost: Number(row.costAvg),
        received: Number(item.receivedQty),
        receipts: await fixtureDb.goodsReceipt.count({
          where: { orderId: order.id },
        }),
        kardex: await fixtureDb.inventoryMovement.count({
          where: { variantId: v.id },
        }),
        lots: await fixtureDb.lot.count({ where: { variantId: v.id } }),
      };
    };
    const before = await snapshot();
    expect(before).toMatchObject({ stock: 1, cost: 10 });
    for (const qty of [0.0004, 1.0001]) {
      const r = await request("/purchase-orders/" + order.id + "/receive", {
        operationId: randomUUID(),
        items: [{ itemId: order.items[0].id, qty, lotNumber: "R6-L" }],
      });
      expect(r.status, String(qty)).toBe(400);
      expect(r.body.message).toMatch(/cantidad/);
    }
    expect(await snapshot()).toEqual(before);
    const fine = [
      () =>
        request("/merchandise/operations", {
          id: randomUUID(),
          direction: "entry",
          items: [{ variantId: v.id, qty: 0.0004, unitCost: 5 }],
        }),
      () =>
        request("/inventory/adjustments", {
          variantId: v.id,
          qty: 0.0004,
          reason: "QA fino",
        }),
      () =>
        request("/inventory/adjustments", {
          variantId: v.id,
          qty: -1.0001,
          reason: "QA fino",
        }),
      () =>
        request("/inventory/counts", {
          items: [{ variantId: v.id, counted: 1.0001 }],
        }),
      () =>
        request("/purchase-orders", {
          supplierId: supplier.id,
          items: [{ variantId: v.id, qty: 0.0004, unitCost: 5 }],
        }),
      () =>
        request("/sales", {
          ...input(v.id, 118),
          items: [{ variantId: v.id, qty: 0.0004 }],
        }),
      () =>
        request("/returns", {
          saleId: randomUUID(),
          cashSessionId: session.id,
          reason: "QA precisión",
          refundMethod: "cash",
          items: [{ saleItemId: randomUUID(), qty: 0.0004, restock: true }],
        }),
    ];
    for (const call of fine) {
      const r = await call();
      expect(r.status, JSON.stringify(r.body)).toBe(400);
    }
    expect(await snapshot()).toEqual(before);
    // 0.001 es válido y conserva cantidad y costo contable.
    await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 0.001 }],
    });
    const after = await snapshot();
    expect(after.stock).toBe(1.001);
    expect(after.received).toBe(0.001);
    expect(after.receipts).toBe(1);
    expect(after.kardex).toBe(before.kardex + 1);
    // (1 × 10 + 0.001 × 1 000 000) / 1.001
    expect(after.cost).toBeCloseTo(1008.99, 2);
    const receipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { orderId: order.id },
    });
    expect(Number(receipt.total)).toBe(1000);
  });

  it("R4-04: la factura aceptada contra una orden fija la deuda; parciales, flete y reintento sin doble conteo", async () => {
    const supplier = await ok("/suppliers", {
      name: "QA R6 factura " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: variant.id, qty: 2, unitCost: 25 }],
    });
    const invoice = {
      id: randomUUID(),
      direction: "entry",
      supplierId: supplier.id,
      orderId: order.id,
      invoiceTotal: 60,
      items: [
        {
          variantId: variant.id,
          itemId: order.items[0].id,
          qty: 2,
          unitCost: 30,
        },
      ],
    };
    await ok("/merchandise/operations", invoice);
    expect(await purchases(supplier.name)).toMatchObject({
      Ordenado: 50,
      Compras: 60,
      Pendiente: 60,
    });
    // Reintento con el mismo UUID: misma recepción, mismo importe.
    await ok("/merchandise/operations", invoice);
    expect(await purchases(supplier.name)).toMatchObject({ Compras: 60 });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 60,
      method: "transfer",
    });
    expect(await purchases(supplier.name)).toMatchObject({
      Pagado: 60,
      Pendiente: 0,
    });
    // Parciales: 2 por la ruta de la orden (al costo de la orden) y 2 por
    // factura con otro costo, flete e impuestos.
    const partialSupplier = await ok("/suppliers", {
      name: "QA R6 parcial " + suffix,
    });
    const partial = await ok("/purchase-orders", {
      supplierId: partialSupplier.id,
      items: [{ variantId: variant.id, qty: 4, unitCost: 10 }],
    });
    await ok("/purchase-orders/" + partial.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: partial.items[0].id, qty: 2 }],
    });
    expect(await purchases(partialSupplier.name)).toMatchObject({
      Ordenado: 40,
      Compras: 20,
    });
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId: partialSupplier.id,
      orderId: partial.id,
      freight: 3,
      taxes: 2,
      items: [
        {
          variantId: variant.id,
          itemId: partial.items[0].id,
          qty: 2,
          unitCost: 12,
        },
      ],
    });
    expect(await purchases(partialSupplier.name)).toMatchObject({
      Ordenado: 40,
      Compras: 49,
      Pendiente: 49,
    });
    expect(
      await purchases(partialSupplier.name, "2020-01-01", "2020-01-31"),
    ).toMatchObject({ Ordenado: 0, Compras: 0 });
  });

  it("R4-06: una ráfaga de conexiones SSE sobre una sesión acepta como máximo dos", async () => {
    const { request: httpRequest } = await import("node:http");
    const { token: sse } = await newUser("seller");
    const url = new URL(base + "/events");
    const open = () =>
      new Promise<{ status: number; drop: () => void }>((resolve) => {
        const req = httpRequest(
          {
            host: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: { Authorization: "Bearer " + sse },
          },
          (res) => {
            res.resume();
            resolve({ status: res.statusCode!, drop: () => req.destroy() });
          },
        );
        req.on("error", () => resolve({ status: 0, drop: () => {} }));
        req.end();
      });
    const burst = await Promise.all(Array.from({ length: 8 }, open));
    const statuses = burst.map((c) => c.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(2);
    expect(statuses.filter((s) => s === 429)).toHaveLength(6);
    burst.forEach((c) => c.drop());
    await new Promise((r) => setTimeout(r, 300));
    const again = await Promise.all([open(), open()]);
    expect(again.map((c) => c.status)).toEqual([200, 200]);
    again.forEach((c) => c.drop());
  });

  it("R4-08: ventas inválidas devuelven 400 con campos en español (también en la API compilada)", async () => {
    const empty = await request("/sales", {});
    expect(empty.status).toBe(400);
    expect(empty.body.message).toMatch(/^Revisa los campos: /);
    expect(empty.body.message).toMatch(/caja|línea|pago/);
    const discount = await request("/sales", {
      ...input(variant.id, 118),
      items: [{ variantId: variant.id, qty: 1, discountPercent: 150 }],
    });
    expect(discount.status).toBe(400);
    expect(discount.body.message).toMatch(/Revisa los campos/);
  });
});
// Ronda 7: regresiones exigidas por la auditoría R6 de ChatGPT
// (docs/AUDITORIA_RONDA6.md).
describe("Ronda 7 · auditoría R6 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  const product = async (label: string, price: number, costAvg: number) => {
    const p = await ok("/products", {
      name: "QA R7 " + label + " " + suffix,
      sku: "R7-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate: 0,
      variants: [
        {
          sku: "R7V-" + randomUUID().slice(0, 8),
          barcode: "R7B-" + randomUUID().slice(0, 8),
          price,
          costAvg,
        },
      ],
    });
    products.push(p);
    return p.variants[0];
  };
  const runMigrationSql = async (dir: string) => {
    const { readFileSync } = await import("node:fs");
    const sql = readFileSync(
      new URL(
        "../apps/api/prisma/migrations/" + dir + "/migration.sql",
        import.meta.url,
      ),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trim().startsWith("--"))
      .join("\n");
    for (const statement of sql.split(/;\s*\n/).map((s) => s.trim()))
      if (statement) await fixtureDb.$executeRawUnsafe(statement);
  };
  beforeAll(async () => {
    cats = await ok("/categories");
  });

  it("R6-01: un combo fraccionado se rechaza sin escrituras; 1 combo consume exactamente 0.4 y su devolución lo repone", async () => {
    const component = await product("componente", 12000, 10000);
    const combo = await product("combo", 5000, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 1,
      reason: "QA stock para combo",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.4 }],
    });
    const cashOf = async () =>
      (await ok("/cash-sessions")).find((s: any) => s.id === session.id)
        .expected;
    const snapshot = async () => ({
      stock: Number(
        (await fixtureDb.variant.findUnique({ where: { id: component.id } }))
          .stock,
      ),
      moves: await fixtureDb.inventoryMovement.count({
        where: { variantId: component.id },
      }),
      sales: await fixtureDb.saleItem.count({
        where: { variantId: combo.id },
      }),
      payments: await fixtureDb.payment.count({
        where: { sale: { cashSessionId: session.id } },
      }),
      cash: await cashOf(),
    });
    const before = await snapshot();
    // Reproducción exacta de ChatGPT: 0.001 combos, pago de 5.
    const fractional = {
      ...input(combo.id, 5),
      items: [{ variantId: combo.id, qty: 0.001 }],
    };
    const rejected = await request("/sales", fractional);
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toMatch(/unidades enteras/);
    expect(
      await fixtureDb.sale.count({
        where: { offlineUuid: fractional.offlineUuid },
      }),
    ).toBe(0);
    // Otra fracción con consumo representable (0.5 × 0.4 = 0.2) también se
    // rechaza: los combos se venden enteros.
    const half = await request("/sales", {
      ...input(combo.id, 2500),
      items: [{ variantId: combo.id, qty: 0.5 }],
    });
    expect(half.status).toBe(400);
    expect(await snapshot()).toEqual(before);
    // Una venta de 1 combo consume exactamente 0.4 con costo coherente.
    const sale = await ok("/sales", input(combo.id, 5000));
    expect(Number(sale.costTotal)).toBe(4000);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    expect(Number(item.unitCost)).toBe(4000);
    expect(item.stockAllocations).toEqual([
      expect.objectContaining({
        variantId: component.id,
        qty: 0.4,
        unitCost: 10000,
      }),
    ]);
    const move = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "sale" },
    });
    expect(Number(move.qty)).toBe(-0.4);
    expect(Number(move.balanceAfter)).toBe(0.6);
    // Devoluciones: media unidad de combo se rechaza; una entera repone 0.4.
    const returnBody = (qty: number) => ({
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución combo",
      refundMethod: "credit_note",
      items: [{ saleItemId: item.id, qty, restock: true }],
    });
    const partial = await request("/returns", returnBody(0.5));
    expect(partial.status).toBe(400);
    expect(partial.body.message).toMatch(/unidades enteras/);
    await ok("/returns", returnBody(1));
    const restored = await fixtureDb.variant.findUnique({
      where: { id: component.id },
    });
    expect(Number(restored.stock)).toBe(1);
    expect(Number(restored.costAvg)).toBe(10000);
    const back = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "return" },
    });
    expect(Number(back.qty)).toBe(0.4);
  });

  it("revisión R7: costo de combos exacto en venta, devolución y reporte de utilidad", async () => {
    // 0.5 × 10.01 = 5.005 por combo: el costo por unidad se redondea, el de
    // las asignaciones no.
    const component = await product("costo fino", 30, 10.01);
    const combo = await product("combo costo fino", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA stock combo costo",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const profit = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R7 combo costo fino " + suffix,
      );
    expect(await profit()).toMatchObject({ Costo: 50.05 });
    const back = async (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA devolución costo",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    const r1 = await back(3);
    const r2 = await back(7);
    // Las devoluciones suman exactamente el costo de la venta.
    expect(Number(r1.costTotal) + Number(r2.costTotal)).toBeCloseTo(50.05, 2);
    expect(await profit()).toMatchObject({ Costo: 0 });
    const restored = await fixtureDb.variant.findUnique({
      where: { id: component.id },
    });
    expect(Number(restored.stock)).toBe(10);
    expect(Number(restored.costAvg)).toBe(10.01);
  });

  it("revisión R7: una línea de combo fraccionada anterior se devuelve completa, no en partes", async () => {
    const component = await product("legado", 30, 10);
    const combo = await product("combo legado", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 2,
      reason: "QA stock combo legado",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.4 }],
    });
    const sale = await ok("/sales", input(combo.id, 20));
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    // Como la dejaba una venta anterior: 0.5 combos que consumieron 0.2 (el
    // costo de la venta se ajusta igual, para que los reportes cuadren).
    await fixtureDb.sale.update({
      where: { id: sale.id },
      data: { costTotal: 2 },
    });
    await fixtureDb.saleItem.update({
      where: { id: item.id },
      data: {
        qty: 0.5,
        stockAllocations: (item.stockAllocations as any[]).map((a) => ({
          ...a,
          qty: 0.2,
        })),
      },
    });
    const body = (qty: number) => ({
      saleId: sale.id,
      cashSessionId: session.id,
      reason: "QA devolución legado",
      refundMethod: "credit_note",
      items: [{ saleItemId: item.id, qty, restock: true }],
    });
    expect((await request("/returns", body(0.3))).status).toBe(400);
    await ok("/returns", body(0.5));
    const move = await fixtureDb.inventoryMovement.findFirstOrThrow({
      where: { variantId: component.id, refId: sale.id, type: "return" },
    });
    expect(Number(move.qty)).toBe(0.2);
  });

  it("R6-03: la recuperación no concilia recepciones con líneas incompletas; la completa sigue en 55", async () => {
    const v = await product("recepción", 100, 25);
    const supplier = await ok("/suppliers", {
      name: "QA R7 recuperación " + suffix,
    });
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [{ variantId: v.id, qty: 20, unitCost: 25 }],
    });
    const user = await fixtureDb.user.findFirstOrThrow();
    const legacyReceipt = (items: unknown, freight = 0, otherCosts = 0) =>
      fixtureDb.goodsReceipt.create({
        data: {
          orderId: order.id,
          freight,
          otherCosts,
          items,
          userId: user.id,
          branchId: "main",
        },
      });
    const incomplete = [
      await legacyReceipt([{ qty: 1, cost: 25 }, { qty: 1 }]),
      await legacyReceipt([{ qty: 1, cost: 25 }, { cost: 25 }]),
      await legacyReceipt([{ qty: 1, cost: 25 }, {}]),
      await legacyReceipt(["línea", { qty: 1, cost: 25 }]),
      await legacyReceipt([{ qty: 0, cost: 25 }]),
      await legacyReceipt([]),
    ];
    const complete = await legacyReceipt([{ qty: 2, cost: 25 }], 4, 1);
    // Base que ya aplicó la versión con el error: un total parcial de 25.
    const alreadyWrong = await legacyReceipt([
      { qty: 1, cost: 25 },
      { qty: 1 },
    ]);
    await fixtureDb.goodsReceipt.update({
      where: { id: alreadyWrong.id },
      data: { total: 25, supplierId: supplier.id },
    });
    for (let run = 0; run < 2; run++) {
      await runMigrationSql("202610060001_round6_audit");
      await runMigrationSql("202610070001_round7");
    }
    for (const r of [...incomplete, alreadyWrong]) {
      const row = await fixtureDb.goodsReceipt.findUnique({
        where: { id: r.id },
      });
      expect(row.total, JSON.stringify(r.items)).toBeNull();
    }
    const ok55 = await fixtureDb.goodsReceipt.findUnique({
      where: { id: complete.id },
    });
    expect(ok55.supplierId).toBe(supplier.id);
    expect(Number(ok55.total)).toBe(55);
    const report = async () =>
      (await ok(`/reports/purchases?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Proveedor === supplier.name,
      );
    expect(await report()).toMatchObject({
      Compras: 55,
      Pendiente: 55,
      Sin_conciliar: incomplete.length + 1,
    });
    await ok("/supplier-payments", {
      supplierId: supplier.id,
      amount: 55,
      method: "transfer",
    });
    expect(await report()).toMatchObject({ Pagado: 55, Pendiente: 0 });
  });
});
// Ejecuta el importador real contra la misma base que la API.
const runImport = async (rows: unknown[][], ...flags: string[]) => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const ExcelJS = requireApi("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario 2026");
  ws.addRow([
    "ID",
    "DESCRIPCION",
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIO DETALLE",
  ]);
  rows.forEach((r) => ws.addRow(r));
  const file = join(mkdtempSync(join(tmpdir(), "r8-")), "inventario.xlsx");
  await wb.xlsx.writeFile(file);
  // tsx se lanza con node y su entrada resuelta: el atajo de .bin es un guion
  // de sh y en Windows spawn responde ENOENT.
  const run = await runNode(
    [
      requireApi.resolve("tsx/cli"),
      "scripts/import-inventario.ts",
      file,
      ...flags,
    ],
    process.env,
  );
  return { status: run.status, out: run.stdout + run.stderr };
};

// Ronda 8: regresiones exigidas por la auditoría R7 de ChatGPT
// (docs/AUDITORIA_RONDA7.md).
describe("Ronda 8 · auditoría R7 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  it("R7-01: un código que ya es de otro producto detiene la carga sin escribir", async () => {
    const code = "98765" + Date.now().toString().slice(-8);
    const a = await ok("/products", {
      name: "QA R8 existente " + suffix,
      sku: "R8A-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R8AV-" + randomUUID().slice(0, 8),
          barcode: code,
          price: 20,
          costAvg: 10,
        },
      ],
    });
    products.push(a);
    const before = await fixtureDb.variant.count();
    // Como el caso de ChatGPT: ID y referencia iguales al código de barras de A.
    const r1 = await runImport([
      [code, "QA R8 producto B", code, "Ropa deportiva", 2, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(new RegExp("el código " + code + " ya es de"));
    // REFERENCIA igual al SKU de A en una fila con otro ID.
    const r2 = await runImport([
      [
        "R8-" + suffix,
        "QA R8 producto C",
        a.variants[0].sku,
        "Ropa deportiva",
        1,
        10,
        20,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/ya es de/);
    expect(await fixtureDb.variant.count()).toBe(before);
    expect(
      await fixtureDb.variant.findFirst({ where: { sku: code } }),
    ).toBeNull();
  });

  it("R7-03: una carga no apaga el lote obligatorio de una categoría sin pedirlo", async () => {
    const name = "QA R8 lotes " + suffix;
    const category = await ok("/categories", {
      name,
      requiresLot: true,
      requiresExpiry: true,
    });
    const id = "R8L-" + randomUUID().slice(0, 6);
    const r = await runImport([[id, "QA R8 con lote", id, name, 3, 10, 20]]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(/exige lote o vencimiento/);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: true, requiresExpiry: true });
    expect(
      await fixtureDb.variant.findFirst({ where: { sku: id } }),
    ).toBeNull();
    // Pedido explícito: se desactiva y queda en la bitácora.
    const forced = await runImport(
      [[id, "QA R8 con lote", id, name, 3, 10, 20]],
      "--sin-lotes",
    );
    expect(forced.status, forced.out).toBe(0);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: false, requiresExpiry: false });
    expect(
      await fixtureDb.auditLog.count({
        where: {
          entityId: category.id,
          action: "category_lots_disabled_by_import",
        },
      }),
    ).toBe(1);
    // Una recarga de lo ya cargado no toca la categoría.
    await fixtureDb.category.update({
      where: { id: category.id },
      data: { requiresLot: true, requiresExpiry: true },
    });
    const again = await runImport([
      [id, "QA R8 con lote", id, name, 3, 10, 20],
    ]);
    expect(again.status, again.out).toBe(0);
    expect(again.out).toMatch(/1 ya cargados sin cambios/);
    expect(
      await fixtureDb.category.findUnique({ where: { id: category.id } }),
    ).toMatchObject({ requiresLot: true, requiresExpiry: true });
    const v = await fixtureDb.variant.findFirstOrThrow({ where: { sku: id } });
    await request(
      "/products/" + v.productId,
      { active: false },
      ownerToken,
      "PATCH",
    );
  });

  it("R7-04: el reporte de utilidad usa el costo registrado en cada devolución parcial", async () => {
    const product = async (label: string, price: number, costAvg: number) => {
      const p = await ok("/products", {
        name: "QA R8 " + label + " " + suffix,
        sku: "R8-" + randomUUID().slice(0, 8),
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        taxRate: 0,
        variants: [
          {
            sku: "R8V-" + randomUUID().slice(0, 8),
            barcode: "R8B-" + randomUUID().slice(0, 8),
            price,
            costAvg,
          },
        ],
      });
      products.push(p);
      return p.variants[0];
    };
    const component = await product("comp parcial", 30, 10.01);
    const combo = await product("combo parcial", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA R8 stock",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const profit = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R8 combo parcial " + suffix,
      ).Costo;
    const back = (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA R8 devolución",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    expect(await profit()).toBe(50.05);
    const first = await back(3);
    expect(Number(first.costTotal)).toBe(15.02);
    // El estado intermedio: 50.05 − 15.02 = 35.03.
    expect(await profit()).toBe(35.03);
    await back(7);
    expect(await profit()).toBe(0);
  });
});

// Ronda 9: regresiones exigidas por la auditoría R8 de ChatGPT
// (docs/AUDITORIA_RONDA8.md).
describe("Ronda 9 · auditoría R8 de ChatGPT", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const counts = async () => ({
    categories: await fixtureDb.category.count(),
    products: await fixtureDb.product.count(),
    variants: await fixtureDb.variant.count(),
    movements: await fixtureDb.inventoryMovement.count(),
  });

  it("R8-01: un código igual salvo mayúsculas al de otro producto detiene la carga", async () => {
    const tag = randomUUID().slice(0, 6).toUpperCase();
    const a = await ok("/products", {
      name: "QA R9 dueño " + suffix,
      sku: "R9A-" + tag,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "qa-case-owner-" + tag.toLowerCase(),
          barcode: "QA-R9-CASE" + tag,
          price: 20,
          costAvg: 10,
        },
      ],
    });
    products.push(a);
    const before = await counts();
    // Contra la base: el ID en minúsculas es el código de barras de A.
    const lower = "qa-r9-case" + tag.toLowerCase();
    const r1 = await runImport([
      [lower, "QA R9 producto B", lower, "Ropa deportiva", 2, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(/ya es de/);
    // Entre filas: la REFERENCIA de una fila es el ID de otra en mayúsculas.
    const r2 = await runImport([
      [
        "R9X-" + tag,
        "QA R9 fila A",
        "QA-R9-ROW" + tag,
        "Ropa deportiva",
        1,
        10,
        20,
      ],
      [
        "qa-r9-row" + tag.toLowerCase(),
        "QA R9 fila B",
        "",
        "Ropa deportiva",
        1,
        10,
        20,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/es el ID de otra fila/);
    // IDs repetidos salvo mayúsculas.
    const r3 = await runImport([
      ["R9Y-" + tag, "QA R9 Y1", "", "Ropa deportiva", 1, 10, 20],
      ["r9y-" + tag.toLowerCase(), "QA R9 Y2", "", "Ropa deportiva", 1, 10, 20],
    ]);
    expect(r3.status).not.toBe(0);
    expect(r3.out).toMatch(/repetido/);
    expect(await counts()).toEqual(before);
  });

  it("R8-02: una devolución anterior a la ronda 8 se concilia con su costo contabilizado", async () => {
    const product = async (label: string, price: number, costAvg: number) => {
      const p = await ok("/products", {
        name: "QA R9 " + label + " " + suffix,
        sku: "R9-" + randomUUID().slice(0, 8),
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        taxRate: 0,
        variants: [
          {
            sku: "R9V-" + randomUUID().slice(0, 8),
            barcode: "R9B-" + randomUUID().slice(0, 8),
            price,
            costAvg,
          },
        ],
      });
      products.push(p);
      return p.variants[0];
    };
    const component = await product("comp hist", 30, 10.01);
    const combo = await product("combo hist", 20, 0);
    await ok("/inventory/adjustments", {
      variantId: component.id,
      qty: 10,
      reason: "QA R9 stock",
    });
    await ok("/kits", {
      kitVariantId: combo.id,
      components: [{ componentVariantId: component.id, qty: 0.5 }],
    });
    const sale = await ok("/sales", {
      ...input(combo.id, 200),
      items: [{ variantId: combo.id, qty: 10 }],
    });
    expect(Number(sale.costTotal)).toBe(50.05);
    const item = await fixtureDb.saleItem.findFirstOrThrow({
      where: { saleId: sale.id },
    });
    const row = async () =>
      (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
        (r: any) => r.Producto === "QA R9 combo hist " + suffix,
      );
    const back = (qty: number) =>
      ok("/returns", {
        saleId: sale.id,
        cashSessionId: session.id,
        reason: "QA R9 devolución",
        refundMethod: "credit_note",
        items: [{ saleItemId: item.id, qty, restock: true }],
      });
    const first = await back(3);
    expect(Number(first.costTotal)).toBe(15.02);
    // Como la guardaba la ronda 7: líneas sin costo.
    const stored = await fixtureDb.saleReturn.findUniqueOrThrow({
      where: { id: first.id },
    });
    await fixtureDb.saleReturn.update({
      where: { id: first.id },
      data: {
        items: (stored.items as any[]).map(({ cost: _cost, ...p }) => p),
      },
    });
    expect((await row()).Costo).toBe(35.03);
    // Repetir la lectura no cambia nada.
    expect((await row()).Costo).toBe(35.03);
    await back(7);
    expect(await row()).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
      Utilidad: 0,
    });
  });

  it("R8-03: una carga que se detiene en la validación no deja cambios", async () => {
    const lotName = "QA R9 lotes " + suffix;
    await ok("/categories", {
      name: lotName,
      requiresLot: true,
      requiresExpiry: true,
    });
    const tag = randomUUID().slice(0, 6);
    const before = await counts();
    const newCat = "QA R9 nueva " + suffix;
    const r1 = await runImport([
      ["R9N-" + tag, "QA R9 nueva", "", newCat, 1, 10, 20],
      ["R9L-" + tag, "QA R9 con lote", "", lotName, 1, 10, 20],
    ]);
    expect(r1.status).not.toBe(0);
    expect(r1.out).toMatch(/exige lote o vencimiento/);
    expect(
      await fixtureDb.category.findUnique({ where: { name: newCat } }),
    ).toBeNull();
    expect(await counts()).toEqual(before);
    // Precio fuera del límite de Decimal(14,2) en la segunda fila.
    const r2 = await runImport([
      ["R9P-" + tag, "QA R9 válido", "", "Ropa deportiva", 1, 10, 20],
      [
        "R9Q-" + tag,
        "QA R9 enorme",
        "",
        "Ropa deportiva",
        1,
        10,
        1000000000000,
      ],
    ]);
    expect(r2.status).not.toBe(0);
    expect(r2.out).toMatch(/máximo/);
    expect(await counts()).toEqual(before);
  });
});

// Ronda 9: hallazgos confirmados de la revisión adversarial de Claude
// (docs/validacion/ronda9-revision-adversarial.json). Un bloque por área.
// Área caja: ventas en espera (el resto de la caja se prueba en el navegador).
describe("Ronda 9 · revisión · caja", () => {
  it("R9-caja-4: la venta en espera guarda el descuento por monto, el global y el nombre, y sólo se recupera una vez", async () => {
    const cats = await ok("/categories");
    const p = await ok("/products", {
      name: "QA R9 caja espera " + suffix,
      sku: "R9CJ-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R9CJV-" + randomUUID().slice(0, 8),
          barcode: "R9CJB-" + randomUUID().slice(0, 8),
          price: 1500,
          costAvg: 700,
        },
      ],
    });
    products.push(p);
    const variantId = p.variants[0].id;
    // Más que el importe de la línea (2 × 1,500): se rechaza como en la venta.
    const tooMuch = await request("/quotes", {
      type: "held",
      items: [{ variantId, qty: 2, discountAmount: 3000.01 }],
    });
    expect(tooMuch.status).toBe(400);
    const held = await ok("/quotes", {
      type: "held",
      globalDiscount: 5,
      items: [
        {
          variantId,
          qty: 2,
          discountPercent: 0,
          discountAmount: 200,
          name: "QA R9 caja espera",
        },
      ],
    });
    const listed = (await ok("/quotes")).find((q: any) => q.id === held.id);
    expect(Number(listed.globalDiscount)).toBe(5);
    expect(listed.items[0]).toMatchObject({
      variantId,
      qty: 2,
      discountAmount: 200,
      name: "QA R9 caja espera",
    });
    // Dos clics a la vez: sólo uno recupera la venta (R9-caja-5).
    const both = await Promise.all([
      request("/quotes/" + held.id + "/convert", {}),
      request("/quotes/" + held.id + "/convert", {}),
    ]);
    expect(both.filter((r) => r.status < 400)).toHaveLength(1);
    expect((await ok("/quotes")).some((q: any) => q.id === held.id)).toBe(
      false,
    );
  });
});
// R9-REVISION: offline
// Área códigos: un SKU o código de barras identifica un solo producto sin
// distinguir mayúsculas ni campo, como lo busca la caja.
describe("Ronda 9 · revisión · códigos", () => {
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const ropa = () => cats.find((c: any) => c.name === "Ropa deportiva").id;
  // Cuántas variantes encuentra la caja con este código.
  const holders = async (code: string) =>
    Number(
      (
        await fixtureDb.$queryRaw`SELECT count(*)::int AS n FROM "Variant"
          WHERE lower(sku) = lower(${code}) OR lower(barcode) = lower(${code})`
      )[0].n,
    );
  const productBody = (label: string, variants: any[], sku?: string) => ({
    name: "QA R9 códigos " + label + " " + suffix,
    sku: sku ?? "R9COD-" + randomUUID().slice(0, 8),
    categoryId: ropa(),
    variants: variants.map((v) => ({ price: 20, costAvg: 10, ...v })),
  });
  const owner = async (label: string, sku: string, barcode: string) => {
    const p = await ok("/products", productBody(label, [{ sku, barcode }]));
    products.push(p);
    return p;
  };
  const importRows = async (rows: unknown[][]) => {
    const ExcelJS = requireApi("exceljs");
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Productos");
    ws.addRow(["Nombre", "SKU", "ID categoría", "Código", "Precio", "Costo"]);
    rows.forEach((r) => ws.addRow(r));
    const form = new FormData();
    form.set("file", new Blob([await wb.xlsx.writeBuffer()]), "productos.xlsx");
    const r = await fetch(base + "/products/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    return { status: r.status, body: await r.json() };
  };
  const quickLine = (barcode: string, qty = 5) => ({
    quick: {
      name: "QA R9 códigos rápido " + suffix,
      categoryId: ropa(),
      price: 20,
      cost: 10,
      barcode,
      variant: "Única",
    },
    qty,
    unitCost: 10,
  });

  it("R9-codigos-1: crear, editar, la matriz y la importación rechazan un código que la caja confundiría con otro producto", async () => {
    const tag = randomUUID().slice(0, 8).toUpperCase();
    const a = await owner(
      "A",
      "r9cod-a-" + tag.toLowerCase(),
      "R9COD-X-" + tag,
    );
    const { sku: aSku, barcode: aBarcode } = a.variants[0];
    // (1) SKU = barras de A en minúsculas; (2) SKU = barras de A (otro campo).
    for (const sku of [aBarcode.toLowerCase(), aBarcode]) {
      const r = await request(
        "/products",
        productBody("B", [{ sku, barcode: "R9COD-B-" + randomUUID() }]),
      );
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(r.body.message).toContain("ya es de «" + a.name + "»");
    }
    // Dos variantes del mismo producto con un código que sólo cambia en
    // mayúsculas.
    const twins = await request(
      "/products",
      productBody("gemelas", [
        { sku: "R9COD-T1-" + tag, barcode: "R9COD-T-" + tag },
        { sku: "R9COD-T2-" + tag, barcode: "r9cod-t-" + tag.toLowerCase() },
      ]),
    );
    expect(twins.status, JSON.stringify(twins.body)).toBe(400);
    expect(twins.body.message).toMatch(/más de una variante/);
    // SKU igual al código de barras de la misma variante sí se permite
    // (así entra el ID del inventario).
    const d = await owner("D", "R9COD-D-" + tag, "R9COD-D-" + tag);
    const dv = d.variants[0];
    // (3) PATCH: barras de D = SKU de A en mayúsculas.
    const patched = await request(
      "/variants/" + dv.id,
      { barcode: aSku.toUpperCase() },
      token,
      "PATCH",
    );
    expect(patched.status, JSON.stringify(patched.body)).toBe(400);
    expect(patched.body.message).toContain("ya es de «" + a.name + "»");
    // Reenviar sus propios códigos (aun en otras mayúsculas) no es conflicto.
    await ok(
      "/variants/" + dv.id,
      { sku: dv.sku, barcode: dv.barcode.toLowerCase(), price: 25 },
      token,
      "PATCH",
    );
    // Matriz: el código generado (SKU del producto + "-2") ya es, en
    // minúsculas, el de otro producto.
    const m = await ok(
      "/products",
      productBody(
        "M",
        [{ sku: "R9COD-M1-" + tag, barcode: "R9COD-M1-" + tag }],
        "R9COD-M-" + tag,
      ),
    );
    products.push(m);
    await owner(
      "MB",
      "R9COD-MB-" + tag,
      ("R9COD-M-" + tag + "-2").toLowerCase(),
    );
    const matrix = await request("/products/" + m.id + "/variants", {
      attributes: { talla: ["S"] },
      price: 20,
      costAvg: 10,
    });
    expect(matrix.status, JSON.stringify(matrix.body)).toBe(400);
    expect(matrix.body.message).toContain("ya es de «QA R9 códigos MB");
    // Importación: una fila con las barras de A en minúsculas, o dos filas
    // que comparten código; no se escribe ninguna (tampoco la fila válida).
    const before = await fixtureDb.product.count();
    const fromFile = await importRows([
      [
        "QA R9 códigos fila ok " + suffix,
        "R9COD-OK-" + tag,
        ropa(),
        "R9COD-OKB-" + tag,
        20,
        10,
      ],
      [
        "QA R9 códigos fila A " + suffix,
        "R9COD-F-" + tag,
        ropa(),
        aBarcode.toLowerCase(),
        20,
        10,
      ],
    ]);
    expect(fromFile.status, JSON.stringify(fromFile.body)).toBe(400);
    expect(fromFile.body.message).toContain("ya es de «" + a.name + "»");
    const betweenRows = await importRows([
      [
        "QA R9 códigos fila 1 " + suffix,
        "R9COD-R1-" + tag,
        ropa(),
        "R9COD-RB-" + tag,
        20,
        10,
      ],
      [
        "QA R9 códigos fila 2 " + suffix,
        "r9cod-rb-" + tag.toLowerCase(),
        ropa(),
        "R9COD-R2-" + tag,
        20,
        10,
      ],
    ]);
    expect(betweenRows.status, JSON.stringify(betweenRows.body)).toBe(400);
    expect(betweenRows.body.message).toMatch(/más de una variante/);
    expect(await fixtureDb.product.count()).toBe(before);
    // Cada código sigue siendo de un solo producto en la caja.
    for (const code of [
      aSku,
      aBarcode,
      dv.sku,
      "R9COD-T-" + tag,
      "R9COD-RB-" + tag,
    ])
      expect(await holders(code), code).toBeLessThanOrEqual(1);
    expect(await holders(aBarcode)).toBe(1);
    expect(await holders("R9COD-M-" + tag + "-2")).toBe(1);
  });

  it("R9-codigos-1: dos altas a la vez con el mismo código en otras mayúsculas dejan sólo una", async () => {
    const tag = randomUUID().slice(0, 8).toUpperCase();
    const both = await Promise.all(
      ["R9COD-RACE-" + tag, "r9cod-race-" + tag.toLowerCase()].map(
        (barcode, i) =>
          request(
            "/products",
            productBody("carrera " + i, [
              { sku: "R9COD-RACE" + i + "-" + tag, barcode },
            ]),
          ),
      ),
    );
    for (const r of both) if (r.status < 400) products.push(r.body);
    expect(both.filter((r) => r.status < 400)).toHaveLength(1);
    expect(both.filter((r) => r.status === 400)).toHaveLength(1);
    expect(await holders("R9COD-RACE-" + tag)).toBe(1);
  });

  it("R9-codigos-2 y R9-codigos-3: el producto rápido de Mercancía rechaza un código que ya existe con otras mayúsculas", async () => {
    const tag = randomUUID().slice(0, 8).toUpperCase();
    const a = await owner("A rápido", "R9COD-QS-" + tag, "QA-R9-CASE" + tag);
    const { sku: aSku, barcode: aBarcode } = a.variants[0];
    // Las barras de A en minúsculas (lo que se escribió a mano) o su SKU.
    for (const barcode of [aBarcode.toLowerCase(), aSku.toLowerCase()]) {
      const r = await request("/merchandise/operations", {
        id: randomUUID(),
        direction: "entry",
        items: [quickLine(barcode)],
      });
      expect(r.status, JSON.stringify(r.body)).toBe(400);
      expect(r.body.message).toContain("ya es de «" + a.name + "»");
    }
    // Dos productos rápidos con el mismo código en una misma entrada.
    const twice = await request("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      items: [
        quickLine("R9COD-NEW-" + tag),
        quickLine("r9cod-new-" + tag.toLowerCase()),
      ],
    });
    expect(twice.status, JSON.stringify(twice.body)).toBe(400);
    expect(await holders(aBarcode)).toBe(1);
    expect(await holders("R9COD-NEW-" + tag)).toBe(0);
    expect(Number((await ok("/products/" + a.id)).variants[0].stock)).toBe(0);
    // Con un código nuevo, el producto rápido se crea.
    const created = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      items: [quickLine("R9COD-NEW-" + tag)],
    });
    const v = await fixtureDb.variant.findUnique({
      where: { id: created.variantIds[0] },
      include: { product: true },
    });
    products.push(v.product);
    expect(Number(v.stock)).toBe(5);
  });
});
// Área dinero: devoluciones, costo contabilizado, abonos y reportes.
describe("Ronda 9 · revisión · dinero", () => {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const cents = (value: number) => Math.round(value * 100) / 100;
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const product = async (
    label: string,
    price: number,
    costAvg: number,
    stock = 0,
    taxRate = 0,
  ) => {
    const p = await ok("/products", {
      name: "QA R9D " + label + " " + suffix,
      sku: "R9D-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate,
      variants: [
        {
          sku: "R9DV-" + randomUUID().slice(0, 8),
          barcode: "R9DB-" + randomUUID().slice(0, 8),
          price,
          costAvg,
        },
      ],
    });
    products.push(p);
    if (stock)
      await ok("/inventory/adjustments", {
        variantId: p.variants[0].id,
        qty: stock,
        reason: "QA R9 dinero stock",
      });
    return p.variants[0];
  };
  const kit = async (label: string, componentId: string, qty: number) => {
    const v = await product(label, 20, 0);
    await ok("/kits", {
      kitVariantId: v.id,
      components: [{ componentVariantId: componentId, qty }],
    });
    return v;
  };
  // Se paga de más en efectivo: el cambio no afecta lo que se prueba.
  const sell = (items: { variantId: string; qty: number }[]) =>
    ok("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items,
      payments: [{ method: "cash", amount: 10000 }],
    });
  const lineOf = (saleId: string, variantId: string) =>
    fixtureDb.saleItem.findFirstOrThrow({ where: { saleId, variantId } });
  const returnBody = (saleId: string, items: any[], refundMethod: string) => ({
    saleId,
    cashSessionId: session.id,
    reason: "QA R9 dinero devolución",
    refundMethod,
    items: items.map((i) => ({ restock: true, ...i })),
  });
  const giveBack = (
    saleId: string,
    items: any[],
    refundMethod = "credit_note",
  ) => ok("/returns", returnBody(saleId, items, refundMethod));
  const profitRow = async (label: string) =>
    (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
      (r: any) => r.Producto === "QA R9D " + label + " " + suffix,
    );
  const dashboard = (from = today, to = today) =>
    ok(`/dashboard/summary?from=${from}&to=${to}`);
  const expectedCash = async () =>
    (await ok("/cash-sessions")).find((c: any) => c.id === session.id).expected
      .cash;
  // Así guardaban las devoluciones las rondas 3 a 7: sin importes por línea.
  const asLegacyReturn = async (id: string, costTotal?: number) => {
    const stored = await fixtureDb.saleReturn.findUniqueOrThrow({
      where: { id },
    });
    await fixtureDb.saleReturn.update({
      where: { id },
      data: {
        items: (stored.items as any[]).map(
          ({ cost: _c, total: _t, tax: _x, ...p }) => p,
        ),
        ...(costTotal === undefined ? {} : { costTotal }),
      },
    });
  };
  const withCredit = async (run: () => Promise<void>) => {
    const settings = await ok("/settings");
    await ok(
      "/settings",
      {
        ...settings,
        allowCreditSales: true,
        creditApprovalThreshold: 100000,
      },
      token,
      "PUT",
    );
    try {
      await run();
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  };
  const creditCustomer = () =>
    ok("/customers", {
      name: "QA R9D crédito " + randomUUID().slice(0, 6),
      creditLimit: 100000,
    });
  const creditSale = (
    variantId: string,
    qty: number,
    amount: number,
    customerId: string,
  ) =>
    ok("/sales", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      items: [{ variantId, qty }],
      customerId,
      creditDueDate: "2030-01-01T12:00:00.000Z",
      payments: [{ method: "credit", amount }],
      expectedTotal: amount,
    });
  const installment = (saleId: string, method: string, amount: number) =>
    request("/sales/" + saleId + "/installments", {
      offlineUuid: randomUUID(),
      cashSessionId: session.id,
      method,
      amount,
      ...(method === "transfer"
        ? { bank: "QA Banco", reference: "QA-" + randomUUID().slice(0, 8) }
        : {}),
      ...(method === "card"
        ? { cardLast4: "4242", approvalCode: "QA-" + randomUUID().slice(0, 6) }
        : {}),
    });
  const balance = async (saleId: string) =>
    Number(
      (await fixtureDb.sale.findUniqueOrThrow({ where: { id: saleId } }))
        .creditBalance,
    );

  it("R9-dinero-1: la devolución que completa la línea descuenta el costo de la devolución histórica", async () => {
    const component = await product("comp hist", 30, 3.33, 10);
    const combo = await kit("combo hist", component.id, 0.5);
    const base = (await dashboard()).costTotal;
    const sale = await sell([{ variantId: combo.id, qty: 10 }]);
    expect(Number(sale.costTotal)).toBe(16.65);
    const line = await lineOf(sale.id, combo.id);
    expect(Number(line.unitCost)).toBe(1.67);
    // Venta anterior a la ronda 7: asignaciones sin "exact".
    await fixtureDb.saleItem.update({
      where: { id: line.id },
      data: {
        stockAllocations: (line.stockAllocations as any[]).map(
          ({ exact: _e, ...a }) => a,
        ),
      },
    });
    const first = await giveBack(sale.id, [{ saleItemId: line.id, qty: 5 }]);
    // Las rondas 3 a 7 contabilizaban unitCost × qty = 1.67 × 5.
    await asLegacyReturn(first.id, 8.35);
    const second = await giveBack(sale.id, [{ saleItemId: line.id, qty: 5 }]);
    expect(Number(second.costTotal)).toBe(8.3);
    expect(await profitRow("combo hist")).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
      Utilidad: 0,
    });
    expect(cents((await dashboard()).costTotal - base)).toBe(0);

    // Varias líneas fraccionarias: las rondas 3 a 6 redondeaban la suma.
    const a = await product("frac A", 10, 0.49, 5);
    const b = await product("frac B", 10, 0.49, 5);
    const base2 = (await dashboard()).costTotal;
    const sale2 = await sell([
      { variantId: a.id, qty: 0.5 },
      { variantId: b.id, qty: 0.5 },
    ]);
    expect(Number(sale2.costTotal)).toBe(0.5);
    const la = await lineOf(sale2.id, a.id),
      lb = await lineOf(sale2.id, b.id);
    const old = await giveBack(sale2.id, [
      { saleItemId: la.id, qty: 0.25 },
      { saleItemId: lb.id, qty: 0.25 },
    ]);
    // money(0.49 × 0.25 × 2) = 0.25, no 0.12 + 0.12.
    await asLegacyReturn(old.id, 0.25);
    await giveBack(sale2.id, [
      { saleItemId: la.id, qty: 0.25 },
      { saleItemId: lb.id, qty: 0.25 },
    ]);
    expect(cents((await dashboard()).costTotal - base2)).toBe(0);
    expect((await profitRow("frac A")).Costo).toBe(0);
    expect((await profitRow("frac B")).Costo).toBe(0);
  });

  it("R9-dinero-2: devolver de una en una reembolsa exactamente lo cobrado y su ITBIS", async () => {
    const v = await product("parcial", 33.35, 10, 10, 18);
    const cashBefore = await expectedCash();
    const sale = await ok("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items: [{ variantId: v.id, qty: 3 }],
      globalDiscount: 10,
      discountReason: "Descuento autorizado en pruebas",
      payments: [{ method: "cash", amount: 90.05 }],
      expectedTotal: 90.05,
    });
    expect(Number(sale.total)).toBe(90.05);
    expect(Number(sale.taxTotal)).toBe(13.74);
    // R9-dinero-11: el resumen de la venta cuadra.
    expect(cents(Number(sale.subtotal) - Number(sale.discountTotal))).toBe(
      90.05,
    );
    const line = await lineOf(sale.id, v.id);
    const back = [];
    for (let n = 0; n < 3; n++)
      back.push(
        await giveBack(sale.id, [{ saleItemId: line.id, qty: 1 }], "cash"),
      );
    const add = (field: string) =>
      cents(back.reduce((s, r) => s + Number(r[field]), 0));
    expect(add("refundAmount")).toBe(90.05);
    expect(add("total")).toBe(90.05);
    expect(add("taxTotal")).toBe(13.74);
    expect(await expectedCash()).toBe(cashBefore);
    expect(await profitRow("parcial")).toMatchObject({
      Ventas: 0,
      Costo: 0,
      Unidades: 0,
    });
  });

  it("R9-dinero-3: una venta a crédito con un abono por transferencia pendiente no se devuelve sin resolverlo", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("credito", 500, 100, 10);
      const ret = (saleId: string, saleItemId: string, qty: number) =>
        request("/returns", returnBody(saleId, [{ saleItemId, qty }], "cash"));
      // El cliente abonó todo por transferencia y devuelve todo.
      const s1 = await creditSale(v.id, 2, 1000, customer.id);
      const t1 = (await installment(s1.id, "transfer", 1000)).body;
      expect(t1.status).toBe("pending_verification");
      const blocked = await ret(s1.id, s1.items[0].id, 2);
      expect(blocked.status).toBe(400);
      expect(blocked.body.message).toMatch(/transferencia pendientes/);
      await ok("/payments/" + t1.id + "/verify", {});
      const r1 = await ret(s1.id, s1.items[0].id, 2);
      expect(r1.status).toBe(201);
      expect(Number(r1.body.refundAmount)).toBe(1000);
      // Abono pendiente de 600 y devolución de 500: el saldo quedaría en 500.
      const s2 = await creditSale(v.id, 2, 1000, customer.id);
      const t2 = (await installment(s2.id, "transfer", 600)).body;
      expect((await ret(s2.id, s2.items[0].id, 1)).status).toBe(400);
      // Una transferencia que no llegó se rechaza y deja de bloquear.
      await ok("/payments/" + t2.id + "/reject", {
        reason: "QA no llegó la transferencia",
      });
      expect((await request("/payments/" + t2.id + "/verify", {})).status).toBe(
        400,
      );
      const r2 = await ret(s2.id, s2.items[0].id, 1);
      expect(r2.status).toBe(201);
      expect(Number(r2.body.refundAmount)).toBe(0);
      expect(await balance(s2.id)).toBe(500);
      // Un abono pendiente que cabe en el saldo restante no bloquea.
      const s3 = await creditSale(v.id, 2, 1000, customer.id);
      const t3 = (await installment(s3.id, "transfer", 300)).body;
      const r3 = await ret(s3.id, s3.items[0].id, 1);
      expect(r3.status).toBe(201);
      expect(Number(r3.body.refundAmount)).toBe(0);
      await ok("/payments/" + t3.id + "/verify", {});
      expect(await balance(s3.id)).toBe(200);
    });
  });

  it("R9-dinero-4: anular una venta recalcula el costo promedio igual que una devolución", async () => {
    for (const direct of [true, false]) {
      const v = await product(direct ? "anula" : "anula comp", 150, 100, 10);
      const sold = direct ? v : await kit("anula combo", v.id, 1);
      const sale = await sell([{ variantId: sold.id, qty: 10 }]);
      const order = await ok("/purchase-orders", {
        supplierId,
        items: [{ variantId: v.id, qty: 10, unitCost: 200 }],
      });
      await ok("/purchase-orders/" + order.id + "/receive", {
        operationId: randomUUID(),
        items: [{ itemId: order.items[0].id, qty: 10 }],
      });
      const variant = () =>
        fixtureDb.variant.findUniqueOrThrow({ where: { id: v.id } });
      expect(Number((await variant()).costAvg)).toBe(200);
      await ok("/sales/" + sale.id + "/void", {
        cashSessionId: session.id,
        reason: "QA R9 dinero anulación",
      });
      const after = await variant();
      expect(Number(after.stock)).toBe(20);
      expect(Number(after.costAvg)).toBe(150);
      const movement = await fixtureDb.inventoryMovement.findFirstOrThrow({
        where: { variantId: v.id, type: "void", refId: sale.id },
      });
      expect(Number(movement.unitCost)).toBe(100);
    }
  });

  it("R9-dinero-5: los importes de dinero aceptan como máximo 2 decimales", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("decimales", 100, 10, 10);
      const sold = await creditSale(v.id, 1, 100, customer.id);
      expect((await installment(sold.id, "cash", 1.005)).status).toBe(400);
      expect(await balance(sold.id)).toBe(100);
      const paid = await installment(sold.id, "cash", 1.01);
      expect(paid.status).toBe(201);
      expect(Number(paid.body.amount)).toBe(1.01);
      expect(await balance(sold.id)).toBe(98.99);
      expect(
        (
          await request("/sales", {
            ...input(v.id, 100),
            payments: [{ method: "cash", amount: 100.005 }],
          })
        ).status,
      ).toBe(400);
      // El descuento por monto no se guarda: sólo se vuelve porcentaje y la
      // línea se cobra redondeada; ver R9-dinero-5-pos.
    });
  });

  it("R9-dinero-5-pos: una venta sin conexión con un descuento de 3 decimales se sincroniza y una inválida no bloquea las demás", async () => {
    const v = await product("centavos caja", 100, 10, 10);
    const offline = (items: any[], amount: number, expectedTotal?: number) => ({
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      capturedAt: new Date().toISOString(),
      cashSessionId: session.id,
      items,
      discountReason: "Descuento autorizado en pruebas",
      payments: [{ method: "cash", amount }],
      ...(expectedTotal === undefined ? {} : { expectedTotal }),
    });
    // La caja convierte el descuento por monto en porcentaje y redondea la
    // línea igual que la API: 100 − 1.004 = 98.996 → 99.00.
    const discounted = offline(
      [{ variantId: v.id, qty: 1, discountAmount: 1.004 }],
      99,
      99,
    );
    const wrongPayment = offline([{ variantId: v.id, qty: 1 }], 100.005);
    const plain = offline([{ variantId: v.id, qty: 1 }], 100, 100);
    const synced = await request("/sales/sync", {
      sales: [discounted, wrongPayment, plain],
    });
    expect(synced.status).toBe(201);
    expect(synced.body.results.map((r: any) => r.status)).toEqual([
      "synced",
      "conflict",
      "synced",
    ]);
    expect(synced.body.results[1].message).toMatch(/2 decimales/);
    expect(Number(synced.body.results[0].sale.total)).toBe(99);
    // El reintento de la misma venta devuelve la ya registrada.
    const again = await ok("/sales/sync", { sales: [discounted] });
    expect(again.results[0].sale.id).toBe(synced.body.results[0].sale.id);
    // En línea también se cobra.
    const online = await request("/sales", {
      ...input(v.id, 100),
      items: [{ variantId: v.id, qty: 1, discountAmount: 0.005 }],
    });
    expect(online.status).toBe(201);
    expect(Number(online.body.total)).toBe(100);
  });

  it("R9-dinero-6: el costo de una devolución de la ronda 7 se reconstruye por línea", async () => {
    const labels = ["r7 A", "r7 B", "r7 C"];
    const variants = [
      await product(labels[0], 10, 0.49, 2),
      await product(labels[1], 10, 0.59, 2),
      await product(labels[2], 10, 0.59, 2),
    ];
    const sale = await sell(variants.map((v) => ({ variantId: v.id, qty: 1 })));
    const lines = await Promise.all(variants.map((v) => lineOf(sale.id, v.id)));
    const first = await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 0.01 })),
    );
    // La ronda 7 contabilizaba cada línea: 0.00 / 0.01 / 0.01.
    expect((first.items as any[]).map((p) => p.cost)).toEqual([0, 0.01, 0.01]);
    await asLegacyReturn(first.id);
    await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 0.99 })),
    );
    for (const label of labels)
      expect(await profitRow(label)).toMatchObject({
        Ventas: 0,
        Costo: 0,
        Utilidad: 0,
      });
  });

  it("R9-dinero-7: el costo de una venta anterior a la ronda 7 final coincide en utilidad y dashboard", async () => {
    const component = await product("comp 7", 30, 3.33, 10);
    const k1 = await kit("kit7 A", component.id, 0.5);
    const k2 = await kit("kit7 B", component.id, 0.5);
    const base = (await dashboard()).costTotal;
    const sale = await sell([
      { variantId: k1.id, qty: 1 },
      { variantId: k2.id, qty: 1 },
    ]);
    expect(Number(sale.costTotal)).toBe(3.34);
    // Hasta la ronda 7 en curso: money(Σ costo exacto × qty).
    await fixtureDb.sale.update({
      where: { id: sale.id },
      data: { costTotal: 3.33 },
    });
    const reported = async () =>
      cents(
        (await profitRow("kit7 A")).Costo + (await profitRow("kit7 B")).Costo,
      );
    expect(await reported()).toBe(3.33);
    expect(cents((await dashboard()).costTotal - base)).toBe(3.33);
    const lines = [await lineOf(sale.id, k1.id), await lineOf(sale.id, k2.id)];
    const back = await giveBack(
      sale.id,
      lines.map((l) => ({ saleItemId: l.id, qty: 1 })),
    );
    expect(Number(back.costTotal)).toBe(3.33);
    expect((await profitRow("kit7 A")).Costo).toBe(0);
    expect((await profitRow("kit7 B")).Costo).toBe(0);
    expect(cents((await dashboard()).costTotal - base)).toBe(0);
  });

  it("R9-dinero-8: devoluciones y descuentos no muestra costos a quien no tiene profit:read", async () => {
    const role = await fixtureDb.role.create({
      data: { name: "qa-reportes-" + suffix, permissions: ["reports:read"] },
    });
    const u = await ok("/users", {
      name: "QA reportes " + suffix,
      email: `qa-reportes-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: "765432",
      roleId: role.id,
    });
    actors.push(u);
    const viewer = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const v = await product("sin costo", 50, 20, 2);
    const sale = await sell([{ variantId: v.id, qty: 1 }]);
    await giveBack(sale.id, [
      { saleItemId: (await lineOf(sale.id, v.id)).id, qty: 1 },
    ]);
    expect(
      (
        await request(
          `/reports/profit?from=${today}&to=${today}`,
          undefined,
          viewer,
        )
      ).status,
    ).toBe(403);
    const { rows } = await ok(
      `/reports/returns-discounts?from=${today}&to=${today}`,
      undefined,
      viewer,
    );
    const returns = rows.filter(
      (r: any) => r.Evento === "return" && r.Referencia === sale.id,
    );
    expect(returns.length).toBe(1);
    expect(returns[0].Detalle).toMatch(/NC-/);
    expect(rows.map((r: any) => r.Detalle).join("\n")).not.toMatch(
      /"(cost|costTotal|unitCost|costAvg)"/,
    );
  });

  it("T3: ventas por método exige permiso financiero mientras hay caja abierta", async () => {
    const role = await fixtureDb.role.create({
      data: {
        name: "qa-reporte-ciego-" + suffix,
        permissions: ["reports:read"],
      },
    });
    const user = await ok("/users", {
      name: "QA reporte ciego " + suffix,
      email: `qa-reporte-ciego-${suffix}@example.test`,
      password: "FitStore-QA-2026!",
      pin: "654321",
      roleId: role.id,
    });
    actors.push(user);
    const viewer = (
      await ok(
        "/auth/login",
        { email: user.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const endpoint = `/reports/by-payment?from=${today}&to=${today}`;
    const rowsFor = async (as: string) =>
      (await ok(endpoint, undefined, as)).rows as any[];
    const amount = (rows: any[], method: string, column: string) =>
      Number(rows.find((row) => row.Método === method)?.[column] ?? 0);
    const adminBefore = await rowsFor(token);
    const variant = await product("reporte ciego", 731, 200, 2);
    await ok("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items: [{ variantId: variant.id, qty: 1 }],
      payments: [{ method: "cash", amount: 731 }],
      expectedTotal: 731,
    });

    const [openSession, restrictedUser] = await Promise.all([
      fixtureDb.cashSession.findUniqueOrThrow({ where: { id: session.id } }),
      fixtureDb.user.findUniqueOrThrow({ where: { id: user.id } }),
    ]);
    expect(openSession.closedAt).toBeNull();
    expect(openSession.branchId).toBe(restrictedUser.branchId);

    const restricted = await request(endpoint, undefined, viewer);
    const adminAfter = await rowsFor(token);
    expect(restricted.status).toBe(403);
    expect(
      cents(
        amount(adminAfter, "cash", "Ventas") -
          amount(adminBefore, "cash", "Ventas"),
      ),
    ).toBe(731);
  });

  it("R9-dinero-9: ventas por método no cuenta dos veces el crédito y muestra los cobros el día que entran", async () => {
    await withCredit(async () => {
      const customer = await creditCustomer();
      const v = await product("metodo", 500, 100, 10);
      const snapshot = async () => {
        const { rows } = await ok(
          `/reports/by-payment?from=${today}&to=${today}`,
        );
        const at = (method: string, column: string) =>
          rows.find((r: any) => r.Método === method)?.[column] ?? 0;
        const summary = await dashboard();
        return {
          creditSales: at("credit", "Ventas"),
          cashSales: at("cash", "Ventas"),
          cashCollected: at("cash", "Cobros_de_crédito"),
          cardCollected: at("card", "Cobros_de_crédito"),
          salesColumn: rows.reduce(
            (s: number, r: any) => s + (r.Ventas ?? 0),
            0,
          ),
          dashboardCash:
            summary.payments.find((p: any) => p.name === "cash")?.amount ?? 0,
          fees: summary.fees,
        };
      };
      const before = await snapshot();
      // Venta a crédito y abono en efectivo el mismo día.
      const sold = await creditSale(v.id, 1, 500, customer.id);
      expect((await installment(sold.id, "cash", 500)).status).toBe(201);
      // Abono con tarjeta hoy de una venta del mes pasado.
      const older = await creditSale(v.id, 1, 500, customer.id);
      await fixtureDb.sale.update({
        where: { id: older.id },
        data: { createdAt: new Date(Date.now() - 40 * 86400000) },
      });
      expect((await installment(older.id, "card", 200)).status).toBe(201);
      // Una transferencia sin verificar todavía no es un cobro.
      expect((await installment(older.id, "transfer", 100)).status).toBe(201);
      const after = await snapshot();
      const delta = (key: keyof typeof before) =>
        cents(after[key] - before[key]);
      expect(delta("creditSales")).toBe(500);
      expect(delta("cashSales")).toBe(0);
      expect(delta("salesColumn")).toBe(500);
      expect(delta("cashCollected")).toBe(500);
      expect(delta("cardCollected")).toBe(200);
      expect(delta("dashboardCash")).toBe(0);
      // Comisión de tarjeta del 2.5 % en el período del cobro.
      expect(delta("fees")).toBe(5);
    });
  });

  it("R9-dinero-10: la tendencia compara ingresos netos de devoluciones en ambos períodos", async () => {
    const v = await product("tendencia", 1000, 100, 10);
    // Un día sin otros datos (año 2000 a 2008, al azar para repetir la suite).
    const day = new Date(
      Date.UTC(2000, 0, 2) + Math.floor(Math.random() * 3000) * 86400000,
    )
      .toISOString()
      .slice(0, 10);
    const previous = new Date(Date.parse(day + "T12:00:00-04:00") - 86400000);
    const current = new Date(day + "T12:00:00-04:00");
    const past = await sell([{ variantId: v.id, qty: 1 }]);
    const back = await giveBack(past.id, [
      { saleItemId: (await lineOf(past.id, v.id)).id, qty: 0.5 },
    ]);
    const now = await sell([{ variantId: v.id, qty: 0.5 }]);
    await fixtureDb.sale.update({
      where: { id: past.id },
      data: { createdAt: previous },
    });
    await fixtureDb.saleReturn.update({
      where: { id: back.id },
      data: { createdAt: previous },
    });
    await fixtureDb.sale.update({
      where: { id: now.id },
      data: { createdAt: current },
    });
    const summary = await dashboard(day, day);
    expect(summary.revenue).toBe(500);
    // Antes: 1000 − 500 = 500 de neto; ahora 500: sin variación.
    expect(summary.trend).toBe(0);
  });
});
// Área facturas: factura del proveedor (códigos, equivalencias, números) y
// recepción de órdenes de compra.
describe("Ronda 9 · revisión · facturas", () => {
  let cats: any[];
  beforeAll(async () => {
    cats = await ok("/categories");
  });
  const product = async (label: string) => {
    const p = await ok("/products", {
      name: "QA R9F " + label + " " + suffix,
      sku: "R9F-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R9FV-" + randomUUID().slice(0, 8),
          barcode: "R9FB-" + randomUUID().slice(0, 8),
          price: 1500,
          costAvg: 1200,
        },
      ],
    });
    products.push(p);
    return p;
  };
  async function upload(csv: string) {
    const form = new FormData();
    form.set("file", new Blob([csv], { type: "text/csv" }), "factura.csv");
    form.set("supplierId", supplierId);
    form.set(
      "mapping",
      JSON.stringify({
        code: "codigo",
        description: "descripcion",
        qty: "cantidad",
        unitCost: "costo",
      }),
    );
    const r = await fetch(base + "/merchandise/import", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
    });
    const body = await r.json();
    if (r.status >= 400) throw new Error(r.status + " " + JSON.stringify(body));
    return body;
  }
  it("un código que tienen dos productos queda sin elegir (R9-facturas-1)", async () => {
    const a = await product("Faja chaleco");
    const c = await product("Faja chaleco premium");
    // La API de productos podría rechazar este cruce; se fuerza en la base,
    // como quedaron datos de rondas anteriores.
    await fixtureDb.variant.update({
      where: { id: c.variants[0].id },
      data: { sku: a.variants[0].barcode },
    });
    const draft = await upload(
      `codigo,descripcion,cantidad,costo\n${a.variants[0].barcode},Faja chaleco,2,700\n`,
    );
    expect(draft.lines[0]).toMatchObject({ variantId: null, confidence: 0 });
    expect(draft.lines[0].note).toMatch(/es de 2 productos/);
  });
  it("la equivalencia corregida del proveedor gana al código de la tienda (R9-facturas-2)", async () => {
    const iso = await product("ISO Fresa");
    const top = await product("Top Aurora Lila");
    const code = iso.variants[0].sku;
    const first = await upload(
      `codigo,descripcion,cantidad,costo\n${code},${top.name},1,5\n`,
    );
    // La descripción es de otro producto: no se elige el del código.
    expect(first.lines[0].variantId).toBeNull();
    expect(first.lines[0].productId).toBe(top.id);
    // La persona confirma el Top: se guarda la equivalencia del proveedor.
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      items: [
        {
          variantId: top.variants[0].id,
          qty: 1,
          unitCost: 5,
          supplierCode: code,
        },
      ],
    });
    const second = await upload(
      `codigo,descripcion,cantidad,costo\n${code},Sin parecido,1,5\n`,
    );
    expect(second.lines[0]).toMatchObject({
      variantId: top.variants[0].id,
      confidence: 1,
    });
  });
  it("un código de la tienda con la descripción de otra cosa o de otra variante no se elige (R9-facturas-2)", async () => {
    const iso = await product("ISO Fresa");
    // Un producto que la tienda no tiene, con un código que choca.
    const first = await upload(
      `codigo,descripcion,cantidad,costo\n${iso.variants[0].sku},Top Deportivo Zafiro Lila,1,5\n`,
    );
    expect(first.lines[0]).toMatchObject({
      variantId: null,
      productId: iso.id,
    });
    expect(first.lines[0].note).toMatch(/la descripción no coincide/);
    // El código de la talla S con una factura que dice talla L.
    const top = await ok("/products", {
      // La unicidad pertenece al SKU/barcode. Un sufijo aleatorio en el nombre
      // puede parecer una talla o número de tono y contaminar el parser que
      // precisamente se está verificando aquí.
      name: "QA R9F Top Tallas",
      sku: "R9F-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: ["S", "M", "L"].map((talla) => ({
        sku: "R9FT-" + talla + "-" + randomUUID().slice(0, 8),
        barcode: "R9FTB-" + talla + "-" + randomUUID().slice(0, 8),
        price: 900,
        costAvg: 500,
        attributes: { talla },
      })),
    });
    products.push(top);
    const small = top.variants.find((v: any) => v.attributes.talla === "S");
    const second = await upload(
      `codigo,descripcion,cantidad,costo\n${small.sku},${top.name} talla L,1,5\n${small.sku},${top.name} talla S,1,5\n`,
    );
    expect(second.lines[0]).toMatchObject({
      variantId: null,
      productId: top.id,
    });
    expect(second.lines[0].note).toMatch(/S no coincide|talla S|· S/);
    expect(second.lines[1].variantId).toBe(small.id);
  });
  it("CSV con «;»: «1.250» son 1250 y no 1.25 (R9-facturas-7)", async () => {
    const faja = await product("Faja Reloj de Arena Beige");
    const draft = await upload(
      `codigo;descripcion;cantidad;costo\n${faja.variants[0].sku};Faja Reloj de Arena Beige;2;"1.250"\n`,
    );
    expect(draft.lines[0]).toMatchObject({
      variantId: faja.variants[0].id,
      unitCost: 1250,
    });
  });
  it("reenviar la misma recepción de una orden no la duplica (R9-facturas-8)", async () => {
    const p = await product("Recepción idempotente");
    const variantId = p.variants[0].id;
    const stock = async () =>
      Number(
        (
          await fixtureDb.variant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).stock,
      );
    const start = await stock();
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 10, unitCost: 1000 }],
    });
    const body = {
      operationId: randomUUID(),
      freight: 40,
      items: [{ itemId: order.items[0].id, qty: 4 }],
    };
    const path = "/purchase-orders/" + order.id + "/receive";
    const once = await ok(path, body);
    // Se perdió la respuesta y la persona vuelve a pulsar Guardar.
    const again = await ok(path, body);
    expect(again.id).toBe(once.id);
    expect(await stock()).toBe(start + 4);
    const receipts = () =>
      fixtureDb.goodsReceipt.findMany({ where: { orderId: order.id } });
    expect(await receipts()).toHaveLength(1);
    expect(
      Number(
        (
          await fixtureDb.purchaseItem.findUniqueOrThrow({
            where: { id: order.items[0].id },
          })
        ).receivedQty,
      ),
    ).toBe(4);
    // El mismo id con otros datos se rechaza.
    const changed = await request(path, {
      ...body,
      items: [{ itemId: order.items[0].id, qty: 3 }],
    });
    expect(changed.status).toBe(400);
    expect(changed.body.message).toMatch(/datos distintos/);
    // Recibir el resto y reintentar: devuelve la misma recepción en vez de
    // «La orden ya fue recibida».
    const rest = {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 6 }],
    };
    const last = await ok(path, rest);
    expect((await ok(path, rest)).id).toBe(last.id);
    expect(await receipts()).toHaveLength(2);
    expect(await stock()).toBe(start + 10);
    // Dos envíos a la vez con el mismo id: una sola recepción.
    const other = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 5, unitCost: 1000 }],
    });
    const twice = {
      operationId: randomUUID(),
      items: [{ itemId: other.items[0].id, qty: 2 }],
    };
    const concurrent = await Promise.all([
      request("/purchase-orders/" + other.id + "/receive", twice),
      request("/purchase-orders/" + other.id + "/receive", twice),
    ]);
    expect(concurrent.map((r) => r.status)).toEqual([201, 201]);
    expect(new Set(concurrent.map((r) => r.body.id)).size).toBe(1);
    expect(
      await fixtureDb.goodsReceipt.findMany({ where: { orderId: other.id } }),
    ).toHaveLength(1);
    expect(await stock()).toBe(start + 12);
  });
});
// Área importador: celdas especiales del Excel, filas incompletas, simulación,
// máximo derivado de la existencia y datos editados en la app.
describe("Ronda 9 · revisión · importador", () => {
  const counts = async () => ({
    categories: await fixtureDb.category.count(),
    products: await fixtureDb.product.count(),
    variants: await fixtureDb.variant.count(),
    movements: await fixtureDb.inventoryMovement.count(),
  });
  const variantOf = (sku: string) =>
    fixtureDb.variant.findFirst({ where: { sku }, include: { product: true } });
  // Los productos de prueba no se quedan a la venta.
  const retire = async (...skus: string[]) => {
    for (const sku of skus) {
      const v = await variantOf(sku);
      if (v)
        await request(
          "/products/" + v.productId,
          { active: false },
          ownerToken,
          "PATCH",
        );
    }
  };

  it("R9-importador-1: una celda con hipervínculo o con error de Excel nunca crea «[object Object]»", async () => {
    const tag = randomUUID().slice(0, 6);
    const link = {
      text: "QA R9 faja con vínculo " + tag,
      hyperlink: "https://proveedor.example/faja",
    };
    const before = await counts();
    const r = await runImport([
      ["R9H-" + tag, link, "", "Ropa deportiva", 4, 900, 1800],
      [
        "R9E-" + tag,
        "QA R9 corrector",
        "",
        { formula: "VLOOKUP(A3,X:Y,2,0)", result: { error: "#N/A" } },
        6,
        200,
        450,
      ],
    ]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(
      new RegExp(
        "fila R9E-" + tag + ", SUB-GRUPO: la celda tiene el error #N/A",
      ),
    );
    expect(r.out).not.toMatch(/object/);
    expect(await counts()).toEqual(before);
    expect(
      await fixtureDb.product.count({ where: { name: "[object Object]" } }),
    ).toBe(0);
    // Sin la fila con error, el hipervínculo se carga con su texto.
    const loaded = await runImport([
      ["R9H-" + tag, link, "", "Ropa deportiva", 4, 900, 1800],
    ]);
    expect(loaded.status, loaded.out).toBe(0);
    expect((await variantOf("R9H-" + tag))?.product.name).toBe(link.text);
    await retire("R9H-" + tag);
  });

  it("R9-importador-2: una fila con datos sin DESCRIPCION o sin ID detiene la carga sin escribir", async () => {
    const tag = randomUUID().slice(0, 6);
    const before = await counts();
    const r = await runImport([
      ["R9D-" + tag, "", "", "Ropa deportiva", 5, 900, 1800],
      [null, "QA R9 faja sin código", null, "Ropa deportiva", 3, 900, 1800],
      ["R9K-" + tag, "QA R9 faja completa", "", "Ropa deportiva", 1, 900, 1800],
    ]);
    expect(r.status).not.toBe(0);
    expect(r.out).toMatch(
      new RegExp(
        "fila 2 del Excel \\(ID R9D-" + tag + "\\): falta DESCRIPCION",
      ),
    );
    expect(r.out).toMatch(/fila 3 del Excel: falta ID/);
    expect(await counts()).toEqual(before);
    expect(await variantOf("R9K-" + tag)).toBeNull();
  });

  it("R9-importador-3: --dry-run da las cifras de la carga real, anuncia las categorías y no se detiene por el lote", async () => {
    const tag = randomUUID().slice(0, 6);
    const newCat = "QA R9 simulada " + suffix + tag;
    const lotName = "QA R9 simulada lote " + suffix + tag;
    const lot = await ok("/categories", {
      name: lotName,
      requiresLot: true,
      requiresExpiry: true,
    });
    const rows = [
      ["R9S-" + tag, "QA R9 simulada A", "", newCat, 3, 900, 1800],
      ["R9T-" + tag, "QA R9 simulada B", "", lotName, 5, 200, 450],
    ];
    const before = await counts();
    const sim = await runImport(rows, "--dry-run");
    expect(sim.status, sim.out).toBe(0);
    expect(sim.out).toMatch(
      /Simulación: 2 productos leídos · 2 nuevos \(8 unidades\) · 0 ya cargados/,
    );
    expect(sim.out).toContain("Crearía la categoría «" + newCat + "»");
    expect(sim.out).toContain("«" + lotName + "» exige lote o vencimiento");
    expect(sim.out).toMatch(/--sin-lotes/);
    expect(await counts()).toEqual(before);
    expect(
      await fixtureDb.category.findUnique({ where: { id: lot.id } }),
    ).toMatchObject({ requiresLot: true, requiresExpiry: true });
    // Con --sin-lotes la simulación anuncia el cambio; la carga real da las
    // mismas cifras.
    const sim2 = await runImport(rows, "--dry-run", "--sin-lotes");
    expect(sim2.status, sim2.out).toBe(0);
    expect(sim2.out).toContain(
      "Desactivaría lote y vencimiento en «" + lotName + "»",
    );
    expect(await counts()).toEqual(before);
    const real = await runImport(rows, "--sin-lotes");
    expect(real.status, real.out).toBe(0);
    expect(real.out).toMatch(
      /(^|\n)2 productos leídos · 2 nuevos \(8 unidades\) · 0 ya cargados/,
    );
    // La simulación de una recarga: nada nuevo ni categorías por crear.
    const again = await runImport(rows, "--dry-run");
    expect(again.status, again.out).toBe(0);
    expect(again.out).toMatch(
      /Simulación: 2 productos leídos · 0 nuevos \(0 unidades\) · 2 ya cargados sin cambios/,
    );
    expect(again.out).not.toMatch(/Crearía/);
    await retire("R9S-" + tag, "R9T-" + tag);
  });

  it("R9-importador-4: una existencia válida muy grande no hace fallar la carga real por el máximo derivado", async () => {
    const id = "R9M-" + randomUUID().slice(0, 6);
    const rows = [
      [id, "QA R9 existencia enorme", "", "Ropa deportiva", 40000000000, 0, 0],
    ];
    const sim = await runImport(rows, "--dry-run");
    expect(sim.status, sim.out).toBe(0);
    const real = await runImport(rows);
    try {
      expect(real.status, real.out).toBe(0);
      expect(real.out).not.toMatch(/Invalid|overflow/);
      const v = await variantOf(id);
      expect(Number(v?.stock)).toBe(40000000000);
      expect(Number(v?.product.maxStock)).toBe(99999999999.999);
    } finally {
      // Una existencia así no debe quedar en los reportes de las demás pruebas.
      const v = await variantOf(id);
      if (v) {
        await fixtureDb.inventoryMovement.deleteMany({
          where: { variantId: v.id },
        });
        await fixtureDb.variant.delete({ where: { id: v.id } });
        await fixtureDb.product.delete({ where: { id: v.productId } });
      }
    }
  });

  it("R9-importador-5: al activar un producto sólo se completa lo que falta; el precio puesto en la app se respeta", async () => {
    const tag = randomUUID().slice(0, 6);
    const a = "R9W-" + tag,
      b = "R9X-" + tag;
    const first = await runImport([
      [a, "QA R9 activar A", "", "Ropa deportiva", 2, 0, 0],
      [b, "QA R9 activar B", "", "Ropa deportiva", 1, 0, 0],
    ]);
    expect(first.status, first.out).toBe(0);
    // En la app, la dueña les pone precio sin activarlos.
    for (const [sku, price] of [
      [a, 2000],
      [b, 1500],
    ] as const)
      await ok(
        "/variants/" + (await variantOf(sku))!.id,
        { price },
        ownerToken,
        "PATCH",
      );
    // El Excel corregido trae el costo (y otro precio en A; ninguno en B).
    const second = await runImport([
      [a, "QA R9 activar A", "", "Ropa deportiva", 2, 900, 1800],
      [b, "QA R9 activar B", "", "Ropa deportiva", 1, 700, 0],
    ]);
    expect(second.status, second.out).toBe(0);
    expect(second.out).toMatch(/2 activados · 0 precios actualizados/);
    const va = await variantOf(a),
      vb = await variantOf(b);
    expect([
      Number(va?.price),
      Number(va?.costAvg),
      va?.product.active,
    ]).toEqual([2000, 900, true]);
    expect([
      Number(vb?.price),
      Number(vb?.costAvg),
      vb?.product.active,
    ]).toEqual([1500, 700, true]);
    // Con --actualizar-precios sí se cambia, y se cuenta.
    await request(
      "/products/" + va!.productId,
      { active: false },
      ownerToken,
      "PATCH",
    );
    await fixtureDb.variant.update({
      where: { id: va!.id },
      data: { costAvg: 0 },
    });
    const third = await runImport(
      [[a, "QA R9 activar A", "", "Ropa deportiva", 2, 900, 1800]],
      "--actualizar-precios",
    );
    expect(third.status, third.out).toBe(0);
    expect(third.out).toMatch(/1 activados · 1 precios actualizados/);
    const va2 = await variantOf(a);
    expect([
      Number(va2?.price),
      Number(va2?.costAvg),
      va2?.product.active,
    ]).toEqual([1800, 900, true]);
    await retire(a, b);
  });

  it("la política segura conserva precio, costo y stock, pero inactiva precio <= costo", async () => {
    const tag = randomUUID().slice(0, 6);
    const good = "SAFE-G-" + tag,
      equal = "SAFE-E-" + tag,
      lower = "SAFE-L-" + tag,
      missing = "SAFE-M-" + tag,
      previous = "SAFE-P-" + tag;
    const rows = [
      [good, "QA rentable", "", "Ropa deportiva", 4, 100, 101],
      [equal, "QA precio igual", "", "Ropa deportiva", 3, 100, 100],
      [lower, "QA precio menor", "", "Ropa deportiva", 2, 100, 90],
      [missing, "QA sin costo", "", "Ropa deportiva", 1, 0, 80],
    ];
    const before = await counts();
    const sim = await runImport(
      rows,
      "--dry-run",
      "--inactivar-precio-menor-o-igual-costo",
    );
    expect(sim.status, sim.out).toBe(0);
    expect(sim.out).toMatch(
      /Simulación: 4 productos leídos · 4 nuevos \(10 unidades\)[\s\S]*1 sin precio o costo \(inactivos\) · 2 con precio igual o menor al costo \(inactivos por política segura\)/,
    );
    expect(await counts()).toEqual(before);

    const loaded = await runImport(
      rows,
      "--inactivar-precio-menor-o-igual-costo",
    );
    expect(loaded.status, loaded.out).toBe(0);
    const vg = await variantOf(good),
      ve = await variantOf(equal),
      vl = await variantOf(lower),
      vm = await variantOf(missing);
    expect([vg?.product.active, vg?.active]).toEqual([true, true]);
    expect([ve?.product.active, ve?.active]).toEqual([false, false]);
    expect([vl?.product.active, vl?.active]).toEqual([false, false]);
    expect([vm?.product.active, vm?.active]).toEqual([false, false]);
    // Los valores comerciales y las existencias se guardan sin corregirse.
    expect([Number(ve?.price), Number(ve?.costAvg), Number(ve?.stock)]).toEqual(
      [100, 100, 3],
    );
    expect([Number(vl?.price), Number(vl?.costAvg), Number(vl?.stock)]).toEqual(
      [90, 100, 2],
    );

    // También puede sanear una importación anterior: sólo cambia el estado.
    const old = await runImport([
      [previous, "QA riesgo anterior", "", "Ropa deportiva", 7, 120, 100],
    ]);
    expect(old.status, old.out).toBe(0);
    expect((await variantOf(previous))?.product.active).toBe(true);
    const safeAgain = await runImport(
      [[previous, "QA riesgo anterior", "", "Ropa deportiva", 7, 120, 100]],
      "--inactivar-precio-menor-o-igual-costo",
    );
    expect(safeAgain.status, safeAgain.out).toBe(0);
    expect(safeAgain.out).toMatch(/1 desactivados por política segura/);
    const vp = await variantOf(previous);
    expect([vp?.product.active, vp?.active]).toEqual([false, false]);
    expect([Number(vp?.price), Number(vp?.costAvg), Number(vp?.stock)]).toEqual(
      [100, 120, 7],
    );

    const { readFileSync } = await import("node:fs");
    const csv = readFileSync(apiDir + "/revision-inventario.csv", "utf8");
    expect(csv).toContain('"Estado al importar"');
    expect(csv).toContain('"Inactivo"');
    expect(csv).toContain("queda inactivo por política segura");
    await retire(good, equal, lower, missing, previous);
  });
});
// Área seguridad: las contraseñas erróneas cuentan por cuenta y dirección IP y
// nunca cierran sesiones abiertas; el límite por IP no distingue mayúsculas.
describe("Ronda 9 · revisión · seguridad", () => {
  const password = "FitStore-QA-2026!";
  // Cada prueba usa direcciones propias para no gastar el límite de las demás.
  const randomIp = () =>
    [100, 64 + Math.floor(Math.random() * 64), 0, 0]
      .map((n, i) => (i < 2 ? n : 1 + Math.floor(Math.random() * 254)))
      .join(".");
  async function call(
    path: string,
    ip: string,
    data?: unknown,
    as = "",
    extra: Record<string, string> = {},
  ) {
    data = prepareTestPayload(path, data);
    const r = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        ...(as ? { Authorization: "Bearer " + as } : {}),
        ...extra,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }
  async function newUser(role: string) {
    const roles = await ok("/roles");
    const user = await ok("/users", {
      name: "QA R9 seguridad " + role,
      email: `qa-r9-seg-${role}-${randomUUID().slice(0, 8)}@example.test`,
      password,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    const activePassword = "FitStore-R9-Activa-2026!";
    const changed = await call("/auth/change-password", randomIp(), {
      login: user.email,
      currentPassword: password,
      newPassword: activePassword,
      confirmPassword: activePassword,
    });
    if (changed.status !== 201)
      throw new Error(
        "/auth/change-password: " +
          changed.status +
          " " +
          JSON.stringify(changed.body),
      );
    user.testPassword = activePassword;
    actors.push(user);
    return user;
  }
  const login = (user: any, ip: string, pass = user.testPassword ?? password) =>
    call("/auth/login", ip, { email: user.email, password: pass });

  it("R9-seguridad-1: cinco contraseñas erróneas de un tercero no cierran la sesión de la vendedora ni le impiden entrar desde su equipo", async () => {
    const seller = await newUser("seller");
    const manager = await newUser("manager");
    const sellerIp = randomIp();
    const attackerIp = randomIp();
    const logged = await login(seller, sellerIp);
    expect(logged.status).toBe(201);
    const sellerToken = logged.body.accessToken;
    await enroll(sellerToken, "QA R9 seguridad caja");
    const cash = await ok(
      "/cash-sessions/open",
      { registerId: "qa-r9-seg-" + randomUUID(), openingAmount: 0 },
      sellerToken,
    );
    const cats = await ok("/categories");
    const p = await ok("/products", {
      name: "QA R9 seguridad " + suffix,
      sku: "R9SEG-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "R9SEGV-" + randomUUID().slice(0, 8),
          barcode: "R9SEGB-" + randomUUID().slice(0, 8),
          price: 100,
          costAvg: 40,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: 5,
      reason: "QA R9 seguridad",
    });
    const sell = () =>
      call("/sales", sellerIp, input(p.variants[0].id, 100, cash), sellerToken);
    expect((await sell()).status).toBe(201);
    // Un tercero, sin sesión, prueba cinco contraseñas con su correo.
    for (let n = 0; n < 5; n++)
      expect((await login(seller, attackerIp, "incorrecta-" + n)).status).toBe(
        400,
      );
    // Desde su dirección sigue bloqueado: no puede seguir probando.
    expect((await login(seller, attackerIp)).body.message).toMatch(/bloquead/i);
    // La sesión abierta de la vendedora sigue cobrando.
    expect(
      (await call("/auth/me", sellerIp, undefined, sellerToken)).status,
    ).toBe(200);
    expect((await sell()).status).toBe(201);
    // Renovar el acceso emite un token que sí sirve.
    const renewed = await call("/auth/refresh", sellerIp, {}, "", {
      Cookie: logged.cookie,
    });
    expect(renewed.status).toBe(201);
    expect(
      (await call("/auth/me", sellerIp, undefined, renewed.body.accessToken))
        .status,
    ).toBe(200);
    // «Cambiar vendedor» con su PIN desde la sesión del gerente funciona.
    const managerToken = (await login(manager, randomIp())).body.accessToken;
    const switched = await call(
      "/auth/pin",
      sellerIp,
      { userId: seller.id, pin: "246813" },
      managerToken,
    );
    expect(switched.status).toBe(201);
    expect(
      (await call("/auth/me", sellerIp, undefined, switched.body.accessToken))
        .status,
    ).toBe(200);
    // Y puede volver a entrar con su contraseña desde su propio equipo.
    expect((await login(seller, sellerIp)).status).toBe(201);
  });

  it("R9-seguridad-1: un administrador desbloquea la cuenta al cambiarle la contraseña", async () => {
    const seller = await newUser("seller");
    const ip = randomIp();
    for (let n = 0; n < 5; n++)
      expect((await login(seller, ip, "incorrecta-" + n)).status).toBe(400);
    expect((await login(seller, ip)).body.message).toMatch(/bloquead/i);
    await ok(
      "/users/" + seller.id,
      { password: "FitStore-R9-Nueva!" },
      token,
      "PATCH",
    );
    expect((await login(seller, ip, "FitStore-R9-Nueva!")).status).toBe(201);
  });

  it("R9-seguridad-2: los límites por cuenta y sesión no se evitan cambiando mayúsculas o IP", async () => {
    const authIp = randomIp();
    const limitedUser = await newUser("seller");
    const auth: number[] = [];
    for (let n = 0; n < 60; n++)
      auth.push(
        (
          await call("/Auth/login", authIp, {
            email: limitedUser.email,
            password: "contraseña-incorrecta",
          })
        ).status,
      );
    expect(auth.every((s) => s === 400)).toBe(true);
    const invalidLogin = { email: limitedUser.email, password: "incorrecta" };
    expect((await call("/auth/login", authIp, invalidLogin)).status).toBe(429);
    expect((await call("/AUTH/login", randomIp(), invalidLogin)).status).toBe(
      400,
    );
    const salesUser = await newUser("admin");
    const salesToken = (await login(salesUser, randomIp())).body.accessToken;
    await enroll(salesToken, "QA límite R9");
    const salesIp = randomIp();
    const sales: number[] = [];
    for (let n = 0; n < 120; n++)
      sales.push((await call("/Sales", salesIp, {}, salesToken)).status);
    expect(sales.every((s) => s === 400)).toBe(true);
    expect((await call("/sales", randomIp(), {}, salesToken)).status).toBe(429);
    expect((await call("/SALES", salesIp, {}, salesToken)).status).toBe(429);
  }, 60000);
});

// Tienda (6/10/2026): ajustes del negocio, contraentrega, cuadre de caja con
// denominaciones y los dos reportes del día, según los impresos de la tienda
// (docs/tienda/CUADRE_REPORTES_FACTURA.md).
describe("Tienda · ajustes, contraentrega, cuadre y reportes", () => {
  const ip =
    "198.18." + ((Date.now() % 200) + 1) + "." + ((Date.now() % 250) + 1);
  const password = "FitStore-QA-2026!";
  async function call(
    path: string,
    data?: unknown,
    as = token,
    method = data === undefined ? "GET" : "POST",
  ) {
    data = prepareTestPayload(path, data);
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
      // PDF o Excel: se deja el texto.
    }
    return { status: r.status, body, type: r.headers.get("content-type") };
  }
  async function must(
    path: string,
    data?: unknown,
    as = token,
    method?: string,
  ) {
    let r = await call(path, data, as, method);
    r = await completeRequiredPasswordChange(path, data, r, (next, payload) =>
      call(next, payload, ""),
    );
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  }
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const registerNumber = 100000 + (Date.now() % 800000);
  const cashierNumber = 200000 + (Date.now() % 700000);
  let settingsBefore: any;
  let cashier: any, cashier2: any, customer: any, p1: any, p2: any;
  let s1: any, s2: any;
  const sold: Record<string, any> = {};
  async function newCashier(label: string) {
    const roles = await must("/roles");
    const email = `qa-tienda-${label}-${randomUUID().slice(0, 8)}@example.test`;
    const user = await must("/users", {
      name: "QA Tienda " + label + " " + suffix,
      email,
      password,
      pin: "135791",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    actors.push(user);
    const auth = await must("/auth/login", { email, password }, "");
    const terminalId = await enroll(auth.accessToken, "QA Tienda " + label);
    return { ...user, token: auth.accessToken, terminalId };
  }
  async function product(
    label: string,
    price: number,
    costAvg: number,
    taxRate: number,
    stock: number,
  ) {
    const cats = await must("/categories");
    const p = await must("/products", {
      name: "QA Tienda " + label + " " + suffix,
      sku: "TND-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate,
      variants: [
        {
          sku: "TNDV-" + randomUUID().slice(0, 8),
          barcode: "TNDB-" + randomUUID().slice(0, 8),
          price,
          costAvg,
        },
      ],
    });
    products.push(p);
    await must("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: stock,
      reason: "QA tienda stock",
    });
    return { ...p.variants[0], name: p.name };
  }
  const sell = (
    who: any,
    session: any,
    items: any[],
    payments: any[],
    extra: Record<string, unknown> = {},
  ) =>
    call(
      "/sales",
      {
        offlineUuid: randomUUID(),
        customerId: defaultCustomerId,
        cashSessionId: session.id,
        items,
        discountReason: "Descuento autorizado en pruebas",
        payments,
        ...extra,
      },
      who.token,
    );
  const line = (cuadre: any, key: string) =>
    cuadre.lines.find((l: any) => l.key === key)?.value;
  beforeAll(async () => {
    settingsBefore = await must("/settings");
    await must(
      "/settings",
      {
        ...settingsBefore,
        allowCreditSales: true,
        creditApprovalThreshold: 100000,
      },
      token,
      "PUT",
    );
    cashier = await newCashier("caja1");
    cashier2 = await newCashier("caja2");
    // P1 con ITBIS incluido (1,180 = 1,000 + 180) y P2 sin ITBIS.
    p1 = await product("Faja", 1180, 600, 18, 10);
    p2 = await product("Base", 500, 200, 0, 20);
    customer = await must("/customers", {
      name: "QA Tienda cliente " + suffix,
      creditLimit: 100000,
    });
    s1 = await must(
      "/cash-sessions/open",
      { openingAmount: 500 },
      cashier.token,
    );
    s2 = await must(
      "/cash-sessions/open",
      { openingAmount: 0 },
      cashier2.token,
    );
  });
  afterAll(async () => {
    if (settingsBefore)
      await call("/settings", { ...settingsBefore, logo: "" }, token, "PUT");
    for (const [s, who] of [
      [s1, cashier],
      [s2, cashier2],
    ])
      if (s && who) {
        const current = (
          await must("/cash-sessions", undefined, who.token)
        ).find((i: any) => i.id === s.id);
        if (current && !current.closedAt) {
          const expected = await expectedForCash(s.id);
          await call(
            "/cash-sessions/" + s.id + "/close",
            {
              countedCash: Math.max(0, expected.cash),
              countedCard: Math.max(0, expected.card),
              countedTransfer: Math.max(0, expected.transfer),
            },
            who.token,
          );
        }
      }
  });

  it("Tienda-ajustes: sucursal, segundo teléfono, logo, impresión automática y tasas del día", async () => {
    // PNG real de 1×1: la API comprueba la firma de la imagen.
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    const pngBytes = (size: number) =>
      Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.alloc(size - 8, 1),
      ]);
    const saved = await must(
      "/settings",
      {
        ...settingsBefore,
        allowCreditSales: true,
        creditApprovalThreshold: 100000,
        branchName: "Plaza Lope de Vega 2do nivel",
        phone2: "809-555-0102",
        logo: png,
        autoPrintReceipt: true,
        usdRate: 59.5,
        eurRate: 64.25,
      },
      token,
      "PUT",
    );
    expect(saved).toMatchObject({
      branchName: "Plaza Lope de Vega 2do nivel",
      phone2: "809-555-0102",
      logo: png,
      autoPrintReceipt: true,
      usdRate: 59.5,
      eurRate: 64.25,
    });
    // La cajera lee los ajustes para imprimir (logo incluido).
    expect((await must("/settings", undefined, cashier.token)).logo).toBe(png);
    // Guardar sin enviar el logo lo conserva (el formulario no tiene que reenviarlo).
    const { logo: _logo, ...withoutLogo } = saved;
    await must(
      "/settings",
      { ...withoutLogo, phone2: "809-555-0103" },
      token,
      "PUT",
    );
    expect(await must("/settings")).toMatchObject({
      logo: png,
      phone2: "809-555-0103",
    });
    // Sólo imágenes.
    const html = await call(
      "/settings",
      { ...withoutLogo, logo: "data:text/html;base64,PHNjcmlwdD4=" },
      token,
      "PUT",
    );
    expect(html.status).toBe(400);
    // Subida como archivo (hasta 200 KB, más que el límite de un JSON).
    const form = new FormData();
    form.append(
      "file",
      new Blob([pngBytes(150 * 1024)], { type: "image/png" }),
      "logo.png",
    );
    const upload = await fetch(base + "/settings/logo", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "X-Forwarded-For": ip },
      body: form,
    });
    expect(upload.status).toBe(201);
    expect((await upload.json()).logo).toMatch(/^data:image\/png;base64,/);
    const big = new FormData();
    big.append(
      "file",
      new Blob([pngBytes(201 * 1024)], { type: "image/png" }),
      "logo.png",
    );
    const tooBig = await fetch(base + "/settings/logo", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "X-Forwarded-For": ip },
      body: big,
    });
    expect(tooBig.status).toBe(400);
    const fake = new FormData();
    fake.append(
      "file",
      new Blob([Buffer.from("<svg onload=alert(1)>")], { type: "image/png" }),
      "x.png",
    );
    expect(
      (
        await fetch(base + "/settings/logo", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "X-Forwarded-For": ip },
          body: fake,
        })
      ).status,
    ).toBe(400);
    // La cajera no cambia el logo.
    const sellerForm = new FormData();
    sellerForm.append(
      "file",
      new Blob([pngBytes(100)], { type: "image/png" }),
      "l.png",
    );
    expect(
      (
        await fetch(base + "/settings/logo", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + cashier.token,
            "X-Forwarded-For": ip,
          },
          body: sellerForm,
        })
      ).status,
    ).toBe(403);
    // Quitar el logo.
    await must("/settings", { ...withoutLogo, logo: "" }, token, "PUT");
    expect((await must("/settings")).logo).toBeUndefined();
    // Tasa inválida.
    expect(
      (await call("/settings", { ...withoutLogo, usdRate: -1 }, token, "PUT"))
        .status,
    ).toBe(400);
  });

  it("Tienda-ajustes: número y nombre de cada caja (equipo) y número de cada cajero", async () => {
    const saved = await must(
      "/terminals/" + cashier.terminalId + "/register",
      { registerNumber, registerName: "GPRO STORE RD" },
      token,
      "PATCH",
    );
    expect(saved).toMatchObject({
      registerNumber,
      registerName: "GPRO STORE RD",
    });
    const listed = (await must("/terminals")).find(
      (t: any) => t.id === cashier.terminalId,
    );
    expect(listed).toMatchObject({
      registerNumber,
      registerName: "GPRO STORE RD",
    });
    // Dos cajas no comparten número.
    const dup = await call(
      "/terminals/" + cashier2.terminalId + "/register",
      { registerNumber, registerName: "CAJA 2" },
      token,
      "PATCH",
    );
    expect(dup.status).toBe(400);
    await must(
      "/terminals/" + cashier2.terminalId + "/register",
      { registerNumber: registerNumber + 1, registerName: "CAJA 2" },
      token,
      "PATCH",
    );
    // La cajera no cambia los datos de la caja.
    expect(
      (
        await call(
          "/terminals/" + cashier.terminalId + "/register",
          { registerNumber: 1 },
          cashier.token,
          "PATCH",
        )
      ).status,
    ).toBe(403);
    await must("/users/" + cashier.id, { cashierNumber }, token, "PATCH");
    await must(
      "/users/" + cashier2.id,
      { cashierNumber: cashierNumber + 1 },
      token,
      "PATCH",
    );
    expect(
      (await must("/users")).find((u: any) => u.id === cashier.id)
        .cashierNumber,
    ).toBe(cashierNumber);
    expect(
      (await call("/users/" + cashier2.id, { cashierNumber }, token, "PATCH"))
        .status,
    ).toBe(400);
    // Al crear un usuario también se puede indicar.
    const roles = await must("/roles");
    const created = await must("/users", {
      name: "QA Tienda numerado " + suffix,
      email: `qa-tienda-num-${randomUUID().slice(0, 8)}@example.test`,
      password,
      pin: "135792",
      roleId: roles.find((r: any) => r.name === "seller").id,
      cashierNumber: cashierNumber + 2,
    });
    actors.push(created);
    expect(created.cashierNumber).toBe(cashierNumber + 2);
  });

  it("Tienda-contraentrega: se vende, descuenta stock, queda pendiente y se cobra una sola vez en otra caja", async () => {
    const stockBefore = (
      await fixtureDb.variant.findUniqueOrThrow({ where: { id: p1.id } })
    ).stock;
    expect(
      (
        await sell(
          cashier,
          s1,
          [{ variantId: p1.id, qty: 1 }],
          [{ method: "cod", amount: 1180 }],
          { customerId: null },
        )
      ).status,
    ).toBe(400);
    const r = await sell(
      cashier,
      s1,
      [{ variantId: p1.id, qty: 1 }],
      [
        { method: "transfer", amount: 180, bank: "BHD", reference: "QA-T2" },
        { method: "cod", amount: 1000 },
      ],
      { customerId: customer.id },
    );
    expect(r.status).toBe(201);
    sold.f = r.body;
    expect(Number(sold.f.creditBalance)).toBe(1000);
    expect(sold.f.payments.find((p: any) => p.method === "cod")).toMatchObject({
      amount: "1000",
      status: "pending",
    });
    const stockAfter = (
      await fixtureDb.variant.findUniqueOrThrow({ where: { id: p1.id } })
    ).stock;
    expect(Number(stockBefore) - Number(stockAfter)).toBe(1);
    // Los cajeros despachan, pero sólo la administración ve y cobra la deuda.
    expect((await call("/cod/pending", undefined, cashier2.token)).status).toBe(
      403,
    );
    expect((await call("/cod/pending", undefined, managerToken)).status).toBe(
      403,
    );
    const pending = await must("/cod/pending", undefined, token);
    expect(pending.find((p: any) => p.saleId === sold.f.id)).toMatchObject({
      number: sold.f.number,
      codAmount: 1000,
      pending: 1000,
      pendingVerification: 0,
      customer: { id: customer.id, name: customer.name },
    });
    expect(
      (
        await call(
          "/sales/" + sold.f.id + "/cod-collections",
          {
            offlineUuid: randomUUID(),
            cashSessionId: s2.id,
            amount: 1000,
            method: "cash",
          },
          cashier2.token,
        )
      ).status,
    ).toBe(403);
    // Con tarjeta hace falta la referencia del voucher.
    const byCard = await call(
      "/sales/" + sold.f.id + "/cod-collections",
      {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        amount: 1000,
        method: "card",
      },
      token,
    );
    expect(byCard.status).toBe(400);
    const key = randomUUID();
    const body = {
      offlineUuid: key,
      cashSessionId: session.id,
      amount: 1000,
      method: "cash",
    };
    const first = await must(
      "/sales/" + sold.f.id + "/cod-collections",
      body,
      token,
    );
    const again = await must(
      "/sales/" + sold.f.id + "/cod-collections",
      body,
      token,
    );
    expect(again.id).toBe(first.id);
    expect(
      (
        await call(
          "/sales/" + sold.f.id + "/cod-collections",
          { ...body, amount: 999 },
          token,
        )
      ).status,
    ).toBe(400);
    expect(
      Number(
        (await fixtureDb.sale.findUniqueOrThrow({ where: { id: sold.f.id } }))
          .creditBalance,
      ),
    ).toBe(0);
    expect(
      await fixtureDb.payment.count({
        where: { saleId: sold.f.id, entryType: "installment" },
      }),
    ).toBe(1);
    // Ya cobrada: no aparece y no admite otro cobro.
    expect(
      (await must("/cod/pending", undefined, token)).some(
        (p: any) => p.saleId === sold.f.id,
      ),
    ).toBe(false);
    expect(
      (
        await call(
          "/sales/" + sold.f.id + "/cod-collections",
          { ...body, offlineUuid: randomUUID(), amount: 1 },
          token,
        )
      ).status,
    ).toBe(400);
    const log = await fixtureDb.auditLog.findFirst({
      where: { action: "receivable_collected", entityId: sold.f.id },
    });
    expect(log).toBeTruthy();
  });

  it("Tienda-contraentrega: el cobro por transferencia queda por verificar y un administrador lo confirma", async () => {
    // La vende y la cobra la caja 2 (su cuadre lo comprueba más abajo).
    const r = await sell(
      cashier2,
      s2,
      [{ variantId: p2.id, qty: 1 }],
      [{ method: "cod", amount: 500 }],
      { customerId: customer.id },
    );
    expect(r.status).toBe(201);
    expect(r.body.customerId).toBe(customer.id);
    const collected = await must(
      "/sales/" + r.body.id + "/cod-collections",
      {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        amount: 500,
        method: "transfer",
        bank: "Popular",
        reference: "QA-COD-1",
      },
      token,
    );
    expect(collected.status).toBe("pending_verification");
    expect(
      (await must("/cod/pending", undefined, token)).find(
        (p: any) => p.saleId === r.body.id,
      ),
    ).toMatchObject({ pending: 500, pendingVerification: 500 });
    await must("/payments/" + collected.id + "/verify", {}, ownerToken);
    expect(
      (await must("/cod/pending", undefined, token)).some(
        (p: any) => p.saleId === r.body.id,
      ),
    ).toBe(false);
    sold.codTransfer = r.body;
  });

  it("Tienda-contraentrega: se combina con crédito, se cobra con tarjeta (referencia) y guarda la foto de la evidencia", async () => {
    // Caja propia para no alterar los cuadres de las cajas 1 y 2.
    const cashier3 = await newCashier("caja3");
    const s3 = await must(
      "/cash-sessions/open",
      { openingAmount: 0 },
      cashier3.token,
    );
    const upload = async (
      paymentId: string,
      bytes: Buffer,
      type: string,
      as = token,
    ) => {
      const form = new FormData();
      form.append(
        "file",
        new Blob([bytes], { type }),
        "evidencia." + type.split("/")[1],
      );
      const r = await fetch(base + "/payments/" + paymentId + "/proof", {
        method: "POST",
        headers: { Authorization: "Bearer " + as, "X-Forwarded-For": ip },
        body: form,
      });
      let body: any = await r.text();
      try {
        body = JSON.parse(body);
      } catch {
        // texto plano
      }
      return { status: r.status, body };
    };
    const png = (size: number) =>
      Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.alloc(size - 8, 1),
      ]);
    const jpeg = (size: number) =>
      Buffer.concat([Buffer.from("ffd8ff", "hex"), Buffer.alloc(size - 3, 1)]);
    try {
      // Adelanto a crédito y el resto contraentrega en la misma venta.
      const r = await sell(
        cashier3,
        s3,
        [{ variantId: p2.id, qty: 1 }],
        [
          { method: "credit", amount: 250 },
          { method: "cod", amount: 250 },
        ],
        { customerId: customer.id, creditDueDate: "2030-01-01T12:00:00.000Z" },
      );
      expect(r.status).toBe(201);
      expect(Number(r.body.creditBalance)).toBe(500);
      // Crédito y contraentrega forman un único saldo administrativo.
      expect(
        (await must("/cod/pending", undefined, token)).find(
          (p: any) => p.saleId === r.body.id,
        ),
      ).toMatchObject({
        receivableAmount: 500,
        pending: 500,
        collections: [],
        customer: { id: customer.id, name: customer.name },
      });
      const path = "/sales/" + r.body.id + "/cod-collections";
      // Tarjeta sin referencia: 400.
      expect(
        (
          await call(
            path,
            {
              offlineUuid: randomUUID(),
              cashSessionId: session.id,
              amount: 250,
              method: "card",
            },
            token,
          )
        ).status,
      ).toBe(400);
      const body = {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        amount: 250,
        method: "card",
        reference: "VOUCHER-QA-77",
      };
      const paid = await must(path, body, token);
      expect(paid).toMatchObject({
        method: "card",
        status: "ok",
        reference: "VOUCHER-QA-77",
      });
      expect(paid.proofUrl ?? null).toBeNull();
      // Mismo UUID: el mismo cobro.
      expect((await must(path, body, token)).id).toBe(paid.id);
      // Un pago parcial no cierra la cuenta.
      expect(
        (await must("/cod/pending", undefined, token)).find(
          (p: any) => p.saleId === r.body.id,
        ),
      ).toMatchObject({ pending: 250 });
      expect(
        Number(
          (await fixtureDb.sale.findUniqueOrThrow({ where: { id: r.body.id } }))
            .creditBalance,
        ),
      ).toBe(250);
      // Foto de evidencia: jpg/png/webp de hasta 2 MB; no cualquier archivo.
      expect(
        (
          await upload(
            paid.id,
            Buffer.from("<svg onload=alert(1)>"),
            "image/png",
          )
        ).status,
      ).toBe(400);
      expect(
        (await upload(paid.id, png(2 * 1024 * 1024 + 1), "image/png")).status,
      ).toBe(400);
      // Otra cajera (sin sale:manage) no sube la evidencia de un cobro ajeno.
      expect(
        (await upload(paid.id, jpeg(2048), "image/jpeg", cashier.token)).status,
      ).toBe(403);
      const saved = await upload(paid.id, jpeg(2048), "image/jpeg");
      expect(saved.status).toBe(201);
      expect(saved.body).toMatchObject({ hasProof: true });
      expect(saved.body.proofUrl).toBeUndefined();
      // Se puede reemplazar (p. ej. foto borrosa) y queda en el pago de la venta.
      const maxPng = png(2 * 1024 * 1024);
      const replaced = await upload(paid.id, maxPng, "image/png");
      expect(replaced.status).toBe(201);
      expect(replaced.body).toMatchObject({ hasProof: true });
      expect(replaced.body.proofUrl).toBeUndefined();
      const stored = await fixtureDb.payment.findUniqueOrThrow({
        where: { id: paid.id },
      });
      expect(stored.proofUrl).toMatch(/^data:image\/png;base64,/);
      const detail = (await must("/sales", undefined, ownerToken)).find(
        (s: any) => s.id === r.body.id,
      );
      const listedPayment = detail.payments.find((p: any) => p.id === paid.id);
      expect(listedPayment.proofUrl).toBeUndefined();
      expect(listedPayment.hasProof).toBe(true);
      const proof = await fetch(base + "/payments/" + paid.id + "/proof", {
        headers: { Authorization: "Bearer " + ownerToken },
      });
      expect(proof.status).toBe(200);
      expect(proof.headers.get("content-type")).toMatch(/^image\/png/);
      const proofBytes = Buffer.from(await proof.arrayBuffer());
      expect(proofBytes.byteLength).toBe(maxPng.byteLength);
      expect(Buffer.compare(proofBytes, maxPng)).toBe(0);
      const foreignProof = await fetch(
        base + "/payments/" + paid.id + "/proof",
        { headers: { Authorization: "Bearer " + cashier.token } },
      );
      expect(foreignProof.status).toBe(403);
      // Completar con otro método cierra la cuenta y resuelve la alerta.
      await must(
        path,
        {
          offlineUuid: randomUUID(),
          cashSessionId: session.id,
          amount: 250,
          method: "cash",
        },
        token,
      );
      expect(
        (await must("/cod/pending", undefined, token)).some(
          (p: any) => p.saleId === r.body.id,
        ),
      ).toBe(false);
      expect(
        await fixtureDb.alert.findUnique({
          where: { key: "receivable:" + r.body.id },
        }),
      ).toMatchObject({ status: "resolved", entityId: r.body.id });
      // La caja vendedora no recibió el dinero; puede cerrar sin ese cobro.
      const closed = await must(
        "/cash-sessions/" + s3.id + "/close",
        { countedCash: 0, countedCard: 0, countedTransfer: 0 },
        cashier3.token,
      );
      expect(closed.differences).toBeUndefined();
      const cuadre = await must(
        "/cash-sessions/" + session.id + "/cuadre",
        undefined,
        token,
      );
      expect(cuadre.cod.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            paymentId: paid.id,
            method: "card",
            amount: 250,
            reference: "VOUCHER-QA-77",
            hasProof: true,
          }),
        ]),
      );
      // La evidencia de un abono que no existe: 404.
      expect((await upload(randomUUID(), jpeg(64), "image/jpeg")).status).toBe(
        404,
      );
    } finally {
      const current = (
        await must("/cash-sessions", undefined, cashier3.token)
      ).find((i: any) => i.id === s3.id);
      if (current && !current.closedAt)
        await call(
          "/cash-sessions/" + s3.id + "/close",
          {
            countedCash: 0,
            countedCard: 0,
            countedTransfer: 0,
            notes: "Cierre de limpieza QA",
          },
          cashier3.token,
        );
    }
  });

  it("Tienda-cuadre: cierre por denominaciones, vale, dólares y entregado/dejado con el cuadre completo al centavo", async () => {
    const card = { cardLast4: "4242", approvalCode: "QA-A1" };
    // a) efectivo con cambio: paga 1,500 por 1,180.
    sold.a = (
      await sell(
        cashier,
        s1,
        [{ variantId: p1.id, qty: 1 }],
        [{ method: "cash", amount: 1500 }],
      )
    ).body;
    expect(sold.a.payments[0]).toMatchObject({ amount: "1180", change: "320" });
    // b) tarjeta, 2 unidades.
    sold.b = (
      await sell(
        cashier,
        s1,
        [{ variantId: p2.id, qty: 2 }],
        [{ method: "card", amount: 1000, ...card }],
      )
    ).body;
    // c) transferencia.
    sold.c = (
      await sell(
        cashier,
        s1,
        [{ variantId: p2.id, qty: 1 }],
        [{ method: "transfer", amount: 500, bank: "BHD", reference: "QA-T1" }],
      )
    ).body;
    // d) crédito.
    sold.d = (
      await sell(
        cashier,
        s1,
        [{ variantId: p1.id, qty: 1 }],
        [{ method: "credit", amount: 1180 }],
        {
          customerId: customer.id,
          creditDueDate: "2030-01-01T12:00:00.000Z",
        },
      )
    ).body;
    expect(sold.d.number).toBeTruthy();
    // e) descuento de 10 %: 450 en efectivo.
    sold.e = (
      await sell(
        cashier,
        s1,
        [{ variantId: p2.id, qty: 1, discountPercent: 10 }],
        [{ method: "cash", amount: 450 }],
      )
    ).body;
    expect(Number(sold.e.discountTotal)).toBe(50);
    // g) venta anulada (ticket nulo).
    sold.g = (
      await sell(
        cashier,
        s1,
        [{ variantId: p2.id, qty: 1 }],
        [{ method: "cash", amount: 500 }],
      )
    ).body;
    await must(
      "/sales/" + sold.g.id + "/void",
      { reason: "QA ticket nulo", cashSessionId: s1.id },
      ownerToken,
    );
    // j) venta devuelta en efectivo.
    sold.j = (
      await sell(
        cashier,
        s1,
        [{ variantId: p2.id, qty: 1 }],
        [{ method: "cash", amount: 500 }],
      )
    ).body;
    await must(
      "/returns",
      {
        saleId: sold.j.id,
        cashSessionId: s1.id,
        reason: "QA devolución efectivo",
        refundMethod: "cash",
        items: [{ saleItemId: sold.j.items[0].id, qty: 1, restock: true }],
      },
      ownerToken,
    );
    // h) abono en efectivo al crédito.
    await must(
      "/sales/" + sold.d.id + "/installments",
      {
        offlineUuid: randomUUID(),
        cashSessionId: session.id,
        amount: 300,
        method: "cash",
      },
      token,
    );
    // k) entrada y retiro registrados.
    await must(
      "/cash-sessions/" + s1.id + "/movements",
      { type: "in", amount: 100, reason: "QA cambio adicional" },
      cashier.token,
    );
    await must(
      "/cash-sessions/" + s1.id + "/movements",
      { type: "out", amount: 200, reason: "QA pago mensajero" },
      cashier.token,
    );

    // El abono de 300 entra en la caja del administrador, no en la cajera:
    // 500 + 1,180 + 450 + 500 + 100 − 200 − 500 = 2,030.
    const open = (await must("/cash-sessions", undefined, cashier.token)).find(
      (c: any) => c.id === s1.id,
    );
    expect(open.expected).toBeUndefined();
    const expected = await expectedForCash(s1.id);
    expect(expected.cash).toBe(2030);

    const close = (data: any) =>
      call("/cash-sessions/" + s1.id + "/close", data, cashier.token);
    const denominations = {
      "1000": 1,
      "500": 1,
      "100": 3,
      "50": 1,
      "20": 1,
      "5": 1,
    };
    // Lo entregado no supera lo contado.
    expect((await close({ denominations, delivered: 3000 })).status).toBe(400);
    // Si se envía también countedCash, debe coincidir con las denominaciones.
    expect((await close({ denominations, countedCash: 2000 })).status).toBe(
      400,
    );
    expect((await close({ denominations: { "3": 1 } })).status).toBe(400);
    const closed = await close({
      denominations,
      vouchers: 149.75,
      countedUsd: 20,
      countedEur: 0,
      countedCard: expected.card,
      countedTransfer: expected.transfer,
      delivered: 1700,
      notes: "QA cuadre",
    });
    expect(closed.status).toBe(201);
    expect(closed.body.countedCash).toBeUndefined();
    expect(closed.body.differences).toBeUndefined();
    const storedClose = await fixtureDb.cashSession.findUniqueOrThrow({
      where: { id: s1.id },
    });
    expect(Number(storedClose.countedCash)).toBe(1875);
    expect(Number(storedClose.differenceCash)).toBe(-5.25);
    expect(storedClose.closeDetails).toMatchObject({
      vouchers: 149.75,
      countedUsd: 20,
      countedEur: 0,
      delivered: 1700,
      left: 175,
      usdRate: 59.5,
    });

    const cuadre = await must(
      "/cash-sessions/" + s1.id + "/cuadre",
      undefined,
      ownerToken,
    );
    expect(cuadre.title).toBe("Cuadre de Caja");
    expect(cuadre.footer).toBe("FIN DEL CUADRE");
    expect(cuadre.business).toMatchObject({
      branchName: "Plaza Lope de Vega 2do nivel",
    });
    expect(cuadre.register).toMatchObject({
      number: registerNumber,
      name: "GPRO STORE RD",
    });
    expect(cuadre.cashier).toMatchObject({
      id: cashier.id,
      number: cashierNumber,
      name: cashier.name,
    });
    expect(cuadre.openedAt).toBe(s1.openedAt);
    expect(new Date(cuadre.closedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(s1.openedAt).getTime(),
    );
    expect(cuadre.denominations).toHaveLength(11);
    expect(cuadre.denominations.find((x: any) => x.value === 1000)).toEqual({
      value: 1000,
      qty: 1,
      total: 1000,
    });
    expect(cuadre.denominationsSubtotal).toBe(1875);
    // Las 18 líneas del impreso, en orden.
    expect(cuadre.lines.map((l: any) => l.line)).toEqual(
      Array.from({ length: 18 }, (_, n) => n + 1),
    );
    expect(
      Object.fromEntries(cuadre.lines.map((l: any) => [l.key, l.value])),
    ).toEqual({
      credit: 1180,
      cash: 1875,
      cards: 1000,
      transfers: 680,
      vouchers: 149.75,
      usd: 20,
      eur: 0,
      tickets: 7,
      voidedTickets: 1,
      cashSales: 1530,
      receipts: 0,
      differenceDop: -5.25,
      differenceUsd: 20,
      differenceEur: 0,
      discounts: 50,
      total: 5990,
      // Utilidad: (1,000 − 600) × 3 + (500 − 200) × 4 + (450 − 200) − (500 − 200) devuelto.
      profit: 2350,
      openingAmount: 500,
    });
    // Desglose del punto 10 (lo que realmente entra en efectivo).
    expect(cuadre.cashSalesDetail).toEqual({
      sales: 2130,
      receipts: 0,
      cod: 0,
      cashIn: 100,
      refunds: 500,
      cashOut: 200,
      total: 1530,
    });
    expect(cuadre.receipts).toEqual({
      cash: 0,
      card: 0,
      transfer: 0,
      total: 0,
      pendingVerification: 0,
    });
    expect(cuadre.receiptsNote).toBe(
      "RD$ 0.00 de recibos CxC del mismo día ya están incluidos en Ventas Efectivo",
    );
    expect(cuadre.cod).toMatchObject({
      sold: 1000,
      collected: { cash: 0, transfer: 0, total: 0 },
    });
    expect(cuadre.voided).toMatchObject({ count: 1, total: 500 });
    expect(cuadre.salesByMethod).toMatchObject({
      cash: 2130,
      card: 1000,
      transfer: 680,
      credit: 1180,
      cod: 1000,
    });
    expect(cuadre.summary).toMatchObject({
      formula:
        "12-Diferencias = (2-Efectivo introducido + 5-Vale de caja) − 10-Total venta efectivo − 18-Total fondo",
      text: "-5.25 = (1,875.00 + 149.75) − 1,530.00 − 500.00",
    });
    expect(cuadre.delivered).toEqual({ delivered: 1700, left: 175 });
    expect(cuadre.foreign).toMatchObject({
      usd: { counted: 20, expected: 0, difference: 20, rate: 59.5, dop: 1190 },
      eur: { counted: 0, expected: 0, difference: 0, rate: 64.25, dop: 0 },
    });
    // La cajera imprime su cuadre sin rentabilidad; otra cajera no puede.
    const own = await must(
      "/cash-sessions/" + s1.id + "/cuadre",
      undefined,
      cashier.token,
    );
    expect(line(own, "profit")).toBeNull();
    expect(line(own, "differenceDop")).toBeUndefined();
    expect(JSON.stringify(own)).not.toMatch(/costTotal|"cost"/);
    expect(
      (
        await call(
          "/cash-sessions/" + s1.id + "/cuadre",
          undefined,
          cashier2.token,
        )
      ).status,
    ).toBe(403);
    // La siguiente apertura de esa caja sugiere lo dejado.
    expect(
      await must("/cash-sessions/opening-suggestion", undefined, cashier.token),
    ).toMatchObject({
      amount: 175,
      fromSessionId: s1.id,
    });
  });

  it("Tienda-cuadre: el cierre ciego exige todas las formas; la contraentrega cobrada aparece en la caja que la recibió", async () => {
    // Caja 2 despachó las ventas; los cobros los registró la administración en
    // su propia caja. Por eso la caja vendedora cierra sin dinero recibido.
    const incomplete = await call(
      "/cash-sessions/" + s2.id + "/close",
      { countedCash: 0 },
      cashier2.token,
    );
    expect(incomplete.status).toBe(400);
    const closed = await must(
      "/cash-sessions/" + s2.id + "/close",
      { countedCash: 0, countedCard: 0, countedTransfer: 0 },
      cashier2.token,
    );
    expect(closed.differences).toBeUndefined();
    const privileged = (
      await must("/cash-sessions", undefined, ownerToken)
    ).find((cash: any) => cash.id === s2.id);
    expect(privileged.differences).toEqual({ cash: 0, card: 0, transfer: 0 });
    expect(Number(privileged.countedTransfer)).toBe(0);
    const cuadre = await must(
      "/cash-sessions/" + s2.id + "/cuadre",
      undefined,
      ownerToken,
    );
    expect(line(cuadre, "cashSales")).toBe(0);
    expect(line(cuadre, "differenceDop")).toBe(0);
    expect(line(cuadre, "receipts")).toBe(0);
    expect(line(cuadre, "tickets")).toBe(1);
    expect(line(cuadre, "total")).toBe(500);
    expect(cuadre.cod.sold).toBe(500);
    expect(cuadre.register).toMatchObject({
      number: registerNumber + 1,
      name: "CAJA 2",
    });
    expect(cuadre.cod.collected).toMatchObject({
      cash: 0,
      transfer: 0,
      total: 0,
    });
    expect(cuadre.cod.rows).toEqual([]);
    expect(cuadre.cashSalesDetail).toMatchObject({ cod: 0, total: 0 });
    expect(cuadre.delivered).toEqual({ delivered: null, left: null });
  });

  it("Tienda-reportes: venta diaria de usuario por producto", async () => {
    const report = await must(
      "/reports/venta-diaria-usuario?cashSessionId=" + s1.id,
      undefined,
      ownerToken,
    );
    const row = (v: any) =>
      report.rows.find((r: any) => r.Descripción.startsWith(v.name));
    // P1: a, d y f. P2: b (2), c, e (con descuento) y j; la anulada no cuenta.
    expect(row(p1)).toMatchObject({
      Cant: 3,
      ITBIS: 540,
      Desc: 0,
      Precio: 3540,
    });
    expect(row(p2)).toMatchObject({
      Cant: 5,
      ITBIS: 0,
      Desc: 50,
      Precio: 2500,
    });
    expect(report.totals).toEqual({
      Cant: 8,
      ITBIS: 540,
      Desc: 50,
      Precio: 6040,
    });
    expect(report.rows.at(-1)).toMatchObject({
      Descripción: "TOTAL",
      Cant: 8,
      Precio: 6040,
    });
    expect(report.title).toBe("REPORTE DE LA VENTA DIARIA DE USUARIO");
    expect(report.note).toBe(
      "Verificar si los totales tienen descuentos aplicados",
    );
    expect(report.user).toMatchObject({
      id: cashier.id,
      number: cashierNumber,
    });
    expect(report.register).toMatchObject({ number: registerNumber });
    // Por usuario y fecha da lo mismo (la cajera sólo vendió en su caja).
    const byUser = await must(
      `/reports/venta-diaria-usuario?userId=${cashier.id}&from=${today}&to=${today}`,
      undefined,
      ownerToken,
    );
    expect(byUser.totals).toEqual(report.totals);
    const xlsx = await call(
      "/reports/venta-diaria-usuario?format=xlsx&cashSessionId=" + s1.id,
      undefined,
      ownerToken,
    );
    expect(xlsx.status).toBe(200);
    expect(xlsx.type).toMatch(/spreadsheetml/);
    const pdf = await call(
      "/reports/venta-diaria-usuario?format=pdf&cashSessionId=" + s1.id,
      undefined,
      ownerToken,
    );
    expect(pdf.status).toBe(200);
    expect(pdf.type).toMatch(/pdf/);
  });

  it("Tienda-reportes: venta de usuario por forma de pago, en el orden de la tienda y con pagos combinados repartidos", async () => {
    const report = await must(
      "/reports/venta-por-forma-pago?cashSessionId=" + s1.id,
      undefined,
      ownerToken,
    );
    expect(report.title).toBe("REPORTE DE VENTA USUARIO");
    expect(report.groups.map((g: any) => g.label)).toEqual([
      "EFECTIVO",
      "CHEQUES/TRANSFERENCIA",
      "CRÉDITO / CONTRAENTREGA",
      "TARJETA CRÉDITO/DÉBITO",
    ]);
    const group = (label: string) =>
      report.groups.find((g: any) => g.label === label);
    expect(
      group("EFECTIVO").rows.map((r: any) => [r.number, r.units, r.amount]),
    ).toEqual(
      expect.arrayContaining([
        [sold.a.number, 1, 1180],
        [sold.e.number, 1, 450],
        [sold.j.number, 1, 500],
      ]),
    );
    expect(group("EFECTIVO").subtotal).toEqual({ units: 3, amount: 2130 });
    // La venta combinada aparece en dos grupos con el importe de cada parte.
    expect(
      group("CHEQUES/TRANSFERENCIA").rows.find(
        (r: any) => r.number === sold.f.number,
      ),
    ).toMatchObject({
      description: "Factura",
      amount: 180,
    });
    expect(group("CRÉDITO / CONTRAENTREGA").rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          number: sold.f.number,
          amount: 1000,
          units: 1,
        }),
        expect.objectContaining({
          number: sold.d.number,
          amount: 1180,
          units: 1,
        }),
      ]),
    );
    expect(group("CHEQUES/TRANSFERENCIA").subtotal).toEqual({
      units: 2,
      amount: 680,
    });
    expect(group("CRÉDITO / CONTRAENTREGA").subtotal).toEqual({
      units: 2,
      amount: 2180,
    });
    expect(group("TARJETA CRÉDITO/DÉBITO").subtotal).toEqual({
      units: 2,
      amount: 1000,
    });
    expect(report.byInvoice).toEqual({ invoices: 7, units: 8, amount: 5990 });
    expect(report.total).toBe(5990);
    // Filas planas para Excel/PDF: cada grupo cierra con su subtotal.
    expect(
      report.rows.filter((r: any) => r.Descripción === "Sub-Total por Pago"),
    ).toHaveLength(4);
    expect(report.rows.at(-1)).toMatchObject({
      Descripción: "TOTAL",
      T_Venta: 5990,
    });
    const xlsx = await call(
      "/reports/venta-por-forma-pago?format=xlsx&cashSessionId=" + s1.id,
      undefined,
      ownerToken,
    );
    expect(xlsx.status).toBe(200);
    // La cajera imprime los dos reportes de su propia caja, no los de otra.
    const own = await must(
      "/cash-sessions/" + s1.id + "/reports/venta-por-forma-pago",
      undefined,
      cashier.token,
    );
    expect(own.total).toBe(5990);
    const ownDaily = await must(
      "/cash-sessions/" + s1.id + "/reports/venta-diaria-usuario",
      undefined,
      cashier.token,
    );
    expect(ownDaily.totals.Precio).toBe(6040);
    expect(
      (
        await call(
          "/cash-sessions/" + s1.id + "/reports/venta-por-forma-pago",
          undefined,
          cashier2.token,
        )
      ).status,
    ).toBe(403);
    // Sin permiso de reportes, la cajera no usa la ruta general.
    expect(
      (await call("/reports/venta-por-forma-pago", undefined, cashier.token))
        .status,
    ).toBe(403);
  });
});

// Prueba de aceptación de la caja, pasos 04, 35, 36 y 37: stock vendible sin
// lotes vencidos, documento del proveedor y condición de pago, unidades
// dañadas o rechazadas al recibir e historial de recepciones.
describe("Aceptación · mercancía", () => {
  let cats: any[], supplier: any, warehouse: string;
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  // NCF de comprobante de crédito fiscal: B01 + 8 dígitos (único por prueba).
  const ncf = () =>
    "B01" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  beforeAll(async () => {
    cats = await ok("/categories");
    supplier = (await ok("/suppliers")).find((s: any) => s.id === supplierId);
    const role = (await ok("/roles")).find((r: any) => r.name === "warehouse");
    const u = await ok("/users", {
      name: "QA almacén mercancía " + suffix,
      email: "am-warehouse-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "834529",
      roleId: role.id,
    });
    actors.push(u);
    warehouse = (
      await ok(
        "/auth/login",
        { email: u.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    await enroll(warehouse, "QA almacén mercancía");
  });
  const product = async (label: string, category = "Ropa deportiva") => {
    const p = await ok("/products", {
      name: "QA Merc " + label + " " + suffix,
      sku: "AM-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === category).id,
      variants: [
        {
          sku: "AMV-" + randomUUID().slice(0, 8),
          barcode: "AMB-" + randomUUID().slice(0, 8),
          price: 1500,
          costAvg: 100,
        },
      ],
    });
    products.push(p);
    return p;
  };
  const stockOf = async (variantId: string) =>
    Number(
      (await fixtureDb.variant.findUniqueOrThrow({ where: { id: variantId } }))
        .stock,
    );
  const itemOf = (id: string) =>
    fixtureDb.purchaseItem.findUniqueOrThrow({ where: { id } });

  it("04: la caja y Mercancía ven como vendible sólo lo de lotes vigentes y lo vencido aparte", async () => {
    const p = await product("Lote vencido", "Suplementos");
    const v = p.variants[0];
    for (const [lotNumber, qty] of [
      ["AM-VIGENTE", 3],
      ["AM-VENCIDO", 2],
    ] as const)
      await ok("/inventory/adjustments", {
        variantId: v.id,
        qty,
        reason: "QA lote",
        lotNumber,
        expiryDate: "2030-01-01T12:00:00.000Z",
      });
    // El lote venció (así quedan los datos al pasar la fecha).
    await fixtureDb.lot.updateMany({
      where: { variantId: v.id, lotNumber: "AM-VENCIDO" },
      data: { expiryDate: new Date("2020-01-01T12:00:00Z") },
    });
    // El catálogo que cargan la caja y Mercancía.
    const listed = (await ok("/products?q=" + p.sku)).items
      .find((i: any) => i.id === p.id)
      .variants.find((i: any) => i.id === v.id);
    expect(Number(listed.stock)).toBe(3);
    expect(Number(listed.expiredStock)).toBe(2);
    expect(Number(listed.physicalStock)).toBe(5);
    // Inventario conserva lo físico (para contar) y muestra lo vencido aparte.
    const inventory = (await ok("/inventory/stock")).find(
      (i: any) => i.id === v.id,
    );
    expect(Number(inventory.stock)).toBe(5);
    expect(Number(inventory.expiredStock)).toBe(2);
    expect(Number(inventory.sellableStock)).toBe(3);
    // El aviso en tiempo real (que actualiza la caja) también lleva lo vendible.
    await ok("/inventory/adjustments", {
      variantId: v.id,
      qty: 1,
      reason: "QA lote",
      lotNumber: "AM-VIGENTE",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const event = await fixtureDb.realtimeEvent.findFirst({
      where: {
        type: "stock.changed",
        data: { path: ["variantId"], equals: v.id },
      },
      orderBy: { id: "desc" },
    });
    expect(event?.data).toMatchObject({ qtyOnHand: 4, expired: 2 });
  });

  it("35: la orden y la recepción guardan factura, NCF, fecha y condición de pago; se completan después", async () => {
    const p = await product("Documento");
    const order = await ok("/purchase-orders", {
      supplierId,
      supplierInvoice: "FAC-778",
      paymentType: "credit",
      creditDays: 45,
      items: [{ variantId: p.variants[0].id, qty: 4, unitCost: 250 }],
    });
    expect(order).toMatchObject({
      supplierInvoice: "FAC-778",
      paymentType: "credit",
      creditDays: 45,
      supplierNcf: null,
    });
    // Recibir no exige el documento; la condición de pago viene de la orden.
    const receipt = await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 4 }],
    });
    expect(receipt).toMatchObject({
      supplierNcf: null,
      paymentType: "credit",
      creditDays: 45,
    });
    const path = "/goods-receipts/" + receipt.id + "/document";
    const wrong = await request(path, { supplierNcf: "123" }, token, "PATCH");
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toMatch(/NCF/);
    const future = await request(
      path,
      { invoiceDate: "2999-01-01" },
      token,
      "PATCH",
    );
    expect(future.status).toBe(400);
    const stock = await stockOf(p.variants[0].id);
    const done = await ok(
      path,
      {
        supplierInvoice: "FAC-778",
        supplierNcf: "b01-0000 0123",
        invoiceDate: today,
        itbis: 180,
        paymentType: "credit",
        creditDays: 30,
      },
      token,
      "PATCH",
    );
    expect(done).toMatchObject({
      supplierInvoice: "FAC-778",
      supplierNcf: "B0100000123",
      paymentType: "credit",
      creditDays: 30,
    });
    expect(Number(done.itbis)).toBe(180);
    expect(done.invoiceDate.slice(0, 10)).toBe(today);
    // Completar el documento no mueve stock y queda auditado.
    expect(await stockOf(p.variants[0].id)).toBe(stock);
    expect(
      await fixtureDb.auditLog.count({
        where: { entityId: receipt.id, action: "receipt_document" },
      }),
    ).toBe(1);
    // Contado no lleva días; un texto vacío borra el dato.
    const cash = await ok(
      path,
      { paymentType: "cash", supplierInvoice: "" },
      token,
      "PATCH",
    );
    expect(cash).toMatchObject({
      paymentType: "cash",
      creditDays: null,
      supplierInvoice: null,
      supplierNcf: "B0100000123",
    });
    // La orden también se completa después (e-CF: E31 + 10 dígitos).
    const od = await ok(
      "/purchase-orders/" + order.id + "/document",
      { supplierNcf: "E310000000123" },
      token,
      "PATCH",
    );
    expect(od.supplierNcf).toBe("E310000000123");
    // Desde Mercancía (celular) la entrada lleva el documento.
    const number = ncf();
    const entry = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      supplierInvoice: "F-1",
      supplierNcf: number,
      invoiceDate: today,
      paymentType: "cash",
      itbis: 36,
      items: [{ variantId: p.variants[0].id, qty: 2, unitCost: 100 }],
    });
    const row = await fixtureDb.goodsReceipt.findUniqueOrThrow({
      where: { id: entry.receiptId },
    });
    expect(row).toMatchObject({
      supplierInvoice: "F-1",
      supplierNcf: number,
      paymentType: "cash",
    });
    expect(Number(row.itbis)).toBe(36);
    // Sin condición de pago, la del proveedor (plazo en días).
    const plain = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      items: [{ variantId: p.variants[0].id, qty: 1, unitCost: 100 }],
    });
    expect(
      await fixtureDb.goodsReceipt.findUniqueOrThrow({
        where: { id: plain.receiptId },
      }),
    ).toMatchObject({
      paymentType: supplier.paymentTermsDays > 0 ? "credit" : "cash",
      supplierNcf: null,
    });
  });

  it("35: exporta a Excel las compras del período con proveedor, RNC, NCF, montos e ITBIS", async () => {
    const p = await product("Excel 606");
    const number = ncf(),
      old = ncf();
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      supplierInvoice: "XL-1",
      supplierNcf: number,
      invoiceDate: today,
      paymentType: "credit",
      creditDays: 30,
      itbis: 54,
      freight: 20,
      items: [{ variantId: p.variants[0].id, qty: 3, unitCost: 100 }],
    });
    // Factura de un mes anterior recibida hoy: cuenta en el período de su fecha.
    await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      supplierNcf: old,
      invoiceDate: "2001-02-03",
      items: [{ variantId: p.variants[0].id, qty: 1, unitCost: 100 }],
    });
    const ExcelJS = requireApi("exceljs");
    const sheetOf = async (query: string, as = token) => {
      const r = await fetch(base + "/goods-receipts/export" + query, {
        headers: { Authorization: "Bearer " + as },
      });
      expect(r.status).toBe(200);
      expect(r.headers.get("content-type")).toMatch(/spreadsheetml/);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(Buffer.from(await r.arrayBuffer()));
      const sheet = book.worksheets[0];
      const header = (sheet.getRow(1).values as any[]).slice(1);
      const rows: Record<string, any>[] = [];
      sheet.eachRow((row: any, n: number) => {
        if (n > 1)
          rows.push(
            Object.fromEntries(
              header.map((h: string, i: number) => [
                h,
                row.getCell(i + 1).value,
              ]),
            ),
          );
      });
      return rows;
    };
    const rows = await sheetOf("?from=" + today + "&to=" + today);
    const row = rows.find((r) => r.NCF === number);
    expect(row).toMatchObject({
      Proveedor: supplier.name,
      RNC: supplier.legalId,
      Factura: "XL-1",
      Condición: "Crédito 30 días",
      Mercancía: 300,
      Flete: 20,
      ITBIS: 54,
      Total: 320,
    });
    expect(rows.some((r) => r.NCF === old)).toBe(false);
    const february = await sheetOf("?from=2001-02-01&to=2001-02-28");
    expect(february.map((r) => r.NCF)).toContain(old);
    expect(february.map((r) => r.NCF)).not.toContain(number);
    // La cajera no exporta compras.
    const seller = await fetch(base + "/goods-receipts/export", {
      headers: { Authorization: "Bearer " + sellerToken },
    });
    expect(seller.status).toBe(403);
  });

  it("36: los dañados o rechazados por línea no entran al stock, quedan con motivo y costo, y pedido = bueno + dañado + pendiente", async () => {
    const p = await product("Dañados");
    const variantId = p.variants[0].id;
    const start = await stockOf(variantId);
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 10, unitCost: 100 }],
    });
    const itemId = order.items[0].id;
    const path = "/purchase-orders/" + order.id + "/receive";
    // Sin motivo no se registran dañados.
    const noReason = await request(path, {
      operationId: randomUUID(),
      items: [{ itemId, qty: 6, damagedQty: 2 }],
    });
    expect(noReason.status).toBe(400);
    expect(noReason.body.message).toMatch(/motivo/i);
    const first = await ok(path, {
      operationId: randomUUID(),
      freight: 60,
      items: [{ itemId, qty: 6, damagedQty: 2, damageReason: "Caja rota" }],
    });
    expect(await stockOf(variantId)).toBe(start + 6);
    expect(first.items[0]).toMatchObject({
      qty: 6,
      damagedQty: 2,
      damageReason: "Caja rota",
      damagedCost: 200,
    });
    // Lo que se debe: sólo lo bueno más el flete; lo dañado aparte.
    expect(Number(first.total)).toBe(660);
    expect(Number(first.damagedCost)).toBe(200);
    // El flete se reparte sólo entre las unidades buenas: 100 + 60/6.
    expect(
      Number(
        (
          await fixtureDb.variant.findUniqueOrThrow({
            where: { id: variantId },
          })
        ).costAvg,
      ),
    ).toBe(110);
    let item = await itemOf(itemId);
    expect([
      Number(item.qty),
      Number(item.receivedQty),
      Number(item.damagedQty),
    ]).toEqual([10, 6, 2]);
    // Pedido 10 = 6 buenas + 2 dañadas + 2 pendientes: no admite 3 más.
    const over = await request(path, {
      operationId: randomUUID(),
      items: [{ itemId, qty: 2, damagedQty: 1, damageReason: "Vencido" }],
    });
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/pendiente/);
    // Una línea sin unidades buenas ni dañadas no es una recepción.
    expect(
      (
        await request(path, {
          operationId: randomUUID(),
          items: [{ itemId, qty: 0 }],
        })
      ).status,
    ).toBe(400);
    // Las 2 restantes llegan rechazadas: la orden queda completa sin sumar stock.
    await ok(path, {
      operationId: randomUUID(),
      items: [
        { itemId, qty: 0, damagedQty: 2, damageReason: "Producto equivocado" },
      ],
    });
    expect(await stockOf(variantId)).toBe(start + 6);
    item = await itemOf(itemId);
    expect(Number(item.damagedQty)).toBe(4);
    expect(
      (
        await fixtureDb.purchaseOrder.findUniqueOrThrow({
          where: { id: order.id },
        })
      ).status,
    ).toBe("received");
    const purchased = await fixtureDb.inventoryMovement.findMany({
      where: { variantId, type: "purchase" },
    });
    expect(purchased.reduce((s: number, m: any) => s + Number(m.qty), 0)).toBe(
      6,
    );
    // Desde Mercancía (celular), con orden: lo mismo.
    const o2 = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 5, unitCost: 100 }],
    });
    const goods = (qty: number, damagedQty: number) => ({
      id: randomUUID(),
      direction: "entry",
      supplierId,
      orderId: o2.id,
      items: [
        {
          variantId,
          itemId: o2.items[0].id,
          qty,
          unitCost: 100,
          damagedQty,
          damageReason: "Golpeado",
        },
      ],
    });
    const viaGoods = await ok("/merchandise/operations", goods(3, 1));
    expect(await stockOf(variantId)).toBe(start + 9);
    item = await itemOf(o2.items[0].id);
    expect([Number(item.receivedQty), Number(item.damagedQty)]).toEqual([3, 1]);
    const stored = await fixtureDb.goodsReceipt.findUniqueOrThrow({
      where: { id: viaGoods.receiptId },
    });
    expect((stored.items as any[])[0]).toMatchObject({
      qty: 3,
      damagedQty: 1,
      damageReason: "Golpeado",
    });
    expect(Number(stored.damagedCost)).toBe(100);
    const overGoods = await request("/merchandise/operations", goods(1, 1));
    expect(overGoods.status).toBe(400);
    // Sin orden: lo dañado queda registrado y no entra.
    const loose = await ok("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      items: [
        {
          variantId,
          qty: 0,
          unitCost: 100,
          damagedQty: 2,
          damageReason: "Mojado",
        },
      ],
    });
    expect(await stockOf(variantId)).toBe(start + 9);
    expect(
      Number(
        (
          await fixtureDb.goodsReceipt.findUniqueOrThrow({
            where: { id: loose.receiptId },
          })
        ).damagedCost,
      ),
    ).toBe(200);
    // En una salida no hay dañados de recepción.
    expect(
      (
        await request("/merchandise/operations", {
          id: randomUUID(),
          direction: "exit",
          reason: "merma",
          items: [
            {
              variantId,
              qty: 1,
              unitCost: 1,
              damagedQty: 1,
              damageReason: "Roto",
            },
          ],
        })
      ).status,
    ).toBe(400);
  });

  it("37: historial de recepciones con proveedor, documento, quién recibió, líneas y dañados; reenviar no duplica", async () => {
    const p = await product("Historial");
    const variantId = p.variants[0].id;
    const start = await stockOf(variantId);
    const order = await ok("/purchase-orders", {
      supplierId,
      items: [{ variantId, qty: 3, unitCost: 100 }],
    });
    const path = "/purchase-orders/" + order.id + "/receive";
    const number = ncf();
    const body = {
      operationId: randomUUID(),
      supplierInvoice: "H-1",
      supplierNcf: number,
      items: [
        {
          itemId: order.items[0].id,
          qty: 2,
          damagedQty: 1,
          damageReason: "Roto",
        },
      ],
    };
    const receipt = await ok(path, body);
    // Se perdió la respuesta y se confirma otra vez: la misma recepción.
    expect((await ok(path, body)).id).toBe(receipt.id);
    expect(await stockOf(variantId)).toBe(start + 2);
    // La orden quedó completa (2 + 1): otra recepción se rechaza.
    const again = await request(path, { ...body, operationId: randomUUID() });
    expect(again.status).toBe(400);
    const list = await ok("/goods-receipts?from=" + today + "&to=" + today);
    const row = list.find((r: any) => r.id === receipt.id);
    expect(row).toMatchObject({
      orderNumber: order.number,
      supplierName: supplier.name,
      supplierLegalId: supplier.legalId,
      supplierInvoice: "H-1",
      supplierNcf: number,
      userName: "QA admin " + suffix,
      units: 2,
      damagedUnits: 1,
    });
    expect(row.lines).toEqual([
      expect.objectContaining({
        variantId,
        name: p.name,
        sku: p.variants[0].sku,
        qty: 2,
        damagedQty: 1,
        damageReason: "Roto",
      }),
    ]);
    // Abrir la recepción: su comprobante.
    const detail = await ok("/goods-receipts/" + receipt.id);
    expect(detail).toMatchObject({ id: receipt.id, supplierNcf: number });
    expect(detail.lines[0]).toMatchObject({ qty: 2, damagedQty: 1 });
    // Mercancía en el celular (almacén): ve el historial sin costos.
    const fromPhone = await ok("/goods-receipts", undefined, warehouse);
    const seen = fromPhone.find((r: any) => r.id === receipt.id);
    expect(seen.lines[0]).toMatchObject({ qty: 2, damagedQty: 1 });
    expect(JSON.stringify(seen)).not.toMatch(/unitCost|landedCost|damagedCost/);
    expect(
      (await request("/goods-receipts", undefined, sellerToken)).status,
    ).toBe(403);
    // Mercancía: reenviar la misma entrada con dañados no duplica.
    const entry = {
      id: randomUUID(),
      direction: "entry",
      items: [
        {
          variantId,
          qty: 1,
          unitCost: 100,
          damagedQty: 1,
          damageReason: "Roto",
        },
      ],
    };
    const once = await ok("/merchandise/operations", entry);
    expect((await ok("/merchandise/operations", entry)).receiptId).toBe(
      once.receiptId,
    );
    expect(await stockOf(variantId)).toBe(start + 3);
  });
});

describe("Tienda · 4 cajas a la vez", () => {
  // Cada caja es un equipo distinto (su IP) con su propia cajera.
  const n = Date.now();
  const ipOf = (k: number) =>
    "198.19." + ((n % 200) + k) + "." + ((n % 250) + 1);
  const password = "FitStore-QA-2026!";
  async function call(path: string, data: unknown, as: string, ip: string) {
    data = prepareTestPayload(path, data);
    const r = await fetch(base + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + as,
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, body: await r.json() };
  }
  async function must(path: string, data: unknown, as: string, ip: string) {
    let r = await call(path, data, as, ip);
    r = await completeRequiredPasswordChange(path, data, r, (next, payload) =>
      call(next, payload, "", ip),
    );
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  }
  const stockOf = async (variantId: string) =>
    Number(
      (await fixtureDb.variant.findUniqueOrThrow({ where: { id: variantId } }))
        .stock,
    );
  async function product(label: string, price: number, stock: number) {
    const cats = await ok("/categories");
    const p = await ok("/products", {
      name: "QA 4cajas " + label + " " + suffix,
      sku: "4C-" + randomUUID().slice(0, 8),
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      taxRate: 0,
      variants: [
        {
          sku: "4CV-" + randomUUID().slice(0, 8),
          barcode: "4CB-" + randomUUID().slice(0, 8),
          price,
          costAvg: 50,
        },
      ],
    });
    products.push(p);
    await ok("/inventory/adjustments", {
      variantId: p.variants[0].id,
      qty: stock,
      reason: "QA 4 cajas",
    });
    return p.variants[0];
  }
  const cajas: any[] = [];
  let phone = "";
  afterAll(async () => {
    for (const c of cajas)
      if (c.session && !c.closed)
        await call(
          "/cash-sessions/" + c.session.id + "/close",
          { countedCash: c.expectedCash ?? 0 },
          c.token,
          c.ip,
        );
  });

  it("Tienda-4cajas: 4 cajas venden a la vez el mismo producto escaso mientras entra mercancía desde el celular", async () => {
    const settings = await ok("/settings");
    expect(settings.allowNegativeStock === true).toBe(false);
    const roles = await ok("/roles");
    for (let k = 1; k <= 4; k++) {
      const email = `qa-4cajas-${k}-${randomUUID().slice(0, 8)}@example.test`;
      const user = await ok("/users", {
        name: "QA Cajera " + k + " " + suffix,
        email,
        password,
        pin: "246813",
        roleId: roles.find((r: any) => r.name === "seller").id,
      });
      actors.push(user);
      const ip = ipOf(k);
      const auth = await must("/auth/login", { email, password }, "", ip);
      await enroll(auth.accessToken, "QA Caja " + k);
      cajas.push({ k, user, ip, token: auth.accessToken });
    }
    // Celular de Mercancía: usuario de almacén con su propio equipo.
    const wh = await ok("/users", {
      name: "QA Almacén 4cajas " + suffix,
      email: `qa-4cajas-alm-${randomUUID().slice(0, 8)}@example.test`,
      password,
      pin: "357913",
      roleId: roles.find((r: any) => r.name === "warehouse").id,
    });
    actors.push(wh);
    phone = (
      await must("/auth/login", { email: wh.email, password }, "", ipOf(9))
    ).accessToken;
    await enroll(phone, "QA celular mercancía");

    const scarce = await product("Escaso", 100, 10);
    const own = await Promise.all(
      cajas.map((c) => product("Caja " + c.k, 200, 50)),
    );
    // Las 4 cajas abiertas a la vez, cada una con su fondo.
    const opened = await Promise.all(
      cajas.map((c) =>
        must(
          "/cash-sessions/open",
          { openingAmount: 1000 * c.k },
          c.token,
          c.ip,
        ),
      ),
    );
    opened.forEach((s, i) => (cajas[i].session = s));
    expect(new Set(opened.map((s) => s.id)).size).toBe(4);
    for (const c of cajas) {
      c.sales = new Set<string>();
      c.cash = 0;
      c.scarce = 0;
      c.rejected = 0;
    }
    let received = 0;
    const rounds = 5;
    for (let round = 0; round < rounds; round++) {
      const work: Promise<unknown>[] = cajas.map(async (c, i) => {
        const items = [
          { variantId: scarce.id, qty: 1 },
          { variantId: own[i].id, qty: 1 },
        ];
        const body = {
          offlineUuid: randomUUID(),
          customerId: defaultCustomerId,
          cashSessionId: c.session.id,
          items,
          payments: [{ method: "cash", amount: 300 }],
          expectedTotal: 300,
        };
        // Reintento: la misma venta se envía dos veces a la vez.
        const [a, b] = await Promise.all([
          call("/sales", body, c.token, c.ip),
          call("/sales", body, c.token, c.ip),
        ]);
        for (const r of [a, b])
          expect([201, 400, 409], JSON.stringify(r.body)).toContain(r.status);
        expect(a.status).toBe(b.status);
        if (a.status === 201) {
          expect(b.body.id).toBe(a.body.id);
          c.sales.add(a.body.id);
          c.cash += 300;
          c.scarce += 1;
        } else c.rejected += 1;
      });
      if (round % 2 === 1) {
        // Entrada de 3 unidades del producto escaso desde el celular (con reintento).
        const entry = {
          id: randomUUID(),
          direction: "entry",
          items: [{ variantId: scarce.id, qty: 3, unitCost: 50 }],
        };
        work.push(
          Promise.all([
            must("/merchandise/operations", entry, phone, ipOf(9)),
            must("/merchandise/operations", entry, phone, ipOf(9)),
          ]).then(async ([x, y]) => {
            expect(y.id).toBe(x.id);
            expect(y.receiptId).toBe(x.receiptId);
            expect(
              await fixtureDb.merchandiseOperation.count({
                where: { id: entry.id },
              }),
            ).toBe(1);
            expect(
              await fixtureDb.goodsReceipt.count({
                where: { operationId: entry.id },
              }),
            ).toBe(1);
            received += 3;
          }),
        );
      }
      await Promise.all(work);
      expect(await stockOf(scarce.id)).toBeGreaterThanOrEqual(0);
    }
    const sold = cajas.reduce((t, c) => t + c.scarce, 0);
    expect(received).toBe(6);
    // 20 intentos y sólo 16 unidades en total: se vendió todo lo que había, ni una más.
    expect(sold).toBeLessThanOrEqual(16);
    expect(sold + cajas.reduce((t, c) => t + c.rejected, 0)).toBe(20);
    expect(await stockOf(scarce.id)).toBe(10 + received - sold);
    // Una venta rechazada no descuenta nada: cada producto propio = 50 − sus ventas.
    for (const [i, c] of cajas.entries())
      expect(await stockOf(own[i].id)).toBe(50 - c.sales.size);
    // Ningún duplicado: en la base hay exactamente las ventas aceptadas.
    for (const c of cajas) {
      const rows = await fixtureDb.sale.findMany({
        where: { cashSessionId: c.session.id },
        select: { id: true },
      });
      expect(new Set(rows.map((r: any) => r.id))).toEqual(c.sales);
    }
    // Cada caja cierra a la vez con su cuadre propio.
    const closed = await Promise.all(
      cajas.map((c) => {
        c.expectedCash = 1000 * c.k + c.cash;
        return must(
          "/cash-sessions/" + c.session.id + "/close",
          {
            countedCash: c.expectedCash,
            countedCard: 0,
            countedTransfer: 0,
          },
          c.token,
          c.ip,
        );
      }),
    );
    for (const [i, x] of closed.entries()) {
      cajas[i].closed = true;
      expect(x.differences).toBeUndefined();
      expect(
        Number(
          (
            await fixtureDb.cashSession.findUniqueOrThrow({
              where: { id: cajas[i].session.id },
            })
          ).differenceCash,
        ),
      ).toBe(0);
    }
    for (const c of cajas) {
      const cuadre = await must(
        "/cash-sessions/" + c.session.id + "/cuadre",
        undefined,
        c.token,
        c.ip,
      );
      const v = Object.fromEntries(
        cuadre.lines.map((l: any) => [l.key, l.value]),
      );
      expect(cuadre.cashier.id).toBe(c.user.id);
      expect(v).toMatchObject({
        cash: 1000 * c.k + c.cash,
        tickets: c.sales.size,
        cashSales: c.cash,
        total: c.cash,
        openingAmount: 1000 * c.k,
      });
      expect(v.differenceDop).toBeUndefined();
      // Una cajera no ve el cuadre de otra caja.
      const other = cajas[c.k % 4];
      expect(
        (
          await call(
            "/cash-sessions/" + c.session.id + "/cuadre",
            undefined,
            other.token,
            other.ip,
          )
        ).status,
      ).toBe(403);
    }
  });
});

// Ronda 9 · revisión local en Windows, con PostgreSQL en UTC-4. Prisma guarda
// cada DateTime como «timestamp sin zona» en UTC, así que ningún SQL crudo puede
// depender de la zona horaria de la sesión. Cada zona se prueba contra una
// segunda API propia cuya DATABASE_URL fuerza esa zona en sus sesiones: con
// America/Santo_Domingo las regresiones fallan con el código anterior en
// cualquier computadora, también donde el servidor ya está en UTC; con UTC son
// el control de que nada cambió donde ya funcionaba.
describe("Ronda 9 · Windows y zona horaria", () => {
  const MINUTE = 60000,
    DAY = 86400000;
  const password = "FitStore-QA-2026!";
  // Añade la zona a las opciones de arranque de la sesión y conserva el resto
  // de la cadena de conexión. La última «-c» gana, también sobre la del rol.
  const withSessionTimeZone = (raw: string | undefined, zone: string) => {
    if (!raw) throw new Error("Configura DATABASE_URL.");
    const url = new URL(raw);
    const options = [url.searchParams.get("options"), "-c TimeZone=" + zone]
      .filter(Boolean)
      .join(" ");
    url.searchParams.delete("options");
    // Pocas conexiones: estas sesiones sólo atienden a este bloque.
    url.searchParams.set("connection_limit", "4");
    url.search =
      url.searchParams.toString() + "&options=" + encodeURIComponent(options);
    return url.toString();
  };
  const sessionTimeZone = async (databaseUrl: string) => {
    const db = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const rows = await db.$queryRawUnsafe(
        "SELECT setting, source FROM pg_settings WHERE name = 'TimeZone'",
      );
      return rows[0] as { setting: string; source: string };
    } finally {
      await db.$disconnect();
    }
  };
  // Segunda API compilada, como en producción (node dist/main.js), en un puerto
  // libre. Se arranca sin bloquear: el proceso de pruebas sigue atendiendo sus
  // conexiones mientras tanto.
  const startApi = async (databaseUrl: string) => {
    const { spawn } = await import("node:child_process");
    const { createServer } = await import("node:net");
    const { fileURLToPath } = await import("node:url");
    const port = await new Promise<number>((resolve, reject) => {
      const probe = createServer();
      probe.once("error", reject);
      probe.listen(0, () => {
        const { port } = probe.address() as { port: number };
        probe.close(() => resolve(port));
      });
    });
    const child = spawn(process.execPath, ["dist/main.js"], {
      cwd: fileURLToPath(new URL("../apps/api", import.meta.url)),
      env: { ...process.env, PORT: String(port), DATABASE_URL: databaseUrl },
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    });
    let errors = "",
      running = true;
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      errors = (errors + chunk).slice(-2000);
    });
    const exited = new Promise<void>((resolve) => {
      const done = (error?: unknown) => {
        if (error) errors += String(error);
        running = false;
        resolve();
      };
      child.once("exit", () => done());
      child.once("error", done);
    });
    // Si el proceso de pruebas termina sin pasar por afterAll, la API no queda
    // huérfana.
    const reap = () => {
      child.kill();
    };
    process.once("exit", reap);
    const stop = async () => {
      process.off("exit", reap);
      if (running) child.kill();
      const forced = setTimeout(() => running && child.kill("SIGKILL"), 5000);
      await exited;
      clearTimeout(forced);
    };
    const apiBase = `http://127.0.0.1:${port}/api`;
    const deadline = Date.now() + 40000;
    for (;;) {
      if (!running)
        throw new Error("La API de la prueba terminó al arrancar: " + errors);
      try {
        const health = await fetch(apiBase + "/health", {
          signal: AbortSignal.timeout(1000),
        });
        if (health.ok) break;
      } catch {
        /* Todavía no escucha. */
      }
      if (Date.now() > deadline) {
        await stop();
        throw new Error("La API de la prueba no respondió: " + errors);
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    return { base: apiBase, stop, errors: () => errors };
  };
  // Como request() y ok(), contra la API indicada y con su propia IP para el
  // límite de intentos.
  const clientOf = (apiBase: string, ip: string) => {
    const call = async (
      path: string,
      data?: unknown,
      as = "",
      method = data === undefined ? "GET" : "POST",
    ) => {
      data = prepareTestPayload(path, data);
      const response = await fetch(apiBase + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
          ...(as ? { Authorization: "Bearer " + as } : {}),
        },
        ...(data === undefined ? {} : { body: JSON.stringify(data) }),
      });
      return { status: response.status, body: await response.json() };
    };
    const must = async (
      path: string,
      data?: unknown,
      as = "",
      method?: string,
    ) => {
      let r = await call(path, data, as, method);
      r = await completeRequiredPasswordChange(path, data, r, (next, payload) =>
        call(next, payload, ""),
      );
      if (r.status >= 400)
        throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
      return r.body;
    };
    return { call, must };
  };

  describe.each(["America/Santo_Domingo", "UTC"])(
    "sesión de PostgreSQL en %s",
    (zone) => {
      let api: Awaited<ReturnType<typeof startApi>> | undefined;
      let owner = "",
        roles: any[] = [];
      const lane = (n: number) => clientOf(api!.base, "198.18.7." + n);
      const enrollLocal = async (
        client: ReturnType<typeof clientOf>,
        accessToken: string,
        label: string,
      ) => {
        const id = randomUUID();
        const terminal = await client.must(
          "/terminals/register",
          { id, name: label, secret: secretOf(id) },
          accessToken,
        );
        if (terminal.status === "pending")
          await lane(0).must("/terminals/" + id + "/approve", {}, owner);
        return id;
      };
      const newUser = async (role: string, pin = "876543") => {
        const user = await lane(0).must(
          "/users",
          {
            name: "QA zona " + randomUUID().slice(0, 8),
            email: "zona-" + randomUUID() + "@example.test",
            password,
            pin,
            roleId: roles.find((r: any) => r.name === role).id,
          },
          owner,
        );
        actors.push(user);
        // Todo usuario creado por un administrador debe reemplazar su clave
        // temporal antes de obtener una sesión utilizable. La ayuda global
        // completa ese flujo y recuerda la clave activa para los logins que
        // siguen dentro de esta matriz de zonas horarias.
        await lane(0).must("/auth/login", {
          email: user.email,
          password,
        });
        return user;
      };
      beforeAll(async () => {
        const databaseUrl = withSessionTimeZone(process.env.DATABASE_URL, zone);
        // Sin esto las pruebas podrían pasar sin haber cambiado la zona: la fija
        // la cadena de conexión («client») y no el rol ni el servidor.
        expect(await sessionTimeZone(databaseUrl)).toEqual({
          setting: zone,
          source: "client",
        });
        api = await startApi(databaseUrl);
        owner = (
          await lane(0).must("/auth/login", {
            email: "admin@fitstore.demo",
            password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
          })
        ).accessToken;
        roles = await lane(0).must("/roles", undefined, owner);
      }, 90000);
      afterAll(async () => {
        await api?.stop();
      });

      it("K4: cinco contraseñas incorrectas bloquean el ingreso 15 minutos desde esa dirección (AuthAttempt) y un bloqueo vencido deja de aplicar", async () => {
        const client = lane(1);
        const { call } = client;
        const user = await newUser("seller");
        const login = (pass = password) =>
          call("/auth/login", { email: user.email, password: pass });
        // Desde R9-seguridad-1 el contador de la contraseña es el mismo
        // AuthAttempt del PIN, con una clave por cuenta y dirección IP. Aquí
        // todos los intentos salen de una sola dirección: hay una sola fila.
        const where = { key: { startsWith: "login:" + user.id + ":" } };
        const stored = async () => {
          const rows = await fixtureDb.authAttempt.findMany({ where });
          expect(rows).toHaveLength(1);
          return rows[0];
        };
        try {
          const open = await login();
          expect(open.status).toBe(201);
          await enrollLocal(client, open.body.accessToken, "QA K4 contraseña");
          const me = () => call("/auth/me", undefined, open.body.accessToken);
          expect((await me()).status).toBe(200);
          for (let n = 0; n < 5; n++) {
            const wrong = await login("incorrecta");
            expect(wrong.status).toBe(400);
            expect(wrong.body.message).toMatch(/incorrectos/);
          }
          const locked = await stored();
          expect(locked.failedAttempts).toBe(5);
          // Leído con Prisma, en UTC: vence dentro de unos 15 minutos y no hace
          // horas.
          const left = (+locked.lockedUntil - Date.now()) / MINUTE;
          expect.soft(left).toBeGreaterThan(13);
          expect.soft(left).toBeLessThan(17);
          // Mientras dura el bloqueo también se rechaza la contraseña correcta.
          const blocked = await login();
          expect.soft(blocked.status).toBe(400);
          expect.soft(String(blocked.body.message)).toMatch(/bloquead/i);
          // Ese rechazo no toca el contador ni alarga el bloqueo.
          expect.soft(await stored()).toMatchObject({
            failedAttempts: 5,
            lockedUntil: locked.lockedUntil,
          });
          // El bloqueo sólo impide entrar: la sesión que ya estaba abierta
          // sigue (R9-seguridad-1).
          expect.soft((await me()).status).toBe(200);
          // Bloqueo vencido hace cinco minutos: otra contraseña incorrecta
          // empieza la cuenta de nuevo y no vuelve a bloquear...
          const expire = () =>
            fixtureDb.authAttempt.updateMany({
              where,
              data: {
                failedAttempts: 5,
                lockedUntil: new Date(Date.now() - 5 * MINUTE),
              },
            });
          await expire();
          expect((await login("incorrecta")).body.message).not.toMatch(
            /bloquead/i,
          );
          expect.soft(await stored()).toMatchObject({
            failedAttempts: 1,
            lockedUntil: null,
          });
          // ...y la contraseña correcta entra aunque el contador siga en cinco.
          await expire();
          expect((await login()).status).toBe(201);
          expect(await stored()).toMatchObject({
            failedAttempts: 0,
            lockedUntil: null,
          });
          expect((await me()).status).toBe(200);
        } finally {
          await fixtureDb.authAttempt.deleteMany({ where });
        }
      }, 60000);

      it("K4: cinco PIN incorrectos bloquean al solicitante 15 minutos (AuthAttempt) y un bloqueo vencido deja de aplicar", async () => {
        const client = lane(2);
        const { call, must } = client;
        const actor = await newUser("seller");
        const target = await newUser("seller", "654321");
        const as = (await must("/auth/login", { email: actor.email, password }))
          .accessToken;
        await enrollLocal(client, as, "QA K4 PIN");
        const key = "switch:" + actor.id;
        const pin = (value: string) =>
          call("/auth/pin", { userId: target.id, pin: value }, as);
        const stored = () =>
          fixtureDb.authAttempt.findUniqueOrThrow({ where: { key } });
        try {
          for (let n = 0; n < 5; n++) {
            const wrong = await pin("000000");
            expect(wrong.status).toBe(400);
            expect(wrong.body.message).toMatch(/PIN incorrecto/);
          }
          const locked = await stored();
          expect(locked.failedAttempts).toBe(5);
          const left = (+locked.lockedUntil - Date.now()) / MINUTE;
          expect.soft(left).toBeGreaterThan(13);
          expect.soft(left).toBeLessThan(17);
          // Mientras dura el bloqueo también se rechaza el PIN correcto.
          const blocked = await pin("654321");
          expect(blocked.status).toBe(400);
          expect(blocked.body.message).toMatch(/bloquead/i);
          // El contador es del solicitante: su sesión sigue abierta.
          expect((await call("/auth/me", undefined, as)).status).toBe(200);
          // Vencido hace cinco minutos: el PIN correcto entra y el contador se
          // limpia.
          await fixtureDb.authAttempt.update({
            where: { key },
            data: {
              failedAttempts: 5,
              lockedUntil: new Date(Date.now() - 5 * MINUTE),
            },
          });
          expect((await pin("654321")).status).toBe(201);
          expect(await stored()).toMatchObject({
            failedAttempts: 0,
            lockedUntil: null,
          });
        } finally {
          await fixtureDb.authAttempt.deleteMany({ where: { key } });
        }
      }, 60000);

      it("TZ-1 y TZ-6: los paneles del tablero en SQL crudo cubren el mismo día dominicano que los totales del ORM", async () => {
        const { must } = lane(3);
        const cashier = await newUser("admin");
        const as = (
          await must("/auth/login", { email: cashier.email, password })
        ).accessToken;
        await enrollLocal(lane(3), as, "QA zona");
        const category = (await must("/categories", undefined, as)).find(
          (c: any) => c.name === "Ropa deportiva",
        );
        const product = await must(
          "/products",
          {
            name: "QA zona " + randomUUID().slice(0, 8),
            sku: "R9Z-" + randomUUID().slice(0, 8),
            categoryId: category.id,
            variants: [
              {
                sku: "R9ZV-" + randomUUID().slice(0, 8),
                barcode: "R9ZB-" + randomUUID().slice(0, 8),
                price: 100,
                costAvg: 40,
              },
            ],
          },
          as,
        );
        products.push(product);
        const variantId = product.variants[0].id;
        await must(
          "/inventory/adjustments",
          { variantId, qty: 15, reason: "QA zona horaria" },
          as,
        );
        const cash = await must(
          "/cash-sessions/open",
          { openingAmount: 0 },
          as,
        );
        try {
          // Un día dominicano sin ventas, tampoco de otra ejecución sobre la
          // misma base, ni en la víspera ni al día siguiente.
          const iso = (date: Date) => date.toISOString().slice(0, 10);
          let day = "",
            midnight = new Date(0);
          do {
            day = iso(
              new Date(
                Date.UTC(
                  2003 + Math.floor(Math.random() * 15),
                  0,
                  1 + Math.floor(Math.random() * 365),
                ),
              ),
            );
            midnight = new Date(day + "T00:00:00-04:00");
          } while (
            await fixtureDb.sale.count({
              where: {
                createdAt: {
                  gte: new Date(+midnight - DAY),
                  lt: new Date(+midnight + 2 * DAY),
                },
              },
            })
          );
          const noon = Date.parse(day + "T12:00:00Z");
          const eve = iso(new Date(noon - DAY)),
            next = iso(new Date(noon + DAY));
          const weekday = (date: string) =>
            new Date(date + "T12:00:00Z").getUTCDay() || 7;
          const sell = async (qty: number, createdAt: Date) => {
            let s: any;
            try {
              s = await must(
                "/sales",
                {
                  offlineUuid: randomUUID(),
                  customerId: defaultCustomerId,
                  cashSessionId: cash.id,
                  items: [{ variantId, qty }],
                  payments: [{ method: "cash", amount: 100 * qty }],
                  expectedTotal: 100 * qty,
                },
                as,
              );
            } catch (error) {
              throw new Error(
                String(error) + "\nAPI secundaria: " + api?.errors(),
              );
            }
            await fixtureDb.sale.update({
              where: { id: s.id },
              data: { createdAt },
            });
          };
          // Cantidades 1, 2, 4 y 8: cada total dice qué ventas entraron. A
          // menos de cuatro horas de cada borde del día está el desfase que
          // antes aplicaba una sesión en UTC-4.
          await sell(1, new Date(+midnight + 10 * MINUTE)); // 00:10 del día
          await sell(2, new Date(+midnight + DAY - 10 * MINUTE)); // 23:50 del día
          await sell(4, new Date(+midnight - 10 * MINUTE)); // 23:50 de la víspera
          await sell(8, new Date(+midnight + DAY + 10 * MINUTE)); // 00:10 del siguiente
          const summary = (date: string) =>
            must(`/dashboard/summary?from=${date}&to=${date}`, undefined, as);
          const today = await summary(day);
          // Totales del ORM: correctos con cualquier sesión.
          expect(today.invoices).toBe(2);
          expect(today.revenue).toBe(300);
          // Paneles en SQL crudo: las mismas dos ventas, en su día y hora
          // dominicanos.
          expect.soft(today.daily).toEqual([{ day, total: 300 }]);
          expect
            .soft(today.category.map((c: any) => [c.name, c.total]))
            .toEqual([[category.name, 300]]);
          expect.soft(today.top).toEqual([
            {
              name: product.name,
              category: category.name,
              units: 3,
              revenue: 300,
            },
          ]);
          expect
            .soft(today.sellers)
            .toEqual([{ name: cashier.name, total: 300 }]);
          expect.soft(today.peakHours).toEqual([
            { day: weekday(day), hour: 0, invoices: 1, total: 100 },
            { day: weekday(day), hour: 23, invoices: 1, total: 200 },
          ]);
          // Las otras dos son de la víspera y del día siguiente.
          const previous = await summary(eve);
          expect(previous.invoices).toBe(1);
          expect.soft(previous.daily).toEqual([{ day: eve, total: 400 }]);
          expect
            .soft(previous.peakHours)
            .toEqual([
              { day: weekday(eve), hour: 23, invoices: 1, total: 400 },
            ]);
          const following = await summary(next);
          expect(following.invoices).toBe(1);
          expect.soft(following.daily).toEqual([{ day: next, total: 800 }]);
          expect
            .soft(following.peakHours)
            .toEqual([
              { day: weekday(next), hour: 0, invoices: 1, total: 800 },
            ]);
        } finally {
          const current = (await must("/cash-sessions", undefined, as)).find(
            (c: any) => c.id === cash.id,
          );
          await must(
            "/cash-sessions/" + cash.id + "/close",
            {
              countedCash: current.expected.cash,
              countedCard: current.expected.card,
              countedTransfer: current.expected.transfer,
              notes: "Cierre de pruebas",
            },
            as,
          );
        }
      }, 60000);
    },
  );

  it("TZ-3: compose.yaml y .env.example fijan la sesión en UTC y PostgreSQL acepta esa opción", async () => {
    const { readFile } = await import("node:fs/promises");
    for (const file of ["compose.yaml", ".env.example"]) {
      const text = await readFile(
        new URL("../" + file, import.meta.url),
        "utf8",
      );
      const query = text.match(/DATABASE_URL[:=]\s*\S+?\?(\S+)/)?.[1] ?? "";
      expect(new URLSearchParams(query).get("options"), file).toBe(
        "-c TimeZone=UTC",
      );
      // La opción, tal como está escrita en el archivo, se impone a la zona
      // del rol o del servidor.
      const url = new URL(process.env.DATABASE_URL!);
      url.search = query;
      expect(await sessionTimeZone(url.toString()), file).toEqual({
        setting: "UTC",
        source: "client",
      });
    }
  });
});

// R9-A01 (auditoría de ChatGPT a la ronda 9): repetir exactamente la misma
// devolución —el reintento de un formulario cuya respuesta se perdió— creaba
// otra devolución, otra nota de crédito y reponía el stock dos veces. Ahora la
// interfaz envía un UUID por formulario y la API devuelve la devolución
// original cuando lo vuelve a recibir con los mismos datos.
describe("Ronda 9 · auditoría de ChatGPT · R9-A01 devolución idempotente", () => {
  let owner = "",
    cashId = "",
    variant: any;
  const ip = "198.18.9." + ((Date.now() % 250) + 1);
  const call = async (
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + owner,
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(prepareTestPayload(path, data)) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const must = async (path: string, data?: unknown, method?: string) => {
    const r = await call(path, data, method);
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  };
  const stockOf = async () =>
    Number(
      (await fixtureDb.variant.findUniqueOrThrow({ where: { id: variant.id } }))
        .stock,
    );
  // Una venta de dos unidades, lista para devolver una.
  const sellTwo = async () =>
    must("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: cashId,
      items: [{ variantId: variant.id, qty: 2 }],
      payments: [{ method: "cash", amount: 200 }],
      expectedTotal: 200,
    });
  const returnOne = (sale: any, operationId?: string, extra = {}) => ({
    ...(operationId ? { operationId } : {}),
    saleId: sale.id,
    cashSessionId: cashId,
    reason: "Reenvío idéntico por respuesta perdida",
    refundMethod: "credit_note",
    items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    ...extra,
  });
  const returnsOf = (sale: any) =>
    fixtureDb.saleReturn.findMany({ where: { saleId: sale.id } });
  const closeOwnerCash = async () => {
    const me = await must("/auth/me");
    for (const s of (await must("/cash-sessions")).filter(
      (c: any) => !c.closedAt && c.userId === me.id,
    ))
      await must("/cash-sessions/" + s.id + "/close", {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        countedTransfer: Math.max(0, s.expected.transfer),
        notes: "Cierre QA R9-A01",
      });
  };
  afterAll(async () => {
    if (owner) await closeOwnerCash();
  });
  beforeAll(async () => {
    owner = (
      await must("/auth/login", {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      })
    ).accessToken;
    const terminalId = randomUUID();
    const terminal = await must("/terminals/register", {
      id: terminalId,
      name: "QA R9-A01",
      secret: "qa-a01-" + terminalId,
    });
    if (terminal.status === "pending")
      await must("/terminals/" + terminalId + "/approve", {});
    // La caja va con el equipo que la abre: se cierra la que el dueño tuviera
    // abierta en otro equipo y se abre una en este.
    await closeOwnerCash();
    cashId = (
      await must("/cash-sessions/open", {
        registerId: "qa-a01-" + suffix,
        openingAmount: 500,
      })
    ).id;
    const categories = await must("/categories");
    const category =
      categories.find((c: any) => c.name === "Ropa deportiva") ?? categories[0];
    const product = await must("/products", {
      name: "QA R9-A01 reintento " + suffix,
      sku: "R9A01-" + randomUUID().slice(0, 8),
      categoryId: category.id,
      variants: [
        {
          sku: "R9A01V-" + randomUUID().slice(0, 8),
          barcode: "R9A01B" + Date.now().toString().slice(-8),
          price: 100,
          costAvg: 50,
        },
      ],
    });
    variant = product.variants[0];
    products.push(product);
    await must("/inventory/adjustments", {
      variantId: variant.id,
      qty: 20,
      reason: "QA R9-A01 existencias",
    });
  }, 60000);

  it("el mismo envío repetido devuelve la devolución original: una sola nota de crédito y el stock sube una vez", async () => {
    const sale = await sellTwo();
    const before = await stockOf();
    const body = returnOne(sale, randomUUID());
    const first = await must("/returns", body);
    const second = await must("/returns", body);
    expect(second.id).toBe(first.id);
    expect(second.number).toBe(first.number);
    expect(await returnsOf(sale)).toHaveLength(1);
    expect(
      await fixtureDb.creditNote.count({ where: { returnId: first.id } }),
    ).toBe(1);
    expect(await stockOf()).toBe(before + 1);
    expect(
      Number(
        (
          await fixtureDb.saleItem.findUniqueOrThrow({
            where: { id: sale.items[0].id },
          })
        ).returnedQty,
      ),
    ).toBe(1);
  });

  it("la misma clave con otros datos se rechaza sin escribir nada", async () => {
    const sale = await sellTwo();
    const before = await stockOf();
    const operationId = randomUUID();
    await must("/returns", returnOne(sale, operationId));
    const other = await call(
      "/returns",
      returnOne(sale, operationId, { refundMethod: "cash" }),
    );
    expect(other.status).toBe(400);
    expect(other.body.message).toMatch(/UUID/);
    const different = await call("/returns", {
      ...returnOne(sale, operationId),
      items: [{ saleItemId: sale.items[0].id, qty: 2, restock: true }],
    });
    expect(different.status).toBe(400);
    expect(await returnsOf(sale)).toHaveLength(1);
    expect(await stockOf()).toBe(before + 1);
  });

  it("seis envíos simultáneos con la misma clave producen una sola devolución", async () => {
    const sale = await sellTwo();
    const before = await stockOf();
    const body = returnOne(sale, randomUUID());
    const results = await Promise.all(
      Array.from({ length: 6 }, () => call("/returns", body)),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
    expect(new Set(results.map((r) => r.body.id)).size).toBe(1);
    expect(await returnsOf(sale)).toHaveLength(1);
    expect(await stockOf()).toBe(before + 1);
  });

  it("otra clave sí es otra devolución, y sin clave la devolución sigue funcionando", async () => {
    const sale = await sellTwo();
    const before = await stockOf();
    const first = await must("/returns", returnOne(sale, randomUUID()));
    const second = await must("/returns", returnOne(sale, randomUUID()));
    expect(second.id).not.toBe(first.id);
    expect(await returnsOf(sale)).toHaveLength(2);
    expect(await stockOf()).toBe(before + 2);
    // Ya no queda nada que devolver: la tercera, con o sin clave, se rechaza.
    expect((await call("/returns", returnOne(sale, randomUUID()))).status).toBe(
      400,
    );
    const legacy = await sellTwo();
    expect((await call("/returns", returnOne(legacy))).status).toBe(201);
    expect(await returnsOf(legacy)).toHaveLength(1);
  });
});

// R9-A02 (auditoría de ChatGPT a la ronda 9): el cuadre de una caja ya
// cerrada restaba las devoluciones de sus ventas aunque se hicieran días
// después desde otra caja, y la caja de la devolución no las reflejaba. Un
// cierre aprobado no se reescribe: la devolución ajusta la rentabilidad de la
// caja donde se registró, una sola vez.
describe("Ronda 9 · auditoría de ChatGPT · R9-A02 cierre histórico intacto", () => {
  let owner = "",
    variant: any;
  const ip = "198.18.9." + (((Date.now() + 7) % 250) + 1);
  const call = async (
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + owner,
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(prepareTestPayload(path, data)) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const must = async (path: string, data?: unknown, method?: string) => {
    const r = await call(path, data, method);
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  };
  const closeOwnerCash = async () => {
    const me = await must("/auth/me");
    for (const s of (await must("/cash-sessions")).filter(
      (c: any) => !c.closedAt && c.userId === me.id,
    ))
      await closeCash(s.id);
  };
  const closeCash = async (id: string) => {
    const s = (await must("/cash-sessions")).find((c: any) => c.id === id);
    await must("/cash-sessions/" + id + "/close", {
      countedCash: Math.max(0, s.expected.cash),
      countedCard: Math.max(0, s.expected.card),
      countedTransfer: Math.max(0, s.expected.transfer),
      notes: "Cierre QA R9-A02",
    });
  };
  const openCash = async () =>
    (
      await must("/cash-sessions/open", {
        registerId: "qa-a02-" + suffix,
        openingAmount: 500,
      })
    ).id;
  const profitOf = async (id: string) =>
    Number(
      (await must("/cash-sessions/" + id + "/cuadre")).lines.find(
        (l: any) => l.key === "profit",
      ).value,
    );
  afterAll(async () => {
    if (owner) await closeOwnerCash();
  });
  beforeAll(async () => {
    owner = (
      await must("/auth/login", {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      })
    ).accessToken;
    const terminalId = randomUUID();
    const terminal = await must("/terminals/register", {
      id: terminalId,
      name: "QA R9-A02",
      secret: "qa-a02-" + terminalId,
    });
    if (terminal.status === "pending")
      await must("/terminals/" + terminalId + "/approve", {});
    await closeOwnerCash();
    const categories = await must("/categories");
    const category =
      categories.find((c: any) => c.name === "Ropa deportiva") ?? categories[0];
    const product = await must("/products", {
      name: "QA R9-A02 cierre " + suffix,
      sku: "R9A02-" + randomUUID().slice(0, 8),
      categoryId: category.id,
      variants: [
        {
          sku: "R9A02V-" + randomUUID().slice(0, 8),
          barcode: "R9A02B" + Date.now().toString().slice(-8),
          price: 100,
          costAvg: 40,
        },
      ],
    });
    variant = product.variants[0];
    products.push(product);
    await must("/inventory/adjustments", {
      variantId: variant.id,
      qty: 10,
      reason: "QA R9-A02 existencias",
    });
  }, 60000);

  it("una devolución desde otra caja no cambia el cierre original y ajusta la caja donde se registró, una sola vez", async () => {
    // Caja A: vende y cierra.
    const a = await openCash();
    const sale = await must("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: a,
      items: [{ variantId: variant.id, qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
      expectedTotal: 100,
    });
    const profitA = await profitOf(a);
    expect(profitA).toBeGreaterThan(0);
    await closeCash(a);
    expect(await profitOf(a)).toBe(profitA);
    // Caja B, otro día de trabajo: devuelve la venta de A.
    const b = await openCash();
    expect(await profitOf(b)).toBe(0);
    const returned = await must("/returns", {
      operationId: randomUUID(),
      saleId: sale.id,
      cashSessionId: b,
      reason: "QA R9-A02 devolución desde otra caja",
      refundMethod: "cash",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    });
    const adjustment =
      Math.round(
        (Number(returned.total) -
          Number(returned.taxTotal) -
          Number(returned.costTotal)) *
          100,
      ) / 100;
    expect(adjustment).toBeGreaterThan(0);
    // El cierre de A queda como se aprobó...
    expect(await profitOf(a)).toBe(profitA);
    // ...y B refleja la devolución, con referencia a la venta original.
    expect(await profitOf(b)).toBe(-adjustment);
    const cuadreB = await must("/cash-sessions/" + b + "/cuadre");
    expect(JSON.stringify(cuadreB)).toContain(returned.id);
    await closeCash(b);
    expect(await profitOf(b)).toBe(-adjustment);
    expect(await profitOf(a)).toBe(profitA);
  });
});

// R9-A05 (auditoría de ChatGPT a la ronda 9): una devolución dañada o abierta,
// que no vuelve al stock vendible, quedaba sin cantidad ni valor: el
// movimiento «return_waste» tenía cantidad 0 y la devolución costo 0, así que
// el kardex no podía recuperar que se recibió una unidad. Ahora la merma se
// cuenta y se valora aparte; el costo contable sigue en cero para no descontar
// la utilidad dos veces, y el stock vendible no cambia.
describe("Ronda 9 · auditoría de ChatGPT · R9-A05 merma de devoluciones", () => {
  let owner = "",
    cashId = "",
    variant: any;
  const ip = "198.18.9." + (((Date.now() + 13) % 250) + 1);
  const call = async (
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + owner,
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(prepareTestPayload(path, data)) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const must = async (path: string, data?: unknown, method?: string) => {
    const r = await call(path, data, method);
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  };
  const closeOwnerCash = async () => {
    const me = await must("/auth/me");
    for (const s of (await must("/cash-sessions")).filter(
      (c: any) => !c.closedAt && c.userId === me.id,
    ))
      await must("/cash-sessions/" + s.id + "/close", {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        countedTransfer: Math.max(0, s.expected.transfer),
        notes: "Cierre QA R9-A05",
      });
  };
  afterAll(async () => {
    if (owner) await closeOwnerCash();
  });
  beforeAll(async () => {
    owner = (
      await must("/auth/login", {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      })
    ).accessToken;
    const terminalId = randomUUID();
    const terminal = await must("/terminals/register", {
      id: terminalId,
      name: "QA R9-A05",
      secret: "qa-a05-" + terminalId,
    });
    if (terminal.status === "pending")
      await must("/terminals/" + terminalId + "/approve", {});
    await closeOwnerCash();
    cashId = (
      await must("/cash-sessions/open", {
        registerId: "qa-a05-" + suffix,
        openingAmount: 500,
      })
    ).id;
    const categories = await must("/categories");
    const category =
      categories.find((c: any) => c.name === "Ropa deportiva") ?? categories[0];
    const product = await must("/products", {
      name: "QA R9-A05 merma " + suffix,
      sku: "R9A05-" + randomUUID().slice(0, 8),
      categoryId: category.id,
      variants: [
        {
          sku: "R9A05V-" + randomUUID().slice(0, 8),
          barcode: "R9A05B" + Date.now().toString().slice(-8),
          price: 100,
          costAvg: 20,
        },
      ],
    });
    variant = product.variants[0];
    products.push(product);
    await must("/inventory/adjustments", {
      variantId: variant.id,
      qty: 5,
      reason: "QA R9-A05 existencias",
    });
  }, 60000);

  it("una unidad devuelta dañada queda contada y valorada como merma, sin tocar el stock vendible ni el costo contable", async () => {
    const sale = await must("/sales", {
      offlineUuid: randomUUID(),
      customerId: defaultCustomerId,
      cashSessionId: cashId,
      items: [{ variantId: variant.id, qty: 1 }],
      payments: [{ method: "cash", amount: 100 }],
      expectedTotal: 100,
    });
    const stockBefore = Number(
      (await fixtureDb.variant.findUniqueOrThrow({ where: { id: variant.id } }))
        .stock,
    );
    const returned = await must("/returns", {
      operationId: randomUUID(),
      saleId: sale.id,
      cashSessionId: cashId,
      reason: "Producto roto al regresar",
      refundMethod: "cash",
      items: [
        { saleItemId: sale.items[0].id, qty: 1, restock: false, damaged: true },
      ],
    });
    // Stock vendible intacto y costo contable en cero, como antes...
    expect(
      Number(
        (
          await fixtureDb.variant.findUniqueOrThrow({
            where: { id: variant.id },
          })
        ).stock,
      ),
    ).toBe(stockBefore);
    const row = await fixtureDb.saleReturn.findUniqueOrThrow({
      where: { id: returned.id },
    });
    expect(Number(row.costTotal)).toBe(0);
    // ...pero la merma queda contada y valorada al costo de la venta.
    expect(Number(row.wasteQty)).toBe(1);
    expect(Number(row.wasteCostTotal)).toBe(20);
    expect((row.items as any[])[0]).toMatchObject({
      wasteQty: 1,
      wasteCost: 20,
      cost: 0,
    });
    const waste = await fixtureDb.inventoryMovement.findMany({
      where: { variantId: variant.id, type: "return_waste", refId: sale.id },
    });
    expect(waste).toHaveLength(1);
    expect(Number(waste[0].qty)).toBe(1);
    expect(Number(waste[0].unitCost)).toBe(20);
    expect(Number(waste[0].balanceAfter)).toBe(stockBefore);
    // El kardex del día lo muestra con su cantidad.
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    const kardex = (
      await must(`/reports/kardex?from=${today}&to=${today}`)
    ).rows.filter(
      (r: any) => r.SKU === variant.sku && r.Tipo === "return_waste",
    );
    expect(kardex).toHaveLength(1);
    expect(kardex[0]).toMatchObject({
      Cantidad: 1,
      Saldo: stockBefore,
      Costo: 20,
    });
    // La utilidad sigue cargando el costo de la unidad perdida una sola vez.
    const profit = (
      await must(`/reports/profit?from=${today}&to=${today}`)
    ).rows.find((r: any) => r.Producto === "QA R9-A05 merma " + suffix);
    expect(profit.Costo).toBe(20);
  });
});

// R9-A04 (auditoría de ChatGPT a la ronda 9): los validadores generales de
// dinero aceptaban cualquier decimal, PostgreSQL redondeaba al guardar y la
// orden (2 × 100.005 = 200.01) no cuadraba con su recepción (2 × 100.01 =
// 200.02). Todo importe que termina en Decimal(14,2) exige como máximo 2
// decimales; las cantidades físicas siguen admitiendo 3.
describe("Ronda 9 · auditoría de ChatGPT · R9-A04 precisión monetaria", () => {
  let owner = "",
    supplierId = "",
    categoryId = "",
    variant: any;
  const ip = "198.18.9." + (((Date.now() + 19) % 250) + 1);
  const call = async (
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + owner,
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(prepareTestPayload(path, data)) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const must = async (path: string, data?: unknown, method?: string) => {
    const r = await call(path, data, method);
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  };
  const closeOwnerCash = async () => {
    const me = await must("/auth/me");
    for (const s of (await must("/cash-sessions")).filter(
      (c: any) => !c.closedAt && c.userId === me.id,
    ))
      await must("/cash-sessions/" + s.id + "/close", {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        countedTransfer: Math.max(0, s.expected.transfer),
        notes: "Cierre QA R9-A04",
      });
  };
  const counts = async () => ({
    products: await fixtureDb.product.count(),
    orders: await fixtureDb.purchaseOrder.count(),
    customers: await fixtureDb.customer.count(),
    sessions: await fixtureDb.cashSession.count(),
    receipts: await fixtureDb.goodsReceipt.count(),
    movements: await fixtureDb.inventoryMovement.count(),
  });
  afterAll(async () => {
    if (owner) await closeOwnerCash();
  });
  beforeAll(async () => {
    owner = (
      await must("/auth/login", {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      })
    ).accessToken;
    const terminalId = randomUUID();
    const terminal = await must("/terminals/register", {
      id: terminalId,
      name: "QA R9-A04",
      secret: "qa-a04-" + terminalId,
    });
    if (terminal.status === "pending")
      await must("/terminals/" + terminalId + "/approve", {});
    await closeOwnerCash();
    supplierId = (await must("/suppliers"))[0].id;
    const categories = await must("/categories");
    categoryId = (
      categories.find((c: any) => c.name === "Ropa deportiva") ?? categories[0]
    ).id;
    const product = await must("/products", {
      name: "QA R9-A04 centavos " + suffix,
      sku: "R9A04-" + randomUUID().slice(0, 8),
      categoryId,
      variants: [
        {
          sku: "R9A04V-" + randomUUID().slice(0, 8),
          barcode: "R9A04B" + Date.now().toString().slice(-8),
          price: 100,
          costAvg: 50,
        },
      ],
    });
    variant = product.variants[0];
    products.push(product);
  }, 60000);

  it("un importe con 3 decimales se rechaza con 400 en precios, costos, flete, apertura, límites y documentos, sin escribir nada", async () => {
    const before = await counts();
    const sku = () => "R9A04X-" + randomUUID().slice(0, 8);
    const attempts: [string, unknown][] = [
      [
        "/products",
        {
          name: "QA R9-A04 precio " + suffix,
          sku: sku(),
          categoryId,
          variants: [
            { sku: sku(), barcode: sku(), price: 100.005, costAvg: 50 },
          ],
        },
      ],
      [
        "/products",
        {
          name: "QA R9-A04 costo " + suffix,
          sku: sku(),
          categoryId,
          variants: [
            { sku: sku(), barcode: sku(), price: 100, costAvg: 50.005 },
          ],
        },
      ],
      [
        "/purchase-orders",
        {
          supplierId,
          items: [{ variantId: variant.id, qty: 2, unitCost: 100.005 }],
        },
      ],
      [
        "/cash-sessions/open",
        { registerId: "qa-a04-" + suffix, openingAmount: 500.005 },
      ],
      [
        "/customers",
        { name: "QA R9-A04 cliente " + suffix, creditLimit: 1000.005 },
      ],
      [
        "/merchandise/operations",
        {
          id: randomUUID(),
          direction: "entry",
          supplierId,
          freight: 1.005,
          items: [{ variantId: variant.id, qty: 1, unitCost: 10 }],
        },
      ],
      [
        "/merchandise/operations",
        {
          id: randomUUID(),
          direction: "entry",
          supplierId,
          items: [{ variantId: variant.id, qty: 1, unitCost: 10.005 }],
        },
      ],
      [
        "/merchandise/operations",
        {
          id: randomUUID(),
          direction: "entry",
          supplierId,
          items: [
            {
              quick: {
                name: "QA R9-A04 rápido " + suffix,
                categoryId,
                price: 20.005,
                cost: 10,
                barcode: sku(),
                variant: "Única",
              },
              qty: 1,
              unitCost: 10,
            },
          ],
        },
      ],
    ];
    for (const [path, body] of attempts) {
      const r = await call(path, body);
      expect(r.status, path + " " + JSON.stringify(body)).toBe(400);
      expect(r.body.message, path).toMatch(/2 decimales/);
    }
    expect(await counts()).toEqual(before);
  });

  it("con 2 decimales la orden y su recepción cuadran al centavo", async () => {
    const order = await must("/purchase-orders", {
      supplierId,
      items: [{ variantId: variant.id, qty: 2, unitCost: 100.01 }],
    });
    expect(Number(order.total)).toBe(200.02);
    const receipt = await must("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 2 }],
    });
    expect(Number(receipt.total)).toBe(Number(order.total));
    // Las cantidades físicas siguen admitiendo 3 decimales.
    const fine = await call("/inventory/adjustments", {
      variantId: variant.id,
      qty: 0.125,
      reason: "QA R9-A04 cantidad fina",
    });
    expect(fine.status).toBe(201);
  });
});

// R9-A03 (auditoría de ChatGPT a la ronda 9): la entrada de mercancía
// validaba el total de la factura del proveedor (con o sin lo dañado) y luego
// lo descartaba: la recepción sólo guardaba lo aceptado y lo dañado, así que
// el valor documental que se comprobó no se podía recuperar ni exportar.
describe("Ronda 9 · auditoría de ChatGPT · R9-A03 total de la factura conservado", () => {
  let owner = "",
    supplierId = "",
    variant: any;
  const ip = "198.18.9." + (((Date.now() + 23) % 250) + 1);
  const call = async (
    path: string,
    data?: unknown,
    method = data === undefined ? "GET" : "POST",
  ) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        Authorization: "Bearer " + owner,
      },
      ...(data === undefined
        ? {}
        : { body: JSON.stringify(prepareTestPayload(path, data)) }),
    });
    return { status: response.status, body: await response.json() };
  };
  const must = async (path: string, data?: unknown, method?: string) => {
    const r = await call(path, data, method);
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  };
  beforeAll(async () => {
    owner = (
      await must("/auth/login", {
        email: "admin@fitstore.demo",
        password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
      })
    ).accessToken;
    const terminalId = randomUUID();
    const terminal = await must("/terminals/register", {
      id: terminalId,
      name: "QA R9-A03",
      secret: "qa-a03-" + terminalId,
    });
    if (terminal.status === "pending")
      await must("/terminals/" + terminalId + "/approve", {});
    supplierId = (
      await must("/suppliers", { name: "QA R9-A03 proveedor " + suffix })
    ).id;
    const categories = await must("/categories");
    const category =
      categories.find((c: any) => c.name === "Ropa deportiva") ?? categories[0];
    const product = await must("/products", {
      name: "QA R9-A03 factura " + suffix,
      sku: "R9A03-" + randomUUID().slice(0, 8),
      categoryId: category.id,
      variants: [
        {
          sku: "R9A03V-" + randomUUID().slice(0, 8),
          barcode: "R9A03B" + Date.now().toString().slice(-8),
          price: 200,
          costAvg: 100,
        },
      ],
    });
    variant = product.variants[0];
    products.push(product);
  }, 60000);

  it("una factura de 400 con 300 buenos y 100 dañados conserva el 400, lo aceptado, lo dañado y la diferencia, en consulta y exportación", async () => {
    const entry = await must("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      invoiceTotal: 400,
      supplierInvoice: "F-A03-" + suffix,
      items: [
        {
          variantId: variant.id,
          qty: 3,
          damagedQty: 1,
          damageReason: "Caja golpeada",
          unitCost: 100,
        },
      ],
    });
    const receipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { supplierId, supplierInvoice: "F-A03-" + suffix },
    });
    expect(Number(receipt.total)).toBe(300);
    expect(Number(receipt.damagedCost)).toBe(100);
    expect(Number(receipt.invoiceTotal)).toBe(400);
    expect(Number(receipt.invoiceDifference)).toBe(0);
    expect(entry).toMatchObject({
      total: 300,
      invoiceTotal: 400,
      invoiceDifference: 0,
    });
    const listed = (
      await must("/goods-receipts?supplierId=" + supplierId)
    ).find((r: any) => r.id === receipt.id);
    expect(listed).toMatchObject({
      total: 300,
      invoiceTotal: 400,
      invoiceDifference: 0,
    });
    // La exportación contable lleva el total del documento.
    const response = await fetch(base + "/goods-receipts/export", {
      headers: { Authorization: "Bearer " + owner, "X-Forwarded-For": ip },
    });
    expect(response.status).toBe(200);
    const ExcelJS = requireApi("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const sheet = book.getWorksheet("Compras");
    const headers = (sheet.getRow(1).values as any[]).slice(1);
    const col = headers.indexOf("Total factura") + 1;
    const diff = headers.indexOf("Diferencia reconocida") + 1;
    expect(col).toBeGreaterThan(0);
    expect(diff).toBeGreaterThan(0);
    const row = [...Array(sheet.rowCount).keys()]
      .map((i) => sheet.getRow(i + 1))
      .find(
        (r) =>
          r.getCell(headers.indexOf("Factura") + 1).value === "F-A03-" + suffix,
      );
    expect(row).toBeDefined();
    expect(Number(row!.getCell(col).value)).toBe(400);
    expect(Number(row!.getCell(headers.indexOf("Total") + 1).value)).toBe(300);
  });

  it("una diferencia confirmada queda reconocida con su importe", async () => {
    await must("/merchandise/operations", {
      id: randomUUID(),
      direction: "entry",
      supplierId,
      invoiceTotal: 250,
      acknowledgeMismatch: true,
      supplierInvoice: "F-A03-dif-" + suffix,
      items: [{ variantId: variant.id, qty: 2, unitCost: 100 }],
    });
    const receipt = await fixtureDb.goodsReceipt.findFirstOrThrow({
      where: { supplierId, supplierInvoice: "F-A03-dif-" + suffix },
    });
    expect(Number(receipt.total)).toBe(200);
    expect(Number(receipt.invoiceTotal)).toBe(250);
    expect(Number(receipt.invoiceDifference)).toBe(50);
  });
});

describe("I1 + K1 · lotes y concurrencia de inventario", () => {
  let variant: any;

  beforeAll(async () => {
    const category = (await ok("/categories")).find(
      (row: any) => !row.requiresLot && !row.requiresExpiry,
    );
    const product = await ok("/products", {
      name: "QA identidad lote " + suffix,
      sku: "QA-I1-" + suffix,
      categoryId: category.id,
      variants: [
        {
          sku: "QA-I1V-" + suffix,
          barcode: "QA-I1B-" + suffix,
          costAvg: 10,
          price: 20,
        },
      ],
    });
    products.push(product);
    variant = product.variants[0];
  });

  it("I1: código sin distinguir caso converge, NULL recibe fecha y otro vencimiento se rechaza", async () => {
    const codes = [" lote   i1 ", "LOTE I1", "Lote I1", "lote i1"];
    const responses = await Promise.all(
      codes.map((lotNumber) =>
        request("/inventory/adjustments", {
          variantId: variant.id,
          qty: 1,
          reason: "QA identidad concurrente",
          lotNumber,
        }),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([
      201, 201, 201, 201,
    ]);
    let lots = await fixtureDb.lot.findMany({
      where: { variantId: variant.id },
    });
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({
      lotNumber: "LOTE I1",
      lotNumberNormalized: "LOTE I1",
      expiryDate: null,
    });
    expect(Number(lots[0].qty)).toBe(4);

    await ok("/inventory/adjustments", {
      variantId: variant.id,
      qty: 1,
      reason: "QA completa vencimiento",
      lotNumber: "lote i1",
      expiryDate: "2030-01-01T04:00:00.000Z",
    });
    await ok("/inventory/adjustments", {
      variantId: variant.id,
      qty: 1,
      reason: "QA mismo día dominicano",
      lotNumber: "LOTE   I1",
      expiryDate: "2030-01-01T12:00:00.000Z",
    });
    const rejected = await request("/inventory/adjustments", {
      variantId: variant.id,
      qty: 1,
      reason: "QA vencimiento contradictorio",
      lotNumber: "Lote I1",
      expiryDate: "2030-01-02T04:00:00.000Z",
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toMatch(/vencimiento diferente/i);
    lots = await fixtureDb.lot.findMany({ where: { variantId: variant.id } });
    expect(lots).toHaveLength(1);
    expect(lots[0].expiryDate?.toISOString()).toBe("2030-01-01T04:00:00.000Z");
    expect(Number(lots[0].qty)).toBe(6);
  });

  it("K1: aplicar el mismo conteo en paralelo no duplica el movimiento", async () => {
    const product = await ok("/products", {
      name: "QA conteo K1 " + suffix,
      sku: "QA-K1-" + suffix,
      categoryId: clothing.categoryId,
      variants: [
        {
          sku: "QA-K1V-" + suffix,
          barcode: "QA-K1B-" + suffix,
          costAvg: 10,
          price: 20,
        },
      ],
    });
    products.push(product);
    const id = product.variants[0].id;
    const count = await ok("/inventory/counts", {
      items: [{ variantId: id, counted: 7 }],
    });
    const results = await Promise.all([
      request("/inventory/counts/" + count.id + "/apply", {}),
      request("/inventory/counts/" + count.id + "/apply", {}),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
    expect(
      await fixtureDb.inventoryMovement.count({
        where: { refId: count.id, type: "count" },
      }),
    ).toBe(1);
    expect(
      Number(
        (await fixtureDb.variant.findUniqueOrThrow({ where: { id } })).stock,
      ),
    ).toBe(7);
  });
});

describe("D1 + O1 · compatibilidad y resolución auditable offline", () => {
  let variant: any;

  beforeAll(async () => {
    const category = await ok("/categories", {
      name: "QA D1 sin promociones " + suffix,
    });
    const product = await ok("/products", {
      name: "QA venta offline heredada " + suffix,
      sku: "QA-D1-" + suffix,
      categoryId: category.id,
      taxRate: 0,
      variants: [
        {
          sku: "QA-D1V-" + suffix,
          barcode: "QA-D1B-" + suffix,
          costAvg: 40,
          price: 100,
        },
      ],
    });
    products.push(product);
    variant = product.variants[0];
    await ok("/inventory/adjustments", {
      variantId: variant.id,
      qty: 5,
      reason: "QA stock para compatibilidad offline",
    });
  });

  it("D1: sincroniza el descuento heredado, conserva idempotencia y exige motivo a una venta online nueva", async () => {
    const settings = await ok("/settings");
    const originalCash = await fixtureDb.cashSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { openedAt: true },
    });
    const offlineUuid = randomUUID();
    const legacyReason = "Venta offline heredada (sin motivo registrado)";
    const legacy = {
      offlineUuid,
      capturedAt: "2026-10-08T12:00:00.000Z",
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items: [{ variantId: variant.id, qty: 1, discountPercent: 10 }],
      globalDiscount: 0,
      payments: [{ method: "cash", amount: 90 }],
      expectedTotal: 90,
    };
    try {
      await fixtureDb.cashSession.update({
        where: { id: session.id },
        data: { openedAt: new Date("2026-10-08T11:00:00.000Z") },
      });
      await ok(
        "/settings",
        { ...settings, allowOfflineSales: true },
        token,
        "PUT",
      );

      const first = await ok("/sales/sync", { sales: [legacy] });
      expect(first.results[0].status, JSON.stringify(first.results[0])).toBe(
        "synced",
      );
      expect(first.results[0].sale.discountReason).toBe(legacyReason);
      const saleId = first.results[0].sale.id;
      const stored = await fixtureDb.sale.findUniqueOrThrow({
        where: { offlineUuid },
      });
      expect(stored.id).toBe(saleId);
      expect(stored.discountReason).toBe(legacyReason);

      const discountAudit = await fixtureDb.auditLog.findFirstOrThrow({
        where: {
          action: "discount_approved",
          entity: "sale",
          entityId: saleId,
        },
        orderBy: { createdAt: "desc" },
      });
      expect((discountAudit.after as any)?.reason).toBe(legacyReason);

      const second = await ok("/sales/sync", { sales: [legacy] });
      expect(second.results[0]).toMatchObject({
        status: "synced",
        sale: { id: saleId, discountReason: legacyReason },
      });
      expect(await fixtureDb.sale.count({ where: { offlineUuid } })).toBe(1);
      expect(
        await fixtureDb.auditLog.count({
          where: { action: "discount_approved", entityId: saleId },
        }),
      ).toBe(1);

      const online = await request("/sales", {
        ...legacy,
        offlineUuid: randomUUID(),
        capturedAt: undefined,
      });
      expect(online.status).toBe(400);
      expect(online.body.message).toMatch(/motivo del descuento/i);
    } finally {
      await fixtureDb.cashSession.update({
        where: { id: session.id },
        data: { openedAt: originalCash.openedAt },
      });
      await ok("/settings", settings, token, "PUT");
    }
  });

  it("O1: audita después de sincronizar una venta y registra como cambio la rebaja en efectivo", async () => {
    const settings = await ok("/settings");
    const offlineUuid = randomUUID();
    const attempted = {
      offlineUuid,
      customerId: defaultCustomerId,
      cashSessionId: session.id,
      items: [{ variantId: variant.id, qty: 1, discountPercent: 0 }],
      globalDiscount: 0,
      expectedTotal: 150,
      payments: [{ method: "cash", amount: 200 }],
    };
    const resolution = {
      offlineUuid,
      action: "reprice",
      previousTotal: 150,
      currentTotal: 100,
      reason: "Catálogo vigente confirmado por la cajera",
    };
    try {
      await ok(
        "/settings",
        { ...settings, allowOfflineSales: true },
        token,
        "PUT",
      );
      const conflictResult = await ok("/sales/sync", {
        sales: [attempted],
      });
      expect(conflictResult.results[0].status).toBe("conflict");
      expect(
        (await request("/sales/offline-resolution", resolution)).status,
      ).toBe(404);
      expect(
        await fixtureDb.auditLog.count({
          where: { action: "offline_sale_repriced", entityId: offlineUuid },
        }),
      ).toBe(0);

      const corrected = {
        ...attempted,
        expectedTotal: 100,
      };
      const syncResult = await ok("/sales/sync", { sales: [corrected] });
      expect(syncResult.results).toHaveLength(1);
      expect(syncResult.results[0].status).toBe("synced");
      const saleId = syncResult.results[0].sale.id;
      const payment = await fixtureDb.payment.findFirstOrThrow({
        where: { saleId, method: "cash", entryType: "sale" },
      });
      expect(Number(payment.tendered)).toBe(200);
      expect(Number(payment.amount)).toBe(100);
      expect(Number(payment.change)).toBe(100);

      expect(await ok("/sales/offline-resolution", resolution, token)).toEqual({
        ok: true,
        saleId,
      });
      // Reintentar después de perder la respuesta no duplica la auditoría.
      expect(await ok("/sales/offline-resolution", resolution, token)).toEqual({
        ok: true,
        saleId,
      });
      const logs = await fixtureDb.auditLog.findMany({
        where: {
          action: "offline_sale_repriced",
          entity: "sale",
          entityId: saleId,
        },
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].userId).toBe(actors[0].id);
      expect(logs[0].terminalId).toBe(tokenTerminal.get(token));
      expect(logs[0].before).toEqual({ total: 150, offlineUuid });
      expect(logs[0].after).toMatchObject({
        total: 100,
        reason: resolution.reason,
        offlineUuid,
        cashTendered: 200,
        cashApplied: 100,
        cashChange: 100,
      });

      // B2: un UUID arbitrario que nunca fue conflicto propio no se descarta.
      const arbitrary = await request("/sales/offline-resolution", {
        offlineUuid: randomUUID(),
        action: "discard",
        previousTotal: 125,
        reason: "No corresponde a una venta pendiente real",
      });
      expect(arbitrary.status).toBe(404);
    } finally {
      await ok("/settings", settings, token, "PUT");
    }
  });
});

// Auditoría final de dinero (docs/AUDITORIA_FINAL_DINERO.md, rama
// claude/audit-money). D-01: la contraentrega es una cuenta por cobrar y pasa
// por la misma aprobación que el crédito. D-04: las salidas de efectivo de
// quien no gestiona ventas exigen el PIN de un gerente por encima del límite.
// Se usan los usuarios reales del seed (vendedor, gerente y administrador) y
// una cajera creada con el rol seller, como hace la tienda.
describe("Dinero · D-01 contraentrega y D-04 salidas de efectivo", () => {
  const ip =
    "198.19." + ((Date.now() % 200) + 1) + "." + ((Date.now() % 250) + 1);
  const demoPassword = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
  // PIN del gerente del seed (apps/api/prisma/seed.ts).
  const managerPin = "234567";
  async function call(
    path: string,
    data?: unknown,
    as = token,
    method = data === undefined ? "GET" : "POST",
  ) {
    data = prepareTestPayload(path, data);
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": ip,
        ...(as ? { Authorization: "Bearer " + as } : {}),
      },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return { status: r.status, body: await r.json() };
  }
  async function must(
    path: string,
    data?: unknown,
    as = token,
    method?: string,
  ) {
    let r = await call(path, data, as, method);
    r = await completeRequiredPasswordChange(path, data, r, (next, payload) =>
      call(next, payload, ""),
    );
    if (r.status >= 400)
      throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
    return r.body;
  }
  async function seedUser(email: string) {
    const auth = await must(
      "/auth/login",
      { email, password: demoPassword },
      "",
    );
    const terminalId = await enroll(
      auth.accessToken,
      "QA dinero " + email.split("@")[0],
    );
    let cash = await must(
      "/cash-sessions/open",
      { openingAmount: 3000 },
      auth.accessToken,
    );
    // Si la persona ya tenía una caja abierta en otro equipo, se trae a este.
    if (cash.registerId !== terminalId)
      cash = await must(
        "/cash-sessions/" + cash.id + "/transfer",
        { managerPin },
        auth.accessToken,
      );
    return { token: auth.accessToken as string, user: auth.user, cash };
  }
  let settingsBefore: any;
  let vendedor: any, gerente: any, admin: any, cajera: any;
  let variant: any, customer: any;
  const codSale = (
    who: any,
    qty: number,
    payments: any[],
    extra: Record<string, unknown> = {},
  ) => ({
    offlineUuid: randomUUID(),
    customerId: customer.id,
    cashSessionId: who.cash.id,
    items: [{ variantId: variant.id, qty }],
    payments,
    ...extra,
  });
  const setSettings = (changes: Record<string, unknown>) =>
    must("/settings", { ...settingsBefore, ...changes }, ownerToken, "PUT");
  beforeAll(async () => {
    settingsBefore = await must("/settings", undefined, ownerToken);
    vendedor = await seedUser("vendedor@fitstore.demo");
    gerente = await seedUser("gerente@fitstore.demo");
    admin = await seedUser("admin@fitstore.demo");
    const roles = await must("/roles", undefined, ownerToken);
    const email = `qa-dinero-cajera-${randomUUID().slice(0, 8)}@example.test`;
    const created = await must(
      "/users",
      {
        name: "QA Dinero cajera " + suffix,
        email,
        password: "FitStore-QA-2026!",
        pin: "135793",
        roleId: roles.find((r: any) => r.name === "seller").id,
      },
      ownerToken,
    );
    actors.push(created);
    const auth = await must(
      "/auth/login",
      { email, password: "FitStore-QA-2026!" },
      "",
    );
    await enroll(auth.accessToken, "QA dinero cajera");
    cajera = {
      token: auth.accessToken,
      user: created,
      cash: await must(
        "/cash-sessions/open",
        { openingAmount: 3000 },
        auth.accessToken,
      ),
    };
    const cats = await must("/categories", undefined, ownerToken);
    const p = await must(
      "/products",
      {
        name: "QA Dinero faja " + suffix,
        sku: "QA-DIN-" + randomUUID().slice(0, 8),
        categoryId: cats.find((c: any) => c.name === "Fajas").id,
        taxRate: 0,
        variants: [
          {
            sku: "QA-DINV-" + randomUUID().slice(0, 8),
            barcode: "QA-DINB-" + randomUUID().slice(0, 8),
            price: 800,
            costAvg: 300,
          },
        ],
      },
      ownerToken,
    );
    products.push(p);
    variant = p.variants[0];
    await must(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 200, reason: "QA dinero stock" },
      ownerToken,
    );
    // Cliente nuevo creado por la cajera: su límite de crédito queda en 0.
    customer = await must(
      "/customers",
      {
        name: "QA Cliente Fantasma " + suffix,
        phone: "809555" + String(Date.now() % 10000).padStart(4, "0"),
      },
      cajera.token,
    );
    expect(Number(customer.creditLimit ?? 0)).toBe(0);
  });
  afterAll(async () => {
    if (settingsBefore)
      await call(
        "/settings",
        { ...settingsBefore, logo: "" },
        ownerToken,
        "PUT",
      );
    for (const who of [vendedor, gerente, admin, cajera])
      if (who?.cash) {
        const expected = await expectedForCash(who.cash.id).catch(() => null);
        if (expected)
          await call(
            "/cash-sessions/" + who.cash.id + "/close",
            {
              countedCash: Math.max(0, expected.cash),
              countedCard: Math.max(0, expected.card),
              countedTransfer: Math.max(0, expected.transfer),
              notes: "Cierre de pruebas de dinero",
            },
            who.token,
          );
      }
  });

  it("D-01: la contraentrega de RD$ 12,000 de cajera o vendedor exige el PIN de un gerente", async () => {
    await setSettings({
      allowCreditSales: true,
      creditApprovalThreshold: 1000,
      allowOfflineSales: true,
    });
    for (const who of [cajera, vendedor]) {
      const denied = await call(
        "/sales",
        codSale(who, 15, [{ method: "cod", amount: 12000 }]),
        who.token,
      );
      expect(denied.status).toBe(400);
      expect(denied.body.message).toBe(
        "Esta operación requiere el PIN de un gerente.",
      );
    }
    // PIN incorrecto: rechazado y sin venta.
    const wrongPin = codSale(cajera, 15, [{ method: "cod", amount: 12000 }], {
      managerPin: "000000",
    });
    expect((await call("/sales", wrongPin, cajera.token)).status).toBe(400);
    expect(
      await fixtureDb.sale.count({
        where: { offlineUuid: wrongPin.offlineUuid },
      }),
    ).toBe(0);
    // Con el PIN del gerente pasa y queda auditado quién aprobó.
    const approved = codSale(cajera, 15, [{ method: "cod", amount: 12000 }], {
      managerPin,
    });
    const sold = await must("/sales", approved, cajera.token);
    expect(Number(sold.total)).toBe(12000);
    expect(Number(sold.creditBalance)).toBe(12000);
    const log = await fixtureDb.auditLog.findFirst({
      where: { action: "credit_approved", entityId: sold.id },
    });
    expect(log?.after).toMatchObject({
      approvedBy: gerente.user.id,
      cod: 12000,
    });
    // El UUID sigue siendo idempotente: reintentar sin el PIN (la caja nunca
    // lo guarda) devuelve la misma venta, en línea y por sincronización.
    const { managerPin: _pin, ...retry } = approved;
    const again = await must("/sales", retry, cajera.token);
    expect(again.id).toBe(sold.id);
    const synced = await must("/sales/sync", { sales: [retry] }, cajera.token);
    expect(synced.results[0]).toMatchObject({ status: "synced" });
    expect(synced.results[0].sale.id).toBe(sold.id);
    expect(
      await fixtureDb.sale.count({
        where: { offlineUuid: approved.offlineUuid },
      }),
    ).toBe(1);
    // Una contraentrega nueva sin PIN que llega por sincronización queda en
    // conflicto (con su alerta), no se registra.
    const offline = codSale(cajera, 15, [{ method: "cod", amount: 12000 }], {
      capturedAt: new Date().toISOString(),
    });
    const conflict = await must(
      "/sales/sync",
      { sales: [offline] },
      cajera.token,
    );
    expect(conflict.results[0]).toMatchObject({
      status: "conflict",
      message: "Esta operación requiere el PIN de un gerente.",
    });
    expect(
      await fixtureDb.sale.count({
        where: { offlineUuid: offline.offlineUuid },
      }),
    ).toBe(0);
  });

  it("D-01: bajo el umbral pasa sin PIN; quien gestiona ventas no necesita PIN", async () => {
    await setSettings({
      allowCreditSales: true,
      creditApprovalThreshold: 1000,
    });
    const small = await call(
      "/sales",
      codSale(cajera, 1, [{ method: "cod", amount: 800 }]),
      cajera.token,
    );
    expect(small.status).toBe(201);
    // Justo en el umbral (no lo supera) también pasa.
    await setSettings({ allowCreditSales: true, creditApprovalThreshold: 800 });
    expect(
      (
        await call(
          "/sales",
          codSale(vendedor, 1, [{ method: "cod", amount: 800 }]),
          vendedor.token,
        )
      ).status,
    ).toBe(201);
    // Administrador y gerente (sale:manage) despachan sin PIN, aunque las
    // ventas a crédito estén desactivadas.
    await setSettings({
      allowCreditSales: false,
      creditApprovalThreshold: 1000,
    });
    for (const who of [admin, gerente])
      expect(
        (
          await call(
            "/sales",
            codSale(who, 15, [{ method: "cod", amount: 12000 }]),
            who.token,
          )
        ).status,
      ).toBe(201);
  });

  it("D-01: con las ventas a crédito desactivadas, toda contraentrega de la cajera exige PIN", async () => {
    await setSettings({
      allowCreditSales: false,
      creditApprovalThreshold: 1000,
    });
    const denied = await call(
      "/sales",
      codSale(cajera, 1, [{ method: "cod", amount: 800 }]),
      cajera.token,
    );
    expect(denied.status).toBe(400);
    expect(denied.body.message).toBe(
      "Esta operación requiere el PIN de un gerente.",
    );
    expect(
      (
        await call(
          "/sales",
          codSale(cajera, 1, [{ method: "cod", amount: 800 }], { managerPin }),
          cajera.token,
        )
      ).status,
    ).toBe(201);
  });

  it("D-01: el crédito sigue igual y el límite del cliente cuenta la contraentrega pendiente", async () => {
    const due = { creditDueDate: "2030-01-01T12:00:00.000Z" };
    // Desactivado: rechazado para todos, también con PIN.
    await setSettings({
      allowCreditSales: false,
      creditApprovalThreshold: 1000,
    });
    const off = await call(
      "/sales",
      codSale(admin, 1, [{ method: "credit", amount: 800 }], {
        ...due,
        managerPin,
      }),
      admin.token,
    );
    expect(off.status).toBe(400);
    expect(off.body.message).toBe(
      "Las ventas a crédito están desactivadas en Ajustes.",
    );
    await setSettings({
      allowCreditSales: true,
      creditApprovalThreshold: 1000,
    });
    // Bajo el umbral, sin PIN; sobre el umbral exige PIN incluso al administrador.
    expect(
      (
        await call(
          "/sales",
          codSale(cajera, 1, [{ method: "credit", amount: 800 }], due),
          cajera.token,
        )
      ).status,
    ).toBe(201);
    for (const who of [cajera, admin])
      expect(
        (
          await call(
            "/sales",
            codSale(who, 2, [{ method: "credit", amount: 1600 }], due),
            who.token,
          )
        ).status,
      ).toBe(400);
    expect(
      (
        await call(
          "/sales",
          codSale(admin, 2, [{ method: "credit", amount: 1600 }], {
            ...due,
            managerPin,
          }),
          admin.token,
        )
      ).status,
    ).toBe(201);
    // Límite 1,600: la deuda pendiente (crédito o contraentrega) más la venta
    // nueva no puede superarlo, también con PIN.
    const limited = await must(
      "/customers",
      { name: "QA Dinero límite " + suffix, creditLimit: 1600 },
      ownerToken,
    );
    const forLimited = (payments: any[], qty: number, extra = {}) => ({
      ...codSale(cajera, qty, payments, extra),
      customerId: limited.id,
    });
    expect(
      (
        await call(
          "/sales",
          forLimited([{ method: "cod", amount: 800 }], 1),
          cajera.token,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await call(
          "/sales",
          forLimited([{ method: "credit", amount: 800 }], 1, due),
          cajera.token,
        )
      ).status,
    ).toBe(201);
    const over = await call(
      "/sales",
      forLimited([{ method: "cod", amount: 800 }], 1, { managerPin }),
      cajera.token,
    );
    expect(over.status).toBe(400);
    expect(over.body.message).toBe(
      "La venta supera el límite de crédito del cliente.",
    );
  });

  it("D-04: las salidas de la cajera sobre el límite exigen el PIN de un gerente y los importes se validan", async () => {
    await setSettings({});
    const move = (who: any, data: Record<string, unknown>) =>
      call("/cash-sessions/" + who.cash.id + "/movements", data, who.token);
    const before = await fixtureDb.cashMovement.count({
      where: { sessionId: cajera.cash.id },
    });
    // Importes inválidos: 400, nunca 500 ni un movimiento de 0.00.
    for (const amount of [0.004, 1e15, 10.123, 0, -5])
      expect(
        (await move(cajera, { type: "out", amount, reason: "QA importe" }))
          .status,
        String(amount),
      ).toBe(400);
    expect(
      (await move(cajera, { type: "in", amount: 1e15, reason: "QA importe" }))
        .status,
    ).toBe(400);
    // El caso de la auditoría: todo el fondo sin PIN.
    for (const who of [cajera, vendedor]) {
      const drained = await move(who, {
        type: "out",
        amount: 2999.99,
        reason: "pago mensajero",
      });
      expect(drained.status).toBe(400);
      expect(drained.body.message).toBe(
        "Las salidas de efectivo de este turno superan RD$ 1,000.00: se requiere el PIN de un gerente.",
      );
    }
    // Bajo el límite pasa sin PIN.
    expect(
      (await move(cajera, { type: "out", amount: 600, reason: "QA vale" }))
        .status,
    ).toBe(201);
    // El límite cuenta todas las salidas del turno: partir el retiro en
    // varios vales no lo evita.
    const split = await move(cajera, {
      type: "out",
      amount: 600,
      reason: "QA vale partido",
    });
    expect(split.status).toBe(400);
    expect(
      (
        await move(cajera, {
          type: "out",
          amount: 600,
          reason: "QA vale partido",
          managerPin: "000000",
        })
      ).body.message,
    ).toBe("PIN incorrecto.");
    const approved = await move(cajera, {
      type: "out",
      amount: 600,
      reason: "QA vale aprobado",
      managerPin,
    });
    expect(approved.status).toBe(201);
    expect(approved.body.managerPin).toBeUndefined();
    const log = await fixtureDb.auditLog.findFirst({
      where: { action: "movement", entityId: cajera.cash.id },
      orderBy: { createdAt: "desc" },
    });
    expect(log?.after).toMatchObject({ approvedBy: gerente.user.id });
    // Las entradas no necesitan PIN.
    expect(
      (await move(cajera, { type: "in", amount: 5000, reason: "QA cambio" }))
        .status,
    ).toBe(201);
    // Sin efectivo suficiente: el mensaje no revela cifras a la cajera, que
    // trabaja con arqueo ciego (ni el esperado ni lo que falta).
    const short = await move(cajera, {
      type: "out",
      amount: 50000,
      reason: "QA retiro grande",
      managerPin,
    });
    expect(short.status).toBe(400);
    expect(short.body.message).toBe("No hay suficiente efectivo en caja.");
    expect(short.body.message).not.toMatch(/\d/);
    expect(
      await fixtureDb.cashMovement.count({
        where: { sessionId: cajera.cash.id },
      }),
    ).toBe(before + 3);
  });

  it("D-04: quien gestiona ventas no necesita PIN y el límite se ajusta en Ajustes", async () => {
    await setSettings({});
    const move = (who: any, data: Record<string, unknown>) =>
      call("/cash-sessions/" + who.cash.id + "/movements", data, who.token);
    for (const who of [admin, gerente])
      expect(
        (
          await move(who, {
            type: "out",
            amount: 1500,
            reason: "QA retiro de gerencia",
          })
        ).status,
      ).toBe(201);
    // El ajuste existe con 1,000 por defecto y se puede cambiar.
    expect(
      (await must("/settings", undefined, ownerToken))
        .cashMovementApprovalLimit ?? 1000,
    ).toBe(1000);
    const saved = await setSettings({ cashMovementApprovalLimit: 2500 });
    expect(saved.cashMovementApprovalLimit).toBe(2500);
    expect(
      (
        await call(
          "/settings",
          { ...settingsBefore, cashMovementApprovalLimit: 0.001 },
          ownerToken,
          "PUT",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await move(vendedor, {
          type: "out",
          amount: 2000,
          reason: "QA vale con límite mayor",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await move(vendedor, {
          type: "out",
          amount: 600,
          reason: "QA vale sobre el límite",
        })
      ).status,
    ).toBe(400);
  });
});

describe("SEC-01 · bomba XLSX en los importadores", () => {
  // RSS real del proceso de la API cuando la prueba conoce su PID (Linux).
  const apiRss = () => {
    const pid = process.env.FITSTORE_API_PID;
    if (!pid) return undefined;
    const m = /VmRSS:\s+(\d+) kB/.exec(
      readFileSync(`/proc/${pid}/status`, "utf8"),
    );
    return m ? Number(m[1]) * 1024 : undefined;
  };
  it("una bomba de ~300 KB (>100 MB descomprimida) da 400 rápido en facturas y catálogo sin subir la memoria de la API", async () => {
    const { file, uncompressed } = await xlsxBomb();
    expect(file.length).toBeLessThan(1024 * 1024);
    expect(uncompressed).toBeGreaterThan(100 * 1024 * 1024);
    const before = apiRss();
    for (const path of ["/merchandise/import", "/products/import"]) {
      const form = new FormData();
      form.set("file", new Blob([file]), "factura.xlsx");
      form.set(
        "mapping",
        JSON.stringify({
          code: "codigo",
          description: "descripcion",
          qty: "cantidad",
          unitCost: "costo",
        }),
      );
      const started = Date.now();
      const r = await fetch(base + path, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "X-Forwarded-For": testIp,
        },
        body: form,
      });
      const body = await r.json();
      const ms = Date.now() - started;
      console.info(`[SEC-01] ${path}: ${r.status} en ${ms} ms`);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(body.message).toMatch(/demasiado grande al descomprimirse/);
      expect(ms).toBeLessThan(3000);
    }
    const after = apiRss();
    if (before !== undefined && after !== undefined) {
      console.info(
        `[SEC-01] RSS de la API: ${Math.round(before / 1048576)} MB → ${Math.round(after / 1048576)} MB`,
      );
      expect(after - before).toBeLessThan(64 * 1024 * 1024);
    }
  }, 60000);
});

describe("SEC-03 · cambio de usuario con PIN sin escalar privilegios", () => {
  let vendedora: any,
    cajera: any,
    vendedoraToken = "";
  let admin: any, manager: any, seedAdmin: any;
  const pin = (userId: string, value: string, as: string) =>
    request("/auth/pin", { userId, pin: value }, as);
  beforeAll(async () => {
    const roles = await ok("/roles");
    const make = async (label: string, role: string, userPin: string) => {
      const user = await ok("/users", {
        name: "QA SEC-03 " + label + " " + suffix,
        email: `sec03-${label}-${randomUUID().slice(0, 8)}@example.test`,
        password: "FitStore-QA-2026!",
        pin: userPin,
        roleId: roles.find((r: any) => r.name === role).id,
      });
      actors.push(user);
      const auth = await ok(
        "/auth/login",
        { email: user.email, password: "FitStore-QA-2026!" },
        "",
      );
      return { user, token: auth.accessToken as string };
    };
    // La vendedora usa el mismo PIN que el admin de pruebas (876543).
    ({ user: vendedora, token: vendedoraToken } = await make(
      "vendedora",
      "seller",
      "876543",
    ));
    ({ user: cajera } = await make("cajera", "seller", "135792"));
    admin = actors.find((u) => u.email.startsWith("qa-admin-"));
    manager = actors.find((u) => u.email.startsWith("qa-manager-"));
    seedAdmin = await fixtureDb.user.findFirstOrThrow({
      where: { email: "admin@fitstore.demo" },
    });
  });

  it("/staff no lista gerencia ni administración a la vendedora; la administración sí los ve", async () => {
    const staff = await ok("/staff", undefined, vendedoraToken);
    const ids = staff.map((u: any) => u.id);
    expect(ids).not.toContain(seedAdmin.id);
    expect(ids).not.toContain(admin.id);
    expect(ids).not.toContain(manager.id);
    expect(staff.map((u: any) => u.role.name)).not.toContain("admin");
    expect(staff.map((u: any) => u.role.name)).not.toContain("manager");
    expect(ids).toContain(cajera.id);
    expect(ids).toContain(vendedora.id);
    const all = (await ok("/staff", undefined, ownerToken)).map(
      (u: any) => u.id,
    );
    expect(all).toEqual(
      expect.arrayContaining([seedAdmin.id, admin.id, manager.id, cajera.id]),
    );
  });

  it("vendedora → admin con el PIN correcto: rechazado, sin sesión nueva y queda en la auditoría", async () => {
    const since = new Date(Date.now() - 1000);
    for (const [target, value] of [
      [admin, "876543"], // PIN correcto del admin de pruebas
      [seedAdmin, "123456"], // PIN de la semilla (reproducción de la auditoría)
      [manager, "987654"], // gerente: también tiene más permisos
      [admin, "000000"], // PIN incorrecto: misma respuesta, sin oráculo
    ] as const) {
      const r = await pin(target.id, value, vendedoraToken);
      expect(r.status, JSON.stringify(r.body)).toBe(403);
      expect(r.body.message).toMatch(/más permisos/);
      expect(r.body.accessToken).toBeUndefined();
    }
    // La vendedora sigue siendo ella misma.
    const me = await ok("/auth/me", undefined, vendedoraToken);
    expect(me.id).toBe(vendedora.id);
    expect(me.role).toBe("seller");
    const logs = await fixtureDb.auditLog.findMany({
      where: {
        userId: vendedora.id,
        action: "pin_switch_denied",
        createdAt: { gte: since },
      },
    });
    expect(logs.map((l: any) => l.entityId)).toEqual(
      expect.arrayContaining([admin.id, seedAdmin.id, manager.id]),
    );
    expect(logs[0].entity).toBe("user");
  });

  it("vendedora → cajera (mismo rol) sigue funcionando para el cambio de turno", async () => {
    const r = await pin(cajera.id, "135792", vendedoraToken);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.user.id).toBe(cajera.id);
    const me = await ok("/auth/me", undefined, r.body.accessToken);
    expect(me.id).toBe(cajera.id);
  });

  it("admin → vendedora (bajar privilegios) funciona", async () => {
    const r = await pin(vendedora.id, "876543", token);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.user.id).toBe(vendedora.id);
    expect(r.body.user.permissions).not.toContain("*");
  });
});

// Auditoría final de dinero (docs/AUDITORIA_FINAL_DINERO.md en
// claude/audit-money): D-03 fondo de apertura, D-02 anulación con la caja
// cerrada y D-05 una sola definición de venta neta en los informes.
describe("Auditoría final de dinero · D-02, D-03 y D-05", () => {
  const roleId = async (name: string) =>
    (await ok("/roles", undefined, ownerToken)).find(
      (r: any) => r.name === name,
    ).id;
  // Usuario nuevo con su equipo aprobado.
  const newActor = async (role: string, label: string) => {
    const tag = randomUUID().slice(0, 8);
    const user = await ok(
      "/users",
      {
        name: "QA " + label + " " + tag,
        email: `qa-dinero-${tag}@example.test`,
        password: "FitStore-QA-2026!",
        pin: "246813",
        roleId: await roleId(role),
      },
      ownerToken,
    );
    actors.push(user);
    const auth = await ok(
      "/auth/login",
      { email: user.email, password: "FitStore-QA-2026!" },
      "",
    );
    await enroll(auth.accessToken, "QA " + label);
    return { user, token: auth.accessToken as string };
  };
  const closeBlind = (id: string, as: string, extra: any = {}) =>
    ok(
      "/cash-sessions/" + id + "/close",
      { countedCash: 0, countedCard: 0, countedTransfer: 0, ...extra },
      as,
    );
  const product = async (label: string, category: string, price: number) => {
    const cats = await ok("/categories", undefined, ownerToken);
    const tag = randomUUID().slice(0, 8);
    const p = await ok(
      "/products",
      {
        name: "QA dinero " + label + " " + tag,
        sku: "QA-DIN-" + tag,
        categoryId: cats.find((c: any) => c.name === category).id,
        variants: [
          {
            sku: "QA-DINV-" + tag,
            barcode: "QA-DINB-" + tag,
            costAvg: Math.round(price * 0.4),
            price,
          },
        ],
      },
      ownerToken,
    );
    products.push(p);
    await ok(
      "/inventory/adjustments",
      {
        variantId: p.variants[0].id,
        qty: 20,
        reason: "QA dinero existencias",
        // Los suplementos exigen lote y vencimiento.
        ...(category === "Suplementos"
          ? {
              lotNumber: "QA-DIN-" + tag,
              expiryDate: new Date(Date.now() + 200 * 86400000).toISOString(),
            }
          : {}),
      },
      ownerToken,
    );
    return p.variants[0];
  };

  it("D-03: un fondo menor que lo dejado en el último cierre exige nota y PIN de gerente, y queda en la bitácora", async () => {
    const cashier = await newActor("seller", "cajera D-03");
    const manager = (await ok("/auth/me", undefined, managerToken)) as any;
    // Día 1: abre con 1000 y deja todo el efectivo en la gaveta.
    const day1 = await ok(
      "/cash-sessions/open",
      { openingAmount: 1000 },
      cashier.token,
    );
    await closeBlind(day1.id, cashier.token, {
      countedCash: 1000,
      delivered: 0,
    });
    expect(
      await ok("/cash-sessions/opening-suggestion", undefined, cashier.token),
    ).toMatchObject({ amount: 1000, fromSessionId: day1.id });
    // Igual a lo sugerido: abre como siempre, sin nota ni PIN.
    const day2 = await ok(
      "/cash-sessions/open",
      { openingAmount: 1000 },
      cashier.token,
    );
    expect(Number(day2.openingAmount)).toBe(1000);
    await closeBlind(day2.id, cashier.token, {
      countedCash: 1000,
      delivered: 0,
    });
    // Menor: sin nota, sin PIN o con un PIN incorrecto no abre.
    const short = (extra: any = {}) =>
      request(
        "/cash-sessions/open",
        { openingAmount: 0, ...extra },
        cashier.token,
      );
    const noNote = await short();
    expect(noNote.status).toBe(400);
    expect(noNote.body.message).toMatch(/nota/);
    const noPin = await short({ openingNote: "Se llevó el fondo al banco" });
    expect(noPin.status).toBe(400);
    expect(noPin.body.message).toMatch(/PIN de un gerente/);
    expect(
      (
        await short({
          openingNote: "Se llevó el fondo al banco",
          managerPin: "000000",
        })
      ).status,
    ).toBe(400);
    expect(
      (await ok("/cash-sessions", undefined, cashier.token)).some(
        (c: any) => !c.closedAt,
      ),
    ).toBe(false);
    // Con nota y PIN de gerente abre, y la diferencia queda en la bitácora.
    const day3 = await ok(
      "/cash-sessions/open",
      {
        openingAmount: 0,
        openingNote: "Se llevó el fondo al banco",
        managerPin: "987654",
      },
      cashier.token,
    );
    expect(Number(day3.openingAmount)).toBe(0);
    const audits = await ok("/audit-log", undefined, ownerToken);
    const logged = audits.filter(
      (a: any) =>
        a.action === "opening_difference" &&
        [day2.id, day3.id].includes(a.entityId),
    );
    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatchObject({
      entityId: day3.id,
      userId: cashier.user.id,
      before: { suggested: 1000, fromSessionId: day2.id },
      after: {
        declared: 0,
        difference: -1000,
        note: "Se llevó el fondo al banco",
        approvedBy: manager.id,
      },
    });
    await closeBlind(day3.id, cashier.token);
  });

  it("D-02: anular una venta en efectivo de una caja cerrada no cambia su cuadre y el reembolso sale de la caja abierta de quien anula", async () => {
    const variant = await product("anulación", "Ropa deportiva", 118);
    const cashier = await newActor("seller", "cajera D-02");
    const admin = await newActor("admin", "admin D-02");
    // Caja A: vende 118 en efectivo y cierra cuadrada.
    const a = await ok(
      "/cash-sessions/open",
      { openingAmount: 200 },
      cashier.token,
    );
    const sold = await ok("/sales", input(variant.id, 118, a), cashier.token);
    await closeBlind(a.id, cashier.token, { countedCash: 318 });
    const closedA = await fixtureDb.cashSession.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(Number(closedA.expectedCash)).toBe(318);
    expect(Number(closedA.differenceCash)).toBe(0);
    // Sin caja abierta, quien anula no tiene de dónde entregar el efectivo.
    const noCash = await request(
      "/sales/" + sold.id + "/void",
      { reason: "QA cliente devolvió al día siguiente" },
      admin.token,
    );
    expect(noCash.status).toBe(400);
    expect(noCash.body.message).toMatch(/Abre tu caja/);
    expect(
      (await fixtureDb.sale.findUniqueOrThrow({ where: { id: sold.id } }))
        .status,
    ).toBe("completed");
    // Caja B, otro turno: el reembolso sale de aquí.
    const b = await ok(
      "/cash-sessions/open",
      { openingAmount: 500 },
      admin.token,
    );
    await ok(
      "/sales/" + sold.id + "/void",
      { reason: "QA cliente devolvió al día siguiente" },
      admin.token,
    );
    // A: el cierre aprobado no cambia; ningún sobrante después del cierre.
    const afterA = await fixtureDb.cashSession.findUniqueOrThrow({
      where: { id: a.id },
    });
    expect(Number(afterA.expectedCash)).toBe(318);
    expect(Number(afterA.differenceCash)).toBe(0);
    expect((await expectedForCash(a.id)).cash).toBe(318);
    const cuadreA = await ok(
      "/cash-sessions/" + a.id + "/cuadre",
      undefined,
      ownerToken,
    );
    expect(
      cuadreA.lines.find((l: any) => l.key === "differenceDop").value,
    ).toBe(0);
    // B: el esperado baja exactamente lo reembolsado y cierra cuadrada.
    expect((await expectedForCash(b.id)).cash).toBe(382);
    // Los dos movimientos nombran la venta original.
    const movements = await fixtureDb.cashMovement.findMany({
      where: { sessionId: { in: [a.id, b.id] } },
    });
    expect(
      movements.map((m: any) => [m.sessionId, m.type, Number(m.amount)]).sort(),
    ).toEqual(
      [
        [a.id, "in", 118],
        [b.id, "out", 118],
      ].sort(),
    );
    for (const m of movements) expect(m.reason).toContain(sold.number);
    const closedB = await ok(
      "/cash-sessions/" + b.id + "/close",
      { countedCash: 382, countedCard: 0, countedTransfer: 0 },
      admin.token,
    );
    expect(closedB.differences).toMatchObject({
      cash: 0,
      card: 0,
      transfer: 0,
    });
    const audits = await ok("/audit-log", undefined, ownerToken);
    expect(
      audits.find(
        (l: any) => l.action === "void_after_close" && l.entityId === a.id,
      ).after,
    ).toMatchObject({
      saleId: sold.id,
      cash: 0,
      refundCashSessionId: b.id,
      refundAmount: 118,
    });
  });

  it("D-05: dashboard, informes por vendedor y por forma de pago usan la misma venta neta con devoluciones parciales", async () => {
    const day = "2023-03-15";
    const at = new Date(day + "T15:00:00.000Z");
    const ropa = await product("neto ropa", "Ropa deportiva", 100);
    const supl = await product("neto suplemento", "Suplementos", 300);
    // Actores y cajas propios: las cajas globales pueden haberse cerrado.
    const admin = await newActor("admin", "admin D-05");
    const seller = await newActor("seller", "vendedor D-05");
    const adminCash = await ok(
      "/cash-sessions/open",
      { openingAmount: 500 },
      admin.token,
    );
    const sellerCash = await ok(
      "/cash-sessions/open",
      { openingAmount: 0 },
      seller.token,
    );
    const sell = (as: string, s: any, items: any[], payments: any[]) =>
      ok(
        "/sales",
        {
          offlineUuid: randomUUID(),
          customerId: defaultCustomerId,
          cashSessionId: s.id,
          items,
          payments,
          expectedTotal: payments.reduce((t, p) => t + p.amount, 0),
        },
        as,
      );
    // 900 vendidos: 200 + 300 + 400.
    const s1 = await sell(
      admin.token,
      adminCash,
      [{ variantId: ropa.id, qty: 2 }],
      [{ method: "cash", amount: 200 }],
    );
    const s2 = await sell(
      seller.token,
      sellerCash,
      [{ variantId: supl.id, qty: 1 }],
      [
        {
          method: "card",
          amount: 300,
          cardLast4: "4242",
          approvalCode: "QA-D05",
        },
      ],
    );
    const s3 = await sell(
      admin.token,
      adminCash,
      [
        { variantId: ropa.id, qty: 1 },
        { variantId: supl.id, qty: 1 },
      ],
      [{ method: "transfer", amount: 400, bank: "BHD", reference: "QA-D05" }],
    );
    // 400 devueltos, ambas devoluciones parciales: 1 de 2 unidades de s1 en
    // efectivo y la línea de suplemento de s3 por transferencia.
    const giveBack = (
      sale: any,
      line: any,
      qty: number,
      refundMethod: string,
    ) =>
      ok(
        "/returns",
        {
          operationId: randomUUID(),
          saleId: sale.id,
          cashSessionId: adminCash.id,
          reason: "QA D-05 devolución parcial",
          refundMethod,
          items: [{ saleItemId: line.id, qty, restock: true }],
        },
        admin.token,
      );
    const r1 = await giveBack(s1, s1.items[0], 1, "cash");
    const r2 = await giveBack(
      s3,
      s3.items.find((i: any) => i.variantId === supl.id),
      1,
      "transfer",
    );
    expect(Number(r1.total) + Number(r2.total)).toBe(400);
    await fixtureDb.sale.updateMany({
      where: { id: { in: [s1.id, s2.id, s3.id] } },
      data: { createdAt: at },
    });
    await fixtureDb.saleReturn.updateMany({
      where: { id: { in: [r1.id, r2.id] } },
      data: { createdAt: at },
    });
    const range = `?from=${day}&to=${day}`;
    const total = (rows: any[], field: string) =>
      Math.round(rows.reduce((t, r) => t + Number(r[field]), 0) * 100) / 100;
    const summary = await ok(
      "/dashboard/summary" + range,
      undefined,
      ownerToken,
    );
    expect(summary.revenue).toBe(500);
    expect(summary.daily).toEqual([{ day, total: 500 }]);
    expect(total(summary.sellers, "total")).toBe(500);
    expect(
      Object.fromEntries(summary.sellers.map((s: any) => [s.name, s.total])),
    ).toEqual({ [admin.user.name]: 200, [seller.user.name]: 300 });
    expect(total(summary.category, "total")).toBe(500);
    expect(
      Object.fromEntries(summary.category.map((c: any) => [c.name, c.total])),
    ).toEqual({ "Ropa deportiva": 200, Suplementos: 300 });
    expect(total(summary.payments, "amount")).toBe(500);
    expect(
      Object.fromEntries(summary.payments.map((p: any) => [p.name, p.amount])),
    ).toEqual({ cash: 100, card: 300, transfer: 100 });
    const bySeller = await ok(
      "/reports/by-seller" + range,
      undefined,
      ownerToken,
    );
    expect(total(bySeller.rows, "Ventas")).toBe(500);
    expect(
      Object.fromEntries(bySeller.rows.map((r: any) => [r.Vendedor, r.Ventas])),
    ).toEqual({ [admin.user.name]: 200, [seller.user.name]: 300 });
    const byPayment = await ok(
      "/reports/by-payment" + range,
      undefined,
      ownerToken,
    );
    expect(total(byPayment.rows, "Ventas")).toBe(500);
    expect(
      Object.fromEntries(byPayment.rows.map((r: any) => [r.Método, r.Ventas])),
    ).toEqual({ cash: 100, card: 300, transfer: 100 });
    const sales = await ok("/reports/sales" + range, undefined, ownerToken);
    expect(total(sales.rows, "Total") - total(sales.rows, "Devoluciones")).toBe(
      500,
    );
    // Las cajas cuadran: 500 + 200 − 100 en efectivo y 400 − 300 en
    // transferencia; la tarjeta del vendedor, 300.
    await closeBlind(adminCash.id, admin.token, {
      countedCash: 600,
      countedTransfer: 100,
    });
    await closeBlind(sellerCash.id, seller.token, { countedCard: 300 });
  });
});

describe("Revisión F2 · costos por rol contra la API real", () => {
  it("gerente y admin ven costos; vendedora y almacén no; el almacén no borra el ITBIS oculto", async () => {
    const roles = await ok("/roles");
    const warehouse = await ok("/users", {
      name: "QA almacén F2",
      email: "f2-warehouse-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "834529",
      roleId: roles.find((r: any) => r.name === "warehouse").id,
    });
    actors.push(warehouse);
    const warehouseToken = (
      await ok(
        "/auth/login",
        { email: warehouse.email, password: "FitStore-QA-2026!" },
        "",
      )
    ).accessToken;
    const variantId = clothing.variants[0].id;
    const order = await ok("/purchase-orders", {
      supplierId,
      itbis: 54,
      items: [{ variantId, qty: 3, unitCost: 100 }],
    });
    const received = await ok("/purchase-orders/" + order.id + "/receive", {
      operationId: randomUUID(),
      itbis: 54,
      items: [
        {
          itemId: order.items[0].id,
          qty: 2,
          damagedQty: 1,
          damageReason: "Caja rota QA F2",
        },
      ],
    });
    const orderOf = async (as: string) =>
      (await ok("/purchase-orders", undefined, as)).find(
        (o: any) => o.id === order.id,
      );
    const receiptOf = (as: string) =>
      ok("/goods-receipts/" + received.id, undefined, as);
    const variantOf = async (as: string) =>
      (await ok("/products/" + clothing.id, undefined, as)).variants.find(
        (v: any) => v.id === variantId,
      );

    for (const as of [token, managerToken]) {
      expect(Number((await variantOf(as)).costAvg)).toBeGreaterThan(0);
      expect(Number((await orderOf(as)).total)).toBe(300);
      const receipt = await receiptOf(as);
      expect(receipt.total).toBe(200);
      expect(receipt.itbis).toBe(54);
      expect(receipt.lines[0].unitCost).toBe(100);
      expect(receipt.damagedUnits).toBe(1);
      const kardex = await ok("/reports/kardex", undefined, as);
      expect(kardex.rows.some((r: any) => "Costo" in r)).toBe(true);
    }

    // Vendedora: catálogo sin costos y sin historial de recepciones.
    expect((await variantOf(sellerToken)).costAvg).toBeUndefined();
    expect(
      (await request("/goods-receipts/" + received.id, undefined, sellerToken))
        .status,
    ).toBe(403);

    // Almacén: cantidades sí, importes de compra no.
    expect((await variantOf(warehouseToken)).costAvg).toBeUndefined();
    const hiddenOrder = await orderOf(warehouseToken);
    expect(hiddenOrder.total).toBeUndefined();
    expect(hiddenOrder.itbis).toBeUndefined();
    const hidden = await receiptOf(warehouseToken);
    expect(hidden).toMatchObject({ units: 2, damagedUnits: 1 });
    expect(hidden.lines[0]).toMatchObject({ qty: 2, damagedQty: 1 });
    for (const key of ["total", "goods", "freight", "itbis", "invoiceTotal"])
      expect(hidden[key]).toBeUndefined();
    expect(hidden.lines[0].unitCost).toBeUndefined();

    // «Completar documento» reenvía el ITBIS que no vio como vacío (null).
    await ok(
      "/goods-receipts/" + received.id + "/document",
      { supplierInvoice: "F2-" + suffix, itbis: null },
      warehouseToken,
      "PATCH",
    );
    expect(await receiptOf(token)).toMatchObject({
      supplierInvoice: "F2-" + suffix,
      itbis: 54,
    });
    await ok(
      "/purchase-orders/" + order.id + "/document",
      { supplierInvoice: "F2-OC-" + suffix, itbis: null },
      warehouseToken,
      "PATCH",
    );
    expect(Number((await orderOf(token)).itbis)).toBe(54);
    // Quien sí ve el ITBIS puede seguir borrándolo.
    await ok(
      "/goods-receipts/" + received.id + "/document",
      { itbis: null },
      token,
      "PATCH",
    );
    expect((await receiptOf(token)).itbis).toBeNull();

    // Aunque la administración dé profit:read al rol vendedora, la caja no
    // recibe costos (misma regla que seesCost y los informes de utilidad).
    const sellerRole = roles.find((r: any) => r.name === "seller");
    try {
      await ok(
        "/roles/" + sellerRole.id,
        { permissions: [...sellerRole.permissions, "profit:read"] },
        ownerToken,
        "PUT",
      );
      expect((await variantOf(sellerToken)).costAvg).toBeUndefined();
    } finally {
      await ok(
        "/roles/" + sellerRole.id,
        { permissions: sellerRole.permissions },
        ownerToken,
        "PUT",
      );
    }
  });
});

describe("Revisión E1 · cupo de identidades inventadas", () => {
  it("el intento 21 con usuarios inventados desde una IP recibe 429 y una cajera real sigue entrando", async () => {
    const ip = "198.51.100." + ((Date.now() % 200) + 30);
    const login = async (loginName: string, password: string) => {
      const r = await fetch(base + "/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
        body: JSON.stringify({ login: loginName, password }),
      });
      return { status: r.status, body: await r.json() };
    };
    // Cajera creada con la API ya en marcha: cuenta como identidad conocida.
    const roles = await ok("/roles");
    const cashier = await ok("/users", {
      name: "QA cajera E1 " + suffix,
      email: "e1-cajera-" + suffix + "@example.test",
      password: "FitStore-QA-2026!",
      pin: "741963",
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    actors.push(cashier);
    await ok(
      "/auth/login",
      { email: cashier.email, password: "FitStore-QA-2026!" },
      "",
    );
    const password = qaPasswords.get(
      loginKey({ email: cashier.email }),
    )!.active;

    const statuses: number[] = [];
    for (let n = 0; n < 21; n++)
      statuses.push(
        (await login("inventado-e1-" + suffix + "-" + n, "Incorrecta-2026!"))
          .status,
      );
    expect(statuses.slice(0, 20).every((s) => s === 400)).toBe(true);
    expect(statuses[20]).toBe(429);
    // Misma IP: lo inventado y una clave mala de la cajera dan el mismo 429.
    expect((await login("otro-inventado-" + suffix, "x")).status).toBe(429);
    expect((await login(cashier.email, "Incorrecta-2026!")).status).toBe(429);
    // Con su clave, la cajera nueva y la de la semilla entran desde esa IP.
    const entered = await login(cashier.email, password);
    expect(entered.status).toBe(201);
    expect(entered.body.accessToken).toEqual(expect.any(String));
    const seeded = await login(
      "vendedor@fitstore.demo",
      process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    );
    expect(seeded.status).toBe(201);
  });
});
