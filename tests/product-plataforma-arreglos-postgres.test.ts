import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp } from "./setup/product-pg-app";
import { paidUntilFrom } from "../apps/api/src/platform-billing";

// Auditoría en vivo de plataforma y equipos (25-oct-2026), con PostgreSQL real.
const platformToken = "operador-plataforma-arreglos-prueba-".padEnd(
  72,
  "0123456789abcdef",
);
const auth = `Platform ${platformToken}`;
let t: Awaited<ReturnType<typeof startProductApp>>;
beforeAll(async () => {
  t = await startProductApp("nexora_plataforma_arreglos");
  process.env.PLATFORM_ADMIN_TOKEN_SHA256 = createHash("sha256")
    .update(platformToken)
    .digest("hex");
  process.env.PLATFORM_OPERATOR_LABEL = "dueña-nexora";
  process.env.APP_PUBLIC_URL = "https://pos.example.invalid";
  for (const k of [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID",
    "RESEND_API_KEY",
    "NOTIFY_EMAIL_FROM",
  ])
    delete process.env[k];
}, 180_000);
afterAll(async () => {
  await t?.stop();
});

const op = (method: "get" | "post", path: string, body?: unknown) => {
  const http = t.http as any;
  const r = http[method]("/api/platform" + path).set("Authorization", auth);
  return method === "post" ? r.send(body ?? {}) : r;
};
const password = "ClaveSegura-2026!";
async function tenant(code: string, trialDays = 30) {
  const created = await op("post", "/tenants", {
    businessName: `Piloto ${code}`,
    companyCode: code,
    businessType: "retail",
    plan: "basico",
    trialDays,
    adminName: "Dueña piloto",
    adminEmail: `${code}@example.invalid`,
    operadora: "Ana Operadora",
    acuerdo: { version: "piloto-1", fecha: "2026-10-01", referencia: "Carpeta 12" },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  return created.body;
}
async function activate(code: string, url: string, pass = password) {
  const token = url.split("#token=")[1];
  const accepted = await t.http
    .post("/api/auth/accept-invitation")
    .send({ token, password: pass, managerPin: "869253", consentAccepted: true });
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(201);
}
const login = (code: string, pass = password) =>
  t.http
    .post("/api/auth/login")
    .set("x-tenant-id", code)
    .send({ login: `${code}@example.invalid`, password: pass });

describe("11 · cobros de la plataforma", () => {
  it("rechaza una referencia repetida y «Anular pago» deja la bitácora intacta y rehace el pagado hasta", async () => {
    const a = await tenant("cobro-ref");
    await t.q(
      `UPDATE "Tenant" SET status='active', "paidThroughAt"='2031-01-31T12:00:00Z' WHERE id=$1::uuid`,
      a.id,
    );
    const first = await op("post", "/tenants/cobro-ref/payments", {
      operationId: randomUUID(),
      amount: 2000,
      method: "transfer",
      reference: "BHD-0001",
      months: 1,
    });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body.tenant.paidUntil).toBe("2031-02-28T12:00:00.000Z");
    const again = await op("post", "/tenants/cobro-ref/payments", {
      operationId: randomUUID(),
      amount: 2000,
      method: "transfer",
      reference: " bhd-0001 ",
      months: 1,
    });
    expect(again.status).toBe(409);
    expect(again.body.message).toContain("Ya hay un pago con la referencia");
    const second = await op("post", "/tenants/cobro-ref/payments", {
      operationId: randomUUID(),
      amount: 4000,
      method: "cash",
      reference: "Recibo 2",
      months: 2,
    });
    expect(second.body.tenant.paidUntil).toBe("2031-04-28T12:00:00.000Z");
    const id = first.body.payment.id;
    expect(
      (await op("post", `/tenants/cobro-ref/payments/${id}/void`, {})).status,
    ).toBe(400);
    const voided = await op("post", `/tenants/cobro-ref/payments/${id}/void`, {
      reason: "Transferencia anotada en la empresa equivocada",
    });
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    expect(voided.body.payment).toMatchObject({
      voidsPaymentId: id,
      voidReason: "Transferencia anotada en la empresa equivocada",
      amount: "2000",
    });
    // Sin el pago anulado: 31-ene + 2 meses del segundo.
    expect(voided.body.tenant.paidUntil).toBe("2031-03-31T12:00:00.000Z");
    expect(
      (
        await op("post", `/tenants/cobro-ref/payments/${id}/void`, {
          reason: "otra vez",
        })
      ).status,
    ).toBe(409);
    const rows = await t.q(
      `SELECT id::text, amount::text, "voidsPaymentId"::text FROM "PlatformPayment" WHERE "tenantId"=$1::uuid ORDER BY "createdAt"`,
      a.id,
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ id, amount: "2000.00", voidsPaymentId: null });
    // La referencia anulada se puede volver a usar con el pago correcto.
    expect(
      (
        await op("post", "/tenants/cobro-ref/payments", {
      operationId: randomUUID(),
          amount: 2000,
          method: "transfer",
          reference: "BHD-0001",
          months: 1,
        })
      ).status,
    ).toBe(201);
    const list = await op("get", "/tenants/cobro-ref/payments");
    expect(list.body.filter((p: any) => p.voidsPaymentId === id)).toHaveLength(
      1,
    );
  });

  it("el pagado hasta se rehace en orden con los pagos vigentes", () => {
    const at = (s: string) => new Date(s);
    const base = { voidsPaymentId: null };
    const rows = [
      {
        ...base,
        id: "a",
        months: 1,
        paidFrom: at("2031-01-31T12:00:00Z"),
        createdAt: at("2031-01-10T00:00:00Z"),
      },
      {
        ...base,
        id: "b",
        months: 2,
        paidFrom: at("2031-02-28T12:00:00Z"),
        createdAt: at("2031-01-11T00:00:00Z"),
      },
    ];
    expect(paidUntilFrom(rows)?.toISOString()).toBe("2031-04-28T12:00:00.000Z");
    expect(
      paidUntilFrom([
        ...rows,
        {
          ...rows[0],
          id: "v",
          voidsPaymentId: "a",
          createdAt: at("2031-01-12T00:00:00Z"),
        },
      ])?.toISOString(),
    ).toBe("2031-03-31T12:00:00.000Z");
    expect(
      paidUntilFrom([
        rows[0],
        { ...rows[0], id: "v", voidsPaymentId: "a" },
      ])?.toISOString(),
    ).toBe("2031-01-31T12:00:00.000Z");
  });

  it("el resumen cuenta «En prueba» como su filtro e incluye los paquetes IA en el ingreso del mes", async () => {
    await tenant("prueba-corta", 3);
    await tenant("prueba-larga", 30);
    const pack = await op("post", "/tenants/prueba-larga/ai-packs", {
      size: 100,
      reference: "IA-1",
    });
    expect(pack.status, JSON.stringify(pack.body)).toBe(201);
    const tenants = (await op("get", "/tenants")).body;
    const summary = (await op("get", "/summary")).body;
    expect(summary.enPrueba).toBe(
      tenants.filter((x: any) => x.status === "trial").length,
    );
    expect(summary.alDia).toBe(
      tenants.filter((x: any) => x.status === "active").length,
    );
    expect(summary.porVencer).toBeGreaterThanOrEqual(1);
    expect(summary.monthAiPacks).toBe(399);
    expect(summary.monthIncome).toBe(summary.monthPayments + 399);
  });
});

