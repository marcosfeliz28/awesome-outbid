import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";

// Cada cita archivo:línea de docs/sistema debe apuntar a un archivo y a una línea que existan.
const archivos = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);

describe("citas de docs/sistema", () => {
  it("todas las citas archivo:línea apuntan a un archivo y a una línea existentes", () => {
    const malas: string[] = [];
    for (const f of readdirSync("docs/sistema").filter((x) => x.endsWith(".md"))) {
      const txt = readFileSync(`docs/sistema/${f}`, "utf8");
      for (const m of txt.matchAll(/([A-Za-z0-9_./-]+\.(?:ts|tsx|md|mjs|sql|css|json|ps1)):(\d+)(?:-(\d+))?/g)) {
        const ruta = m[1];
        const fin = Number(m[3] ?? m[2]);
        const cands = ruta.includes("/") ? archivos.filter((a) => a === ruta) : archivos.filter((a) => a === ruta || a.endsWith("/" + ruta));
        const ok = cands.some((c) => readFileSync(c, "utf8").split("\n").length >= fin);
        if (!ok) malas.push(`${f}: ${ruta}:${m[2]}`);
      }
    }
    expect(malas).toEqual([]);
  });
});
