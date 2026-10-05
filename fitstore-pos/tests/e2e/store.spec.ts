import { test, expect } from "@playwright/test";
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
  await page.getByLabel("Correo electrónico").fill("admin@fitstore.demo");
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
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  await page.screenshot({ path: "docs/cobro-exitoso.png" });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(page.locator(".cart-items")).toContainText(
    "Tu próxima venta empieza aquí",
  );
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
  await page.screenshot({ path: "docs/dashboard-mobile.png", fullPage: true });
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
  await page.screenshot({ path: "docs/pos-mobile.png", fullPage: true });
});
test("venta offline queda guardada y se sincroniza una sola vez", async ({
  page,
  context,
}) => {
  await login(page);
  await ensureCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.getByLabel("Buscar productos").fill("Shaker FitStore");
  await page.locator(".product-card").click();
  await page.getByRole("dialog").getByRole("button", { name: /Lila/ }).click();
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
    await page.getByRole("button", { name: "A crédito", exact: true }).click();
    await page.getByLabel("Vencimiento del crédito").fill("2030-01-01");
    await page
      .getByRole("button", { name: "Agregar pago", exact: true })
      .click();
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
    page.getByRole("option").filter({ hasText: p.name }),
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
    page.getByRole("option").filter({ hasText: p.name }),
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
  await page.getByLabel("Correo electrónico").fill("vendedor@fitstore.demo");
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
      path: `docs/validacion/ronda6-capturas/cel-equipos-${width}.png`,
    });
  }
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
