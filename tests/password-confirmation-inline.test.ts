import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../apps/web/src/PasswordChangeFields.tsx", import.meta.url),
  "utf8",
);

describe("confirmación de contraseña en línea", () => {
  it("avisa cuando hay dos valores distintos y enlaza el mensaje al campo", () => {
    expect(source).toContain(
      "const mismatch = confirmation.length > 0 && confirmation !== password;",
    );
    expect(source).toContain('aria-invalid={mismatch}');
    expect(source).toMatch(
      /aria-describedby=\{\s*mismatch \? "password-confirmation-error" : undefined\s*\}/,
    );
    expect(source).toContain('id="password-confirmation-error"');
    expect(source).toContain("Las contraseñas no coinciden.");
  });
});
