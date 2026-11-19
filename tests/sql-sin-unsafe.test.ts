// Seguridad 16: el código de la API no usa $queryRawUnsafe. Las consultas crudas van con
// Prisma.sql (plantilla etiquetada, valores como parámetros). Las pruebas pueden usarlo.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return n.endsWith(".ts") ? [ruta] : [];
  });
}

// Producto multiempresa (19-nov): infraestructura de tenant que necesita SQL
// dinámico. Identificadores citados desde el catálogo y valores como $1; cada
// archivo tiene su prueba PostgreSQL (aislamiento, exportación y respaldo).
const PERMITIDOS = [
  "api/src/common.ts",
  "api/src/tenant-database.ts",
  "api/src/registration.ts",
  "api/src/tenant-export.ts",
  "api/src/tenant-backup.ts",
  // tenant:purge (blindaje2): tablas del catálogo de Prisma citadas con q(), valores $1.
  "api/src/tenant-purge.ts",
];

describe("seguridad 16 · SQL crudo en la API", () => {
  it("ningún archivo de apps/api/src usa $queryRawUnsafe", () => {
    const hallazgos = archivos(join(process.cwd(), "apps", "api", "src"))
      .filter((f) => readFileSync(f, "utf8").includes("$queryRawUnsafe"))
      .map((f) => f.split(/[\\/]apps[\\/]/)[1].replace(/\\/g, "/"))
      .filter((f) => !PERMITIDOS.includes(f));
    expect(hallazgos).toEqual([]);
  });
});
