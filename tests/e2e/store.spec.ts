import {
  test,
  expect,
  ensureStock,
  screenshotPath,
  selectNamedCustomer,
} from "./apoyo";
import { createRequire } from "node:module";
import { resolve } from "node:path";
// Cada contexto representa un equipo nuevo: cerrar la caja del escenario anterior.
test.beforeEach(async ({ request }) => {
  const login = await request.post("/api/auth/login", {
    data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
  });
  const { accessToken, user } = await login.json();
  const headers = { Authorization: "Bearer " + accessToken };
  // Ronda 4: cerrar caja exige un equipo aprobado (el dueño se aprueba solo).
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E limpieza", secret: "e2e-limpieza-" + id },
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
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  const response = page.waitForResponse(
    (r: any) =>
      r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  const logged = await response;
  expect(logged.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  return (await logged.json()).accessToken;
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
test("venta completa desde caja hasta pagos combinados y recibo", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ensureStock(request, { "FIT-0001-1": 1, "FIT-0013-3": 1 });
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await page.getByLabel("Buscar productos").fill("Proteína Whey Isolate");
  await page.locator(".product-card").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Chocolate/ })
    .click();
  await page.getByLabel("Buscar productos").fill("Legging Essential");
  await page.locator(".product-card").first().click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /M · Negro/ })
    .click();
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Todo listo para cobrar" }),
  ).toBeVisible();
  const total = Number(
    (await page.locator(".payment-total h2").textContent())!.replace(
      /[^0-9.]/g,
      "",
    ),
  );
  await page.getByLabel("Monto del pago").fill("1000");
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Tarjeta", exact: true }).click();
  await page.getByLabel("Monto del pago").fill(String(total - 1000));
  await page.getByLabel("Últimos 4 dígitos").fill("4242");
  await page.getByLabel("Número de aprobación").fill("E2E-APROBADO");
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByRole("dialog", { name: /Una venta más/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: screenshotPath("docs/cobro-exitoso.png") });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  const emptyCart = page.locator(".cart-empty-state");
  await expect(emptyCart).toContainText("Carrito vacío");
  await expect(emptyCart).toContainText("Escanea o busca un artículo");
  expect(errors).toEqual([]);
});
test("pantallas de gestión, tema oscuro y versión móvil", async ({ page }) => {
  await login(page);
  for (const label of [
    "Productos",
    "Inventario",
    "Compras",
    "Gastos",
    "Clientes",
    "Promociones",
    "Reportes",
    "Alertas",
  ]) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await expect(page.locator(".main-content h1")).toBeVisible();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    await expect(page.locator(".error-panel")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: screenshotPath("docs/dashboard-mobile.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await page.getByLabel("Buscar productos").fill("Shaker");
  await expect(page.locator(".product-card")).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: screenshotPath("docs/pos-mobile.png"),
    fullPage: true,
  });
});
test("venta offline queda guardada y se sincroniza una sola vez", async ({
  page,
  context,
  request,
}) => {
  await ensureStock(request, { "FIT-0037-1": 1 });
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.getByLabel("Buscar productos").fill("Shaker FitStore");
  await page.locator(".product-card").click();
  await page.getByRole("dialog").getByRole("button", { name: /Lila/ }).click();
  await selectNamedCustomer(page);
  await context.setOffline(true);
  await expect(page.locator(".connection")).toContainText("Offline");
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await context.setOffline(false);
  await expect(page.locator(".connection")).toContainText("En línea");
  await expect(async () => {
    const count = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("fitstore-pos-v1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      return await new Promise<number>((resolve, reject) => {
        const r = db.transaction("sales").objectStore("sales").count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    });
    expect(count).toBe(0);
  }).toPass({ timeout: 20000 });
});

test("descuento por monto, crédito y abono en interfaz", async ({ page }) => {
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  async function call(
    path: string,
    data?: any,
    method = data ? "POST" : "GET",
  ) {
    const r = await page.request.fetch("/api" + path, {
      method,
      headers,
      ...(data ? { data } : {}),
    });
    expect(r.ok()).toBe(true);
    return r.json();
  }
  const settings = await call("/settings");
  let product: any;
  try {
    await call("/settings", { ...settings, allowCreditSales: true }, "PUT");
    const categories = await call("/categories");
    const suffix = Date.now();
    const name = "QA navegador " + suffix;
    product = await call("/products", {
      name,
      sku: "QA-E2E-" + suffix,
      categoryId: categories.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "QA-E2EV-" + suffix,
          barcode: "QA-E2EB-" + suffix,
          costAvg: 40,
          price: 118,
        },
      ],
    });
    await call("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 3,
      reason: "QA navegador",
    });
    const customer = await call("/customers", {
      name: "QA cliente " + suffix,
      creditLimit: 500,
    });
    await ensureCash(page);
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    await page.getByLabel("Buscar productos").fill(name);
    await page.locator(".product-card").click();
    await page.getByLabel("Descuento por monto de " + name).fill("18");
    await page.keyboard.press("F4");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: customer.name })
      .click();
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page
      .getByRole("button", {
        name: "Crédito / contraentrega",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Agregar pago", exact: true })
      .click();
    await page
      .getByLabel("Motivo del descuento")
      .fill("Descuento de prueba E2E");
    await page
      .getByRole("button", { name: "Finalizar venta", exact: true })
      .click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    const sold = (await call("/sales")).find(
      (s: any) => s.customerId === customer.id,
    );
    expect(Number(sold.total)).toBe(100);
    expect(Number(sold.creditBalance)).toBe(100);
    await page.getByRole("button", { name: "Ventas", exact: true }).click();
    await page
      .getByRole("row")
      .filter({ hasText: sold.number })
      .getByRole("button", { name: "Registrar abono", exact: true })
      .click();
    await page.getByLabel("Monto del abono").fill("50");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      Number(
        (await call("/sales")).find((s: any) => s.id === sold.id).creditBalance,
      ),
    ).toBe(50);
  } finally {
    await call("/settings", settings, "PUT");
    if (product)
      await call("/products/" + product.id, { active: false }, "PATCH");
  }
});

test("Mercancía móvil: entrada offline, sincronización única y etiquetas", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  const cats = await (
    await page.request.get("/api/categories", { headers })
  ).json();
  const suffix = Date.now().toString(36);
  const create = await page.request.post("/api/products", {
    headers,
    data: {
      name: "E2E Mercancía " + suffix,
      sku: "E2E-G-" + suffix,
      categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
      variants: [
        {
          sku: "E2E-GV-" + suffix,
          barcode: "E2E-GB-" + suffix,
          costAvg: 10,
          price: 118,
        },
      ],
    },
  });
  expect(create.ok()).toBe(true);
  const p = await create.json();
  page.on("dialog", (d) => d.accept());
  await page
    .locator(".goods-mobile-bar")
    .getByRole("button", { name: "Mercancía", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Mercancía", exact: true }),
  ).toBeVisible();
  // El buscador de Mercancía encuentra el producto en el catálogo local.
  await page.getByLabel("Buscar producto", { exact: true }).fill(p.name);
  await expect(
    page
      .getByRole("list", { name: "Resultados: Buscar producto" })
      .getByRole("button")
      .filter({ hasText: p.name }),
  ).toHaveCount(1);
  await page.getByLabel("Buscar producto", { exact: true }).fill("");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // La primera instalación empieza a controlar la página en la próxima navegación.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mercancía", exact: true }),
  ).toBeVisible();
  // El buscador de Mercancía encuentra el producto en el catálogo local.
  await page.getByLabel("Buscar producto", { exact: true }).fill(p.name);
  await expect(
    page
      .getByRole("list", { name: "Resultados: Buscar producto" })
      .getByRole("button")
      .filter({ hasText: p.name }),
  ).toHaveCount(1);
  await page.getByLabel("Buscar producto", { exact: true }).fill("");
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(
    true,
  );
  await context.setOffline(true);
  await page.getByLabel("Código de barras o SKU").fill(p.variants[0].barcode);
  await page.getByRole("button", { name: "Sumar una unidad" }).click();
  await page.getByLabel("Cantidad", { exact: true }).fill("3");
  await page.getByLabel("Costo unitario", { exact: true }).fill("20");
  await page
    .getByRole("button", { name: "Confirmar entrada", exact: true })
    .click();
  await expect(
    page.getByText("Guardado en cola. Se sincronizará al reconectar."),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mercancía", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Pendiente · Entrada/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Pendiente · Entrada/)).toHaveCount(0, {
    timeout: 15000,
  });
  const fetched = await (
    await page.request.get("/api/products/" + p.id, { headers })
  ).json();
  expect(Number(fetched.variants[0].stock)).toBe(3);
  expect(Number(fetched.variants[0].costAvg)).toBe(20);
  await page
    .locator(".goods-history")
    .getByRole("button", { name: /Etiquetas/ })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "Etiquetas de lo recibido" }),
  ).toBeVisible();
  await expect(
    page.locator(".barcode-label").filter({ hasText: p.name }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await page.request.patch("/api/products/" + p.id, {
    headers,
    data: { active: false },
  });
});

test("Importar CSV exige revisión antes de modificar existencias", async ({
  page,
}) => {
  const token = await login(page),
    headers = { Authorization: "Bearer " + token };
  const cats = await (
    await page.request.get("/api/categories", { headers })
  ).json();
  const suffix = Date.now().toString(36);
  const p = await (
    await page.request.post("/api/products", {
      headers,
      data: {
        name: "E2E Factura " + suffix,
        sku: "E2E-I-" + suffix,
        categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
        variants: [
          {
            sku: "E2E-IV-" + suffix,
            barcode: "E2E-IB-" + suffix,
            costAvg: 10,
            price: 118,
          },
        ],
      },
    })
  ).json();
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Mercancía", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Importar factura del proveedor" })
    .click();
  await page.getByLabel("Archivo", { exact: true }).setInputFiles({
    name: "factura.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      `codigo,descripcion,cantidad,costo\n${p.variants[0].barcode},${p.name},2,15\n`,
    ),
  });
  await page.getByRole("button", { name: "Extraer para revisar" }).click();
  await expect(
    page.getByRole("heading", { name: "Revisión de factura" }),
  ).toBeVisible();
  expect(
    Number(
      (
        await (
          await page.request.get("/api/products/" + p.id, { headers })
        ).json()
      ).variants[0].stock,
    ),
  ).toBe(0);
  await page.getByLabel("Costo unitario", { exact: true }).fill("16");
  await page
    .getByRole("button", { name: "Confirmar entrada", exact: true })
    .click();
  await expect(page.getByText("Mercancía registrada.")).toBeVisible();
  expect(
    Number(
      (
        await (
          await page.request.get("/api/products/" + p.id, { headers })
        ).json()
      ).variants[0].stock,
    ),
  ).toBe(2);
  await page.request.patch("/api/products/" + p.id, {
    headers,
    data: { active: false },
  });
});

