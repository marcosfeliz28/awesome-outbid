import { describe, expect, it } from "vitest";
import {
  courierPresets,
  expectedCents,
  suggestedCourierFee,
  courierCsv,
} from "../apps/web/src/courier-utils";

describe("Envíos del mensajero", () => {
  it("suma importes con centavos sin redondeo binario", () => {
    expect(expectedCents("15550.00", "400.00")).toBe(1595000);
    expect(expectedCents("0.10", "0.20")).toBe(30);
  });
  it("solo propone los cinco importes aprobados", () => {
    expect(courierPresets).toEqual([100, 250, 300, 400, 450]);
    expect(suggestedCourierFee("15950", "15550")).toBe(400);
    expect(suggestedCourierFee("15950.01", "15550")).toBeNull();
  });
  it("protege CSV contra fórmulas", () => {
    const csv = courierCsv([
      {
        invoice: "FS-1",
        customer: "=1+1",
        date: "2026-10-15T12:00:00Z",
        courierName: "Addison",
        courierFee: "100.00",
      },
    ]);
    expect(csv).toContain('"\'=1+1"');
  });
  it("exporta la fecha del mensajero en el día de la empresa", () => {
    const rows = [{
      invoice: "FS-2", customer: "Ana", date: "2026-10-25T10:30:00Z",
      courierName: "Luis", courierFee: "100.00",
    }];
    expect(courierCsv(rows, "Pacific/Kiritimati")).toContain("26/10/2026");
    expect(courierCsv(rows, "America/Santo_Domingo")).toContain("25/10/2026");
  });
});
