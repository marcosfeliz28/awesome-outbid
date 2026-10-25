import type { Browser, Page } from "@playwright/test";
import { expect, test } from "./apoyo";

const ownerLogin = {
  email: "admin@fitstore.demo",
  password: process.env.SEED_DEMO_PASSWORD!,
};
const temporaryPassword = "482917";
const sellerPassword = "736204";
const sellerPin = String(Math.floor(100000 + Math.random() * 900000));

type Api = (
  path: string,
  data?: unknown,
  headers?: Record<string, string>,
) => Promise<any>;

async function login(page: Page, login: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(login);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator(".main-content")).toBeVisible();
}

async function openPage(page: Page, hash: string, heading: string | RegExp) {
  await page.evaluate((next) => {
    location.hash = next;
  }, hash);
  await expect(
    page.getByRole("heading", { name: heading }).first(),
  ).toBeVisible();
}

async function requestVoid(page: Page, invoice: string, reason: string) {
  await page.getByLabel("Buscar número de venta").fill(invoice);
  await page.getByRole("button", { name: "Solicitar anulación" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tipo de motivo").selectOption("other");
  await dialog.getByLabel("Explica el motivo").fill(reason);
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Solicitud pendiente")).toBeVisible();
}

async function assertMobileContract(page: Page, width: 320 | 390) {
  const height = width === 320 ? 640 : 844;
  await page.setViewportSize({ width, height });
  await expect(page.locator(".admin-dashboard")).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    overflow,
    `desbordamiento horizontal a ${width}px`,
  ).toBeLessThanOrEqual(1);

  const undersized = await page.locator(".admin-dashboard").evaluate((root) =>
    [
      ...root.querySelectorAll<HTMLElement>(
        "button, input, select, textarea, a[href]",
      ),
    ]
      .filter((control) => {
        const style = getComputedStyle(control);
        const box = control.getBoundingClientRect();
        return (
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          box.width > 0 &&
          box.height > 0 &&
          (box.width < 44 || box.height < 44)
        );
      })
      .map((control) => ({
        name:
          control.getAttribute("aria-label") ||
          control.textContent?.trim().slice(0, 60) ||
          control.tagName,
        width: Math.round(control.getBoundingClientRect().width),
        height: Math.round(control.getBoundingClientRect().height),
      })),
  );
  expect(undersized, `controles menores de 44 px a ${width}px`).toEqual([]);
}

async function chooseTheme(
  page: Page,
  theme: "cristal" | "ejecutivo" | "mando",
  label: string,
) {
  await page.evaluate(() => {
    location.hash = "settings";
  });
  const selector = page.getByRole("group", {
    name: "Estilo del tablero administrativo",
  });
  await expect(selector).toBeVisible();
  await selector.getByRole("button", { name: label }).click();
  await expect(selector.getByRole("button", { name: label })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await openPage(page, "dashboard", /Hola,/);
  await expect(page.locator(".admin-dashboard")).toHaveAttribute(
    "data-admin-theme",
    theme,
  );
}

async function reachByKeyboard(page: Page, name: string | RegExp) {
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press("Tab");
    const activeName = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      return (
        active?.getAttribute("aria-label") ||
        active?.innerText?.trim() ||
        active?.getAttribute("title") ||
        ""
      );
    });
    if (typeof name === "string" ? activeName === name : name.test(activeName))
      return;
  }
  throw new Error(`No se alcanzó por teclado el control ${String(name)}.`);
}

