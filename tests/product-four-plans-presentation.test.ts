import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const expectedPlans = [
  ["Autoservicio", "1,250"],
  ["Básico", "2,000"],
  ["Pro", "4,000"],
  ["Premium", "7,000"],
] as const;

describe("los cuatro planes aprobados del producto", () => {
  it("Facturación conserva la API como fuente de nombres y precios", () => {
    const billing = source("apps/web/src/Billing.tsx");
    for (const [name] of expectedPlans) expect(billing).toContain(name);
    expect(billing).toContain('(plans.data ?? []).map((plan)');
    expect(billing).toContain('plan.monthlyPrice.toLocaleString("es-DO")');
    expect(billing).not.toContain("RD$ 1,500");
  });

  it("Registro presenta las cuatro opciones sin prometer un plan único", () => {
    const registration = source("apps/web/src/Registration.tsx");
    for (const [name, price] of expectedPlans) {
      expect(registration).toContain(name);
      expect(registration).toContain(`RD$ ${price}`);
    }
    expect(registration).not.toContain("RD$ 1,500");
    expect(registration).not.toContain("Plan en línea");
  });

  it("las portadas en español e inglés presentan las cuatro opciones", () => {
    for (const path of ["apps/landing/index.html", "apps/landing/en/index.html"]) {
      const landing = source(path);
      for (const [name, price] of expectedPlans) {
        expect(landing).toContain(name);
        expect(landing).toContain(`RD$ ${price}`);
      }
      expect(landing).not.toContain("RD$ 1,500");
    }
  });

  it("la página de venta conserva cuatro tarjetas y cuatro etiquetas aria", () => {
    const sale = source("apps/web/public/venta/index.html");
    const plans = sale.slice(
      sale.indexOf('<section aria-labelledby="planes-titulo">'),
      sale.indexOf('<section aria-labelledby="extras-titulo">'),
    );
    expect(plans.match(/class="plan-card/g)).toHaveLength(4);
    expect(plans.match(/aria-label="Probar gratis el plan [^"]+"/g)).toHaveLength(4);
    for (const [name, price] of expectedPlans) {
      expect(plans).toContain(name);
      expect(plans).toContain(`RD$${price}`);
    }
    expect(plans).not.toContain("RD$ 1,500");
  });
});
