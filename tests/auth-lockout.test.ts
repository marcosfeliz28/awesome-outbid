// Auditoría de seguridad 2026-10-10 (S-01, S-02, S-03, S-04, S-06) contra la
// API real en FITSTORE_API_URL.
//
// En producción la cadena Cloudflare → borde de Render → Nginx → API puede
// hacer que todas las peticiones lleguen con la misma IP (la del borde). Aquí
// se modela así: atacante y cajera envían la MISMA X-Forwarded-For
// (`EDGE_IP`), que es lo que ve la API cuando Nginx no recibe la IP real.
// Las cuentas y los equipos se crean directamente en la base (bcrypt de coste
// bajo) para que cada prueba tenga los suyos.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
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
const { hash } = requireApi("bcryptjs");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";

const PASSWORD = "Cuenta-Cajera-2026!";
const run = Date.now() % 200;
let ipCounter = 1;
// Direcciones de documentación/benchmark propias de esta ejecución.
const nextIp = () => `198.19.${run}.${ipCounter++ % 250}`;
const created: string[] = [];
const terminals: string[] = [];
const MINUTE = 60_000;

type Reply = { status: number; body: any };
async function call(
  path: string,
  options: { ip: string; token?: string; body?: unknown; method?: string },
): Promise<Reply> {
  const r = await fetch(base + path, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": options.ip,
      ...(options.token ? { Authorization: "Bearer " + options.token } : {}),
    },
    ...(options.body === undefined
      ? {}
      : { body: JSON.stringify(options.body) }),
  });
  const text = await r.text();
  return { status: r.status, body: text ? JSON.parse(text) : null };
}

async function makeUser(role: string, pin = "246813") {
  const roleRow = await db.role.findFirstOrThrow({ where: { name: role } });
  const key = `qa-lock-${role}-${randomUUID().slice(0, 8)}`;
  const user = await db.user.create({
    data: {
      name: "QA bloqueo " + role,
      username: key,
      usernameKey: key,
      email: key + "@example.test",
      passwordHash: await hash(PASSWORD, 4),
      pinHash: await hash(pin, 4),
      roleId: roleRow.id,
      branchId: "main",
    },
  });
  created.push(user.id);
  return user;
}
// Un equipo de la tienda ya aprobado por un gerente (Configuración › Equipos).
async function approvedTerminal(approved = true) {
  const id = randomUUID();
  const secret = "qa-lock-secret-" + randomUUID();
  await db.terminal.create({
    data: {
      id,
      name: "QA bloqueo " + id.slice(0, 4),
      branchId: "main",
      secretHash: createHash("sha256").update(secret).digest("hex"),
      ...(approved ? { approvedAt: new Date() } : {}),
    },
  });
  terminals.push(id);
  return { id, secret };
}
const login = (
  user: { username: string },
  ip: string,
  password = PASSWORD,
  terminal?: { id: string; secret: string },
) =>
  call("/auth/login", {
    ip,
    body: { login: user.username, password, ...(terminal ? { terminal } : {}) },
  });
const blocked = (r: Reply) =>
  r.status === 400 && /bloquead/i.test(String(r.body?.message));
const wrong = (r: Reply) =>
  r.status === 400 && /incorrectos/.test(String(r.body?.message));

beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  await db.authAttempt.deleteMany({
    where: {
      OR: [
        ...created.map((id) => ({ key: { contains: id } })),
        { key: { startsWith: "pin-short:" } },
      ],
    },
  });
  await db.refreshToken.deleteMany({ where: { userId: { in: created } } });
  await db.authSession.deleteMany({ where: { userId: { in: created } } });
  await db.auditLog.deleteMany({
    where: {
      OR: [{ userId: { in: created } }, { entityId: { in: created } }],
    },
  });
  await db.terminal.deleteMany({ where: { id: { in: terminals } } });
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});

