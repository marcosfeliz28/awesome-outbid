import { test, expect } from "./apoyo";
// Ronda 9 · Windows: el celular de la tienda abre la PWA por la red local con
// http://<ip de la computadora>:4173. Esa página no es «segura» para el
// navegador, y en ella no existe crypto.randomUUID: abrir caja, vender y
// registrar mercancía fallaban con «crypto.randomUUID is not a function».
// Nadie lo veía porque las pruebas abren siempre localhost, que sí cuenta como
// seguro. Esta prueba entra como el celular, por la dirección de red de esta
// computadora, y abre la caja.
test.beforeEach(async ({ request }) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
  });
  const { accessToken, user } = await login.json();
  const headers = { Authorization: "Bearer " + accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E celular http", secret: "e2e-celular-" + id },
  });
  expect(registered.ok()).toBe(true);
  const sessions = await (
    await request.get("/api/cash-sessions", { headers })
  ).json();
  for (const s of sessions.filter(
    (s: any) => s.userId === user.id && !s.closedAt,
  )) {
    const response = await request.post(
      "/api/cash-sessions/" + s.id + "/close",
      {
        headers,
        data: {
          countedCash: Math.max(0, s.expected.cash),
          countedCard: Math.max(0, s.expected.card),
          countedTransfer: Math.max(0, s.expected.transfer),
          notes: "Cierre entre escenarios E2E",
        },
      },
    );
    expect(response.ok()).toBe(true);
  }
});

// La primera dirección IPv4 de la computadora que no sea la de loopback: la
// misma que escribiría el celular. El intermediario de apoyo.ts escucha en
// 127.0.0.1, así que la prueba va directo a la PWA con FITSTORE_WEB_URL (o el
// preview de 4173) y se presenta con su propia dirección de cliente.
async function direccionDeRed() {
  const { networkInterfaces } = await import("node:os");
  for (const nics of Object.values(networkInterfaces()))
    for (const nic of nics ?? [])
      if (nic.family === "IPv4" && !nic.internal) return nic.address;
  return null;
}

test("desde un celular por http (dirección de red, sin https) se abre la caja", async ({
  browser,
}) => {
  const ip = await direccionDeRed();
  test.skip(!ip, "Esta computadora no tiene una dirección de red.");
  const base = new URL(process.env.FITSTORE_WEB_URL || "http://127.0.0.1:4173");
  base.hostname = ip!;
  const context = await browser.newContext({
    baseURL: base.toString(),
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    extraHTTPHeaders: {
      "X-Forwarded-For": `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`,
    },
  });
  const page = await context.newPage();
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/");
  // La condición que reproduce el celular: la página NO es segura.
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);

  await page.getByLabel("Correo electrónico").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();

  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Caja", exact: true })
    .click();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page.getByLabel("Efectivo inicial").fill("4000");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();

  await expect(page.getByText(/randomUUID/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Abrir caja", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Caja abierta")).toBeVisible();
  expect(errores.filter((e) => /randomUUID/.test(e))).toEqual([]);
  await context.close();
});
