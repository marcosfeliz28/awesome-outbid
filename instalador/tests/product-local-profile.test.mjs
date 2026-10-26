import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyProductLocalProfile } from "../tools/product-local-profile.mjs";

test("perfil local separa identidad, datos y puertos de la tienda", () => {
  const root = mkdtempSync(join(tmpdir(), "nexora-local-"));
  try {
    const source = join(import.meta.dirname, "..");
    const nsi = join(import.meta.dirname, "..", "installer", "FitStore.nsi");
    applyProductLocalProfile({ source, target: root, nsi });
    const common = readFileSync(
      join(root, "scripts", "FitStore.Common.ps1"),
      "utf8",
    );
    const installer = readFileSync(join(root, "FitStore.nsi"), "utf8");
    assert.match(common, /Nexora POS Local/);
    assert.match(common, /NexoraLocalPostgreSQL/);
    assert.match(common, /5544/);
    assert.match(common, /nexoralocal/);
    assert.match(common, /licenseAcl\.SetAccessRule/);
    assert.doesNotMatch(common, /FitStore POS|FitStorePostgreSQL|5434/);
    assert.match(installer, /Nexora-POS-Local-Setup/);
    assert.equal(
      installer.charCodeAt(0),
      0xfeff,
      "el NSIS local debe conservar BOM UTF-8",
    );
    assert.match(installer, /La contraseña debe tener de 4 a 20 caracteres/);
    assert.match(installer, /\$0 < 4/);
    assert.match(installer, /\$0 > 20/);
    assert.match(installer, /NexoraPOSLocal/);
    assert.doesNotMatch(installer, /FitStorePOS|FitStore POS/);
    assert.match(installer, /\$PROGRAMFILES64\\Nexora POS Local/);
    assert.doesNotMatch(installer, /\$PROGRAMFILES64\\FitStore POS/);
    assert.match(
      installer,
      /Function \.onInit\s+\$\{If\} \$INSTDIR != "\$PROGRAMFILES64\\Nexora POS Local"/,
    );
    assert.match(installer, /SetErrorLevel 4\s+Abort\s+\$\{EndIf\}/);
    assert.match(installer, /proteger la instalación de la tienda/);
    assert.match(
      installer,
      /MessageBox MB_ICONSTOP[^\n]+proteger la instalación de la tienda\." \/SD IDOK/,
      "el rechazo de /D= debe cerrarse solo en una instalación /S",
    );
    const service = readFileSync(
      join(root, "service", "NexoraLocalAPI.xml.template"),
      "utf8",
    );
    assert.match(service, /<id>NexoraLocalAPI<\/id>/);
    assert.match(service, /<depend>NexoraLocalPostgreSQL<\/depend>/);
    const install = readFileSync(
      join(root, "scripts", "Install-FitStore.ps1"),
      "utf8",
    );
    assert.match(install, /CREATE DATABASE nexoralocal OWNER nexoralocal/);
    assert.match(install, /PRODUCT_LOCAL_LICENSE=required/);
    assert.match(install, /installationId.*NewGuid/);
    assert.match(install, /PRODUCT_LOCAL_LICENSE_DIR=/);
    assert.match(install, /-TemplateName "NexoraLocalAPI"/);
    assert.match(install, /-TemplateName "NexoraLocalWeb"/);
    assert.doesNotMatch(install, /FitStoreAPI|FitStoreWeb/);
    assert.match(install, /postgre[sS]qlPort = 5544/);
    assert.match(install, /Nexora POS Local\.lnk/);
    assert.match(install, /OwnerPassword\)\.Length -lt 4/);
    assert.match(install, /OwnerPassword\)\.Length -gt 20/);
    assert.match(install, /NEXORA_LOCAL_INSTALL = \$env:NEXORA_LOCAL_INSTALL/);
    assert.match(install, /\$env:NEXORA_LOCAL_INSTALL = "1"/);
    assert.match(
      install,
      /GRANT nexora_tenant_runtime TO nexoralocal WITH ADMIN OPTION/,
    );
    assert.doesNotMatch(install, /CREATEROLE[^\r\n]*nexoralocal/);
    assert.doesNotMatch(install, /"Nexora POS\.lnk"/);
    assert.doesNotMatch(install, /Remove-Item[^\n]+Nexora POS Local\.lnk/);
    const uninstall = readFileSync(
      join(root, "scripts", "Uninstall-FitStore.ps1"),
      "utf8",
    );
    assert.match(uninstall, /ProgramData\\Nexora POS Local/);
    assert.doesNotMatch(uninstall, /"Nexora POS\.lnk"/);
    const smoke = readFileSync(
      join(root, "tests", "Windows-Smoke.ps1"),
      "utf8",
    );
    assert.doesNotMatch(
      smoke,
      /FitStore POS|FitStoreAPI|FitStoreWeb|4173|3001|5434/,
    );
    assert.equal(
      readFileSync(
        join(source, "scripts", "FitStore.Common.ps1"),
        "utf8",
      ).includes("NexoraLocalPostgreSQL"),
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("el perfil se aplica al payload en sitio antes del manifiesto", () => {
  const root = mkdtempSync(join(tmpdir(), "nexora-payload-"));
  try {
    const source = join(import.meta.dirname, "..");
    for (const directory of [
      "scripts",
      "service",
      "runtime",
      "assets",
      "tests",
    ]) {
      cpSync(join(source, directory), join(root, directory), {
        recursive: true,
      });
    }
    applyProductLocalProfile({
      source: root,
      target: root,
      nsi: join(source, "installer", "FitStore.nsi"),
    });
    assert.equal(
      existsSync(join(root, "service", "FitStoreAPI.xml.template")),
      false,
    );
    assert.equal(
      existsSync(join(root, "service", "NexoraLocalAPI.xml.template")),
      true,
    );
    assert.equal(existsSync(join(root, "assets", "nexoralocal.ico")), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("el constructor exige clave pública real y activa licencia en la web local", () => {
  const build = readFileSync(
    join(import.meta.dirname, "..", "build.ps1"),
    "utf8",
  );
  assert.match(build, /VITE_PRODUCT_LOCAL_LICENSE = "required"/);
  assert.match(build, /NEXORA_LICENSE_PUBLIC_KEY/);
  assert.match(build, /asymmetricKeyType!=='ed25519'/);
});
