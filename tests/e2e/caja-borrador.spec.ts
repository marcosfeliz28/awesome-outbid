// Auditoría 05 v2 (N1, N2, N3, N3b): avisos de error de la caja, cierre por
// inactividad con un carrito abandonado y borrador del carrito. Cada escenario
// crea sus productos con códigos al azar y los desactiva al final. Los plazos
// se miden con el reloj de la prueba, sin fechas fijas.
import { test, expect, selectNamedCustomer } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const HOUR = 3600000;
const code = (first: string) =>
  first + String(Math.floor(Math.random() * 9000000) + 1000000);

async function ownerApi(request: any) {
  const auth = await (
    await request.post("/api/auth/login", { data: OWNER })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E borrador", secret: "e2e-borrador-" + id },
  });
  expect(registered.ok()).toBe(true);
  const sessions = await (
    await request.get("/api/cash-sessions", { headers })
  ).json();
  for (const s of sessions.filter(
    (s: any) => s.userId === auth.user.id && !s.closedAt,
  ))
    await request.post("/api/cash-sessions/" + s.id + "/close", {
      headers,
      data: {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        countedTransfer: Math.max(0, s.expected.transfer),
        notes: "Cierre entre escenarios E2E",
      },
    });
  return { headers };
}
async function newProduct(
  request: any,
  headers: any,
  name: string,
  sku: string,
) {
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const created = await request.post("/api/products", {
    headers,
    data: {
      name,
      sku: "BD-" + sku,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      variants: [{ sku, barcode: "BDB-" + sku, price: 1500, costAvg: 700 }],
    },
  });
  const product = await created.json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  const stocked = await request.post("/api/inventory/adjustments", {
    headers,
    data: { variantId: product.variants[0].id, qty: 5, reason: "E2E borrador" },
  });
  expect(stocked.ok()).toBe(true);
  return product;
}
async function retire(request: any, headers: any, products: any[]) {
  for (const p of products)
    await request.patch("/api/products/" + p.id, {
      headers,
      data: { active: false },
    });
}
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(OWNER.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
}
const goTo = (page: any, hash: string) =>
  page.evaluate((h: string) => (location.hash = h), hash);
async function openCash(page: any) {
  await goTo(page, "cash");
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  const opened = page.getByText("Caja abierta", { exact: true });
  await expect(open.or(opened).first()).toBeVisible();
  if (await open.isVisible()) {
    await open.click();
    await page.getByLabel("Efectivo inicial").fill("500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
  }
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
}
async function pos(page: any) {
  await goTo(page, "pos");
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  return page.getByLabel("Buscar productos");
}
async function scan(page: any, value: string) {
  await page.keyboard.type(value, { delay: 5 });
  await page.keyboard.press("Enter");
}
const qty = (page: any, name: string) =>
  page
    .locator(".cart-item", { hasText: name })
    .locator(".quantity-control span");
const RECOVERED = /Se recuperó tu venta en curso/;

/** El carrito ya está en IndexedDB (el guardado espera 600 ms y un instante libre). */
const draftSaved = (page: any, userKey = "cart-draft:") =>
  expect
    .poll(() =>
      page.evaluate(
        (prefix: string) =>
          new Promise<boolean>((done) => {
            const open = indexedDB.open("fitstore-pos-v1");
            open.onsuccess = () => {
              const all = open.result
                .transaction("cache")
                .objectStore("cache")
                .getAllKeys();
              all.onsuccess = () => {
                open.result.close();
                done(
                  (all.result as string[]).some((k) => k.startsWith(prefix)),
                );
              };
            };
            open.onerror = () => done(false);
          }),
        userKey,
      ),
    )
    .toBe(true);

test("N1: un error de escaneo no queda sobre el cobro, caduca solo y se va al teclear", async ({
  page,
  request,
}) => {
  await page.clock.install();
  const { headers } = await ownerApi(request);
  const sku = code("3");
  const name = "Faja E2E error " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.click();
  await scan(page, sku);
  await expect(qty(page, name)).toHaveText("1");
  await selectNamedCustomer(page);

  // 1. Cobrar con un error a la vista: la ventana de cobro queda libre.
  const missing = code("9");
  await search.click();
  await scan(page, missing);
  const error = page.getByText("Código no encontrado: " + missing + ".");
  await expect(error).toBeVisible();
  await page
    .getByRole("button", { name: /Cobrar/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: /Cobrar|Pago|cobro/i }),
  ).toBeVisible();
  await expect(error).toHaveCount(0);
  await page.keyboard.press("Escape");
  await search.fill("");

  // 2. Dentro del plazo sigue a la vista; pasado el plazo se cierra solo.
  await search.click();
  await scan(page, missing);
  await expect(error).toBeVisible();
  await page.clock.fastForward(11000);
  await expect(error).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(error).toHaveCount(0);

  // 3. Al teclear en el buscador, el error anterior se va.
  await search.fill("");
  await search.click();
  await scan(page, missing);
  await expect(error).toBeVisible();
  await page.keyboard.type("1");
  await expect(error).toHaveCount(0);

  await search.fill("");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await retire(request, headers, [product]);
});

