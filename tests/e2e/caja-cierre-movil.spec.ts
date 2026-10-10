// ChatGPT (capturas a 390 px): en el cierre de caja de la cajera los botones
// quedaban recortados y el texto prometía una «comparación» que la API no le
// entrega (cash.ts: sólo profit:read / sale:manage reciben esperado y
// diferencias). La pantalla debe decir lo que de verdad ocurre por rol.
import { test, expect } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };

async function cashier(request: any, context: any) {
  const auth = await (
    await request.post("/api/auth/login", { data: OWNER })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id0 = crypto.randomUUID();
  await request.post("/api/terminals/register", {
    headers,
    data: { id: id0, name: "E2E cierre", secret: "e2e-cierre-" + id0 },
  });
  const roles = await (await request.get("/api/roles", { headers })).json();
  const tag = Date.now().toString(36);
  const email = `e2e-cierre-${tag}@example.test`;
  const temporary = "FitStore-QA-2026!",
    password = "FitStore-QA-2026-Definitiva!";
  const created = await request.post("/api/users", {
    headers,
    data: {
      name: "E2E Cajera cierre " + tag,
      email,
      password: temporary,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === "seller").id,
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const changed = await request.post("/api/auth/change-password", {
    data: {
      login: email,
      currentPassword: temporary,
      newPassword: password,
      confirmPassword: password,
    },
  });
  expect(changed.ok()).toBe(true);
  const identity = {
    id: crypto.randomUUID(),
    name: "E2E cierre " + tag,
    secret: "e2e-cierre-secreto-" + crypto.randomUUID(),
  };
  const registered = await request.post("/api/terminals/register", {
    headers: { Authorization: "Bearer " + (await changed.json()).accessToken },
    data: identity,
  });
  if ((await registered.json()).status === "pending")
    await request.post("/api/terminals/" + identity.id + "/approve", {
      headers,
      data: {},
    });
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      "fitstore-equipment:" + auth.user.branchId,
      JSON.stringify(identity),
    ] as const,
  );
  return { email, password };
}

test("cierre de caja a 390 px: botones completos y texto que no promete la comparación a la cajera", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { email, password } = await cashier(request, context);
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await page.evaluate(() => (location.hash = "cash"));
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page.getByLabel("Efectivo inicial").fill("500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
  // La cajera no ve esperados ni diferencias, y la pantalla no los promete.
  await expect(
    page.locator(".panel", { hasText: "Arqueo ciego" }),
  ).toContainText(/ni al cerrar verás los montos esperados ni las diferencias/);
  await page.getByRole("button", { name: "Cerrar y arquear" }).click();
  const dialog = page.getByRole("dialog", { name: "Cuadre y cierre de caja" });
  await expect(dialog.locator(".close-expected")).toContainText(
    /la revisa administración/,
  );
  await expect(dialog.locator(".close-expected")).not.toContainText(
    /aparece después de cerrar/,
  );
  // Botones dentro de la ventana de 390 px, sin recorte horizontal.
  for (const name of [/Cancelar/, /Cerrar caja e imprimir cuadre/]) {
    const button = dialog.getByRole("button", { name });
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    expect(box.x, String(name)).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, String(name)).toBeLessThanOrEqual(390);
    const clipped = await button.evaluate(
      (el: HTMLElement) => el.scrollWidth > el.clientWidth + 1,
    );
    expect(clipped, String(name) + " con el texto recortado").toBe(false);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "sin desplazamiento horizontal",
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("cierre-caja-390.png"),
    fullPage: true,
  });
});
