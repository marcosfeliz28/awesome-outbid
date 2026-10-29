// Zona 6 (cierre del barrido): textos visibles de la app de escritorio, empresa por defecto de las
// semillas, panel del operador. Se conservan a propósito: productName e identifier de Tauri,
// realm de autenticación del panel y el nombre de carpeta de Drive.
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

it("los textos visibles de cierre usan Norexos", () => {
  expect(
    JSON.parse(readFileSync("apps/web/src-tauri/tauri.conf.json", "utf8")).app
      .windows[0].title,
  ).toBe("Norexos");
  expect(readFileSync("apps/web/src-tauri/src/thermal.rs", "utf8")).toMatch(
    /wide\("Norexos"\)/,
  );
  expect(readFileSync("apps/api/prisma/seed.ts", "utf8")).toMatch(
    /name: "Norexos"/,
  );
  expect(readFileSync("apps/api/scripts/create-admin.ts", "utf8")).toMatch(
    /name: "Norexos"/,
  );
  expect(
    readFileSync("apps/api/scripts/platform-billing-panel.ts", "utf8"),
  ).toMatch(/<h1>Conciliación de planes Norexos<\/h1>/);
  expect(
    readFileSync("apps/api/scripts/platform-billing-panel.ts", "utf8"),
  ).toMatch(/realm="Nexora plataforma"/);
});
