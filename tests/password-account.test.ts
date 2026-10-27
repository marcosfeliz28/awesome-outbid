// Cambio voluntario de la propia contraseña (POST /auth/password) y
// restablecimiento por la administración (POST /users/:id/reset-password),
// contra la API real en FITSTORE_API_URL. Cada prueba crea sus propias cuentas
// y usa direcciones IP propias para no compartir cupos ni bloqueos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  CASHIER_PASSWORD_MESSAGE,
  generateTemporaryPasswordForRole,
  isNonTrivialCashierPassword,
  isStrongPassword,
  passwordPolicyForRole,
  STRONG_PASSWORD_MESSAGE,
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
const CASHIER_NEW = "583904";
const CASHIER_TEMP = "739205";
let ipCounter = 1;
const run = Date.now() % 200;
const nextIp = () => `198.18.${run}.${ipCounter++}`;
const created: string[] = [];

type Reply = { status: number; body: any; cookie: string; headers: Headers };
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
    headers: r.headers,
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
  it("un manager no puede cambiar a seis dígitos y conserva su clave fuerte", async () => {
    const manager = await makeUser("manager");
    const session = await signedIn(manager);
    const rejected = await call("/auth/password", {
      ip: session.ip,
      token: session.token,
      body: {
        currentPassword: INITIAL,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });
    expect(rejected.status).toBe(400);
    expect(rejected.body.message).toContain(STRONG_PASSWORD_MESSAGE);
    let row = await db.user.findUniqueOrThrow({ where: { id: manager.id } });
    expect(row.passwordHash).toBe(manager.passwordHash);
    expect(row.authVersion).toBe(0);

    const accepted = await call("/auth/password", {
      ip: session.ip,
      token: session.token,
      body: {
        currentPassword: INITIAL,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(accepted.status).toBe(201);
    expect(accepted.body.user.passwordPolicy).toBe("strong");
    row = await db.user.findUniqueOrThrow({ where: { id: manager.id } });
    expect(row.passwordHash).not.toBe(manager.passwordHash);
    expect(row.authVersion).toBe(1);
  });

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
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });
    expect(changed.status).toBe(201);
    expect(changed.body.user).toMatchObject({
      id: seller.id,
      mustChangePassword: false,
    });
    expect(changed.body.user.passwordPolicy).toBe("cashier-six-digits");
    noSecrets(changed.body, INITIAL, CASHIER_NEW);
    // La sesión de este equipo sigue (mismo sid: conserva el equipo
    // registrado) con un token y una cookie nuevos.
    expect(claims(changed.body.accessToken).sid).toBe(claims(here.token).sid);
    expect(changed.cookie).toMatch(/^fitstore_refresh=/);
    expect((await me(changed.body.accessToken, here.ip)).status).toBe(200);
    expect((await refresh(changed.cookie, here.ip)).status).toBe(201);
    // Los tokens anteriores, de este y del otro equipo, ya no sirven.
    expect((await me(here.token, here.ip)).status).toBe(401);
    expect((await me(other.token, other.ip)).status).toBe(401);
    expect((await refresh(here.cookie, here.ip)).status).toBe(401);
    expect((await refresh(other.cookie, other.ip)).status).toBe(401);
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
    expect((await login(seller, nextIp(), CASHIER_NEW)).status).toBe(201);
    const logs = await db.auditLog.findMany({
      where: { entityId: seller.id, action: "password_changed" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ userId: seller.id, entity: "user" });
    noSecrets(logs, INITIAL, CASHIER_NEW);
  });

  it("rechaza una contraseña actual incorrecta y bloquea tras cinco intentos, como el inicio de sesión", async () => {
    const seller = await makeUser("seller");
    const session = await signedIn(seller);
    const attempt = (currentPassword: string) =>
      call("/auth/password", {
        ip: session.ip,
        token: session.token,
        body: {
          currentPassword,
          newPassword: CASHIER_NEW,
          confirmPassword: CASHIER_NEW,
        },
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
    expect(weak.body.message).toContain(CASHIER_PASSWORD_MESSAGE);
    const mismatch = await attempt({
      currentPassword: INITIAL,
      newPassword: CASHIER_NEW,
      confirmPassword: CASHIER_NEW + "x",
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
      body: { password: CASHIER_TEMP },
    });
    expect(reset.status).toBe(201);
    expect(reset.body).toEqual({
      id: seller.id,
      name: seller.name,
      username: seller.username,
      mustChangePassword: true,
    });
    noSecrets(reset.body, CASHIER_TEMP);
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
      401,
    );
    // Desde la misma caja ya no está bloqueada: entra con la temporal y debe
    // elegir la suya con el flujo de cambio obligatorio.
    expect((await login(seller, cashIp)).status).toBe(400);
    const first = await login(seller, cashIp, CASHIER_TEMP);
    expect(first.status).toBe(201);
    expect(first.body).toEqual({
      requiresPasswordChange: true,
      passwordPolicy: "cashier-six-digits",
    });
    const chosen = await call("/auth/change-password", {
      ip: cashIp,
      body: {
        login: seller.username,
        currentPassword: CASHIER_TEMP,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
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
    noSecrets(logs, CASHIER_TEMP, INITIAL);
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
    expect(temporary).toMatch(/^\d{6}$/);
    expect(isNonTrivialCashierPassword(temporary)).toBe(true);
    expect(reset.body.mustChangePassword).toBe(true);
    noSecrets({ ...reset.body, temporaryPassword: undefined }, temporary);
    expect((await login(seller, nextIp(), temporary)).body).toEqual({
      requiresPasswordChange: true,
      passwordPolicy: "cashier-six-digits",
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
    expect(reset.body.message).toContain(CASHIER_PASSWORD_MESSAGE);
    for (const trivial of ["000000", "111111"]) {
      const repeated = await call(`/users/${seller.id}/reset-password`, {
        ip: admin.ip,
        token: admin.token,
        body: { password: trivial },
      });
      expect(repeated.status).toBe(400);
      expect(repeated.body.message).toContain(CASHIER_PASSWORD_MESSAGE);
    }
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
        body: { password: CASHIER_TEMP },
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
      body: { password: CASHIER_TEMP },
    });
    expect(self.status).toBe(400);
    expect(self.body.message).toContain("Cambiar mi contraseña");
    const patched = await call(`/users/${adminUser.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: CASHIER_TEMP },
    });
    expect(patched.status).toBe(400);
    expect(patched.body.message).toContain("Cambiar mi contraseña");
    // El mismo UUID en mayúsculas no esquiva ninguna protección.
    const upper = adminUser.id.toUpperCase();
    expect(upper).not.toBe(adminUser.id);
    const selfUpper = await call(`/users/${upper}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
    });
    expect(selfUpper.status).toBe(400);
    expect(selfUpper.body.message).toContain("Cambiar mi contraseña");
    const patchSelf = (body: Record<string, unknown>) =>
      call(`/users/${upper}`, {
        ip: admin.ip,
        token: admin.token,
        method: "PATCH",
        body,
      });
    const patchedUpper = await patchSelf({ password: TEMP });
    expect(patchedUpper.status).toBe(400);
    expect(patchedUpper.body.message).toContain("Cambiar mi contraseña");
    const sellerRole = await db.role.findFirstOrThrow({
      where: { name: "seller" },
    });
    for (const body of [{ active: false }, { roleId: sellerRole.id }]) {
      const r = await patchSelf(body);
      expect(r.status).toBe(400);
      expect(r.body.message).toContain("Otro administrador");
    }
    const row = await db.user.findUniqueOrThrow({
      where: { id: adminUser.id },
    });
    expect(row).toMatchObject({ active: true, roleId: adminUser.roleId });
    expect(row.passwordHash).toBe(adminUser.passwordHash);
    expect(row).toMatchObject({ mustChangePassword: false, authVersion: 0 });
    expect((await me(admin.token, admin.ip)).status).toBe(200);
  });

  it("con el UUID de otra persona en mayúsculas funciona igual y audita el id normalizado", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const sellerSession = await signedIn(seller);
    const upper = seller.id.toUpperCase();
    const edited = await call(`/users/${upper}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { name: "QA contraseña renombrada" },
    });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      id: seller.id,
      name: "QA contraseña renombrada",
    });
    const reset = await call(`/users/${upper}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
    });
    expect(reset.status).toBe(201);
    expect(reset.body.id).toBe(seller.id);
    expect((await me(sellerSession.token, sellerSession.ip)).status).toBe(401);
    const logs = await db.auditLog.findMany({
      where: {
        entityId: { in: [seller.id, upper] },
        action: { in: ["access_change", "password_reset_by_admin"] },
      },
    });
    expect(logs.map((l: any) => l.entityId)).toEqual([seller.id, seller.id]);
  });

  it("la edición del usuario con contraseña deja rastro de restablecimiento, sin la clave", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const edited = await call(`/users/${seller.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: CASHIER_TEMP, pin: "135790" },
    });
    expect(edited.status).toBe(200);
    noSecrets(edited.body, CASHIER_TEMP);
    const logs = await db.auditLog.findMany({
      where: { entityId: seller.id, action: "access_change" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].after).toEqual({ passwordReset: true, pinReset: true });
    noSecrets(logs, CASHIER_TEMP, "135790");
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row).toMatchObject({ mustChangePassword: true, authVersion: 1 });
  });

  it("la administración puede restablecer a otra administradora de su sucursal, con auditoría", async () => {
    const actorUser = await makeUser("admin");
    const admin = await signedIn(actorUser);
    const other = await makeUser("admin");
    const reset = await call(`/users/${other.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: {},
    });
    expect(reset.status).toBe(201);
    expect(reset.body.mustChangePassword).toBe(true);
    const logs = await db.auditLog.findMany({
      where: { entityId: other.id, action: "password_reset_by_admin" },
    });
    expect(logs).toHaveLength(1);
    expect(logs[0].userId).toBe(actorUser.id);
  });

  it("no alcanza cuentas de otra sucursal ni identificadores inválidos", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const foreign = await makeUser("seller", { branchId: "qa-otra-sucursal" });
    const r = await call(`/users/${foreign.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
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

describe("Cambios simultáneos, cambio pendiente y caché", () => {
  it("dos cambios simultáneos de la propia contraseña: uno gana, el otro falla y las sesiones quedan coherentes", async () => {
    const seller = await makeUser("seller");
    const first = await signedIn(seller);
    const second = await signedIn(seller);
    const OTHER = "742951";
    const [a, b] = await Promise.all([
      call("/auth/password", {
        ip: first.ip,
        token: first.token,
        body: {
          currentPassword: INITIAL,
          newPassword: CASHIER_NEW,
          confirmPassword: CASHIER_NEW,
        },
      }),
      call("/auth/password", {
        ip: second.ip,
        token: second.token,
        body: {
          currentPassword: INITIAL,
          newPassword: OTHER,
          confirmPassword: OTHER,
        },
      }),
    ]);
    const results = [
      { reply: a, session: first, password: CASHIER_NEW },
      { reply: b, session: second, password: OTHER },
    ];
    const winners = results.filter((r) => r.reply.status === 201);
    const losers = results.filter((r) => r.reply.status !== 201);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    const [winner] = winners;
    const [loser] = losers;
    // Quien pierde recibe un rechazo (o ya no tiene sesión), nunca tokens.
    expect([400, 401]).toContain(loser.reply.status);
    expect(loser.reply.body.accessToken).toBeUndefined();
    noSecrets(loser.reply.body, INITIAL, CASHIER_NEW, OTHER);
    // Sólo vale la contraseña ganadora; la sesión perdedora quedó cerrada.
    expect((await login(seller, nextIp(), winner.password)).status).toBe(201);
    expect((await login(seller, nextIp(), loser.password)).status).toBe(400);
    expect((await login(seller, nextIp(), INITIAL)).status).toBe(400);
    expect(
      (await me(winner.reply.body.accessToken, winner.session.ip)).status,
    ).toBe(200);
    expect((await me(loser.session.token, loser.session.ip)).status).toBe(401);
    expect((await refresh(loser.session.cookie, loser.session.ip)).status).toBe(
      401,
    );
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row.authVersion).toBe(1);
    expect(
      await db.auditLog.count({
        where: { entityId: seller.id, action: "password_changed" },
      }),
    ).toBe(1);
  });

  it("con un cambio obligatorio pendiente, la sesión anterior no sirve para /auth/password", async () => {
    const seller = await makeUser("seller");
    const session = await signedIn(seller);
    // La administración marcó el cambio obligatorio (sin pasar por la API).
    await db.user.update({
      where: { id: seller.id },
      data: { mustChangePassword: true },
    });
    const r = await call("/auth/password", {
      ip: session.ip,
      token: session.token,
      body: {
        currentPassword: INITIAL,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });
    expect(r.status).toBe(401);
    expect(r.body.accessToken).toBeUndefined();
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(row.passwordHash).toBe(seller.passwordHash);
    expect(row).toMatchObject({ mustChangePassword: true, authVersion: 0 });
  });

  it("las respuestas con tokens o con la contraseña temporal llevan Cache-Control: no-store", async () => {
    const noStore = (r: Reply) =>
      expect(r.headers.get("cache-control")).toBe("no-store");
    const adminUser = await makeUser("admin");
    const ip = nextIp();
    const adminLogin = await login(adminUser, ip);
    expect(adminLogin.status).toBe(201);
    noStore(adminLogin);
    const refreshed = await refresh(adminLogin.cookie, ip);
    expect(refreshed.status).toBe(201);
    noStore(refreshed);
    // Cambio voluntario.
    const changed = await call("/auth/password", {
      ip,
      token: refreshed.body.accessToken,
      body: {
        currentPassword: INITIAL,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(changed.status).toBe(201);
    noStore(changed);
    // Restablecimiento con temporal generada.
    const seller = await makeUser("seller");
    const reset = await call(`/users/${seller.id}/reset-password`, {
      ip,
      token: changed.body.accessToken,
      body: {},
    });
    expect(reset.status).toBe(201);
    expect(reset.body.temporaryPassword).toBeTruthy();
    noStore(reset);
    // Cambio obligatorio desde la temporal.
    const required = await call("/auth/change-password", {
      ip: nextIp(),
      body: {
        login: seller.username,
        currentPassword: reset.body.temporaryPassword,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });
    expect(required.status).toBe(201);
    noStore(required);
    // Cambio de vendedor con PIN.
    const switched = await call("/auth/pin", {
      ip,
      token: changed.body.accessToken,
      body: { userId: seller.id, pin: "246813" },
    });
    expect(switched.status).toBe(201);
    noStore(switched);
  });
});

describe("Política de contraseña según el rol persistido", () => {
  it("alta, edición y restablecimiento usan el rol real y la política final", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const sellerRole = await db.role.findFirstOrThrow({
      where: { name: "seller" },
    });
    const managerRole = await db.role.findFirstOrThrow({
      where: { name: "manager" },
    });
    expect(passwordPolicyForRole(sellerRole.name)).toBe("cashier-six-digits");
    expect(passwordPolicyForRole(managerRole.name)).toBe("strong");

    const create = (roleId: string, password: string, role?: string) => {
      const key = `qa-pw-role-${randomUUID().slice(0, 8)}`;
      return call("/users", {
        ip: admin.ip,
        token: admin.token,
        body: {
          name: "QA política por rol",
          username: key,
          password,
          pin: "135790",
          roleId,
          ...(role ? { role } : {}),
        },
      });
    };

    // Un campo de rol inventado en el cuerpo no puede convertir un seller en admin.
    expect((await create(sellerRole.id, NEW, "admin")).status).toBe(400);
    const cashierCreated = await create(sellerRole.id, CASHIER_TEMP, "admin");
    expect(cashierCreated.status).toBe(201);
    created.push(cashierCreated.body.id);
    let cashier = await db.user.findUniqueOrThrow({
      where: { id: cashierCreated.body.id },
    });
    expect(cashier.roleId).toBe(sellerRole.id);

    // La política de gerencia tampoco se puede rebajar diciendo "seller" en JSON.
    expect((await create(managerRole.id, CASHIER_NEW, "seller")).status).toBe(
      400,
    );
    const managerCreated = await create(managerRole.id, NEW, "seller");
    expect(managerCreated.status).toBe(201);
    created.push(managerCreated.body.id);
    const manager = await db.user.findUniqueOrThrow({
      where: { id: managerCreated.body.id },
    });
    expect(manager.roleId).toBe(managerRole.id);

    // Validación de edición antes de mutar: el roleId final de DB gobierna.
    const badPromotion = await call(`/users/${cashier.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { roleId: managerRole.id, password: CASHIER_NEW },
    });
    expect(badPromotion.status).toBe(400);
    cashier = await db.user.findUniqueOrThrow({ where: { id: cashier.id } });
    expect(cashier).toMatchObject({ roleId: sellerRole.id });
    const cashierActivation = await call("/auth/change-password", {
      ip: nextIp(),
      body: {
        login: cashier.username,
        currentPassword: CASHIER_TEMP,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });
    expect(cashierActivation.status).toBe(201);
    cashier = await db.user.findUniqueOrThrow({ where: { id: cashier.id } });

    // Antes de promover, el cajero inicia sesión con su contraseña activa de
    // seis dígitos. La promoción debe revocar esa sesión y obligar una clave
    // fuerte antes de conceder acceso de gerente.
    const cashierSession = await signedIn(cashier, nextIp(), CASHIER_NEW);
    expect(
      await db.authSession.count({ where: { userId: cashier.id } }),
    ).toBeGreaterThan(0);
    const promoted = await call(`/users/${cashier.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { roleId: managerRole.id },
    });
    expect(promoted.status).toBe(200);
    const promotedRow = await db.user.findUniqueOrThrow({
      where: { id: cashier.id },
    });
    expect(promoted.body).toMatchObject({
      active: true,
      mustChangePassword: true,
    });
    expect(promotedRow).toMatchObject({
      roleId: managerRole.id,
      mustChangePassword: true,
      authVersion: cashier.authVersion + 1,
    });
    expect(promotedRow.passwordHash).toBe(cashier.passwordHash);
    expect(await db.authSession.count({ where: { userId: cashier.id } })).toBe(
      0,
    );
    expect((await me(cashierSession.token, cashierSession.ip)).status).toBe(
      401,
    );
    const restrictedLogin = await login(cashier, nextIp(), CASHIER_NEW);
    expect(restrictedLogin.status).toBe(201);
    expect(restrictedLogin.body).toMatchObject({
      requiresPasswordChange: true,
      passwordPolicy: "strong",
    });
    const strongChange = await call("/auth/change-password", {
      ip: nextIp(),
      body: {
        login: cashier.username,
        currentPassword: CASHIER_NEW,
        newPassword: NEW,
        confirmPassword: NEW,
      },
    });
    expect(strongChange.status).toBe(201);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: cashier.id } }))
        .mustChangePassword,
    ).toBe(false);
    const weakManagerEdit = await call(`/users/${cashier.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: CASHIER_NEW },
    });
    expect(weakManagerEdit.status).toBe(400);
    const strongManagerEdit = await call(`/users/${cashier.id}`, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: NEW },
    });
    expect(strongManagerEdit.status).toBe(200);

    // Un reset no acepta una clave de cajero para gerencia; la temporal generada
    // sigue siendo fuerte. A la inversa, seller recibe seis dígitos no triviales.
    expect(
      (
        await call(`/users/${manager.id}/reset-password`, {
          ip: admin.ip,
          token: admin.token,
          body: { password: CASHIER_NEW },
        })
      ).status,
    ).toBe(400);
    const managerReset = await call(`/users/${manager.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: {},
    });
    expect(managerReset.status).toBe(201);
    expect(isStrongPassword(managerReset.body.temporaryPassword)).toBe(true);

    // cashierCreated fue promovido a manager arriba; probar un reset seller
    // separado confirma la política usando el rol persistido actual.
    const resetSeller = await makeUser("seller");
    const cashierReset = await call(`/users/${resetSeller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: {},
    });
    expect(cashierReset.status).toBe(201);
    expect(cashierReset.body.temporaryPassword).toMatch(/^\d{6}$/);
    expect(
      isNonTrivialCashierPassword(cashierReset.body.temporaryPassword),
    ).toBe(true);
    expect(generateTemporaryPasswordForRole(sellerRole.name)).toMatch(
      /^\d{6}$/,
    );
  });
});

