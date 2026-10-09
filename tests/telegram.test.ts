// Avisos de facturas por Telegram, de punta a punta: dos APIs compiladas
// propias (node dist/main.js) sobre la base de las pruebas, una con las
// variables de Telegram apuntando a un Telegram falso local y otra sin ellas.
// El renderizado puro está en tests/telegram-render.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  createServer as createHttpServer,
  type ServerResponse,
} from "node:http";
import { createServer as createNetServer } from "node:net";
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

// Datos que jamás deben salir hacia Telegram.
const TOKEN = "987654321:AAQA-fake-telegram-token_only_for_tests";
const CHAT = "-1009876543210";
const CEDULA = "40212345678";
const PHONE = "8095550199";
const EMAIL = "cliente.qa.telegram@example.com";
const suffix = Date.now().toString(36);
const ip = "198.18.0." + ((Date.now() % 250) + 1);

// --- Telegram falso -------------------------------------------------------
type Received = { path: string; body: any; at: number };
const received: Received[] = [];
// Respuesta para cada petición: "ok", "500", "429:<segundos>" o "hang"
// (nunca responde: la API debe cortar a los 8 s).
let mode: string = "ok";
const once: string[] = [];
const hung: ServerResponse[] = [];
const fake = createHttpServer((req, res) => {
  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    let body: any = null;
    try {
      body = JSON.parse(raw);
    } catch {
      /* cuerpo inválido */
    }
    received.push({ path: req.url ?? "", body, at: Date.now() });
    const answer = once.shift() ?? mode;
    const send = (status: number, payload: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (answer === "hang") hung.push(res);
    else if (answer === "500")
      send(500, { ok: false, error_code: 500, description: "Internal error" });
    else if (answer.startsWith("429:"))
      send(429, {
        ok: false,
        error_code: 429,
        description: "Too Many Requests: retry after " + answer.slice(4),
        parameters: { retry_after: Number(answer.slice(4)) },
      });
    else send(200, { ok: true, result: { message_id: received.length } });
  });
});

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });

// --- APIs propias ---------------------------------------------------------
async function startApi(env: Record<string, string | undefined>) {
  const port = await freePort();
  const childEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries({
    ...process.env,
    ...env,
    PORT: String(port),
  }))
    if (v !== undefined) childEnv[k] = v;
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: fileURLToPath(new URL("../apps/api", import.meta.url)),
    env: childEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "",
    running = true;
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (c: string) => (output = (output + c).slice(-20000)));
  }
  const exited = new Promise<void>((resolve) =>
    child.once("exit", () => {
      running = false;
      resolve();
    }),
  );
  const reap = () => child.kill();
  process.once("exit", reap);
  const stop = async () => {
    process.off("exit", reap);
    if (running) child.kill();
    const forced = setTimeout(() => running && child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(forced);
  };
  const base = `http://127.0.0.1:${port}/api`;
  const deadline = Date.now() + 40000;
  for (;;) {
    if (!running) throw new Error("La API terminó al arrancar: " + output);
    try {
      if (
        (await fetch(base + "/health", { signal: AbortSignal.timeout(1000) }))
          .ok
      )
        break;
    } catch {
      /* todavía no escucha */
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error("La API no respondió: " + output);
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { base, stop, output: () => output, pid: child.pid };
}

let withTg: Awaited<ReturnType<typeof startApi>>;
let withoutTg: Awaited<ReturnType<typeof startApi>>;
let token = "";
let customerId = "";
let variantId = "";
let cash: any;
let productId = "";
let settingsBefore: any;
const saleIds: string[] = [];

async function request(base: string, path: string, data?: unknown, as = token) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
async function ok(base: string, path: string, data?: unknown, as = token) {
  const r = await request(base, path, data, as);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function put(base: string, path: string, data: unknown) {
  const r = await fetch(base + path, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      Authorization: "Bearer " + token,
    },
    body: JSON.stringify(data),
  });
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + (await r.text()));
  return r.json();
}
const saleBody = (total: number, payments: any[], extra: object = {}) => ({
  offlineUuid: randomUUID(),
  customerId,
  cashSessionId: cash.id,
  items: [{ variantId, qty: 1 }],
  payments,
  expectedTotal: total,
  ...extra,
});
async function sell(payments: any[], extra: object = {}, base = withTg.base) {
  const s = await ok(base, "/sales", saleBody(100, payments, extra));
  saleIds.push(s.id);
  return s;
}
const texts = () => received.map((r) => String(r.body?.text ?? ""));
const messagesFor = (needle: string, title?: string) =>
  texts().filter(
    (t) => t.includes(needle) && (!title || t.split("\n")[0].includes(title)),
  );
