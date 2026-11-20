// Zona 3 del cambio de nombre: textos que ve la persona al instalar (ventanas, mensajes,
// descripciones, README). Excepciones que no se renombran por seguridad de instalaciones
// existentes: nombre de producto, sección, accesos directos, carpetas, archivo de salida y
// rutas de ProgramData. Solo lee texto; no ejecuta PowerShell.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const VISIBLE =
  /MessageBox|BrandingText|VIAddVersionKey|MUI_FINISHPAGE|\.Description =|^#/;
const EXCEPCIONES = [
  /PRODUCT_NAME/,
  /Section "Nexora POS"/,
  /\.lnk/,
  /OutFile/,
  /ProgramData/,
  /Program Files/,
];
const ARCHIVOS = [
  "instalador/README.md",
  "instalador/installer/FitStore.nsi",
  "instalador/scripts/Install-FitStore.ps1",
];

it("el instalador muestra Norexos en lo que ve la persona", () => {
  const sobrantes: string[] = [];
  for (const ruta of ARCHIVOS) {
    readFileSync(ruta, "utf8")
      .split("\n")
      .forEach((linea, i) => {
        if (!/\bNexora\b|\bNEXORA\b/.test(linea)) return;
        if (!VISIBLE.test(linea)) return;
        if (EXCEPCIONES.some((e) => e.test(linea))) return;
        sobrantes.push(`${ruta}:${i + 1}`);
      });
  }
  expect(sobrantes).toEqual([]);
});

it("CI publica el mismo nombre que produce el instalador", () => {
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8");
  const build = readFileSync("instalador/build.ps1", "utf8");
  const nsis = readFileSync("instalador/installer/FitStore.nsi", "utf8");

  expect(build).toContain('"Norexos-Setup-$version.exe"');
  expect(nsis).toContain("Norexos-Setup-${VERSION}.exe");
  expect(workflow).toContain('$name = "Norexos-Setup-$version.exe"');
  expect(workflow).toContain(
    "name: Norexos-Setup-${{ steps.exe.outputs.version }}",
  );
  expect(workflow).not.toContain("Nexora-POS-Setup-");
});