test("equipo nuevo de vendedor espera aprobación y se aprueba con PIN de gerente", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByLabel("Usuario").fill("vendedor@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByText("Este equipo necesita aprobación")).toBeVisible({
    timeout: 15000,
  });
  await page.getByLabel("Nombre del equipo").fill("Caja E2E vendedor");
  await page.getByLabel("PIN del gerente").fill("000000");
  await page.getByRole("button", { name: "Aprobar este equipo" }).click();
  await expect(page.getByText("PIN incorrecto.")).toBeVisible();
  await page.getByLabel("PIN del gerente").fill("234567");
  await page.getByRole("button", { name: "Aprobar este equipo" }).click();
  await expect(page.getByText("Este equipo necesita aprobación")).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Equipo aprobado. Ya puedes operar."),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
// Auditoría R4 (ChatGPT) · R4-09: Configuración y Equipos en celular.
test("Configuración y Equipos caben en 320 y 390 px sin desplazamiento horizontal", async ({
  page,
}) => {
  await login(page);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await page
      .getByRole("button", { name: "Configuración", exact: true })
      .click();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    for (const label of [
      "Negocio y reglas",
      "Usuarios y permisos",
      "Bitácora",
      "Equipos",
    ]) {
      const tab = page.locator(".tabs.outside button", { hasText: label });
      await expect(tab).toBeVisible();
      const box = (await tab.boundingBox())!;
      expect(box.x, label + " @" + width).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, label + " @" + width).toBeLessThanOrEqual(
        width + 1,
      );
    }
    await page.locator(".tabs.outside button", { hasText: "Equipos" }).click();
    await expect(page.locator(".equipment-item").first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth - window.innerWidth,
      // Contenido recortado: ningún elemento visible sale por la derecha.
      clipped: [...document.querySelectorAll(".main-content *")].filter(
        (el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.right > window.innerWidth + 1;
        },
      ).length,
    }));
    expect(overflow.page, "scrollWidth @" + width).toBeLessThanOrEqual(1);
    expect(overflow.clipped, "recortes @" + width).toBe(0);
    await page.screenshot({
      // Pantalla visible: la base de pruebas acumula cientos de equipos.
      path: screenshotPath(
        `docs/validacion/ronda6-capturas/cel-equipos-${width}.png`,
      ),
    });
  }
});
// Avisos de facturas por Telegram: la tarjeta de Configuración muestra el
// estado y los pasos, y la prueba de conexión avisa si faltan las variables
// (la API de las pruebas corre sin TELEGRAM_BOT_TOKEN ni TELEGRAM_CHAT_ID).
test("Configuración › Negocio y reglas: tarjeta de avisos por Telegram", async ({
  page,
}) => {
  await login(page);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const card = page.locator(".telegram-card");
  await expect(
    card.getByRole("heading", { name: "Avisos de facturas por Telegram" }),
  ).toBeVisible();
  await expect(card.getByText("Desactivados")).toBeVisible();
  await expect(card.getByText(/@BotFather/)).toBeVisible();
  await expect(
    card.getByText(/TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID/),
  ).toBeVisible();
  await card.getByRole("button", { name: "Enviar mensaje de prueba" }).click();
  await expect(page.getByText(/no están activados/)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});
// Revisión de la ronda 7: cobrar escribiendo el código del producto + Enter
// (o con un lector de códigos que escribe y pulsa Enter).
test("código + Enter agrega el producto y respeta el stock", async ({
  page,
  request,
}) => {
  const auth = await (
    await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id = crypto.randomUUID();
  await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E código", secret: "e2e-codigo-" + id },
  });
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const base = 9000 + Math.floor(Math.random() * 900000);
  const created: any[] = [];
  for (const code of [String(base), String(base + 1)]) {
    const product = await (
      await request.post("/api/products", {
        headers,
        data: {
          name: "Faja E2E código " + code,
          sku: "E2E-" + code,
          categoryId: categories.find((c: any) => c.name === "Fajas").id,
          variants: [
            { sku: code, barcode: "E2E-B-" + code, price: 1500, costAvg: 700 },
          ],
        },
      })
    ).json();
    const stocked = await request.post("/api/inventory/adjustments", {
      headers,
      data: { variantId: product.variants[0].id, qty: 1, reason: "E2E código" },
    });
    expect(stocked.ok()).toBe(true);
    created.push({ code, product });
  }
  const [a, b] = created;
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  const search = page.getByLabel("Buscar productos");
  await search.fill(a.code);
  await search.press("Enter");
  await expect(page.locator(".cart-items")).toContainText(
    "Faja E2E código " + a.code,
  );
  await expect(search).toHaveValue("");
  // Sólo había 1: el segundo Enter avisa y deja el código seleccionado.
  await search.fill(a.code);
  await search.press("Enter");
  await expect(page.getByText(/No hay suficiente stock/)).toBeVisible();
  await expect(search).toHaveValue(a.code);
  await expect(page.getByText(/agregado\./)).toHaveCount(0);
  await expect(
    page.locator(".cart-items .quantity-control span").first(),
  ).toHaveText("1");
  // El siguiente escaneo reemplaza el código seleccionado (no se suma).
  await page.keyboard.type(b.code);
  await page.keyboard.press("Enter");
  await expect(page.locator(".cart-items")).toContainText(
    "Faja E2E código " + b.code,
  );
  await expect(search).toHaveValue("");
  // Un código que no existe se avisa.
  await search.fill("99" + base + "77");
  await search.press("Enter");
  await expect(page.getByText(/Código no encontrado/)).toBeVisible();
  for (const { code, product } of created) {
    await page
      .getByRole("button", { name: "Reducir Faja E2E código " + code })
      .click();
    await request.patch("/api/products/" + product.id, {
      headers,
      data: { active: false },
    });
  }
});
// Datos heredados: la API ya no deja guardar un código que la caja confundiría
// con el de otro producto (R9-codigos-1), así que un choque anterior a esa
// regla se escribe directo en la base que usa la API (DATABASE_URL o el .env
// de la raíz, como las pruebas de integración).
function legacyDb() {
  const requireApi = createRequire(
    resolve(__dirname, "../../apps/api/package.json"),
  );
  requireApi("dotenv").config({
    path: resolve(__dirname, "../../.env"),
    quiet: true,
  });
  const { PrismaClient } = requireApi("@prisma/client");
  return new PrismaClient();
}
// Auditoría R8 (ChatGPT) · R8-01: un código que, sin distinguir mayúsculas,
// es de dos productos no agrega ninguno en silencio.
test("código ambiguo por mayúsculas avisa y no agrega", async ({
  page,
  request,
}) => {
  const auth = await (
    await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const tag = String(Math.floor(Math.random() * 900000) + 100000);
  const body = (label: string, sku: string, barcode: string) => ({
    name: "Faja E2E ambiguo " + label + " " + tag,
    sku: "E2E-AMB-" + label + tag,
    categoryId: categories.find((c: any) => c.name === "Fajas").id,
    variants: [{ sku, barcode, price: 1500, costAvg: 700 }],
  });
  // La API rechaza el SKU de B igual a las barras de A en minúsculas.
  const owner = await (
    await request.post("/api/products", {
      headers,
      data: body("A", "e2e-owner-" + tag, "E2E-CASE-" + tag),
    })
  ).json();
  expect(owner.id, JSON.stringify(owner)).toBeTruthy();
  const rejected = await request.post("/api/products", {
    headers,
    data: body("B", "e2e-case-" + tag, "E2E-OTHER-" + tag),
  });
  expect(rejected.status()).toBe(400);
  expect((await rejected.json()).message).toContain("ya es de «");
  const other = await (
    await request.post("/api/products", {
      headers,
      data: body("B", "e2e-legacy-" + tag, "E2E-OTHER-" + tag),
    })
  ).json();
  expect(other.id, JSON.stringify(other)).toBeTruthy();
  const created = [owner, other];
  for (const product of created)
    await request.post("/api/inventory/adjustments", {
      headers,
      data: { variantId: product.variants[0].id, qty: 2, reason: "E2E" },
    });
  // Si la base ya traía el choque, la caja sigue avisando y no agrega.
  const db = legacyDb();
  await db.variant.update({
    where: { id: other.variants[0].id },
    data: { sku: "e2e-case-" + tag },
  });
  await db.$disconnect();
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  const search = page.getByLabel("Buscar productos");
  await search.fill("e2e-case-" + tag);
  await search.press("Enter");
  await expect(page.getByText(/es de 2 productos/)).toBeVisible();
  await expect(page.locator(".cart-items")).not.toContainText(
    "Faja E2E ambiguo",
  );
  await expect(page.getByText(/agregado\./)).toHaveCount(0);
  for (const product of created)
    await request.patch("/api/products/" + product.id, {
      headers,
      data: { active: false },
    });
});
// Revisión R9 · códigos (R9-codigos-2 y R9-codigos-3): la etiqueta impresa
// (Code 39, en MAYÚSCULAS) de un código guardado en minúsculas se reconoce en
// Mercancía como en la caja; un código de dos productos avisa sin agregar, y
// «Crear producto rápido» no acepta un código que ya es de otro producto.
test("R9-codigos-2 y R9-codigos-3: Mercancía reconoce el código sin distinguir mayúsculas y no crea un duplicado", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const tag = r9Code("R9M"),
    lower = tag.toLowerCase();
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const make = async (label: string, sku: string, barcode: string) => {
    const response = await request.post("/api/products", {
      headers,
      data: {
        name: "Faja E2E Mercancía " + label + " " + tag,
        sku: "R9MP-" + label + "-" + tag,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        variants: [{ sku, barcode, price: 1500, costAvg: 700 }],
      },
    });
    const product = await response.json();
    expect(product.id, JSON.stringify(product)).toBeTruthy();
    return product;
  };
  const e = await make("E", "R9M-ES-" + tag, "r9m-e-" + lower);
  const f = await make("F", "R9M-FS-" + tag, "R9M-AMB-" + tag);
  const g = await make("G", "R9M-GS-" + tag, "R9M-GB-" + tag);
  // Dato heredado: el SKU de G es el código de barras de F en minúsculas.
  const db = legacyDb();
  await db.variant.update({
    where: { id: g.variants[0].id },
    data: { sku: "r9m-amb-" + lower },
  });
  await db.$disconnect();
  page.on("dialog", (d) => d.accept());
  await login(page);
  await page
    .getByRole("button", { name: "Mercancía", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Mercancía", exact: true }),
  ).toBeVisible();
  const quick = page.getByRole("dialog", { name: "Crear producto rápido" });
  const scan = async (code: string) => {
    await page.getByLabel("Código de barras o SKU").fill(code);
    await page.getByRole("button", { name: "Sumar una unidad" }).click();
  };
  const lines = page.locator(".goods-lines");
  // Entrada: la etiqueta de E (R9M-E-…) suma a E, no abre el producto rápido.
  await scan("R9M-E-" + tag);
  await expect(lines).toContainText("Faja E2E Mercancía E " + tag);
  await expect(quick).toHaveCount(0);
  // Un código de dos productos no agrega ninguno ni ofrece crear otro: avisa
  // y deja los dos en el buscador para elegir.
  await scan("R9M-AMB-" + tag);
  await expect(page.getByText(/es de 2 productos/)).toBeVisible();
  await expect(quick).toHaveCount(0);
  await expect(lines).not.toContainText("Faja E2E Mercancía F");
  await expect(lines).not.toContainText("Faja E2E Mercancía G");
  const results = page.getByRole("list", {
    name: "Resultados: Buscar producto",
  });
  await expect(results.getByRole("listitem")).toHaveCount(2);
  // «Crear producto rápido» con el código de E en otras mayúsculas: no se
  // agrega la línea y se dice de quién es el código.
  await scan("R9M-NEW-" + tag);
  await expect(quick).toBeVisible();
  await quick.getByLabel("Nombre").fill("Faja E2E duplicada " + tag);
  await quick.getByLabel("Categoría").selectOption({ label: "Fajas" });
  await quick.getByLabel("Código de barras").fill("R9M-E-" + tag);
  await quick.getByLabel("Precio de venta").fill("1500");
  await quick.getByLabel("Costo").fill("700");
  await quick.getByRole("button", { name: "Guardar" }).click();
  await expect(quick.getByRole("alert")).toContainText(
    "ya es de «Faja E2E Mercancía E " + tag + "»",
  );
  await quick.getByRole("button", { name: "Cancelar" }).click();
  await expect(lines).not.toContainText("Faja E2E duplicada");
  // Salida: la etiqueta también se reconoce (antes: «Código desconocido»).
  await page.getByRole("tab", { name: /SALIDA/ }).click();
  await scan("R9M-E-" + tag);
  await expect(lines).toContainText("Faja E2E Mercancía E " + tag);
  await expect(page.getByText(/Código desconocido/)).toHaveCount(0);
  await r9Retire(request, headers, [e, f, g]);
});

// Revisión R9 · caja: escaneo, foco, ventas en espera, descuentos y ticket.
// Cada escenario crea sus productos con códigos al azar y los desactiva al final.
const r9Code = (first: string) =>
  first + String(Math.floor(Math.random() * 9000000) + 1000000);
async function r9Headers(request: any) {
  const auth = await (
    await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  // El stock sólo se mueve desde un equipo aprobado (el dueño se aprueba solo).
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E R9 caja", secret: "e2e-r9-caja-" + id },
  });
  expect(registered.ok()).toBe(true);
  return headers;
}
async function r9Product(
  request: any,
  headers: any,
  name: string,
  code: string,
  { price = 1500, sizes }: { price?: number; sizes?: string[] } = {},
) {
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const product = await (
    await request.post("/api/products", {
      headers,
      data: {
        name,
        sku: "R9C-" + code,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        variants: sizes
          ? sizes.map((talla) => ({
              sku: code + "-" + talla,
              barcode: "R9CB-" + code + "-" + talla,
              attributes: { talla },
              price,
              costAvg: 700,
            }))
          : [{ sku: code, barcode: "R9CB-" + code, price, costAvg: 700 }],
      },
    })
  ).json();
  expect(product.id, JSON.stringify(product)).toBeTruthy();
  for (const v of product.variants) {
    const stocked = await request.post("/api/inventory/adjustments", {
      headers,
      data: { variantId: v.id, qty: 5, reason: "E2E R9 caja" },
    });
    expect(stocked.ok()).toBe(true);
  }
  return product;
}
async function r9Pos(page: any) {
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  return page.getByLabel("Buscar productos");
}
async function r9Retire(request: any, headers: any, products: any[]) {
  for (const p of products)
    await request.patch("/api/products/" + p.id, {
      headers,
      data: { active: false },
    });
}
const r9Qty = (page: any, name: string) =>
  page
    .locator(".cart-item", { hasText: name })
    .locator(".quantity-control span");

