// Exportación de reportes contra la API real y PostgreSQL (CI). Cubre: tipo de
// archivo y nombre, 400 y 401, 403 sin profit:read para costo y margen, y que
// las cifras del Excel sean las mismas que las de la pantalla.
import { conClave } from "./setup/con-clave";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GUIA_REPORTES } from "../apps/api/src/reportes/guia";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const ExcelJS = requireApi("exceljs");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const suffix = Date.now().toString(36);
const ip = "198.18.14." + ((Date.now() % 250) + 1);
const hoy = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Santo_Domingo",
}).format(new Date());
const mes = hoy.slice(0, 7);
const rango = `from=${mes}-01&to=${hoy}`;
const EMAIL = `qa-export-${suffix}@example.test`;
const CLAVE = "FitStore-QA-2026!";
let admin = "";
let sinGanancia = "";
let roleId = "";

async function call(
  path: string,
  token: string,
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined
      ? {}
      : { body: JSON.stringify(conClave(path, data)) }),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  let body: any = buf;
  try {
    body = JSON.parse(buf.toString("utf8"));
  } catch {
    /* binario */
  }
  return {
    status: r.status,
    type: r.headers.get("content-type"),
    disp: r.headers.get("content-disposition"),
    buf,
    body,
  };
}
async function login(email: string, password: string) {
  const r = await call("/auth/login", "", { email, password });
  if (r.status >= 400) throw new Error("login " + email + ": " + r.status);
  return r.body.accessToken as string;
}
// Valor de la cifra clave cuyo rótulo empieza igual, en la hoja Resumen.
function cifra(libro: any, etiqueta: string) {
  const hoja = libro.getWorksheet("Resumen");
  let valor: number | undefined;
  hoja.eachRow((fila: any) => {
    if (fila.getCell(1).value === etiqueta)
      valor = Number(fila.getCell(2).value);
  });
  return valor;
}

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  const role = await db.role.create({
    data: { name: "qa-export-" + suffix, permissions: ["reports:read"] },
  });
  roleId = role.id;
  await call("/users", admin, {
    name: "QA export " + suffix,
    email: EMAIL,
    password: CLAVE,
    pin: "765432",
    roleId,
  });
  sinGanancia = await login(EMAIL, CLAVE);
});

afterAll(async () => {
  await db.user.deleteMany({ where: { email: EMAIL } });
  if (roleId) await db.role.deleteMany({ where: { id: roleId } });
  await db.$disconnect();
});

describe("exportar reportes a PDF y Excel (API y PostgreSQL)", () => {
  it("PDF de margen por producto: archivo PDF con nombre seguro", async () => {
    const r = await call(
      `/reports/margen-por-producto/export?format=pdf&${rango}`,
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
    const r = await call(
      `/reports/formas-pago-mes/export?format=xlsx&${rango}`,
      admin,
    );
    expect(r.status).toBe(200);
    expect(r.type).toContain("spreadsheetml");
    expect(r.buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("formato inválido o reporte sin exportación: 400; sin sesión: 401", async () => {
    expect(
      (await call(`/reports/margen-por-producto/export?format=csv`, admin))
        .status,
    ).toBe(400);
    expect(
      (await call(`/reports/no-existe/export?format=pdf`, admin)).status,
    ).toBe(400);
    expect(
      (await call(`/reports/margen-por-producto/export?format=pdf`, "")).status,
    ).toBe(401);
  });

  it("403: quien no tiene profit:read no exporta costo ni margen", async () => {
    const r = await call(
      `/reports/margen-por-producto/export?format=pdf&${rango}`,
      sinGanancia,
    );
    expect(r.status).toBe(403);
    const v = await call(
      `/reports/valor-inventario-almacen/export?format=xlsx&${rango}`,
      sinGanancia,
    );
    expect(v.status).toBe(403);
  });

  it("las cifras del Excel son las mismas que las de la pantalla", async () => {
    const pantalla = async (nombre: string) =>
      (await call(`/reports/${nombre}?${rango}`, admin)).body.rows as any[];
    const exportado = async (nombre: string) => {
      const r = await call(
        `/reports/${nombre}/export?format=xlsx&${rango}`,
        admin,
      );
      const libro = new ExcelJS.Workbook();
      await libro.xlsx.load(r.buf);
      return libro;
    };
    const etiqueta = (nombre: string, clave: string) =>
      `Total ${GUIA_REPORTES[nombre].columnas[clave].nombreAmigable.toLowerCase()}`;
    const redondo = (n: number) => Math.round(n * 100) / 100;

    // Margen: suma de Venta de la pantalla = cifra «Total venta» del Excel.
    const filasMargen = (await pantalla("margen-por-producto")).filter(
      (f) => f.Producto,
    );
    const ventaPantalla = redondo(
      filasMargen.reduce((t, f) => t + Number(f.Venta), 0),
    );
    const libroMargen = await exportado("margen-por-producto");
    expect(
      cifra(libroMargen, etiqueta("margen-por-producto", "Venta")),
    ).toBeCloseTo(ventaPantalla, 2);

    // Ticket promedio: suma de ventas netas por día = «Total ventas netas».
    const dias = (await pantalla("ticket-promedio")).filter(
      (f) => f.Tipo === "Día",
    );
    const netasPantalla = redondo(
      dias.reduce((t, f) => t + Number(f["Ventas netas"]), 0),
    );
    const libroTicket = await exportado("ticket-promedio");
    expect(
      cifra(libroTicket, etiqueta("ticket-promedio", "Ventas netas")),
    ).toBeCloseTo(netasPantalla, 2);

    // Cuentas por cobrar: saldo del detalle = «Total saldo que debe».
    const facturas = (await pantalla("creditos-por-antiguedad")).filter(
      (f) => f.Factura !== "Resumen",
    );
    const saldoPantalla = redondo(
      facturas.reduce((t, f) => t + Number(f.Saldo), 0),
    );
    const libroCred = await exportado("creditos-por-antiguedad");
    expect(
      cifra(libroCred, etiqueta("creditos-por-antiguedad", "Saldo")),
    ).toBeCloseTo(saldoPantalla, 2);
  });
});
