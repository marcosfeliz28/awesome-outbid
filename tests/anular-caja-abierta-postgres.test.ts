import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";

// T2 (auditoría 26-oct), con PostgreSQL real: anular una venta mientras su
// caja sigue abierta no puede dejar el efectivo esperado en negativo (aunque
// el retiro y la anulación lleguen a la vez), y una transferencia por verificar
// de una venta anulada se cierra en la misma transacción.
const id = (n: number) =>
  `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ADMIN = "30000000-0000-4000-8000-000000000002";
const TERMINAL = "30000000-0000-4000-8000-000000000004";

let t: Awaited<ReturnType<typeof startProductApp>>;
let n = 0;
const openCash = async (sessionId: string) =>
  t.q(
    `INSERT INTO "CashSession" (id,"tenantId","userId","registerId","openingAmount") VALUES ($1::uuid,$2::uuid,$3,$4,0)`,
    sessionId,
    TENANT,
    ADMIN,
    TERMINAL,
  );
const sale = async (method: string, session: string | null, status = "pending_verification") => {
  const saleId = id(100 + ++n);
  await t.q(
    `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,"cashSessionId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt") VALUES ($1::uuid,$2::uuid,$3,$1::uuid,$4::uuid,'completed',$5::uuid,100,0,0,100,50,now())`,
    saleId,
    TENANT,
    "ANU-" + n,
    ADMIN,
    session,
  );
  const paymentId = id(200 + n);
  await t.q(
    `INSERT INTO "Payment" (id,"tenantId","saleId","cashSessionId",method,amount,tendered,status) VALUES ($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,100,100,$6)`,
    paymentId,
    TENANT,
    saleId,
    session,
    method,
    method === "transfer" ? status : "ok",
  );
  return { saleId, paymentId };
};
const out = (session: string) =>
  t.post(`/cash-sessions/${session}/movements`, {
    operationId: id(300 + ++n),
    type: "out",
    amount: 100,
    reason: "Retiro de prueba",
  });
const statusOf = async (saleId: string) =>
  (await t.q(`SELECT status FROM "Sale" WHERE id=$1::uuid`, saleId))[0].status;

beforeAll(async () => {
  t = await startProductApp("nexora_anular_caja");
}, 180_000);
afterAll(async () => {
  await t?.stop();
});

describe("anular con la caja de la venta abierta", () => {
  it("no se anula si el efectivo de la venta ya salió de la caja", async () => {
    const s = id(1);
    await openCash(s);
    const { saleId } = await sale("cash", s);
    expect((await out(s)).status).toBe(201);
    const r = await t.post(`/sales/${saleId}/void`, { reason: "Error de cobro" });
    expect(r.status, JSON.stringify(r.body)).toBe(400);
    expect(r.body.message).not.toMatch(/\d{2,}/);
    expect(await statusOf(saleId)).toBe("completed");
    await t.q(`UPDATE "CashSession" SET "closedAt"=now() WHERE id=$1::uuid`, s);
  });

  it("sin retiro sí se anula, y retiro y anulación simultáneos nunca dejan negativo", async () => {
    const s = id(2);
    await openCash(s);
    const first = await sale("cash", s);
    const ok = await t.post(`/sales/${first.saleId}/void`, { reason: "Error de cobro" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(await statusOf(first.saleId)).toBe("voided");
    const second = await sale("cash", s);
    const [mov, voided] = await Promise.all([
      out(s),
      t.post(`/sales/${second.saleId}/void`, { reason: "Error de cobro" }),
    ]);
    expect([mov.status, voided.status].filter((c) => c < 300)).toHaveLength(1);
    const [row] = await t.q(
      `SELECT (SELECT COALESCE(SUM(CASE WHEN type='in' THEN amount ELSE -amount END),0) FROM "CashMovement" WHERE "sessionId"=$1::uuid)
        + (SELECT COALESCE(SUM(amount),0) FROM "Payment" p JOIN "Sale" x ON x.id=p."saleId" WHERE p."cashSessionId"=$1::uuid AND x.status='completed' AND p.method='cash') AS cash`,
      s,
    );
    expect(Number(row.cash)).toBeGreaterThanOrEqual(0);
  });
});

describe("transferencia por verificar y venta anulada", () => {
  it("al anular se cierra el pago y su alerta, y ya no aparece para conciliar", async () => {
    const { saleId, paymentId } = await sale("transfer", null);
    await t.q(
      `INSERT INTO "Alert" (id,"tenantId",key,type,severity,"entityId","branchId",message,"updatedAt") VALUES (gen_random_uuid(),$1::uuid,$2,'transfer_pending','high',$3,'main','Transferencia sin verificar',now())`,
      TENANT,
      "transfer:" + paymentId,
      saleId,
    );
    expect(
      (await t.get("/payments/pending-transfers")).body.map((x: any) => x.id),
    ).toContain(paymentId);
    const r = await t.post(`/sales/${saleId}/void`, { reason: "Cliente no pagó" });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const [p] = await t.q(`SELECT status FROM "Payment" WHERE id=$1::uuid`, paymentId);
    expect(p.status).toBe("rejected");
    const [a] = await t.q(`SELECT status FROM "Alert" WHERE key=$1`, "transfer:" + paymentId);
    expect(a.status).toBe("resolved");
    expect(
      (await t.get("/payments/pending-transfers")).body.map((x: any) => x.id),
    ).not.toContain(paymentId);
  });

  it("una transferencia ya atascada de una venta anulada tampoco se lista", async () => {
    const { saleId, paymentId } = await sale("transfer", null);
    await t.q(`UPDATE "Sale" SET status='voided' WHERE id=$1::uuid`, saleId);
    expect(
      (await t.get("/payments/pending-transfers")).body.map((x: any) => x.id),
    ).not.toContain(paymentId);
  });
});
