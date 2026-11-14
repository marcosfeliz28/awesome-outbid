import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { resolveTheme, THEME_COLOR } from "../apps/web/src/theme";

// MOD-08: el tema sigue al equipo hasta que la persona elige uno.
it("sin preferencia guardada sigue al equipo", () => {
  expect(resolveTheme(null, true)).toBe("dark");
  expect(resolveTheme(undefined, false)).toBe("light");
});

it("una preferencia guardada gana sobre el equipo", () => {
  expect(resolveTheme("light", true)).toBe("light");
  expect(resolveTheme("dark", false)).toBe("dark");
});

it("un valor guardado corrupto cae al tema del equipo", () => {
  expect(resolveTheme("azul", true)).toBe("dark");
  expect(resolveTheme("", false)).toBe("light");
});

it("cada tema tiene su color de barra del navegador", () => {
  expect(THEME_COLOR.light).toBe("#7C3AED");
  expect(THEME_COLOR.dark).toBe("#0b0f19");
});

it("el arranque pinta el tema antes de montar React y el almacén ya no fuerza claro", () => {
  const main = readFileSync("apps/web/src/main.tsx", "utf8");
  expect(main.indexOf("applyTheme(initialTheme())")).toBeGreaterThan(-1);
  expect(main.indexOf("applyTheme(initialTheme())")).toBeLessThan(
    main.indexOf("createRoot("),
  );
  const api = readFileSync("apps/web/src/api.ts", "utf8");
  expect(api).toContain("theme: initialTheme(),");
  expect(api).not.toMatch(/getItem\("fitstore-theme"\) \|\| "light"/);
});

it("MOD-08: el tema se pinta antes del primer dibujo con un script propio, compatible con la política de contenido", () => {
  const html = readFileSync("apps/web/index.html", "utf8");
  const init = html.indexOf('<script src="/theme-init.js"></script>');
  expect(init).toBeGreaterThan(-1);
  expect(init).toBeLessThan(html.indexOf("/src/main.tsx"));
  // La política de seguridad solo permite scripts de este sitio: ninguno en línea.
  expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
  const js = readFileSync("apps/web/public/theme-init.js", "utf8");
  expect(js).toContain('"fitstore-theme"');
  expect(js).toContain("prefers-color-scheme: dark");
  expect(js).toContain("#0b0f19");
  expect(js).toContain("#7C3AED");
});
