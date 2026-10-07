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

// La PWA se sirve a sí misma por una dirección de red de esta computadora,
// como la ve el celular: un intermediario escucha en esa dirección y reenvía a
// la vista previa (que puede estar sólo en 127.0.0.1). Si la computadora no
// tiene ninguna dirección de red, la prueba se omite.
async function servirPorLaRed(target: URL) {
  const { networkInterfaces } = await import("node:os");
  const http = await import("node:http");
  const ips = Object.values(networkInterfaces())
    .flatMap((nics) => nics ?? [])
    .filter((nic) => nic.family === "IPv4" && !nic.internal)
    .map((nic) => nic.address);
  for (const ip of ips) {
    const server = http.createServer((incoming, outgoing) => {
      const forwarded = http.request(
        {
          hostname: target.hostname,
          port: target.port || 80,
          method: incoming.method,
          path: incoming.url,
          headers: { ...incoming.headers, host: target.host },
        },
        (response) => {
          outgoing.writeHead(response.statusCode ?? 502, response.headers);
          response.pipe(outgoing);
        },
      );
      forwarded.on("error", () => outgoing.destroy());
      incoming.pipe(forwarded);
    });
    const ok = await new Promise<boolean>((resolve) => {
      server.once("error", () => resolve(false));
      server.listen(0, ip, () => resolve(true));
    });
    if (!ok) continue;
    const { port } = server.address() as { port: number };
    return {
      url: "http://" + ip + ":" + port + "/",
      close: () =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }
  return null;
}

test("desde un celular por http (dirección de red, sin https) se abre la caja", async ({
  browser,
}) => {
  const target = new URL(
    process.env.FITSTORE_WEB_URL || "http://127.0.0.1:4173",
  );
  const red = await servirPorLaRed(target);
  test.skip(!red, "Esta computadora no tiene una dirección de red.");
  const base = new URL(red!.url);
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
  await red!.close();
});
