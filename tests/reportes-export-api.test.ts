// Exportación de reportes contra la API real (GET /reports/:name/export): el
// archivo llega con el tipo correcto, se abre y el nombre es seguro. Requiere
// API y base de datos con datos demo (ver tests/reportes-margen-api.test.ts).
import { conClave } from "./setup/con-clave";
import { beforeAll, describe, expect, it } from "vitest";

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const ip = "198.18.14." + ((Date.now() % 250) + 1);
const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santo_Domingo",
}).format(new Date());
const mes = hoy.slice(0, 7);
let admin = "";

async function get(path: string, token: string) {
  const r = await fetch(base + path, {
    headers: {
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
  });
  return {
    status: r.status,
    type: r.headers.get("content-type"),
    disp: r.headers.get("content-disposition"),
    buf: Buffer.from(await r.arrayBuffer()),
  };
}

beforeAll(async () => {
  const r = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(
      conClave("/auth/login", { email: "admin@fitstore.demo", password: DEMO }),
    ),
  });
  admin = (await r.json()).accessToken;
});

describe("exportar reportes a PDF y Excel", () => {
  it("PDF de margen por producto: archivo PDF con nombre seguro", async () => {
    const r = await get(
      `/reports/margen-por-producto/export?format=pdf&from=${mes}-01&to=${hoy}`,
      admin,
    );
    expect(r.status).toBe(200);
    expect(r.type).toBe("application/pdf");
    expect(r.buf.subarray(0, 4).toString("latin1")).toBe("%PDF");
    expect(r.disp).toMatch(
      /filename="nexora-margen-por-producto-[0-9-]*\.pdf"/,
    );
  });

  it("Excel de formas de pago: archivo ZIP de Excel", async () => {
    const r = await get(
      `/reports/formas-pago-mes/export?format=xlsx&from=${mes}-01&to=${hoy}`,
      admin,
    );
    expect(r.status).toBe(200);
    expect(r.type).toContain("spreadsheetml");
    expect(r.buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("formato inválido o reporte sin exportación: 400", async () => {
    expect(
      (await get("/reports/margen-por-producto/export?format=csv", admin))
        .status,
    ).toBe(400);
    expect(
      (await get("/reports/ventas-por-hora/export?format=pdf", admin)).status,
    ).toBe(400);
  });

  it("sin sesión: 401", async () => {
    expect(
      (await get("/reports/margen-por-producto/export?format=pdf", "")).status,
    ).toBe(401);
  });
});
