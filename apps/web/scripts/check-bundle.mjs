/* global console, process, URL */
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const MIB = 1024 * 1024;
const MAX_ASSET_BYTES = 1.9 * MIB;
const MAX_ENTRY_BYTES = 1.15 * MIB;
const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const assets = join(dist, "assets");

const javascript = (await readdir(assets)).filter((name) =>
  name.endsWith(".js"),
);
if (!javascript.length) {
  console.error(
    "Bundle: no se encontraron archivos JavaScript en dist/assets.",
  );
  process.exit(1);
}

const sizes = new Map();
for (const name of javascript)
  sizes.set(name, (await stat(join(assets, name))).size);

const oversized = [...sizes].filter(([, size]) => size > MAX_ASSET_BYTES);
if (oversized.length) {
  console.error("Bundle: hay JavaScript que supera el límite de 1,90 MiB:");
  for (const [name, size] of oversized)
    console.error(`- ${name}: ${(size / MIB).toFixed(2)} MiB`);
  process.exit(1);
}

const html = await readFile(join(dist, "index.html"), "utf8");
const entryMatch = html.match(
  /<script[^>]+src=["']\/assets\/([^"']+\.js)["']/i,
);
if (!entryMatch) {
  console.error(
    "Bundle: no se pudo identificar la entrada JavaScript en dist/index.html.",
  );
  process.exit(1);
}

const entry = basename(entryMatch[1]);
const entrySize = sizes.get(entry);
if (entrySize === undefined) {
  console.error(`Bundle: la entrada ${entry} no existe en dist/assets.`);
  process.exit(1);
}
if (entrySize > MAX_ENTRY_BYTES) {
  console.error(
    `Bundle: la entrada ${entry} pesa ${(entrySize / MIB).toFixed(2)} MiB; ` +
      "el objetivo máximo es 1,15 MiB.",
  );
  process.exit(1);
}

const largest = [...sizes].sort((a, b) => b[1] - a[1])[0];
console.log(
  `Bundle: entrada ${(entrySize / MIB).toFixed(2)} MiB; ` +
    `mayor archivo ${largest[0]} ${(largest[1] / MIB).toFixed(2)} MiB.`,
);
