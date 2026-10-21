import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { DescuadreBanner } from "../apps/web/src/Prints";

// Orden de la dueña (21-oct): falte o sobre dinero, el cuadre lo dice en grande.
const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");
const html = (d: object) =>
  renderToStaticMarkup(createElement(DescuadreBanner, { d }));

describe("DescuadreBanner", () => {
  it("faltante en efectivo: monto, quién aprobó y la justificación", () => {
    const out = html({
      cash: -50,
      card: 0,
      reason: "Faltan 50 del cambio",
      cashApprovedBy: "Gerente QA",
    });
    expect(out).toContain("DESCUADRE DE CAJA");
    expect(out).toContain("FALTAN EN EFECTIVO");
    expect(out).toContain("50.00");
    expect(out).toContain("aprobó Gerente QA");
    expect(out).toContain("Faltan 50 del cambio");
    expect(out).not.toContain("SOBRAN");
    expect(out).not.toContain("EN TARJETA");
  });

  it("sobrante: SOBRAN y, sin justificación, lo dice", () => {
    const out = html({ cash: 25, card: 0 });
    expect(out).toContain("SOBRAN EN EFECTIVO");
    expect(out).toContain("+RD$");
    expect(out).not.toContain("FALTAN");
    expect(out).toContain("SIN JUSTIFICACIÓN");
  });
});
