// T5 · contratos adversarios GV. Deben fallar mientras el defecto exista.
// Todo el entorno es propio: PostgreSQL efímero, API compilada local y usuarios
// sintéticos. No acepta DATABASE_URL/FITSTORE_API_URL externos ni lee .env.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawn, execFile, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { mkdtemp, rm, access, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";

const root = fileURLToPath(new URL("..", import.meta.url));
const apiDir = join(root, "apps/api");
const requireApi = createRequire(join(apiDir, "package.json"));
const run = promisify(execFile);
const nonce = randomUUID();
const password = "QA-" + randomBytes(24).toString("hex") + "!";
let dir = "",
  base = "",
  admin = "",
  gv = "";
let database: EmbeddedPostgres | undefined;
let api: ChildProcess | undefined;
let db: any;
let apiLog = "";
let sandboxEnv: NodeJS.ProcessEnv;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
async function request(
  path: string,
  token: string,
  body?: unknown,
  method?: string,
) {
  const response = await fetch(base + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(12000),
  });
  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data };
}
async function ok(
  path: string,
  token: string,
  body?: unknown,
  method?: string,
) {
  const result = await request(path, token, body, method);
  expect(
    result.status,
    `${method ?? "request"} ${path}: ${JSON.stringify(result.data)}`,
  ).toBeLessThan(300);
  return result.data;
}
const rejected = (result: { status: number; data: unknown }) =>
  expect([400, 403, 409], JSON.stringify(result)).toContain(result.status);

beforeAll(async () => {
  // main.ts carga .env automáticamente: no ejecutar si un checkout tiene uno.
  for (const path of [join(root, ".env"), join(apiDir, ".env")]) {
    const exists = await access(path).then(
      () => true,
      () => false,
    );
    if (exists) throw new Error("Usa un worktree de pruebas sin .env: " + path);
  }
  const dbPort = await freePort(),
    apiPort = await freePort();
  dir = await mkdtemp(join(tmpdir(), "gv-adversarial-"));
  database = new EmbeddedPostgres({
    databaseDir: join(dir, "postgres"),
    user: "gv_qa",
    password,
    port: dbPort,
    persistent: false,
    authMethod: "scram-sha-256",
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    initdbFlags: ["--encoding=UTF8"],
    onLog: () => {},
    onError: () => {},
  });
  await database.initialise();
  await database.start();
  await database.createDatabase("gv_adversarial");
  const url = `postgresql://gv_qa:${encodeURIComponent(password)}@127.0.0.1:${dbPort}/gv_adversarial`;
  // Lista permitida: no heredar credenciales o destinos de integraciones.
  const env = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
    DATABASE_URL: url,
    JWT_SECRET: randomBytes(48).toString("hex"),
    SEED_DEMO_PASSWORD: password,
    NODE_ENV: "test",
    PORT: String(apiPort),
    WEB_ORIGIN: "http://127.0.0.1:1",
  };
  sandboxEnv = { ...env, FITSTORE_API_URL: `http://127.0.0.1:${apiPort}/api` };
  await run(
    process.execPath,
    [requireApi.resolve("prisma/build/index.js"), "migrate", "deploy"],
    { cwd: apiDir, env, maxBuffer: 8e6 },
  );
  await run(
    process.execPath,
    [requireApi.resolve("tsx/cli"), "prisma/seed.ts"],
    { cwd: apiDir, env, maxBuffer: 8e6 },
  );
  const { PrismaClient } = requireApi("@prisma/client");
  db = new PrismaClient({ datasourceUrl: url });
  api = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [api.stdout, api.stderr])
    stream?.on("data", (chunk) => {
      apiLog = (apiLog + String(chunk)).slice(-20000);
    });
  base = `http://127.0.0.1:${apiPort}/api`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (api.exitCode !== null)
      throw new Error("La API de pruebas terminó antes de arrancar.");
    try {
      ready = (
        await fetch(base + "/health", { signal: AbortSignal.timeout(500) })
      ).ok;
    } catch {
      /* todavía arrancando */
    }
    if (ready) break;
    await sleep(100);
  }
  expect(ready, "La API compilada debe arrancar en su puerto nuevo").toBe(true);
  const auth = await ok("/auth/login", "", {
    email: "admin@fitstore.demo",
    password,
  });
  admin = auth.accessToken;
  // Comprobar que la sesión de la API pertenece exactamente a nuestra base.
  expect(await db.authSession.count()).toBeGreaterThan(0);
  const { hash } = requireApi("bcryptjs");
  const role = await db.role.findUniqueOrThrow({ where: { name: "gv" } });
  expect([...role.permissions].sort()).toEqual([
    "gv:read",
    "gv:reports",
    "gv:write",
  ]);
  const email = `gv-adversarial-${nonce}@example.test`;
  await db.user.create({
    data: {
      name: "Prueba GV",
      email,
      roleId: role.id,
      branchId: "main",
      passwordHash: await hash(password, 10),
      pinHash: await hash(randomBytes(6).toString("hex"), 10),
    },
  });
  gv = (await ok("/auth/login", "", { email, password })).accessToken;
});

