// Regresión N1 (Claude): peticiones anónimas no deben bloquear a usuarios legítimos.
// Colócala en tests/rate-limit-n1.test.ts. Debe FALLAR con el limitador actual y pasar al corregirlo.
import { describe, expect, it } from "vitest";
import { createRequestRateLimiter } from "../apps/api/src/rate-limit";

function call(limiter: any, method: string, path: string, headers: any = {}, body: any = {}) {
  let code = 200;
  limiter(
    { method, path, ip: "10.0.0.1", headers, body },
    { status: (c: number) => ({ json: () => { code = c; } }) },
    () => {},
  );
  return code;
}

describe("N1 · límite de intentos con IP compartida del proxy", () => {
  it("601 POST anónimos a /api/sales no bloquean la venta de una cajera con sesión", () => {
    const limiter = createRequestRateLimiter();
    for (let i = 0; i < 601; i++) call(limiter, "POST", "/api/sales");
    expect(call(limiter, "POST", "/api/sales", { authorization: "Bearer cajera" })).toBe(200);
  });
  it("601 logins con usuarios al azar no bloquean el login de otra cuenta", () => {
    const limiter = createRequestRateLimiter();
    for (let i = 0; i < 601; i++) call(limiter, "POST", "/api/auth/login", {}, { login: "x" + i });
    expect(call(limiter, "POST", "/api/auth/login", {}, { login: "cajera1" })).toBe(200);
  });
  it("aun así, un solo usuario que insiste sigue limitado", () => {
    const limiter = createRequestRateLimiter();
    let last = 200;
    for (let i = 0; i < 100; i++) last = call(limiter, "POST", "/api/auth/login", {}, { login: "victima" });
    expect(last).toBe(429);
  });
});
