// Respaldo diario a Google Drive, de punta a punta: APIs compiladas propias
// (node dist/main.js) sobre la base de las pruebas, un Google falso local
// (OAuth + Drive con subida reanudable) y un Telegram falso. Usa el pg_dump
// real del PATH contra la base de las pruebas y restaura la copia descifrada
// en una base nueva. Las piezas puras están en tests/drive-backup-core.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { createServer, type IncomingMessage } from "node:http";
import { createServer as createNetServer } from "node:net";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  backupName,
  retentionPlan,
  signState,
  stateKey,
  sha256Hex,
} from "../apps/api/src/drive-backup-core";
// @ts-expect-error -- script .mjs sin tipos
import { decryptBackup } from "../scripts/decrypt-backup.mjs";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();

// Secretos de prueba que jamás deben salir en respuestas, auditoría ni registros.
const CLIENT_ID = "1234567890-fake.apps.googleusercontent.com";
const CLIENT_SECRET = "GOCSPX-fake-client-secret-only-for-tests";
const PASS = "frase-de-cifrado-de-pruebas-2026-larga";
const TG_TOKEN = "123456789:AAfake-telegram-token-for-drive-tests";
const ACCOUNT = "duena.qa@gmail.com";
const DB_PASSWORD = decodeURIComponent(
  new URL(process.env.DATABASE_URL!).password,
);
const ip = "198.18.1." + ((Date.now() % 250) + 1);

// --- Google y Telegram falsos ----------------------------------------------
type FakeFile = {
  id: string;
  name: string;
  mimeType: string;
  parents: string[];
  appProperties: Record<string, string>;
  trashed: boolean;
  createdTime: string;
  content: Buffer | null;
};
const g = {
  files: new Map<string, FakeFile>(),
  codes: new Map<
    string,
    { redirect: string; challenge: string; used: boolean }
  >(),
  refresh: new Set<string>(),
  access: new Set<string>(),
  revoked: [] as string[],
  uploads: new Map<
    string,
    { meta: any; size: number; data: Buffer[]; received: number }
  >(),
  telegram: [] as any[],
  requests: [] as { method: string; path: string; body: string }[],
  grantScope: "https://www.googleapis.com/auth/drive.file",
  tokenMode: "ok" as "ok" | "invalid_grant",
  driveDown: false,
  failChunks: 0,
  resumedAt: 0,
  badChecksum: false,
};
let refreshIssued = "";
const accessIssued: string[] = [];
let seq = 0;
const newId = (p: string) =>
  p + (++seq).toString(36) + randomBytes(4).toString("hex");

