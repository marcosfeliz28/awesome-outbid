import type { Browser } from "@playwright/test";
import { test, expect } from "./apoyo";
// Tienda: 3 cajas en computadoras y Mercancía en un celular, a la vez, contra
// la misma base. Cada pantalla ve el stock cambiar sin recargar.
const owner = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const password = "FitStore-QA-2026!";

test("Tienda-4cajas: 3 cajas y el celular de Mercancía ven el stock en tiempo real", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const auth = await (
    await request.post("/api/auth/login", { data: owner })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const branch = auth.user.branchId;
  const api = async (path: string, data?: unknown, as = headers) => {
    const r =
      data === undefined
        ? await request.get("/api" + path, { headers: as })
        : await request.post("/api" + path, { headers: as, data });
    expect(r.ok(), path + " " + (await r.text())).toBe(true);
    return r.json();
  };
  // El dueño también necesita un equipo aprobado para ajustar stock.
  const ownerTerminal = crypto.randomUUID();
  await api("/terminals/register", {
    id: ownerTerminal,
    name: "E2E 4 cajas dueño",
    secret: "e2e-4cajas-" + ownerTerminal,
  });
  const tag = Date.now().toString(36);
  const roles = await api("/roles");
  const cats = await api("/categories");
  const product = await api("/products", {
    name: "E2E Cuatro Cajas " + tag,
    sku: "E2E-4C-" + tag,
    categoryId: cats.find((c: any) => c.name === "Ropa deportiva").id,
    taxRate: 0,
    variants: [
      {
        sku: "E2E-4CV-" + tag,
        barcode: "E2E-4CB-" + tag,
        price: 300,
        costAvg: 100,
      },
    ],
  });
  const variant = product.variants[0];
  await api("/inventory/adjustments", {
    variantId: variant.id,
    qty: 5,
    reason: "E2E 4 cajas",
  });

  // Un usuario y un equipo aprobado por pantalla.
  async function station(label: string, role: string, mobile: boolean) {
    const email = `e2e-4cajas-${label}-${tag}@example.test`;
    await api("/users", {
      name: "E2E " + label + " " + tag,
      email,
      password,
      pin: "246813",
      roleId: roles.find((r: any) => r.name === role).id,
    });
    const login = await (
      await request.post("/api/auth/login", { data: { email, password } })
    ).json();
    const identity = {
      id: crypto.randomUUID(),
      name: "E2E " + label,
      secret: "e2e-4cajas-secreto-" + crypto.randomUUID(),
    };
    const t = await api("/terminals/register", identity, {
      Authorization: "Bearer " + login.accessToken,
    });
    if (t.status === "pending")
      await api("/terminals/" + identity.id + "/approve", {});
    const context = await (browser as Browser).newContext(
      mobile
        ? {
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
          }
        : { viewport: { width: 1280, height: 900 } },
    );
    await context.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      ["fitstore-equipment:" + branch, JSON.stringify(identity)] as const,
    );
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    // La cajera entra directo a su pantalla; basta con que se vaya el login.
    await expect(
      page.getByRole("button", { name: "Entrar a mi tienda" }),
    ).toHaveCount(0);
    return { page, context, errors, token: login.accessToken };
  }
  async function openPos(page: any, amount: string) {
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
    await page.getByLabel("Efectivo inicial").fill(amount);
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Punto de venta", exact: true })
      .click();
    await page.getByLabel("Buscar productos").fill(product.name);
    return page.locator(".product-card").filter({ hasText: product.name });
  }

  const cajas = [];
  for (const k of [1, 2, 3])
    cajas.push(await station("caja" + k, "seller", false));
  const phone = await station("celular", "warehouse", true);
  const cards = [];
  for (const [i, c] of cajas.entries())
    cards.push(await openPos(c.page, String(500 * (i + 1))));
  for (const card of cards) await expect(card).toContainText("5 en stock");
  // El almacén entra directo a Mercancía en el celular.
  await expect(
    phone.page.getByRole("heading", { name: "Mercancía", exact: true }),
  ).toBeVisible();
  await phone.page
    .getByLabel("Buscar producto", { exact: true })
    .fill(product.name);
  const option = phone.page
    .getByRole("option")
    .filter({ hasText: product.name });
  await expect(option).toContainText("5 en stock");

  // La caja 1 vende 2 desde su pantalla.
  const sell = async (page: any, card: any) => {
    await card.click();
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Nueva venta", exact: true })
      .click();
  };
  await cards[0].click();
  await sell(cajas[0].page, cards[0]);
  // Las otras cajas y el celular lo ven sin recargar.
  for (const card of cards)
    await expect(card).toContainText("3 en stock", { timeout: 15000 });
  await expect(option).toContainText("3 en stock", { timeout: 15000 });

  // Las cajas 2 y 3 venden a la vez.
  await Promise.all([
    sell(cajas[1].page, cards[1]),
    sell(cajas[2].page, cards[2]),
  ]);
  for (const card of cards)
    await expect(card).toContainText("1 en stock", { timeout: 15000 });
  await expect(option).toContainText("1 en stock", { timeout: 15000 });

  // Entra mercancía desde el celular: las cajas lo ven.
  await api(
    "/merchandise/operations",
    {
      id: crypto.randomUUID(),
      direction: "entry",
      items: [{ variantId: variant.id, qty: 4, unitCost: 100 }],
    },
    { Authorization: "Bearer " + phone.token },
  );
  for (const card of cards)
    await expect(card).toContainText("5 en stock", { timeout: 15000 });
  await expect(option).toContainText("5 en stock", { timeout: 15000 });
  const fresh = await api("/products/" + product.id);
  expect(Number(fresh.variants[0].stock)).toBe(5);

  // Cada caja cierra con su cuadre: su fondo + lo vendido por ella.
  const sold = [600, 300, 300];
  for (const [i, c] of cajas.entries()) {
    const as = { Authorization: "Bearer " + c.token };
    const session = (await api("/cash-sessions", undefined, as)).find(
      (s: any) => !s.closedAt,
    );
    expect(session.expected.cash).toBe(500 * (i + 1) + sold[i]);
    await api(
      "/cash-sessions/" + session.id + "/close",
      { countedCash: session.expected.cash },
      as,
    );
    const cuadre = await api(
      "/cash-sessions/" + session.id + "/cuadre",
      undefined,
      as,
    );
    expect(cuadre.lines.find((l: any) => l.key === "differenceDop").value).toBe(
      0,
    );
  }
  for (const s of [...cajas, phone]) {
    expect(s.errors).toEqual([]);
    await s.context.close();
  }
  await request.patch("/api/products/" + product.id, {
    headers,
    data: { active: false },
  });
});
