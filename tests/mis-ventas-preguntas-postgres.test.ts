import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";
import { isOwnSalesTodayQuestion } from "../apps/api/src/assistant";

// «Mis ventas de hoy», preguntas rápidas sin IA y encuesta de la caja, con
// PostgreSQL real: cada quien ve lo suyo, sin costos, sin el esperado de una
// caja abierta, sin cruzar empresas y sin gastar la cuota del asistente.
const apiRequire = createRequire(
  join(resolve(import.meta.dirname, ".."), "apps/api/package.json"),
);
const NAME = "nexora_mis_ventas";
const SECRET = "clave-exclusiva-de-prueba-" + NAME.padEnd(32, "x");
const B = "00000000-0000-0000-0000-000000000002";
const id = (n: number) =>
  `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const TERMINAL = "30000000-0000-4000-8000-000000000004";

let t: Awaited<ReturnType<typeof startProductApp>>;
let as: (
  user: string,
  session: string,
  tenant?: string,
) => (m: "get" | "post", path: string) => any;
const cajera = { user: id(11), session: id(12) };
const otra = { user: id(13), session: id(14) };
const sinVenta = { user: id(15), session: id(16) };
const cajeraB = { user: id(21), session: id(22) };

beforeAll(async () => {
  t = await startProductApp(NAME);
  const { JwtService } = apiRequire("@nestjs/jwt");
  const jwt = new JwtService({ secret: SECRET });
  as =
    (user, session, tenant = TENANT) =>
    (m, path) => {
      const token = jwt.sign({
        sub: user,
        sid: session,
        type: "access",
        version: 0,
        tenantId: tenant,
      });
      const http = t.http as any;
      return http[m]("/api" + path).set("Authorization", "Bearer " + token);
    };
  const q = t.q;
  await q(
    `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1::uuid,'empresa-b-ventas','Empresa B',now())`,
    B,
  );
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Cajera',ARRAY['sale:write','cash:write'],now())`,
    id(1),
    TENANT,
  );
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Solo reportes',ARRAY['reports:read'],now())`,
    id(2),
    TENANT,
  );
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Cajera',ARRAY['sale:write'],now())`,
    id(3),
    B,
  );
  await q(
    `INSERT INTO "Terminal" (id,"tenantId",name,"branchId","approvedAt","secretHash") VALUES ($1::uuid,$2::uuid,'Equipo B','main',now(),'test-only')`,
    id(4),
    B,
  );
  const users: [typeof cajera, string, string, string, string][] = [
    [cajera, "Cajera Uno", id(1), TENANT, TERMINAL],
    [otra, "Cajera Dos", id(1), TENANT, TERMINAL],
    [sinVenta, "Solo Reportes", id(2), TENANT, TERMINAL],
    [cajeraB, "Cajera de B", id(3), B, id(4)],
  ];
  for (const [u, name, role, tenant, terminal] of users) {
    await q(
      `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$4,'test-only','test-only',$5::uuid,'main',now())`,
      u.user,
      tenant,
      name,
      u.user + "@example.invalid",
      role,
    );
    await q(
      `INSERT INTO "AuthSession" (id,"tenantId","userId","terminalId") VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid)`,
      u.session,
      tenant,
      u.user,
      terminal,
    );
  }
  // Caja abierta de la cajera: lo cobrado en ella no se desglosa (cierre ciego).
  await q(
    `INSERT INTO "CashSession" (id,"tenantId","userId","openingAmount") VALUES ($1::uuid,$2::uuid,$3,500)`,
    id(30),
    TENANT,
    cajera.user,
  );
  let n = 0;
  const sale = async (
    tenant: string,
    seller: string,
    total: number,
    method: string,
    opts: { status?: string; session?: string } = {},
  ) => {
    const saleId = id(100 + ++n);
    await q(
      `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,"cashSessionId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$1::uuid,$4::uuid,$5,$6::uuid,$7,0,0,$7,$8,now())`,
      saleId,
      tenant,
      "QA-" + n,
      seller,
      opts.status ?? "completed",
      opts.session ?? null,
      total,
      total / 2,
    );
    await q(
      `INSERT INTO "Payment" (id,"tenantId","saleId","cashSessionId",method,amount,tendered) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$6)`,
      id(200 + n),
      tenant,
      saleId,
      opts.session ?? null,
      method,
      total,
    );
    return saleId;
  };
  const first = await sale(TENANT, cajera.user, 100, "cash");
  await sale(TENANT, cajera.user, 50, "card", { session: id(30) });
  await sale(TENANT, cajera.user, 30, "credit");
  await sale(TENANT, cajera.user, 999, "cash", { status: "voided" });
  const ajena = await sale(TENANT, otra.user, 500, "cash");
  // Una transferencia propia sin verificar y un abono de la dueña por
  // transferencia sobre la misma venta: solo la primera es de la cajera.
  for (const [n2, type, amount] of [
    [1, "sale", 40],
    [2, "installment", 60],
  ] as const)
    await q(
      `INSERT INTO "Payment" (id,"tenantId","saleId",method,amount,tendered,status,"entryType") VALUES ($1::uuid,$2::uuid,$3::uuid,'transfer',$4,$4,'pending_verification',$5)`,
      id(400 + n2),
      TENANT,
      ajena,
      amount,
      type,
    );
  await sale(B, cajeraB.user, 700, "transfer");
  await q(
    `INSERT INTO "SaleReturn" (id,"tenantId","saleId",number,reason,total,"taxTotal","costTotal","refundAmount","refundMethod","userId",items) VALUES ($1::uuid,$2::uuid,$3::uuid,'DEV-QA','Prueba',20,0,10,20,'cash',$4,'[]'::jsonb)`,
    id(300),
    TENANT,
    first,
    cajera.user,
  );
}, 180_000);
afterAll(async () => {
  delete process.env.ANTHROPIC_API_KEY;
  await t?.stop();
});