function readBody(req: IncomingMessage) {
  return new Promise<Buffer>((resolve) => {
    const parts: Buffer[] = [];
    req.on("data", (c) => parts.push(c));
    req.on("end", () => resolve(Buffer.concat(parts)));
  });
}
const meta = (f: FakeFile) => {
  const md5 = f.content
    ? createHash("md5").update(f.content).digest("hex")
    : undefined;
  const sha = f.content ? sha256Hex(f.content) : undefined;
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    parents: f.parents,
    appProperties: f.appProperties,
    trashed: f.trashed,
    createdTime: f.createdTime,
    ...(f.content
      ? {
          size: String(f.content.length),
          md5Checksum: g.badChecksum ? "0".repeat(32) : md5,
          sha256Checksum: g.badChecksum ? "0".repeat(64) : sha,
        }
      : {}),
  };
};
const fake = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://fake");
  const body = await readBody(req);
  g.requests.push({
    method: req.method ?? "",
    path: url.pathname,
    body: body.toString("latin1"),
  });
  const send = (
    status: number,
    payload?: unknown,
    headers: Record<string, string> = {},
  ) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(payload === undefined ? "" : JSON.stringify(payload));
  };
  // Telegram
  if (url.pathname.startsWith("/bot")) {
    g.telegram.push(JSON.parse(body.toString() || "{}"));
    return send(200, { ok: true, result: { message_id: g.telegram.length } });
  }
  // OAuth
  if (url.pathname === "/o/oauth2/v2/auth") {
    const q = url.searchParams;
    if (
      q.get("client_id") !== CLIENT_ID ||
      q.get("response_type") !== "code" ||
      q.get("access_type") !== "offline" ||
      q.get("prompt") !== "consent" ||
      q.get("scope") !== "https://www.googleapis.com/auth/drive.file" ||
      q.get("code_challenge_method") !== "S256"
    )
      return send(400, { error: "invalid_request" });
    const code = "4/fake-code-" + randomBytes(8).toString("hex");
    g.codes.set(code, {
      redirect: q.get("redirect_uri")!,
      challenge: q.get("code_challenge")!,
      used: false,
    });
    const to = new URL(q.get("redirect_uri")!);
    to.searchParams.set("code", code);
    to.searchParams.set("state", q.get("state")!);
    return send(302, undefined, { Location: to.toString() });
  }
  if (url.pathname === "/token" && req.method === "POST") {
    const f = new URLSearchParams(body.toString());
    if (
      f.get("client_id") !== CLIENT_ID ||
      f.get("client_secret") !== CLIENT_SECRET
    )
      return send(401, { error: "invalid_client" });
    if (f.get("grant_type") === "authorization_code") {
      const code = g.codes.get(f.get("code") ?? "");
      const verifier = f.get("code_verifier") ?? "";
      if (
        !code ||
        code.used ||
        code.redirect !== f.get("redirect_uri") ||
        createHash("sha256").update(verifier).digest("base64url") !==
          code.challenge
      )
        return send(400, { error: "invalid_grant" });
      code.used = true;
      refreshIssued = "1//0fake-refresh-" + randomBytes(16).toString("hex");
      const access = "ya29.fake-access-" + randomBytes(16).toString("hex");
      g.refresh.add(refreshIssued);
      g.access.add(access);
      accessIssued.push(access);
      return send(200, {
        access_token: access,
        expires_in: 3599,
        refresh_token: refreshIssued,
        scope: g.grantScope,
        token_type: "Bearer",
      });
    }
    if (f.get("grant_type") === "refresh_token") {
      const token = f.get("refresh_token") ?? "";
      if (g.tokenMode === "invalid_grant" || !g.refresh.has(token))
        return send(400, {
          error: "invalid_grant",
          error_description: "Token has been expired or revoked.",
        });
      const access = "ya29.fake-access-" + randomBytes(16).toString("hex");
      g.access.add(access);
      accessIssued.push(access);
      return send(200, {
        access_token: access,
        expires_in: 3599,
        scope: g.grantScope,
        token_type: "Bearer",
      });
    }
    return send(400, { error: "unsupported_grant_type" });
  }
  if (url.pathname === "/revoke" && req.method === "POST") {
    const token = new URLSearchParams(body.toString()).get("token") ?? "";
    g.revoked.push(token);
    g.refresh.delete(token);
    return send(200, {});
  }
  // Drive
  if (g.driveDown)
    return send(503, { error: { code: 503, message: "Backend Error" } });
  const auth = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!g.access.has(auth)) return send(401, { error: { code: 401 } });
  if (url.pathname === "/drive/v3/about")
    return send(200, { user: { emailAddress: ACCOUNT } });
  if (url.pathname === "/drive/v3/files" && req.method === "GET") {
    const q = url.searchParams.get("q") ?? "";
    let list = [...g.files.values()].filter((f) => !f.trashed);
    if (q.includes("application/vnd.google-apps.folder"))
      list = list.filter(
        (f) =>
          f.mimeType === "application/vnd.google-apps.folder" &&
          f.appProperties.nexoraBackupFolder === "1",
      );
    const parent = /'([^']+)' in parents/.exec(q)?.[1];
    if (parent) list = list.filter((f) => f.parents.includes(parent));
    return send(200, { files: list.map(meta) });
  }
  if (url.pathname === "/drive/v3/files" && req.method === "POST") {
    const m = JSON.parse(body.toString());
    const f: FakeFile = {
      id: newId("folder"),
      name: m.name,
      mimeType: m.mimeType,
      parents: m.parents ?? ["root"],
      appProperties: m.appProperties ?? {},
      trashed: false,
      createdTime: new Date().toISOString(),
      content: null,
    };
    g.files.set(f.id, f);
    return send(200, { id: f.id });
  }
  const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname);
  if (fileMatch) {
    const f = g.files.get(decodeURIComponent(fileMatch[1]!));
    if (!f) return send(404, { error: { code: 404 } });
    if (req.method === "PATCH") {
      const m = JSON.parse(body.toString());
      if (m.trashed === true) f.trashed = true;
      return send(200, { id: f.id });
    }
    return send(200, meta(f));
  }
  if (url.pathname === "/upload/drive/v3/files" && req.method === "POST") {
    if (url.searchParams.get("uploadType") !== "resumable")
      return send(400, {});
    const id = randomBytes(8).toString("hex");
    g.uploads.set(id, {
      meta: JSON.parse(body.toString()),
      size: Number(req.headers["x-upload-content-length"]),
      data: [],
      received: 0,
    });
    const port = (fake.address() as { port: number }).port;
    return send(
      200,
      {},
      {
        Location: `http://127.0.0.1:${port}/upload/drive/v3/files?uploadType=resumable&upload_id=${id}`,
      },
    );
  }
  if (url.pathname === "/upload/drive/v3/files" && req.method === "PUT") {
    const up = g.uploads.get(url.searchParams.get("upload_id") ?? "");
    if (!up) return send(404, {});
    const range = String(req.headers["content-range"] ?? "");
    const finish = () => {
      const f: FakeFile = {
        id: newId("file"),
        name: up.meta.name,
        mimeType: up.meta.mimeType,
        parents: up.meta.parents,
        appProperties: up.meta.appProperties ?? {},
        trashed: false,
        createdTime: new Date().toISOString(),
        content: Buffer.concat(up.data),
      };
      g.files.set(f.id, f);
      return send(200, { id: f.id, name: f.name });
    };
    const partial = () =>
      send(
        308,
        undefined,
        up.received ? { Range: `bytes=0-${up.received - 1}` } : {},
      );
    if (range.startsWith("bytes */"))
      return up.received === up.size ? finish() : partial();
    const m = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range);
    if (
      !m ||
      Number(m[1]) !== up.received ||
      body.length !== Number(m[2]) - Number(m[1]) + 1
    )
      return send(400, { error: "bad range" });
    // Corte simulado a mitad de un bloque: Google guardó un tercio y la API
    // debe preguntar cuánto llegó y seguir desde ahí.
    if (g.failChunks > 0 && up.received > 0) {
      g.failChunks--;
      g.resumedAt = up.received + Math.floor(body.length / 3);
      up.data.push(body.subarray(0, Math.floor(body.length / 3)));
      up.received = g.resumedAt;
      return send(503, { error: "backend" });
    }
    up.data.push(body);
    up.received += body.length;
    return up.received === up.size ? finish() : partial();
  }
  send(404, { error: "not found" });
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
  let output = "";
  let running = true;
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (c: string) => (output = (output + c).slice(-50000)));
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
  return { base, stop, output: () => output };
}

