import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp } from "./setup/product-pg-app";

// PC-23 (auditoría 26-oct): anulación de pagos manuales con PostgreSQL real.
const platformToken = "operador-plataforma-anula-prueba-".padEnd(72, "0123456789abcdef");
const auth = `Platform ${platformToken}`;
let t: Awaited<ReturnType<typeof startProductApp>>;
beforeAll(async () => {
  t = await startProductApp("nexora_plataforma_anula");
  process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256").update(platformToken).digest("hex");
  process.env.PLATFORM_OPERATOR_LABEL = "dueña-nexora";
  process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
  for (const k of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM"]) delete process.env[k];
}, 180_000);
afterAll(async () => { await t?.stop(); });

const op = (method: "get" | "post", path: string, body?: unknown) => {
  const r = (t.http as any)[method]("/api/platform" + path).set("Authorization", auth);
  return method === "post" ? r.send(body ?? {}) : r;
};
async function tenant(code: string, trialDays = 30) {
  const created = await op("post", "/tenants", {
    businessName: `Piloto ${code}`, companyCode: code, businessType: "retail", plan: "basico", trialDays,
    adminName: "Dueña piloto", adminEmail: `${code}@example.invalid`, operadora: "Ana Operadora",
    acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body as { id: string };
}
const pay = (code: string, months: number, reference: string, operationId = randomUUID()) =>
  op("post", `/tenants/${code}/payments`, { operationId, amount: 2000 * months, method: "transfer", reference, months });
const voidPay = (code: string, id: string) => op("post", `/tenants/${code}/payments/${id}/void`, { reason: "Anotado por error" });
const row = async (id: string) => (await t.q(`SELECT status, "paidThroughAt", "pastDueAt", "suspendedAt" FROM "Tenant" WHERE id=$1::uuid`, id))[0];

describe("PC-23 · anular pago (A)", () => {
  it("anular el único pago de una empresa en prueba la devuelve a «prueba» sin vencimiento pagado", async () => {
    const a = await tenant("anula-unico");
    const paid = await pay("anula-unico", 1, "UNICO-1");
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    const voided = await voidPay("anula-unico", paid.body.payment.id);
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    expect(await row(a.id)).toMatchObject({ status: "trial", paidThroughAt: null, pastDueAt: null });
    expect(voided.body.tenant).toMatchObject({ slug: "anula-unico", status: "trial", paidUntil: null });
  });

  it("solo se anula el último pago vigente; el del medio da 409 y no toca el vencimiento", async () => {
    const a = await tenant("anula-medio");
    await t.q(`UPDATE "Tenant" SET status='active', "paidThroughAt"='2031-01-31T12:00:00Z' WHERE id=$1::uuid`, a.id);
    const first = await pay("anula-medio", 1, "MEDIO-1");
    const second = await pay("anula-medio", 2, "MEDIO-2");
    expect(second.body.tenant.paidUntil).toBe("2031-04-28T12:00:00.000Z");
    const middle = await voidPay("anula-medio", first.body.payment.id);
    expect(middle.status, JSON.stringify(middle.body)).toBe(409);
    expect((await row(a.id)).paidThroughAt.toISOString()).toBe("2031-04-28T12:00:00.000Z");
    expect(await t.q(`SELECT 1 FROM "PlatformPayment" WHERE "tenantId"=$1::uuid AND "voidsPaymentId" IS NOT NULL`, a.id)).toHaveLength(0);
    // De atrás hacia adelante sí: cada anulación devuelve la fecha exacta de antes de ese pago.
    expect((await voidPay("anula-medio", second.body.payment.id)).body.tenant.paidUntil).toBe("2031-02-28T12:00:00.000Z");
    const back = await voidPay("anula-medio", first.body.payment.id);
    expect(back.status, JSON.stringify(back.body)).toBe(201);
    expect(back.body.tenant).toMatchObject({ status: "active", paidUntil: "2031-01-31T12:00:00.000Z" });
  });

  it("no pisa un vencimiento ajustado a mano después del pago", async () => {
    const a = await tenant("anula-manual");
    await t.q(`UPDATE "Tenant" SET status='active', "paidThroughAt"='2031-01-31T12:00:00Z' WHERE id=$1::uuid`, a.id);
    const paid = await pay("anula-manual", 1, "MANUAL-1");
    await t.q(`UPDATE "Tenant" SET "paidThroughAt"='2032-06-15T00:00:00Z' WHERE id=$1::uuid`, a.id);
    expect((await voidPay("anula-manual", paid.body.payment.id)).status).toBe(409);
    expect((await row(a.id)).paidThroughAt.toISOString()).toBe("2032-06-15T00:00:00.000Z");
  });

  it("anular el pago de una empresa que ya había vencido no la deja «al día»", async () => {
    const a = await tenant("anula-vencido");
    await t.q(`UPDATE "Tenant" SET status='suspended', "paidThroughAt"=now() - interval '40 days', "pastDueAt"=now() - interval '40 days', "suspendedAt"=now() WHERE id=$1::uuid`, a.id);
    const paid = await pay("anula-vencido", 1, "VENCIDO-1");
    expect((await row(a.id)).status).toBe("active");
    const voided = await voidPay("anula-vencido", paid.body.payment.id);
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    const after = await row(a.id);
    expect(after.status).toBe("past_due");
    expect(after.paidThroughAt.toISOString()).toBe(paid.body.payment.paidFrom);
    expect(after.paidThroughAt.getTime()).toBeLessThanOrEqual(Date.now());
    expect(voided.body.tenant.status).toBe("past_due");
  });

  it("con dos pagos de igual vencimiento decide el id, no el orden de inserción", async () => {
    const a = await tenant("anula-empate");
    await t.q(`UPDATE "Tenant" SET status='active', "paidThroughAt"='2031-03-01T00:00:00Z' WHERE id=$1::uuid`, a.id);
    const ids = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002"];
    // El de id mayor se inserta primero: createdAt no debe desempatar.
    for (const [i, id] of [[1, ids[1]], [2, ids[0]]] as const)
      await t.q(
        `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil","createdAt")
         VALUES ($1::uuid,$2::uuid,2000,'cash',$3,1,'op','2031-02-01T00:00:00Z','2031-03-01T00:00:00Z',now() + ($4 || ' seconds')::interval)`,
        id, a.id, `EMPATE-${i}`, String(i));
    expect((await voidPay("anula-empate", ids[0])).status).toBe(409);
    expect((await voidPay("anula-empate", ids[1])).status).toBe(201);
  });
});

describe("PC-23 · repetir una operación (B)", () => {
  it("repetir la operationId de un pago ya anulado da 409; si sigue vigente devuelve el estado real", async () => {
    const a = await tenant("repite-op");
    const operationId = randomUUID();
    const paid = await pay("repite-op", 1, "REP-1", operationId);
    expect(paid.status, JSON.stringify(paid.body)).toBe(201);
    // Vigente pero la empresa ya venció: el estado que se informa es el real, no «active».
    await t.q(`UPDATE "Tenant" SET status='past_due' WHERE id=$1::uuid`, a.id);
    const again = await pay("repite-op", 1, "REP-1", operationId);
    expect(again.status, JSON.stringify(again.body)).toBe(201);
    expect(again.body.tenant.status).toBe("past_due");
    await t.q(`UPDATE "Tenant" SET status='active' WHERE id=$1::uuid`, a.id);
    expect((await voidPay("repite-op", paid.body.payment.id)).status).toBe(201);
    const replay = await pay("repite-op", 1, "REP-1", operationId);
    expect(replay.status, JSON.stringify(replay.body)).toBe(409);
    expect(replay.body.message).toMatch(/anulad/);
  });
});
