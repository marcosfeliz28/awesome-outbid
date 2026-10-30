import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Ejecuta el script en un repositorio temporal con un único .md y devuelve el informe.
function informeDe(texto: string): string {
  const dir = mkdtempSync(join(tmpdir(), "tildes-"));
  execSync("git init -q", { cwd: dir });
  mkdirSync(join(dir, "docs", "auditoria"), { recursive: true });
  writeFileSync(join(dir, "docs", "ejemplo.md"), texto, "utf8");
  execSync("git add -A", { cwd: dir });
  execSync(`node ${JSON.stringify(resolve("scripts/tildes-nuevas.mjs"))}`, { cwd: dir });
  return readFileSync(join(dir, "docs", "auditoria", "TILDES_NUEVAS.md"), "utf8");
}

describe("tildes-nuevas: «?» dentro de palabras en documentos", () => {
  it("marca una tilde rota dentro de una palabra", () => {
    expect(informeDe("Ese paciente se pacie?te\n")).toContain("? en palabra");
  });
  it("ignora una URL con ? de consulta", () => {
    expect(informeDe("Visita https://ejemplo.com/buscar?texto=hola para más\n")).not.toContain("? en palabra");
  });
  it("ignora código dentro de comillas invertidas", () => {
    expect(informeDe("Usa `usuario?nombre` en el código\n")).not.toContain("? en palabra");
  });
  it("ignora el encadenamiento opcional de TypeScript", () => {
    expect(informeDe("const x = cliente?.nombre ?? ''\n")).not.toContain("? en palabra");
  });
});