describe("mis ventas de hoy", () => {
  it("con caja propia abierta la cajera solo ve conteos: ningún importe", async () => {
    const r = await as(cajera.user, cajera.session)("get", "/sales/mine/today");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toEqual({
      day: r.body.day,
      from: r.body.day,
      invoices: 3,
      units: 0,
      hiddenUntilClose: true,
      topProduct: null,
    });
    expect(JSON.stringify(r.body)).not.toMatch(
      /cost|margin|profit|expected|total|methods|pending|lastSale|amount/i,
    );
    const week = await as(cajera.user, cajera.session)(
      "get",
      "/sales/mine/week",
    );
    expect(week.status).toBe(200);
    expect(week.body.hiddenUntilClose).toBe(true);
    expect(week.body.total).toBeUndefined();
    expect(
      (await as(cajera.user, cajera.session)("get", "/sales/mine/mes")).status,
    ).toBe(400);
  });
  it("otra vendedora, otra empresa y un rol sin ventas no se cruzan", async () => {
    expect(
      (await as(otra.user, otra.session)("get", "/sales/mine/today")).body,
    ).toMatchObject({
      invoices: 1,
      total: 500,
      pendingTransfers: { count: 1, amount: 40 },
    });
    expect(
      (await as(cajeraB.user, cajeraB.session, B)("get", "/sales/mine/today"))
        .body,
    ).toMatchObject({ invoices: 1, total: 700, methods: { transfer: 700 } });
    expect(
      (await as(sinVenta.user, sinVenta.session)("get", "/sales/mine/today"))
        .status,
    ).toBe(403);
    // La administración (ve el arqueo) recibe sus propias ventas: ninguna.
    expect((await t.get("/sales/mine/today")).body).toMatchObject({
      invoices: 0,
      total: 0,
      hiddenUntilClose: false,
    });
  });
});

