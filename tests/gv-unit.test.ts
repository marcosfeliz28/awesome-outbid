import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  assertGvBank,
  gvBankOptions,
  gvTotals,
} from "../apps/api/src/gv-money";
import { can, permissions } from "../packages/shared/src/index";

describe("GV · pendiente exacto", () => {
  it("pagado es sólo lo verificado; excluye rechazados; nunca negativo", () => {
    expect(
      gvTotals("4500.10", [
        { amount: "1000.10", verified: true },
        { amount: "0.20", verified: false },
        { amount: "999", verified: false, rejectedAt: new Date() },
      ]),
    ).toEqual({
      paid: "1000.10",
      unverified: "0.20",
      refunded: "0.00",
      pending: "3500.00",
    });
    expect(gvTotals(100, [{ amount: 150, verified: true }]).pending).toBe(
      "0.00",
    );
    expect(
      gvTotals(100, [{ amount: 40, verified: true }], {
        status: "reembolsada",
        refundAmount: 40,
      }),
    ).toMatchObject({ pending: "0.00", refunded: "40.00" });
  });
});

describe("GV · rol", () => {
  it("gv sólo tiene permisos de GV y no verifica; gerencia sí", () => {
    expect(permissions.gv).toEqual(["gv:read", "gv:write", "gv:reports"]);
    for (const p of [...permissions.gv, "gv:verify"]) {
      expect(can(permissions.manager, p)).toBe(true);
      expect(can(permissions.admin, p)).toBe(true);
      expect(can(permissions.seller, p)).toBe(false);
    }
    expect(can(permissions.gv, "gv:verify")).toBe(false);
  });
});

describe("GV · banco de la lista", () => {
  const fakeTx = (data: unknown) => ({
    settings: { findUnique: async () => ({ data }) },
  });
  it("agrupa la lista de la caja por empresa", async () => {
    const banks = await gvBankOptions(
      fakeTx({
        transferAccounts: [
          "Popular MacGen ···3620",
          "Popular Grupo Génesis ···9797",
          "BHD Grupo Génesis ···0015",
        ],
        cardTerminals: [],
      }),
      "b",
    );
    expect(banks.genesis).toEqual([
      "Popular Grupo Génesis ···9797",
      "BHD Grupo Génesis ···0015",
    ]);
    expect(banks.macgen).toEqual(["Popular MacGen ···3620"]);
  });
  it("exige un banco de la lista; sin lista no exige", () => {
    const banks = { genesis: ["A Génesis"], macgen: ["B Macgen"] };
    expect(() => assertGvBank(banks, "A Génesis")).not.toThrow();
    expect(() => assertGvBank(banks, "Otro")).toThrow();
    expect(() => assertGvBank(banks, null)).toThrow();
    expect(() =>
      assertGvBank({ genesis: [], macgen: [] }, "Libre"),
    ).not.toThrow();
  });
});

it("GV-17: reportes móviles indican que las tablas se pueden desplazar", () => {
  const view = readFileSync("apps/web/src/Gv.tsx", "utf8");
  const css = readFileSync("apps/web/src/gv.css", "utf8");
  expect(view.match(/table-wrap gv-table-wrap/g)?.length).toBeGreaterThanOrEqual(3);
  expect(css).toMatch(/\.gv-reports \.gv-table-wrap::after\s*\{[\s\S]*?content:\s*"↔"/);
  expect(css).toMatch(/\.gv-reports \.gv-table-wrap\s*\{[\s\S]*?scrollbar-width:\s*thin/);
});

it("GV-18: Caja GV reserva espacio si la barra móvil está activa", () => {
  const css = readFileSync("apps/web/src/premiumOperations.css", "utf8");
  expect(css).toMatch(
    /@media \(max-width: 768px\)[\s\S]*?\.app-shell:has\(\.goods-mobile-bar\)[\s\S]*?\[data-premium-area="gv"\][\s\S]*?padding-bottom:\s*calc\(104px \+ env\(safe-area-inset-bottom\)\)/,
  );
});
