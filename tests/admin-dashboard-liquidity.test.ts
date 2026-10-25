import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LiquidityMap,
  formatLiquidityMoney,
  type LiquiditySnapshot,
} from "../apps/web/src/admin-dashboard/LiquidityMap";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const data: LiquiditySnapshot = {
  asOf: "2026-10-25T15:00:00.000Z",
  pockets: {
    drawers: {
      amount: "1500.50",
      openRegisters: 2,
      basis: "Efectivo esperado en cajas abiertas, al momento",
    },
    owner: {
      amount: "300.00",
      basis: "Efectivo recibido por la dueña hoy; no es un saldo",
    },
    banks: {
      verified: "725.25",
      pending: "80.00",
      verifiedBasis:
        "Transferencias confirmadas mediante revisión hoy; no es saldo bancario",
      pendingBasis: "Transferencias por verificar pendientes actualmente",
    },
    street: {
      cod: "450.00",
      credit: "600.00",
      unclassified: "75.00",
      basis: "Cuentas por cobrar pendientes actualmente",
    },
  },
};

describe("LiquidityMap", () => {
  it("muestra cuatro bolsillos y conserva sus períodos honestos", () => {
    const html = renderToStaticMarkup(createElement(LiquidityMap, { data }));
    for (const label of [
      "En gavetas",
      "Recibido por la dueña hoy",
      "Transferencias bancarias",
      "En la calle",
    ])
      expect(html).toContain(label);
    expect(html).toContain("Verificadas hoy");
    expect(html).toContain("Por verificar");
    expect(html).toContain("Contraentregas");
    expect(html).toContain("Créditos");
    expect(html).toContain("no es saldo bancario");
    expect(html).toContain("No sumes estos bolsillos");
    expect(html.match(/RD\$/g)).toHaveLength(7);
  });

  it("formatea dinero y explica carga, error y ausencia de datos", () => {
    expect(formatLiquidityMoney("1250.50")).toMatch(/1[.,]250[.,]50/);
    expect(
      renderToStaticMarkup(createElement(LiquidityMap, { busy: true })),
    ).toContain("Calculando los bolsillos");
    expect(
      renderToStaticMarkup(
        createElement(LiquidityMap, { error: "No se pudo cargar" }),
      ),
    ).toContain('role="alert"');
    expect(renderToStaticMarkup(createElement(LiquidityMap))).toContain(
      "No hay datos disponibles",
    );
  });

  it("declara contratos específicos para 390 y 320 px sin desborde", () => {
    const css = readFileSync(
      "apps/web/src/admin-dashboard/LiquidityMap.css",
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*390px\)/);
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