// N-08 (auditoría de seguridad v2): una contraseña temporal vence a los 7 días.
describe("Contraseñas temporales con vencimiento", () => {
  const DAY = 86_400_000;
  const changeObligatory = (user: any, ip: string, current = CASHIER_TEMP) =>
    call("/auth/change-password", {
      ip,
      body: {
        login: user.username,
        currentPassword: current,
        newPassword: CASHIER_NEW,
        confirmPassword: CASHIER_NEW,
      },
    });

  it("restablecer fija el vencimiento a 7 días; la clave vigente entra y cambiarla lo quita", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    const before = Date.now();
    const reset = await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
    });
    expect(reset.status).toBe(201);
    const row = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(+row.passwordExpiresAt).toBeGreaterThan(before + 6.99 * DAY);
    expect(+row.passwordExpiresAt).toBeLessThan(Date.now() + 7.01 * DAY);
    const ip = nextIp();
    expect((await login(seller, ip, CASHIER_TEMP)).body).toEqual({
      requiresPasswordChange: true,
      passwordPolicy: "cashier-six-digits",
    });
    expect((await changeObligatory(seller, ip)).status).toBe(201);
    const after = await db.user.findUniqueOrThrow({ where: { id: seller.id } });
    expect(after).toMatchObject({
      mustChangePassword: false,
      passwordExpiresAt: null,
    });
  });

  it("vencida, la temporal correcta ya no entra ni cambia la clave, y un nuevo restablecimiento la rehabilita", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const seller = await makeUser("seller");
    await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
    });
    await db.user.update({
      where: { id: seller.id },
      data: { passwordExpiresAt: new Date(Date.now() - 1000) },
    });
    const ip = nextIp();
    const expired = await login(seller, ip, CASHIER_TEMP);
    expect(expired.status).toBe(400);
    expect(expired.body.message).toMatch(/temporal venció/);
    expect(expired.body.message).toContain("Restablecer contraseña");
    expect(JSON.stringify(expired.body)).not.toContain("accessToken");
    const change = await changeObligatory(seller, ip);
    expect(change.status).toBe(400);
    expect(change.body.message).toMatch(/temporal venció/);
    expect(await db.authSession.count({ where: { userId: seller.id } })).toBe(
      0,
    );
    // Con una clave incorrecta no se revela si la temporal venció.
    const wrongPassword = await login(seller, nextIp(), "Otra-Clave-2026!");
    expect(wrongPassword.body.message).toMatch(/incorrectos/);
    // La administración la restablece y vuelve a funcionar.
    const again = await call(`/users/${seller.id}/reset-password`, {
      ip: admin.ip,
      token: admin.token,
      body: { password: CASHIER_TEMP },
    });
    expect(again.status).toBe(201);
    expect((await login(seller, nextIp(), CASHIER_TEMP)).body).toEqual({
      requiresPasswordChange: true,
      passwordPolicy: "cashier-six-digits",
    });
  });

  it("el alta de usuario y la edición con contraseña también fijan el vencimiento", async () => {
    const admin = await signedIn(await makeUser("admin"));
    const roles = await call("/roles", { ip: admin.ip, token: admin.token });
    const roleId = roles.body.find((r: any) => r.name === "seller").id;
    const key = "qa-pw-alta-" + randomUUID().slice(0, 8);
    const made = await call("/users", {
      ip: admin.ip,
      token: admin.token,
      body: {
        name: "QA alta temporal",
        username: key,
        password: CASHIER_TEMP,
        pin: "135790",
        roleId,
      },
    });
    expect(made.status).toBe(201);
    created.push(made.body.id);
    const fresh = await db.user.findUniqueOrThrow({
      where: { id: made.body.id },
    });
    expect(+fresh.passwordExpiresAt).toBeGreaterThan(Date.now() + 6.9 * DAY);
    await db.user.update({
      where: { id: made.body.id },
      data: { passwordExpiresAt: null },
    });
    const edited = await call("/users/" + made.body.id, {
      ip: admin.ip,
      token: admin.token,
      method: "PATCH",
      body: { password: CASHIER_NEW },
    });
    expect(edited.status).toBe(200);
    const row = await db.user.findUniqueOrThrow({
      where: { id: made.body.id },
    });
    expect(row.mustChangePassword).toBe(true);
    expect(+row.passwordExpiresAt).toBeGreaterThan(Date.now() + 6.9 * DAY);
  });

  it("un cambio de contraseña obligatorio sin vencimiento (política) no caduca", async () => {
    const seller = await makeUser("seller", { mustChangePassword: true });
    const ip = nextIp();
    expect((await login(seller, ip)).body).toEqual({
      requiresPasswordChange: true,
      passwordPolicy: "cashier-six-digits",
    });
  });
});