describe("S-01 · el bloqueo por contraseñas erróneas no deja a la cajera fuera", () => {
  it("con la IP del borde compartida, cinco claves erróneas de un tercero no impiden entrar a la cajera desde su equipo aprobado", async () => {
    const EDGE_IP = nextIp();
    const cashier = await makeUser("seller");
    const terminal = await approvedTerminal();
    // El atacante, sin la contraseña, prueba cinco claves con su usuario.
    for (let n = 0; n < 5; n++)
      expect(wrong(await login(cashier, EDGE_IP, "incorrecta-" + n))).toBe(
        true,
      );
    // Desde fuera de un equipo aprobado sigue bloqueado: no puede seguir
    // probando (la protección contra fuerza bruta se mantiene).
    expect(blocked(await login(cashier, EDGE_IP, "incorrecta-6"))).toBe(true);
    expect(blocked(await login(cashier, EDGE_IP))).toBe(true);
    // Un secreto de equipo falso no sirve para saltarse el bloqueo.
    expect(
      blocked(
        await login(cashier, EDGE_IP, PASSWORD, {
          id: terminal.id,
          secret: "otro-secreto-cualquiera-0000",
        }),
      ),
    ).toBe(true);
    // Un valor mal formado tampoco, y no rompe el inicio de sesión.
    expect(
      blocked(
        await login(cashier, EDGE_IP, PASSWORD, {
          id: "no-es-un-uuid",
          secret: 42,
        } as any),
      ),
    ).toBe(true);
    // Un equipo pendiente de aprobación tampoco.
    const pending = await approvedTerminal(false);
    expect(blocked(await login(cashier, EDGE_IP, PASSWORD, pending))).toBe(
      true,
    );
    // La cajera, con la misma IP de borde, entra desde su equipo aprobado.
    const ok = await login(cashier, EDGE_IP, PASSWORD, terminal);
    expect(ok.status).toBe(201);
    expect(ok.body.accessToken).toBeTruthy();
  });

  it("el equipo aprobado tiene su propio contador: cinco fallos desde él lo bloquean 15 minutos sin afectar a otro equipo", async () => {
    const EDGE_IP = nextIp();
    const cashier = await makeUser("seller");
    const stolen = await approvedTerminal();
    const other = await approvedTerminal();
    for (let n = 0; n < 5; n++)
      expect(
        wrong(await login(cashier, EDGE_IP, "incorrecta-" + n, stolen)),
      ).toBe(true);
    expect(blocked(await login(cashier, EDGE_IP, PASSWORD, stolen))).toBe(true);
    const row = await db.authAttempt.findUniqueOrThrow({
      where: { key: `login:${cashier.id}:0:terminal:${stolen.id}` },
    });
    expect(row.failedAttempts).toBe(5);
    const left = (+row.lockedUntil - Date.now()) / MINUTE;
    expect(left).toBeGreaterThan(13);
    expect(left).toBeLessThan(17);
    expect((await login(cashier, EDGE_IP, PASSWORD, other)).status).toBe(201);
  });

  it("un atacante no prueba más de 10 contraseñas por hora y cuenta aunque cambie de IP; la cajera sigue entrando desde su equipo", async () => {
    const cashier = await makeUser("seller");
    const terminal = await approvedTerminal();
    const replies: Reply[] = [];
    for (let n = 0; n < 25; n++)
      replies.push(await login(cashier, nextIp(), "incorrecta-" + n));
    // Sólo diez llegan a compararse; el resto se rechaza sin probar la clave.
    expect(replies.filter(wrong)).toHaveLength(10);
    expect(replies.slice(0, 10).every(wrong)).toBe(true);
    expect(replies.slice(10).every(blocked)).toBe(true);
    // Con la contraseña correcta desde un equipo no aprobado también se
    // rechaza: el mensaje explica cómo entrar.
    const fromNewPhone = await login(cashier, nextIp());
    expect(blocked(fromNewPhone)).toBe(true);
    expect(fromNewPhone.body.message).toMatch(/equipo aprobado/);
    // Desde su equipo aprobado entra.
    expect((await login(cashier, nextIp(), PASSWORD, terminal)).status).toBe(
      201,
    );
    // El cupo por cuenta vence a la hora como mucho.
    const budget = await db.authAttempt.findUniqueOrThrow({
      where: { key: `login-account:${cashier.id}:0` },
    });
    const left = (+budget.lockedUntil - Date.now()) / MINUTE;
    expect(left).toBeGreaterThan(50);
    expect(left).toBeLessThanOrEqual(60);
    // Pasada la hora (simulada), la cuenta vuelve a admitir intentos.
    await db.authAttempt.update({
      where: { key: budget.key },
      data: {
        lockedUntil: new Date(Date.now() - MINUTE),
        windowStartedAt: new Date(Date.now() - 61 * MINUTE),
      },
    });
    expect((await login(cashier, nextIp())).status).toBe(201);
  }, 60000);

  it("una cuenta inexistente recibe exactamente las mismas respuestas (sin oráculo de existencia)", async () => {
    const real = await makeUser("seller");
    const ghost = { username: "qa-lock-fantasma-" + randomUUID().slice(0, 8) };
    const sequence = async (user: { username: string }) => {
      const out: string[] = [];
      for (let n = 0; n < 13; n++) {
        const r = await login(user, nextIp(), "incorrecta-" + n);
        out.push(r.status + " " + r.body?.message);
      }
      return out;
    };
    const [a, b] = [await sequence(real), await sequence(ghost)];
    expect(b).toEqual(a);
    expect(a.filter((m) => /incorrectos/.test(m))).toHaveLength(10);
  }, 60000);

  it("un barrido de 60 intentos desde la IP del borde no deja a la cajera con 429 en su equipo aprobado", async () => {
    const EDGE_IP = nextIp();
    const cashier = await makeUser("seller");
    const terminal = await approvedTerminal();
    const statuses: number[] = [];
    for (let n = 0; n < 61; n++)
      statuses.push((await login(cashier, EDGE_IP, "incorrecta-" + n)).status);
    // El freno en memoria sigue actuando sobre esa IP...
    expect(statuses.at(-1)).toBe(429);
    // ...pero el equipo aprobado tiene su propio cupo.
    expect((await login(cashier, EDGE_IP, PASSWORD, terminal)).status).toBe(
      201,
    );
  }, 90000);
});

