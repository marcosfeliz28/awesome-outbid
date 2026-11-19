import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Producto protegido · idempotencia del ajuste de inventario", () => {
  it("crea la clave al abrir el formulario y envía la misma al guardar", () => {
    const source = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(source).toContain(
      "setAdjust({ ...v, operationId: crypto.randomUUID() })",
    );
    expect(source).toContain("operationId: adjust.operationId,");
  });
});