afterAll(async () => {
  let verificationError: unknown;
  try {
    if (process.env.GV_VERIFY_EXISTING === "1" && gv) {
      const config = join(dir, "existing.config.mjs");
      await writeFile(
        config,
        "export default " +
          JSON.stringify({
            root,
            test: {
              include: [
                "tests/gv-unit.test.ts",
                "tests/gv-modulo-api.test.ts",
                "tests/gv-citas-api.test.ts",
              ],
              fileParallelism: false,
              testTimeout: 30000,
              hookTimeout: 120000,
            },
          }),
      );
      const official = await run(
        "pnpm",
        ["exec", "vitest", "run", "--config", config],
        {
          cwd: root,
          env: sandboxEnv,
          maxBuffer: 8e6,
        },
      ).then(
        (r) => ({ code: 0, output: r.stdout + r.stderr }),
        (e) => ({ code: e.code, output: (e.stdout ?? "") + (e.stderr ?? "") }),
      );
      const log = join(tmpdir(), "gv-existing-" + nonce + ".log");
      await writeFile(log, official.output, { mode: 0o600 });
      console.log("GV existentes: salida", official.code, "registro", log);
      console.log(
        official.output
          .split("\n")
          .filter((line: string) => /Test Files|Tests |Duration/.test(line))
          .join("\n"),
      );
      if (official.code !== 0)
        throw new Error("Las suites GV existentes fallaron; revisa " + log);
    }
  } catch (cause) {
    verificationError = cause;
  } finally {
    if (api && api.exitCode === null) {
      api.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => api!.once("exit", resolve)),
        sleep(5000),
      ]);
      if (api.exitCode === null) api.kill("SIGKILL");
    }
    try {
      await db?.$disconnect();
    } finally {
      await database?.stop();
      if (dir) await rm(dir, { recursive: true, force: true });
    }
    // No volcar tokens o errores SQL que puedan contener las credenciales efímeras.
    apiLog = "";
  }
  if (verificationError) throw verificationError;
});

type Kind = "inscripción" | "cita";
async function entity(kind: Kind, status?: string) {
  if (kind === "cita")
    return ok("/gv/appointments", gv, {
      operationId: randomUUID(),
      date: "2026-11-08T10:00:00-04:00",
      clientName: "QA cita",
      service: "glam",
      artists: ["Génesis"],
      total: 100,
      ...(status ? { status } : {}),
    });
  const course = await ok("/gv/courses", gv, {
    name: "QA curso",
    type: "automaquillaje",
    date: "2026-11-08",
    price: 100,
    capacity: 10,
  });
  return ok("/gv/enrollments", gv, {
    operationId: randomUUID(),
    courseId: course.id,
    clientName: "QA inscripción",
    agreedPrice: 100,
    ...(status ? { status } : {}),
  });
}
async function pay(
  kind: Kind,
  id: string,
  extra: Record<string, unknown> = {},
) {
  return request(
    kind === "cita" ? `/gv/appointments/${id}/payments` : "/gv/payments",
    gv,
    {
      operationId: randomUUID(),
      ...(kind === "inscripción" ? { enrollmentId: id } : {}),
      date: "2026-10-26",
      amount: 10,
      concept: "separo",
      method: "efectivo",
      ...extra,
    },
  );
}
const ownerWhere = (kind: Kind, id: string) =>
  kind === "cita" ? { appointmentId: id } : { enrollmentId: id };

