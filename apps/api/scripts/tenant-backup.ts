// Uso local del respaldo lógico por empresa. No toma DATABASE_URL: obliga a
// especificar una conexión separada para evitar ejecutar sobre la tienda.
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { createTenantBackup, restoreTenantBackup } from "../src/tenant-backup";

const [mode, idOrPath, path] = process.argv.slice(2);
const passphrase = process.env.BACKUP_ENCRYPTION_KEY;
if (!passphrase) throw new Error("Falta BACKUP_ENCRYPTION_KEY.");

async function main() {
  if (mode === "create") {
    if (!idOrPath || !path) throw new Error("Uso: tenant:backup create <tenant-uuid> <archivo.nxtb>");
    const url = process.env.TENANT_BACKUP_DATABASE_URL;
    if (!url) throw new Error("Falta TENANT_BACKUP_DATABASE_URL (nunca DATABASE_URL).");
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const counts = await createTenantBackup({ prisma, tenantId: idOrPath, target: resolve(path), passphrase });
      console.log(`Respaldo cifrado creado: ${Object.values(counts).reduce((a, b) => a + b, 0)} filas.`);
    } finally { await prisma.$disconnect(); }
    return;
  }
  if (mode === "restore") {
    if (!idOrPath || path) throw new Error("Uso: tenant:backup restore <archivo.nxtb>");
    if (process.env.NEXORA_DISPOSABLE_RESTORE !== "RESTORE_TO_DISPOSABLE_TEST_DATABASE")
      throw new Error("Falta NEXORA_DISPOSABLE_RESTORE=RESTORE_TO_DISPOSABLE_TEST_DATABASE.");
    const url = process.env.TENANT_RESTORE_DATABASE_URL;
    if (!url) throw new Error("Falta TENANT_RESTORE_DATABASE_URL (nunca DATABASE_URL).");
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const result = await restoreTenantBackup({ prisma, source: resolve(idOrPath), passphrase,
        disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" });
      console.log(`Restauración de prueba verificada: ${Object.values(result.counts).reduce((a, b) => a + b, 0)} filas.`);
    } finally { await prisma.$disconnect(); }
    return;
  }
  throw new Error("Uso: tenant:backup create|restore ...");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Fallo de respaldo.");
  process.exitCode = 1;
});
