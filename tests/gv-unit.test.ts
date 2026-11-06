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
