import { describe, expect, it } from "vitest";
import { paymentReminderDraft } from "../apps/web/src/payment-reminder";

describe("N-10 · recordatorio como borrador", () => {
  it("incluye saldo y facturas abiertas sin prometer vencimiento", () => {
    const text = paymentReminderDraft({ name: "Ana", balance: 250, numbers: ["FS-12", "FS-13"] });
    expect(text).toContain("Ana");
    expect(text).toContain("250");
    expect(text).toContain("FS-12");
    expect(text).not.toMatch(/vencid|pague hoy/i);
  });

  it("no prepara un cobro con saldo cero", () => {
    expect(paymentReminderDraft({ name: "Ana", balance: 0, numbers: [] })).toBeNull();
  });
});
