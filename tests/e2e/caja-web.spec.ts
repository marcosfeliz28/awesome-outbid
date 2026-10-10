// Auditoría 05 (interfaz, caja y modo sin conexión) y textos de cumplimiento
// (03) que se ven en la caja: recibo con el cliente, leyenda no fiscal, ITBIS
// incluido, devoluciones y privacidad; escaneos durante la carga del catálogo;
// carrito visible en 1366×768 y en el celular; avisos que no se pisan; cierre
// por inactividad con trabajo pendiente; conflicto de una venta sin conexión.
// Cada escenario crea sus productos con códigos al azar y los desactiva al final.
import { test, expect, selectNamedCustomer } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const LEGEND = "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL";
const code = (first: string) =>
  first + String(Math.floor(Math.random() * 9000000) + 1000000);

async function ownerApi(request: any) {
  const auth = await (
    await request.post("/api/auth/login", { data: OWNER })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  // El stock sólo se mueve desde un equipo aprobado (el dueño se aprueba solo).
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E caja web", secret: "e2e-caja-web-" + id },
  });
  expect(registered.ok()).toBe(true);
  // Cada equipo nuevo cierra la caja que dejó abierta el escenario anterior.
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
  return { headers, branch: auth.user.branchId as string };
}
async function newProduct(
  request: any,
  headers: any,
  name: string,
  sku: string,
  { price = 1500, qty = 5 }: { price?: number; qty?: number } = {},
) {
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const created = await request.post("/api/products", {
    headers,
    data: {
      name,
      sku: "CW-" + sku,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      variants: [{ sku, barcode: "CWB-" + sku, price, costAvg: 700 }],
    },
  });
  const product = await created.json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  const stocked = await request.post("/api/inventory/adjustments", {
    headers,
    data: { variantId: product.variants[0].id, qty, reason: "E2E caja web" },
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
async function login(
  page: any,
  email = OWNER.email,
  password = OWNER.password,
) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
}
// Por la dirección: en el celular el menú lateral está cerrado.
async function goTo(page: any, hash: string) {
  await page.evaluate((h: string) => (location.hash = h), hash);
}
async function openCash(page: any, amount = "500") {
  await goTo(page, "cash");
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  const opened = page.getByText("Caja abierta", { exact: true });
  await expect(open.or(opened).first()).toBeVisible();
  if (await open.isVisible()) {
    await open.click();
    await page.getByLabel("Efectivo inicial").fill(amount);
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
// Un lector escribe el código casi de golpe y termina con Enter.
async function scan(page: any, value: string) {
  await page.keyboard.type(value, { delay: 5 });
  await page.keyboard.press("Enter");
}
const qty = (page: any, name: string) =>
  page
    .locator(".cart-item", { hasText: name })
    .locator(".quantity-control span");
const stubPrint = (page: any) =>
  page.addInitScript(() => {
    (window as any).__prints = 0;
    window.print = () => {
      (window as any).__prints++;
    };
  });

test.describe("A1 y 03 · recibo de la venta", () => {
  test("A1: el ticket de un crédito/contraentrega lleva el nombre del cliente, la leyenda no fiscal, ITBIS incluido, devoluciones y privacidad", async ({
    page,
    request,
  }) => {
    await stubPrint(page);
    const { headers } = await ownerApi(request);
    const sku = code("5");
    const name = "Faja E2E recibo cliente " + sku;
    const product = await newProduct(request, headers, name, sku);
    await login(page);
    await openCash(page);
    const search = await pos(page);
    await search.fill(sku);
    await search.press("Enter");
    await expect(qty(page, name)).toHaveText("1");
    await selectNamedCustomer(page);
    const customer = (await page
      .locator(".customer-selector strong")
      .textContent())!.trim();
    expect(customer).not.toMatch(/Selecciona/);
    await page
      .getByRole("button", { name: /Cobrar/ })
      .first()
      .click();
    await page.getByLabel("Monto del pago").fill("500");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page
      .getByRole("button", { name: "Crédito / contraentrega", exact: true })
      .click();
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    const sheet = page.locator(".thermal-print");
    // A1: el deudor queda identificado en el papel.
    await expect(sheet).toContainText("Vendido a: " + customer);
    await expect(sheet).not.toContainText("Consumidor final");
    await expect(sheet).toContainText("Pendiente RD$ 1,000.00");
    // 03-M1/M2/M3/A1: leyenda, ITBIS incluido, devoluciones y privacidad.
    await expect(sheet).toContainText(LEGEND);
    await expect(sheet).toContainText("ITBIS incluido");
    await expect(sheet).toContainText(/Devoluciones: hasta \d+ días/);
    await expect(sheet).toContainText("Privacidad:");
    // Ningún botón llama «factura» al documento no fiscal.
    const dialog = page.getByRole("dialog", { name: /Una venta más/ });
    await expect(dialog.getByRole("button", { name: /factura/i })).toHaveCount(
      0,
    );
    await expect(
      dialog.getByRole("button", { name: "Imprimir recibo" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Recibo PDF" }),
    ).toBeVisible();
    // WhatsApp y correo llevan la misma leyenda que el ticket.
    const whatsapp = await dialog
      .getByRole("link", { name: "WhatsApp" })
      .getAttribute("href");
    expect(decodeURIComponent(whatsapp!)).toContain(LEGEND);
    await dialog.getByRole("button", { name: "Imprimir recibo" }).click();
    await expect
      .poll(() => page.evaluate(() => (window as any).__prints))
      .toBeGreaterThan(0);
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    await retire(request, headers, [product]);
  });

  test("03-A1: el formulario de cliente y «Acerca de» muestran el aviso de privacidad", async ({
    page,
    request,
  }) => {
    await ownerApi(request);
    await login(page);
    await pos(page);
    await page.locator(".customer-selector").click();
    await page
      .getByRole("button", { name: "Nuevo cliente aquí mismo" })
      .click();
    const notice = page.locator(".privacy-notice");
    await expect(notice).toContainText("opcionales");
    const link = notice.getByRole("link", { name: "Privacidad" });
    await expect(link).toHaveAttribute("href", "/privacidad.html");
    const page2 = await request.get("/privacidad.html");
    expect(page2.ok()).toBe(true);
    expect(await page2.text()).toContain("Aviso de privacidad");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Acerca de" }).click();
    const about = page.getByRole("dialog", { name: "Acerca de Nexora POS" });
    await expect(about).toContainText("Privacidad");
    await expect(
      about.getByRole("link", { name: /Aviso de privacidad/ }),
    ).toHaveAttribute("href", "/privacidad.html");
  });
});

for (const width of [390, 1280]) {
  test(`A4 (${width} px): dos escaneos seguidos mientras carga el catálogo entran los dos, en orden y sin pegarse`, async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    const { headers } = await ownerApi(request);
    const first = code("3"),
      second = code("4");
    const a = await newProduct(
      request,
      headers,
      "Faja E2E cola A " + first,
      first,
    );
    const b = await newProduct(
      request,
      headers,
      "Faja E2E cola B " + second,
      second,
    );
    await login(page);
    await openCash(page);
    await pos(page);
    // Al recargar, el catálogo no llega hasta que se escanearon los dos.
    let held = 0;
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/products*", async (route: any) => {
      held++;
      await released;
      await route.continue();
    });
    await page.reload();
    await goTo(page, "pos");
    const search = page.getByLabel("Buscar productos");
    await expect.poll(() => held).toBeGreaterThan(0);
    await expect(page.locator(".product-card")).toHaveCount(0);
    await search.click();
    await scan(page, first);
    // El buscador queda vacío: el siguiente código no se pega al anterior.
    await expect(search).toHaveValue("");
    await scan(page, second);
    await expect(search).toHaveValue("");
    await expect(page.getByText(/2 códigos en espera/)).toBeVisible();
    release();
    await expect(qty(page, a.name)).toHaveText("1");
    await expect(qty(page, b.name)).toHaveText("1");
    // En el orden en que se escanearon.
    await expect(page.locator(".cart-item strong").first()).toContainText(
      a.name,
    );
    await expect(page.getByText(/Código no encontrado/)).toHaveCount(0);
    await expect(search).toHaveValue("");
    await page.unrouteAll({ behavior: "wait" });
    await page.getByRole("button", { name: "Limpiar", exact: true }).click();
    await retire(request, headers, [a, b]);
  });
}

test("A5 (1366×768): con 5 artículos se ven completas varias líneas y la última escaneada", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const { headers } = await ownerApi(request);
  const products = [];
  for (let i = 0; i < 5; i++) {
    const sku = code(String(i + 1));
    products.push(
      await newProduct(request, headers, `Faja E2E carrito ${i} ${sku}`, sku),
    );
  }
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.click();
  for (const p of products) await scan(page, p.variants[0].sku);
  await expect(page.locator(".cart-item")).toHaveCount(5);
  await page.waitForTimeout(600);
  const view = await page.evaluate(() => {
    const region = document
      .querySelector(".cart-items")!
      .getBoundingClientRect();
    const rows = [...document.querySelectorAll(".cart-item")].map((r) =>
      r.getBoundingClientRect(),
    );
    const inside = (r: DOMRect) =>
      r.top >= region.top - 1 && r.bottom <= region.bottom + 1;
    return {
      fully: rows.filter(inside).length,
      lastVisible: inside(rows[rows.length - 1]),
      rowHeight: Math.round(rows[0].height),
      bottom: Math.round(
        document
          .querySelector(".cart-panel .charge-button")!
          .getBoundingClientRect().bottom,
      ),
    };
  });
  expect(view.fully, JSON.stringify(view)).toBeGreaterThanOrEqual(3);
  expect(view.lastVisible, JSON.stringify(view)).toBe(true);
  expect(view.rowHeight).toBeLessThanOrEqual(100);
  // El botón de cobrar sigue a la vista sin desplazar la página.
  expect(view.bottom).toBeLessThanOrEqual(768);
  await page.screenshot({
    path: test.info().outputPath("a5-carrito-1366x768.png"),
  });
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await retire(request, headers, products);
});

test("A5 (390 px): la barra inferior muestra el carrito y el total y lleva al carrito sin recorrer el catálogo", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const { headers } = await ownerApi(request);
  const sku = code("6");
  const name = "Faja E2E barra móvil " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  const bar = page.locator(".pos-mobile-bar");
  await expect(bar).toBeInViewport();
  const open = bar.getByRole("button", { name: /Ver carrito/ });
  await expect(open).toContainText("1");
  await expect(bar.getByRole("button", { name: /Cobrar RD\$/ })).toBeVisible();
  await open.click();
  await expect(page.locator(".cart-item", { hasText: name })).toBeInViewport();
  // Sin desplazamiento horizontal de la página.
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: test.info().outputPath("a5-carrito-390.png"),
  });
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await context.close();
  await retire(request, headers, [product]);
});

