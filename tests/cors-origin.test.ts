import { describe, expect, it } from "vitest";
import { corsOrigin } from "../apps/api/src/cors-origin";

describe("CORS · origen permitido", () => {
  it("usa WEB_ORIGIN cuando está configurado, recortando espacios", () => {
    expect(corsOrigin("  https://tienda.example  ", "production")).toBe("https://tienda.example");
  });

  it("en desarrollo (o sin NODE_ENV) el valor por defecto es localhost", () => {
    expect(corsOrigin(undefined, "development")).toBe("http://localhost:5173");
    expect(corsOrigin(undefined, undefined)).toBe("http://localhost:5173");
    expect(corsOrigin("   ", "development")).toBe("http://localhost:5173");
  });

  it("fuera de desarrollo no hay origen por defecto", () => {
    expect(corsOrigin(undefined, "production")).toBe(false);
    expect(corsOrigin("", "production")).toBe(false);
    expect(corsOrigin(undefined, "test")).toBe(false);
  });
});
