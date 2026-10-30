// Cada cita `archivo:línea` de docs/sistema/*.md debe apuntar a un archivo que existe y a una
// línea que existe (rangos incluidos). Si alguien cita una línea inexistente, la prueba falla.
// Las citas con solo el nombre del archivo (p. ej. `App.tsx:197`) se buscan por nombre en el repo;
// si el nombre no es único, se exige que alguna coincidencia tenga esa línea.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const DOCS = join(RAIZ, "docs", "sistema");
const SOLO_CIERRE = /^[\s{}()[\];,]*$/;
const CITA =
  /([A-Za-z0-9_./-]+\.(?:tsx?|mjs|cjs|ps1|md|json|nsi|sql|css|html|yml|yaml|txt|cs|rs)):(\d+)(?:-(\d+))?/g;

function archivos(dir: string, filtro: (n: string) => boolean): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".git" || n === "dist") return [];
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta, filtro);
    return filtro(n) ? [ruta] : [];
  });
}

const indice = archivos(join(RAIZ, "apps"), () => true)
  .concat(archivos(join(RAIZ, "packages"), () => true))
  .concat(archivos(join(RAIZ, "docs"), () => true))
  .concat(archivos(join(RAIZ, "scripts"), () => true))
  .concat(archivos(join(RAIZ, "tests"), () => true))
  .concat(archivos(join(RAIZ, ".claude"), () => true))
  .concat(archivos(join(RAIZ, ".github"), () => true))
  .concat(
    readdirSync(RAIZ)
      .map((n) => join(RAIZ, n))
      .filter((r) => statSync(r).isFile()),
  );

function resolver(cita: string): string[] {
  if (cita.includes("/")) {
    const directa = join(RAIZ, cita);
    if (existsSync(directa) && statSync(directa).isFile()) return [directa];
  }
  const nombre = cita.split("/").pop()!;
  return indice.filter(
    (f) =>
      f.split(/[\\/]/).pop() === nombre &&
      (!cita.includes("/") || f.endsWith(cita)),
  );
}

function citas() {
  const salida: {
    doc: string;
    archivo: string;
    desde: number;
    hasta: number;
  }[] = [];
  for (const doc of archivos(DOCS, (n) => n.endsWith(".md"))) {
    const texto = readFileSync(doc, "utf8");
    for (const m of texto.matchAll(CITA)) {
      const desde = Number(m[2]);
      const hasta = m[3] ? Number(m[3]) : desde;
      salida.push({ doc: relative(RAIZ, doc), archivo: m[1], desde, hasta });
    }
  }
  return salida;
}

describe("citas de docs/sistema", () => {
  const todas = citas();

  it("hay citas que revisar", () => {
    expect(todas.length).toBeGreaterThan(100);
  });

  it("cada cita apunta a un archivo y a una línea que existen", () => {
    const rotas: string[] = [];
    for (const c of todas) {
      const candidatos = resolver(c.archivo);
      const ok = candidatos.some((ruta) => {
        const lineas = readFileSync(ruta, "utf8").split("\n").length;
        return c.hasta >= c.desde && c.desde >= 1 && c.hasta <= lineas;
      });
      if (!ok)
        rotas.push(
          `${c.doc}: ${c.archivo}:${c.desde}${c.hasta !== c.desde ? "-" + c.hasta : ""} ${candidatos.length ? "(línea fuera de rango)" : "(archivo no encontrado)"}`,
        );
    }
    expect(rotas).toEqual([]);
  });

  // Una cita a una línea vacía o de solo llaves (`}`, `);`, `})`) casi siempre quedó
  // desplazada tras un cambio de código. Si todos los archivos candidatos tienen esa
  // línea en blanco o de cierre, la cita falla.
  it("ninguna cita apunta a una línea vacía o de solo llaves", () => {
    const vacias: string[] = [];
    for (const c of todas) {
      const candidatos = resolver(c.archivo);
      if (candidatos.length === 0) continue;
      const todasVacias = candidatos.every((ruta) => {
        const linea = readFileSync(ruta, "utf8").split("\n")[c.desde - 1] ?? "";
        return SOLO_CIERRE.test(linea);
      });
      if (todasVacias)
        vacias.push(`${c.doc}: ${c.archivo}:${c.desde} (línea vacía o de solo llaves)`);
    }
    expect(vacias).toEqual([]);
  });
});
