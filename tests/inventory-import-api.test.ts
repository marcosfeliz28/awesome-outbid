// Importar inventario (sólo administración) contra la API y PostgreSQL reales:
// vista previa sin escribir, carga atómica, actualización de existencias por
// la ruta de conteo, idempotencia, hash, estado, permisos y límites.
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
const ExcelJS = requireApi("exceljs");
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "192.0.2." + ((Date.now() % 250) + 1);
const PASSWORD = "FitStore-QA-2026!";
const ACTIVE = "FitStore-QA-Nueva-2026!";
const HEADER = [
  "ID",
  "DESCRIPCION",
  "REFERENCIA",
  "SUB-GRUPO DE ARTICULO",
  "EXISTENCIA",
  "COSTO",
  "PRECIO DETALLE",
];
const CATEGORY = "QA Importar " + suffix;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

async function json(path: string, body?: unknown, token = "") {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
}
let ownerToken = "";
async function userToken(role: string) {
  const roles = (await json("/roles", undefined, ownerToken)).body;
  const email = `qa-imp-${role}-${randomUUID().slice(0, 8)}@example.test`;
  const created = await json(
    "/users",
    {
      name: "QA importar " + role,
      email,
      password: PASSWORD,
      pin: "876543",
      roleId: roles.find((r: any) => r.name === role).id,
    },
    ownerToken,
  );
  expect(created.status, JSON.stringify(created.body)).toBeLessThan(300);
  let auth = await json("/auth/login", { email, password: PASSWORD });
  if (auth.body.requiresPasswordChange)
    auth = await json("/auth/change-password", {
      login: email,
      currentPassword: PASSWORD,
      newPassword: ACTIVE,
      confirmPassword: ACTIVE,
    });
  return auth.body.accessToken as string;
}
async function xlsx(rows: unknown[][], sheet = "Inventario") {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(HEADER);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function send(
  action: "preview" | "apply",
  token: string,
  file: Buffer | null,
  fields: Record<string, string> = {},
  name = "inventario.xlsx",
) {
  const form = new FormData();
  if (file) form.append("file", new Blob([file]), name);
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  const response = await fetch(base + "/inventory-import/" + action, {
    method: "POST",
    headers: {
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    body: form,
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* no es JSON */
  }
  return { status: response.status, body };
}
/** Vista previa y, si todo está bien, carga con el hash y el estado revisados. */
async function load(token: string, file: Buffer, update = false) {
  const fields = { updatePrices: String(update), updateStock: "true" };
  const preview = await send("preview", token, file, fields);
  expect(preview.status, JSON.stringify(preview.body)).toBe(201);
  if (preview.body.canApply === false)
    throw new Error(
      "Vista previa bloqueada: " + JSON.stringify(preview.body.blocking),
    );
  const applied = await send("apply", token, file, {
    ...fields,
    hash: preview.body.hash,
    state: preview.body.state,
  });
  return { preview: preview.body, applied };
}
const code = (n: number) => `QA${suffix}-${n}`.toUpperCase();
const sample = (n = 3) =>
  Array.from({ length: n }, (_, i) => [
    code(i),
    `Producto QA ${suffix} ${i}`,
    "",
    CATEGORY,
    10 + i,
    100 + i,
    250 + i,
  ]);
const stockOf = async (sku: string) =>
  Number(
    (await db.variant.findFirstOrThrow({ where: { sku: sku.toUpperCase() } }))
      .stock,
  );

let admin = "";
beforeAll(async () => {
  const login = await json("/auth/login", {
    email: "admin@fitstore.demo",
    password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
  });
  ownerToken = login.body.accessToken;
  expect(ownerToken).toBeTruthy();
  admin = await userToken("admin");
});
afterAll(async () => {
  // La prueba de 629 filas deja cientos de productos: se borran para no
  // engordar el catálogo de las pruebas que corren después (la caja descarga
  // el catálogo completo).
  const products = await db.product.findMany({
    where: { name: { contains: suffix } },
    select: { id: true },
  });
  const ids = products.map((p: any) => p.id);
  const variants = await db.variant.findMany({
    where: { productId: { in: ids } },
    select: { id: true },
  });
  const variantIds = variants.map((v: any) => v.id);
  await db.inventoryMovement.deleteMany({
    where: { variantId: { in: variantIds } },
  });
  await db.variant.deleteMany({ where: { id: { in: variantIds } } });
  await db.product.deleteMany({ where: { id: { in: ids } } });
  await db.category.deleteMany({ where: { name: { contains: suffix } } });
  await db.$disconnect();
});

describe("Importar inventario · permisos y archivo", () => {
  it("cajeras y gerentes reciben 403; sin sesión 401; el administrador pasa", async () => {
    const file = await xlsx(sample(1));
    for (const role of ["seller", "manager"]) {
      const token = await userToken(role);
      expect((await send("preview", token, file)).status).toBe(403);
      expect(
        (await send("apply", token, file, { hash: sha(file), state: "x" }))
          .status,
      ).toBe(403);
    }
    expect((await send("preview", "", file)).status).toBe(401);
    expect((await send("preview", admin, file)).status).toBe(201);
  });
  it("rechaza lo que no es .xlsx, un ZIP falso y archivos de más de 5 MB", async () => {
    const file = await xlsx(sample(1));
    expect((await send("preview", admin, file, {}, "datos.csv")).status).toBe(
      400,
    );
    expect(
      (await send("preview", admin, Buffer.from("no soy un zip"))).status,
    ).toBe(400);
    expect((await send("preview", admin, null)).status).toBe(400);
    expect(
      (await send("preview", admin, Buffer.alloc(5 * 1024 * 1024 + 10))).status,
    ).toBe(413);
  });
  it("más de 1500 filas se informa como error bloqueante", async () => {
    const rows = Array.from({ length: 1501 }, (_, i) => [
      `X${suffix}-${i}`,
      "Producto " + i,
      "",
      CATEGORY,
      1,
      10,
      20,
    ]);
    const r = await send("preview", admin, await xlsx(rows));
    expect(r.status).toBe(201);
    expect(r.body.canApply).toBe(false);
    expect(JSON.stringify(r.body.blocking)).toContain("1500");
  });
});

describe("Importar inventario · vista previa, carga e idempotencia", () => {
  let admin = "";
  beforeAll(async () => (admin = await userToken("admin")));
  const file = async () => xlsx(sample(3));
  it("la vista previa no escribe nada y trae cifras, categorías y el hash", async () => {
    const buffer = await file();
    const before = await db.product.count();
    const r = await send("preview", admin, buffer);
    expect(r.status).toBe(201);
    expect(await db.product.count()).toBe(before);
    expect(r.body.hash).toBe(sha(buffer));
    expect(r.body.canApply).toBe(true);
    expect(r.body.summary).toMatchObject({
      leidos: 3,
      nuevos: 3,
      nuevosActivos: 3,
      unidades: 33,
    });
    expect(r.body.newCategories).toEqual([CATEGORY]);
    expect(r.body.summary.noVienen).toBeGreaterThan(0);
    expect(await db.category.count({ where: { name: CATEGORY } })).toBe(0);
  });
  it("la carga crea productos con IVA 18 %, kardex y bitácora sin costos; repetir no duplica ni pisa", async () => {
    const buffer = await file();
    const { applied } = await load(admin, buffer);
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    expect(applied.body.summary.nuevos).toBe(3);
    const v = await db.variant.findFirstOrThrow({
      where: { sku: code(1) },
      include: { product: true },
    });
    expect(Number(v.product.taxRate)).toBe(18);
    expect(Number(v.stock)).toBe(11);
    const kardex = await db.inventoryMovement.findMany({
      where: { variantId: v.id },
    });
    expect(kardex).toHaveLength(1);
    expect(kardex[0].reason).toMatch(/^Inventario inicial/);
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: "inventory_import", entityId: sha(buffer) },
    });
    expect(audit.userId).toBeTruthy();
    const logged = JSON.stringify(audit.after);
    expect(logged).toContain(sha(buffer));
    expect(logged).not.toMatch(/"(costo|cost|price|precio)"/i);
    // Repetir: la vista previa nueva no ve cambios y la carga no mueve nada.
    const again = await load(admin, buffer);
    expect(again.preview.summary).toMatchObject({ nuevos: 0, sinCambios: 3 });
    expect(again.applied.status).toBe(201);
    expect(
      await db.variant.count({
        where: { sku: { startsWith: code(0).slice(0, -2) } },
      }),
    ).toBe(3);
    expect(await stockOf(code(1))).toBe(11);
    expect(
      await db.inventoryMovement.count({ where: { variantId: v.id } }),
    ).toBe(1);
    // La vista previa vieja ya no vale: la base cambió desde entonces.
    const stale = await send("apply", admin, buffer, {
      updatePrices: "false",
      hash: sha(buffer),
      state: (await send("preview", admin, await xlsx([]))).body.state ?? "x",
    });
    expect(stale.status).toBe(409);
  });
  it("un hash distinto al de la vista previa se rechaza y no escribe", async () => {
    const reviewed = await xlsx(
      sample(2).map((r) => [
        ...r.slice(0, 1).map((c) => c + "H"),
        ...r.slice(1),
      ]),
    );
    const other = await xlsx([
      ...sample(2).map((r) => [
        ...r.slice(0, 1).map((c) => c + "H"),
        ...r.slice(1),
      ]),
      [code(77) + "H", "Producto colado", "", CATEGORY, 1, 1, 2],
    ]);
    const preview = await send("preview", admin, reviewed);
    const before = await db.variant.count();
    const r = await send("apply", admin, other, {
      hash: preview.body.hash,
      state: preview.body.state,
    });
    expect(r.status).toBe(409);
    expect(await db.variant.count()).toBe(before);
  });
  it("un error en una fila lo informa con su número y no se guarda NADA", async () => {
    const rows = [
      ...sample(2).map((r) => [r[0] + "E", ...r.slice(1)]),
      [code(5) + "E", "Producto con error", "", CATEGORY, "abc", 10, 20],
    ];
    const buffer = await xlsx(rows);
    const preview = await send("preview", admin, buffer);
    expect(preview.body.canApply).toBe(false);
    expect(preview.body.blocking[0].row).toBe(4);
    const applied = await send("apply", admin, buffer, {
      hash: preview.body.hash,
      state: preview.body.state || "x",
    });
    expect(applied.status).toBe(400);
    expect(
      await db.variant.count({
        where: {
          sku: { endsWith: "E" },
          product: { name: { contains: suffix } },
        },
      }),
    ).toBe(0);
  });
  it("un código que ya es de otro producto detiene la carga completa", async () => {
    const rows = [
      [code(40), "Nuevo bueno " + suffix, "", CATEGORY, 1, 10, 20],
      [code(41), "Choca " + suffix, code(0), CATEGORY, 1, 10, 20],
    ];
    const r = await send("preview", admin, await xlsx(rows));
    expect(r.body.canApply).toBe(false);
    expect(r.body.blocking[0].row).toBe(3);
    expect(await db.variant.count({ where: { sku: code(40) } })).toBe(0);
  });
  it("sin precio o costo queda inactivo; la hoja se lee como valores (no se evalúan fórmulas)", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Inventario");
    ws.addRow(HEADER);
    ws.addRow([code(60), "Sin precio " + suffix, "", CATEGORY, 4, 50, 0]);
    ws.addRow([
      code(61),
      "Con fórmula " + suffix,
      "",
      CATEGORY,
      2,
      10,
      { formula: "1+1", result: 20 },
    ]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const { preview, applied } = await load(admin, buffer);
    expect(preview.summary).toMatchObject({
      nuevosInactivos: 1,
      nuevosActivos: 1,
    });
    expect(applied.status).toBe(201);
    const inactive = await db.variant.findFirstOrThrow({
      where: { sku: code(60) },
      include: { product: true },
    });
    expect(inactive.product.active).toBe(false);
    expect(
      Number(
        (await db.variant.findFirstOrThrow({ where: { sku: code(61) } })).price,
      ),
    ).toBe(20);
  });
});

