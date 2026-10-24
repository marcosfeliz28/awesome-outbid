import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const document = readFileSync(
  "docs/seguridad/CREDENCIAL_EQUIPO_N30.md",
  "utf8",
);

describe("N-30 · diseño de credencial ligada al navegador", () => {
  it("no promete que cifrar localStorage ni WebCrypto eliminen un XSS activo", () => {
    expect(document).toContain("No se corrige cifrando");
    expect(document).toContain("XSS activo");
    expect(document).toContain("no exportable");
  });

  it("conserva aprobación, aislamiento, rotación y revocación durante la migración", () => {
    for (const rule of [
      "no borrar `secretHash`",
      "rotación autenticada",
      "elimina sesiones",
      "Dos empresas no pueden",
      "aprobación nueva",
      "migración aditiva",
    ])
      expect(document).toContain(rule);
  });
});
