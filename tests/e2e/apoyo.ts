// Apoyo común de las pruebas E2E: de aquí sale `test` (no de "@playwright/test"),
// para que la suite se pueda repetir sobre la misma base y no ensucie el repositorio.
import { test as base, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import { randomInt, randomUUID } from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, normalize } from "node:path";

export { expect };

// --- Una dirección de cliente por prueba -----------------------------------
// La API limita por dirección de cliente las peticiones a /api/auth/* (60 por
// minuto) y los cobros. La vista previa de Vite reenvía /api sin decir de quién
// es cada petición, así que todas las pruebas llegaban como 127.0.0.1 y el
// límite de unas hacía fallar a otras (al repetir la suite, o en una máquina
// rápida). Cada prueba habla con la PWA a través de un intermediario propio que
// pone su dirección en X-Forwarded-For, como hace nginx en producción: la
// página y `request` son el mismo equipo, y el límite sigue activo para cada
// prueba. No sirve `extraHTTPHeaders`: el navegador la enviaría también a los
// demás orígenes que pida la página (cuando las fuentes venían de Google Fonts,
// este la rechazaba por CORS y la página se quedaba sin fuentes).
const clientAddress = () =>
  `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
async function clientProxy(target: URL, address: string) {
  const agent = new http.Agent({ keepAlive: true });
  const server = http.createServer((incoming, outgoing) => {
    const headers: http.OutgoingHttpHeaders = {
      ...incoming.headers,
      host: target.host,
    };
    // Una prueba puede presentarse con otra dirección si la envía ella misma.
    headers["x-forwarded-for"] ??= address;
    const forwarded = http.request(
      {
        hostname: target.hostname,
        port: target.port || 80,
        method: incoming.method,
        path: incoming.url,
        headers,
        agent,
      },
      (response) => {
        response.on("error", () => outgoing.destroy());
        outgoing.writeHead(response.statusCode ?? 502, response.headers);
        // Los avisos en vivo (/api/events) no terminan: las cabeceras salen ya.
        outgoing.flushHeaders();
        response.pipe(outgoing);
      },
    );
    // Si un lado se corta, se corta el otro: el cliente ve el mismo fallo de red.
    forwarded.on("error", () => outgoing.destroy());
    incoming.on("error", () => forwarded.destroy());
    outgoing.on("error", () => forwarded.destroy());
    outgoing.on("close", () => forwarded.destroy());
    incoming.pipe(forwarded);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + (server.address() as AddressInfo).port;
  return {
    url: origin + (target.pathname === "/" ? "" : target.pathname),
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      agent.destroy();
    },
  };
}
export const test = base.extend({
  baseURL: async ({ baseURL }, use) => {
    // Detrás de HTTPS ya hay un servidor que dice de quién es cada petición.
    if (!baseURL?.startsWith("http://")) return use(baseURL);
    const proxy = await clientProxy(new URL(baseURL), clientAddress());
    await use(proxy.url);
    await proxy.close();
  },
});

// --- Capturas de pantalla -------------------------------------------------
// Las capturas de docs/ están en el repositorio. Una corrida normal las deja en
// la carpeta de resultados de Playwright (ignorada por git y vaciada al empezar
// cada corrida); sólo con FITSTORE_ACTUALIZAR_CAPTURAS=1 se escriben en docs/,
// para refrescar la documentación a propósito.
export const SCREENSHOTS_ENV = "FITSTORE_ACTUALIZAR_CAPTURAS";
export function screenshotTarget(
  path: string,
  {
    root,
    outputDir,
    update,
  }: { root: string; outputDir: string; update: boolean },
) {
  const clean = normalize(path).replaceAll("\\", "/");
  if (!clean.startsWith("docs/"))
    throw new Error("La captura debe ir dentro de docs/: " + path);
  return update ? join(root, clean) : join(outputDir, "capturas", clean);
}
/** Para `page.screenshot({ path: screenshotPath("docs/….png") })`. */
export function screenshotPath(path: string) {
  const info = base.info();
  return screenshotTarget(path, {
    root: info.config.configFile
      ? dirname(info.config.configFile)
      : process.cwd(),
    outputDir: info.project.outputDir,
    update: process.env[SCREENSHOTS_ENV] === "1",
  });
}

// --- Existencias de la semilla --------------------------------------------
// La semilla trae pocas unidades de cada variante (13 de la proteína y del
// shaker) y nadie las repone: una prueba que vende un producto de la semilla
// asegura antes lo que va a vender, así no depende de cuántas veces corrió la
// suite sobre la misma base.
const DAY = 86400000;
/** Sesión del dueño con un equipo aprobado: el stock sólo se mueve desde uno. */
export async function ownerHeaders(request: APIRequestContext) {
  const login = await request.post("/api/auth/login", {
    data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
  });
  expect(login.ok(), "inicio de sesión del dueño").toBe(true);
  const headers = {
    Authorization: "Bearer " + (await login.json()).accessToken,
  };
  const id = randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E existencias", secret: "e2e-existencias-" + id },
  });
  expect(registered.ok(), "registro del equipo").toBe(true);
  return headers;
}
/** Variante por SKU, con lo que la caja puede vender de ella ahora mismo. */
export async function sellableStock(
  request: APIRequestContext,
  headers: Record<string, string>,
  sku: string,
) {
  const found = await request.get("/api/products", {
    headers,
    params: { q: sku },
  });
  expect(found.ok(), "consulta de " + sku).toBe(true);
  const product = (await found.json()).items.find((p: any) =>
    p.variants.some((v: any) => v.sku === sku),
  );
  expect(
    product,
    "No hay un producto activo con la variante " + sku,
  ).toBeTruthy();
  const variant = product.variants.find((v: any) => v.sku === sku);
  const lots: any[] = variant.lots.filter((l: any) => Number(l.qty) > 0);
  // Con lote obligatorio sólo se vende de lotes vigentes (con dos días de
  // margen, para no depender de la hora ni de la zona horaria).
  const valid = lots
    .filter((l) =>
      l.expiryDate
        ? Date.parse(l.expiryDate) - Date.now() > 2 * DAY
        : !product.category.requiresExpiry,
    )
    .reduce((sum, l) => sum + Number(l.qty), 0);
  const stock = Number(variant.stock);
  return {
    product,
    variant,
    lots,
    stock,
    sellable: product.category.requiresLot ? Math.min(stock, valid) : stock,
  };
}
/** Deja al menos `min` unidades vendibles de cada SKU; repone sólo lo que falta. */
export async function ensureStock(
  request: APIRequestContext,
  minimums: Record<string, number>,
) {
  const headers = await ownerHeaders(request);
  for (const [sku, min] of Object.entries(minimums)) {
    const { product, variant, sellable } = await sellableStock(
      request,
      headers,
      sku,
    );
    if (sellable >= min) continue;
    // Un lote por día de vencimiento: repetir la suite no llena la base de lotes.
    const expiryDate = new Date(Date.now() + 365 * DAY).toISOString();
    const added = await request.post("/api/inventory/adjustments", {
      headers,
      data: {
        variantId: variant.id,
        qty: min - sellable,
        reason: "E2E: existencias para vender",
        ...(product.category.requiresLot
          ? { lotNumber: "E2E-" + expiryDate.slice(0, 10), expiryDate }
          : {}),
      },
    });
    expect(
      added.ok(),
      "reposición de " + sku + ": " + (await added.text()),
    ).toBe(true);
  }
}

/** La venta exige un cliente con nombre: elige el primero de la lista si falta. */
export async function selectNamedCustomer(page: any) {
  const selected =
    (await page.locator(".customer-selector strong").textContent()) || "";
  if (!selected.includes("Selecciona")) return;
  await page.locator(".customer-selector").click();
  await expect(page.locator(".customer-list button").first()).toBeVisible();
  await page.locator(".customer-list button").first().click();
}