describe("S-02 · el cupo de identidades inexistentes no deja sin acceso a los equipos de la tienda", () => {
  it("con la IP del borde llena de nombres inventados, una clave errónea desde un equipo aprobado recibe 400 y no 429", async () => {
    const EDGE_IP = nextIp();
    const cashier = await makeUser("seller");
    const terminal = await approvedTerminal();
    for (let n = 0; n < 21; n++)
      await login(
        { username: "qa-lock-barrido-" + randomUUID().slice(0, 8) },
        EDGE_IP,
        "incorrecta",
      );
    // Sin equipo, en esa IP se mantiene el 429 indistinguible de siempre.
    expect((await login(cashier, EDGE_IP, "incorrecta")).status).toBe(429);
    const typo = await login(cashier, EDGE_IP, "incorrecta", terminal);
    expect(typo.status).toBe(400);
    expect(typo.body.message).toMatch(/incorrectos/);
    expect((await login(cashier, EDGE_IP, PASSWORD, terminal)).status).toBe(
      201,
    );
  }, 60000);
});

describe("S-04 · la bitácora guarda la IP de origen", () => {
  it("el inicio de sesión y las acciones autenticadas registran AuditLog.ip", async () => {
    const ip = nextIp();
    const cashier = await makeUser("seller");
    const r = await login(cashier, ip);
    expect(r.status).toBe(201);
    const entry = await db.auditLog.findFirstOrThrow({
      where: { userId: cashier.id, action: "login" },
      orderBy: { createdAt: "desc" },
    });
    expect(entry.ip).toBe(ip);
    // Una acción con sesión: registrar un equipo.
    const id = randomUUID();
    const other = nextIp();
    const reg = await call("/terminals/register", {
      ip: other,
      token: r.body.accessToken,
      body: { id, name: "QA bloqueo IP", secret: "qa-lock-" + randomUUID() },
    });
    terminals.push(id);
    expect(reg.status).toBe(201);
    const registered = await db.auditLog.findFirstOrThrow({
      where: { userId: cashier.id, action: "terminal_registered" },
    });
    expect(registered.ip).toBe(other);
  });
  it("un bloqueo de contraseña queda en la bitácora con su origen", async () => {
    const ip = nextIp();
    const cashier = await makeUser("seller");
    for (let n = 0; n < 5; n++) await login(cashier, ip, "incorrecta-" + n);
    const entry = await db.auditLog.findFirstOrThrow({
      where: { entityId: cashier.id, action: "login_locked" },
    });
    expect(entry.ip).toBe(ip);
    expect(entry.after).toMatchObject({ scope: "ip" });
  });
});