let fakeBase = "";
let api: Awaited<ReturnType<typeof startApi>>;
let bare: Awaited<ReturnType<typeof startApi>>;
let admin = "";
const seen: string[] = [];

async function call(
  base: string,
  path: string,
  init: {
    method?: string;
    token?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const r = await fetch(base + path, {
    method: init.method ?? "GET",
    redirect: "manual",
    headers: {
      "X-Forwarded-For": ip,
      ...(init.method === "POST" ? { "Content-Type": "application/json" } : {}),
      ...(init.token ? { Authorization: "Bearer " + init.token } : {}),
      ...init.headers,
    },
    ...(init.method === "POST" ? { body: "{}" } : {}),
  });
  const text = await r.text();
  seen.push(text, JSON.stringify([...r.headers]));
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* sin JSON */
  }
  return { status: r.status, body, headers: r.headers };
}
async function login(base: string, email: string) {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({
      email,
      password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    }),
  });
  const body: any = await r.json();
  if (!body?.accessToken)
    throw new Error("login " + email + ": " + JSON.stringify(body));
  return body.accessToken as string;
}
const status = async () =>
  (await call(api.base, "/backups/status", { token: admin })).body;
async function waitIdle(after: number, timeout = 60000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const s = await status();
    if (!s.running && s.lastRun && new Date(s.lastRun.at).getTime() >= after)
      return s;
    if (Date.now() > deadline)
      throw new Error(
        "El respaldo no terminó: " + JSON.stringify(s) + api.output(),
      );
    await new Promise((r) => setTimeout(r, 200));
  }
}
async function runNow() {
  const before = Date.now() - 1000;
  const r = await call(api.base, "/backups/run", {
    method: "POST",
    token: admin,
  });
  expect(r.status, JSON.stringify(r.body) + api.output().slice(-3000)).toBe(
    201,
  );
  return waitIdle(before);
}
/** Conecta como lo haría el navegador: connect → Google → callback. */
async function connect(token = admin) {
  const c = await call(api.base, "/backups/google/connect", { token });
  expect(c.status).toBe(200);
  const cookie = c.headers
    .getSetCookie()
    .find((h) => h.startsWith("nexora_drive_oauth="))!;
  expect(cookie).toMatch(/HttpOnly/i);
  expect(cookie).toMatch(/SameSite=Lax/i);
  expect(cookie).toMatch(/Path=\/api\/backups\/google/);
  const consent = await fetch(c.body.url, { redirect: "manual" });
  const back = new URL(consent.headers.get("location")!);
  expect(back.pathname).toBe("/api/backups/google/callback");
  const r = await call(api.base, "/backups/google/callback" + back.search, {
    headers: { Cookie: cookie.split(";")[0]! },
  });
  return {
    result: r,
    url: new URL(c.body.url),
    cookie: cookie.split(";")[0]!,
    back,
  };
}
const driveFiles = () => [...g.files.values()].filter((f) => f.content);
const backupRow = () => db.driveBackup.findUnique({ where: { id: "main" } });

