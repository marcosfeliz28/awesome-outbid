// Auditoría en vivo de Gemini (25-oct): bloqueo con tiempo real, Enter de la
// pistola lectora, «¿Olvidaste tu contraseña?» y avisos de caja y clientes.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lockedMessage } from "../apps/api/src/security";
import { nextFieldOnEnter } from "../apps/web/src/posKeyboard";

const read = (file: string) => readFileSync(file, "utf8");

describe("aviso de bloqueo con el tiempo que falta", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  it("cambia «15 minutos» por lo que falta de verdad", () => {
    expect(lockedMessage("Espera 15 minutos o pide ayuda.", at(3.2), now)).toBe(
      "Espera 4 minutos o pide ayuda.",
    );
    expect(lockedMessage("Espera 15 minutos.", at(0.1), now)).toBe(
      "Espera 1 minuto.",
    );
  });
  it("si el aviso no dice minutos, los agrega al final", () => {
    expect(lockedMessage("Durante una hora como máximo.", at(42), now)).toBe(
      "Durante una hora como máximo. Faltan 42 minutos.",
    );
    expect(lockedMessage("Bloqueado.", at(1), now)).toBe(
      "Bloqueado. Falta 1 minuto.",
    );
  });
});

describe("Enter en SKU o código de barras pasa al campo siguiente", () => {
  const field = (tag: string) => {
    const el: any = {
      tag,
      disabled: false,
      focused: false,
      matches: (selector: string) =>
        tag === "hidden" ? false : selector.includes(tag),
      focus: () => (el.focused = true),
    };
    return el;
  };
  it("no envía el formulario y enfoca el siguiente campo", () => {
    const [sku, hidden, price] = [
      field("input"),
      field("hidden"),
      field("input"),
    ];
    sku.form = { elements: [sku, hidden, price] };
    let prevented = false;
    nextFieldOnEnter({
      key: "Enter",
      preventDefault: () => (prevented = true),
      currentTarget: sku,
    } as any);
    expect(prevented).toBe(true);
    expect(price.focused).toBe(true);
  });
  it("otras teclas no se tocan", () => {
    let prevented = false;
    nextFieldOnEnter({
      key: "a",
      preventDefault: () => (prevented = true),
      currentTarget: { form: null },
    } as any);
    expect(prevented).toBe(false);
  });
});

describe("textos de la auditoría", () => {
  const app = read("apps/web/src/App.tsx");
  const management = read("apps/web/src/Management.tsx");
  it("la entrada ofrece «¿Olvidaste tu contraseña?» y aclara que no es el PIN", () => {
    expect(app).toContain("¿Olvidaste tu contraseña?");
    expect(app).toContain("(no es tu PIN de caja)");
  });
  it("Productos vacío invita a crear o importar, la caja explica la diferencia y Anonimizar dice la deuda", () => {
    expect(management).toContain("Aún no tienes productos");
    expect(management).toContain("«Recibido por la dueña» salen en Reportes");
    expect(management).toContain(
      "todavía debe ${formatMoney(anonymizing.debt)}",
    );
  });
});
