import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Bloque 15 (scripts de informe, solo lectura): cada script corre sin tocar el
// repositorio (escribe en una carpeta temporal con --out) y su informe tiene la
// forma esperada. Las comprobaciones estrictas son invariantes que hoy se cumplen.
const root = new URL("..", import.meta.url).pathname;
const tmp = mkdtempSync(join(tmpdir(), "bloque15-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function informe(script: string): string {
  const out = join(tmp, `${script}.md`);
  execFileSync(
    process.execPath,
    [join(root, "scripts", `${script}.mjs`), "--out", out],
    {
      cwd: root,
      stdio: "pipe",
    },
  );
  return readFileSync(out, "utf8");
}

describe("scripts de informe del bloque 15", () => {
  it("etiquetas-menu: el menú del código coincide con PANTALLAS.md", () => {
    const md = informe("etiquetas-menu");
    expect(md).toContain("Pantallas en el código: 18");
    expect(md).toContain("- Ninguna: etiquetas, permisos y orden coinciden.");
  });

  it("nombre-producto-conteo: tabla con totales por archivo", () => {
    const md = informe("nombre-producto-conteo");
    expect(md).toContain("| Archivo | «Nexora POS» | «Nexora» | «Norexos» |");
    expect(md).toMatch(/Archivos con al menos una aparición: \d+\. Totales:/);
  });

  it("rutas-y-permisos: toda ruta encontrada declara permiso o es pública", () => {
    const md = informe("rutas-y-permisos");
    expect(md).toMatch(/Rutas encontradas: (\d{3,})\./);
    expect(md).toContain("Sin permiso declarado: 0.");
  });

  it("mapa-de-pruebas: una fila por archivo de tests/*.test.ts", () => {
    const md = informe("mapa-de-pruebas");
    const archivos = readdirSync(join(root, "tests")).filter((f) =>
      f.endsWith(".test.ts"),
    );
    expect(md).toContain(`Archivos de prueba: ${archivos.length}.`);
    expect(
      md.split("\n").filter((l) => l.startsWith("| `tests/")),
    ).toHaveLength(archivos.length);
  });

  it("tildes-nuevas: corre y entrega su conteo", () => {
    expect(informe("tildes-nuevas")).toMatch(/Hallazgos: \d+\./);
  });

  it("prohibidos-en-borradores: separa promesas de menciones negadas", () => {
    const md = informe("prohibidos-en-borradores");
    expect(md).toContain("## Posible promesa (revisar)");
    expect(md).toContain("## Mención negada o histórica");
  });
});
