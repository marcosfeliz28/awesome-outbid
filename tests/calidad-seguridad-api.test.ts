// W9 · Pruebas que matan mutaciones de seguridad que sobrevivían (auditoría 07
// v2, §2.3): PIN de cualquier usuario en la aprobación de gerencia (SE10), el
// cupo de PIN cortos de la sucursal (SE05), el reinicio del contador propio al
// acertar (SE13), el token que se emite con credenciales ya cambiadas (A01), el
// refresh token anterior a un cambio de credenciales (A02) o reutilizado en
// carrera (A04), el cambio rápido de usuario entre sucursales (A06), el equipo
// revocado o de otra sucursal tratado como aprobado (A07, A08) y el tiempo de
// inactividad por defecto (A10). Cada caso nombra la mutación que debe matar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { AuthController } from "../apps/api/src/auth";
import {
  hashTerminalSecret,
  managerPinApproval,
  verifyAttempt,
  verifyPinAttempt,
} from "../apps/api/src/security";

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
const suffix = randomUUID().slice(0, 8);
let ipCounter = 1 + Math.floor(Math.random() * 200);
const nextIp = () => "198.18.21." + (ipCounter++ % 250 || 1);
const PASSWORD = "FitStore-QA-W9-Seg-2026!";
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";

const created: { users: string[]; terminals: string[]; keys: string[] } = {
  users: [],
  terminals: [],
  keys: [],
};
let roles: Record<string, string> = {};
let passwordHash = "";

async function post(
  path: string,
  data: unknown,
  headers: Record<string, string> = {},
  ip = nextIp(),
) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...headers,
    },
    body: JSON.stringify(data),
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* sin JSON */
  }
  return { status: response.status, body, headers: response.headers };
}
const refreshCookie = (headers: Headers) =>
  headers
    .getSetCookie()
    .find((c) => c.startsWith("fitstore_refresh="))!
    .split(";")[0]!;

async function makeUser(
  role: string,
  options: { branchId?: string; pin?: string; active?: boolean } = {},
) {
  const tag = randomUUID().slice(0, 8);
  const pin = options.pin ?? "135790";
  const user = await db.user.create({
    data: {
      name: "QA W9 " + role + " " + tag,
      username: "w9" + tag,
      usernameKey: "w9" + tag,
      email: `w9-${role}-${tag}@example.test`,
      passwordHash,
      pinHash: await hash(pin, 4),
      roleId: roles[role],
      branchId: options.branchId ?? "main",
      active: options.active ?? true,
    },
  });
  created.users.push(user.id);
  return user;
}
async function makeTerminal(branchId: string, revoked = false) {
  const id = randomUUID();
  const secret = "w9-secret-" + randomUUID();
  await db.terminal.create({
    data: {
      id,
      name: "QA W9 equipo " + suffix,
      branchId,
      approvedAt: new Date(),
      revokedAt: revoked ? new Date() : null,
      secretHash: hashTerminalSecret(secret),
    },
  });
  created.terminals.push(id);
  return { id, secret };
}

beforeAll(async () => {
  for (const name of ["seller", "manager", "admin"])
    roles[name] = (await db.role.findFirstOrThrow({ where: { name } })).id;
  passwordHash = await hash(PASSWORD, 4);
}, 60000);

afterAll(async () => {
  await db.authAttempt.deleteMany({
    where: {
      OR: [
        ...created.keys.map((key) => ({ key: { startsWith: key } })),
        ...created.users.map((id) => ({ key: { startsWith: "login:" + id } })),
      ],
    },
  });
  await db.refreshToken.deleteMany({
    where: { userId: { in: created.users } },
  });
  await db.authSession.deleteMany({ where: { userId: { in: created.users } } });
  await db.terminal.deleteMany({ where: { id: { in: created.terminals } } });
  await db.user.deleteMany({ where: { id: { in: created.users } } });
  await db.$disconnect();
}, 60000);