test("05-M2: el error de un escaneo no se va solo ni lo tapa otro aviso; suena un pitido distinto y se puede apagar", async ({
  page,
  request,
}) => {
  await page.addInitScript(() => {
    const beeps: number[] = ((window as any).__beeps = []);
    class FakeAudio {
      currentTime = 0;
      destination = {};
      state = "running";
      resume() {
        return Promise.resolve();
      }
      createGain() {
        const param = {
          value: 0,
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        };
        return { gain: param, connect() {} };
      }
      createOscillator() {
        const frequency = {
          value: 0,
          setValueAtTime(v: number) {
            frequency.value = v;
          },
        };
        return {
          type: "sine",
          frequency,
          connect() {},
          start() {
            beeps.push(frequency.value);
          },
          stop() {},
        };
      }
    }
    (window as any).AudioContext = FakeAudio;
    (window as any).webkitAudioContext = FakeAudio;
  });
  await page.clock.install();
  const { headers } = await ownerApi(request);
  const sku = code("8");
  const name = "Faja E2E aviso " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.click();
  const missing = code("9");
  await scan(page, missing);
  const error = page.getByText("Código no encontrado: " + missing + ".");
  await expect(error).toBeVisible();
  const beeps = () => page.evaluate(() => (window as any).__beeps.slice());
  await expect.poll(async () => (await beeps()).length).toBe(1);
  // Pasan 15 s: el error sigue a la vista hasta el siguiente escaneo correcto.
  await page.clock.fastForward(15000);
  await expect(error).toBeVisible();
  await scan(page, sku);
  await expect(qty(page, name)).toHaveText("1");
  await expect(error).toHaveCount(0);
  const sounds = await beeps();
  expect(sounds).toHaveLength(2);
  // Agregado y error suenan distinto.
  expect(sounds[1]).not.toBe(sounds[0]);
  // El pitido se apaga desde la caja.
  const toggle = page.getByRole("button", { name: "Pitido del lector" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await search.click();
  await scan(page, missing);
  await expect(error).toBeVisible();
  expect(await beeps()).toHaveLength(2);
  await toggle.click();
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await retire(request, headers, [product]);
});

test("A3: sin internet y con artículos en el carrito, la inactividad no cierra la sesión y el carrito sobrevive a una recarga", async ({
  page,
  context,
  request,
}) => {
  await page.clock.install();
  const { headers } = await ownerApi(request);
  const sku = code("2");
  const name = "Faja E2E inactividad " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.fill(sku);
  await search.press("Enter");
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("2");
  // Se va el internet y pasan 31 minutos sin tocar la pantalla.
  const api = (url: URL) => url.pathname.startsWith("/api/");
  await context.route(api, (route: any) => route.abort("internetdisconnected"));
  await page.clock.fastForward("31:00");
  await page.waitForTimeout(1500);
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await expect(qty(page, name)).toHaveText("2");
  // Vuelve el internet y la cajera recarga: el carrito sigue ahí.
  await context.unroute(api);
  await page.reload();
  await goTo(page, "pos");
  await expect(qty(page, name)).toHaveText("2");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await retire(request, headers, [product]);
});

test("A2: el conflicto de stock de una venta sin conexión de la cajera se explica, se descarta con PIN de gerente, queda auditado y no bloquea el cierre", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  const { headers, branch } = await ownerApi(request);
  const sku = code("1");
  const name = "Faja E2E conflicto " + sku;
  const product = await newProduct(request, headers, name, sku, { qty: 1 });
  // Una cajera nueva con su equipo aprobado.
  const roles = await (await request.get("/api/roles", { headers })).json();
  const tag = Date.now().toString(36);
  const email = `e2e-conflicto-${tag}@example.test`;
  const temporary = "FitStore-QA-2026!",
    password = "FitStore-QA-2026-Definitiva!";
  const created = await request.post("/api/users", {
    headers,
    data: {
      name: "E2E Cajera conflicto " + tag,
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
    name: "E2E conflicto " + tag,
    secret: "e2e-conflicto-secreto-" + crypto.randomUUID(),
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
    ["fitstore-equipment:" + branch, JSON.stringify(identity)] as const,
  );
  await login(page, email, password);
  await openCash(page);
  const search = await pos(page);
  // Sin internet vende la única unidad en efectivo.
  const api = (url: URL) => url.pathname.startsWith("/api/");
  await context.route(api, (route: any) => route.abort("internetdisconnected"));
  await search.fill(sku);
  await search.press("Enter");
  await expect(qty(page, name)).toHaveText("1");
  await selectNamedCustomer(page);
  await page
    .getByRole("button", { name: /Cobrar/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  // Mientras tanto, esa unidad sale por otra vía.
  const gone = await request.post("/api/inventory/adjustments", {
    headers,
    data: {
      variantId: product.variants[0].id,
      qty: -1,
      reason: "E2E: la unidad se vendió en otra caja",
    },
  });
  expect(gone.ok(), await gone.text()).toBe(true);
  await context.unroute(api);
  await expect(page.locator(".connection")).toContainText("En línea", {
    timeout: 20000,
  });
  await goTo(page, "cash");
  const row = page.locator(".pending-panel tr", { hasText: "LOCAL-" });
  await expect(row).toContainText("Requiere revisión", { timeout: 20000 });
  // La pantalla dice qué hacer y quién lo resuelve.
  await expect(row.locator(".pending-sale-help")).toContainText(/gerencia/i);
  await page.screenshot({
    path: test.info().outputPath("a2-conflicto-caja.png"),
    fullPage: true,
  });
  // El cierre avisa claro antes de contar.
  await page.getByRole("button", { name: "Cerrar y arquear" }).click();
  const closing = page.getByRole("dialog", { name: "Cuadre y cierre de caja" });
  await expect(closing.locator(".close-pending-warning")).toContainText(
    /1 venta/,
  );
  await page.keyboard.press("Escape");
  await row
    .getByRole("button", { name: "Descartar con PIN de gerente" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Descartar venta sin conexión",
  });
  await expect(dialog).toContainText(name);
  await dialog.screenshot({
    path: test.info().outputPath("a2-descartar-con-pin.png"),
  });
  await dialog
    .getByLabel("Motivo obligatorio")
    .fill("No hay unidades; se devolvió el dinero");
  await dialog.getByLabel("PIN del gerente").fill("000000");
  await dialog.getByRole("button", { name: "Descartar venta" }).click();
  await expect(dialog.getByText("PIN incorrecto.")).toBeVisible();
  await dialog.getByLabel("PIN del gerente").fill("234567");
  await dialog.getByRole("button", { name: "Descartar venta" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".pending-panel")).toHaveCount(0);
  // Ya no hay nada que bloquee el cierre.
  await page.getByRole("button", { name: "Cerrar y arquear" }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Cuadre y cierre de caja" })
      .locator(".close-pending-warning"),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  // La bitácora conserva quién aprobó, el motivo y el detalle de la venta.
  const log = await (await request.get("/api/audit-log", { headers })).json();
  const entry = (Array.isArray(log) ? log : log.items).find(
    (e: any) =>
      e.action === "offline_sale_discarded" &&
      JSON.stringify(e.after).includes(sku),
  );
  expect(entry, "auditoría del descarte").toBeTruthy();
  expect(JSON.stringify(entry.after)).toContain("Andrea Gómez");
  await retire(request, headers, [product]);
});

test("05-M7: «Limpiar» vacía el carrito y se puede deshacer", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const sku = code("7");
  const name = "Faja E2E deshacer " + sku;
  const product = await newProduct(request, headers, name, sku);
  await login(page);
  await openCash(page);
  const search = await pos(page);
  await search.click();
  await scan(page, sku);
  await scan(page, sku);
  await expect(qty(page, name)).toHaveText("2");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await page.getByRole("button", { name: "Deshacer", exact: true }).click();
  await expect(qty(page, name)).toHaveText("2");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await retire(request, headers, [product]);
});

test("05-M3: sin internet, «En espera» dice que necesita conexión en vez de cargar sin fin", async ({
  page,
  context,
  request,
}) => {
  await ownerApi(request);
  await login(page);
  await pos(page);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "En espera", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Ventas en espera y cotizaciones",
  });
  await expect(
    dialog.getByText("Sin conexión: esta información necesita internet."),
  ).toBeVisible();
  await context.setOffline(false);
});

test("05-M4: el selector de cliente busca por nombre y Enter elige", async ({
  page,
  request,
}) => {
  const { headers } = await ownerApi(request);
  const tag = code("1");
  const created = await request.post("/api/customers", {
    headers,
    data: {
      name: "Clienta Buscable " + tag,
      phone: "",
      email: "",
      legalId: "",
      notes: "",
    },
  });
  expect(created.ok()).toBe(true);
  await login(page);
  await pos(page);
  await page.keyboard.press("F4");
  const dialog = page.getByRole("dialog", {
    name: "¿Para quién es esta venta?",
  });
  const finder = dialog.getByLabel("Buscar cliente");
  await expect(finder).toBeFocused();
  await finder.fill("buscable " + tag);
  await expect(dialog.locator(".customer-list button")).toHaveCount(1);
  await finder.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".customer-selector strong")).toHaveText(
    "Clienta Buscable " + tag,
  );
});

// Integración wave2 (fix-dinero M-2): la API también exige el PIN cuando la
// deuda abierta del cliente más esta venta supera el umbral, algo que la caja
// no puede calcular. Antes la caja sólo mostraba el error y la cajera no tenía
// dónde escribir el PIN; ahora aparece el campo y el mismo cobro se reintenta.
test("M-2: si la deuda del cliente exige PIN, la caja lo pide y reintenta el mismo cobro", async ({
  page,
  context,
  request,
}) => {
  test.setTimeout(120000);
  const { headers, branch } = await ownerApi(request);
  const settings = await (
    await request.get("/api/settings", { headers })
  ).json();
  const sku = code("2");
  const name = "Faja E2E deuda M-2 " + sku;
  const product = await newProduct(request, headers, name, sku, {
    price: 600,
    qty: 4,
  });
  let seller = "";
  let cashId = "";
  try {
    // Con crédito activado, una contraentrega de RD$ 600 no pide PIN por sí
    // sola (umbral RD$ 1,000); la segunda al mismo cliente sí, por la deuda.
    const allowed = await request.put("/api/settings", {
      headers,
      data: { ...settings, allowCreditSales: true },
    });
    expect(allowed.ok(), await allowed.text()).toBe(true);
    const client = await request.post("/api/customers", {
      headers,
      data: { name: "Clienta Deuda M2 " + sku },
    });
    expect(client.ok(), await client.text()).toBe(true);
    const customer = await client.json();
    // Una cajera nueva (sin sale:manage) con su equipo aprobado.
    const roles = await (await request.get("/api/roles", { headers })).json();
    const tag = Date.now().toString(36);
    const email = `e2e-deuda-${tag}@example.test`;
    const temporary = "FitStore-QA-2026!",
      password = "FitStore-QA-2026-Definitiva!";
    const created = await request.post("/api/users", {
      headers,
      data: {
        name: "E2E Cajera deuda " + tag,
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
    seller = (await changed.json()).accessToken;
    const identity = {
      id: crypto.randomUUID(),
      name: "E2E deuda " + tag,
      secret: "e2e-deuda-secreto-" + crypto.randomUUID(),
    };
    const registered = await request.post("/api/terminals/register", {
      headers: { Authorization: "Bearer " + seller },
      data: identity,
    });
    if ((await registered.json()).status === "pending")
      await request.post("/api/terminals/" + identity.id + "/approve", {
        headers,
        data: {},
      });
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ["fitstore-equipment:" + branch, JSON.stringify(identity)] as const,
    );
    await login(page, email, password);
    await openCash(page);
    const sellCod = async () => {
      const search = await pos(page);
      await search.fill(sku);
      await search.press("Enter");
      await expect(qty(page, name)).toHaveText("1");
      await page.keyboard.press("F4");
      const picker = page.getByRole("dialog", {
        name: "¿Para quién es esta venta?",
      });
      await picker.getByLabel("Buscar cliente").fill("Deuda M2 " + sku);
      await expect(picker.locator(".customer-list button")).toHaveCount(1);
      await picker.getByLabel("Buscar cliente").press("Enter");
      await expect(page.locator(".customer-selector strong")).toHaveText(
        customer.name,
      );
      await page
        .getByRole("button", { name: /Cobrar/ })
        .first()
        .click();
      await page
        .getByRole("button", { name: "Crédito / contraentrega", exact: true })
        .click();
      await page.getByRole("button", { name: "Agregar pago" }).click();
    };
    const pinField = page.getByLabel("PIN del gerente para aprobar la venta");
    // 1) Sin deuda previa: se registra sin PIN.
    await sellCod();
    await expect(pinField).toHaveCount(0);
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    // 2) Con RD$ 600 pendientes, la API pide el PIN: la caja lo muestra.
    await sellCod();
    await expect(pinField).toHaveCount(0);
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(page.locator(".form-error")).toContainText(
      "La deuda pendiente de este cliente",
    );
    await expect(pinField).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finalizar venta" }),
    ).toBeDisabled();
    await pinField.fill("000000");
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(page.locator(".form-error")).toContainText("PIN incorrecto.");
    await pinField.fill("234567");
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    // Dos ventas (no una duplicada) y RD$ 1,200 por cobrar al cliente.
    const sold = (
      await (await request.get("/api/sales", { headers })).json()
    ).filter((s: any) => s.customerId === customer.id);
    expect(sold).toHaveLength(2);
    expect(
      sold.reduce((a: number, s: any) => a + Number(s.creditBalance), 0),
    ).toBe(1200);
    const sessions = await (
      await request.get("/api/cash-sessions", {
        headers: { Authorization: "Bearer " + seller },
      })
    ).json();
    cashId = sessions.find((s: any) => !s.closedAt)?.id ?? "";
  } finally {
    await request.put("/api/settings", { headers, data: settings });
    if (cashId)
      await request.post("/api/cash-sessions/" + cashId + "/close", {
        headers: { Authorization: "Bearer " + seller },
        data: {
          countedCash: 500,
          countedCard: 0,
          countedTransfer: 0,
          notes: "Cierre del escenario E2E M-2",
        },
      });
    await retire(request, headers, [product]);
  }
});
