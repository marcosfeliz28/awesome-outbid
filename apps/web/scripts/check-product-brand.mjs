import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.VITE_PRODUCT_TENANCY !== "required") process.exit(0);

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const forbidden = [
  ["MacGen", /macgen/i],
  ["GV Makeup", /gv\s*makeup/i],
  ["cuenta de demostración", /admin@fitstore\.demo/i],
  ["contraseña de demostración", /FitStore-Demo-2026!/i],
];
const textExtensions = /\.(?:css|html|js|json|map|svg|txt|webmanifest|xml)$/i;
const leaks = [];

async function walk(directory) {
  for (const name of await readdir(directory)) {
    const path = join(directory, name);
    const info = await stat(path);
    if (info.isDirectory()) {
      await walk(path);
      continue;
    }
    if (!textExtensions.test(name)) continue;
    const content = await readFile(path, "utf8");
    for (const [label, pattern] of forbidden)
      if (pattern.test(content)) leaks.push(`${relative(root, path)}: ${label}`);
  }
}

await walk(root);
if (leaks.length) {
  console.error("La compilación del producto contiene marca o acceso de la tienda:");
  for (const leak of leaks) console.error(`- ${leak}`);
  process.exitCode = 1;
} else {
  console.log("Marca del producto: artefacto compilado sin datos de la tienda.");
}
