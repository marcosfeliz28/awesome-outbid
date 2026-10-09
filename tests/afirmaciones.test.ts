// G13 · Frases sin respaldo en la interfaz y en los documentos.
// Lo que se dice debe poder comprobarse en el código
// (docs/legal/LICENCIAS_Y_AFIRMACIONES.md, parte B).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const UI = [
  ...readdirSync("apps/web/src")
    .filter((f) => /\.(tsx?|css)$/.test(f))
    .map((f) => join("apps/web/src", f)),
  "apps/web/index.html",
  "apps/web/vite.config.ts",
  "packages/ui/src/index.tsx",
];
const DOCS = [
  "README.md",
  "docs/ENTREGA.md",
  "docs/MANUAL.md",
  "docs/MANUAL-CAJERO.md",
  "docs/SENTRY-API.md",
  "docs/DEPLOY-RENDER.md",
  "docs/INSTALADOR.md",
  "docs/fiscal/REQUISITOS_FISCALES_RD.md",
];
const REVIEWS = readdirSync("docs")
  .filter((f) => /^AUDITORIA_.*\.md$/.test(f))
  .map((f) => join("docs", f))
  .concat("docs/INSTRUCCIONES_AUDITORIA_GEMINI_CLOUD.md");

describe("G13 · afirmaciones verificables", () => {
  it("la interfaz y los documentos no usan absolutos sin respaldo", () => {
    const forbidden = [
      /lo m[aá]s seguro/i,
      /opci[oó]n m[aá]s segura/i,
      /anulaci[oó]n(es)? auditada/i,
      /monitoreo seguro/i,
    ];
    const found = [...UI, ...DOCS].flatMap((path) =>
      forbidden
        .filter((phrase) => phrase.test(read(path)))
        .map((phrase) => path + ": " + phrase),
    );
    expect(found).toEqual([]);
  });

  it("«respaldos cifrados» sólo como recomendación, aclarando que el sistema no cifra", () => {
    for (const path of [...UI, ...DOCS]) {
      const text = read(path);
      if (/respaldos? cifrados?/i.test(text))
        expect(text, path).toContain("aún no cifra el volcado por su cuenta");
    }
  });

  it("el manifest de la PWA se llama «Nexora POS» y no promete facturación", () => {
    const config = read("apps/web/vite.config.ts");
    const manifest = config.slice(config.indexOf("manifest:"));
    expect(manifest).toMatch(/^manifest:\s*\{\s*name:\s*"Nexora POS",/);
    const description = manifest.match(/description:\s*"([^"]*)"/)?.[1];
    expect(description).toBeTruthy();
    expect(description).not.toMatch(/factura/i);
    expect(read("apps/web/index.html")).not.toMatch(/factura/i);
  });

  it("las revisiones con IA no se presentan como auditoría independiente", () => {
    for (const path of REVIEWS) {
      const [title, ...rest] = read(path).split("\n");
      expect(title, path).not.toMatch(/auditor[ií]a independiente/i);
      expect(rest.slice(0, 4).join("\n"), path).toContain(
        "No es una auditoría independiente",
      );
    }
  });
});