test("R9-caja-1: el código de un producto inactivo + Enter avisa y no agrega otro que lo contiene", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("4");
  const inactive = await r9Product(
    request,
    headers,
    "Chaleco E2E inactivo " + code,
    code,
  );
  await r9Retire(request, headers, [inactive]);
  const name = "Tribulus E2E " + code + " - 90 cápsulas";
  const other = await r9Product(request, headers, name, r9Code("5"));
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(
    page.getByText("Código no encontrado: " + code + "."),
  ).toBeVisible();
  await expect(page.locator(".cart-items")).not.toContainText(name);
  await expect(search).toHaveValue(code);
  // La lista sigue a la vista para elegirlo a mano si era ése.
  await expect(page.locator(".product-grid")).toContainText(name);
  // Por palabras del nombre, Enter sí agrega el único resultado y limpia.
  await search.fill("tribulus e2e " + code);
  await search.press("Enter");
  await expect(page.getByText(name + " agregado.")).toBeVisible();
  await expect(r9Qty(page, name)).toHaveText("1");
  await expect(search).toHaveValue("");
  await r9Retire(request, headers, [other]);
});

test("R9-caja-2: tras el aviso de código ambiguo, el siguiente escaneo reemplaza el código", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const dup = r9Code("6"),
    nextCode = r9Code("6");
  const a = await r9Product(request, headers, "Faja E2E duplicada " + dup, dup);
  const next = await r9Product(
    request,
    headers,
    "Faja E2E siguiente " + nextCode,
    nextCode,
  );
  // Un dato heredado con el mismo código en otro producto (la API ya no lo
  // deja crear): se simula en la respuesta del catálogo.
  await page.route(
    (url: URL) => url.pathname === "/api/products",
    async (route: any) => {
      const response = await route.fetch();
      const body = await response.json();
      const original = body.items?.find((p: any) => p.id === a.id);
      if (original) {
        body.items.push({
          ...original,
          id: crypto.randomUUID(),
          name: "Faja E2E copia " + dup,
          variants: original.variants.map((v: any) => ({
            ...v,
            id: crypto.randomUUID(),
            sku: "copia-" + v.sku,
            barcode: v.sku,
          })),
        });
        body.total += 1;
      }
      await route.fulfill({ response, json: body });
    },
  );
  const search = await r9Pos(page);
  await search.fill(dup);
  await search.press("Enter");
  await expect(page.getByText(/es de 2 productos/)).toBeVisible();
  await expect(search).toHaveValue(dup);
  // El lector escribe el siguiente código y Enter: reemplaza al anterior.
  await page.keyboard.type(nextCode);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, "Faja E2E siguiente " + nextCode)).toHaveText("1");
  await expect(search).toHaveValue("");
  await expect(page.locator(".cart-items")).not.toContainText("duplicada");
  await r9Retire(request, headers, [a, next]);
});

