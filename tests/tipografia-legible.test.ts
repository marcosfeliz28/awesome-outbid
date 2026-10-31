import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Orden 97 (letra legible en laptops): tamaños de letra desde los tokens de
// :root, base de 16 px y nada bajo 14 px fuera de impresión.
const SRC = join(__dirname, "..", "apps", "web", "src");
const css = readdirSync(SRC).filter((f) => f.endsWith(".css"));

/** Quita los bloques @media print: tickets y facturas conservan su escala. */
function sinImpresion(texto: string): string {
  let salida = "";
  let i = 0;
  while (i < texto.length) {
    const inicio = texto.indexOf("@media print", i);
    if (inicio < 0) {
      salida += texto.slice(i);
      break;
    }
    salida += texto.slice(i, inicio);
    let prof = 0;
    let j = texto.indexOf("{", inicio);
    for (; j < texto.length; j++) {
      if (texto[j] === "{") prof++;
      if (texto[j] === "}" && --prof === 0) break;
    }
    i = j + 1;
  }
  return salida;
}

describe("tipografía legible", () => {
  it("la base de :root es de 16 px", () => {
    const estilos = readFileSync(join(SRC, "styles.css"), "utf8");
    const raiz = /:root\s*\{[^}]*?font-size:\s*(\d+)px/.exec(estilos);
    expect(raiz?.[1]).toBe("16");
  });

  it("ningún font-size en px queda suelto bajo 14 px", () => {
    const sueltos: string[] = [];
    for (const f of css) {
      const t = sinImpresion(readFileSync(join(SRC, f), "utf8"));
      for (const m of t.matchAll(/font-size:\s*([\d.]+)px/g)) {
        if (Number(m[1]) < 14) sueltos.push(`${f}: ${m[0]}`);
      }
    }
    expect(sueltos).toEqual([]);
  });

  it("los tokens --fs-* no bajan de 14 px", () => {
    const estilos = readFileSync(join(SRC, "styles.css"), "utf8");
    const tokens = [...estilos.matchAll(/--fs-(\d+):\s*([\d.]+)px/g)];
    expect(tokens.length).toBeGreaterThan(5);
    for (const t of tokens) expect(Number(t[2])).toBeGreaterThanOrEqual(14);
  });
});
