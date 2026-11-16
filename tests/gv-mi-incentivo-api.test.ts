// «Mi incentivo GV»: la usuaria GV ve solo lo suyo y no entra al cuadre de todas.
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
const ip = "198.18.11." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";

async function request(
  path: string,
  as: string,
  data?: unknown,
  method?: string,
) {
  const r = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
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
    /* texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function login(email: string, password: string, next?: string) {
  let auth = await ok("/auth/login", "", { email, password });
  if (auth.requiresPasswordChange)
    auth = await ok("/auth/change-password", "", {
      login: email,
      currentPassword: password,
      newPassword: next,
      confirmPassword: next,
    });
  return auth.accessToken as string;
}

let admin = "",
  gv = "",
  gvUserId = "";

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  const roles = await ok("/roles", admin);
  const gvRole = roles.find((r: any) => r.name === "gv");
  const email = `qa-gvinc-${suffix}@example.test`;
  const user = await ok("/users", admin, {
    name: "QA GV Inc " + suffix,
    email,
    password: "FitStore-QA-2026!",
    pin: "583921",
    roleId: gvRole.id,
  });
  gvUserId = user.id;
  gv = await login(email, "FitStore-QA-2026!", "FitStore-QA-Nueva-2026!");
}, 120000);

afterAll(async () => {
  if (gvUserId)
    await db.user.update({ where: { id: gvUserId }, data: { active: false } });
  await db.$disconnect();
}, 60000);

describe("GV · mi incentivo", () => {
  it("la usuaria GV ve solo lo suyo y no el cuadre de todas", async () => {
    const mine = await request("/gv/incentives/me?period=2026-11", gv);
    expect(mine.status).toBe(200);
    expect(mine.body.total).toBe("0.00");
    expect(mine.body.rows.every((r: any) => r.personId === gvUserId)).toBe(
      true,
    );
    // Ignora cualquier userId que mande.
    const other = await request(
      `/gv/incentives/me?period=2026-11&userId=${randomUUID()}`,
      gv,
    );
    expect(other.body.rows).toEqual([]);
    // El cuadre de todas sigue siendo solo de gerencia.
    expect((await request("/gv/incentives?period=2026-11", gv)).status).toBe(
      403,
    );
    expect((await request("/gv/incentives/me?period=2026-11", "")).status).toBe(
      401,
    );
  });
});