test("R9-caja-3: después de un clic, el lector agrega el producto escaneado y no repite el que tenía el foco", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const tag = r9Code("7");
  const names = ["uno", "dos", "tres"].map(
    (n) => "Faja E2E foco " + n + " " + tag,
  );
  const codes = names.map(() => r9Code("7"));
  const created: any[] = [];
  for (const [i, name] of names.entries())
    created.push(await r9Product(request, headers, name, codes[i]));
  const sized = "Faja E2E foco tallas " + tag;
  created.push(
    await r9Product(request, headers, sized, r9Code("7"), {
      sizes: ["S", "M"],
    }),
  );
  const search = await r9Pos(page);
  // Clic en la tarjeta y luego el lector (teclas + Enter, sin fill).
  await search.fill("foco uno " + tag);
  await page.locator(".product-card", { hasText: names[0] }).click();
  await expect(r9Qty(page, names[0])).toHaveText("1");
  await page.keyboard.type(codes[1]);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, names[1])).toHaveText("1");
  await expect(r9Qty(page, names[0])).toHaveText("1");
  // Botón + del carrito y luego el lector.
  await page.getByRole("button", { name: "Aumentar " + names[0] }).click();
  await expect(r9Qty(page, names[0])).toHaveText("2");
  await page.keyboard.type(codes[2]);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, names[2])).toHaveText("1");
  await expect(r9Qty(page, names[0])).toHaveText("2");
  // Cerrar la ventana de variantes y luego el lector.
  await search.fill("foco tallas " + tag);
  await page.locator(".product-card", { hasText: sized }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cerrar" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.type(codes[1]);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, names[1])).toHaveText("2");
  await expect(page.locator(".cart-items")).not.toContainText(sized);
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-9 y R9-caja-6: el ticket muestra los descuentos y tras «Nueva venta» el lector agrega", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const [c1, c2, c3] = [r9Code("8"), r9Code("8"), r9Code("8")];
  const one = "Faja E2E ticket uno " + c1,
    two = "Faja E2E ticket dos " + c2,
    three = "Faja E2E ticket tres " + c3;
  const created = [
    await r9Product(request, headers, one, c1),
    await r9Product(request, headers, two, c2, { price: 1000 }),
    await r9Product(request, headers, three, c3, { price: 500 }),
  ];
  const search = await r9Pos(page);
  for (const code of [c1, c2]) {
    await search.fill(code);
    await search.press("Enter");
  }
  await page.getByLabel("Descuento por monto de " + two).fill("100");
  await page.getByLabel("Descuento global").fill("10");
  // 1,500 − 10 % = 1,350 (−150); 1,000 con RD$ 100 y 10 % global = 810 (−190).
  await expect(page.locator(".cart-total")).toContainText("RD$ 2,160.00");
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page
    .getByLabel("Motivo del descuento")
    .fill("Descuentos del ticket E2E");
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  // Factura con el formato de la tienda (docs/tienda/CUADRE_REPORTES_FACTURA.md).
  const ticket = page.locator(".thermal-print");
  await expect(ticket).toContainText("1 X RD$ 1,500.00");
  await expect(ticket).toContainText("Descuento −RD$ 150.00");
  await expect(ticket).toContainText("Descuento −RD$ 190.00");
  await expect(ticket).toContainText("Sub-Total RD$ 2,500.00");
  await expect(ticket).toContainText("Descuento −RD$ 340.00");
  await expect(ticket).toContainText("Total a pagar RD$ 2,160.00");
  // R9-caja-6 A: tras «Nueva venta» el foco no queda perdido.
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.keyboard.type(c3);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, three)).toHaveText("1");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-6: tras elegir una variante o agregar con Enter por palabras, el siguiente escaneo no se pierde", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const tag = r9Code("3");
  const one = "Faja E2E palabras uno " + tag,
    two = "Faja E2E palabras dos " + tag,
    sized = "Faja E2E palabras tallas " + tag;
  const [c1, c2] = [r9Code("3"), r9Code("3")];
  const created = [
    await r9Product(request, headers, one, c1),
    await r9Product(request, headers, two, c2),
    await r9Product(request, headers, sized, r9Code("3"), {
      sizes: ["S", "M"],
    }),
  ];
  const search = await r9Pos(page);
  // B) Enter por palabras abre la ventana de variantes; se elige con el ratón.
  await search.fill("palabras tallas " + tag);
  await search.press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: /^S / }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(r9Qty(page, sized)).toHaveText("1");
  await page.keyboard.type(c1);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, one)).toHaveText("1");
  // C) Enter por palabras agrega el único resultado y limpia el buscador.
  await search.fill("palabras dos " + tag);
  await search.press("Enter");
  await expect(r9Qty(page, two)).toHaveText("1");
  await expect(search).toHaveValue("");
  await page.keyboard.type(c1);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, one)).toHaveText("2");
  // D) Un Enter que no agrega nada lo avisa y deja el texto seleccionado.
  await search.fill("palabras " + tag);
  await search.press("Enter");
  await expect(page.getByText(/No se agregó nada/)).toBeVisible();
  await page.keyboard.type(c2);
  await page.keyboard.press("Enter");
  await expect(r9Qty(page, two)).toHaveText("2");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-4 y R9-caja-7: la venta en espera conserva descuentos y cliente (también con F8)", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const [c1, c2] = [r9Code("2"), r9Code("2")];
  const one = "Faja E2E espera uno " + c1,
    two = "Faja E2E espera dos " + c2;
  const created = [
    await r9Product(request, headers, one, c1),
    await r9Product(request, headers, two, c2, { price: 1000 }),
  ];
  const customerName = "Cliente E2E espera " + c1;
  const customer = await (
    await request.post("/api/customers", {
      headers,
      data: { name: customerName, phone: "8095550000" },
    })
  ).json();
  expect(customer.id, JSON.stringify(customer)).toBeTruthy();
  const search = await r9Pos(page);
  await search.fill(c1);
  await search.press("Enter");
  await page.getByLabel("Descuento por monto de " + one).fill("100");
  await page.getByLabel("Descuento global").fill("5");
  await expect(page.locator(".cart-total")).toContainText("RD$ 1,330.00");
  await page.keyboard.press("F4");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: new RegExp(customerName) })
    .click();
  await expect(page.locator(".customer-selector")).toContainText(customerName);
  await page.keyboard.press("F8");
  await expect(page.getByText("Venta guardada en espera.")).toBeVisible();
  await expect(page.locator(".cart-items")).not.toContainText(one);
  // Otra clienta con 10 % global. Al recuperar la venta en espera, la actual
  // queda en espera y la recuperada vuelve con sus descuentos y su cliente.
  await search.fill(c2);
  await search.press("Enter");
  await page.getByLabel("Descuento global").fill("10");
  await expect(page.locator(".cart-total")).toContainText("RD$ 900.00");
  page.once("dialog", (d: any) => d.accept());
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "En espera" })
    .click();
  await page.locator(".held-row").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".cart-items")).toContainText(one);
  await expect(page.locator(".cart-items")).not.toContainText(two);
  await expect(page.getByLabel("Descuento global")).toHaveValue("5");
  await expect(page.getByLabel("Descuento por monto de " + one)).toHaveValue(
    "100",
  );
  await expect(page.locator(".cart-total")).toContainText("RD$ 1,330.00");
  await expect(page.locator(".customer-selector")).toContainText(customerName);
  // La venta de la otra clienta no se perdió: quedó en espera con su 10 %.
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "En espera" })
    .click();
  await page.locator(".held-row").first().click();
  await expect(page.locator(".cart-items")).toContainText(two);
  await expect(page.getByLabel("Descuento global")).toHaveValue("10");
  await expect(page.locator(".cart-total")).toContainText("RD$ 900.00");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-5: recuperar una venta en espera avisa si falta un producto y no pierde el carrito actual", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const [c1, c2, c3] = [r9Code("1"), r9Code("1"), r9Code("1")];
  const keep = "Faja E2E recuperar sigue " + c1,
    gone = "Faja E2E recuperar inactiva " + c2,
    current = "Faja E2E recuperar actual " + c3;
  const created = [
    await r9Product(request, headers, keep, c1),
    await r9Product(request, headers, gone, c2),
    await r9Product(request, headers, current, c3),
  ];
  const heldWith = async (product: any) =>
    ((await (await request.get("/api/quotes", { headers })).json()) as any[])
      .filter((q) =>
        q.items.some((i: any) => i.variantId === product.variants[0].id),
      )
      .map((q) => q.id);
  let search = await r9Pos(page);
  for (const code of [c1, c2]) {
    await search.fill(code);
    await search.press("Enter");
  }
  await page
    .locator(".cart-bottom-actions")
    .getByRole("button", { name: "En espera" })
    .click();
  await expect(page.getByText("Venta guardada en espera.")).toBeVisible();
  expect(await heldWith(created[1])).toHaveLength(1);
  // El gerente desactiva uno de los productos y la caja recarga su catálogo.
  await request.patch("/api/products/" + created[1].id, {
    headers,
    data: { active: false },
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  search = page.getByLabel("Buscar productos");
  await search.fill(c3);
  await search.press("Enter");
  await expect(r9Qty(page, current)).toHaveText("1");
  // Primero se cancela el aviso: no cambia nada.
  const messages: string[] = [];
  page.once("dialog", (d: any) => {
    messages.push(d.message());
    d.dismiss();
  });
  await page
    .locator(".heading-actions")
    .getByRole("button", { name: "En espera" })
    .click();
  await page.locator(".held-row").first().click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain(gone);
  expect(messages[0]).toContain("venta actual");
  await expect(r9Qty(page, current)).toHaveText("1");
  expect(await heldWith(created[1])).toHaveLength(1);
  // Al aceptar, la venta actual queda en espera y se recupera lo disponible.
  page.once("dialog", (d: any) => d.accept());
  await page.locator(".held-row").first().click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(r9Qty(page, keep)).toHaveText("1");
  await expect(page.locator(".cart-items")).not.toContainText(gone);
  await expect(page.locator(".cart-items")).not.toContainText(current);
  expect(await heldWith(created[1])).toHaveLength(0);
  const saved = await heldWith(created[2]);
  expect(saved).toHaveLength(1);
  await request.post("/api/quotes/" + saved[0] + "/convert", {
    headers,
    data: {},
  });
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-8: el descuento de línea no pasa del 100 % ni del importe de la línea", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("9");
  const name = "Faja E2E límite " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  const percent = page.getByLabel("Descuento de " + name, { exact: true });
  const amount = page.getByLabel("Descuento por monto de " + name, {
    exact: true,
  });
  const total = page.locator(".cart-total");
  // Un valor imposible no se aplica: queda el anterior y se avisa (antes se
  // llevaba al 100 % y la línea quedaba gratis; revisión de R9-caja-8).
  await percent.fill("15");
  await percent.fill("150");
  await expect(page.getByText("llega hasta el 100 %")).toBeVisible();
  await expect(percent).toHaveValue("15");
  await expect(total).toContainText("RD$ 1,275.00");
  await percent.fill("0");
  await amount.fill("2000");
  await expect(page.getByText(/no puede pasar del importe/)).toBeVisible();
  await expect(amount).toHaveValue("0");
  await expect(total).toContainText("RD$ 1,500.00");
  await page.getByRole("button", { name: "Aumentar " + name }).click();
  await amount.fill("2500");
  await expect(total).toContainText("RD$ 500.00");
  // Al bajar la cantidad, el monto se ajusta al nuevo importe de la línea.
  await page.getByRole("button", { name: "Reducir " + name }).click();
  await expect(page.getByText(/bajó a RD\$ 1,500.00/)).toBeVisible();
  await expect(amount).toHaveValue("1500");
  await expect(total).toContainText("RD$ 0.00");
  await expect(total).not.toContainText("-");
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, [product]);
});

