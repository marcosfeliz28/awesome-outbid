import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ARCHIVOS = [
  "FLUJO_CAJA_POS.md",
  "FLUJO_COBROS_Y_TRANSFERENCIAS.md",
  "FLUJO_MERCANCIA.md",
  "GV.md",
  "ROLES_Y_PERMISOS.md",
];
const INICIO = /^\s*(?:[-*+]|\d+[.)])?\s*(?:\*\*)?(Si|Cuando|Solo|No se puede)\b/;

// Ejecuta el script en una carpeta temporal con docs/sistema/<archivo>.md y devuelve las reglas.
function reglasDe(contenido: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "reglas-si-"));
  mkdirSync(join(dir, "docs", "sistema"), { recursive: true });
  for (const a of ARCHIVOS) writeFileSync(join(dir, "docs", "sistema", a), contenido[a] ?? "", "utf8");
  execSync(`node ${JSON.stringify(resolve("scripts/reglas-si.mjs"))}`, { cwd: dir });
  const salida = join(dir, "docs", "diseno", "borradores-local", "reglas-si.json");
  expect(existsSync(salida)).toBe(true);
  return JSON.parse(readFileSync(salida, "utf8")) as { archivo: string; linea: number; texto: string }[];
}

describe("reglas-si: extrae reglas condicionales de docs/sistema", () => {
  it("toma líneas con viñeta, negrita, sangría o número que empiezan por Si/Cuando/Solo/No se puede", () => {
    const r = reglasDe({
      "FLUJO_CAJA_POS.md": [
        "# Título",
        "- Si no hay caja abierta, se pide abrirla.",
        "   - Si el fondo es menor, avisa.",
        "- **Solo** el dueño anula.",
        "1. Cuando el cobro sobra, se devuelve.",
        "No se puede cobrar más que el saldo.",
        "- Siempre se registra.",
        "- Sin cambios aquí.",
        "Texto con Si en medio.",
      ].join("\n"),
    });
    expect(r.map((x) => x.linea)).toEqual([2, 3, 4, 5, 6]);
    expect(r.every((x) => x.archivo === "docs/sistema/FLUJO_CAJA_POS.md")).toBe(true);
  });
  it("cada regla cita una línea que existe y empieza como se dijo", () => {
    const fuente = "- Si el código no existe, se ofrece crear.\n\n- Solo se rechaza una pendiente.\n";
    const r = reglasDe({ "FLUJO_MERCANCIA.md": fuente });
    const lineas = fuente.split("\n");
    expect(r).toHaveLength(2);
    for (const x of r) {
      expect(lineas[x.linea - 1].trim()).toBe(x.texto);
      expect(INICIO.test(lineas[x.linea - 1])).toBe(true);
    }
  });
  it("sobre los documentos reales, todas las citas existen y empiezan bien", () => {
    const raiz = resolve(".");
    const salida = resolve("docs/diseno/borradores-local/reglas-si.json");
    expect(existsSync(salida)).toBe(true);
    const r = JSON.parse(readFileSync(salida, "utf8")) as { archivo: string; linea: number; texto: string }[];
    expect(r.length).toBeGreaterThan(0);
    for (const x of r) {
      const lineas = readFileSync(join(raiz, x.archivo), "utf8").split("\n");
      expect(lineas[x.linea - 1]?.trim()).toBe(x.texto);
      expect(INICIO.test(lineas[x.linea - 1])).toBe(true);
    }
  });
  it("genera una tarea por cada 5 reglas, con su entrada y salida", () => {
    const fuente = Array.from({ length: 7 }, (_, i) => `- Si pasa ${i}, haz ${i}.`).join("\n");
    const dir = mkdtempSync(join(tmpdir(), "reglas-si-"));
    mkdirSync(join(dir, "docs", "sistema"), { recursive: true });
    for (const a of ARCHIVOS) writeFileSync(join(dir, "docs", "sistema", a), a === "GV.md" ? fuente : "", "utf8");
    execSync(`node ${JSON.stringify(resolve("scripts/reglas-si.mjs"))}`, { cwd: dir });
    const base = join(dir, "docs", "diseno", "borradores-local");
    const tareas = JSON.parse(readFileSync(join(base, "reglas-tareas.json"), "utf8")).tareas;
    expect(tareas.map((t: { id: string }) => t.id)).toEqual(["R01-reglas-si", "R02-reglas-si"]);
    expect(tareas[0].salida).toBe("docs/diseno/borradores-local/reglas-lote-01.md");
    expect(tareas[0].modelo).toBe("qwen-optimizado");
    expect(tareas[0].instrucciones).toContain("máximo 25 palabras");
    expect(JSON.parse(readFileSync(join(base, "reglas-lote-01-entrada.json"), "utf8"))).toHaveLength(5);
    expect(JSON.parse(readFileSync(join(base, "reglas-lote-02-entrada.json"), "utf8"))).toHaveLength(2);
  });
});