async function waitFor<T>(
  check: () => T | Promise<T>,
  label: string,
  timeout = 30000,
) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() > deadline)
      throw new Error(
        "Tiempo agotado esperando: " +
          label +
          "\nRecibidos:\n" +
          texts().join("\n---\n"),
      );
    await new Promise((r) => setTimeout(r, 200));
  }
}
const outbox = (refId: string) =>
  db.notificationOutbox.findMany({ where: { refId } });
// Simula que ya pasó la espera del reintento (30 s, 1 min…).
const fastForward = (refId: string) =>
  db.$executeRawUnsafe(
    `UPDATE "NotificationOutbox" SET "nextAttemptAt" = timezone('UTC', now()) WHERE "refId" = $1 AND status = 'pending'`,
    refId,
  );

beforeAll(async () => {
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
  const fakePort = (fake.address() as { port: number }).port;
  [withTg, withoutTg] = await Promise.all([
    startApi({
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: CHAT,
      TELEGRAM_API_BASE: `http://127.0.0.1:${fakePort}`,
    }),
    startApi({
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined,
      TELEGRAM_API_BASE: undefined,
    }),
  ]);
  token = (
    await ok(withTg.base, "/auth/login", {
      email: "admin@fitstore.demo",
      password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    })
  ).accessToken;
  const terminal = randomUUID();
  const t = await ok(withTg.base, "/terminals/register", {
    id: terminal,
    name: "QA Telegram " + suffix,
    secret: "qa-secret-" + terminal,
  });
  if (t.status === "pending")
    await ok(withTg.base, "/terminals/" + terminal + "/approve", {});
  settingsBefore = await ok(withTg.base, "/settings");
  await put(withTg.base, "/settings", {
    ...settingsBefore,
    allowCreditSales: true,
    allowOfflineSales: true,
  });
  customerId = (
    await ok(withTg.base, "/customers", {
      name: "Cliente QA Telegram " + suffix,
      legalId: CEDULA,
      phone: PHONE,
      email: EMAIL,
      creditLimit: 100000,
    })
  ).id;
  const categoryId = (await ok(withTg.base, "/categories")).find(
    (c: any) => c.name === "Ropa deportiva",
  ).id;
  const tag = randomUUID().slice(0, 8);
  const product = await ok(withTg.base, "/products", {
    name: "Camiseta QA Telegram " + suffix,
    sku: "QATG-" + tag,
    categoryId,
    variants: [
      {
        sku: "QATG-V-" + tag,
        barcode: "QATG-B-" + tag,
        price: 100,
        costAvg: 40,
      },
    ],
  });
  productId = product.id;
  variantId = product.variants[0].id;
  await ok(withTg.base, "/inventory/adjustments", {
    variantId,
    qty: 200,
    reason: "QA apertura Telegram",
  });
  cash = await ok(withTg.base, "/cash-sessions/open", {
    registerId: "qa-telegram-" + suffix,
    openingAmount: 0,
  });
}, 120000);