// Revisión R9 · dinero: abonos por transferencia pendientes y centavos.
test("R9-dinero-3-ui: un abono por transferencia que no llegó se rechaza desde la venta y la devolución pasa", async ({
  page,
}) => {
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  const call = async (
    path: string,
    data?: any,
    method = data ? "POST" : "GET",
  ) => {
    const r = await page.request.fetch("/api" + path, {
      method,
      headers,
      ...(data ? { data } : {}),
    });
    expect(r.ok(), path + " " + (await r.text())).toBe(true);
    return r.json();
  };
  const settings = await call("/settings");
  const code = r9Code("7");
  let product: any;
  try {
    await call(
      "/settings",
      { ...settings, allowCreditSales: true, creditApprovalThreshold: 100000 },
      "PUT",
    );
    product = await r9Product(
      page.request,
      headers,
      "Faja E2E crédito " + code,
      code,
      { price: 500 },
    );
    await ensureCash(page);
    const me = await call("/auth/me");
    const session = (await call("/cash-sessions")).find(
      (s: any) => !s.closedAt && s.userId === me.id,
    );
    const customer = await call("/customers", {
      name: "QA E2E crédito " + code,
      creditLimit: 5000,
    });
    // Venta de 1000 a crédito y abono de 600 por transferencia sin verificar.
    const sale = await call("/sales", {
      offlineUuid: crypto.randomUUID(),
      cashSessionId: session.id,
      customerId: customer.id,
      creditDueDate: "2030-01-01T12:00:00.000Z",
      items: [{ variantId: product.variants[0].id, qty: 2 }],
      payments: [{ method: "credit", amount: 1000 }],
    });
    await call("/sales/" + sale.id + "/installments", {
      offlineUuid: crypto.randomUUID(),
      cashSessionId: session.id,
      method: "transfer",
      amount: 600,
      bank: "E2E Banco",
      reference: "E2E-" + code,
    });
    await page.getByRole("button", { name: "Ventas", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: sale.number });
    const giveBack = async () => {
      await row.getByRole("button", { name: "Devolver", exact: true }).click();
      const form = page.getByRole("dialog");
      await form.getByLabel("Artículo a devolver").selectOption({ index: 1 });
      await form.getByLabel("Cantidad").fill("1");
      await form.getByLabel("Motivo").fill("E2E devuelve una faja");
      await form.getByRole("button", { name: "Guardar", exact: true }).click();
    };
    // La devolución de 500 dejaría la deuda por debajo del abono pendiente.
    await giveBack();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
      "Verifica o rechaza primero",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    // La transferencia no llegó: se rechaza desde el detalle de la venta.
    await row.getByRole("button", { name: "Ver " + sale.number }).click();
    const transfer = page
      .getByRole("dialog", { name: sale.number })
      .locator(".payment-list", { hasText: "Transferencia" });
    await expect(transfer).toContainText("Pendiente de verificar");
    await transfer
      .getByRole("button", { name: "Rechazar", exact: true })
      .click();
    const confirm = page.getByRole("dialog", {
      name: /Rechazar transferencia/,
    });
    await confirm
      .getByLabel("Motivo obligatorio")
      .fill("E2E la transferencia no llegó");
    await confirm
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await expect(
      page.getByText("Transferencia rechazada.", { exact: true }),
    ).toBeVisible();
    // Queda como rechazada y ya no ofrece «Verificar».
    await row.getByRole("button", { name: "Ver " + sale.number }).click();
    await expect(transfer).toContainText("Rechazada");
    await expect(
      transfer.getByRole("button", { name: "Verificar" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    // Ahora la devolución pasa y descuenta la deuda.
    await giveBack();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const after = (await call("/sales")).find((s: any) => s.id === sale.id);
    expect(Number(after.creditBalance)).toBe(500);
    expect(
      after.payments.find((p: any) => p.entryType === "installment").status,
    ).toBe("rejected");
  } finally {
    await call("/settings", settings, "PUT");
    if (product) await r9Retire(page.request, headers, [product]);
  }
});

test("R9-dinero-5-pos: un descuento por monto con 3 decimales se cobra en línea y se sincroniza sin conexión", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("6");
  const name = "Faja E2E centavos " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  const sell = async () => {
    await selectNamedCustomer(page);
    await search.fill(code);
    await search.press("Enter");
    await page
      .getByLabel("Descuento por monto de " + name, { exact: true })
      .fill("1.005");
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByLabel("Motivo del descuento").fill("Precisión decimal E2E");
    await page.getByRole("button", { name: "Finalizar venta" }).click();
  };
  // En línea: la API acepta el descuento con el mismo cálculo de la caja.
  await sell();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  // Sin conexión: la venta ya entregada se sincroniza, no queda en conflicto.
  await context.setOffline(true);
  await expect(page.locator(".connection")).toContainText("Offline");
  await sell();
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await context.setOffline(false);
  await expect(page.locator(".connection")).toContainText("En línea");
  await expect(async () => {
    const count = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("fitstore-pos-v1");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      return await new Promise<number>((resolve, reject) => {
        const r = db.transaction("sales").objectStore("sales").count();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    });
    expect(count).toBe(0);
  }).toPass({ timeout: 20000 });
  await r9Retire(request, headers, [product]);
});

// Revisión R9 · caja (segunda vuelta): escaneo con el foco en un descuento y
// códigos de modelo que forman parte del nombre.
test("R9-caja-3/8 revisión: un escaneo con el foco en un campo de descuento agrega el producto y no cambia el descuento", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const codes = [r9Code("5"), r9Code("5"), r9Code("5"), r9Code("5")];
  const names = ["uno", "dos", "tres", "cuatro"].map(
    (n, i) => "Faja E2E ráfaga " + n + " " + codes[i],
  );
  const created: any[] = [];
  for (const [i, name] of names.entries())
    created.push(await r9Product(request, headers, name, codes[i]));
  const search = await r9Pos(page);
  await search.fill(codes[0]);
  await search.press("Enter");
  await expect(r9Qty(page, names[0])).toHaveText("1");
  // La cajera escribe el descuento a mano (el foco queda en el campo) y
  // luego el lector envía otro código: teclas seguidas + Enter.
  const typeByHand = async (field: any, value: string) => {
    await field.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type(value, { delay: 150 });
    await expect(field).toHaveValue(value);
  };
  const scanner = async (code: string) => {
    await page.keyboard.type(code);
    await page.keyboard.press("Enter");
  };
  const percent = page.getByLabel("Descuento de " + names[0], { exact: true });
  await typeByHand(percent, "10");
  await scanner(codes[1]);
  await expect(r9Qty(page, names[1])).toHaveText("1");
  await expect(percent).toHaveValue("10");
  await expect(search).toHaveValue("");
  // Lo mismo en el descuento por monto (RD$) de otra línea.
  const amount = page.getByLabel("Descuento por monto de " + names[1], {
    exact: true,
  });
  await typeByHand(amount, "100");
  await scanner(codes[2]);
  await expect(r9Qty(page, names[2])).toHaveText("1");
  await expect(amount).toHaveValue("100");
  // Y en el descuento global.
  const global = page.getByLabel("Descuento global");
  await typeByHand(global, "5");
  await scanner(codes[3]);
  await expect(r9Qty(page, names[3])).toHaveText("1");
  await expect(global).toHaveValue("5");
  await expect(percent).toHaveValue("10");
  await expect(amount).toHaveValue("100");
  // 1,500 con 10 % y 5 % = 1,282.50; 1,500 − 100 con 5 % = 1,330;
  // 1,500 con 5 % = 1,425 (dos veces).
  await expect(page.locator(".cart-total")).toContainText("RD$ 5,462.50");
  // Ningún aviso de límite: los dígitos del código no se tomaron como descuento.
  await expect(page.getByText(/llega hasta el 100|no puede pasar/)).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

test("R9-caja-1 revisión: un código de modelo del nombre (como «a40» o «275n») + Enter agrega su único producto", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const pick = (n: number) => Math.floor(Math.random() * n);
  const letter = () => "ABCDEFGHJKLMNPRSTUVWXYZ"[pick(23)];
  // Como «Macrilan A40» o «MOIRA … 275N»: letras y menos de 5 dígitos.
  const model = "Q" + letter() + String(100 + pick(900)),
    shade = String(100 + pick(900)) + "N" + letter();
  const brush = "Pincel E2E " + model,
    base = "Base E2E tono " + shade;
  const created = [
    await r9Product(request, headers, brush, r9Code("4")),
    await r9Product(request, headers, base, r9Code("4")),
  ];
  const inactiveCode = r9Code("4");
  const inactive = await r9Product(
    request,
    headers,
    "Chaleco E2E inactivo " + inactiveCode,
    inactiveCode,
  );
  await r9Retire(request, headers, [inactive]);
  const search = await r9Pos(page);
  await search.fill(model.toLowerCase());
  await search.press("Enter");
  await expect(page.getByText(brush + " agregado.")).toBeVisible();
  await expect(r9Qty(page, brush)).toHaveText("1");
  await expect(search).toHaveValue("");
  await search.fill(shade.toLowerCase());
  await search.press("Enter");
  await expect(page.getByText(base + " agregado.")).toBeVisible();
  await expect(r9Qty(page, base)).toHaveText("1");
  // Un número (el código de un producto desactivado) sigue avisando.
  await search.fill(inactiveCode);
  await search.press("Enter");
  await expect(
    page.getByText("Código no encontrado: " + inactiveCode + "."),
  ).toBeVisible();
  await expect(page.locator(".cart-item")).toHaveCount(2);
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, created);
});

// Revisión R9 · offline: venta sin internet, stock local, precios cambiados,
// catálogo por páginas y cierre por inactividad.
async function r9LocalSales(page: any) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("fitstore-pos-v1");
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return await new Promise<any[]>((resolve, reject) => {
      const r = db.transaction("sales").objectStore("sales").getAll();
      r.onsuccess = () =>
        resolve(
          r.result.map((s: any) => ({ status: s.status, message: s.message })),
        );
      r.onerror = () => reject(r.error);
    });
  });
}
async function r9Charge(page: any) {
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
}
async function r9Stock(request: any, headers: any, product: any) {
  const row = await (
    await request.get("/api/products/" + product.id, { headers })
  ).json();
  return Number(row.variants[0].stock);
}

test("R9-offline-1: sin internet pero con la red local activa, la caja sigue vendiendo y al recargar no pide la contraseña", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E sin internet " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  // Se cae internet: el router sigue encendido y navigator.onLine sigue en true.
  const api = (url: URL) => url.pathname.startsWith("/api/");
  await context.route(api, (route: any) => route.abort("internetdisconnected"));
  expect(await page.evaluate(() => navigator.onLine)).toBe(true);
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(page.locator(".connection")).toContainText("Offline");
  // La lista sigue a la vista con el stock ya descontado (antes: «Failed to
  // fetch · Reintentar» en lugar de las tarjetas).
  await expect(page.locator(".error-panel")).toHaveCount(0);
  await search.fill(code);
  await expect(page.locator(".product-card", { hasText: name })).toContainText(
    "4 en stock",
  );
  // Al recargar entra con la sesión guardada y vende con el catálogo local.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible();
  await expect(page.locator(".connection")).toContainText("Offline");
  await search.fill(code);
  await expect(page.locator(".product-card", { hasText: name })).toContainText(
    "4 en stock",
  );
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  expect(await r9LocalSales(page)).toHaveLength(2);
  // Vuelve internet: la caja lo nota sola y sincroniza las dos ventas una vez.
  await context.unroute(api);
  await expect(page.locator(".connection")).toContainText("En línea", {
    timeout: 20000,
  });
  await expect(async () => {
    expect(await r9LocalSales(page)).toEqual([]);
  }).toPass({ timeout: 20000 });
  expect(await r9Stock(request, headers, product)).toBe(3);
  await r9Retire(request, headers, [product]);
});

