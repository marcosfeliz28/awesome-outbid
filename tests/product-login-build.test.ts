import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  initialCompanyCode,
  publicRegistrationEnabled,
  productTenancyRequired,
} from "../apps/web/src/productTenancy";

describe("acceso separado para la tienda y el producto SaaS", () => {
  it("mantiene el login tradicional listo para la empresa demo", () => {
    expect(productTenancyRequired(undefined)).toBe(false);
    expect(initialCompanyCode(false)).toBe("demo");
  });

  it("obliga a escribir la empresa en la compilación SaaS", () => {
    expect(productTenancyRequired("required")).toBe(true);
    expect(initialCompanyCode(true)).toBe("");

    const dockerfile = readFileSync("deploy/render/Dockerfile.web", "utf8");
    const blueprint = readFileSync("render.producto.yaml", "utf8");
    expect(dockerfile).toContain('ARG VITE_PRODUCT_TENANCY=""');
    expect(blueprint).toContain(
      "key: VITE_PRODUCT_TENANCY\n        value: required",
    );
  });

  it("mantiene cerrado el registro público salvo doble opt-in explícito", () => {
    expect(publicRegistrationEnabled(undefined, undefined)).toBe(false);
    expect(publicRegistrationEnabled("required", undefined)).toBe(false);
    expect(publicRegistrationEnabled(undefined, "enabled")).toBe(false);
    expect(publicRegistrationEnabled("required", "enabled")).toBe(true);

  });
});
