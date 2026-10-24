import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const replacements = [
  [/FitStore POS/g, "Nexora POS Local"],
  [/Nexora POS(?! Local)/g, "Nexora POS Local"],
  [/Certificado FitStore/g, "Certificado Nexora Local"],
  [/FitStore - acceso/g, "Nexora Local - acceso"],
  [/FitStorePOS/g, "NexoraPOSLocal"],
  [/FitStorePostgreSQL/g, "NexoraLocalPostgreSQL"],
  [/FitStoreAPI/g, "NexoraLocalAPI"],
  [/FitStoreWeb/g, "NexoraLocalWeb"],
  [/FitStore_/g, "NexoraLocal_"],
  [/FitStore-/g, "NexoraLocal-"],
  [/fitstore/g, "nexoralocal"],
  [/(?<!\d)5434(?!\d)/g, "5544"],
  [/(?<!\d)3001(?!\d)/g, "4301"],
  [/(?<!\d)4173(?!\d)/g, "4473"],
];

function transform(content) {
  return replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), content)
    .replaceAll('!define PRODUCT_NAME "Nexora POS"', '!define PRODUCT_NAME "Nexora POS Local"')
    .replaceAll("Nexora-POS-Setup-", "Nexora-POS-Local-Setup-");
}

function profileFile(source, target) {
  mkdirSync(join(target, ".."), { recursive: true });
  let content = readFileSync(source, "utf8");
  if (basename(source) === "Install-FitStore.ps1") {
    content = content.replace(
      '  Remove-Item -LiteralPath (Join-Path $desktop "FitStore POS.lnk") -Force -ErrorAction SilentlyContinue',
      '  # El producto local conserva los accesos de otras instalaciones.',
    );
  }
  writeFileSync(target, transform(content), "utf8");
}

export function applyProductLocalProfile({ source, target, nsi, nsiOut = join(target, "FitStore.nsi") }) {
  for (const [directory, extension] of [["scripts", ".ps1"], ["service", ".template"], ["runtime", ".mjs"], ["tests", ".ps1"]]) {
    const from = join(source, directory);
    if (!existsSync(from)) throw new Error(`Falta ${from}`);
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
      if (directory === "tests" && entry.name !== "Windows-Smoke.ps1") continue;
      const outputName = directory === "service" ? entry.name.replaceAll("FitStoreAPI", "NexoraLocalAPI").replaceAll("FitStoreWeb", "NexoraLocalWeb") : entry.name;
      profileFile(join(from, entry.name), join(target, directory, outputName));
      if (source === target && outputName !== entry.name) unlinkSync(join(target, directory, entry.name));
    }
  }
  const icon = join(source, "assets", "fitstore.ico");
  if (!existsSync(icon)) throw new Error(`Falta ${icon}`);
  mkdirSync(join(target, "assets"), { recursive: true });
  copyFileSync(icon, join(target, "assets", "nexoralocal.ico"));
  profileFile(nsi, nsiOut);
  const script = readFileSync(nsiOut, "utf8");
  if (script.includes("FitStore POS") || script.includes("FitStorePOS")) {
    throw new Error(`La identidad anterior permanece en ${basename(nsiOut)}`);
  }
  return nsiOut;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, target, nsi, nsiOut] = process.argv.slice(2);
  if (!source || !target || !nsi || !nsiOut) throw new Error("Uso: product-local-profile.mjs origen destino nsi nsiSalida");
  applyProductLocalProfile({ source, target, nsi, nsiOut });
}
