import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BusinessHeader,
  InvoicePrint,
  CuadrePrint,
} from "../apps/web/src/Prints";

const webRequire = createRequire(resolve("apps/web/package.json"));

describe("P2 · manual operativo de cajera", () => {
  it("documenta arqueo ciego sin inventar esperado y separa ocho tareas", () => {
    const manual = readFileSync("docs/MANUAL-CAJERO.md", "utf8");
    expect(manual).toContain("Los campos vacíos representan RD$ 0.00");
    expect(manual).not.toContain("se toma el monto esperado");
    expect(manual).not.toContain("puede exigir vencimiento");
    expect(manual.match(/<div class="manual-page-break"/g)).toHaveLength(7);
    expect(manual).toContain("Datos ficticios");
    expect(manual).toContain(
      "Confirmo que conté efectivo, tarjeta y transferencia",
    );
    const images = [
      ...manual.matchAll(/!\[[^\]]*\]\((capturas\/manual\/[^)]+)\)/g),
    ];
    expect(images).toHaveLength(8);
    for (const image of images)
      expect(existsSync(resolve("docs", image[1]))).toBe(true);
  });
});
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
};
const cssVariable = (css: string, name: string) =>
  new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1] ?? "";
const cssVariables = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const block =
    new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`).exec(css)?.[1] ?? "";
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map(
      ([, name, value]) => [name, value],
    ),
  );
};

describe("Cumplimiento legal y accesibilidad", () => {
  it("P4: render real del ticket no fiscal y cuadre conserva datos y nombre de cajera", () => {
    const business = {
      name: "Negocio de prueba",
      branchName: "Sucursal de prueba",
      address: "Dirección de prueba",
      phone: "809-555-0100",
      legalId: "",
    };
    const ticket = renderToStaticMarkup(
      createElement(InvoicePrint, {
        config: business,
        sale: {
          number: "QA-1",
          createdAt: "2026-10-09T12:00:00Z",
          cashierName: "Cajera de prueba",
          snapshot: [],
          total: 0,
        },
      }),
    );
    expect(ticket).toContain("DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL");
    expect(ticket).not.toContain("NCF:");
    expect(ticket).not.toContain("RNC:");
    for (const text of [
      business.name,
      business.branchName,
      business.address,
      business.phone,
      "Cajera de prueba",
    ])
      expect(ticket).toContain(text);
    const cuadre = renderToStaticMarkup(
      createElement(CuadrePrint, {
        c: {
          business,
          title: "Cuadre de Caja",
          cashier: { name: "Cajera de prueba", number: 12345 },
          denominations: [{ value: 100, qty: 2, total: 200 }],
          denominationsSubtotal: 200,
          lines: [{ key: "cash", line: 2, label: "Efectivo RD$", value: 200 }],
        },
      }),
    );
    for (const text of [
      "Cuadre de Caja",
      "Cajera de prueba",
      "Detalles de monedas",
      "100 × 2",
      "Descripción / Totales",
      "200.00",
      "FIN DEL CUADRE",
    ])
      expect(cuadre).toContain(text);
    expect(cuadre).not.toContain("12345");
  });
  it("G1: el ticket sin NCF se identifica como no fiscal y no imprime una fila NCF vacía", () => {
    const source = readFileSync("apps/web/src/Prints.tsx", "utf8");
    expect(source).toContain("DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL");
    expect(source).not.toContain('<h3 className="tp-center">FACTURA</h3>');
    expect(source).not.toContain('<Row label="NCF:" value={sale.ncf ?? ""} />');
  });

  it("G2/P4: el HTML térmico usa Ajustes y el logo predeterminado o configurado", () => {
    const settings = {
      name: "Negocio configurado",
      branchName: "Sucursal configurada",
      address: "Dirección configurada",
      phone: "809-555-0110",
      legalId: "101010101",
    };
    const withoutLogo = renderToStaticMarkup(
      createElement(BusinessHeader, { business: settings }),
    );
    expect(withoutLogo).toContain('src="/logo-grupo-macgen.png"');
    for (const value of Object.values(settings))
      expect(withoutLogo).toContain(value);

    const logo = "data:image/png;base64,iVBORw0KGgo=";
    const withLogo = renderToStaticMarkup(
      createElement(BusinessHeader, { business: { ...settings, logo } }),
    );
    expect(withLogo).toContain('<img class="tp-logo"');
    expect(withLogo).toContain(logo);

    const seeds =
      readFileSync("apps/api/prisma/seed.ts", "utf8") +
      readFileSync("apps/api/scripts/create-admin.ts", "utf8");
    expect(seeds).not.toContain("Grupo Mac Hen");
    expect(seeds).not.toContain("Plaza Lope de Vega");
  });

  it("G5: los PDF incluyen contacto, hora, tratamiento del ITBIS y condiciones de la nota", () => {
    const source = readFileSync("apps/api/src/sales.ts", "utf8");
    const salePdf = source.slice(
      source.indexOf('@Get("sales/:id/receipt.pdf")'),
    );
    const noteStart = source.indexOf('@Get("returns/:id/credit-note.pdf")');
    const notePdf = source.slice(
      noteStart,
      source.indexOf('@Post("sales/:id/installments")', noteStart),
    );
    expect(salePdf).toContain("business.phone");
    expect(salePdf).toContain("Fecha y hora:");
    expect(salePdf).toContain("ITBIS adicional:");
    expect(salePdf).toContain("sale.taxIncluded");
    expect(notePdf).toContain("this.db.settings.findUnique");
    expect(notePdf).toContain("business.address");
    expect(notePdf).toContain("Fecha:");
    expect(notePdf).toContain("Condiciones de uso:");
  });

  it("G10: los colores funcionales alcanzan contraste AA y los controles conservan foco visible", () => {
    const css = readFileSync("apps/web/src/styles.css", "utf8");
    const light = cssVariables(css, ":root");
    const dark = {
      ...light,
      ...cssVariables(css, ':root[data-theme="dark"]'),
    };
    expect(
      contrast(cssVariable(css, "--success-strong"), "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(cssVariable(css, "--warning-text"), "#fff5e6"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(cssVariable(css, "--danger-text"), "#ffffff"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(cssVariable(css, "--focus"), "#ffffff"),
    ).toBeGreaterThanOrEqual(3);
    expect(
      contrast(cssVariable(css, "--input-border"), "#ffffff"),
    ).toBeGreaterThanOrEqual(3);
    for (const palette of [light, dark])
      expect(
        contrast(palette["--warning-text"], palette["--alert-counter-bg"]),
      ).toBeGreaterThanOrEqual(4.5);
    expect(css).toMatch(
      /\.alert-counter\s*\{[^}]*background:\s*var\(--alert-counter-bg\)/s,
    );
    expect(css).toContain('input[type="checkbox"]:focus-visible');
    expect(css).toContain('input[type="radio"]:focus-visible');
    expect(css).toContain("background: var(--success-strong)");
    expect(css).toContain("outline: 3px solid var(--focus)");
  });

  it("G11: F4, F8 y F12 no ejecutan acciones detrás de un modal", () => {
    const source = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(source).toContain("blockPosShortcutWithModal(e, document)");
  });

  it("G7: el sistema no solicita ni almacena la fecha de nacimiento", () => {
    const schema = readFileSync("apps/api/prisma/schema.prisma", "utf8");
    const admin = readFileSync("apps/api/src/admin.ts", "utf8");
    const migration = readFileSync(
      "apps/api/prisma/migrations/202610150002_remove_customer_birthday/migration.sql",
      "utf8",
    );
    expect(schema).not.toMatch(/\bbirthday\b/);
    expect(admin).not.toMatch(/\bbirthday\b/);
    expect(migration).toContain('DROP COLUMN IF EXISTS "birthday"');
  });
});
