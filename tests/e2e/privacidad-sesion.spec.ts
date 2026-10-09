// G9 · Privacidad al cerrar sesión: el navegador no se queda con clientes ni
// catálogo de la sesión, pero una venta sin sincronizar nunca se pierde.
import { test, expect, selectNamedCustomer } from "./apoyo";

const ADMIN = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };

// Cada contexto es un equipo nuevo: se cierra la caja que dejó abierta otra
// prueba (como en store.spec.ts), para poder cobrar desde este.
test.beforeEach(async ({ request }) => {
  const login = await request.post("/api/auth/login", { data: ADMIN });
  const { accessToken, user } = await login.json();
  const headers = { Authorization: "Bearer " + accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E G9 limpieza", secret: "e2e-g9-limpieza-" + id },
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
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(ADMIN.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.password);
  const response = page.waitForResponse(
    (r: any) =>
      r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  expect((await response).ok()).toBe(true);
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function ensureCash(page: any) {
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  if (await open.isVisible()) {
    await open.click();
    await page.getByLabel("Efectivo inicial").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
  }
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
}
async function openPos(page: any) {
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
}
async function logout(page: any) {
  await page.locator("button.account").click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
}
/** Lo que queda en IndexedDB (fitstore-pos-v1) y en Cache Storage. */
async function browserStorage(page: any) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("fitstore-pos-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const all = (store: string) =>
      new Promise<any[]>((resolve, reject) => {
        if (!db.objectStoreNames.contains(store)) return resolve([]);
        const r = db.transaction(store).objectStore(store).getAll();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    const [cache, sales, merchandise] = await Promise.all([
      all("cache"),
      all("sales"),
      all("merchandise"),
    ]);
    db.close();
    const cached: string[] = [];
    if ("caches" in self)
      for (const name of await caches.keys())
        for (const request of await (await caches.open(name)).keys())
          cached.push(request.url);
    return {
      cacheKeys: cache.map((row: any) => row.key as string),
      cacheText: JSON.stringify(cache),
      sales: sales.map((s: any) => ({
        id: s.id,
        status: s.status,
        offlineUuid: s.input?.offlineUuid,
      })),
      merchandise: merchandise.length,
      apiResponsesInCache: cached.filter((url) =>
        new URL(url).pathname.startsWith("/api/"),
      ),
    };
  });
}

test("G9: al cerrar sesión no quedan clientes, catálogo ni respuestas de la API en el navegador", async ({
  page,
}) => {
  await login(page);
  await ensureCash(page);
  await openPos(page);
  await page.getByRole("button", { name: "Clientes", exact: true }).click();
  await expect(page.locator(".main-content h1")).toBeVisible();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  // Antes de salir sí hay copias locales (la caja las usa sin conexión): la
  // prueba mira el lugar correcto.
  await expect(async () => {
    const before = await browserStorage(page);
    expect(before.cacheKeys.some((k: string) => k.startsWith("catalog:"))).toBe(
      true,
    );
    expect(
      before.cacheKeys.some((k: string) => k.startsWith("customers:")),
    ).toBe(true);
  }).toPass({ timeout: 15000 });
  await logout(page);
  const after = await browserStorage(page);
  expect(after.cacheKeys).toEqual([]);
  expect(after.cacheText).not.toContain("admin@fitstore.demo");
  expect(after.apiResponsesInCache).toEqual([]);
  // Al recargar tampoco vuelve nada: se pide la contraseña.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
  expect((await browserStorage(page)).cacheKeys).toEqual([]);
});

test("G9: el cierre por inactividad también borra clientes y catálogo del navegador", async ({
  page,
}) => {
  await page.clock.install();
  await login(page);
  await ensureCash(page);
  await openPos(page);
  await expect(async () => {
    const before = await browserStorage(page);
    expect(before.cacheKeys).toContain("catalog:main");
  }).toPass({ timeout: 15000 });
  await page.clock.fastForward("31:00");
  await expect(page.getByText("Sesión cerrada por inactividad.")).toBeVisible();
  const after = await browserStorage(page);
  expect(after.cacheKeys).toEqual([]);
  expect(after.apiResponsesInCache).toEqual([]);
});

test("G9: cerrar sesión con una venta sin sincronizar la conserva y al volver a entrar se sincroniza una sola vez", async ({
  page,
  context,
  request,
}) => {
  // Producto propio con 5 unidades: el stock dice cuántas veces se registró.
  const auth = await (
    await request.post("/api/auth/login", { data: ADMIN })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const terminal = crypto.randomUUID();
  expect(
    (
      await request.post("/api/terminals/register", {
        headers,
        data: {
          id: terminal,
          name: "E2E G9",
          secret: "e2e-g9-" + terminal,
        },
      })
    ).ok(),
  ).toBe(true);
  const code = "G9" + Date.now().toString().slice(-9);
  const name = "Faja E2E privacidad " + code;
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const product = await (
    await request.post("/api/products", {
      headers,
      data: {
        name,
        sku: "G9P-" + code,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        variants: [
          { sku: code, barcode: "G9B-" + code, price: 1500, costAvg: 700 },
        ],
      },
    })
  ).json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  expect(
    (
      await request.post("/api/inventory/adjustments", {
        headers,
        data: {
          variantId: product.variants[0].id,
          qty: 5,
          reason: "E2E G9",
        },
      })
    ).ok(),
  ).toBe(true);
  const stock = async () =>
    Number(
      (
        await (
          await request.get("/api/products/" + product.id, { headers })
        ).json()
      ).variants[0].stock,
    );

  // El servidor no recibe la venta (502) ni la sincronización: queda sólo en
  // este equipo.
  const sales = (url: URL) => url.pathname === "/api/sales";
  const sync = (url: URL) => url.pathname === "/api/sales/sync";
  await context.route(sales, (route: any) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 502, body: "<html>502 Bad Gateway</html>" })
      : route.continue(),
  );
  await context.route(sync, (route: any) =>
    route.fulfill({ status: 503, body: "Service Unavailable" }),
  );
  await login(page);
  await ensureCash(page);
  await openPos(page);
  const search = page.getByLabel("Buscar productos");
  await search.fill(code);
  await search.press("Enter");
  await expect(
    page
      .locator(".cart-item", { hasText: name })
      .locator(".quantity-control span"),
  ).toHaveText("1");
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  const pending = (await browserStorage(page)).sales;
  expect(pending).toHaveLength(1);
  expect(pending[0].status).toBe("pending");

  await logout(page);
  const after = await browserStorage(page);
  // La venta pendiente sigue: es la única copia.
  expect(after.sales).toEqual(pending);
  // Lo recuperable del servidor sí se borró.
  expect(
    after.cacheKeys.filter((k: string) => /^(catalog|customers):/.test(k)),
  ).toEqual([]);
  expect(await stock()).toBe(5);

  // Vuelve el servidor: al entrar otra vez se sincroniza, una sola vez.
  await context.unroute(sales);
  await context.unroute(sync);
  const syncCalls: string[] = [];
  page.on("request", (r: any) => {
    if (
      r.method() === "POST" &&
      new URL(r.url()).pathname === "/api/sales/sync"
    )
      syncCalls.push(r.postData() ?? "");
  });
  await login(page);
  await expect(async () => {
    expect((await browserStorage(page)).sales).toEqual([]);
  }).toPass({ timeout: 20000 });
  expect(await stock()).toBe(4);
  // Recargar no la envía otra vez: no queda nada pendiente.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(
    syncCalls.filter((b) => b.includes(pending[0].offlineUuid)),
  ).toHaveLength(1);
  expect(await stock()).toBe(4);
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});
