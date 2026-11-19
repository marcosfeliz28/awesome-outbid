// Baja definitiva de una empresa (operador; sin ruta HTTP). Ver src/tenant-purge.ts.
// Por defecto sólo cuenta (--dry-run). Para borrar de verdad:
//   TENANT_PURGE_DATABASE_URL=... PRODUCT_TENANCY=required \
//   pnpm --filter @fitstore/api tenant:purge <slug> --ejecutar --confirmar <slug> --exportacion empresa.json [--aceptar-faltantes N]
//   (con --exportacion, el dry-run también verifica y cuenta los archivos faltantes)
// No toma DATABASE_URL: obliga a nombrar la base a propósito.
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { purgeTenant } from "../src/tenant-purge";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};

async function main() {
  const slug = args[0];
  if (!slug || slug.startsWith("--"))
    throw new Error(
      "Uso: tenant:purge <slug> [--dry-run] | <slug> --ejecutar --confirmar <slug> --exportacion <archivo.json> [--aceptar-faltantes N]",
    );
  const execute = args.includes("--ejecutar") && !args.includes("--dry-run");
  const url = process.env.TENANT_PURGE_DATABASE_URL;
  if (!url)
    throw new Error("Falta TENANT_PURGE_DATABASE_URL (nunca DATABASE_URL).");
  if (execute && process.env.PRODUCT_TENANCY !== "required")
    throw new Error(
      "Borrar exige PRODUCT_TENANCY=required (almacén de archivos del producto).",
    );
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    const exportPath = flag("--exportacion");
    const accept = flag("--aceptar-faltantes");
    if (accept !== undefined && !/^\d+$/.test(accept))
      throw new Error("--aceptar-faltantes exige un número entero exacto.");
    const result = await purgeTenant({
      db,
      slug,
      execute,
      confirm: flag("--confirmar"),
      exportPath: exportPath ? resolve(exportPath) : undefined,
      acceptMissing: accept === undefined ? undefined : Number(accept),
      log: (line) => console.error(line),
    });
    console.log(
      JSON.stringify(
        {
          modo: result.executed ? "borrado" : "dry-run (no se borró nada)",
          empresa: result.slug,
          tenantId: result.tenantId,
          suspendida: result.suspendedAt,
          filas: result.counts,
          conservadas: result.kept,
          archivos: result.objects.length,
          archivosFaltantesEnExportacion: result.faltantes ?? "sin --exportacion: no verificado",
          archivosFallidos: result.objectsFailed,
          fecha: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    if (result.objectsFailed.length) process.exitCode = 2;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Fallo de la baja.");
  process.exitCode = 1;
});
