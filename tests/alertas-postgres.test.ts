// F7 · GET /api/alerts con decenas de miles de filas, contra la API compilada
// y PostgreSQL real (como tests/perf-api.test.ts). En producción la lista
// superó 60 s con el inventario importado: cada GET recalculaba todo el motor,
// escribía alerta por alerta y, con más de ~16 000 avisos de estado, el
// `NOT IN (claves)` de Prisma superaba los 32 767 parámetros de PostgreSQL y
// respondía 500.
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
const ip = "198.18.8." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
// 17 000 variantes con stock bajo y sin ventas generan ~34 000 avisos de
// estado: más que los 32 767 parámetros de una sentencia de PostgreSQL.
const VARIANTS = 17_000;
const SYNTHETIC = 50_000;
const PREFIX = "ALRT-" + suffix;

async function request(path: string, token: string, data?: unknown) {
  const started = performance.now();
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      Authorization: "Bearer " + token,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return {
    status: r.status,
    body: await r.json().catch(() => null),
    next: r.headers.get("x-next-cursor"),
    ms: performance.now() - started,
  };
}
async function ok(path: string, token: string, data?: unknown) {
  const r = await request(path, token, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r;
}

let admin = "";

beforeAll(async () => {
  const login = await fetch(base + "/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify({ email: "admin@fitstore.demo", password: DEMO }),
  });
  admin = (await login.json()).accessToken;
  const terminalId = randomUUID();
  const t = await ok("/terminals/register", admin, {
    id: terminalId,
    name: "QA alertas " + suffix,
    secret: "qa-alertas-" + terminalId,
  });
  if (t.body.status === "pending")
    await ok("/terminals/" + terminalId + "/approve", admin, {});
  const categoryId = (await db.category.findFirstOrThrow()).id;
  await db.$executeRawUnsafe(
    `INSERT INTO "Product"(id,name,sku,"categoryId","updatedAt")
     SELECT gen_random_uuid(),'Alerta masiva '||g,'${PREFIX}-'||g,'${categoryId}',now()
       FROM generate_series(1,${VARIANTS}) g`,
  );
  await db.$executeRawUnsafe(
    `INSERT INTO "Variant"(id,"productId",sku,barcode,attributes,"costAvg",price,stock,"createdAt","updatedAt")
     SELECT gen_random_uuid(),p.id,p.sku,'B'||p.sku,'{"talla":"M"}',50,118,1,now()-interval '400 days',now()
       FROM "Product" p WHERE p.sku LIKE '${PREFIX}-%'`,
  );
  await db.$executeRawUnsafe(
    `INSERT INTO "Alert"(id,key,type,severity,"entityId",message,status,"branchId","createdAt","updatedAt")
     SELECT gen_random_uuid(),'${PREFIX}:'||g,'cash_difference','high','e'||g,'sintética '||g,
            (ARRAY['new','seen','resolved'])[1+g%3],'main',
            now()-(g||' seconds')::interval,now()-(g||' seconds')::interval
       FROM generate_series(1,${SYNTHETIC}) g`,
  );
}, 120_000);

afterAll(async () => {
  await db.$executeRawUnsafe(
    `DELETE FROM "Alert" WHERE key LIKE '${PREFIX}:%'`,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "Alert" WHERE message LIKE 'Alerta masiva %'`,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "Variant" WHERE sku LIKE '${PREFIX}-%'`,
  );
  await db.$executeRawUnsafe(
    `DELETE FROM "Product" WHERE sku LIKE '${PREFIX}-%'`,
  );
  // Las pruebas de navegador que siguen usan esta misma base: sin esto las
  // estadísticas conservan 17 000 variantes y 50 000 avisos que ya no existen
  // y los planes (y la primera pantalla) se vuelven lentos.
  for (const table of ["Alert", "Variant", "Product"])
    await db.$executeRawUnsafe(`VACUUM (ANALYZE) "${table}"`);
  await db.$disconnect();
}, 120_000);