describe("atajo del asistente", () => {
  it("reconoce solo la pregunta de hoy propia", () => {
    for (const ok of [
      "¿Cuánto vendí hoy?",
      "cuanto he vendido hoy",
      "mis ventas de hoy",
      "Mis ventas hoy.",
    ])
      expect(isOwnSalesTodayQuestion(ok), ok).toBe(true);
    for (const no of [
      "¿Cuánto vendí ayer?",
      "cuánto vendió María hoy",
      "mis ventas de hoy y de ayer",
      "ventas de hoy",
    ])
      expect(isOwnSalesTodayQuestion(no), no).toBe(false);
  });
  it("responde sin modelo y sin gastar cuota", async () => {
    process.env.ANTHROPIC_API_KEY = "clave-falsa-sin-red";
    const before = await as(cajera.user, cajera.session)(
      "get",
      "/assistant/usage",
    );
    const r = await as(cajera.user, cajera.session)(
      "post",
      "/assistant/ask",
    ).send({ messages: [{ role: "user", content: "¿Cuánto vendí hoy?" }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.answer).toContain("3 facturas");
    expect(r.body.answer).not.toMatch(/RD\$|\d{2,}\.\d\d|Efectivo/);
    expect(r.body.remaining).toBeNull();
    const after = await as(cajera.user, cajera.session)(
      "get",
      "/assistant/usage",
    );
    expect(after.body.usadas).toBe(before.body.usadas);
    const logged = await t.q(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE action LIKE 'assistant.ask%'`,
    );
    expect(logged[0].n).toBe(0);
  });
});

describe("encuesta de la caja", () => {
  it("una respuesta editable por persona, validada y aislada por empresa", async () => {
    const mine = as(cajera.user, cajera.session);
    expect((await mine("get", "/survey/mine")).body.answers).toBeNull();
    const saved = await mine("post", "/survey/mine").send({
      answers: {
        cobro_rapido: 4,
        cobro_pasos: false,
        buscar_como: "Lector de código",
        mejorar: "Más rápido",
      },
    });
    expect(saved.status, JSON.stringify(saved.body)).toBe(201);
    expect(
      (
        await mine("post", "/survey/mine").send({
          answers: { cobro_rapido: 5, mejorar: "Más rápido" },
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await mine("post", "/survey/mine").send({
          answers: { cobro_rapido: 9 },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await mine("post", "/survey/mine").send({
          answers: { inventada: true },
        })
      ).status,
    ).toBe(400);
    expect((await mine("get", "/survey/mine")).body.answers).toEqual({
      cobro_rapido: 5,
      mejorar: "Más rápido",
    });
    expect(
      (
        await as(
          cajeraB.user,
          cajeraB.session,
          B,
        )("post", "/survey/mine").send({ answers: { mejorar: "TEXTO_DE_B" } })
      ).status,
    ).toBe(201);
    const rows = await t.q(
      `SELECT "tenantId"::text AS tenant, count(*)::int AS n FROM "CashierSurvey" GROUP BY 1 ORDER BY 1`,
    );
    expect(rows).toEqual([
      { tenant: TENANT, n: 1 },
      { tenant: B, n: 1 },
    ]);
    expect((await mine("get", "/survey/summary")).status).toBe(403);
    const summary = await t.get("/survey/summary");
    expect(summary.status).toBe(200);
    expect(summary.body.responses).toBe(1);
    expect(summary.body.questions).toHaveLength(30);
    expect(
      summary.body.questions.find((q: any) => q.id === "cobro_rapido"),
    ).toMatchObject({ average: 5, counts: { "5": 1 } });
    expect(
      summary.body.questions.find((q: any) => q.id === "mejorar").texts,
    ).toEqual([{ name: "Cajera Uno", text: "Más rápido" }]);
    expect(JSON.stringify(summary.body)).not.toContain("TEXTO_DE_B");
  });
});

describe("al cerrar la caja", () => {
  it("los importes de lo vendido reaparecen", async () => {
    await t.q(
      `UPDATE "CashSession" SET "closedAt"=now() WHERE id=$1::uuid`,
      id(30),
    );
    const r = await as(cajera.user, cajera.session)("get", "/sales/mine/today");
    expect(r.body).toMatchObject({
      invoices: 3,
      total: 160,
      hiddenUntilClose: false,
      methods: { cash: 80, card: 50, transfer: 0, credit: 30 },
    });
  });
});
