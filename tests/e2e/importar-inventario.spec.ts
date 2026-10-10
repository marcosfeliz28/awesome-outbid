// Pantalla «Importar inventario» (sólo administración): archivo → vista previa
// en español → confirmación explícita → carga. Accesible y usable a 320 px.
// Con NEXORA_AXE_SCRIPT=/ruta/axe.min.js además corre axe-core y exige 0
// violaciones.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const ExcelJS = createRequire(
  join(process.cwd(), "apps", "api", "package.json"),
)("exceljs");
const AXE_SCRIPT = process.env.NEXORA_AXE_SCRIPT;
const HEADER = [
  "ID",
  "DESCRIPCION",
  "REFERENCIA",
  "SUB-GRUPO DE ARTICULO",
  "EXISTENCIA",
  "COSTO",
  "PRECIO DETALLE",
];
async function xlsx(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventario");
  ws.addRow(HEADER);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function login(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function axe(page: Page) {
  if (!AXE_SCRIPT) return;
  await page.evaluate(readFileSync(AXE_SCRIPT, "utf8"));
  const violations = await page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations.map((v: any) => v.id + ": " + v.nodes.length);
  });
  expect(violations).toEqual([]);
}
async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("Importar inventario", () => {
  const suffix = Date.now().toString(36).toUpperCase();
  test("la administración revisa, confirma y carga", async ({ page }) => {
    await login(page, "admin@fitstore.demo");
    await page.evaluate(() => (location.hash = "products"));
    await page.getByRole("button", { name: "Importar inventario" }).click();
    const dialog = page.getByRole("dialog", { name: "Importar inventario" });
    await expect(dialog).toBeVisible();
    await axe(page);
    const rows = [
      [
        `E2E${suffix}-1`,
        "Producto E2E uno",
        "",
        "E2E Importar " + suffix,
        5,
        100,
        250,
      ],
      [
        `E2E${suffix}-2`,
        "Producto E2E dos",
        "",
        "E2E Importar " + suffix,
        0,
        0,
        0,
      ],
    ];
    await dialog.getByLabel(/Archivo de Excel/).setInputFiles({
      name: "inventario.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await xlsx(rows),
    });
    await expect(
      dialog.getByRole("heading", { name: /Esto es lo que pasará/ }),
    ).toBeVisible();
    await expect(dialog.getByText("Productos nuevos")).toBeVisible();
    await expect(
      dialog.getByText(
        new RegExp("Se crearán estas categorías: E2E Importar " + suffix),
      ),
    ).toBeVisible();
    // Sin confirmación explícita no se puede cargar.
    const load = dialog.getByRole("button", { name: "Cargar inventario" });
    await expect(load).toBeDisabled();
    await axe(page);
    await dialog.getByLabel(/Revisé la vista previa/).check();
    await expect(load).toBeEnabled();
    await load.click();
    await expect(
      dialog.getByRole("heading", { name: /el inventario quedó cargado/ }),
    ).toBeVisible();
    await expect(dialog.getByText("2 productos nuevos creados.")).toBeVisible();
    await axe(page);
  });

  test("un archivo con errores muestra la fila y no ofrece cargar; a 320 px no se desborda", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await login(page, "admin@fitstore.demo");
    await page.evaluate(() => (location.hash = "products"));
    await page.getByRole("button", { name: "Importar inventario" }).click();
    const dialog = page.getByRole("dialog", { name: "Importar inventario" });
    await dialog.getByLabel(/Archivo de Excel/).setInputFiles({
      name: "malo.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: await xlsx([
        [`E2E${suffix}-9`, "Bueno", "", "E2E Importar " + suffix, 1, 10, 20],
        [
          `E2E${suffix}-10`,
          "Malo",
          "",
          "E2E Importar " + suffix,
          "abc",
          10,
          20,
        ],
      ]),
    });
    await expect(
      dialog.getByRole("heading", { name: /Hay que corregir el archivo/ }),
    ).toBeVisible();
    await expect(dialog.getByText("Fila 3:")).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Cargar inventario" }),
    ).toHaveCount(0);
    await noHorizontalScroll(page);
    await axe(page);
  });

  test("la API responde 403 a una cajera y a un gerente", async ({
    request,
  }) => {
    const owner = await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    });
    const admin = {
      Authorization: "Bearer " + (await owner.json()).accessToken,
    };
    const roles = await (
      await request.get("/api/roles", { headers: admin })
    ).json();
    for (const role of ["seller", "manager"]) {
      const email = `e2e-imp-${role}-${suffix.toLowerCase()}@example.test`;
      const created = await request.post("/api/users", {
        headers: admin,
        data: {
          name: "E2E " + role,
          email,
          password: "FitStore-QA-2026!",
          pin: "876543",
          roleId: roles.find((r: any) => r.name === role).id,
        },
      });
      expect(created.ok()).toBe(true);
      let auth = await (
        await request.post("/api/auth/login", {
          data: { email, password: "FitStore-QA-2026!" },
        })
      ).json();
      if (auth.requiresPasswordChange)
        auth = await (
          await request.post("/api/auth/change-password", {
            data: {
              login: email,
              currentPassword: "FitStore-QA-2026!",
              newPassword: "FitStore-QA-Nueva-2026!",
              confirmPassword: "FitStore-QA-Nueva-2026!",
            },
          })
        ).json();
      const denied = await request.post("/api/inventory-import/preview", {
        headers: { Authorization: "Bearer " + auth.accessToken },
        multipart: {
          file: {
            name: "x.xlsx",
            mimeType: "application/octet-stream",
            buffer: Buffer.from("x"),
          },
        },
      });
      expect(denied.status()).toBe(403);
    }
  });
});
