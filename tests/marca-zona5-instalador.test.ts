// Zona 5 del cambio de nombre: lo que ve la persona en su PC (accesos directos, carpeta del menú
// Inicio, sección y archivo del instalador). Excepciones que se conservan a propósito:
// - nombres que el desinstalador borra para instalaciones viejas («Nexora POS.lnk», carpeta «Nexora POS»)
// - nombre de producto interno (PRODUCT_NAME), carpetas de ProgramData y Program Files
// - usuario de cuenta «Administrador Nexora» (renombrarlo rompe reanudaciones)
// Solo lee texto; no ejecuta PowerShell.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const EXCEPCIONES = [
  /PRODUCT_NAME/,
  /Remove-Item/,
  /legado|anterior|instalaciones viejas|\$nexoraPrograms/,
  /ProgramData/,
  /PROGRAMFILES/,
  /OwnerName=/,
];
const ARCHIVOS = [
  "instalador/installer/FitStore.nsi",
  "instalador/scripts/Install-FitStore.ps1",
  "instalador/scripts/Uninstall-FitStore.ps1",
  "instalador/build.ps1",
];

it("accesos, sección y archivo del instalador usan Norexos", () => {
  const sobrantes: string[] = [];
  for (const ruta of ARCHIVOS) {
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (!/\bNexora\b|\bNEXORA\b|Nexora POS/.test(linea)) return;
        if (EXCEPCIONES.some((e) => e.test(linea))) return;
        sobrantes.push(`${ruta}:${i + 1}: ${linea.trim().slice(0, 80)}`);
      });
  }
  expect(sobrantes).toEqual([]);
});
