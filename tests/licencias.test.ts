// G14 · Avisos de licencia de lo que va dentro de la web y del instalador.
// El archivo completo lo genera `node scripts/licencias-web.mjs` (con
// `--check` comprueba que esté al día compilando la web).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentType } from "../instalador/runtime/web-server.mjs";

const read = (path: string) => readFileSync(path, "utf8");
const notices = () => read("apps/web/public/licencias.txt");

describe("G14 · licencias de terceros", () => {
  it("la web publica los avisos de Inter, Plus Jakarta Sans (OFL 1.1) y Lucide (ISC)", () => {
    const text = notices();
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(text).toContain("The Inter Project Authors");
    expect(text).toContain("The Plus Jakarta Sans Project Authors");
    expect(text).toMatch(/^- lucide-react [\d.]+ · ISC$/m);
    expect(text).toContain("Lucide Contributors");
    expect(text).toContain("Cole Bemis");
    expect(text).toMatch(/^- react [\d.]+ · MIT$/m);
    expect(text).toContain("Permission is hereby granted, free of charge");
  });

  it("toda dependencia de producción que importa la web está en el aviso", () => {
    const pkg = JSON.parse(read("apps/web/package.json"));
    const sources = readdirSync("apps/web/src")
      .filter((f) => /\.(tsx?|css)$/.test(f))
      .map((f) => read(join("apps/web/src", f)))
      .join("\n");
    const text = notices();
    const missing = Object.keys(pkg.dependencies)
      .filter((name) => !name.startsWith("@fitstore/"))
      .filter((name) => sources.includes('"' + name))
      .filter((name) => !new RegExp("^- " + name + " ", "m").test(text));
    expect(missing).toEqual([]);
  });

  it("el aviso del instalador cubre la web: fuentes, íconos y lista de librerías", () => {
    const text = read("instalador/THIRD_PARTY_NOTICES.txt");
    expect(text).toContain("app\\web\\licencias.txt");
    expect(text).toContain("SIL OPEN FONT LICENSE Version 1.1");
    expect(text).toContain("Lucide Contributors");
    expect(text).toMatch(/^- react-dom [\d.]+ · MIT$/m);
    // El servidor web del instalador lo sirve como texto, no como descarga.
    expect(contentType("licencias.txt")).toBe("text/plain; charset=utf-8");
  });

  it("la versión de «Acerca de» es la del instalador", () => {
    expect(JSON.parse(read("apps/web/package.json")).version).toBe(
      read("instalador/VERSION").trim(),
    );
  });

  it("el origen del ícono y de las ilustraciones SVG está documentado", () => {
    const doc = "docs/legal/ORIGEN_DE_ACTIVOS.md";
    expect(existsSync(doc)).toBe(true);
    const text = read(doc);
    for (const asset of [
      "apps/web/public/icon.svg",
      "instalador/assets/fitstore.ico",
      "apps/web/public/products/*.svg",
    ])
      expect(text).toContain(asset);
  });
});