test("R9-offline-1: si la API responde 502 o 504 al cobrar, la venta queda guardada y se sincroniza una sola vez", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E proxy caído " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  const sales = (url: URL) => url.pathname === "/api/sales";
  // 502: Nginx no llega a la API; la venta no se registró.
  await context.route(sales, (route: any) =>
    route.request().method() === "POST"
      ? route.fulfill({ status: 502, body: "<html>502 Bad Gateway</html>" })
      : route.continue(),
  );
  await search.fill(code);
  await search.press("Enter");
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await context.unroute(sales);
  await expect(async () => {
    expect(await r9LocalSales(page)).toEqual([]);
  }).toPass({ timeout: 20000 });
  expect(await r9Stock(request, headers, product)).toBe(4);
  // 504: la venta sí llegó, pero la respuesta no. Al sincronizar no se repite.
  await expect(page.locator(".connection")).toContainText("En línea", {
    timeout: 20000,
  });
  await context.route(sales, async (route: any) => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fetch();
    await route.fulfill({ status: 504, body: "Gateway Timeout" });
  });
  await search.fill(code);
  await search.press("Enter");
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await context.unroute(sales);
  await expect(async () => {
    expect(await r9LocalSales(page)).toEqual([]);
  }).toPass({ timeout: 20000 });
  expect(await r9Stock(request, headers, product)).toBe(3);
  await r9Retire(request, headers, [product]);
});

test("R9-offline-2: una venta sin conexión descuenta el stock local y no deja vender otra vez las mismas unidades", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E stock local " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  await context.setOffline(true);
  await expect(page.locator(".connection")).toContainText("Offline");
  // Las 5 unidades del producto, sin conexión.
  for (let i = 0; i < 5; i++) {
    await search.fill(code);
    await search.press("Enter");
    await expect(r9Qty(page, name)).toHaveText(String(i + 1));
  }
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  // El catálogo de la caja ya no las tiene: no se pueden cobrar dos veces.
  await search.fill(code);
  await expect(page.locator(".product-card", { hasText: name })).toContainText(
    "0 en stock",
  );
  await search.press("Enter");
  await expect(
    page.getByText("No hay suficiente stock de " + name + " (quedan 0)."),
  ).toBeVisible();
  await expect(page.locator(".cart-item")).toHaveCount(0);
  await context.setOffline(false);
  await expect(page.locator(".connection")).toContainText("En línea");
  await expect(async () => {
    expect(await r9LocalSales(page)).toEqual([]);
  }).toPass({ timeout: 20000 });
  expect(await r9Stock(request, headers, product)).toBe(0);
  await r9Retire(request, headers, [product]);
});

test("R9-offline-3: si el precio o una promoción cambian con el producto en el carrito, la caja toma el nuevo y deja cobrar", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E precio nuevo " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  // El gerente cambia el precio desde otro equipo.
  const changed = await request.patch(
    "/api/variants/" + product.variants[0].id,
    { headers, data: { price: 1700 } },
  );
  expect(changed.ok()).toBe(true);
  await r9Charge(page);
  const checkout = page.getByRole("dialog", { name: "Todo listo para cobrar" });
  // Se dice qué cambió y el cobro ya muestra el total nuevo.
  await expect(checkout.getByRole("alert")).toContainText(
    name + ": RD$ 1,500.00 → RD$ 1,700.00",
  );
  await expect(checkout.locator(".payment-total h2")).toContainText(
    "RD$ 1,700.00",
  );
  await page.getByLabel("Monto del pago").fill("200");
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  // Una promoción creada en otro equipo con el producto en el carrito.
  await search.fill(code);
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  const promotion = await (
    await request.post("/api/promotions", {
      headers,
      data: {
        name: "E2E R9 offline " + code,
        type: "percent",
        value: 10,
        startsAt: new Date(Date.now() - 60000).toISOString(),
        endsAt: new Date(Date.now() + 86400000).toISOString(),
        scope: { productId: product.id },
      },
    })
  ).json();
  expect(promotion.id).toBeTruthy();
  try {
    await r9Charge(page);
    await expect(checkout.getByRole("alert")).toContainText(
      /promociones cambiaron/,
    );
    await expect(checkout.locator(".payment-total h2")).toContainText(
      "RD$ 1,530.00",
    );
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
  } finally {
    await request.patch("/api/promotions/" + promotion.id, {
      headers,
      data: { active: false },
    });
    await r9Retire(request, headers, [product]);
  }
});

test("R9-offline-4: si el catálogo cambia entre una página y otra, ningún producto queda repetido", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E página " + code;
  const product = await r9Product(request, headers, name, code);
  const mine = (
    await (
      await request.get("/api/products?limit=200&q=" + code, { headers })
    ).json()
  ).items.find((p: any) => p.id === product.id);
  expect(mine).toBeTruthy();
  // Entre la página 1 y la 2 se crea un producto que ordena antes: el último
  // de la página 1 vuelve a llegar al comienzo de la 2.
  await page.route(
    (url: URL) =>
      url.pathname === "/api/products" &&
      url.searchParams.get("limit") === "200",
    async (route: any) => {
      // Siempre se parte de la página 1 real (con el catálogo de prueba
      // cabe en una sola página).
      const url = new URL(route.request().url());
      const pageNo = Number(url.searchParams.get("page"));
      url.searchParams.set("page", "1");
      const response = await route.fetch({ url: url.toString() });
      const body = await response.json();
      const others = body.items
        .filter((p: any) => p.id !== product.id)
        .slice(0, 199);
      const fillers = Array.from({ length: 199 - others.length }, (_, i) => ({
        ...others[0],
        id: crypto.randomUUID(),
        name: "Relleno E2E " + code + " " + i,
        sku: "R9F-" + code + "-" + i,
        variants: others[0].variants.map((v: any, j: number) => ({
          ...v,
          id: crypto.randomUUID(),
          sku: "r9f-" + code + "-" + i + "-" + j,
          barcode: "R9FB-" + code + "-" + i + "-" + j,
        })),
      }));
      const items =
        pageNo === 1
          ? [...others, ...fillers, mine]
          : pageNo === 2
            ? [mine]
            : [];
      await route.fulfill({ response, json: { ...body, items, total: 201 } });
    },
  );
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(page.getByText(name + " agregado.")).toBeVisible();
  await expect(r9Qty(page, name)).toHaveText("1");
  await search.fill(name);
  await expect(page.locator(".product-card", { hasText: name })).toHaveCount(1);
  await page.getByRole("button", { name: "Limpiar", exact: true }).click();
  await r9Retire(request, headers, [product]);
});

test("R9-offline-5: el cierre por inactividad revoca la sesión y al recargar se pide la contraseña", async ({
  page,
  context,
  request,
}) => {
  await page.clock.install();
  await login(page);
  const refresh = (await context.cookies()).find(
    (c: any) => c.name === "fitstore_refresh",
  );
  expect(refresh).toBeTruthy();
  // Pasan más de 30 minutos sin tocar el teclado ni el ratón. En el servidor
  // la sesión sigue activa (otra pantalla la consultaba en segundo plano).
  await page.clock.fastForward("31:00");
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
  await expect(page.getByText("Sesión cerrada por inactividad.")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toHaveCount(0);
  // La cookie de renovación de esa sesión ya no sirve en el servidor.
  const renewed = await request.post("/api/auth/refresh", {
    headers: { Cookie: "fitstore_refresh=" + refresh!.value },
  });
  expect(renewed.status()).toBe(400);
});

test("R9-offline-5: una pestaña sin uso no cierra la sesión de otra pestaña activa del mismo equipo", async ({
  context,
}) => {
  await context.clock.install();
  const active = await context.newPage();
  await login(active);
  const idle = await context.newPage();
  await idle.goto("/");
  await expect(idle.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  // La cajera trabaja en una pestaña; la otra queda sin tocar.
  await context.clock.fastForward("20:00");
  await active.keyboard.press("Shift");
  await context.clock.fastForward("15:00");
  await idle.waitForTimeout(1500);
  for (const page of [idle, active]) {
    await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar a mi tienda" }),
    ).toHaveCount(0);
  }
  // La sesión del servidor sigue viva: la pestaña activa consulta sin problema.
  await active.getByRole("button", { name: "Productos", exact: true }).click();
  await expect(active.locator(".main-content h1")).toBeVisible();
  await expect(active.locator(".error-panel")).toHaveCount(0);
});

test("R9-offline-3 revisión: si un precio cambia mientras el canal de avisos está caído, al reconectar se avisa qué precio cambió", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E precio al reconectar " + code;
  const product = await r9Product(request, headers, name, code);
  // El canal de avisos (SSE) vuelve después del cambio de precio: al
  // reconectar, el servidor manda «ready» y la caja relee el catálogo.
  let reconnect!: () => void;
  const back = new Promise<void>((resolve) => (reconnect = resolve));
  let first = true;
  const events = (url: URL) => url.pathname === "/api/events";
  await context.route(events, async (route: any) => {
    if (!first) return route.continue();
    first = false;
    await back;
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: "event: ready\ndata: {}\n\n",
    });
  });
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  const changed = await request.patch(
    "/api/variants/" + product.variants[0].id,
    { headers, data: { price: 1700 } },
  );
  expect(changed.ok()).toBe(true);
  reconnect();
  // Antes el total del carrito cambiaba sin ningún aviso.
  await expect(
    page.getByText(
      "Precio actualizado: " + name + ": RD$ 1,500.00 → RD$ 1,700.00",
    ),
  ).toBeVisible();
  await r9Charge(page);
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await context.unroute(events);
  await r9Retire(request, headers, [product]);
});

test("R9-offline-1 revisión: un crédito sin respuesta queda pendiente y se confirma sin duplicarse", async ({
  page,
  request,
  context,
}) => {
  const headers = await r9Headers(request);
  const settings = await (
    await request.get("/api/settings", { headers })
  ).json();
  const code = r9Code("7");
  const name = "Faja E2E crédito sin respuesta " + code;
  const product = await r9Product(request, headers, name, code, {
    price: 500,
  });
  const sales = (url: URL) => url.pathname === "/api/sales";
  try {
    const allowed = await request.put("/api/settings", {
      headers,
      data: { ...settings, allowCreditSales: true },
    });
    expect(allowed.ok()).toBe(true);
    const customer = await (
      await request.post("/api/customers", {
        headers,
        data: { name: "E2E crédito " + code, creditLimit: 5000 },
      })
    ).json();
    expect(customer.id).toBeTruthy();
    const search = await r9Pos(page);
    await search.fill(code);
    await search.press("Enter");
    await expect(r9Qty(page, name)).toHaveText("1");
    await page.keyboard.press("F4");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: customer.name })
      .click();
    const credit = async () => {
      await page.getByRole("button", { name: /Cobrar/ }).click();
      await page
        .getByRole("button", {
          name: "Crédito / contraentrega",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: "Agregar pago", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Finalizar venta", exact: true })
        .click();
    };
    // 504: el crédito sí quedó registrado, pero la respuesta no llegó.
    await context.route(sales, async (route: any) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await route.fulfill({ status: 504, body: "Gateway Timeout" });
    });
    await credit();
    const checkout = page.getByRole("dialog", {
      name: "Todo listo para cobrar",
    });
    // Antes: «Las ventas a crédito y notas de crédito requieren conexión.»,
    // como si no se hubiera cobrado.
    await expect(checkout.getByRole("alert")).toContainText(
      "pendiente de confirmación",
    );
    // La caja conserva el UUID y confirma sola al volver la conexión; no se
    // pide a la cajera que cobre otra vez una operación ambigua.
    await context.unroute(sales);
    await expect(page.locator(".connection")).toContainText("En línea", {
      timeout: 20000,
    });
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    // Una sola venta y una sola deuda del cliente.
    const sold = (
      await (await request.get("/api/sales", { headers })).json()
    ).filter((s: any) => s.customerId === customer.id);
    expect(sold).toHaveLength(1);
    expect(Number(sold[0].creditBalance)).toBe(500);
    expect(await r9Stock(request, headers, product)).toBe(4);
  } finally {
    await context.unroute(sales);
    await request.put("/api/settings", { headers, data: settings });
    await r9Retire(request, headers, [product]);
  }
});

