import { createRequire } from "node:module";
import { join, resolve } from "node:path";
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

  it("bandera ENCENDIDA: al cerrar la caja la cajera vuelve a ver los importes", async () => {
    process.env[FLAG] = "1";
    await t.q(`UPDATE "CashSession" SET "closedAt"=now() WHERE id=$1::uuid`, OPEN);
    const sale = byNumber(await list(cajera), "QA-2");
    expect(Number(sale.total)).toBe(123.45);
    expect(sale.hiddenUntilClose).toBeUndefined();
    expect(sale.payments).toHaveLength(1);
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