describe("S-06 · /api/health público no detalla el servicio ni la base", () => {
  it("responde sólo el estado", async () => {
    const ip = nextIp();
    for (const path of ["/health", "/health/ready", "/health/live"]) {
      const r = await call(path, { ip });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: "ok" });
    }
  });
});

describe("S-03 · PIN de gerente", () => {
  it("los PIN nuevos o cambiados deben tener 6 dígitos", async () => {
    const admin = await makeUser("admin");
    const ip = nextIp();
    const token = (await login(admin, ip)).body.accessToken;
    const roles = await call("/roles", { ip, token });
    const roleId = roles.body.find((r: any) => r.name === "seller").id;
    const body = (pin: string) => ({
      name: "QA PIN corto",
      username: "qa-lock-pin-" + randomUUID().slice(0, 8),
      password: "Temporal-QA-PIN-2026!",
      pin,
      roleId,
    });
    for (const pin of ["1234", "12345"]) {
      const r = await call("/users", { ip, token, body: body(pin) });
      expect(r.status).toBe(400);
      expect(r.body.message).toMatch(/6 dígitos/);
    }
    const okUser = await call("/users", { ip, token, body: body("135790") });
    expect(okUser.status).toBe(201);
    created.push(okUser.body.id);
    const edit = (pin: string) =>
      call("/users/" + okUser.body.id, {
        ip,
        token,
        body: { pin },
        method: "PATCH",
      });
    expect((await edit("4321")).status).toBe(400);
    expect((await edit("975310")).status).toBe(200);
  });

  // Un gerente con un PIN antiguo de 4 dígitos sigue aprobando. N-6: los
  // fallos de una cajera no bloquean los PIN cortos de la sucursal (el cupo es
  // por solicitante); sólo un tope de respaldo mayor lo hace.
  it("un PIN antiguo de 4 dígitos sigue funcionando y queda señalado; los fallos de una cajera no bloquean a las demás", async () => {
    await db.authAttempt.deleteMany({ where: { key: "pin-short:main" } });
    const manager = await makeUser("manager", "4321");
    const strong = await makeUser("manager", "802461");
    const pendingSession = async () => {
      const seller = await makeUser("seller");
      const ip = nextIp();
      const token = (await login(seller, ip)).body.accessToken;
      const id = randomUUID();
      terminals.push(id);
      const reg = await call("/terminals/register", {
        ip,
        token,
        body: { id, name: "QA PIN corto", secret: "qa-lock-" + randomUUID() },
      });
      expect(reg.body.status).toBe("pending");
      return {
        seller,
        approve: (managerPin: string) =>
          call(`/terminals/${id}/approve-with-pin`, {
            ip,
            token,
            body: { managerPin },
          }),
      };
    };
    try {
      // El PIN corto correcto aprueba y la aprobación queda señalada.
      const first = await pendingSession();
      expect((await first.approve("4321")).status).toBe(201);
      const flagged = await db.auditLog.findFirstOrThrow({
        where: { action: "pin_short_used", entityId: manager.id },
      });
      expect(flagged.userId).toBe(first.seller.id);
      // Tres cajeras distintas prueban PIN de 4 dígitos (4 + 4 + 2 = 10). Con
      // el cupo de toda la sucursal en 10 (antes) la siguiente cajera quedaba
      // sin poder aprobar con el PIN corto del gerente (N-6).
      const sessions = [
        await pendingSession(),
        await pendingSession(),
        await pendingSession(),
      ];
      let guess = 0;
      const nextGuess = () => String(1000 + guess++);
      for (const [index, tries] of [4, 4, 2].entries())
        for (let n = 0; n < tries; n++) {
          const r = await sessions[index].approve(nextGuess());
          expect(r.status).toBe(400);
          expect(r.body.message).toMatch(/PIN incorrecto/);
        }
      const fourth = await pendingSession();
      expect((await fourth.approve("4321")).status).toBe(201);
      // El tope de respaldo de la sucursal (30 por hora) sigue existiendo:
      // agotado, rechaza el PIN corto, incluso el correcto...
      await db.authAttempt.upsert({
        where: { key: "pin-short:main" },
        create: {
          key: "pin-short:main",
          failedAttempts: 30,
          windowStartedAt: new Date(),
          lockedUntil: new Date(Date.now() + 30 * MINUTE),
        },
        update: {
          failedAttempts: 30,
          windowStartedAt: new Date(),
          lockedUntil: new Date(Date.now() + 30 * MINUTE),
        },
      });
      const fifth = await pendingSession();
      const shortBlocked = await fifth.approve("4321");
      expect(shortBlocked.status).toBe(400);
      expect(shortBlocked.body.message).toMatch(/6 dígitos/);
      // ...pero un PIN de 6 dígitos sigue aprobando.
      expect((await fifth.approve("802461")).status).toBe(201);
    } finally {
      await db.authAttempt.deleteMany({ where: { key: "pin-short:main" } });
      await db.user.update({
        where: { id: manager.id },
        data: { active: false },
      });
      await db.user.update({
        where: { id: strong.id },
        data: { active: false },
      });
    }
  }, 120000);

  it("un solicitante no prueba más de 10 PIN por hora aunque espere a que venza el bloqueo de 15 minutos", async () => {
    const actor = await makeUser("seller");
    const target = await makeUser("seller", "654321");
    const ip = nextIp();
    const token = (await login(actor, ip)).body.accessToken;
    const pin = (value: string) =>
      call("/auth/pin", { ip, token, body: { userId: target.id, pin: value } });
    const expireSwitch = () =>
      db.authAttempt.update({
        where: { key: "switch:" + actor.id },
        data: { lockedUntil: new Date(Date.now() - MINUTE) },
      });
    for (let round = 0; round < 2; round++) {
      for (let n = 0; n < 5; n++)
        expect((await pin("00000" + n)).body.message).toMatch(/PIN incorrecto/);
      await expireSwitch();
    }
    // Once intentos en menos de una hora: el cupo del solicitante se agotó,
    // también para el PIN correcto.
    const eleventh = await pin("654321");
    expect(eleventh.status).toBe(400);
    expect(eleventh.body.message).toMatch(/bloquead/i);
    const lock = await db.auditLog.findFirst({
      where: { userId: actor.id, action: "pin_locked" },
    });
    expect(lock).toBeTruthy();
  }, 60000);
});

