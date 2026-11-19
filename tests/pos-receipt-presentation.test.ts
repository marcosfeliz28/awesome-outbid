import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { whatsAppRecipient } from "../apps/web/src/whatsAppRecipient";

const pos = readFileSync(
  new URL("../apps/web/src/POS.tsx", import.meta.url),
  "utf8",
);

describe("presentación del recibo de Caja", () => {
  it("envía a WhatsApp un número dominicano con código de país", () => {
    expect(pos).toContain("whatsAppRecipient(contact(customer?.phone))");
    expect(whatsAppRecipient("(809) 555-0123")).toBe("18095550123");
    expect(whatsAppRecipient("1 809 555 0123")).toBe("18095550123");
    expect(whatsAppRecipient("+34 612 34 56 78")).toBe("34612345678");
    expect(whatsAppRecipient("")).toBe("");
  });

  it("explica correctamente cuándo se cobra el crédito pendiente", () => {
    expect(pos).toMatch(
      /; se\s+cobra después en Créditos pendientes, en la pestaña Caja\./,
    );
    expect(pos).not.toContain("un se cobra después");
  });
});
