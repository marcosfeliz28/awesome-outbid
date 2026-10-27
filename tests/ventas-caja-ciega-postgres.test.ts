import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";
import { hideSaleAmounts } from "../apps/api/src/sales";


// B-01: con NEXORA_VENTAS_CAJA_CIEGA=1 y la caja abierta, GET /api/sales no
// entrega importes de las ventas de esa caja a quien no ve el esperado; con la
// bandera apagada (por defecto) la respuesta no cambia.
const apiRequire = createRequire(
  join(resolve(import.meta.dirname, ".."), "apps/api/package.json"),
);
const NAME = "nexora_ventas_ciega";
const SECRET = "clave-exclusiva-de-prueba-" + NAME.padEnd(32, "x");
const id = (n: number) =>
  `51000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TERMINAL = "30000000-0000-4000-8000-000000000004";
const FLAG = "NEXORA_VENTAS_CAJA_CIEGA";

let t: Awaited<ReturnType<typeof startProductApp>>;
let as: (user: string, session: string) => (path: string) => any;
const cajera = { user: id(11), session: id(12) };
const admin = { user: id(13), session: id(14) };
const OLD = id(31);
const OPEN = id(30);

// PDFKit guarda el texto en hexadecimal dentro de streams Flate.
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const pieces: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    let c = Buffer.from(m[1], "latin1");
    try { c = inflateSync(c); } catch { continue; }
    for (const h of c.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      pieces.push(Buffer.from(h[1], "hex").toString("latin1"));
  }
  return pieces.join("");
}
const receipt = async (who: typeof cajera, saleN: number) => {
  const r = await as(who.user, who.session)("/sales/" + id(100 + saleN) + "/receipt.pdf")
    .buffer(true)
    .parse((res: any, done: any) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
  expect(r.status).toBe(200);
  return pdfText(r.body);
};

const list = async (who: typeof cajera) => {
  const r = await as(who.user, who.session)("/sales");
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r;
};
const byNumber = (r: any, n: string) =>
  r.body.find((s: any) => s.number === n);

beforeAll(async () => {
  t = await startProductApp(NAME);
  const { JwtService } = apiRequire("@nestjs/jwt");
  const jwt = new JwtService({ secret: SECRET });
  as = (user, session) => (path) =>
    (t.http as any)
      .get("/api" + path)
      .set(
        "Authorization",
        "Bearer " +
          jwt.sign({
            sub: user,
            sid: session,
            type: "access",
            version: 0,
            tenantId: TENANT,
          }),
      );
  const q = t.q;
  for (const [n, name, perms] of [
    [1, "Cajera", "'sale:write','cash:write'"],
    [2, "Admin", "'*'"],
  ] as const)
    await q(
      `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,$3,ARRAY[${perms}],now())`,
      id(n),
      TENANT,
      name + " B01",
    );
  for (const [u, name, role] of [
    [cajera, "Cajera Uno", id(1)],
    [admin, "Admin Uno", id(2)],
  ] as const) {
    await q(
      `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$4,'test-only','test-only',$5::uuid,'main',now())`,
      u.user,
      TENANT,
      name,
      u.user + "@example.invalid",
      role,
    );
    await q(
      `INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
      u.session,
      TENANT,
      u.user,
      TERMINAL,
    );
  }
  // Una caja ya cerrada y la caja abierta de la cajera.
  await q(
    `INSERT INTO "CashSession" (id,"tenantId","userId","openingAmount","openedAt","closedAt") VALUES ($1::uuid,$2::uuid,$3,100,now()-interval '2 days',now()-interval '1 day')`,
    OLD,
    TENANT,
    cajera.user,
  );
  await q(
    `INSERT INTO "CashSession" (id,"tenantId","userId","openingAmount") VALUES ($1::uuid,$2::uuid,$3,500)`,
    OPEN,
    TENANT,
    cajera.user,
  );
  const sale = async (n: number, session: string, total: number) => {
    const saleId = id(100 + n);
    await q(
      `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,"cashSessionId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$1::uuid,$4::uuid,'completed',$5::uuid,$6,0,0,$6,1,now())`,
      saleId,
      TENANT,
      "QA-" + n,
      cajera.user,
      session,
      total,
    );
    await q(
      `INSERT INTO "Payment" (id,"tenantId","saleId","cashSessionId",method,amount,tendered,change) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,'cash',$5,$5+7,7)`,
      id(200 + n),
      TENANT,
      saleId,
      session,
      total,
    );
  };
  await sale(1, OLD, 321.45);
  await sale(2, OPEN, 123.45);
  // Sin caja asignada: una creada después de la apertura (rama createdAt >=
  // openedAt) y otra anterior a ella.
  await sale(6, null as any, 77.77);
  await sale(7, null as any, 55.55);
  await q(`UPDATE "Sale" SET "createdAt"=now()-interval '3 days' WHERE id=$1::uuid`, id(107));
  // Solicitudes de anulación de la caja abierta y de la cerrada.
  for (const [n, saleN] of [[1, 2], [2, 1]] as const)
    await q(
      `INSERT INTO "SaleVoidRequest" (id,"tenantId","saleId","requestedById","operationId","reasonCode",reason,"updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$1::uuid,'payment_error','Error al cobrar',now())`,
      id(400 + n), TENANT, id(100 + saleN), cajera.user,
    );
  // Ventas a crédito: en la caja abierta (100 en efectivo + 200 a crédito,
  // abono de 50 en efectivo a esa caja), en la caja vieja con un abono de 40 a
  // la caja abierta, y en la caja vieja con su propio abono (visible siempre).
  const pay = (n: number, saleN: number, session: string, entry: string, method: string, amount: number) =>
    q(
      `INSERT INTO "Payment" (id,"tenantId","saleId","cashSessionId","entryType",method,amount,tendered) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$7)`,
      id(300 + n), TENANT, id(100 + saleN), session, entry, method, amount,
    );
  const credit = async (n: number, session: string, total: number, balance: number) => {
    await q(
      `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,"cashSessionId",subtotal,"discountTotal","taxTotal",total,"costTotal","creditBalance","receivableKind","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$1::uuid,$4::uuid,'completed',$5::uuid,$6,0,0,$6,1,$7,'credit',now())`,
      id(100 + n), TENANT, "QA-" + n, cajera.user, session, total, balance,
    );
  };
  await credit(3, OPEN, 300, 150);
  await pay(1, 3, OPEN, "sale", "cash", 100);
  await pay(2, 3, OPEN, "sale", "credit", 200);
  await pay(3, 3, OPEN, "installment", "cash", 50);
  await credit(4, OLD, 400, 210);
  await pay(4, 4, OLD, "sale", "credit", 400);
  await pay(5, 4, OLD, "installment", "cash", 150);
  await pay(6, 4, OPEN, "installment", "cash", 40);
  await credit(5, OLD, 500, 450);
  await pay(7, 5, OLD, "sale", "credit", 500);
  await pay(8, 5, OLD, "installment", "cash", 50);
}, 180_000);
afterAll(async () => {
  delete process.env[FLAG];
  await t?.stop();
});

