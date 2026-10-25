// CPC-9: el instalador final nunca lleva la clave pública de pruebas del CI;
// con ella aceptaría licencias firmadas por cualquiera que tenga su privada.
// Uso: node license-key-guard.mjs <clave.pem>. Fuera del CI (CI=true) la rechaza.
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CI_LICENSE_KEY = "MCowBQYDK2VwAyEA2c54TsrWgQdX58TVC3FOxHEEmoX3LZhHw9IghUUWhzw=";

export function rejectsTestKey(pem, env = process.env) {
  return pem.replace(/\s+/g, "").includes(CI_LICENSE_KEY) && env.CI !== "true";
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  if (rejectsTestKey(readFileSync(process.argv[2], "utf8"))) {
    console.error("La clave pública es la de pruebas del CI; no se puede usar en un instalador final.");
    process.exit(1);
  }
}