describe("Importar inventario · actualización de lo ya cargado", () => {
  let admin = "";
  beforeAll(async () => (admin = await userToken("admin")));
  it("las diferencias de existencia entran como «Conteo» en el kardex; precios sólo con la opción", async () => {
    const rows = sample(3).map((r) => [r[0] + "U", ...r.slice(1)]);
    await load(admin, await xlsx(rows));
    const updated = rows.map((r, i) =>
      i === 0
        ? [r[0], r[1], r[2], r[3], 4, r[5], 999]
        : i === 1
          ? [r[0], r[1], r[2], r[3], 30, 77, r[6]]
          : r,
    );
    const buffer = await xlsx(updated);
    const preview = await send("preview", admin, buffer, {
      updatePrices: "false",
    });
    expect(preview.body.summary).toMatchObject({
      nuevos: 0,
      existencias: 2,
      sinCambios: 1,
      unidadesSuben: 19,
      unidadesBajan: 6,
      precios: 0,
    });
    expect(
      preview.body.changes.find(
        (c: any) => c.kind === "existencia" && c.id === code(0) + "U",
      ),
    ).toMatchObject({ before: 10, after: 4 });
    // La vista previa no escribió.
    expect(await stockOf(code(0) + "U")).toBe(10);
    const applied = await send("apply", admin, buffer, {
      updatePrices: "false",
      hash: preview.body.hash,
      state: preview.body.state,
    });
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    expect(await stockOf(code(0) + "U")).toBe(4);
    expect(await stockOf(code(1) + "U")).toBe(30);
    const v = await db.variant.findFirstOrThrow({
      where: { sku: code(0) + "U" },
    });
    expect(Number(v.price)).toBe(250);
    const moves = await db.inventoryMovement.findMany({
      where: { variantId: v.id, type: "count" },
    });
    expect(moves).toHaveLength(1);
    expect(Number(moves[0].qty)).toBe(-6);
    expect(Number(moves[0].balanceAfter)).toBe(4);
    expect(moves[0].reason).toMatch(/^Conteo \d{1,2}-[a-z]{3}-\d{4}$/);
    // Otra vez el mismo archivo: no vuelve a aplicar las diferencias.
    const again = await load(admin, buffer);
    expect(again.preview.summary).toMatchObject({
      existencias: 0,
      sinCambios: 3,
    });
    expect(await stockOf(code(0) + "U")).toBe(4);
    // Con «actualizar precios y costos» sí cambian, y quedan en la bitácora.
    const withPrices = await load(admin, buffer, true);
    expect(withPrices.preview.summary).toMatchObject({ precios: 1, costos: 1 });
    expect(withPrices.applied.status).toBe(201);
    expect(
      Number(
        (await db.variant.findFirstOrThrow({ where: { sku: code(0) + "U" } }))
          .price,
      ),
    ).toBe(999);
    expect(
      Number(
        (await db.variant.findFirstOrThrow({ where: { sku: code(1) + "U" } }))
          .costAvg,
      ),
    ).toBe(77);
  });
  it("si hubo una venta o movimiento después de la vista previa, no se carga nada", async () => {
    const rows = sample(2).map((r) => [r[0] + "M", ...r.slice(1)]);
    await load(admin, await xlsx(rows));
    const buffer = await xlsx(
      rows.map((r, i) => (i ? r : [...r.slice(0, 4), 3, ...r.slice(5)])),
    );
    const preview = await send("preview", admin, buffer);
    expect(preview.body.summary.existencias).toBe(1);
    // Una venta en la caja entre la vista previa y la carga.
    const v = await db.variant.findFirstOrThrow({
      where: { sku: code(1) + "M" },
    });
    await db.$transaction([
      db.variant.update({
        where: { id: v.id },
        data: { stock: { decrement: 1 } },
      }),
      db.inventoryMovement.create({
        data: {
          variantId: v.id,
          type: "sale",
          qty: -1,
          unitCost: 1,
          balanceAfter: 10,
          reason: "venta QA",
          userId: "qa",
        },
      }),
    ]);
    const applied = await send("apply", admin, buffer, {
      hash: preview.body.hash,
      state: preview.body.state,
    });
    expect(applied.status).toBe(409);
    expect(JSON.stringify(applied.body)).toContain("vista previa");
    expect(await stockOf(code(0) + "M")).toBe(10);
  });
  it("una categoría existente que exige lote detiene la carga con aviso claro", async () => {
    const name = "QA Lote " + suffix;
    await db.category.create({
      data: { name, branchId: "main", createdBy: "qa", requiresLot: true },
    });
    const r = await send(
      "preview",
      admin,
      await xlsx([[code(90), "Con lote " + suffix, "", name, 2, 10, 20]]),
    );
    expect(r.body.canApply).toBe(false);
    expect(JSON.stringify(r.body.blocking)).toContain("lote");
  });
  it("dos cargas a la vez no duplican nada", async () => {
    const buffer = await xlsx(
      sample(4).map((r) => [r[0] + "C", ...r.slice(1)]),
    );
    const preview = await send("preview", admin, buffer);
    const other = await userToken("admin");
    const fields = { hash: preview.body.hash, state: preview.body.state };
    const [a, b] = await Promise.all([
      send("apply", admin, buffer, fields),
      send("apply", other, buffer, fields),
    ]);
    expect([a.status, b.status], JSON.stringify([a.body, b.body])).toContain(
      201,
    );
    expect(a.status === 409 || b.status === 409).toBe(true);
    expect(
      await db.variant.count({
        where: {
          sku: { endsWith: "C" },
          product: { name: { contains: suffix } },
        },
      }),
    ).toBe(4);
  });
});