describe("Aprobaciones con PIN (funciones de seguridad contra la base)", () => {
  it("SE10 · el PIN de aprobación sólo lo da un usuario con sale:manage, no cualquiera", async () => {
    const pin = "802461";
    const seller = await makeUser("seller", { pin });
    const actor: any = { id: randomUUID(), branchId: "main", permissions: [] };
    // El PIN de una vendedora NO aprueba: nadie con ese PIN gestiona ventas.
    await expect(managerPinApproval(db, actor, pin)).rejects.toThrow(
      /PIN incorrecto/,
    );
    const manager = await makeUser("manager", { pin });
    expect(await managerPinApproval(db, actor, pin)).toBe(manager.id);
    expect(manager.id).not.toBe(seller.id);
    await db.authAttempt.deleteMany({
      where: { key: { startsWith: "approval:" + actor.id } },
    });
  }, 120_000);

  it("SE05 · 30 fallos con PIN corto entre varias personas bloquean los PIN cortos de la sucursal; el PIN de 6 dígitos sigue", async () => {
    const branchId = "w9-pin-" + suffix;
    const wrong = async (n: number, pin: string, verify = async () => null) => {
      const actor: any = { id: "w9-req-" + suffix + "-" + n, branchId };
      created.keys.push("approval:" + actor.id, "pin-requester:" + actor.id);
      return verifyPinAttempt(db, "approval:" + actor.id, verify as any, {
        pin,
        actor,
      });
    };
    created.keys.push("pin-short:" + branchId);
    // 30 fallos repartidos entre 8 personas (cada una queda lejos de sus
    // propios topes: 5 por clave y 10 por hora).
    for (let n = 0; n < 30; n++)
      await expect(wrong(Math.floor(n / 4), "1234")).rejects.toThrow(
        /PIN incorrecto/,
      );
    // La persona 9, con PIN corto, ya no puede ni acertar...
    await expect(
      wrong(9, "1234", async () => "gerente" as any),
    ).rejects.toThrow(/Los PIN de 4 o 5 dígitos quedaron bloqueados/);
    // ...pero el PIN de 6 dígitos no se ve afectado.
    await expect(wrong(10, "123456")).rejects.toThrow(/PIN incorrecto/);
    await expect(
      wrong(11, "123456", async () => "gerente" as any),
    ).resolves.toBe("gerente");
  }, 60000);

  it("SE13 · un acierto reinicia el contador propio: 4 fallos + acierto + 4 fallos no bloquean", async () => {
    const key = "w9-se13:" + suffix;
    created.keys.push(key);
    const attempt = (matches: boolean) =>
      verifyAttempt(db, key, async () => (matches ? "yo" : null), {
        blocked: "BLOQUEADO",
        wrong: "INCORRECTO",
      });
    for (let n = 0; n < 4; n++)
      await expect(attempt(false)).rejects.toThrow("INCORRECTO");
    await expect(attempt(true)).resolves.toBe("yo");
    for (let n = 0; n < 4; n++)
      await expect(attempt(false)).rejects.toThrow("INCORRECTO");
    await expect(attempt(true)).resolves.toBe("yo");
    // Cinco fallos seguidos sí bloquean, y el bloqueo rechaza hasta un acierto.
    for (let n = 0; n < 5; n++)
      await expect(attempt(false)).rejects.toThrow("INCORRECTO");
    await expect(attempt(true)).rejects.toThrow("BLOQUEADO");
  });
});

