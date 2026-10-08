import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createRequestRateLimiter } from "../apps/api/src/rate-limit";
import { paymentReceiptLine } from "../packages/shared/src";

const source = (path: string) => readFileSync(path, "utf8");

describe("Auditoría Claude 2 · regresiones focales", () => {
  it("N1: separa el límite compartido del límite por cuenta e IP", () => {
    const main = source("apps/api/src/main.ts");
    const limiter = source("apps/api/src/rate-limit.ts");
    expect(main).toContain("createRequestRateLimiter");
    expect(limiter).not.toContain("auth-shared:");
    expect(limiter).not.toContain("sales-shared:");
    expect(limiter).toContain("loginIdentifier");

    const middleware = createRequestRateLimiter();
    const call = ({
      path = "/api/auth/login",
      login,
      authorization,
    }: {
      path?: string;
      login?: string;
      authorization?: string;
    }) => {
      let status = 200;
      let continued = false;
      middleware(
        {
          method: "POST",
          path,
          ip: "10.0.0.1",
          body: login ? { login } : {},
          headers: authorization ? { authorization } : {},
        },
        {
          status(code: number) {
            status = code;
            return this;
          },
          json() {},
        },
        () => {
          continued = true;
        },
      );
      return { status, continued };
    };
    for (let attempt = 0; attempt < 601; attempt++)
      call({ login: "nombre-aleatorio-" + attempt });
    expect(call({ login: "cuenta-legitima" })).toEqual({
      status: 200,
      continued: true,
    });

    for (let attempt = 0; attempt < 601; attempt++)
      call({ path: "/api/sales" });
    expect(
      call({
        path: "/api/sales",
        authorization: "Bearer sesion-valida-de-cajera",
      }),
    ).toEqual({ status: 200, continued: true });
  });

  it("A07: oculta esperado y diferencias, y exige confirmar el conteo ciego", () => {
    const cash = source("apps/api/src/cash.ts");
    const tienda = source("apps/web/src/Tienda.tsx");
    expect(cash).toContain('can(actor.permissions, "profit:read")');
    expect(cash).toMatch(/\.\.\.\(showExpected\s*\?/);
    expect(cash).toContain('startsWith("difference")');
    expect(tienda).toContain("confirmBlindClose");
    expect(tienda).toContain("countedCard: parse(form.countedCard)");
    const management = source("apps/web/src/Management.tsx");
    expect(management).not.toContain("s.expectedCash ?? s.expected.cash");
    expect(management).toContain("s.expected?.cash");
    expect(management).toMatch(/s\.differenceCash\s*==\s*null\s*\?\s*"—"/);
  });

  it("A08: las listas no llevan base64 y la evidencia se consume como blob", () => {
    const sales = source("apps/api/src/sales.ts");
    const tienda = source("apps/web/src/Tienda.tsx");
    expect(sales).toContain("res.type(match[1]).send(Buffer.from(match[2]");
    expect(sales).not.toContain("return { proofUrl: payment.proofUrl }");
    expect(tienda).toContain("apiBlob(");
    expect(tienda).toContain("URL.createObjectURL");
  });

  it("A06: operationId es obligatorio y la concurrencia tiene regresión", () => {
    const inventory = source("apps/api/src/inventory.ts");
    const apiTests = source("tests/api.test.ts");
    expect(inventory).toContain("operationId: uuid,");
    expect(inventory).not.toContain("operationId: uuid.optional()");
    expect(apiTests).toContain("misma recepción de una orden no la duplica");
    expect(apiTests).toContain("Promise.all");
  });

  it("A12: persiste discountApprovedBy y muestra el nombre del autorizador", () => {
    const schema = source("apps/api/prisma/schema.prisma");
    const sales = source("apps/api/src/sales.ts");
    const prints = source("apps/web/src/Prints.tsx");
    expect(schema).toContain("discountApprovedBy");
    expect(sales).toContain("Autorizó:");
    expect(prints).toContain("Autorizó:");
  });

  it("A11: PDF e historial muestran recibido, aplicado y cambio", () => {
    const sales = source("apps/api/src/sales.ts");
    const management = source("apps/web/src/Management.tsx");
    expect(sales).toContain("paymentReceiptLine(p)");
    expect(
      paymentReceiptLine({
        method: "Efectivo",
        tendered: 2000,
        amount: 1750,
        change: 250,
      }),
    ).toBe("Efectivo: Recibido RD$ 2000 · Aplicado RD$ 1750 · Cambio RD$ 250");
    expect(management).toContain("Recibido:");
    expect(management).toContain("Cambio:");
  });
});
