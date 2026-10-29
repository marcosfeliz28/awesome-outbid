// Pedidos de cambio contra la API real (requiere la API y la base locales, como gv-modulo-api).
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const ip = "198.18.12." + ((Date.now() % 250) + 1);

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
async function login(email: string, password: string) {
  const r = await request("/auth/login", "", { email, password });
  return r.body.accessToken as string;
}

let admin = "",
  seller = "";
const titulo = "QA pedido " + Date.now().toString(36);

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  seller = await login("vendedor@fitstore.demo", DEMO);
}, 120000);

afterAll(async () => {
  // Las filas de prueba quedan como solicitudes de QA; no se borran desde la API.
});

describe("pedidos de cambio", () => {
  it("cualquier usuaria crea su pedido y ve solo los suyos", async () => {
    const creado = await request("/change-requests", seller, {
      title: titulo,
      description: "Prueba de QA: el botón de cobrar cuesta verlo con sol.",
    });
    expect(creado.status).toBe(201);
    expect(creado.body.status).toBe("abierto");
    const mios = await request("/change-requests", seller);
    expect(mios.status).toBe(200);
    expect(mios.body.some((r: any) => r.title === titulo)).toBe(true);
    expect(mios.body.every((r: any) => r.userId === creado.body.userId)).toBe(
      true,
    );
  });

  it("la administración ve todos los pedidos de su empresa", async () => {
    const todos = await request("/change-requests", admin);
    expect(todos.status).toBe(200);
    expect(todos.body.some((r: any) => r.title === titulo)).toBe(true);
  });

  it("rechaza datos inválidos con 400", async () => {
    const malo = await request("/change-requests", seller, {
      title: "a",
      description: "corta",
    });
    expect(malo.status).toBe(400);
  });
});