beforeAll(async () => {
  await new Promise<void>((resolve) => fake.listen(0, "127.0.0.1", resolve));
  fakeBase = `http://127.0.0.1:${(fake.address() as { port: number }).port}`;
  await db.$executeRawUnsafe(`DELETE FROM "DriveBackup"`);
  await db.$executeRawUnsafe(
    `DELETE FROM "NotificationOutbox" WHERE "eventType" = 'backup_alert'`,
  );
  const google = {
    GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
    BACKUP_ENCRYPTION_KEY: PASS,
    GOOGLE_OAUTH_BASE: fakeBase,
    GOOGLE_DRIVE_BASE: fakeBase,
    TELEGRAM_BOT_TOKEN: TG_TOKEN,
    TELEGRAM_CHAT_ID: "-100123",
    TELEGRAM_API_BASE: fakeBase,
    // Bloques de 256 KiB: el respaldo de la base de pruebas sube en varias partes.
    DRIVE_BACKUP_UPLOAD_CHUNK: "262144",
    DRIVE_BACKUP_UPLOAD_RETRY_MS: "50",
    // El temporizador se prueba aparte (más abajo).
    DRIVE_BACKUP_START_DELAY_MS: "3600000",
  };
  [api, bare] = await Promise.all([
    startApi(google),
    startApi({
      GOOGLE_OAUTH_CLIENT_ID: undefined,
      GOOGLE_OAUTH_CLIENT_SECRET: undefined,
      BACKUP_ENCRYPTION_KEY: undefined,
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_CHAT_ID: undefined,
    }),
  ]);
  admin = await login(api.base, "admin@fitstore.demo");
}, 120000);

afterAll(async () => {
  try {
    await Promise.all([api?.stop(), bare?.stop()]);
    await db.$executeRawUnsafe(
      `DELETE FROM "NotificationOutbox" WHERE "eventType" = 'backup_alert'`,
    );
    await db.$executeRawUnsafe(`DELETE FROM "DriveBackup"`);
  } finally {
    await new Promise((r) => fake.close(r));
    await db.$disconnect();
  }
}, 60000);

describe("Respaldo a Google Drive · sin configuración", () => {
  it("dice «no configurado» y no hace nada", async () => {
    const token = await login(bare.base, "admin@fitstore.demo");
    const s = await call(bare.base, "/backups/status", { token });
    expect(s.status).toBe(200);
    expect(s.body).toMatchObject({
      configured: false,
      connected: false,
      running: false,
      nextRunAt: null,
    });
    expect(s.body.missing).toEqual([
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "BACKUP_ENCRYPTION_KEY (32 caracteres o más)",
    ]);
    expect(
      (await call(bare.base, "/backups/google/connect", { token })).status,
    ).toBe(409);
    const run = await call(bare.base, "/backups/run", {
      method: "POST",
      token,
    });
    expect(run.status).toBe(409);
    expect(run.body.message).toMatch(/no está configurado/);
    const back = await call(
      bare.base,
      "/backups/google/callback?code=x&state=y",
    );
    expect(back.status).toBe(302);
    expect(back.headers.get("location")).toMatch(
      /\/\?drive=unconfigured#settings$/,
    );
  });
});