describe("Sesiones y equipos (API real)", () => {
  it("A01 · no se emite sesión con credenciales que cambiaron mientras el inicio de sesión estaba en vuelo", async () => {
    const user = await makeUser("seller");
    const stale = await db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { role: true },
    });
    const res: any = { cookie: () => undefined };
    const controller: any = new AuthController(
      db,
      { sign: () => "token" } as any,
      {} as any,
    );
    const fresh = await controller.issue(stale, res);
    expect(fresh.accessToken).toBe("token");
    // «Restablecer contraseña» sube authVersion mientras issue() corría.
    await db.user.update({
      where: { id: user.id },
      data: { authVersion: { increment: 1 } },
    });
    const before = await db.authSession.count({ where: { userId: user.id } });
    await expect(controller.issue(stale, res)).rejects.toThrow(
      /credenciales cambiaron/,
    );
    expect(await db.authSession.count({ where: { userId: user.id } })).toBe(
      before,
    );
  });

  it("A02 · un refresh token de antes de un cambio de credenciales ya no renueva la sesión", async () => {
    const user = await makeUser("seller");
    const login = await post("/auth/login", {
      email: user.email,
      password: PASSWORD,
    });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    const cookie = refreshCookie(login.headers);
    // La contraseña cambia sin pasar por la ruta que borra los refresh tokens
    // (p. ej. un restablecimiento hecho por otro medio): sube authVersion.
    await db.user.update({
      where: { id: user.id },
      data: { authVersion: { increment: 1 } },
    });
    const refreshed = await post("/auth/refresh", {}, { Cookie: cookie });
    expect(refreshed.status).toBe(400);
    expect(refreshed.body.message).toMatch(/sesión ha expirado/);
    // Un token emitido con la versión actual, sí renueva.
    const again = await post("/auth/login", {
      email: user.email,
      password: PASSWORD,
    });
    const ok = await post(
      "/auth/refresh",
      {},
      { Cookie: refreshCookie(again.headers) },
    );
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
  });

  it("A04 · el mismo refresh token enviado a la vez varias veces renueva una sola sesión", async () => {
    const user = await makeUser("seller");
    for (let round = 0; round < 3; round++) {
      const login = await post("/auth/login", {
        email: user.email,
        password: PASSWORD,
      });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      const cookie = refreshCookie(login.headers);
      const ip = nextIp();
      const replies = await Promise.all(
        Array.from({ length: 8 }, () =>
          post("/auth/refresh", {}, { Cookie: cookie }, ip),
        ),
      );
      expect(
        replies.filter((r) => r.status === 201),
        "ronda " + round,
      ).toHaveLength(1);
      expect(
        replies.filter((r) => r.status === 400).map((r) => r.body.message),
      ).toEqual(Array(7).fill(expect.stringMatching(/sesión/)));
    }
  });

  it("A06 · el cambio rápido de usuario con PIN no cruza de sucursal", async () => {
    const owner = await post("/auth/login", {
      email: "admin@fitstore.demo",
      password: DEMO,
    });
    expect(owner.status).toBe(201);
    const token = owner.body.accessToken;
    const here = await makeUser("seller", { pin: "135790" });
    const there = await makeUser("seller", {
      pin: "135790",
      branchId: "w9-otra-" + suffix,
    });
    const switchTo = (userId: string) =>
      post(
        "/auth/pin",
        { userId, pin: "135790" },
        {
          Authorization: "Bearer " + token,
        },
      );
    const other = await switchTo(there.id);
    expect(other.status).toBe(400);
    expect(other.body.message).toMatch(/PIN incorrecto/);
    expect(other.body.accessToken).toBeUndefined();
    // En la misma sucursal, con el mismo PIN, sí funciona.
    const same = await switchTo(here.id);
    expect(same.status, JSON.stringify(same.body)).toBe(201);
    expect(same.body.user.id).toBe(here.id);
  });

  it("A07/A08 · sólo un equipo aprobado, vigente y de la misma sucursal usa el contador del equipo", async () => {
    const user = await makeUser("seller");
    const keysOf = async () =>
      (
        await db.authAttempt.findMany({
          where: { key: { startsWith: `login:${user.id}:` } },
        })
      ).map((row: any) => row.key as string);
    const failFrom = async (terminal: { id: string; secret: string }) => {
      await db.authAttempt.deleteMany({
        where: { key: { startsWith: `login:${user.id}:` } },
      });
      const ip = nextIp();
      const r = await post(
        "/auth/login",
        { email: user.email, password: "incorrecta-W9-2026!", terminal },
        {},
        ip,
      );
      expect(r.status).toBe(400);
      const keys = await keysOf();
      return {
        byTerminal: keys.some((k) => k.endsWith(":terminal:" + terminal.id)),
        byIp: keys.some((k) => k.endsWith(":" + ip)),
      };
    };
    // Control: aprobado y de la misma sucursal → contador del equipo, no de la IP.
    expect(await failFrom(await makeTerminal("main"))).toEqual({
      byTerminal: true,
      byIp: false,
    });
    // Revocado → se trata como no aprobado: cuenta por IP.
    expect(await failFrom(await makeTerminal("main", true))).toEqual({
      byTerminal: false,
      byIp: true,
    });
    // De otra sucursal → no es «aprobado» para esta cuenta.
    expect(await failFrom(await makeTerminal("w9-otra-" + suffix))).toEqual({
      byTerminal: false,
      byIp: true,
    });
  });

  it("A10 · sin sessionTimeoutMinutes en Ajustes la sesión inactiva vence a los 30 minutos", async () => {
    const stored = await db.settings.findUniqueOrThrow({
      where: { id: "main" },
    });
    const { sessionTimeoutMinutes: _removed, ...without } = stored.data as any;
    void _removed;
    await db.settings.update({
      where: { id: "main" },
      data: { data: without },
    });
    try {
      const user = await makeUser("seller");
      const login = await post("/auth/login", {
        email: user.email,
        password: PASSWORD,
      });
      expect(login.status, JSON.stringify(login.body)).toBe(201);
      expect(login.body.user.sessionTimeoutMinutes).toBe(30);
    } finally {
      await db.settings.update({
        where: { id: "main" },
        data: { data: stored.data },
      });
    }
  });
});