describe("S-04 · retención de la IP y purga de contadores", () => {
  it("borra la IP de la bitácora a los 90 días y los contadores viejos sin bloqueo vigente", async () => {
    const { SecurityMaintenance } = await import("../apps/api/src/security");
    const owner = await makeUser("seller");
    const day = 24 * 60 * MINUTE;
    const ago = (days: number) => new Date(Date.now() - days * day);
    const [oldEntry, recentEntry] = await Promise.all(
      [100, 10].map((days) =>
        db.auditLog.create({
          data: {
            userId: owner.id,
            action: "qa_retencion",
            entity: "user",
            entityId: owner.id,
            ip: "198.51.100.200",
            createdAt: ago(days),
          },
        }),
      ),
    );
    const key = (name: string) => `login:${owner.id}:0:qa-${name}`;
    await db.authAttempt.createMany({
      data: [
        // Primer fallo hace dos días y sin bloqueo: se purga.
        { key: key("viejo"), failedAttempts: 3, windowStartedAt: ago(2) },
        // Viejo pero todavía bloqueado: se conserva.
        {
          key: key("bloqueado"),
          failedAttempts: 10,
          windowStartedAt: ago(2),
          lockedUntil: new Date(Date.now() + 10 * MINUTE),
        },
        // Reciente: se conserva.
        { key: key("reciente"), failedAttempts: 2, windowStartedAt: ago(0.1) },
      ],
    });
    await new SecurityMaintenance(db).run();
    expect(
      (await db.auditLog.findUniqueOrThrow({ where: { id: oldEntry.id } })).ip,
    ).toBeNull();
    expect(
      (await db.auditLog.findUniqueOrThrow({ where: { id: recentEntry.id } }))
        .ip,
    ).toBe("198.51.100.200");
    const left = await db.authAttempt.findMany({
      where: { key: { startsWith: `login:${owner.id}:0:qa-` } },
    });
    expect(left.map((row: any) => row.key).sort()).toEqual(
      [key("bloqueado"), key("reciente")].sort(),
    );
  });
});