describe("Respaldo a Google Drive · permisos y conexión", () => {
  it("sólo la administración: gerencia y ventas reciben 403", async () => {
    for (const email of ["gerente@fitstore.demo", "vendedor@fitstore.demo"]) {
      const token = await login(api.base, email);
      expect((await call(api.base, "/backups/status", { token })).status).toBe(
        403,
      );
      expect(
        (await call(api.base, "/backups/run", { method: "POST", token }))
          .status,
      ).toBe(403);
      expect(
        (await call(api.base, "/backups/google/connect", { token })).status,
      ).toBe(403);
      expect(
        (
          await call(api.base, "/backups/google/disconnect", {
            method: "POST",
            token,
          })
        ).status,
      ).toBe(403);
    }
    expect((await call(api.base, "/backups/status")).status).toBe(401);
  });

  it("rechaza state ausente, falsificado, caducado o sin la cookie del navegador", async () => {
    const c = await call(api.base, "/backups/google/connect", { token: admin });
    const url = new URL(c.body.url);
    expect(url.origin + url.pathname).toBe(fakeBase + "/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/drive.file",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("redirect_uri")).toMatch(
      /\/api\/backups\/google\/callback$/,
    );
    const cookie = c.headers.getSetCookie()[0]!.split(";")[0]!;
    const nonce = cookie.split("=")[1]!;
    const state = url.searchParams.get("state")!;
    const invalid = async (
      query: string,
      headers: Record<string, string> = {},
    ) => {
      const r = await call(api.base, "/backups/google/callback" + query, {
        headers,
      });
      expect(r.status).toBe(302);
      expect(r.headers.get("location")).toMatch(/\/\?drive=invalid#settings$/);
    };
    await invalid("?code=abc", { Cookie: cookie });
    await invalid("?code=abc&state=" + encodeURIComponent(state)); // sin cookie
    await invalid("?code=abc&state=" + encodeURIComponent(state), {
      Cookie: "nexora_drive_oauth=otro-navegador",
    });
    await invalid(
      "?code=abc&state=" + encodeURIComponent(state.slice(0, -2) + "xx"),
      { Cookie: cookie },
    );
    const claims = JSON.parse(
      Buffer.from(state.split(".")[0]!, "base64url").toString(),
    );
    const key = stateKey(process.env.JWT_SECRET!);
    const expired = signState(
      { u: claims.u, s: claims.s, n: sha256Hex(nonce), e: Date.now() - 1000 },
      key,
    );
    await invalid("?code=abc&state=" + encodeURIComponent(expired), {
      Cookie: cookie,
    });
    const otherKey = signState(
      { u: claims.u, s: claims.s, n: sha256Hex(nonce), e: Date.now() + 60000 },
      stateKey("otro-secreto-que-no-es-el-de-la-api-0123456789"),
    );
    await invalid("?code=abc&state=" + encodeURIComponent(otherKey), {
      Cookie: cookie,
    });
    // Si la administradora pulsa «Cancelar» en Google.
    const denied = await call(
      api.base,
      "/backups/google/callback?error=access_denied&state=" +
        encodeURIComponent(state),
      {
        headers: { Cookie: cookie },
      },
    );
    expect(denied.headers.get("location")).toMatch(
      /\/\?drive=denied#settings$/,
    );
    expect((await status()).connected).toBe(false);
    expect(g.requests.filter((r) => r.path === "/token")).toHaveLength(0);
  });

  it("la vuelta de Google falla si la sesión que inició la conexión venció por inactividad", async () => {
    const before = g.requests.filter((r) => r.path === "/token").length;
    const c = await call(api.base, "/backups/google/connect", { token: admin });
    const cookie = c.headers.getSetCookie()[0]!.split(";")[0]!;
    const consent = await fetch(c.body.url, { redirect: "manual" });
    const back = new URL(consent.headers.get("location")!);
    const claims = JSON.parse(
      Buffer.from(
        back.searchParams.get("state")!.split(".")[0]!,
        "base64url",
      ).toString(),
    );
    await db.authSession.update({
      where: { id: claims.s },
      data: { lastActivityAt: new Date(Date.now() - 24 * 3600_000) },
    });
    try {
      const r = await call(api.base, "/backups/google/callback" + back.search, {
        headers: { Cookie: cookie },
      });
      expect(r.headers.get("location")).toMatch(/\/\?drive=invalid#settings$/);
      expect(g.requests.filter((x) => x.path === "/token")).toHaveLength(
        before,
      );
    } finally {
      await db.authSession.update({
        where: { id: claims.s },
        data: { lastActivityAt: new Date() },
      });
    }
  });

  it("sin el permiso de Drive marcado no conecta y revoca lo concedido", async () => {
    g.grantScope = "openid";
    const { result } = await connect();
    expect(result.headers.get("location")).toMatch(/\/\?drive=scope#settings$/);
    expect(g.revoked).toContain(refreshIssued);
    expect((await status()).connected).toBe(false);
    g.grantScope = "https://www.googleapis.com/auth/drive.file";
  });

  it("conecta: token cifrado en reposo, cuenta enmascarada, auditoría sin secretos", async () => {
    const { result, back, cookie } = await connect();
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toMatch(
      /\/\?drive=connected#settings$/,
    );
    expect(result.headers.getSetCookie().join(";")).toMatch(
      /nexora_drive_oauth=;/,
    );
    const s = await status();
    expect(s).toMatchObject({
      configured: true,
      connected: true,
      needsReconnect: false,
      account: "d•••@gmail.com",
    });
    expect(new Date(s.nextRunAt).getTime()).toBeGreaterThan(Date.now() - 60000);
    const row = await backupRow();
    expect(row.refreshTokenEnc).toMatch(/^v1\./);
    expect(row.refreshTokenEnc).not.toContain(refreshIssued);
    // El código ya usado no sirve otra vez.
    const used = g.requests.filter((r) => r.path === "/token").length;
    expect(used).toBeGreaterThan(0);
    // N-09: el state tampoco. Repetir la URL de vuelta (historial, recarga,
    // referer) con la misma cookie no vuelve a pedir el token a Google.
    const replay = await call(
      api.base,
      "/backups/google/callback" + back.search,
      { headers: { Cookie: cookie } },
    );
    expect(replay.headers.get("location")).toMatch(
      /\/\?drive=invalid#settings$/,
    );
    expect(g.requests.filter((r) => r.path === "/token")).toHaveLength(used);
    expect((await status()).connected).toBe(true);
  });
});

describe("Respaldo a Google Drive · respaldos", () => {
  it("ruta feliz: cifra, sube por partes (con un corte), verifica y se restaura en una base nueva", async () => {
    g.failChunks = 1;
    const s = await runNow();
    expect(s.lastRun.status, JSON.stringify(s) + api.output()).toBe("success");
    expect(s.lastRun.error).toBeNull();
    expect(s.consecutiveFailures).toBe(0);
    const folder = [...g.files.values()].find(
      (f) => f.mimeType === "application/vnd.google-apps.folder",
    )!;
    expect(folder.name).toBe("Nexora POS respaldos");
    const [file] = driveFiles();
    expect(file!.name).toMatch(/^nexora-\d{4}-\d{2}-\d{2}-\d{4}\.dump\.enc$/);
    expect(file!.name).toBe(s.lastSuccess.fileName);
    expect(file!.parents).toEqual([folder.id]);
    expect(file!.content!.length).toBe(s.lastSuccess.size);
    expect(file!.content!.subarray(0, 4).toString()).toBe("NXBK");
    expect(file!.content!.includes(Buffer.from("PGDMP"))).toBe(false);
    expect(file!.appProperties).toMatchObject({
      nexoraBackup: "1",
      format: "NXBK1",
      sha256: sha256Hex(file!.content!),
    });
    // Subida reanudable en varias partes, con un corte y su consulta de estado.
    const puts = g.requests.filter(
      (r) => r.method === "PUT" && r.path === "/upload/drive/v3/files",
    );
    expect(puts.length).toBeGreaterThan(3);
    expect(g.failChunks).toBe(0);
    expect(g.resumedAt % 262144).not.toBe(0);
    const statusQuery = puts.findIndex((r) => r.body === "");
    expect(statusQuery).toBeGreaterThan(0);

    // Descifrar con el script y restaurar con scripts/restore.mjs.
    const dir = mkdtempSync(join(tmpdir(), "drive-restore-"));
    const restoreDb = "drive_restore_" + Date.now().toString(36);
    try {
      const enc = join(dir, file!.name);
      writeFileSync(enc, file!.content!);
      const out = join(dir, "restaurar.dump");
      await decryptBackup(enc, out, PASS);
      await db.$executeRawUnsafe(`CREATE DATABASE "${restoreDb}"`);
      const target = new URL(process.env.DATABASE_URL!);
      target.pathname = "/" + restoreDb;
      const restore = spawnSync(
        process.execPath,
        ["scripts/restore.mjs", out],
        {
          cwd: fileURLToPath(new URL("..", import.meta.url)),
          env: { ...process.env, RESTORE_DATABASE_URL: target.toString() },
          encoding: "utf8",
        },
      );
      expect(restore.status, restore.stderr).toBe(0);
      const restored = new PrismaClient({
        datasources: { db: { url: target.toString() } },
      });
      try {
        for (const table of [
          "Sale",
          "Product",
          "Customer",
          "Payment",
          "User",
        ]) {
          const [a] = await db.$queryRawUnsafe(
            `SELECT count(*)::int AS n FROM "${table}"`,
          );
          const [b] = await restored.$queryRawUnsafe(
            `SELECT count(*)::int AS n FROM "${table}"`,
          );
          expect(b.n, table).toBe(a.n);
        }
      } finally {
        await restored.$disconnect();
      }
    } finally {
      await db
        .$executeRawUnsafe(
          `DROP DATABASE IF EXISTS "${restoreDb}" WITH (FORCE)`,
        )
        .catch(() => {});
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("un solo respaldo a la vez", async () => {
    const before = Date.now() - 1000;
    const [a, b] = await Promise.all([
      call(api.base, "/backups/run", { method: "POST", token: admin }),
      call(api.base, "/backups/run", { method: "POST", token: admin }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a.body.message, b.body.message].join(" ")).toMatch(
      /Ya hay un respaldo en curso/,
    );
    expect((await waitIdle(before)).lastRun.status).toBe("success");
  });

  it("retención: 30 diarias + 12 mensuales; no toca archivos ajenos", async () => {
    const folder = [...g.files.values()].find(
      (f) => f.mimeType === "application/vnd.google-apps.folder",
    )!;
    const add = (
      name: string,
      appProperties: Record<string, string> = { nexoraBackup: "1" },
    ) => {
      const f: FakeFile = {
        id: newId("old"),
        name,
        mimeType: "application/octet-stream",
        parents: [folder.id],
        appProperties,
        trashed: false,
        createdTime: new Date().toISOString(),
        content: Buffer.from("viejo"),
      };
      g.files.set(f.id, f);
      return f;
    };
    // 45 días anteriores y 14 meses atrás (primero de cada mes).
    for (let i = 1; i <= 45; i++)
      add(backupName(new Date(Date.now() - i * 86400000)));
    for (let m = 2; m <= 15; m++) {
      const d = new Date();
      d.setUTCDate(10);
      d.setUTCMonth(d.getUTCMonth() - m);
      add(backupName(d));
    }
    const notes = add("notas.txt");
    const foreign = add(backupName(new Date(Date.now() - 400 * 86400000)), {});
    const before = driveFiles().filter((f) => !f.trashed);
    const s = await runNow();
    expect(s.lastRun.status).toBe("success");
    const current = driveFiles().find(
      (f) =>
        f.name === s.lastSuccess.fileName && !f.trashed && !before.includes(f),
    )!;
    const expected = retentionPlan(
      [...before, current]
        .filter((f) => f.appProperties.nexoraBackup === "1")
        .map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime })),
      { keep: [current.id] },
    );
    const alive = new Set(
      driveFiles()
        .filter((f) => !f.trashed)
        .map((f) => f.id),
    );
    for (const f of expected.keep) expect(alive.has(f.id), f.name).toBe(true);
    for (const f of expected.remove)
      expect(alive.has(f.id), f.name).toBe(false);
    expect(expected.remove.length).toBeGreaterThan(10);
    expect(alive.has(notes.id)).toBe(true);
    expect(alive.has(foreign.id)).toBe(true);
    const days = new Set(
      driveFiles()
        .filter((f) => !f.trashed && f.appProperties.nexoraBackup === "1")
        .map((f) => f.name.slice(7, 17)),
    );
    expect(days.size).toBeGreaterThanOrEqual(30);
    const audit = await db.auditLog.findFirst({
      where: { action: "backup_run" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit.after.removed).toBe(expected.remove.length);
  });

  it("si Drive no confirma la copia (suma distinta) falla y no borra nada", async () => {
    const aliveBefore = driveFiles().filter((f) => !f.trashed).length;
    g.badChecksum = true;
    const s = await runNow();
    g.badChecksum = false;
    expect(s.lastRun.status).toBe("failed");
    expect(s.lastRun.error).toMatch(/no confirmó la copia/);
    // La copia dudosa va a la papelera; las anteriores siguen.
    expect(driveFiles().filter((f) => !f.trashed).length).toBe(aliveBefore);
  });

  it("Drive caído: falla con un mensaje claro y lo cuenta", async () => {
    g.driveDown = true;
    const s = await runNow();
    g.driveDown = false;
    expect(s.lastRun.status).toBe("failed");
    expect(s.lastRun.error).toMatch(/Google Drive respondió HTTP 503/);
    expect(s.consecutiveFailures).toBe(2);
    expect(s.lastSuccess).not.toBeNull();
    const ok = await runNow();
    expect(ok.lastRun.status).toBe("success");
    expect(ok.consecutiveFailures).toBe(0);
  });

  it("permiso revocado en Google: pide reconectar y avisa por Telegram", async () => {
    await db.$executeRawUnsafe(
      `DELETE FROM "NotificationOutbox" WHERE "eventType" = 'backup_alert'`,
    );
    await db.driveBackup.update({
      where: { id: "main" },
      data: { lastAlertAt: null },
    });
    g.tokenMode = "invalid_grant";
    const s = await runNow();
    g.tokenMode = "ok";
    expect(s.lastRun.status).toBe("failed");
    expect(s.lastRun.error).toMatch(/Google retiró el permiso/);
    expect(s).toMatchObject({
      connected: false,
      needsReconnect: true,
      account: null,
    });
    expect((await backupRow()).refreshTokenEnc).toBeNull();
    const run = await call(api.base, "/backups/run", {
      method: "POST",
      token: admin,
    });
    expect(run.status).toBe(409);
    const deadline = Date.now() + 20000;
    while (
      !g.telegram.some((m) => /Respaldo diario/.test(m.text)) &&
      Date.now() < deadline
    )
      await new Promise((r) => setTimeout(r, 200));
    const alert = g.telegram.find((m) => /Respaldo diario/.test(m.text));
    expect(alert?.text).toMatch(/Google retiró el permiso/);
    expect(alert.text).not.toContain(ACCOUNT);
    const { result } = await connect();
    expect(result.headers.get("location")).toMatch(/drive=connected/);
  });

  it("desconectar revoca el permiso en Google", async () => {
    const token = refreshIssued;
    const r = await call(api.base, "/backups/google/disconnect", {
      method: "POST",
      token: admin,
    });
    expect(r.status).toBe(201);
    expect(g.revoked).toContain(token);
    expect(await status()).toMatchObject({
      connected: false,
      needsReconnect: false,
    });
    expect((await backupRow()).refreshTokenEnc).toBeNull();
    const actions = (
      await db.auditLog.findMany({
        where: { entity: "DriveBackup" },
        select: { action: true },
      })
    ).map((a: any) => a.action);
    for (const action of [
      "drive_connected",
      "drive_disconnected",
      "backup_run",
      "backup_failed",
    ])
      expect(actions).toContain(action);
    await connect();
  });
});

describe("Respaldo a Google Drive · temporizador", () => {
  it("con Drive caído reintenta con espera, se detiene a los 3 intentos del día y avisa", async () => {
    await api.stop();
    await db.$executeRawUnsafe(
      `DELETE FROM "NotificationOutbox" WHERE "eventType" = 'backup_alert'`,
    );
    await db.driveBackup.update({
      where: { id: "main" },
      data: {
        lastSuccessAt: null,
        consecutiveFailures: 0,
        dayAttempts: 0,
        dayKey: null,
        nextRetryAt: null,
        lastAlertAt: null,
      },
    });
    g.telegram.length = 0;
    g.driveDown = true;
    api = await startApi({
      GOOGLE_OAUTH_CLIENT_ID: CLIENT_ID,
      GOOGLE_OAUTH_CLIENT_SECRET: CLIENT_SECRET,
      BACKUP_ENCRYPTION_KEY: PASS,
      GOOGLE_OAUTH_BASE: fakeBase,
      GOOGLE_DRIVE_BASE: fakeBase,
      TELEGRAM_BOT_TOKEN: TG_TOKEN,
      TELEGRAM_CHAT_ID: "-100123",
      TELEGRAM_API_BASE: fakeBase,
      DRIVE_BACKUP_START_DELAY_MS: "200",
      DRIVE_BACKUP_TICK_MS: "300",
      DRIVE_BACKUP_RETRY_MS: "700",
      DRIVE_BACKUP_TEST_IGNORE_HOUR: "1",
    });
    admin = await login(api.base, "admin@fitstore.demo");
    const deadline = Date.now() + 40000;
    let row = await backupRow();
    while ((row.dayAttempts < 3 || row.lockedUntil) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      row = await backupRow();
    }
    expect(row.dayAttempts).toBe(3);
    expect(row.consecutiveFailures).toBe(3);
    // Los reintentos esperan: cada intento empieza después del anterior + espera.
    const failures = await db.auditLog.findMany({
      where: {
        action: "backup_failed",
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
      orderBy: { createdAt: "asc" },
    });
    const scheduled = failures
      .filter((f: any) => f.after?.trigger === "schedule")
      .slice(-3);
    expect(scheduled).toHaveLength(3);
    expect(scheduled.every((f: any) => f.userId === "system")).toBe(true);
    for (let i = 1; i < 3; i++)
      expect(
        scheduled[i].createdAt.getTime() - scheduled[i - 1].createdAt.getTime(),
      ).toBeGreaterThanOrEqual(600);
    // Y no hay un cuarto intento hoy.
    await new Promise((r) => setTimeout(r, 2000));
    expect((await backupRow()).dayAttempts).toBe(3);
    const s = await status();
    expect(s.lastRun).toMatchObject({ status: "failed", trigger: "schedule" });
    const until = Date.now() + 20000;
    while (
      !g.telegram.some((m) => /Falló 3 veces seguidas/.test(m.text)) &&
      Date.now() < until
    )
      await new Promise((r) => setTimeout(r, 200));
    const alerts = g.telegram.filter((m) => /Respaldo diario/.test(m.text));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].text).toMatch(/Falló 3 veces seguidas/);
    g.driveDown = false;
  }, 90000);

  it("ningún secreto en respuestas, auditoría, registros ni peticiones a Google", async () => {
    const audits = await db.auditLog.findMany({
      where: { entity: "DriveBackup" },
    });
    const outbox = await db.notificationOutbox.findMany({
      where: { eventType: "backup_alert" },
    });
    const everything = [
      ...seen,
      JSON.stringify(audits),
      JSON.stringify(outbox),
      api.output(),
      bare.output(),
      JSON.stringify(await status()),
    ].join("\n");
    const secrets = [
      CLIENT_SECRET,
      PASS,
      TG_TOKEN,
      DB_PASSWORD,
      ...[...g.refresh, ...g.revoked].filter(Boolean),
      ...accessIssued,
    ];
    for (const secret of secrets)
      expect(everything.includes(secret), "secreto expuesto").toBe(false);
    // A Google sólo le llega la copia cifrada: nunca la contraseña de la base ni la frase.
    const toGoogle = g.requests.map((r) => r.body).join("\n");
    expect(toGoogle.includes(DB_PASSWORD)).toBe(false);
    expect(toGoogle.includes(PASS)).toBe(false);
  });
});
