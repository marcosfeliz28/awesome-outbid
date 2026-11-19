import { describe, expect, it } from "vitest";
import { cashText } from "../apps/web/src/cashLanguage";

describe("IT-003 · Caja en español e inglés", () => {
  it.each([
    ["Una caja que siempre cuadra", "A register that always balances"],
    ["Abrir mi caja", "Open my register"],
    ["Créditos pendientes", "Outstanding credit"],
    ["Registrar cobro", "Record payment"],
    ["Por venta", "By sale"],
    ["Por persona", "By customer"],
    ["Ya pagaron", "Paid"],
    ["Mayor deuda", "Highest balance"],
    ["Más antiguo", "Oldest"],
    ["Por cobrar visible:", "Visible outstanding:"],
    [
      "Hay importes ocultos hasta cerrar la caja; este total no incluye esas ventas.",
      "Some amounts stay hidden until the register closes; this total does not include those sales.",
    ],
    [
      "Solo tú ves este cuadro. Se cuadra a fin de mes con la administración.",
      "Only you can see this panel. It is reconciled with management at month end.",
    ],
  ])("traduce %s", (spanish, english) => {
    expect(cashText(spanish, "en")).toBe(english);
    expect(cashText(spanish, "es")).toBe(spanish);
  });

  it("conserva datos y mensajes que no pertenecen al diccionario de interfaz", () => {
    expect(cashText("FS-0000123 · María", "en")).toBe("FS-0000123 · María");
  });
});
