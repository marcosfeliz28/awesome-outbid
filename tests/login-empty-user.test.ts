import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync(
  new URL("../apps/web/src/App.tsx", import.meta.url),
  "utf8",
);

describe("entrada sin usuario", () => {
  it("rechaza espacios antes de iniciar cualquier solicitud", () => {
    const guard = app.indexOf("const normalizedLogin = login.trim();");
    const request = app.indexOf('post("/auth/login"');

    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(request);
    expect(app).toContain('if (!normalizedLogin) {');
    expect(app).toContain('setError("Escribe tu usuario o correo.");');
    expect(app).toMatch(/post\("\/auth\/login", \{\s*login: normalizedLogin,/);
    expect(app).toMatch(
      /post\("\/auth\/change-password", \{\s*login: normalizedLogin,/,
    );
  });
});