describe("11 · enlace para restablecer la clave de la administradora", () => {
  it("el operador genera un enlace; la clave vieja deja de servir y queda en la bitácora", async () => {
    const created = await tenant("clave-olvidada");
    await activate("clave-olvidada", created.invitationUrl);
    expect((await login("clave-olvidada")).status).toBe(201);
    expect(
      (await t.http.post("/api/platform/tenants/clave-olvidada/password-reset"))
        .status,
    ).toBe(401);
    const reset = await op("post", "/tenants/clave-olvidada/password-reset");
    expect(reset.status, JSON.stringify(reset.body)).toBe(201);
    expect(reset.body.email).toBe("clave-olvidada@example.invalid");
    expect(reset.body.invitationUrl).toMatch(
      /^https:\/\/pos\.example\.invalid\/aceptar-invitacion#token=/,
    );
    expect((await login("clave-olvidada")).status).not.toBe(201);
    await activate(
      "clave-olvidada",
      reset.body.invitationUrl,
      "OtraClave-2026!!",
    );
    expect((await login("clave-olvidada", "OtraClave-2026!!")).status).toBe(
      201,
    );
    const log = await t.q(
      `SELECT "userId" FROM "AuditLog" WHERE action='platform_password_reset' AND "tenantId"=$1::uuid`,
      created.id,
    );
    expect(log).toEqual([{ userId: "plataforma:dueña-nexora" }]);
  });
});

describe("10 · equipos sobre el cupo del plan", () => {
  it("el navegador nuevo de la administradora queda pendiente (sin 409) y se aprueba al revocar otro", async () => {
    const newId = "40000000-0000-4000-8000-000000000001";
    const body = {
      id: newId,
      name: "Laptop nueva",
      secret: "secreto-largo-de-prueba-0001",
    };
    for (let i = 0; i < 2; i++) {
      const r = await t.post("/terminals/register", body);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      expect(r.body.status).toBe("pending");
      if (i === 0)
        expect(r.body.planLimit).toContain("permite 1 equipo aprobado");
    }
    const [row] = await t.q(
      `SELECT "approvedAt" FROM "Terminal" WHERE id=$1::uuid`,
      newId,
    );
    expect(row.approvedAt).toBeNull();
    const old = "30000000-0000-4000-8000-000000000004";
    expect((await t.post(`/terminals/${old}/revoke`)).status).toBe(201);
    const again = await t.post("/terminals/register", body);
    expect(again.body.status).toBe("approved");
    expect(again.body.planLimit).toBeUndefined();
  });
});