for (const kind of ["inscripción", "cita"] as const)
  describe(`GV adversario · ${kind}`, () => {
    it("GV-09 · rechaza sobrepago secuencial sin guardar el exceso", async () => {
      const owner = await entity(kind);
      expect((await pay(kind, owner.id, { amount: 80 })).status).toBeLessThan(
        300,
      );
      const extra = await pay(kind, owner.id, { amount: 21 });
      rejected(extra);
      const rows = await db.gvPayment.findMany({
        where: ownerWhere(kind, owner.id),
      });
      expect(rows).toHaveLength(1);
      expect(Number(rows[0].amount)).toBe(80);
    });
    it("GV-09 · dos cobros concurrentes no exceden el saldo", async () => {
      const owner = await entity(kind);
      const results = await Promise.all([
        pay(kind, owner.id, { amount: 80 }),
        pay(kind, owner.id, { amount: 80 }),
      ]);
      expect(results.filter((r) => r.status < 300)).toHaveLength(1);
      rejected(results.find((r) => r.status >= 300)!);
      const sum = await db.gvPayment.aggregate({
        where: ownerWhere(kind, owner.id),
        _sum: { amount: true },
      });
      expect(Number(sum._sum.amount)).toBe(80);
    });
    it("doble clic concurrente devuelve el mismo pago, sin error interno", async () => {
      const owner = await entity(kind),
        operationId = randomUUID();
      const results = await Promise.all([
        pay(kind, owner.id, { operationId }),
        pay(kind, owner.id, { operationId }),
      ]);
      for (const result of results)
        expect(result.status, JSON.stringify(result.data)).toBeLessThan(300);
      expect(new Set(results.map((r) => r.data.id)).size).toBe(1);
      expect(await db.gvPayment.count({ where: { operationId } })).toBe(1);
    });
    it("GV-05 · la registradora no aprueba su propia transferencia", async () => {
      const owner = await entity(kind);
      const transfer = await pay(kind, owner.id, {
        method: "transferencia",
        bank: "Banco QA",
        reference: randomUUID(),
      });
      expect(transfer.status).toBeLessThan(300);
      const review = await request(
        `/gv/payments/${transfer.data.id}/review`,
        gv,
        { verified: true },
      );
      expect(review.status).toBe(403);
      expect(
        (
          await db.gvPayment.findUniqueOrThrow({
            where: { id: transfer.data.id },
          })
        ).verified,
      ).toBe(false);
    });
    for (const status of ["cancelada", "reembolsada"])
      it(`GV-13 · no cobra en estado ${status}`, async () => {
        const owner = await entity(kind);
        if (status === "reembolsada")
          expect(
            (await pay(kind, owner.id, { amount: 40 })).status,
          ).toBeLessThan(300);
        const path =
          kind === "cita"
            ? `/gv/appointments/${owner.id}`
            : `/gv/enrollments/${owner.id}`;
        await ok(
          path,
          gv,
          {
            status,
            ...(status === "reembolsada"
              ? { refundAmount: 40, refundDate: "2026-10-26" }
              : {}),
          },
          "PATCH",
        );
        const before = await db.gvPayment.count({
          where: ownerWhere(kind, owner.id),
        });
        rejected(await pay(kind, owner.id));
        expect(
          await db.gvPayment.count({ where: ownerWhere(kind, owner.id) }),
        ).toBe(before);
      });
    for (const date of ["2026-02-30", "2026-13-01"])
      it(`fecha ${date} devuelve validación 400, no 500 ni escritura`, async () => {
        const owner = await entity(kind);
        expect((await pay(kind, owner.id, { date })).status).toBe(400);
        expect(
          await db.gvPayment.count({ where: ownerWhere(kind, owner.id) }),
        ).toBe(0);
      });
    it("no redondea silenciosamente un monto con tres decimales", async () => {
      const owner = await entity(kind);
      expect((await pay(kind, owner.id, { amount: 10.001 })).status).toBe(400);
      expect(
        await db.gvPayment.count({ where: ownerWhere(kind, owner.id) }),
      ).toBe(0);
    });
  });

