import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  customerEditValue,
  customerPrivateDisplay,
  seesCustomerPii,
} from "../apps/web/src/customer-display";
const flat = (path: string) => readFileSync(path, "utf8").replace(/\s+/g, " ");
describe("P5: datos de clientes en la lista", () => {
  it("la lista aplica el filtro y el aviso de IA queda en la política, no en el ticket", () => {
    const source = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(source).toMatch(/customerPrivateDisplay\(\s*c.phone/);
    expect(source).toMatch(/customerPrivateDisplay\(\s*c.legalId/);
    // Int P5-3: el ticket del cliente no habla de facturas de proveedor.
    expect(flat("apps/web/src/Prints.tsx")).not.toContain("Anthropic");
    expect(flat("docs/legal/POLITICA_PRIVACIDAD.md")).toContain(
      "la imagen o PDF de la factura se envía a Anthropic",
    );
  });
  it("cajera sólo ve los tres últimos dígitos y nunca un dato corto completo", () => {
    expect(customerPrivateDisplay("809-555-0123", false)).toBe("•••123");
    expect(customerPrivateDisplay("001-1234567-8", false)).toBe("•••678");
    expect(customerPrivateDisplay("12", false)).toBe("•••");
    expect(customerPrivateDisplay("", false)).toBe("—");
    // Lo que ya envía enmascarado la API (SEC-05) se acorta igual.
    expect(customerPrivateDisplay("•••••••123", false)).toBe("•••123");
  });
  it("gerencia conserva el dato completo", () => {
    expect(customerPrivateDisplay("809-555-0123", true)).toBe("809-555-0123");
  });
  it("Int P5-1: mismo criterio que la API (sale:manage, customers:erase o *)", () => {
    expect(seesCustomerPii(["sale:write", "customers:write"])).toBe(false);
    expect(seesCustomerPii(["sale:manage"])).toBe(true);
    expect(seesCustomerPii(["customers:erase"])).toBe(true);
    expect(seesCustomerPii(["*"])).toBe(true);
  });
  it("Int P5-1: «Editar» no muestra el dato completo a la caja", () => {
    expect(customerEditValue("809-555-0123", false)).toBe("•••123");
    // Lo enmascarado lleva «•» y la API no lo guarda encima del real.
    expect(customerEditValue("•••••••123", false)).toBe("•••••••123");
    expect(customerEditValue("", false)).toBe("");
    expect(customerEditValue(null, false)).toBeNull();
    expect(customerEditValue("809-555-0123", true)).toBe("809-555-0123");
    const source = flat("apps/web/src/Management.tsx");
    expect(source).toContain(
      "phone: customerEditValue(editing.phone, fullCustomer)",
    );
    expect(source).toContain(
      "legalId: customerEditValue(editing.legalId, fullCustomer)",
    );
    expect(source).toContain('(c.name + " " + (fullCustomer ? c.phone : ""))');
  });
  it("Int P5-1: el selector de cliente del POS no muestra el teléfono completo", () => {
    const pos = flat("apps/web/src/POS.tsx");
    expect(pos).not.toContain("<small>{c.phone}</small>");
    expect(pos).toMatch(
      /customerPrivateDisplay\( c\.phone, seesCustomerPii\(user!\.permissions\), \)/,
    );
  });
  it("Int P5-2/P5-4: la política no publica notas internas ni promete compra anónima", () => {
    const policy = flat("docs/legal/POLITICA_PRIVACIDAD.md");
    expect(policy).not.toContain("antes de publicar este texto, la gerencia");
    expect(policy).not.toContain(
      'Puede comprar como "consumidor final" sin dar nombre',
    );
    expect(policy).toContain("pedimos un nombre que identifique al cliente");
  });
});