test("R9-offline-1 revisión: si el servidor no responde (paquetes perdidos), la venta se guarda en segundos y al recargar no se queda cargando", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(90000);
  const headers = await r9Headers(request);
  const code = r9Code("7");
  const name = "Faja E2E sin respuesta " + code;
  const product = await r9Product(request, headers, name, code);
  const search = await r9Pos(page);
  await search.fill(code);
  await search.press("Enter");
  await expect(r9Qty(page, name)).toHaveText("1");
  // Internet cortado con el router encendido: las peticiones no fallan, se
  // quedan sin respuesta (antes «Finalizar venta» esperaba minutos).
  const api = (url: URL) => url.pathname.startsWith("/api/");
  await context.route(api, () => new Promise(() => {}));
  await r9Charge(page);
  await expect(page.getByText(/Guardada en este dispositivo/)).toBeVisible({
    timeout: 20000,
  });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  // Al recargar entra con la sesión guardada (antes se quedaba cargando).
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Punto de venta" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(page.locator(".connection")).toContainText("Offline");
  await context.unroute(api);
  await expect(async () => {
    expect(await r9LocalSales(page)).toEqual([]);
  }).toPass({ timeout: 30000 });
  expect(await r9Stock(request, headers, product)).toBe(4);
  await r9Retire(request, headers, [product]);
});

// Prueba de aceptación de la caja, pasos 04, 35, 36 y 37 (mercancía).
async function mercProduct(request: any, headers: any, category: string) {
  const cats = await (await request.get("/api/categories", { headers })).json();
  const suffix = Date.now().toString(36) + crypto.randomUUID().slice(0, 4);
  const created = await request.post("/api/products", {
    headers,
    data: {
      name: "E2E Merc " + suffix,
      sku: "E2E-AM-" + suffix,
      categoryId: cats.find((c: any) => c.name === category).id,
      variants: [
        {
          sku: "E2E-AMV-" + suffix,
          barcode: "E2E-AMB-" + suffix,
          costAvg: 100,
          price: 1500,
        },
      ],
    },
  });
  expect(created.ok()).toBe(true);
  return created.json();
}
const mercNcf = () =>
  "B01" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
test("Aceptación 35-37 en el celular: Mercancía recibe una orden con documento y dañados, y el historial abre su comprobante", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.setViewportSize({ width: 390, height: 844 });
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  const p = await mercProduct(request, headers, "Ropa deportiva");
  const supplier = (
    await (await request.get("/api/suppliers", { headers })).json()
  )[0];
  const order = await (
    await request.post("/api/purchase-orders", {
      headers,
      data: {
        supplierId: supplier.id,
        items: [{ variantId: p.variants[0].id, qty: 5, unitCost: 100 }],
      },
    })
  ).json();
  await page
    .locator(".goods-mobile-bar")
    .getByRole("button", { name: "Mercancía", exact: true })
    .click();
  await page.getByLabel("Proveedor (opcional)").selectOption(supplier.id);
  await page.getByLabel("Orden de compra (opcional)").selectOption(order.id);
  // Llegaron 3 buenas y 1 dañada de 5: queda 1 pendiente.
  await page.getByLabel("Cantidad", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Dañados o rechazados" }).click();
  await page.getByLabel("Unidades dañadas o rechazadas").fill("1");
  await page.getByLabel("Motivo del daño o rechazo").selectOption("Dañado");
  await expect(page.locator(".goods-line")).toContainText("Pendiente 1");
  const ncf = mercNcf();
  await page.getByText("Documento del proveedor (opcional)").click();
  await page.getByLabel("Número de factura").fill("FAC-E2E");
  await page.getByLabel("NCF del proveedor").fill(ncf);
  await page.getByLabel("Condición de pago").selectOption("credit");
  await page.getByLabel("Días de crédito").fill("15");
  await page
    .getByRole("button", { name: "Confirmar entrada", exact: true })
    .click();
  await expect(page.getByText("Mercancía registrada.")).toBeVisible();
  // El stock sube sólo por lo bueno; lo dañado cierra lo pendiente.
  const orders = await (
    await request.get("/api/purchase-orders", { headers })
  ).json();
  const item = orders.find((o: any) => o.id === order.id).items[0];
  expect([Number(item.receivedQty), Number(item.damagedQty)]).toEqual([3, 1]);
  const fetched = await (
    await request.get("/api/products/" + p.id, { headers })
  ).json();
  expect(Number(fetched.variants[0].stock)).toBe(3);
  // Historial en el celular y su comprobante.
  const row = page.locator(".receipt-history li").filter({ hasText: ncf });
  await expect(row).toContainText(supplier.name);
  await expect(row).toContainText("1 dañada");
  await row.getByRole("button", { name: "Ver" }).click();
  const receipt = page.getByRole("dialog", {
    name: "Comprobante de recepción",
  });
  await expect(receipt).toContainText(p.name);
  await expect(receipt).toContainText("FAC-E2E");
  await expect(receipt).toContainText(ncf);
  await expect(receipt).toContainText("Crédito 15 días");
  await expect(receipt).toContainText("Dañado");
  await expect(receipt).toContainText(order.number);
  await expect(receipt).toContainText("Valeria Rivera");
  // Sin desplazamiento horizontal en 390 px.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
  await request.patch("/api/products/" + p.id, {
    headers,
    data: { active: false },
  });
});
test("Aceptación 35 y 37 en la laptop: Compras › Recepciones completa el documento después y descarga el Excel", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  const p = await mercProduct(request, headers, "Ropa deportiva");
  const supplier = (
    await (await request.get("/api/suppliers", { headers })).json()
  )[0];
  // Se recibe por la API sin documento (no frena la recepción).
  const id = crypto.randomUUID();
  const terminal = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E recepción", secret: "e2e-recepcion-" + id },
  });
  expect(terminal.ok()).toBe(true);
  const order = await (
    await request.post("/api/purchase-orders", {
      headers,
      data: {
        supplierId: supplier.id,
        items: [{ variantId: p.variants[0].id, qty: 2, unitCost: 100 }],
      },
    })
  ).json();
  const received = await request.post(
    "/api/purchase-orders/" + order.id + "/receive",
    {
      headers,
      data: {
        operationId: crypto.randomUUID(),
        items: [{ itemId: order.items[0].id, qty: 2 }],
      },
    },
  );
  expect(received.ok()).toBe(true);
  await page.getByRole("button", { name: "Compras", exact: true }).click();
  await page.getByRole("button", { name: "Recepciones", exact: true }).click();
  const row = page
    .locator(".receipt-history li")
    .filter({ hasText: order.number });
  await expect(row).toContainText("Sin documento");
  await row.getByRole("button", { name: "Ver" }).click();
  const dialog = page.getByRole("dialog", { name: "Comprobante de recepción" });
  await expect(dialog).toContainText(p.name);
  await dialog.getByRole("button", { name: "Completar documento" }).click();
  const ncf = mercNcf();
  await dialog.getByLabel("NCF del proveedor").fill(ncf);
  await dialog.getByLabel("Número de factura").fill("FAC-LAPTOP");
  await dialog.getByRole("button", { name: "Guardar documento" }).click();
  await expect(dialog).toContainText(ncf);
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(row).toContainText(ncf);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel para la contable" }).click();
  expect((await download).suggestedFilename()).toMatch(/^compras-.*\.xlsx$/);
  expect(errors).toEqual([]);
  await request.patch("/api/products/" + p.id, {
    headers,
    data: { active: false },
  });
});
test("Aceptación 04: Mercancía y la caja muestran como stock sólo lo vendible y lo vencido aparte", async ({
  page,
  request,
}) => {
  const token = await login(page);
  const headers = { Authorization: "Bearer " + token };
  const p = await mercProduct(request, headers, "Suplementos");
  const id = crypto.randomUUID();
  await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E vencidos", secret: "e2e-vencidos-" + id },
  });
  for (const [lotNumber, qty] of [
    ["E2E-VIGENTE", 3],
    ["E2E-VENCIDO", 2],
  ] as const) {
    const r = await request.post("/api/inventory/adjustments", {
      headers,
      data: {
        variantId: p.variants[0].id,
        qty,
        reason: "E2E lote",
        lotNumber,
        expiryDate: "2030-01-01T12:00:00.000Z",
      },
    });
    expect(r.ok()).toBe(true);
  }
  const db = legacyDb();
  await db.lot.updateMany({
    where: { variantId: p.variants[0].id, lotNumber: "E2E-VENCIDO" },
    data: { expiryDate: new Date("2020-01-01T12:00:00Z") },
  });
  await db.$disconnect();
  // Un lote vence al cambiar el día, sin movimiento de stock: se ve al abrir.
  await page.reload();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  await page.getByRole("button", { name: "Mercancía", exact: true }).click();
  await page.getByLabel("Buscar producto", { exact: true }).fill(p.name);
  const option = page
    .getByRole("list", { name: "Resultados: Buscar producto" })
    .getByRole("button")
    .filter({ hasText: p.name });
  await expect(option).toContainText("3 en stock");
  await expect(option).toContainText("vencido: 2");
  // La caja recibe el mismo catálogo: 3 disponibles.
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await page.getByLabel("Buscar productos").fill(p.name);
  await expect(
    page.locator(".product-card").filter({ hasText: p.name }),
  ).toContainText("3 en stock");
  await request.patch("/api/products/" + p.id, {
    headers,
    data: { active: false },
  });
});