describe("Importar inventario · archivo de 629 filas y límite de uso", () => {
  let admin = "";
  beforeAll(async () => (admin = await userToken("admin")));
  it("vista previa y carga de 629 productos en una sola transacción", async () => {
    const cats = [CATEGORY + " A", CATEGORY + " B", CATEGORY];
    const rows = Array.from({ length: 629 }, (_, i) => [
      `B${suffix}-${1001 + i}`.toUpperCase(),
      `Producto masivo ${suffix} ${i}`,
      i % 7 === 0
        ? `78${String(Date.now()).slice(-7)}${String(i).padStart(3, "0")}`
        : "",
      i % 3 === 0 ? cats[2] : cats[i % 2],
      i % 10,
      i % 29 === 0 ? 0 : 100 + (i % 50),
      i % 31 === 0 ? 0 : 400 + (i % 90),
    ]);
    const buffer = await xlsx(rows);
    const started = Date.now();
    const { preview, applied } = await load(admin, buffer);
    expect(applied.status, JSON.stringify(applied.body)).toBe(201);
    expect(preview.summary.leidos).toBe(629);
    expect(preview.summary.nuevos).toBe(629);
    expect(Date.now() - started).toBeLessThan(60_000);
    expect(
      await db.variant.count({
        where: { sku: { startsWith: `B${suffix}-`.toUpperCase() } },
      }),
    ).toBe(629);
    const units = rows.reduce((n, r) => n + (r[4] as number), 0);
    expect(preview.summary.unidades).toBe(units);
    const kardex = await db.inventoryMovement.aggregate({
      _sum: { qty: true },
      where: { variant: { sku: { startsWith: `B${suffix}-`.toUpperCase() } } },
    });
    expect(Number(kardex._sum.qty)).toBe(units);
  });
  it("limita la frecuencia de intentos por sesión", async () => {
    const token = await userToken("admin");
    const statuses: number[] = [];
    for (let i = 0; i < 25; i++)
      statuses.push((await send("preview", token, Buffer.from("x"))).status);
    expect(statuses).toContain(429);
  });
});