afterAll(async () => {
  for (const res of hung.splice(0)) res.destroy();
  try {
    if (cash) {
      const current = (await ok(withTg.base, "/cash-sessions")).find(
        (s: any) => s.id === cash.id,
      );
      if (current && !current.closedAt)
        await ok(withTg.base, "/cash-sessions/" + cash.id + "/close", {
          countedCash: Math.max(0, current.expected?.cash ?? 0),
          countedCard: Math.max(0, current.expected?.card ?? 0),
          countedTransfer: Math.max(0, current.expected?.transfer ?? 0),
          notes: "Cierre de pruebas Telegram",
        });
    }
    if (settingsBefore) await put(withTg.base, "/settings", settingsBefore);
  } finally {
    await Promise.all([withTg?.stop(), withoutTg?.stop()]);
    await new Promise((r) => fake.close(r));
    await db.$disconnect();
  }
}, 60000);

describe("Telegram · avisos de facturas", () => {
  it("efectivo, crédito, contraentrega, anulada, devolución y cobro: exactamente un mensaje cada uno", async () => {
    mode = "ok";
    const cashSale = await sell([{ method: "cash", amount: 100 }]);
    const creditSale = await sell([{ method: "credit", amount: 100 }], {
      creditDueDate: "2030-01-01T12:00:00.000Z",
    });
    const codSale = await sell([{ method: "cod", amount: 100 }]);
    const returned = await ok(withTg.base, "/sales", {
      ...saleBody(200, [
        { method: "card", amount: 200, cardLast4: "4242", approvalCode: "A1" },
      ]),
      items: [{ variantId, qty: 2 }],
    });
    saleIds.push(returned.id);
    await ok(withTg.base, "/sales/" + cashSale.id + "/void", {
      reason: "Cliente se arrepintió",
    });
    const ret = await ok(withTg.base, "/returns", {
      operationId: randomUUID(),
      saleId: returned.id,
      cashSessionId: cash.id,
      reason: "Talla incorrecta",
      // Reembolso por el medio del pago original.
      refundMethod: "card",
      items: [{ saleItemId: returned.items[0].id, qty: 1, restock: true }],
    });
    const collection = await ok(
      withTg.base,
      "/sales/" + codSale.id + "/cod-collections",
      {
        offlineUuid: randomUUID(),
        cashSessionId: cash.id,
        amount: 100,
        method: "cash",
      },
    );
    const expected: [string, string][] = [
      [cashSale.number, "Venta cobrada"],
      [creditSale.number, "A CRÉDITO"],
      [codSale.number, "CONTRAENTREGA — POR COBRAR"],
      [returned.number, "Venta cobrada"],
      [cashSale.number, "Venta ANULADA"],
      [returned.number, "Devolución"],
      [codSale.number, "Cobro de contraentrega"],
    ];
    await waitFor(
      () => expected.every(([n, title]) => messagesFor(n, title).length > 0),
      "los 7 avisos",
      60000,
    );
    // Una vuelta más del trabajador: nada se repite.
    await new Promise((r) => setTimeout(r, 6000));
    for (const [n, title] of expected)
      expect(messagesFor(n, title), n + " " + title).toHaveLength(1);
    expect(messagesFor("Factura " + cashSale.number)).toHaveLength(2);
    const anulada = messagesFor(cashSale.number, "ANULADA")[0];
    expect(anulada).toContain("Motivo: Cliente se arrepintió");
    expect(anulada).toContain("por: ");
    const devolucion = messagesFor(returned.number, "Devolución")[0];
    expect(devolucion).toContain(ret.number);
    expect(devolucion).toContain("Reembolso: Tarjeta RD$ 100.00");
    const cobro = messagesFor(codSale.number, "Cobro de contraentrega")[0];
    expect(cobro).toContain("Forma de pago: Efectivo RD$ 100.00");
    expect(cobro).toContain("Saldo pendiente: RD$ 0.00");
    expect(messagesFor(creditSale.number, "A CRÉDITO")[0]).toContain(
      "Por cobrar: RD$ 100.00",
    );
    // Cada aviso, una fila enviada en la cola.
    for (const ref of [
      cashSale.id,
      creditSale.id,
      codSale.id,
      ret.id,
      collection.id,
    ]) {
      const rows = await outbox(ref);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r: any) => r.status === "sent" && r.sentAt)).toBe(
        true,
      );
    }
    expect(
      (await outbox(cashSale.id)).map((r: any) => r.eventType).sort(),
    ).toEqual(["sale", "sale_voided"]);
    // Petición correcta a la Bot API.
    const req = received.find((r) =>
      String(r.body?.text).includes(creditSale.number),
    )!;
    expect(req.path).toBe(`/bot${TOKEN}/sendMessage`);
    expect(req.body.chat_id).toBe(CHAT);
    expect(req.body.parse_mode).toBe("HTML");
  }, 120000);

  it("reintentar la misma venta (online, a la vez y offline con el mismo offlineUuid) no duplica el aviso", async () => {
    mode = "ok";
    const body = saleBody(100, [{ method: "cash", amount: 100 }]);
    const [a, b] = await Promise.all([
      ok(withTg.base, "/sales", body),
      ok(withTg.base, "/sales", body),
    ]);
    const c = await ok(withTg.base, "/sales", body);
    expect(new Set([a.id, b.id, c.id]).size).toBe(1);
    // Venta offline: la caja reenvía el mismo lote dos veces.
    const offline = {
      ...saleBody(100, [
        {
          method: "transfer",
          amount: 100,
          bank: "BHD",
          reference: "QA-" + suffix,
        },
      ]),
      capturedAt: new Date().toISOString(),
    };
    const first = await ok(withTg.base, "/sales/sync", { sales: [offline] });
    const again = await ok(withTg.base, "/sales/sync", { sales: [offline] });
    expect(first.results[0].status).toBe("synced");
    expect(again.results[0].status).toBe("synced");
    const offlineSale = first.results[0].sale;
    saleIds.push(a.id, offlineSale.id);
    await waitFor(
      () =>
        messagesFor(a.number).length && messagesFor(offlineSale.number).length,
      "avisos de la venta repetida",
    );
    await new Promise((r) => setTimeout(r, 6000));
    expect(messagesFor(a.number)).toHaveLength(1);
    expect(messagesFor(offlineSale.number)).toHaveLength(1);
    expect(messagesFor(offlineSale.number)[0]).toContain(
      "Transferencia (por verificar) RD$ 100.00",
    );
    expect(await outbox(a.id)).toHaveLength(1);
    expect(await outbox(offlineSale.id)).toHaveLength(1);
  }, 60000);

  it("si Telegram responde 500 la venta sigue y el aviso se reintenta y luego sale", async () => {
    mode = "500";
    const started = Date.now();
    const s = await sell([{ method: "cash", amount: 100 }]);
    expect(Date.now() - started).toBeLessThan(3000);
    await waitFor(() => messagesFor(s.number).length, "primer intento (500)");
    const [row] = await waitFor(async () => {
      const rows = await outbox(s.id);
      return rows[0]?.lastError ? rows : null;
    }, "fila con el error");
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(1);
    expect(row.lastError).toContain("HTTP 500");
    expect(row.lastError).not.toContain(TOKEN);
    // Primera espera: 30 s.
    const wait = (new Date(row.nextAttemptAt).getTime() - Date.now()) / 1000;
    expect(wait).toBeGreaterThan(20);
    expect(wait).toBeLessThan(35);
    // La venta quedó registrada aunque Telegram falló.
    expect((await db.sale.findUnique({ where: { id: s.id } })).status).toBe(
      "completed",
    );
    const status = await ok(withTg.base, "/notifications/status");
    expect(status.enabled).toBe(true);
    expect(status.pending).toBeGreaterThanOrEqual(1);
    expect(status.lastError.message).toContain("HTTP 500");
    expect(JSON.stringify(status)).not.toContain(TOKEN);
    expect(JSON.stringify(status)).not.toContain(CHAT);
    mode = "ok";
    await fastForward(s.id);
    await waitFor(
      async () => (await outbox(s.id))[0]?.status === "sent",
      "reintento enviado",
    );
    const sent = (await outbox(s.id))[0];
    expect(sent.attempts).toBe(2);
    expect(sent.lastError).toBeNull();
    expect(messagesFor(s.number)).toHaveLength(2); // el fallido y el bueno
  }, 60000);

  it("respeta el 429 de Telegram (retry_after)", async () => {
    mode = "ok";
    once.push("429:3");
    const s = await sell([{ method: "cash", amount: 100 }]);
    await waitFor(
      () => messagesFor(s.number).length >= 2,
      "reintento tras 429",
      30000,
    );
    const [first, second] = received.filter((r) =>
      String(r.body?.text).includes(s.number),
    );
    expect(second.at - first.at).toBeGreaterThanOrEqual(2900);
    const [row] = await waitFor(async () => {
      const rows = await outbox(s.id);
      return rows[0]?.status === "sent" ? rows : null;
    }, "aviso enviado tras 429");
    // El 429 no cuenta como intento fallido.
    expect(row.attempts).toBe(1);
  }, 60000);

  it("con Telegram caído (no responde) POST /sales no se retrasa", async () => {
    const time = async () => {
      const t = Date.now();
      await sell([{ method: "cash", amount: 100 }]);
      return Date.now() - t;
    };
    const median = (v: number[]) =>
      v.sort((a, b) => a - b)[Math.floor(v.length / 2)];
    mode = "ok";
    const healthy: number[] = [];
    for (let i = 0; i < 5; i++) healthy.push(await time());
    await waitFor(
      async () =>
        (await db.notificationOutbox.count({
          where: { status: "pending", refId: { in: saleIds } },
        })) === 0,
      "cola vacía",
      30000,
    );
    mode = "hang";
    const before = received.length;
    const down: number[] = [];
    const downIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      down.push(await time());
      downIds.push(saleIds.at(-1)!);
    }
    // El trabajador ya está esperando a Telegram mientras se vende.
    await waitFor(() => received.length > before, "petición colgada");
    for (let i = 0; i < 3; i++) {
      down.push(await time());
      downIds.push(saleIds.at(-1)!);
    }
    console.log(
      `[telegram] POST /sales ms · Telegram bien: ${healthy.join(", ")} (mediana ${median([...healthy])}) · Telegram caído: ${down.join(", ")} (mediana ${median([...down])})`,
    );
    expect(Math.max(...down)).toBeLessThan(2000);
    expect(median([...down])).toBeLessThan(median([...healthy]) + 250);
    // El envío colgado se corta a los 8 s y se reprograma.
    const firstHung = await waitFor(
      async () => {
        const rows = await db.notificationOutbox.findMany({
          where: { refId: { in: downIds }, lastError: { not: null } },
        });
        return rows[0];
      },
      "corte por tiempo de espera",
      20000,
    );
    expect(firstHung.lastError).toContain("8 s");
    expect(firstHung.status).toBe("pending");
    // Telegram vuelve: todo sale.
    mode = "ok";
    for (const res of hung.splice(0)) res.destroy();
    await waitFor(
      async () => {
        // Simula que pasaron las esperas de reintento.
        for (const id of downIds) await fastForward(id);
        return (
          (await db.notificationOutbox.count({
            where: { refId: { in: downIds }, status: "sent" },
          })) === downIds.length
        );
      },
      "avisos tras volver Telegram",
      60000,
    );
  }, 150000);

  it("sin las variables no se inserta nada en la cola y la venta funciona", async () => {
    const before = await db.notificationOutbox.count();
    const s = await sell([{ method: "cash", amount: 100 }], {}, withoutTg.base);
    const v = await sell([{ method: "cod", amount: 100 }], {}, withoutTg.base);
    await ok(withoutTg.base, "/sales/" + v.id + "/void", {
      reason: "QA sin Telegram",
    });
    const test = await ok(withoutTg.base, "/notifications/telegram/test", {});
    expect(test).toMatchObject({ enabled: false, queued: false });
    const status = await ok(withoutTg.base, "/notifications/status");
    expect(status.enabled).toBe(false);
    await new Promise((r) => setTimeout(r, 1500));
    expect(await outbox(s.id)).toHaveLength(0);
    expect(await outbox(v.id)).toHaveLength(0);
    expect(await db.notificationOutbox.count()).toBe(before);
  }, 30000);

  it("prueba de conexión: sólo administración, encola «Prueba de Nexora» sin revelar el token", async () => {
    mode = "ok";
    const r = await ok(withTg.base, "/notifications/telegram/test", {});
    expect(r).toMatchObject({ enabled: true, queued: true });
    expect(JSON.stringify(r)).not.toContain(TOKEN);
    await waitFor(
      () => texts().some((t) => t.includes("Prueba de Nexora")),
      "mensaje de prueba",
    );
    // Una cuenta sin permiso de administración no puede.
    const roles = await ok(withTg.base, "/roles");
    const role = roles.find(
      (x: any) =>
        !x.permissions.includes("*") && x.permissions.includes("sale:write"),
    );
    const username = "qa.tg." + suffix;
    const initial = "QA-Telegram-Inicial-2026!";
    await ok(withTg.base, "/users", {
      name: "QA Telegram vendedor",
      username,
      password: initial,
      pin: "4826",
      roleId: role.id,
    });
    let login = await request(
      withTg.base,
      "/auth/login",
      { login: username, password: initial },
      "",
    );
    if (login.body?.requiresPasswordChange)
      login = await request(
        withTg.base,
        "/auth/change-password",
        {
          login: username,
          currentPassword: initial,
          newPassword: "QA-Telegram-Activa-2026!",
          confirmPassword: "QA-Telegram-Activa-2026!",
        },
        "",
      );
    const seller = login.body.accessToken;
    expect(seller).toBeTruthy();
    expect(
      (await request(withTg.base, "/notifications/telegram/test", {}, seller))
        .status,
    ).toBe(403);
    expect(
      (await request(withTg.base, "/notifications/status", undefined, seller))
        .status,
    ).toBe(403);
    expect(
      (await request(withTg.base, "/notifications/status", undefined, ""))
        .status,
    ).toBe(401);
  }, 60000);

  it("cierre de caja: esperado vs contado con diferencia", async () => {
    mode = "ok";
    const current = (await ok(withTg.base, "/cash-sessions")).find(
      (s: any) => s.id === cash.id,
    );
    await ok(withTg.base, "/cash-sessions/" + cash.id + "/close", {
      countedCash: Math.max(0, current.expected.cash - 50),
      countedCard: current.expected.card,
      countedTransfer: current.expected.transfer,
      notes: "Faltan 50 en pruebas Telegram",
    });
    const text = await waitFor(
      () =>
        texts().find(
          (t) =>
            t.startsWith("🔒 <b>Cierre de caja</b>") && t.includes("faltante"),
        ),
      "aviso de cierre",
    );
    expect(text).toContain("Efectivo: esperado RD$");
    expect(text).toContain("diferencia RD$ -50.00");
    expect(text).toContain("<b>Diferencia total: RD$ -50.00 (faltante)</b>");
    expect(text).not.toContain("Faltan 50"); // la nota libre no se envía
  }, 60000);

  it("nada de lo enviado ni de la cola contiene cédula, teléfono, correo ni token", async () => {
    expect(received.length).toBeGreaterThan(10);
    const sent = JSON.stringify(received.map((r) => r.body));
    const rows = await db.notificationOutbox.findMany({
      where: { refId: { in: saleIds } },
    });
    const stored = JSON.stringify(rows);
    for (const secret of [CEDULA, PHONE, EMAIL, TOKEN, "AAQA-fake"]) {
      expect(sent).not.toContain(secret);
      expect(stored).not.toContain(secret);
    }
    // El cliente sí aparece, sólo por su nombre.
    expect(sent).toContain("Cliente QA Telegram " + suffix);
    // Ni el token ni la URL quedan en el registro de la API.
    expect(withTg.output()).not.toContain(TOKEN);
    // HTML válido para Telegram: sólo <b>.
    for (const t of texts())
      expect(t.replace(/<\/?b>/g, "")).not.toMatch(/[<>]/);
    void productId;
  });
});
