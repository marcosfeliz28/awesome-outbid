// Apoyo común de las pruebas E2E: de aquí sale `test` (no de "@playwright/test"),
// para que la suite se pueda repetir sobre la misma base y no ensucie el repositorio.
import { test as base, expect } from "@playwright/test";
import { dirname, join, normalize } from "node:path";

export { expect };
export const test = base;

// --- Capturas de pantalla -------------------------------------------------
// Las capturas de docs/ están en el repositorio. Una corrida normal las deja en
// la carpeta de resultados de Playwright (ignorada por git y vaciada al empezar
// cada corrida); sólo con FITSTORE_ACTUALIZAR_CAPTURAS=1 se escriben en docs/,
// para refrescar la documentación a propósito.
export const SCREENSHOTS_ENV = "FITSTORE_ACTUALIZAR_CAPTURAS";
export function screenshotTarget(
  path: string,
  {
    root,
    outputDir,
    update,
  }: { root: string; outputDir: string; update: boolean },
) {
  const clean = normalize(path).replaceAll("\\", "/");
  if (!clean.startsWith("docs/"))
    throw new Error("La captura debe ir dentro de docs/: " + path);
  return update ? join(root, clean) : join(outputDir, "capturas", clean);
}
/** Para `page.screenshot({ path: screenshotPath("docs/….png") })`. */
export function screenshotPath(path: string) {
  const info = base.info();
  return screenshotTarget(path, {
    root: info.config.configFile
      ? dirname(info.config.configFile)
      : process.cwd(),
    outputDir: info.project.outputDir,
    update: process.env[SCREENSHOTS_ENV] === "1",
  });
}
