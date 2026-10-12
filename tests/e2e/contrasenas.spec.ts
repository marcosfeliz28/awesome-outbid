// Contraseñas desde la pantalla: «Cambiar mi contraseña» (cualquier usuario,
// menú de la cuenta) y «Restablecer contraseña» (administración, Configuración
// → Usuarios y permisos), en celular (390 px) y en computadora (1280 px).
import type { APIRequestContext, Locator, Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const ADMIN = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
// Credenciales aisladas de prueba; claves de cajero de seis dígitos y no triviales.
const CASHIER_TEMPORARY = "583941";
const CASHIER_ACTIVE = "729405";
const CASHIER_CHOSEN = "846217";
const STRONG_TEMPORARY = "Temporal-E2E-Clave-2026!";
const STRONG_ACTIVE = "Activa-E2E-Clave-2026!";
const STRONG_CHOSEN = "Elegida-E2E-Clave-2026#";

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
/** Cajera nueva que ya hizo su cambio obligatorio con seis dígitos. */
async function cashier(request: APIRequestContext, label: string) {
  const api = await adminApi(request);
  const roles = await api("/roles");
  const tag = label + "-" + crypto.randomUUID().slice(0, 8);
  const user = await api("/users", {
    name: "E2E Clave " + tag,
    username: "e2e-clave-" + tag,
    password: CASHIER_TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const changed = await request.post("/api/auth/change-password", {
    data: {
      login: user.username,
      currentPassword: CASHIER_TEMPORARY,
      newPassword: CASHIER_ACTIVE,
      confirmPassword: CASHIER_ACTIVE,
    },
  });
  expect(changed.ok(), "cambio obligatorio inicial").toBe(true);
  return user as { id: string; name: string; username: string };
}
/** Gerente de prueba que conserva la política fuerte de contraseña. */
async function manager(request: APIRequestContext, label: string) {
  const api = await adminApi(request);
  const roles = await api("/roles");
  const tag = label + "-gerente-" + crypto.randomUUID().slice(0, 8);
  const user = await api("/users", {
    name: "E2E Gerente " + tag,
    username: "e2e-gerente-" + tag,
    password: STRONG_TEMPORARY,
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "manager").id,
  });
  const changed = await request.post("/api/auth/change-password", {
    data: {
      login: user.username,
      currentPassword: STRONG_TEMPORARY,
      newPassword: STRONG_ACTIVE,
      confirmPassword: STRONG_ACTIVE,
    },
  });
  expect(changed.ok(), "cambio obligatorio de gerente").toBe(true);
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
/** Cada referencia de ayuda del campo debe apuntar a contenido real. */
async function accessibleDescriptions(page: Page, field: Locator) {
  const ids = (await field.getAttribute("aria-describedby"))
    ?.split(/\s+/)
    .filter(Boolean);
  expect(ids?.length).toBeGreaterThan(0);
  for (const id of ids ?? [])
    await expect(page.locator(`#${id}`)).toHaveCount(1);
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

    test("Crear usuario: la clave temporal de una cajera son seis números", async ({
      page,
      request,
    }) => {
      const api = await adminApi(request);
      const roles = await api("/roles");
      const sellerRole = roles.find((role: any) => role.name === "seller");
      expect(sellerRole).toBeTruthy();
      const tag = crypto.randomUUID().slice(0, 10);
      const username = "e2e-alta-cajera-" + tag;

      await signIn(page, ADMIN.email, ADMIN.password);
      if (screen.mobile)
        await page.getByRole("button", { name: "Abrir menú" }).click();
      await page.getByRole("button", { name: "Configuración" }).click();
      await page.getByRole("button", { name: "Usuarios y permisos" }).click();
      await page.getByRole("button", { name: "Crear usuario" }).click();
      const dialog = page.getByRole("dialog", { name: "Crear usuario" });
      await dialog.getByLabel("Rol").selectOption(sellerRole.id);
      const temporary = dialog.getByLabel(/Contraseña temporal \(6 números\)/);
      await expect(temporary).toHaveAttribute("inputmode", "numeric");
      await expect(temporary).toHaveAttribute("maxlength", "6");
      await expect(temporary).toHaveAttribute("pattern", "[0-9]{6}");
      await temporary.fill(CASHIER_TEMPORARY);
      await dialog.getByLabel("Nombre").fill("QA alta de cajera " + tag);
      await dialog.getByLabel("Usuario para entrar").fill(username);
      await dialog.getByLabel("PIN de 6 dígitos").fill("246813");
      const created = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/users") && response.status() === 201,
      );
      await dialog.getByRole("button", { name: "Guardar" }).click();
      const response = await created;
      const user = await response.json();
      const login = await apiLogin(request, username, CASHIER_TEMPORARY);
      expect(login.status).toBe(201);
      expect(login.body).toMatchObject({ requiresPasswordChange: true });
      expect(user.username).toBe(username);
    });

    test("Cambiar mi contraseña: pide la actual, aplica las reglas y mantiene la sesión", async ({
      page,
      request,
    }) => {
      const user = await cashier(request, screen.name);
      await signIn(page, user.username, CASHIER_ACTIVE);
      await page.locator("button.account").click();
      await page.getByRole("button", { name: "Cambiar mi contraseña" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Cambiar mi contraseña",
      });
      await expect(dialog).toBeVisible();
      await expect(dialog).not.toContainText("obligatorio");
      const newPassword = dialog.getByLabel("Nueva contraseña", {
        exact: true,
      });
      const confirmation = dialog.getByLabel("Confirma la nueva contraseña");
      await expect(newPassword).toHaveAttribute("inputmode", "numeric");
      await expect(newPassword).toHaveAttribute("maxlength", "6");
      await expect(confirmation).toHaveAttribute("inputmode", "numeric");
      await expect(confirmation).toHaveAttribute("maxlength", "6");
      await accessibleDescriptions(page, newPassword);
      // Contraseña actual equivocada: el servidor la rechaza y nada cambia.
      await dialog.getByLabel("Contraseña actual").fill("No-Es-La-Mia-2026!");
      await newPassword.fill(CASHIER_CHOSEN);
      await confirmation.fill(CASHIER_CHOSEN);
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(
        /La contraseña actual no es correcta/,
      );
      // Cinco dígitos y letras se rechazan por la validación HTML nativa;
      // una secuencia válida en formato llega al servidor y se rechaza allí.
      const currentPassword = dialog.getByLabel("Contraseña actual");
      await currentPassword.fill(CASHIER_ACTIVE);
      await newPassword.fill("58394");
      await confirmation.fill("58394");
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect
        .poll(() =>
          newPassword.evaluate(
            (input: HTMLInputElement) => input.validity.tooShort,
          ),
        )
        .toBe(true);

      await newPassword.fill("abcdef");
      await confirmation.fill("abcdef");
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect
        .poll(() =>
          newPassword.evaluate(
            (input: HTMLInputElement) => input.validity.patternMismatch,
          ),
        )
        .toBe(true);

      await newPassword.fill("123456");
      await confirmation.fill("123456");
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await expect(dialog.getByRole("alert")).toHaveText(
        /6 números|seis números|fácil|trivial|común|secuencia|repetidos/i,
      );
      // Los rechazos no cambian la credencial vigente.
      expect(
        (await apiLogin(request, user.username, CASHIER_ACTIVE)).status,
      ).toBe(201);
      await newPassword.fill(CASHIER_CHOSEN);
      await confirmation.fill(CASHIER_CHOSEN);
      if (screen.mobile) await fitsWidth(page);
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
      expect(
        (await apiLogin(request, user.username, CASHIER_ACTIVE)).status,
      ).toBe(400);
      expect(
        (await apiLogin(request, user.username, CASHIER_CHOSEN)).status,
      ).toBe(201);
    });

    test("Restablecer contraseña: la administración da una temporal y la cajera elige la suya al entrar", async ({
      page,
      browser,
      request,
    }) => {
      const user = await cashier(request, screen.name);
      // La cajera tenía una sesión abierta en su caja.
      const before = await apiLogin(request, user.username, CASHIER_ACTIVE);
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
      // La temporal es de otra persona: el navegador no ofrece guardarla.
      await expect(dialog.getByLabel("Contraseña temporal")).toHaveAttribute(
        "autocomplete",
        "off",
      );
      const temporaryField = dialog.getByLabel("Contraseña temporal");
      await expect(temporaryField).toHaveAttribute("inputmode", "numeric");
      await expect(temporaryField).toHaveAttribute("maxlength", "6");
      let temporary = CASHIER_TEMPORARY;
      if (screen.mobile) {
        await temporaryField.fill(CASHIER_TEMPORARY);
      }
      await dialog
        .getByRole("button", { name: "Restablecer contraseña" })
        .click();
      // El foco pasa al resultado, que se anuncia como estado.
      const summary = dialog.getByRole("status");
      await expect(summary).toBeFocused();
      await expect(summary).toContainText("deberá crear su propia contraseña");
      if (screen.mobile) {
        await expect(dialog).toContainText("deberá crear su propia contraseña");
        await expect(dialog).not.toContainText(CASHIER_TEMPORARY);
        await fitsWidth(page);
      } else {
        // Generada por el sistema: se muestra una sola vez.
        const shown = dialog.getByTestId("temporary-password");
        await expect(shown).toBeVisible();
        await expect(summary).toContainText("no se volverá a mostrar");
        temporary = (await shown.textContent())!.trim();
        expect(temporary).toMatch(/^\d{6}$/);
        expect(temporary).not.toMatch(
          /^(000000|111111|123456|123123|654321|999999)$/,
        );
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
      const requiredPassword = cashierPage.getByLabel("Nueva contraseña", {
        exact: true,
      });
      const requiredConfirmation = cashierPage.getByLabel(
        "Confirma la nueva contraseña",
      );
      await expect(requiredPassword).toHaveAttribute("inputmode", "numeric");
      await expect(requiredPassword).toHaveAttribute("maxlength", "6");
      await expect(requiredConfirmation).toHaveAttribute(
        "inputmode",
        "numeric",
      );
      await expect(requiredConfirmation).toHaveAttribute("maxlength", "6");
      await accessibleDescriptions(cashierPage, requiredPassword);
      await requiredPassword.fill("58394");
      await requiredConfirmation.fill("58394");
      await cashierPage
        .getByRole("button", { name: "Guardar contraseña y entrar" })
        .click();
      // La validación nativa de minlength/pattern detiene el formulario antes
      // de que el servidor o el mensaje de error personalizado puedan actuar.
      await expect
        .poll(() =>
          requiredPassword.evaluate(
            (input: HTMLInputElement) => input.validity.tooShort,
          ),
        )
        .toBe(true);
      await requiredPassword.fill(CASHIER_CHOSEN);
      await requiredConfirmation.fill(CASHIER_CHOSEN);
      await cashierPage
        .getByRole("button", { name: "Guardar contraseña y entrar" })
        .click();
      await expect(cashierPage.locator("button.account")).toBeVisible();
      expect(
        (await apiLogin(request, user.username, CASHIER_CHOSEN)).status,
      ).toBe(201);
      await context.close();
    });

    test("gerente conserva la contraseña fuerte en cambio voluntario", async ({
      page,
      request,
    }) => {
      const user = await manager(request, screen.name);
      await signIn(page, user.username, STRONG_ACTIVE);
      await page.locator("button.account").click();
      await page.getByRole("button", { name: "Cambiar mi contraseña" }).click();
      const dialog = page.getByRole("dialog", {
        name: "Cambiar mi contraseña",
      });
      await expect(dialog).toBeVisible();
      const newPassword = dialog.getByLabel("Nueva contraseña", {
        exact: true,
      });
      const confirmation = dialog.getByLabel("Confirma la nueva contraseña");
      await expect(newPassword).toHaveAttribute("inputmode", "text");
      await expect(newPassword).toHaveAttribute("maxlength", "128");
      await accessibleDescriptions(page, newPassword);
      for (const rule of ["Mayúscula", "Minúscula", "Número", "Símbolo"])
        await expect(dialog).toContainText(rule);

      // Un PIN numérico no basta para el rol de gerente.
      await dialog.getByLabel("Contraseña actual").fill(STRONG_ACTIVE);
      await newPassword.fill(CASHIER_CHOSEN);
      await confirmation.fill(CASHIER_CHOSEN);
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      // El navegador bloquea el envío por minlength; el estado de reglas
      // visible también debe mostrar la contraseña débil como no válida.
      await expect
        .poll(() =>
          newPassword.evaluate(
            (input: HTMLInputElement) => input.validity.tooShort,
          ),
        )
        .toBe(true);
      expect(
        (await apiLogin(request, user.username, STRONG_ACTIVE)).status,
      ).toBe(201);

      await newPassword.fill(STRONG_CHOSEN);
      await confirmation.fill(STRONG_CHOSEN);
      const saved = page.waitForResponse(
        (r) => r.url().endsWith("/api/auth/password") && r.status() === 201,
      );
      await dialog.getByRole("button", { name: "Guardar contraseña" }).click();
      await saved;
      expect(
        (await apiLogin(request, user.username, STRONG_ACTIVE)).status,
      ).toBe(400);
      expect(
        (await apiLogin(request, user.username, STRONG_CHOSEN)).status,
      ).toBe(201);
    });
  });
}