test("Tablero fase A: móvil, temas, privacidad, decisiones reales y caja intacta", async ({
  browser,
  request,
}, testInfo) => {
  test.setTimeout(180_000);
  const tag = Date.now().toString(36);
  const ownerSession = await request.post("/api/auth/login", {
    data: ownerLogin,
  });
  expect(ownerSession.ok(), await ownerSession.text()).toBe(true);
  const auth = await ownerSession.json();
  const ownerHeaders = { Authorization: `Bearer ${auth.accessToken}` };
  const api: Api = async (path, data, headers = ownerHeaders) => {
    const response =
      data === undefined
        ? await request.get(`/api${path}`, { headers })
        : await request.post(`/api${path}`, { headers, data });
    const text = await response.text();
    expect(response.ok(), `${path}: ${text}`).toBe(true);
    return text ? JSON.parse(text) : null;
  };
  const ownerTerminal = {
    id: crypto.randomUUID(),
    name: `E2E tablero admin ${tag}`,
    secret: `e2e-tablero-admin-${crypto.randomUUID()}`,
  };
  const sellerTerminal = {
    id: crypto.randomUUID(),
    name: `E2E tablero caja ${tag}`,
    secret: `e2e-tablero-caja-${crypto.randomUUID()}`,
  };
  const contexts: Awaited<ReturnType<Browser["newContext"]>>[] = [];
  let sellerId = "";

  try {
    await api("/terminals/register", ownerTerminal);
    const roles = await api("/roles");
    const categories = await api("/categories");
    const sellerEmail = `e2e-tablero-${tag}@example.com`;
    const seller = await api("/users", {
      name: `E2E Tablero ${tag}`,
      email: sellerEmail,
      password: temporaryPassword,
      pin: sellerPin,
      roleId: roles.find((role: any) => role.name === "seller").id,
    });
    sellerId = seller.id;
    const changed = await request.post("/api/auth/change-password", {
      data: {
        login: sellerEmail,
        currentPassword: temporaryPassword,
        newPassword: sellerPassword,
        confirmPassword: sellerPassword,
      },
    });
    expect(changed.ok(), await changed.text()).toBe(true);
    const sellerSession = await changed.json();
    const sellerHeaders = {
      Authorization: `Bearer ${sellerSession.accessToken}`,
    };
    await api("/terminals/register", sellerTerminal, sellerHeaders);
    await api(`/terminals/${sellerTerminal.id}/approve`, {});
    const product = await api("/products", {
      name: `Producto E2E tablero ${tag}`,
      sku: `E2ET-${tag}`,
      categoryId: categories.find((category: any) => category.name === "Fajas")
        .id,
      taxRate: 0,
      variants: [
        {
          sku: `E2ETV-${tag}`,
          barcode: `E2ETB-${tag}`,
          price: 100,
          costAvg: 40,
        },
      ],
    });
    await api("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 5,
      reason: "E2E tablero administrativo",
    });
    const customer = await api("/customers", {
      name: `Cliente E2E tablero ${tag}`,
    });
    const cash = await api(
      "/cash-sessions/open",
      { registerId: sellerTerminal.id, openingAmount: 500 },
      sellerHeaders,
    );
    const makeSale = () =>
      api(
        "/sales",
        {
          offlineUuid: crypto.randomUUID(),
          customerId: customer.id,
          cashSessionId: cash.id,
          items: [{ variantId: product.variants[0].id, qty: 1 }],
          payments: [{ method: "cash", amount: 100 }],
          expectedTotal: 100,
        },
        sellerHeaders,
      );
    const saleToApprove = await makeSale();
    const saleToReject = await makeSale();

    const sellerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(sellerContext);
    await sellerContext.addInitScript(
      ([branchId, terminal]) =>
        localStorage.setItem(
          `fitstore-equipment:${branchId}`,
          JSON.stringify(terminal),
        ),
      [auth.user.branchId, sellerTerminal] as const,
    );
    const sellerPage = await sellerContext.newPage();
    await login(sellerPage, sellerEmail, sellerPassword);
    await openPage(sellerPage, "sales", "Cada venta tiene una historia");
    await requestVoid(
      sellerPage,
      saleToApprove.number,
      "Aprobar desde la baraja administrativa.",
    );
    await requestVoid(
      sellerPage,
      saleToReject.number,
      "Rechazar desde la baraja administrativa.",
    );

    // La fase A no modifica ni muestra tarjetas administrativas en la caja.
    await openPage(sellerPage, "pos", "Punto de venta");
    await expect(sellerPage.getByLabel("Buscar productos")).toBeVisible();
    await expect(sellerPage.locator(".admin-dashboard")).toHaveCount(0);

    const ownerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(ownerContext);
    await ownerContext.addInitScript(
      ([branchId, terminal]) =>
        localStorage.setItem(
          `fitstore-equipment:${branchId}`,
          JSON.stringify(terminal),
        ),
      [auth.user.branchId, ownerTerminal] as const,
    );
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, ownerLogin.email, ownerLogin.password);
    await expect(
      ownerPage.getByRole("heading", { name: "Aprobaciones pendientes" }),
    ).toBeVisible();

    // Una operación de otra caja actualiza la tarjeta por /events. No se
    // recarga la página ni existe refetchInterval en las tarjetas nuevas.
    const sellerRegister = ownerPage
      .locator(".registers-live__session")
      .filter({ hasText: `E2E Tablero ${tag}` });
    await expect(sellerRegister).toContainText(/RD\$700[.,]00/);
    await api(
      `/cash-sessions/${cash.id}/movements`,
      {
        operationId: crypto.randomUUID(),
        type: "in",
        amount: 13.37,
        reason: "Prueba SSE del tablero",
      },
      sellerHeaders,
    );
    await expect(sellerRegister).toContainText(/RD\$713[.,]37/);

    for (const [theme, label] of [
      ["cristal", "Cristal nocturno"],
      ["ejecutivo", "Ejecutivo claro"],
      ["mando", "Centro de mando"],
    ] as const) {
      await chooseTheme(ownerPage, theme, label);
      await assertMobileContract(ownerPage, 320);
      await assertMobileContract(ownerPage, 390);
      await testInfo.attach(`tablero-${theme}-390px`, {
        body: await ownerPage.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }

    const privacy = ownerPage.getByRole("button", { name: "Ocultar cifras" });
    await privacy.click();
    await expect(ownerPage.locator("html")).toHaveClass(/nexora-privacy-mode/);
    await expect(privacy).toHaveAttribute("aria-pressed", "true");
    await expect(ownerPage.locator("[data-private-value]").first()).toHaveCSS(
      "filter",
      /blur/,
    );
    await expect(ownerPage.locator(".progress-track").first()).toHaveCSS(
      "filter",
      /blur/,
    );
    await ownerPage.reload();
    await expect(
      ownerPage.getByRole("button", { name: "Mostrar cifras" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(ownerPage.locator("html")).toHaveClass(/nexora-privacy-mode/);

    const approveCard = ownerPage
      .locator(".approval-deck__card")
      .filter({ hasText: saleToApprove.number });
    await reachByKeyboard(
      ownerPage,
      `Abrir detalle de ${saleToApprove.number}`,
    );
    await ownerPage.keyboard.press("Enter");
    await expect(ownerPage).toHaveURL(/#void-requests/);
    await openPage(ownerPage, "dashboard", /Hola,/);
    await expect(approveCard).toBeVisible();
    await approveCard
      .getByRole("button", { name: "Aprobar anulación" })
      .click();
    const approvalResponse = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/void-requests\/[0-9a-f-]+\/approve$/.test(response.url()),
    );
    // La protección real de esta ruta es sesión de administrador + equipo
    // aprobado; no se inyecta ni se simula un PIN que el endpoint no recibe.
    await approveCard.getByRole("button", { name: "Confirmar" }).click();
    expect((await approvalResponse).status()).toBe(200);
    await expect(approveCard).toHaveCount(0);
    expect(
      (await api(`/sales?q=${saleToApprove.number}`)).find(
        (sale: any) => sale.id === saleToApprove.id,
      ).status,
    ).toBe("voided");

    const rejectCard = ownerPage
      .locator(".approval-deck__card")
      .filter({ hasText: saleToReject.number });
    await rejectCard.getByRole("button", { name: "Rechazar" }).click();
    await rejectCard
      .getByLabel("Motivo del rechazo")
      .fill("La venta corresponde y debe conservarse.");
    const rejectionResponse = ownerPage.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        /\/api\/void-requests\/[0-9a-f-]+\/reject$/.test(response.url()),
    );
    await rejectCard.getByRole("button", { name: "Confirmar rechazo" }).click();
    expect((await rejectionResponse).status()).toBe(200);
    await expect(rejectCard).toHaveCount(0);
    const resolved = await api("/void-requests?status=rejected");
    expect(
      resolved.some(
        (row: any) =>
          row.sale.id === saleToReject.id &&
          row.resolutionNote === "La venta corresponde y debe conservarse.",
      ),
    ).toBe(true);
  } finally {
    for (const context of contexts) await context.close();
    if (sellerId)
      await request.patch(`/api/users/${sellerId}`, {
        headers: ownerHeaders,
        data: { active: false },
      });
  }
});
