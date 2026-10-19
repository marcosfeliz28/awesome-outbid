import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { restoreDump } from "./backup.mjs";

// Uso: RESTORE_DATABASE_URL=<base nueva y vacía> node scripts/restore.mjs <archivo.dump> [--jobs N]
// Verifica el SHA-256 contra el manifiesto y que la base destino no tenga
// tablas en public ANTES de restaurar; si no está vacía, no toca nada. Por
// defecto usa --single-transaction --exit-on-error (todo o nada). --jobs N
// (paralelo) sólo corre tras esa comprobación y no es compatible con
// --single-transaction: si falla puede dejar objetos parciales en esa base
// nueva; bórrala y repite.
async function main() {
  const args = process.argv.slice(2);
  const jobsIndex = args.indexOf("--jobs");
  let jobs = 1;
  if (jobsIndex !== -1) {
    jobs = Number(args[jobsIndex + 1]);
    if (!Number.isInteger(jobs) || jobs < 1)
      throw new Error("--jobs necesita un entero >= 1.");
    args.splice(jobsIndex, 2);
  }
  const [dump] = args;
  const url = process.env.RESTORE_DATABASE_URL;
  if (!dump || !url) {
    throw new Error(
      "Uso: RESTORE_DATABASE_URL=<base nueva vacía> node scripts/restore.mjs <archivo.dump> [--jobs N]",
    );
  }
  await restoreDump(resolve(dump), url, { jobs });
  console.log("Restauración completada tras verificar el SHA-256.");
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
