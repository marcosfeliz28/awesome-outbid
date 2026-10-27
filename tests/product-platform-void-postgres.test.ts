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

describe("PC-23 · referencia única en la base (C)", () => {
  it("la base rechaza una referencia vigente repetida en la empresa (aunque no pase por la API), pero no tras anularla ni en otra empresa", async () => {
    const a = await tenant("ref-a");
    const b = await tenant("ref-b");
    const insert = (tenantId: string, reference: string, extra = "", id = randomUUID()) => t.q(
      `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil"${extra ? ',"voidsPaymentId","voidReason"' : ""})
       VALUES ($1::uuid,$2::uuid,2000,'cash',$3,1,'op',now(),now() + interval '30 days'${extra ? `,$4::uuid,'anulado por error'` : ""})`,
      ...(extra ? [id, tenantId, reference, extra] : [id, tenantId, reference]));
    const first = randomUUID();
    await insert(a.id, "BHD-77", "", first);
    await expect(insert(a.id, " bhd-77 ")).rejects.toThrow(/23505/);
    await insert(b.id, "BHD-77"); // otra empresa: permitido
    // Anulada (la fila de anulación copia la referencia y no cuenta): se puede volver a anotar.
    await insert(a.id, "BHD-77", first);
    await insert(a.id, "bhd-77");
    await expect(insert(a.id, "B H D-77")).rejects.toThrow(/23505/);
  });
});

describe("PC-23 · exportación de la empresa (D)", () => {
  it("la exportación de la empresa no incluye el motivo interno de la anulación", async () => {
    const created = await op("post", "/tenants", {
      businessName: "Piloto exporta", companyCode: "exporta-void", businessType: "retail", plan: "basico",
      adminName: "Dueña piloto", adminEmail: "exporta-void@example.invalid", operadora: "Ana Operadora",
      acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
    });
    const password = "ClaveSegura-2026!";
    const token = created.body.invitationUrl.split("#token=")[1];
    expect((await t.http.post("/api/auth/accept-invitation").send({ token, password, managerPin: "869253", consentAccepted: true })).status).toBe(201);
    const login = await t.http.post("/api/auth/login").set("x-tenant-id", "exporta-void").send({ login: "exporta-void@example.invalid", password });
    const paid = await pay("exporta-void", 1, "EXP-1");
    expect((await op("post", `/tenants/exporta-void/payments/${paid.body.payment.id}/void`, { reason: "MOTIVO-INTERNO-SECRETO" })).status).toBe(201);
    const exported = await t.http.get("/api/tenant/export?format=json").set("Authorization", `Bearer ${login.body.accessToken}`)
      .buffer(true).parse((res: any, cb: any) => { let s = ""; res.on("data", (c: any) => { s += c; }); res.on("end", () => cb(null, s)); });
    expect(exported.status).toBe(200);
    expect(exported.body).toContain("EXP-1"); // sus pagos sí salen
    expect(exported.body).not.toContain("MOTIVO-INTERNO-SECRETO");
  });
});

describe("PC-23 · referencia con aspecto de tarjeta (E)", () => {
  it("rechaza 13 a 19 dígitos que pasan Luhn (con espacios o guiones, o dentro de un texto) y acepta referencias normales", async () => {
    const a = await tenant("ref-tarjeta");
    for (const reference of ["4111111111111111", "4111 1111 1111 1111", "4111-1111-1111-1111", "Pago tarjeta 4111 1111 1111 1111 ok", "378282246310005", "6200000000000005009"]) {
      const r = await pay("ref-tarjeta", 1, reference);
      expect(r.status, reference).toBe(400);
      expect(JSON.stringify(r.body)).toMatch(/tarjeta/i);
      expect(JSON.stringify(r.body)).not.toContain("4111");
    }
    expect(await t.q(`SELECT 1 FROM "PlatformPayment" WHERE "tenantId"=$1::uuid`, a.id)).toHaveLength(0);
    // No pasa Luhn, es corto (12) o es una referencia común: se acepta.
    let n = 0;
    for (const reference of ["4111111111111112", "123456789012", "BHD-0001-2026", "0012345678"]) {
      await t.q(`UPDATE "Tenant" SET status='active', "paidThroughAt"=now() + interval '400 days' WHERE id=$1::uuid`, a.id);
      const r = await pay("ref-tarjeta", 1, reference);
      expect(r.status, `${reference} ${JSON.stringify(r.body)}`).toBe(201); n++;
    }
    expect(n).toBe(4);
  });
});

describe("PC-23 · bitácora de auditoría", () => {
  it("cada pago y cada anulación dejan una fila en AuditLog de la empresa", async () => {
    const a = await tenant("audita-pago");
    const paid = await pay("audita-pago", 1, "AUD-1");
    const again = await pay("audita-pago", 1, "AUD-1", paid.body.payment.operationId); // repetición: no duplica
    expect(again.status).toBe(201);
    await op("post", `/tenants/audita-pago/payments/${paid.body.payment.id}/void`, { reason: "Anotado por error" });
    const rows = await t.q(`SELECT action, "userId", entity, "entityId", after FROM "AuditLog" WHERE "tenantId"=$1::uuid AND action LIKE 'platform_payment%' ORDER BY "createdAt"`, a.id);
    expect(rows.map(r => r.action)).toEqual(["platform_payment", "platform_payment_void"]);
    expect(rows[0]).toMatchObject({ userId: "plataforma:dueña-nexora", entity: "platform_payment", entityId: paid.body.payment.id });
    expect(rows[0].after).toMatchObject({ amount: "2000", months: 1, method: "transfer" });
    expect(rows[1].after).toEqual({ voids: paid.body.payment.id, amount: "2000" }) // el motivo es interno: la empresa exporta su AuditLog;
  });
});