// ── Tienda: impresos de la impresora térmica, contraentrega y atajos ──
test.describe("Tienda-pantallas", () => {
  // window.print abre el diálogo del navegador: se cuenta en vez de abrirlo.
  const stubPrint = (page: any) =>
    page.addInitScript(() => {
      (window as any).__prints = 0;
      window.print = () => {
        (window as any).__prints++;
      };
    });
  const prints = (page: any) => page.evaluate(() => (window as any).__prints);

  test("Tienda-pantallas: cierre por denominaciones con entregado/dejado imprime el cuadre y se reimprime con sus reportes", async ({
    page,
  }) => {
    await stubPrint(page);
    await login(page);
    await ensureCash(page);
    await page
      .getByRole("button", { name: "Cerrar y arquear" })
      .first()
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Cuadre y cierre de caja",
    });
    await expect(dialog).toBeVisible();
    // 3 × 100 + 4 × 50 = 500, el fondo de la caja.
    await dialog.getByLabel("Cantidad de 100", { exact: true }).fill("3");
    await dialog.getByLabel("Cantidad de 50", { exact: true }).fill("4");
    await expect(dialog.locator(".count-subtotal")).toContainText("RD$ 500.00");
    await dialog.getByLabel(/Tarjeta declarada/).fill("0");
    await dialog.getByLabel(/Transferencia declarada/).fill("0");
    await dialog.getByLabel("Entregado").fill("300");
    await expect(dialog.locator(".count-left")).toContainText("RD$ 200.00");
    await dialog
      .getByRole("checkbox", { name: /Confirmo que conté efectivo/ })
      .check();
    await dialog
      .getByRole("button", { name: "Cerrar caja e imprimir cuadre" })
      .click();
    const sheet = page.locator(".thermal-print");
    await expect(sheet).toContainText("Cuadre de Caja");
    await expect(sheet).toContainText("Detalles de monedas");
    await expect(sheet).toContainText("100 × 3 = 300.00");
    await expect(sheet).toContainText("Sub-total 500.00");
    await expect(sheet).toContainText("2-Efectivo RD$ 500.00");
    await expect(sheet).toContainText("18-Fondo Caja inicial 500.00");
    await expect(sheet).toContainText(
      "12-Diferencias = (2-Efectivo introducido + 5-Vale de caja) − 10-Total venta efectivo − 18-Total fondo",
    );
    await expect(sheet).toContainText("Entregado 300.00");
    await expect(sheet).toContainText("Dejado en caja 200.00");
    await expect(sheet).toContainText("Firma cajera");
    await expect(sheet).toContainText("FIN DEL CUADRE");
    await expect.poll(() => prints(page)).toBeGreaterThan(0);
    // Desde el historial: reimprimir el cuadre y los dos reportes.
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    const row = page.locator(".cash-history-actions").first();
    await row.getByRole("button", { name: "Venta diaria" }).click();
    await expect(sheet).toContainText("REPORTE DE LA VENTA DIARIA DE USUARIO");
    await expect(sheet).toContainText(
      "Verificar si los totales tienen descuentos aplicados",
    );
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await row.getByRole("button", { name: "Por forma de pago" }).click();
    await expect(sheet).toContainText("REPORTE DE VENTA USUARIO");
    await expect(sheet).toContainText("Sub-Total por Fact.");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await row.getByRole("button", { name: "Cuadre" }).click();
    await expect(sheet).toContainText("FIN DEL CUADRE");
  });

  test("Tienda-pantallas: venta con contraentrega + efectivo, factura impresa con su formato y cobro de la contraentrega", async ({
    page,
    request,
  }) => {
    await stubPrint(page);
    const headers = await r9Headers(request);
    const code = r9Code("7");
    const name = "Faja E2E contraentrega " + code;
    const product = await r9Product(request, headers, name, code, {
      price: 1500,
    });
    const search = await r9Pos(page);
    await search.fill(code);
    await search.press("Enter");
    await selectNamedCustomer(page);
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page.getByLabel("Monto del pago").fill("500");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page
      .getByRole("button", {
        name: "Crédito / contraentrega",
        exact: true,
      })
      .click();
    await expect(page.getByLabel("Monto del pago")).toHaveValue("1000");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    const sheet = page.locator(".thermal-print");
    await expect(sheet).toContainText(
      "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL",
    );
    await expect(sheet).toContainText("Secuencia No.");
    await expect(sheet).toContainText("Cod. " + code);
    await expect(sheet).toContainText("1 X RD$ 1,500.00");
    await expect(sheet).toContainText("Total a pagar RD$ 1,500.00");
    await expect(sheet).toContainText("Efectivo RD$ 500.00");
    await expect(sheet).toContainText("Crédito / contraentrega RD$ 1,000.00");
    await expect(sheet).toContainText("Cantidad de Productos 1");
    await page.getByRole("button", { name: "Imprimir factura" }).click();
    await expect.poll(() => prints(page)).toBeGreaterThan(0);
    const number = (await page
      .locator(".sale-success p")
      .first()
      .textContent())!.trim();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
    // La cajera registra el cobro cuando el mensajero trae el dinero.
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    const pending = page.locator(".cod-row", { hasText: number });
    await expect(pending).toContainText("RD$ 1,000.00");
    await pending.getByRole("button", { name: "Registrar pago" }).click();
    const dialog = page.getByRole("dialog", {
      name: /Pago de crédito \/ contraentrega/,
    });
    await expect(dialog.getByLabel("Monto cobrado")).toHaveValue("1000");
    await dialog.getByRole("button", { name: "Registrar cobro" }).click();
    await expect(page.locator(".cod-row", { hasText: number })).toHaveCount(0);
    await r9Retire(request, headers, [product]);
  });

  test("Tienda-pantallas: F9 abre Entrada de mercancía", async ({ page }) => {
    await login(page);
    await page.keyboard.press("F9");
    await expect(
      page.getByRole("heading", { name: "Mercancía", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("F10");
    await expect(page).toHaveURL(/#products/);
  });

  test("Tienda-pantallas: en el celular el cierre y la contraentrega no se desbordan", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    // En el celular el menú está plegado: se entra a Caja por la dirección.
    await page.evaluate(() => (location.hash = "cash"));
    const open = page.getByRole("button", { name: "Abrir caja", exact: true });
    await expect(
      open.or(page.getByText("Caja abierta", { exact: true })),
    ).toBeVisible();
    if (await open.isVisible()) {
      await open.click();
      await page.getByLabel("Efectivo inicial").fill("500");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
    }
    await page
      .getByRole("button", { name: "Cerrar y arquear" })
      .first()
      .click();
    await expect(page.getByLabel("Cantidad de 2000")).toBeVisible();
    await expect(page.getByLabel("Entregado")).toBeVisible();
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(wide).toBe(false);
  });
});

// Auditoría final de dinero · D-01: en la caja, la contraentrega de una
// vendedora sobre el umbral pide el PIN del gerente con el mismo campo que el
// crédito, y no se puede finalizar sin él.
test("D-01: la vendedora necesita el PIN del gerente para una contraentrega sobre el umbral", async ({
  page,
  request,
}) => {
  const headers = await r9Headers(request);
  const settings = await (
    await request.get("/api/settings", { headers })
  ).json();
  const code = r9Code("8");
  const name = "Faja E2E contraentrega PIN " + code;
  let product: any;
  try {
    const saved = await request.put("/api/settings", {
      headers,
      data: {
        ...settings,
        allowCreditSales: true,
        creditApprovalThreshold: 1000,
      },
    });
    expect(saved.ok()).toBe(true);
    product = await r9Product(request, headers, name, code, { price: 1500 });
    const customer = await (
      await request.post("/api/customers", {
        headers,
        data: { name: "E2E contraentrega PIN " + code },
      })
    ).json();
    expect(customer.id).toBeTruthy();
    // La vendedora del seed entra en un equipo nuevo, que aprueba el gerente.
    await page.goto("/");
    await page.getByLabel("Usuario").fill("vendedor@fitstore.demo");
    await page
      .getByLabel("Contraseña", { exact: true })
      .fill("FitStore-Demo-2026!");
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    const approval = page.getByText("Este equipo necesita aprobación");
    await expect(
      approval
        .or(page.getByRole("button", { name: "Caja", exact: true }))
        .first(),
    ).toBeVisible({ timeout: 15000 });
    if (await approval.isVisible()) {
      await page.getByLabel("Nombre del equipo").fill("Caja E2E D-01");
      await page.getByLabel("PIN del gerente").fill("234567");
      await page.getByRole("button", { name: "Aprobar este equipo" }).click();
      await expect(approval).toHaveCount(0);
    }
    await ensureCash(page);
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    const search = page.getByLabel("Buscar productos");
    await search.fill(code);
    await search.press("Enter");
    await expect(r9Qty(page, name)).toHaveText("1");
    await page.keyboard.press("F4");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: customer.name })
      .click();
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page
      .getByRole("button", { name: "Crédito / contraentrega", exact: true })
      .click();
    await expect(page.getByLabel("Monto del pago")).toHaveValue("1500");
    await page
      .getByRole("button", { name: "Agregar pago", exact: true })
      .click();
    const pin = page.getByLabel("PIN del gerente para aprobar la venta");
    const finish = page.getByRole("button", {
      name: "Finalizar venta",
      exact: true,
    });
    await expect(pin).toBeVisible();
    await expect(finish).toBeDisabled();
    await pin.fill("234567");
    await finish.click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
  } finally {
    // La caja de la vendedora no la cierra el beforeEach: la cierra el admin.
    const seller = await (
      await request.post("/api/auth/login", {
        data: {
          email: "vendedor@fitstore.demo",
          password: "FitStore-Demo-2026!",
        },
      })
    ).json();
    const sessions = await (
      await request.get("/api/cash-sessions", { headers })
    ).json();
    for (const s of sessions.filter(
      (s: any) => !s.closedAt && s.userId === seller.user?.id,
    ))
      await request.post("/api/cash-sessions/" + s.id + "/close", {
        headers,
        data: {
          countedCash: Math.max(0, s.expected.cash),
          countedCard: Math.max(0, s.expected.card),
          countedTransfer: Math.max(0, s.expected.transfer),
          notes: "Cierre E2E D-01",
        },
      });
    await request.put("/api/settings", {
      headers,
      data: { ...settings, logo: settings.logo ?? "" },
    });
    if (product) await r9Retire(request, headers, [product]);
  }
});
