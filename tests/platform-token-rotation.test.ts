import { createHash } from "node:crypto";
import { afterEach, expect, it } from "vitest";
import { authorizePlatform } from "../apps/api/src/platform";
import { RequestRateLimitService } from "../apps/api/src/rate-limit";

// PLA-01: rotar la credencial de plataforma sin cortar la vigente.
const keys = ["PRODUCT_TENANCY", "PLATFORM_ADMIN_TOKEN_SHA256", "PLATFORM_ADMIN_TOKEN_SHA256_NEXT"] as const;
const previous = Object.fromEntries(keys.map(k => [k, process.env[k]]));
afterEach(() => {
  for (const [k, v] of Object.entries(previous)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
});
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const current = "token-actual-".padEnd(64, "a");
const next = "token-nuevo-".padEnd(64, "b");
const req = (token: string, ip = "203.0.113.9") =>
  ({ headers: { authorization: `Platform ${token}` }, ip, socket: { remoteAddress: ip } }) as any;
const status = (fn: () => void) => { try { fn(); return 200; } catch (e: any) { return e.getStatus(); } };

it("acepta la credencial vigente y, si se configura, la siguiente; nada más", () => {
  process.env.PRODUCT_TENANCY = "required";
  process.env.PLATFORM_ADMIN_TOKEN_SHA256 = sha(current);
  delete process.env.PLATFORM_ADMIN_TOKEN_SHA256_NEXT;
  const limits = new RequestRateLimitService();
  expect(status(() => authorizePlatform(req(current), limits))).toBe(200);
  expect(status(() => authorizePlatform(req(next, "203.0.113.10"), limits))).toBe(401);
  process.env.PLATFORM_ADMIN_TOKEN_SHA256_NEXT = sha(next).toUpperCase();
  expect(status(() => authorizePlatform(req(current), limits))).toBe(200);
  expect(status(() => authorizePlatform(req(next), limits))).toBe(200);
  expect(status(() => authorizePlatform(req("otra".padEnd(64, "c"), "203.0.113.11"), limits))).toBe(401);
  // Sólo la siguiente no habilita la plataforma: la principal sigue siendo obligatoria.
  delete process.env.PLATFORM_ADMIN_TOKEN_SHA256;
  expect(status(() => authorizePlatform(req(next), limits))).toBe(404);
  // Una siguiente mal formada se ignora.
  process.env.PLATFORM_ADMIN_TOKEN_SHA256 = sha(current);
  process.env.PLATFORM_ADMIN_TOKEN_SHA256_NEXT = "no-es-hex";
  expect(status(() => authorizePlatform(req(current), limits))).toBe(200);
});
