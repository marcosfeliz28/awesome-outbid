// Contraseñas desde la pantalla: «Cambiar mi contraseña» (cualquier usuario,
// menú de la cuenta) y «Restablecer contraseña» (administración, Configuración
// → Usuarios y permisos), en celular (390 px) y en computadora (1280 px).
import type { APIRequestContext, Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const ADMIN = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const TEMPORARY = "Temporal-E2E-Clave-2026!";
const ACTIVE = "Activa-E2E-Clave-2026!";
const CHOSEN = "Elegida-E2E-Clave-2026#";

async function adminApi(request: APIRequestContext) {
  const login = await request.post("/api/auth/login", { data: ADMIN });
  expect(login.ok()).toBe(true);
  const headers = {
    Authorization: "Bearer " + (await login.json()).accessToken,
  };
  return async (path: string, data?: unknown) => {
    const r = data
      ? await request.post("/api" + path, { headers, data })
      : await request.get("/api" + path, { headers });
    expect(r.ok(), path + ": " + (await r.text())).toBe(true);
    return r.json();
  };
}
/** Cajera nueva que ya hizo su cambio obligatorio: entra con ACTIVE. */
async function cashier(request: APIRequestContext, label: string) {
  const api = await adminApi(request);
  const roles = await api("/roles");
  const tag = label + "-" + crypto.randomUUID().slice(0, 8);
  const user = await api("/users", {
    name: "E2E Clave " + tag,
    username: "e2e-clave-" + tag,
    password: TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const changed = await request.post("/api/auth/change-password", {
    data: {
      login: user.username,
      currentPassword: TEMPORARY,
      newPassword: ACTIVE,
      confirmPassword: ACTIVE,
    },
  });
  expect(changed.ok(), "cambio obligatorio inicial").toBe(true);
  return user as { id: string; name: string; username: string };
}
async function signIn(page: Page, login: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(login);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator("button.account")).toBeVisible();
}
const apiLogin = async (
  request: APIRequestContext,
  login: string,
  password: string,
) => {
  const r = await request.post("/api/auth/login", {
    data: { login, password },
  });
  return { status: r.status(), body: await r.json() };
};
/** Fila de la tabla de usuarios, recorriendo sus páginas desde la primera. */
async function findRow(page: Page, text: string) {
  // Sólo la tabla de «Equipo de tu tienda»: la pestaña «Negocio y reglas»
  // también lista cajeros y puede seguir en pantalla un instante.
  const panel = page.locator(".panel", {
    has: page.getByRole("heading", { name: "Equipo de tu tienda" }),
  });
  await expect(panel.locator("tbody tr").first()).toBeVisible();
  const previous = panel.getByRole("button", { name: "Anterior" });
  while ((await previous.count()) && (await previous.isEnabled()))
    await previous.click();
  const row = panel.locator("tbody tr", { hasText: text });
  const next = panel.getByRole("button", { name: "Siguiente" });
  // isVisible() no espera: sólo se pasa de página si hay otra; si no, la
  // aserción final espera a que la lista termine de cargar.
  for (
    let n = 0;
    n < 50 &&
    !(await row.isVisible()) &&
    (await next.count()) &&
    (await next.isEnabled());
    n++
  )
    await next.click();
  await expect(row).toBeVisible();
  return row;
}
/** Sin desplazamiento horizontal de la página (celular). */
async function fitsWidth(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: window.innerWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

for (const screen of [
  { name: "celular", viewport: { width: 390, height: 844 }, mobile: true },
  {
    name: "computadora",
    viewport: { width: 1280, height: 900 },
    mobile: false,
  },
]) {
  test.describe(`Contraseñas · ${screen.name} (${screen.viewport.width} px)`, () => {
    test.use({
      viewport: screen.viewport,
      isMobile: screen.mobile,
      hasTouch: screen.mobile,
    });

    test("Cambiar mi contraseña: pide la actual, aplica las reglas y mantiene la sesión", async ({
      page,
      request,
    }) => {
      const user = await cashier(request, screen.name);
      await signIn(page, user.username, ACTIVE);
      await page.locator("button.account").click();
      await page.getByRole("button", { name: "Cambiar mi contraseña" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Cambiar mi contraseña",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).not.toContainText("obligatorio");
      // Contraseña actual equivocada: el servidor la rechaza y nada cambia.
      await dialog.getByLabel("Contraseña actual").fill("No-Es-La-Mia-2026!");
      await dialog.getByLabel("Nueva contraseña", { exact: true }).fill(CHOSEN);
      await dialog.getByLabel("Confirma la nueva contraseña").fill(CHOSEN);
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(
        /La contraseña actual no es correcta/,
      );
      // Una clave débil (larga, pero sin mayúscula ni símbolo) no se envía.
      const weak = "solominusculas2026";
      await dialog.getByLabel("Contraseña actual").fill(ACTIVE);
      await dialog.getByLabel("Nueva contraseña", { exact: true }).fill(weak);
      await dialog.getByLabel("Confirma la nueva contraseña").fill(weak);
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(/cinco reglas/);
      if (screen.mobile) await fitsWidth(page);
      await dialog.getByLabel("Nueva contraseña", { exact: true }).fill(CHOSEN);
      await dialog.getByLabel("Confirma la nueva contraseña").fill(CHOSEN);
      const saved = page.waitForResponse(
        (r) => r.url().endsWith("/api/auth/password") && r.status() === 201,
      );
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await saved;
      await expect(dialog).toBeHidden();
      await expect(page.getByText("Tu contraseña se cambió.")).toBeVisible();
      // La sesión sigue abierta en este equipo, también al recargar.
      await page.reload();
      await expect(page.locator("button.account")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Entrar a mi tienda" }),
      ).toHaveCount(0);
      // La anterior ya no entra y la nueva sí.
      expect((await apiLogin(request, user.username, ACTIVE)).status).toBe(400);
      expect((await apiLogin(request, user.username, CHOSEN)).status).toBe(201);
    });

    test("Restablecer contraseña: la administración da una temporal y la cajera elige la suya al entrar", async ({
      page,
      browser,
      request,
    }) => {
      const user = await cashier(request, screen.name);
      // La cajera tenía una sesión abierta en su caja.
      const before = await apiLogin(request, user.username, ACTIVE);
      expect(before.status).toBe(201);
      await signIn(page, ADMIN.email, ADMIN.password);
      if (screen.mobile)
        await page.getByRole("button", { name: "Abrir menú" }).click();
      await page.getByRole("button", { name: "Configuración" }).click();
      await page.getByRole("button", { name: "Usuarios y permisos" }).click();
      // Su propia fila no ofrece restablecer: para ella es «Cambiar mi contraseña».
      const own = await findRow(page, "Valeria Rivera");
      await expect(
        own.getByRole("button", { name: "Restablecer contraseña" }),
      ).toHaveCount(0);
      await expect(own.getByRole("button", { name: "Editar" })).toBeVisible();
      const row = await findRow(page, user.name);
      await row.getByRole("button", { name: "Restablecer contraseña" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Restablecer contraseña · " + user.name,
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("cierra sus sesiones");
      let temporary = TEMPORARY;
      if (screen.mobile) {
        await dialog.getByLabel("Contraseña temporal").fill(TEMPORARY);
      }
      await dialog
        .getByRole("button", { name: "Restablecer contraseña" })
        .click();
      if (screen.mobile) {
        await expect(dialog).toContainText("deberá crear su propia contraseña");
        await expect(dialog).not.toContainText(TEMPORARY);
        await fitsWidth(page);
      } else {
        // Generada por el sistema: se muestra una sola vez.
        const shown = dialog.getByTestId("temporary-password");
        await expect(shown).toBeVisible();
        temporary = (await shown.textContent())!.trim();
        expect(temporary.length).toBeGreaterThanOrEqual(12);
      }
      await dialog.getByRole("button", { name: "Listo" }).click();
      await expect(dialog).toBeHidden();
      // Su sesión anterior se cerró.
      const me = await request.get("/api/auth/me", {
        headers: { Authorization: "Bearer " + before.body.accessToken },
      });
      expect(me.status()).toBe(401);
      // La cajera entra con la temporal y crea la suya.
      const context = await browser.newContext({
        viewport: screen.viewport,
        isMobile: screen.mobile,
        hasTouch: screen.mobile,
      });
      const cashierPage = await context.newPage();
      await cashierPage.goto(page.url().split("#")[0]);
      await cashierPage.getByLabel("Usuario").fill(user.username);
      await cashierPage
        .getByLabel("Contraseña", { exact: true })
        .fill(temporary);
      await cashierPage
        .getByRole("button", { name: "Entrar a mi tienda" })
        .click();
      await expect(
        cashierPage.getByRole("heading", { name: "Actualiza tu contraseña." }),
      ).toBeVisible();
      await cashierPage
        .getByLabel("Nueva contraseña", { exact: true })
        .fill(CHOSEN);
      await cashierPage.getByLabel("Confirma la nueva contraseña").fill(CHOSEN);
      await cashierPage
        .getByRole("button", { name: "Guardar contraseña y entrar" })
        .click();
      await expect(cashierPage.locator("button.account")).toBeVisible();
      await context.close();
    });
  });
}