describe("Ventas con caja ciega (B-01)", () => {
  it("bandera APAGADA: la cajera con caja abierta recibe lo de siempre", async () => {
    delete process.env[FLAG];
    const sale = byNumber(await list(cajera), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(sale.payments).toHaveLength(1);
    expect(sale.payments[0]).toMatchObject({ method: "cash" });
    expect(Number(sale.payments[0].amount)).toBe(123.45);
    expect(Number(sale.payments[0].change)).toBe(7);
  });

  it("bandera ENCENDIDA: sin importes de la caja abierta en la respuesta cruda", async () => {
    process.env[FLAG] = "1";
    const r = await list(cajera);
    const sale = byNumber(r, "QA-2");
    expect(sale).toMatchObject({
      number: "QA-2",
      status: "completed",
      hiddenUntilClose: true,
      total: null,
      subtotal: null,
      taxTotal: null,
      payments: [],
    });
    expect(sale.createdAt).toBeTruthy();
    expect(JSON.stringify(sale)).not.toMatch(/123\.45|"cash"|"change"|"tendered"/);
    // La caja ya cerrada sigue visible: no ayuda a deducir la abierta.
    const old = byNumber(r, "QA-1");
    expect(Number(old.total)).toBe(321.45);
    expect(old.payments).toHaveLength(1);
  });

  it("bandera ENCENDIDA: la administradora recibe todo", async () => {
    process.env[FLAG] = "1";
    const sale = byNumber(await list(admin), "QA-2");
    // La administradora ve las ventas de todas las vendedoras.
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(Number(sale.payments[0].amount)).toBe(123.45);
  });

  it("bandera ENCENDIDA: /cod/pending no entrega importes de la caja abierta", async () => {
    process.env[FLAG] = "1";
    const r = await as(cajera.user, cajera.session)("/cod/pending");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const row = (n: string) => r.body.find((s: any) => s.number === n);
    for (const n of ["QA-3", "QA-4"]) {
      // QA-4 es de la caja vieja, pero tiene un abono a la caja abierta.
      expect(row(n), n).toMatchObject({
        hiddenUntilClose: true,
        total: null,
        codAmount: null,
        receivableAmount: null,
        collected: null,
        pending: null,
        pendingVerification: null,
        collections: [],
      });
    }
    // Una venta de la caja vieja con abono a la vieja sigue visible.
    expect(row("QA-5")).toMatchObject({ total: 500, pending: 450, collected: 50 });
    expect(row("QA-5").hiddenUntilClose).toBeUndefined();
    expect(row("QA-5").collections).toHaveLength(1);
    const owner = await as(admin.user, admin.session)("/cod/pending");
    expect(owner.body.find((s: any) => s.number === "QA-3")).toMatchObject({ total: 300, pending: 150, collected: 50 });
  });

  it("bandera ENCENDIDA: venta sin caja creada tras la apertura queda oculta; la anterior no", async () => {
    process.env[FLAG] = "1";
    const r = await list(cajera);
    expect(byNumber(r, "QA-6")).toMatchObject({ total: null, payments: [], hiddenUntilClose: true });
    expect(Number(byNumber(r, "QA-7").total)).toBe(55.55);
    expect(byNumber(r, "QA-7").hiddenUntilClose).toBeUndefined();
  });

  it("bandera ENCENDIDA: /void-requests oculta importes de la caja abierta", async () => {
    process.env[FLAG] = "1";
    const r = await as(cajera.user, cajera.session)("/void-requests");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const open = r.body.find((v: any) => v.sale.number === "QA-2").sale;
    expect(open).toMatchObject({ total: null, payments: [], hiddenUntilClose: true });
    expect(JSON.stringify(open)).not.toMatch(/123.45|"cash"/);
    const old = r.body.find((v: any) => v.sale.number === "QA-1").sale;
    expect(Number(old.total)).toBe(321.45);
    expect(old.payments).toHaveLength(1);
    const owner = await as(admin.user, admin.session)("/void-requests");
    expect(Number(owner.body.find((v: any) => v.sale.number === "QA-2").sale.total)).toBe(123.45);
  });

  it("bandera APAGADA: misma forma de respuesta, sin hiddenUntilClose, en /sales, /cod/pending y /void-requests", async () => {
    delete process.env[FLAG];
    const keys = (o: any) => Object.keys(o).sort();
    const sales = (await list(cajera)).body;
    // Todas las ventas tienen las mismas llaves que una de la caja cerrada.
    const baseKeys = keys(byNumber({ body: sales }, "QA-1"));
    for (const n of ["QA-2", "QA-6"]) {
      expect(keys(byNumber({ body: sales }, n)), n).toEqual(baseKeys);
      expect(byNumber({ body: sales }, n).hiddenUntilClose).toBeUndefined();
    }
    expect(Number(byNumber({ body: sales }, "QA-6").total)).toBe(77.77);
    const cod = (await as(cajera.user, cajera.session)("/cod/pending")).body;
    const q3 = cod.find((s: any) => s.number === "QA-3");
    expect(q3).toMatchObject({ total: 300, receivableAmount: 200, collected: 50, pending: 150 });
    expect(q3.collections).toHaveLength(1);
    expect(keys(q3)).toEqual(keys(cod.find((s: any) => s.number === "QA-5")));
    expect(q3.hiddenUntilClose).toBeUndefined();
    const vr = (await as(cajera.user, cajera.session)("/void-requests")).body;
    const sale2 = vr.find((v: any) => v.sale.number === "QA-2").sale;
    expect(Number(sale2.total)).toBe(123.45);
    expect(sale2.hiddenUntilClose).toBeUndefined();
    expect(keys(sale2)).toEqual(keys(vr.find((v: any) => v.sale.number === "QA-1").sale));
  });

  it("bandera ENCENDIDA: receipt.pdf de la caja abierta sale sin importes; la administradora y la caja cerrada, completos", async () => {
    process.env[FLAG] = "1";
    const blind = await receipt(cajera, 2);
    expect(blind).toContain("QA-2");
    expect(blind).toContain("cerrar tu caja");
    expect(blind).not.toMatch(/123[.]45|130[.]45|Forma de pago|Subtotal|ITBIS|RD[$]/);
    // Venta sin caja posterior a la apertura: también oculta.
    expect(await receipt(cajera, 6)).not.toMatch(/77[.]77/);
    expect(await receipt(cajera, 1)).toContain("321.45");
    expect(await receipt(admin, 2)).toContain("123.45");
    delete process.env[FLAG];
    const off = await receipt(cajera, 2);
    expect(off).toContain("123.45");
    expect(off).toContain("Forma de pago");
    expect(off).not.toContain("cerrar tu caja");
  });

  it("bandera ENCENDIDA: al cerrar la caja la cajera vuelve a ver los importes", async () => {
    process.env[FLAG] = "1";
    await t.q(`UPDATE "CashSession" SET "closedAt"=now() WHERE id=$1::uuid`, OPEN);
    const sale = byNumber(await list(cajera), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(sale.payments).toHaveLength(1);
  });

  it("Management.tsx: el detalle de venta no formatea importes ocultos (null) sin saleMoney", () => {
    const src = readFileSync(
      resolve(import.meta.dirname, "../apps/web/src/Management.tsx"),
      "utf8",
    );
    const detail = src.slice(
      src.indexOf("export function SalesHistory"),
      src.indexOf("export function SalesHistory") + 30000,
    );
    expect(detail).not.toMatch(
      /formatMoney[(](selected[.](discountTotal|total|subtotal|taxTotal)|p[.](amount|tendered|change)|i[.](unitPrice|discount|tax|lineTotal))/,
    );
  });

  it("hideSaleAmounts conserva número, estado y artículos sin importes", () => {
    const hidden = hideSaleAmounts({
      number: "X-1",
      status: "completed",
      subtotal: 1,
      discountTotal: 1,
      taxTotal: 1,
      total: 1,
      creditBalance: 1,
      items: [
        { qty: 2, returnedQty: 0, unitPrice: 1, discount: 0, tax: 0, lineTotal: 2, variant: { sku: "S" } },
      ],
      payments: [{ method: "cash", amount: 1 }],
      returns: [{ number: "D-1", total: 1, taxTotal: 0, refundAmount: 1, refundMethod: "cash" }],
    });
    expect(hidden).toMatchObject({
      number: "X-1",
      status: "completed",
      total: null,
      payments: [],
      hiddenUntilClose: true,
    });
    expect(hidden.items[0]).toMatchObject({ qty: 2, lineTotal: null, unitPrice: null, variant: { sku: "S" } });
    expect(hidden.returns[0]).toMatchObject({ number: "D-1", total: null, refundAmount: null });
  });
});
