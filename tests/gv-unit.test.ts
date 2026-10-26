import { describe, expect, it } from "vitest";
import { gvTotals } from "../apps/api/src/gv";
import { can, permissions } from "../packages/shared/src/index";

describe("GV · pendiente exacto", () => {
  it("suma en decimal, excluye rechazados y separa lo no verificado", () => {
    expect(
      gvTotals("4500.10", [
        { amount: "1000.10", verified: true },
        { amount: "0.20", verified: false },
        { amount: "999", verified: false, rejectedAt: new Date() },
      ]),
    ).toEqual({ paid: "1000.30", unverified: "0.20", pending: "3499.80" });
    expect(gvTotals(100, [{ amount: 150, verified: true }]).pending).toBe(
      "-50.00",
    );
  });
});

describe("GV · rol", () => {
  it("gv sólo tiene permisos de GV; gerencia y administración también GV", () => {
    expect(permissions.gv).toEqual(["gv:read", "gv:write", "gv:reports"]);
    for (const p of permissions.gv) {
      expect(can(permissions.manager, p)).toBe(true);
      expect(can(permissions.admin, p)).toBe(true);
      expect(can(permissions.seller, p)).toBe(false);
    }
  });
});