test("N2: un carrito abandonado no evita el bloqueo por inactividad y se conserva al volver", async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  await page.clock.install();
  const { headers } = await ownerApi(request);
  const sku = code("4");
  const name = "Faja E2E abandono " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  await page.clock.runFor(3000);
  await draftSaved(page);

  // 31 min sin tocar nada: con un carrito la sesión sigue (hay trabajo).
  await page.clock.fastForward("31:00");
  await page.waitForTimeout(800);
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await expect(qty(page, name)).toHaveText("1");

  // Pasado el tope absoluto (2 h sin ninguna persona), la sesión se bloquea.
  await page.clock.fastForward("01:50:00");
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();

  // El carrito no se borró: al volver a entrar, ahí está.
  await login(page);
  await goTo(page, "pos");
  await expect(qty(page, name)).toHaveText("1");
  await expect(page.getByText(RECOVERED)).toBeVisible();

  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await retire(request, headers, [product]);
});

test("N3: tras cobrar, una recarga inmediata no resucita la venta ya registrada", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const sku = code("6");
  const name = "Faja E2E cobrada " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  await selectNamedCustomer(page);
  await draftSaved(page);
  // Navegador sin un instante libre (impresión, equipo lento o apagado en el
  // acto): ningún guardado diferido llega a correr.
  await page.evaluate(() => {
    (window as any).requestIdleCallback = () => 0;
  });
  await page
    .getByRole("button", { name: /Cobrar/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await goTo(page, "pos");
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText(RECOVERED)).toHaveCount(0);
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await retire(request, headers, [product]);
});

test("N3b: un borrador de hace más de 12 horas no se recupera; uno reciente sí", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const sku = code("7");
  const name = "Faja E2E borrador viejo " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  await draftSaved(page);
  // Cambia solo la fecha del guardado en el borrador de IndexedDB.
  const age = (ms: number) =>
    page.evaluate(
      (age: number) =>
        new Promise<void>((done, fail) => {
          const open = indexedDB.open("fitstore-pos-v1");
          open.onerror = () => fail(new Error("sin IndexedDB"));
          open.onsuccess = () => {
            const store = open.result
              .transaction("cache", "readwrite")
              .objectStore("cache");
            const keys = store.getAllKeys();
            keys.onsuccess = () => {
              const key = (keys.result as string[]).find((k) =>
                k.startsWith("cart-draft:"),
              )!;
              const got = store.get(key);
              got.onsuccess = () => {
                const row = got.result;
                row.data.savedAt = Date.now() - age;
                const put = store.put(row);
                put.onsuccess = () => done();
              };
            };
          };
        }),
      ms,
    );
  await age(2 * HOUR);
  await page.reload();
  await expect(page.getByText(RECOVERED)).toBeVisible();
  await goTo(page, "pos");
  await expect(qty(page, name)).toHaveText("1");
  await age(13 * HOUR);
  await page.evaluate(() => {
    // Sin que el guardado diferido pise la edad cambiada.
    (window as any).requestIdleCallback = () => 0;
  });
  await page.reload();
  await goTo(page, "pos");
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText(RECOVERED)).toHaveCount(0);
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await retire(request, headers, [product]);
});
