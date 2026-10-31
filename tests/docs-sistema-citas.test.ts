import { fileURLToPath } from "node:url";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Base del sistema (docs/sistema): cada cita `archivo:línea` o `archivo:a-b`
// debe apuntar a un archivo que existe y a una línea que existe. Una cita
// sin carpeta (`sales.ts:1469`) se resuelve por nombre de archivo en el repo.
// Solo comprueba que la línea exista, no que el texto citado sea el correcto.
const root = fileURLToPath(new URL("..", import.meta.url));
const docs = join(root, "docs/sistema");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".git", "dist", "build", ".scratch"].includes(name))
      continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const porNombre = new Map<string, string[]>();
for (const name of readdirSync(root)) {
  const full = join(root, name);
  if (statSync(full).isFile()) porNombre.set(name, [full]);
}
for (const base of [
  "apps",
  "packages",
  "tests",
  "docs",
  "scripts",
  ".claude",
  "instalador",
  ".github",
]) {
  const dir = join(root, base);
  if (!existsSync(dir)) continue;
  for (const file of walk(dir)) {
    const lista = porNombre.get(basename(file)) ?? [];
    lista.push(file);
    porNombre.set(basename(file), lista);
  }
}

const lineCount = new Map<string, number>();
function lineas(file: string): number {
  let n = lineCount.get(file);
  if (n === undefined) {
    const text = readFileSync(file, "utf8");
    n =
      text === "" ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
    lineCount.set(file, n);
  }
  return n;
}

function resolver(ref: string): string[] {
  const exacto = join(root, ref);
  if (ref.includes("/") && existsSync(exacto) && statSync(exacto).isFile())
    return [exacto];
  return porNombre.get(basename(ref)) ?? [];
}

// `alternas`: otros archivos citados antes en el mismo documento; una cita «:n» sin
// archivo puede referirse a cualquiera de ellos (p. ej. «Tienda.tsx:585-786 … `:1748`»).
type Cita = {
  doc: string;
  linea: number;
  ref: string;
  alternas: string[];
  desde: number;
  hasta: number;
};

export function extraerCitas(texto: string, doc: string): Cita[] {
  const citas: Cita[] = [];
  // Las viñetas repiten «:n» sin nombrar el archivo: «última cita» vale dentro
  // de la sección (hasta el siguiente título de nivel 1 o 2) y «citadas antes»
  // en todo el documento (p. ej. el esquema nombrado al inicio de DATOS_Y_MODELOS).
  let ultimo: string | null = null;
  const vistos: string[] = [];
  texto.split("\n").forEach((linea, i) => {
    if (/^#{1,2} /.test(linea)) ultimo = null;
    // Cada `…` puede traer «archivo:n», «:n» (mismo archivo que la cita anterior)
    // o varias referencias separadas por coma o punto y coma.
    for (const span of linea.matchAll(/`([^`]+)`/g)) {
      for (const parte of span[1].split(/[;,]\s*/)) {
        const sinLinea = parte
          .trim()
          .match(
            /^([A-Za-z0-9_./-]+\.(?:tsx?|mjs|prisma|sql|json|md|css|ya?ml))$/,
          );
        if (sinLinea && !vistos.includes(sinLinea[1])) vistos.push(sinLinea[1]);
        const m = parte
          .trim()
          .match(/^(?:([A-Za-z0-9_./-]+\.[A-Za-z0-9]+))?:(\d+)(?:-(\d+))?$/);
        if (!m) continue;
        const ref = m[1] ?? ultimo;
        if (!ref) continue;
        const alternas = m[1] ? [] : vistos.filter((v) => v !== ref);
        ultimo = ref;
        if (!vistos.includes(ref)) vistos.push(ref);
        const desde = Number(m[2]);
        const hasta = m[3] ? Number(m[3]) : desde;
        citas.push({ doc, linea: i + 1, ref, alternas, desde, hasta });
      }
    }
  });
  return citas;
}

const archivos = readdirSync(docs).filter((f) => f.endsWith(".md"));
const todas = archivos.flatMap((f) =>
  extraerCitas(readFileSync(join(docs, f), "utf8"), f),
);

describe("Citas archivo:línea de docs/sistema", () => {
  it("hay citas que comprobar", () => {
    expect(archivos.length).toBeGreaterThanOrEqual(10);
    expect(todas.length).toBeGreaterThan(300);
  });

  it("extrae citas simples, rangos y continuaciones", () => {
    const c = extraerCitas("(`a/b.ts:3`, `:5-7`; `c.ts:9`, `:11`)", "x.md");
    expect(c.map((x) => [x.ref, x.desde, x.hasta])).toEqual([
      ["a/b.ts", 3, 3],
      ["a/b.ts", 5, 7],
      ["c.ts", 9, 9],
      ["c.ts", 11, 11],
    ]);
    expect(c[3].alternas).toEqual(["a/b.ts"]);
  });

  it("cada cita apunta a un archivo y a una línea que existen", () => {
    const rotas = todas.flatMap((c) => {
      const candidatos = [c.ref, ...c.alternas].flatMap(resolver);
      if (candidatos.length === 0)
        return [`${c.doc}:${c.linea} → ${c.ref}: el archivo no existe`];
      const bien = candidatos.some(
        (f) => c.desde >= 1 && c.desde <= c.hasta && c.hasta <= lineas(f),
      );
      return bien
        ? []
        : [
            `${c.doc}:${c.linea} → ${c.ref}:${c.desde}${c.hasta !== c.desde ? `-${c.hasta}` : ""}: la línea no existe (${candidatos.map((f) => `${relative(root, f)} tiene ${lineas(f)}`).join("; ")})`,
          ];
    });
    expect(rotas).toEqual([]);
  });
});
