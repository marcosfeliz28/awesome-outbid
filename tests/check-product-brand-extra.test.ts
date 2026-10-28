import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const script = "scripts/check-product-brand-extra.mjs";

function run(dir: string) {
  return spawnSync(process.execPath, [script, dir], { encoding: "utf8" });
}

describe("check-product-brand-extra", () => {
  it("sale 0 cuando el build no tiene restos de marca", () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-clean-"));
    try {
      mkdirSync(join(dir, "assets"), { recursive: true });
      writeFileSync(join(dir, "assets", "app.js"), "Nexora POS · ventas y caja");
      const r = run(dir);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Sin restos");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("sale 1 y nombra el archivo y la marca cuando hay un resto", () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-dirty-"));
    try {
      writeFileSync(join(dir, "index.html"), "<title>FitStore</title>");
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("FitStore");
      expect(r.stdout).toContain("index.html");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("detecta MacGen y GV Makeup", () => {
    const dir = mkdtempSync(join(tmpdir(), "brand-multi-"));
    try {
      writeFileSync(
        join(dir, "a.js"),
        "const logo = 'logo-grupo-macgen.png'; // MacGen",
      );
      writeFileSync(join(dir, "b.js"), "bienvenido a GV Makeup Studio");
      const r = run(dir);
      expect(r.status).toBe(1);
      expect(r.stdout).toContain("MacGen");
      expect(r.stdout).toContain("GV Makeup");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("sale 0 si el directorio no existe (sin build)", () => {
    const r = run("no-existe-xyz-12345");
    expect(r.status).toBe(0);
  });
});
