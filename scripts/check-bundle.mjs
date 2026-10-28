#!/usr/bin/env node
/**
 * check-bundle.mjs
 *
 * Verifica que ningún archivo .js de dist/assets supere el límite de tamaño
 * permitido (1,90 MiB = 1,90 × 1024 × 1024 bytes = 1 992 294,4 bytes).
 *
 * Uso (desde apps/web, tal como lo invoca el script `check:bundle`):
 *   node ../../scripts/check-bundle.mjs
 *
 * Opcionalmente puede recibir la ruta del directorio de assets como primer
 * argumento:
 *   node ../../scripts/check-bundle.mjs <ruta-a-dist/assets>
 *
 * Salida:
 *   0  -> todos los .js están dentro del límite.
 *   1  -> al menos un .js supera el límite (o no existe el directorio).
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const LIMIT_MIB = 1.9;
const LIMIT_BYTES = LIMIT_MIB * 1024 * 1024;

// Cuando se ejecuta como script de npm, el cwd es apps/web, por lo que
// dist/assets apunta a apps/web/dist/assets.
const assetsDir = resolve(
  process.argv[2] ?? join(process.cwd(), 'dist', 'assets'),
);

let entries;
try {
  entries = readdirSync(assetsDir, { recursive: true, withFileTypes: true });
} catch {
  console.error(`check-bundle: no se encontró el directorio de assets: ${assetsDir}`);
  console.error('check-bundle: ejecuta primero la compilación (pnpm build) y vuelve a intentar.');
  process.exit(1);
}

const jsFiles = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
  .map((entry) => join(entry.parentPath, entry.name));

if (jsFiles.length === 0) {
  console.log(`check-bundle: no hay archivos .js en ${assetsDir}. Nada que verificar.`);
  process.exit(0);
}

const overLimit = [];
for (const file of jsFiles) {
  const size = statSync(file).size;
  if (size > LIMIT_BYTES) {
    overLimit.push({ file, size });
  }
}

if (overLimit.length > 0) {
  console.error(
    `check-bundle: ${overLimit.length} archivo(s) .js superan el límite de ${LIMIT_MIB.toFixed(2)} MiB (${LIMIT_BYTES.toFixed(1)} bytes):`,
  );
  for (const { file, size } of overLimit) {
    console.error(
      `  - ${file}: ${(size / 1024 / 1024).toFixed(2)} MiB (${size} bytes)`,
    );
  }
  process.exit(1);
}

console.log(
  `check-bundle: OK. ${jsFiles.length} archivo(s) .js dentro del límite de ${LIMIT_MIB.toFixed(2)} MiB.`,
);
process.exit(0);
