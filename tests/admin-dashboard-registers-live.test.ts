import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RegistersLive,
  formatOpenDuration,
} from "../apps/web/src/admin-dashboard/RegistersLive";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const now = new Date("2026-10-25T14:30:00.000Z");

const render = (
  sessions: Parameters<typeof RegistersLive>[0]["sessions"],
  deliveryThreshold = 10_000,
) =>
  renderToStaticMarkup(
    createElement(RegistersLive, { sessions, deliveryThreshold, now }),
  );

describe("RegistersLive", () => {
  it("muestra solo cajas abiertas con cajera y tiempo abierto", () => {
    const html = render([
      {
        id: "open-1",
        userName: "Ana",
        registerName: "Caja principal",
        openedAt: "2026-10-25T12:00:00.000Z",
        closedAt: null,
      },
      {
        id: "closed-1",
        userName: "Beatriz",
        registerName: "Caja cerrada",
        openedAt: "2026-10-25T10:00:00.000Z",
        closedAt: "2026-10-25T13:00:00.000Z",
      },
    ]);

    expect(html).toContain("Cajas en vivo");
    expect(html).toContain("Ana");
    expect(html).toContain("Caja principal");
    expect(html).toContain("2 h 30 min");
    expect(html).not.toContain("Beatriz");
    expect(html).not.toContain("Caja cerrada");
  });

  it("solo revela el efectivo esperado cuando llegó del servidor", () => {
    const html = render([
      {
        id: "visible",
        userName: "Carla",
        openedAt: "2026-10-25T14:00:00.000Z",
        closedAt: null,
        expected: { cash: 12_500 },
      },
      {
        id: "hidden",
        userName: "Diana",
        openedAt: "2026-10-25T14:15:00.000Z",
        closedAt: null,
        expected: { cash: null },
      },
    ]);

    expect(html.match(/Efectivo esperado/g)).toHaveLength(1);
    expect(html).toContain("RD$12,500.00");
    expect(html).toContain("Conviene una entrega");
    expect(html).not.toContain("No disponible");
  });

  it("marca solo importes por encima del umbral y explica el estado vacío", () => {
    const atThreshold = render([
      {
        id: "limit",
        userName: "Elena",
        openedAt: "2026-10-25T14:00:00.000Z",
        closedAt: null,
        expected: { cash: 10_000 },
      },
    ]);
    expect(atThreshold).not.toContain("Conviene una entrega");
    expect(render([])).toContain("No hay cajas abiertas ahora.");
  });

  it("normaliza duraciones inválidas o futuras sin valores negativos", () => {
    expect(formatOpenDuration("2026-10-25T14:29:00.000Z", now)).toBe("1 min");
    expect(formatOpenDuration("2026-10-25T15:00:00.000Z", now)).toBe("0 min");
    expect(formatOpenDuration("fecha-inválida", now)).toBe(
      "Tiempo no disponible",
    );
  });

  it("mantiene el contrato móvil a 320 px, foco visible y movimiento reducido", () => {
    const css = readFileSync(
      "apps/web/src/admin-dashboard/RegistersLive.css",
      "utf8",
    );
    expect(css).toMatch(/@media\s*\(max-width:\s*320px\)/);
    expect(css).toMatch(/min-width:\s*0/);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
  });
});