function imported(
  kind: Kind,
  prefix = randomUUID(),
  paymentKey?: string,
  amount = 40,
) {
  const payment = {
    key: paymentKey ?? prefix + "-p",
    amount,
    date: "2026-10-26",
    concept: "separo",
    method: "transferencia",
    bank: "Banco QA",
    reference: prefix,
    verified: true,
  };
  return kind === "cita"
    ? {
        appointments: [
          {
            key: prefix + "-a",
            clientName: "QA importada",
            date: "2026-11-08T10:00:00-04:00",
            service: "glam",
            total: 100,
            payments: [payment],
          },
        ],
      }
    : {
        courses: [
          {
            key: prefix + "-c",
            name: "QA importado",
            date: "2026-11-08",
            type: "automaquillaje",
            price: 100,
            capacity: 10,
          },
        ],
        enrollments: [
          {
            key: prefix + "-e",
            courseKey: prefix + "-c",
            clientName: "QA importada",
            agreedPrice: 100,
            payments: [payment],
          },
        ],
      };
}
for (const kind of ["inscripción", "cita"] as const)
  describe(`GV importación adversaria · ${kind}`, () => {
    it("repetición exacta conserva el pago y no duplica filas", async () => {
      const key = randomUUID(),
        payload = imported(kind, randomUUID(), key);
      await ok("/gv/import", admin, payload);
      const first = await db.gvPayment.findFirstOrThrow({
        where: { externalId: key },
      });
      await ok("/gv/import", admin, payload);
      const rows = await db.gvPayment.findMany({ where: { externalId: key } });
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(first.id);
      expect(String(rows[0].amount)).toBe(String(first.amount));
      expect(rows[0].verified).toBe(first.verified);
    });
    it("GV-11 · una clave reutilizada no mueve dinero entre clientas", async () => {
      const key = randomUUID();
      await ok("/gv/import", admin, imported(kind, randomUUID(), key));
      const first = await db.gvPayment.findFirstOrThrow({
        where: { externalId: key },
      });
      rejected(
        await request("/gv/import", admin, imported(kind, randomUUID(), key)),
      );
      const after = await db.gvPayment.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(after.enrollmentId).toBe(first.enrollmentId);
      expect(after.appointmentId).toBe(first.appointmentId);
    });
    it("GV-12 · no aumenta un pago verificado sin nueva operación auditada", async () => {
      const key = randomUUID(),
        prefix = randomUUID();
      await ok("/gv/import", admin, imported(kind, prefix, key));
      rejected(
        await request("/gv/import", admin, imported(kind, prefix, key, 90)),
      );
      const payment = await db.gvPayment.findFirstOrThrow({
        where: { externalId: key },
      });
      expect(Number(payment.amount)).toBe(40);
      expect(payment.verified).toBe(true);
    });
    it("GV-09 residual · omitir pagos no permite reducir el total bajo lo cobrado", async () => {
      const prefix = randomUUID(),
        key = randomUUID();
      const payload: any = imported(kind, prefix, key, 80);
      await ok("/gv/import", admin, payload);
      const rows = kind === "cita" ? payload.appointments : payload.enrollments;
      rows[0].payments = [];
      rows[0][kind === "cita" ? "total" : "agreedPrice"] = 10;
      const response = await request("/gv/import", admin, payload);
      expect
        .soft([400, 403, 409], JSON.stringify(response))
        .toContain(response.status);
      const payment = await db.gvPayment.findFirstOrThrow({
        where: { externalId: key },
      });
      const owner =
        kind === "cita"
          ? await db.gvAppointment.findUniqueOrThrow({
              where: { id: payment.appointmentId },
            })
          : await db.gvEnrollment.findUniqueOrThrow({
              where: { id: payment.enrollmentId },
            });
      expect(Number(kind === "cita" ? owner.total : owner.agreedPrice)).toBe(
        100,
      );
    });
    it("GV-13 residual · reimportar no borra un reembolso definitivo", async () => {
      const prefix = randomUUID(),
        key = randomUUID();
      const payload: any = imported(kind, prefix, key, 40);
      await ok("/gv/import", admin, payload);
      const payment = await db.gvPayment.findFirstOrThrow({
        where: { externalId: key },
      });
      const id = kind === "cita" ? payment.appointmentId : payment.enrollmentId;
      const path =
        kind === "cita" ? `/gv/appointments/${id}` : `/gv/enrollments/${id}`;
      await ok(
        path,
        gv,
        { status: "reembolsada", refundAmount: 40, refundDate: "2026-10-26" },
        "PATCH",
      );
      const rows = kind === "cita" ? payload.appointments : payload.enrollments;
      rows[0].status = kind === "cita" ? "agendada" : "activa";
      rows[0].refundAmount = null;
      rows[0].refundDate = null;
      const response = await request("/gv/import", admin, payload);
      expect
        .soft([400, 403, 409], JSON.stringify(response))
        .toContain(response.status);
      const owner =
        kind === "cita"
          ? await db.gvAppointment.findUniqueOrThrow({ where: { id } })
          : await db.gvEnrollment.findUniqueOrThrow({ where: { id } });
      expect.soft(owner.status).toBe("reembolsada");
      expect.soft(Number(owner.refundAmount)).toBe(40);
    });
    it("GV-10 · exige identidad estable de cada pago, no su posición", async () => {
      const payload: any = imported(kind);
      const rows = kind === "cita" ? payload.appointments : payload.enrollments;
      delete rows[0].payments[0].key;
      rejected(await request("/gv/import", admin, payload));
    });
  });

