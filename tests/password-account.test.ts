// Cambio voluntario de la propia contraseña (POST /auth/password) y
// restablecimiento por la administración (POST /users/:id/reset-password),
// contra la API real en FITSTORE_API_URL. Cada prueba crea sus propias cuentas
// y usa direcciones IP propias para no compartir cupos ni bloqueos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  STRONG_PASSWORD_MESSAGE,
  isStrongPassword,
} from "../apps/api/src/password-policy";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const { hash } = requireApi("bcryptjs");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";

const INITIAL = "Cuenta-Inicial-2026!";
const NEW = "Cuenta-Nueva-Segura-2026#";
const TEMP = "Temporal-Admin-2026$";
let ipCounter = 1;
const run = Date.now() % 200;
const nextIp = () => `198.18.${run}.${ipCounter++}`;
const created: string[] = [];

type Reply = { status: number; body: any; cookie: string };
async function call(
  path: string,
  options: {
    ip: string;
    token?: string;
    cookie?: string;
    body?: unknown;
    method?: string;
  },
): Promise<Reply> {
  const r = await fetch(base + path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": options.ip,
      ...(options.token ? { Authorization: "Bearer " + options.token } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const text = await r.text();
  return {
    status: r.status,
    body: text ? JSON.parse(text) : null,
    cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
  };
}
const claims = (token: string) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());

async function makeUser(
  role: string,
  extra: Record<string, unknown> = {},
  password = INITIAL,
) {
  const roleRow = await db.role.findFirstOrThrow({ where: { name: role } });
  const key = `qa-pw-${role}-${randomUUID().slice(0, 8)}`;
  const user = await db.user.create({
    data: {
      name: "QA contraseña " + role,
      username: key,
      usernameKey: key,
      email: key + "@example.test",
      passwordHash: await hash(password, 4),
      pinHash: await hash("246813", 4),
      roleId: roleRow.id,
      branchId: "main",
      ...extra,
    },
  });
  created.push(user.id);
  return user;
}
const login = (user: any, ip: string, password = INITIAL) =>
  call("/auth/login", { ip, body: { login: user.username, password } });
async function signedIn(user: any, ip = nextIp(), password = INITIAL) {
  const r = await login(user, ip, password);
  expect(r.status).toBe(201);
  expect(r.body.accessToken).toBeTruthy();
  return { token: r.body.accessToken as string, cookie: r.cookie, ip };
}
const me = (token: string, ip: string) => call("/auth/me", { ip, token });
const refresh = (cookie: string, ip: string) =>
  call("/auth/refresh", { ip, cookie, body: {} });
const noSecrets = (value: unknown, ...secrets: string[]) => {
  const text = JSON.stringify(value);
  expect(text).not.toMatch(/\$2[aby]\$/);
  expect(text).not.toMatch(/passwordHash|pinHash/);
  for (const secret of secrets) expect(text).not.toContain(secret);
};

beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  await db.authAttempt.deleteMany({
    where: { OR: created.map((id) => ({ key: { contains: id } })) },
  });
  await db.refreshToken.deleteMany({ where: { userId: { in: created } } });
  await db.authSession.deleteMany({ where: { userId: { in: created } } });
  await db.auditLog.deleteMany({ where: { entityId: { in: created } } });
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("Cambiar mi contraseña (POST /auth/password)", () => {
  it("con la contraseña actual correcta cambia la clave, conserva esta sesión y cierra las demás", async () => {
    const seller = await makeUser("seller");
    const here = await signedIn(seller);
    const other = await signedIn(seller);
    // Un bloqueo previo desde otra dirección también se limpia.
    await db.authAttempt.create({
      data: {
        key: `login:${seller.id}:0:203.0.113.77`,
        failedAttempts: 3,
      },
    });
    const changed = await call("/auth/password", {
      ip: here.ip,
      token: here.token,
      body: {
        currentPassword: INITIAL,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(changed.status).toBe(201);
    expect(changed.body.user).toMatchObject({
      id: seller.id,
      mustChangePassword: false,
    });
    noSecrets(changed.body, INITIAL, NEW);
    // La sesión de este equipo sigue (mismo sid: conserva el equipo
    // registrado) con un token y una cookie nuevos.
    expect(claims(changed.body.accessToken).sid).toBe(claims(here.token).sid);
    expect(changed.cookie).toMatch(/^fitstore_refresh=/);
    expect((await me(changed.body.accessToken, here.ip)).status).toBe(200);
    expect((await refresh(changed.cookie, here.ip)).status).toBe(201);
    // Los tokens anteriores, de este y del otro equipo, ya no sirven.
    expect((await me(here.token, here.ip)).status).toBe(401);
    expect((await me(other.token, other.ip)).status).toBe(401);
    expect((await refresh(here.cookie, here.ip)).status).toBe(400);
    expect((await refresh(other.cookie, other.ip)).status).toBe(400);
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 1 });
    expect(await db.authSession.count({ where: { userId: seller.id } })).toBe(
      1,
    );
    expect(
      await db.authAttempt.count({
        where: { key: { startsWith: `login:${seller.id}:` } },
      }),
    ).toBe(0);
    // La clave anterior deja de servir y la nueva entra.
    expect((await login(seller, nextIp())).status).toBe(400);
    expect((await login(seller, nextIp(), NEW)).status).toBe(201);
    const logs = await db.auditLog.findMany({
      where: { entityId: seller.id, action: "password_changed" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: seller.id, entity: "user" });
    noSecrets(logs, INITIAL, NEW);
  });

  it("rechaza una contraseña actual incorrecta y bloquea tras cinco intentos, como el inicio de sesión", async () => {
    const seller = await makeUser("seller");
    const session = await signedIn(seller);
    const attempt = (currentPassword: string) =>
      call("/auth/password", {
        ip: session.ip,
        token: session.token,
        body: { currentPassword, newPassword: NEW, confirmPassword: NEW },
      });
    const wrong = await attempt("Otra-Clave-Incorrecta-1!");
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe("La contraseña actual no es correcta.");
    for (let n = 2; n <= 5; n++)
      expect((await attempt(`Otra-Clave-Incorrecta-${n}!`)).status).toBe(400);
    const blocked = await attempt(INITIAL);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/bloquead/i);
    // Mismo contador que el inicio de sesión desde esa dirección; otra
    // dirección no queda bloqueada.
    expect((await login(seller, session.ip)).body.message).toMatch(/bloquead/i);
    expect((await login(seller, nextIp())).status).toBe(201);
    // La sesión abierta sigue funcionando y la clave no cambió.
    expect((await me(session.token, session.ip)).status).toBe(200);
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row.passwordHash).toBe(seller.passwordHash);
    expect(
      await db.auditLog.count({
        where: { entityId: seller.id, action: "password_changed" },
      }),
    ).toBe(0);
  });

  it("exige las mismas reglas que el cambio obligatorio", async () => {
    const seller = await makeUser("seller");
    const session = await signedIn(seller);
    const attempt = (body: Record<string, string>) =>
      call("/auth/password", { ip: session.ip, token: session.token, body });
    const weak = await attempt({
      currentPassword: INITIAL,
      newPassword: "corta1!",
      confirmPassword: "corta1!",
    });
    expect(weak.status).toBe(400);
    expect(weak.body.message).toContain(STRONG_PASSWORD_MESSAGE);
    const mismatch = await attempt({
      currentPassword: INITIAL,
      newPassword: NEW,
      confirmPassword: NEW + "x",
    });
    expect(mismatch.status).toBe(400);
    expect(mismatch.body.message).toContain("no coinciden");
    const same = await attempt({
      currentPassword: INITIAL,
      newPassword: INITIAL,
      confirmPassword: INITIAL,
    });
    expect(same.status).toBe(400);
    expect(same.body.message).toContain("distinta de la actual");
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row.passwordHash).toBe(seller.passwordHash);
    expect(row.authVersion).toBe(0);
  });

  it("requiere sesión iniciada", async () => {
    const r = await call("/auth/password", {
      ip: nextIp(),
      body: {
        currentPassword: INITIAL,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(r.status).toBe(401);
  });
});

describe("Restablecer contraseña (POST /users/:id/reset-password)", () => {
  it("la administración pone una temporal: obliga al cambio, cierra sesiones, quita el bloqueo y audita sin la clave", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const sellerSession = await signedIn(seller);
    // La cajera olvidó su clave y quedó bloqueada desde su caja.
    const cashIp = nextIp();
    for (let n = 0; n < 5; n++)
      expect(
        (await login(seller, cashIp, "Olvidada-Clave-" + n + "!")).status,
      ).toBe(400);
    const locked = (await login(seller, cashIp)).body.message;
    expect(locked).toMatch(/bloquead/i);
    // El aviso ofrece lo que existe: esperar o que la administración use
    // «Restablecer contraseña».
    expect(locked).toContain("Restablecer contraseña");
    expect(locked).toContain("Configuración › Usuarios y permisos");

    const reset = await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: TEMP },
    });
    expect(reset.status).toBe(201);
    expect(reset.body).toEqual({
      id: seller.id,
      name: seller.name,
      username: seller.username,
      mustChangePassword: true,
    });
    noSecrets(reset.body, TEMP);
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row).toMatchObject({ mustChangePassword: true, authVersion: 1 });
    expect(await db.authSession.count({ where: { userId: seller.id } })).toBe(
      0,
    );
    expect(await db.refreshToken.count({ where: { userId: seller.id } })).toBe(
      0,
    );
    expect(
      await db.authAttempt.count({
        where: { key: { startsWith: `login:${seller.id}:` } },
      }),
    ).toBe(0);
    // Su sesión abierta se cerró.
    expect((await me(sellerSession.token, sellerSession.ip)).status).toBe(401);
    expect((await refresh(sellerSession.cookie, sellerSession.ip)).status).toBe(
      400,
    );
    // Desde la misma caja ya no está bloqueada: entra con la temporal y debe
    // elegir la suya con el flujo de cambio obligatorio.
    expect((await login(seller, cashIp)).status).toBe(400);
    const first = await login(seller, cashIp, TEMP);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ requiresPasswordChange: true });
    const chosen = await call("/auth/change-password", {
      ip: cashIp,
      body: {
        login: seller.username,
        currentPassword: TEMP,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(chosen.status).toBe(201);
    expect((await me(chosen.body.accessToken, cashIp)).status).toBe(200);

    const logs = await db.auditLog.findMany({
      where: { entityId: seller.id, action: "password_reset_by_admin" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      userId: claims(admin.token).sub,
      entity: "user",
    });
    noSecrets(logs, TEMP, INITIAL);
  });

  it("si no se escribe una, genera una temporal segura y la muestra una sola vez", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const reset = await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: {},
    });
    expect(reset.status).toBe(201);
    const temporary = reset.body.temporaryPassword;
    expect(typeof temporary).toBe("string");
    expect(isStrongPassword(temporary)).toBe(true);
    expect(reset.body.mustChangePassword).toBe(true);
    noSecrets({ ...reset.body, temporaryPassword: undefined }, temporary);
    expect((await login(seller, nextIp(), temporary)).body).toEqual({
      requiresPasswordChange: true,
    });
    const logs = await db.auditLog.findMany({
      where: { entityId: seller.id, action: "password_reset_by_admin" },
    });
    expect(logs).toHaveLength(1);
    noSecrets(logs, temporary);
    // La lista de usuarios no la vuelve a mostrar.
    const users = await call("/users", { ip: admin.ip, token: admin.token });
    expect(users.status).toBe(200);
    noSecrets(users.body, temporary);
  });

  it("rechaza temporales débiles sin tocar la cuenta", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const reset = await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: "123456" },
    });
    expect(reset.status).toBe(400);
    expect(reset.body.message).toContain(STRONG_PASSWORD_MESSAGE);
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 0 });
  });

  it("sólo la administración (permiso *) puede restablecer: gerente y cajera reciben 403", async () => {
    const target = await makeUser("seller");
    for (const role of ["manager", "seller"]) {
      const actor = await signedIn(await makeUser(role));
      const r = await call(`/users/${target.id}/reset-password`, {
        ip: actor.ip,
        token: actor.token,
        body: { password: TEMP },
      });
      expect(r.status).toBe(403);
    }
    const row = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 0 });
    expect(
      await db.auditLog.count({
        where: { entityId: target.id, action: "password_reset_by_admin" },
      }),
    ).toBe(0);
  });

  it("no restablece la propia cuenta sin la contraseña actual (ni por esta vía ni editando el usuario)", async () => {
    const adminUser = await makeUser("admin");
    const admin = await signedIn(adminUser);
    const self = await call(`/users/${adminUser.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: TEMP },
    });
    expect(self.status).toBe(400);
    expect(self.body.message).toContain("Cambiar mi contraseña");
    const patched = await call(`/users/${adminUser.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: TEMP },
    });
    expect(patched.status).toBe(400);
    expect(patched.body.message).toContain("Cambiar mi contraseña");
    const row = await db.user.findUniqueOrThrow({
      where: { id: adminUser.id },
    });
    expect(row.passwordHash).toBe(adminUser.passwordHash);
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 0 });
    expect((await me(admin.token, admin.ip)).status).toBe(200);
  });

  it("no alcanza cuentas de otra sucursal ni identificadores inválidos", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const foreign = await makeUser("seller", { branchId: "qa-otra-sucursal" });
    const r = await call(`/users/${foreign.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: TEMP },
    });
    expect(r.status).toBe(404);
    const row = await db.user.findUniqueOrThrow({ where: { id: foreign.id } });
    expect(row.passwordHash).toBe(foreign.passwordHash);
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 0 });
    expect(
      (
        await call(`/users/${randomUUID()}/reset-password`, {
          ip: admin.ip,
          token: admin.token,
          body: {},
        })
      ).status,
    ).toBe(404);
    expect(
      (
        await call(`/users/no-es-uuid/reset-password`, {
          ip: admin.ip,
          token: admin.token,
          body: {},
        })
      ).status,
    ).toBe(400);
  });
});
