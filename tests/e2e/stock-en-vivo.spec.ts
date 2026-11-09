import { test, expect, selectNamedCustomer, fillOpeningFund } from "./apoyo";
// Tras cobrar, la caja recarga el catálogo. Si esa respuesta llega después de
// un aviso en vivo más nuevo, no debe pisarlo: cuatro-cajas.spec.ts se quedaba
// a veces en «2 en stock» cuando ya había 1. Aquí la carrera es determinista.
const owner = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };

test("una recarga del catálogo más vieja que el aviso en vivo no pisa el stock", async ({
  browser,
  request,
}) => {
  test.setTimeout(90000);
  const auth = await (
    await request.post("/api/auth/login", { data: owner })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const api = async (path: string, data?: unknown, as = headers) => {
    const r =
      data === undefined
        ? await request.get("/api" + path, { headers: as })
        : await request.post("/api" + path, { headers: as, data });
    expect(r.ok(), path + " " + (await r.text())).toBe(true);
    return r.json();
  };
  const ownerTerminal = crypto.randomUUID();
  await api("/terminals/register", {
    id: ownerTerminal,
    name: "E2E stock en vivo dueño",
    secret: "e2e-vivo-" + ownerTerminal,
  });
  const tag = Date.now().toString(36);
  const cats = await api("/categories");
  const product = await api("/products", {
    name: "E2E Stock En Vivo " + tag,
    sku: "E2E-SV-" + tag,
    categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
    taxRate: 0,
    variants: [
      {
        sku: "E2E-SVV-" + tag,
        barcode: "E2E-SVB-" + tag,
        price: 300,
        costAvg: 100,
      },
    ],
  });
  const variant = product.variants[0];
  await api("/inventory/adjustments", {
    variantId: variant.id,
    qty: 5,
    reason: "E2E stock en vivo",
  });

  // Cajera con su equipo aprobado.
  const roles = await api("/roles");
  const email = `e2e-vivo-${tag}@example.test`;
  await api("/users", {
    name: "E2E vivo " + tag,
    email,
    password: "482917",
    pin: "246813",
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const changed = await request.post("/api/auth/change-password", {
    data: {
      login: email,
      currentPassword: "482917",
      newPassword: "736204",
      confirmPassword: "736204",
    },
  });
  expect(changed.ok(), "cambio de contraseña inicial").toBe(true);
  const login = await changed.json();
  const identity = {
    id: crypto.randomUUID(),
    name: "E2E vivo",
    secret: "e2e-vivo-secreto-" + crypto.randomUUID(),
  };
  const t = await api("/terminals/register", identity, {
    Authorization: "Bearer " + login.accessToken,
  });
  if (t.status === "pending")
    await api("/terminals/" + identity.id + "/approve", {});
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      "fitstore-equipment:" + auth.user.branchId,
      JSON.stringify(identity),
    ] as const,
  );
  const page = await context.newPage();
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill("736204");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await fillOpeningFund(page, "500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await page.getByLabel("Buscar productos").fill(product.name);
  const card = page.locator(".product-card").filter({ hasText: product.name });
  await expect(card).toContainText("5 en stock");

  // La recarga que sigue al cobro lee el stock en el servidor (4) y su
  // respuesta se retiene hasta que llegue un aviso en vivo más nuevo.
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  let read!: () => void;
  const fetched = new Promise<void>((r) => (read = r));
  let held = false;
  await page.route("**/api/products?limit=*", async (route) => {
    if (held) return route.continue();
    held = true;
    const response = await route.fetch();
    read();
    await gate;
    await route.fulfill({ response });
  });
  await card.click();
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  await fetched;
  await api("/inventory/adjustments", {
    variantId: variant.id,
    qty: 2,
    reason: "E2E stock en vivo: entra mientras la recarga viaja",
  });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await expect(card).toContainText("6 en stock", { timeout: 15000 });
  const stale = page.waitForResponse("**/api/products?limit=*");
  release();
  await stale;
  // Sin el arreglo, la respuesta vieja deja «4 en stock» aquí.
  await page.waitForTimeout(1000);
  await expect(card).toContainText("6 en stock");

  // Limpieza: cierre de la caja y producto inactivo.
  const as = { Authorization: "Bearer " + login.accessToken };
  const session = (await api("/cash-sessions", undefined, as)).find(
    (s: any) => !s.closedAt,
  );
  await api(
    "/cash-sessions/" + session.id + "/close",
    { countedCash: 800, countedCard: 0, countedTransfer: 0 },
    as,
  );
  await context.close();
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});