describe("GV · aislamiento de rutas Macgen", () => {
  it.each([
    "/products",
    "/settings",
    "/users",
    "/roles",
    "/dashboard/summary",
    "/reports/sales",
    "/sales",
    "/customers",
    "/inventory/stock",
    "/payments/pending-transfers",
    "/audit-log",
  ])("niega %s al rol GV", async (path) => {
    expect((await request(path, gv)).status).toBe(403);
  });
});

it("GV-12 · reimportar no altera una transferencia verificada durante su planificación", async () => {
  const key = randomUUID();
  const payload: any = imported("inscripción", randomUUID(), key, 40);
  payload.enrollments[0].payments[0].verified = false;
  await ok("/gv/import", admin, payload);
  const payment = await db.gvPayment.findFirstOrThrow({
    where: { externalId: key },
  });
  payload.enrollments[0].payments[0].amount = 80;
  delete payload.enrollments[0].payments[0].verified;
  let release!: () => void;
  let started!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  // Barrera solo en la base descartable: permite el SELECT del plan y detiene
  // su posterior UPDATE del propietario, sin modificar código ni triggers.
  const lock = db.$transaction(
    async (tx: any) => {
      await tx.$queryRawUnsafe(
        'SELECT id FROM "GvEnrollment" WHERE id = $1::uuid FOR UPDATE',
        payment.enrollmentId,
      );
      started();
      await gate;
    },
    { timeout: 15000 },
  );
  let pending: ReturnType<typeof request> | undefined;
  try {
    await Promise.race([
      ready,
      lock.then(() => {
        throw new Error("La barrera terminó antes de iniciar");
      }),
    ]);
    pending = request("/gv/import", admin, payload);
    let waiting = false;
    for (let i = 0; i < 50; i++) {
      const rows = await db.$queryRawUnsafe(
        `SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock' AND query ILIKE '%GvEnrollment%'`,
      );
      if (rows[0].n > 0) {
        waiting = true;
        break;
      }
      await sleep(50);
    }
    expect(
      waiting,
      "La importación debe llegar al UPDATE bloqueado después de planificar",
    ).toBe(true);
    await ok(`/gv/payments/${payment.id}/review`, admin, { verified: true });
    release();
    await lock;
    const result = await pending;
    expect.soft([400, 409], JSON.stringify(result)).toContain(result.status);
    const after = await db.gvPayment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect.soft(after.verified).toBe(true);
    expect.soft(Number(after.amount)).toBe(40);
  } finally {
    release();
    await lock;
    if (pending) await pending;
  }
});