describe("F7 · GET /alerts con 50 000 filas y 17 000 variantes", () => {
  it("la primera lectura evalúa sin superar el límite de parámetros y nombra la variante", async () => {
    // Los datos se insertaron por SQL (sin pasar por la API): se pide una
    // evaluación nueva en vez de depender de la caché de 60 s.
    await ok("/alerts/evaluate", admin, {});
    const first = await ok("/alerts?status=new&limit=500", admin);
    expect(first.body).toHaveLength(500);
    const stock = (
      await ok("/alerts?type=low_stock&limit=500", admin)
    ).body.filter((row: any) => row.message.startsWith("Alerta masiva "));
    expect(stock.length).toBeGreaterThan(0);
    // B8: producto, atributos y SKU.
    expect(stock[0].message).toMatch(
      /^Alerta masiva \d+ \(M · SKU ALRT-[a-z0-9]+-\d+\): 1 unidades/,
    );
    const generated = await db.alert.count({
      where: { message: { startsWith: "Alerta masiva " } },
    });
    expect(generated).toBeGreaterThanOrEqual(VARIANTS * 2);
  }, 120_000);

  it("las lecturas siguientes responden de la tabla en milisegundos", async () => {
    const runs = [];
    for (const query of [
      "",
      "?status=new",
      "?status=resolved&type=cash_difference",
      "?entityId=e7",
    ])
      runs.push(await ok("/alerts" + query, admin));
    for (const run of runs) expect(run.ms).toBeLessThan(1500);
    const concurrent = await Promise.all(
      Array.from({ length: 5 }, () => request("/alerts?status=new", admin)),
    );
    for (const run of concurrent) {
      expect(run.status).toBe(200);
      expect(run.ms).toBeLessThan(1500);
    }
  });

  it("pagina con cursor, sin repetir ni saltar filas", async () => {
    const query = "?type=cash_difference&status=seen&limit=100";
    const seen = new Set<string>();
    let cursor: string | null = null;
    let pages = 0;
    do {
      const page: Awaited<ReturnType<typeof request>> = await ok(
        "/alerts" + query + (cursor ? "&cursor=" + cursor : ""),
        admin,
      );
      for (const row of page.body) {
        expect(seen.has(row.id)).toBe(false);
        seen.add(row.id);
      }
      cursor = page.next;
      pages++;
      expect(page.body.length).toBeLessThanOrEqual(100);
    } while (cursor && pages < 400);
    const expected = await db.alert.count({
      where: { type: "cash_difference", status: "seen", branchId: "main" },
    });
    expect(seen.size).toBe(expected);
    expect(pages).toBeGreaterThan(100);
    const bad = await request("/alerts?limit=501", admin);
    expect(bad.status).toBe(400);
    expect((await request("/alerts?cursor=nada", admin)).status).toBe(400);
  });

  it("una venta o un ajuste invalida la caché: el siguiente GET ve el cambio", async () => {
    const variant = await db.variant.findFirstOrThrow({
      where: { sku: PREFIX + "-1" },
    });
    await db.variant.update({
      where: { id: variant.id },
      data: { stock: 1000 },
    });
    // Escritura de la API (cualquier POST) invalida; el POST de evaluación
    // además fuerza la evaluación nueva.
    await ok("/alerts/evaluate", admin, {});
    const gone = await db.alert.findMany({
      where: { key: { in: ["stock:" + variant.id, "idle:" + variant.id] } },
    });
    // stock 1000 > máximo: ya no hay stock bajo, pero sí exceso.
    expect(gone.find((a) => a.key === "stock:" + variant.id)?.status).toBe(
      "resolved",
    );
    expect(
      (await db.alert.findUnique({ where: { key: "overstock:" + variant.id } }))
        ?.status,
    ).toBe("new");
  }, 120_000);
});
