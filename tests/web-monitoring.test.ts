// G8 · Sentry de la web: sin DSN fijo en el código, apagado sin
// VITE_SENTRY_DSN (ninguna petición a Sentry) y con los mensajes de excepción
// saneados antes de enviarse.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  startSpan: vi.fn((_options: unknown, run: (span: any) => unknown) =>
    run({ setAttribute: () => undefined }),
  ),
  browserTracingIntegration: vi.fn(() => ({ name: "BrowserTracing" })),
  replayIntegration: vi.fn(() => ({ name: "Replay" })),
}));
vi.mock("../apps/web/node_modules/@sentry/react", () => sentry);

const source = readFileSync(
  new URL("../apps/web/src/monitoring.ts", import.meta.url),
  "utf8",
);
async function load(dsn?: string) {
  vi.resetModules();
  sentry.init.mockClear();
  vi.stubEnv("VITE_SENTRY_DSN", dsn ?? "");
  return import("../apps/web/src/monitoring");
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  // Lo define Vite al compilar (vite.config.ts).
  vi.stubGlobal("__NEXORA_SENTRY_RELEASE__", "");
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("Ninguna petición de red en esta prueba.");
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("G8 · Sentry web sólo con VITE_SENTRY_DSN", () => {
  it("el código no trae un DSN ni un destino de Sentry fijo", () => {
    expect(source).not.toMatch(/sentry\.io/i);
    expect(source).not.toMatch(/https:\/\/[0-9a-f]{20,}@/i);
    expect(source).toContain("VITE_SENTRY_DSN");
  });

  it("sin la variable no inicia Sentry ni hace peticiones", async () => {
    const monitoring = await load();
    expect(sentry.init).not.toHaveBeenCalled();
    // Las operaciones del POS siguen funcionando sin monitoreo.
    await expect(
      monitoring.traceBusinessOperation("pos.sale.submit", async () => 7),
    ).resolves.toBe(7);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("con espacios en blanco tampoco se activa", async () => {
    await load("   ");
    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("con la variable se inicia con ese DSN y con beforeSend", async () => {
    const dsn = "https://abc@o1.ingest.example.test/2";
    await load(dsn);
    expect(sentry.init).toHaveBeenCalledTimes(1);
    const options = sentry.init.mock.calls[0][0];
    expect(options.dsn).toBe(dsn);
    expect(typeof options.beforeSend).toBe("function");
  });
});

describe("G8 · mensajes de excepción saneados", () => {
  it("quita correos, números largos, tokens e ids de rutas", async () => {
    const { scrubText } = await load();
    const raw =
      "Cliente ana.perez+vip@correo.com.do con cédula 40212345678 y tel. 809-555-1234 " +
      "falló GET https://pos.example.test/api/customers/0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d/sales/1234567?token=abc#x " +
      "con Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJh y clave qa_clave_AbCdEf0123456789XyZ0987654 " +
      "en /api/sales/42/receipt.pdf el 2026-10-09 por RD$ 1500.00";
    const clean = scrubText(raw);
    for (const leaked of [
      "ana.perez",
      "correo.com.do",
      "40212345678",
      "555-1234",
      "0b7c1d2e",
      "1234567",
      "token=abc",
      "eyJhbGci",
      "qa_clave_AbCdEf",
      "/sales/42/",
    ])
      expect(clean).not.toContain(leaked);
    expect(clean).toContain("/api/customers/:id/sales/:id");
    expect(clean).toContain("/api/sales/:id/receipt.pdf");
    // Lo útil para diagnosticar se mantiene.
    expect(clean).toContain("falló GET");
    expect(clean).toContain("2026-10-09");
    expect(clean).toContain("RD$ 1500.00");
  });

  it("beforeSend sanea el mensaje, las excepciones, las migas y la URL", async () => {
    await load("https://abc@o1.ingest.example.test/2");
    const { beforeSend } = sentry.init.mock.calls[0][0];
    const event = beforeSend(
      {
        message: "Sin respuesta para maria@example.com",
        exception: {
          values: [
            {
              type: "Error",
              value:
                "No se pudo cobrar a 8095551234 (cliente juan@example.com)",
            },
          ],
        },
        breadcrumbs: [
          {
            message: "fetch /api/customers/123456789 por pedro@example.com",
            data: {
              url: "/api/sales/0b7c1d2e-3f40-4a5b-8c6d-7e8f9a0b1c2d?x=1",
            },
          },
        ],
        request: {
          url: "https://pos.example.test/api/customers/98765?q=ana@example.com",
          cookies: { a: "b" },
          headers: { Authorization: "Bearer x" },
          data: "{}",
        },
        user: { email: "ana@example.com", ip_address: "10.0.0.1" },
        extra: { body: "ana@example.com" },
      },
      {},
    );
    const text = JSON.stringify(event);
    expect(text).not.toMatch(/@example\.com/);
    expect(text).not.toMatch(/8095551234|123456789|98765/);
    expect(text).not.toContain("0b7c1d2e");
    expect(event.user).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.request.cookies).toBeUndefined();
    expect(event.request.headers).toBeUndefined();
    expect(event.request.url).toBe(
      "https://pos.example.test/api/customers/:id",
    );
    expect(event.exception.values[0].type).toBe("Error");
    expect(event.exception.values[0].value).toContain("No se pudo cobrar");
  });
});
