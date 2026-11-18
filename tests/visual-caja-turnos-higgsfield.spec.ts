/** QA visual DEMO. API simulada; no certifica autorización del servidor ni hace operaciones reales. */
import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
type Role = "manager" | "cashier";
async function setup(
  page: Page,
  role: Role,
  closed: boolean,
  theme: string,
  hostile = false,
) {
  const writes: string[] = [];
  const user = {
    id: "demo-user",
    name: "Operador DEMO",
    email: "demo@example.invalid",
    role: role === "manager" ? "admin" : "seller",
    branchId: "demo-branch",
    permissions: role === "manager" ? ["*"] : ["cash:write", "sale:write"],
    sessionTimeoutMinutes: 30,
  };
  const session = {
    id: "demo-session",
    userId: user.id,
    userName: user.name,
    branchId: user.branchId,
    registerId: "demo-terminal",
    registerName: "Terminal DEMO",
    openedAt: "2026-11-17T12:00:00Z",
    closedAt: closed ? "2026-11-17T20:00:00Z" : null,
    openingAmount: "1500",
    countedCash: closed ? (hostile ? "500" : "78432.17") : null,
    // Deliberately over-disclosing response: UI must still honor cashier permissions.
    ...(hostile
      ? {
          expectedCash: "87654.32",
          expected: {
            cash: 87654.32,
            card: 65432.19,
            transfer: 54321.87,
            movements: [],
          },
          differenceCash: "4321.98",
          differenceCard: "3210.87",
          differenceTransfer: "2109.76",
        }
      : {}),
    ...(role === "manager"
      ? {
          expected: {
            cash: 78432.17,
            card: 10000,
            transfer: 2000,
            movements: [],
          },
          expectedCash: closed ? "78432.17" : null,
        }
      : {}),
  };
  await page.addInitScript((theme) => {
    localStorage.setItem("fitstore-theme", theme);
    localStorage.setItem(
      "fitstore-equipment:demo-branch",
      JSON.stringify({
        id: "demo-terminal",
        name: "Terminal DEMO",
        secret: "test-only-not-real",
      }),
    );
  }, theme);
  await page.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    if (!["127.0.0.1", "localhost"].includes(url.hostname))
      return route.abort();
    if (!p.startsWith("/api/")) return route.continue();
    let body: unknown;
    if (p === "/api/auth/refresh" && req.method() === "POST")
      body = { user, accessToken: "demo-token-not-real" };
    else if (p === "/api/terminals/register" && req.method() === "POST")
      body = { id: "demo-terminal", name: "Terminal DEMO", approved: true };
    else if (!["GET", "HEAD"].includes(req.method())) {
      writes.push(`${req.method()} ${p}`);
      return route.fulfill({
        status: 405,
        contentType: "application/json",
        body: '{"error":"DEMO writes blocked"}',
      });
    } else if (p === "/api/cash-sessions") body = [session];
    else if (p === "/api/settings")
      body = { currency: "DOP", taxIncluded: true };
    else if (p === "/api/cash-sessions/opening-suggestion")
      body = { amount: 1500 };
    else if (p === "/api/users") body = [user];
    else if (
      [
        "/api/customers",
        "/api/alerts",
        "/api/void-requests",
        "/api/branches",
      ].includes(p)
    )
      body = [];
    else
      return route.fulfill({
        status: 404,
        contentType: "application/json",
        body: '{"error":"Missing DEMO fixture"}',
      });
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/#cash");
  await expect(page.locator(".fusion-cash-turnos")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Historial de cajas", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fusion-cash-turnos table")).toContainText(
    "Terminal DEMO",
  );
  return writes;
}
for (const width of [1440, 390])
  for (const theme of ["light", "dark"])
    for (const state of ["manager", "cashier", "closed"] as const)
      test(`Caja turnos ${width} ${theme} ${state}`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const writes = await setup(
          page,
          state === "cashier" ? "cashier" : "manager",
          state === "closed",
          theme,
        );
        if (state === "manager")
          await expect(page.locator(".cash-main strong")).toContainText(
            "78,432.17",
          );
        if (state === "cashier") {
          await expect(page.locator(".cash-overview")).toHaveCount(0);
          await expect(page.locator(".fusion-cash-turnos")).not.toContainText(
            "78,432.17",
          );
        }
        if (state === "closed")
          await expect(
            page.getByRole("button", { name: "Abrir caja", exact: true }),
          ).toBeVisible();
        const size = await page.evaluate(() => ({
          viewport: innerWidth,
          content: document.documentElement.scrollWidth,
        }));
        expect(size.content).toBeLessThanOrEqual(size.viewport + 1);
        await page.evaluate(() => document.fonts.ready);
        await mkdir("test-results/higgsfield-caja-turnos/capturas", {
          recursive: true,
        });
        await page.screenshot({
          path: `test-results/higgsfield-caja-turnos/capturas/caja-turnos-${width}-${theme}-${state}.png`,
          fullPage: true,
        });
        expect(writes).toEqual([]);
      });
for (const role of ["manager", "cashier"] as const)
  test(`abrir movimiento y cierre sin enviar: ${role}`, async ({ page }) => {
    const writes = await setup(page, role, false, "dark");
    await page.getByRole("button", { name: "Movimiento", exact: true }).click();
    const movement = page.getByRole("dialog", {
      name: "Movimiento de efectivo",
      exact: true,
    });
    await expect(movement).toBeVisible();
    await movement.getByRole("button", { name: "Cerrar", exact: true }).click();
    await page
      .getByRole("button", { name: "Cerrar y arquear", exact: true })
      .first()
      .click();
    const close = page.getByRole("dialog", {
      name: "Cuadre y cierre de caja",
      exact: true,
    });
    await expect(close).toBeVisible();
    await close.getByRole("button", { name: "Cerrar", exact: true }).click();
    expect(writes).toEqual([]);
  });

for (const closed of [false, true])
  test(`respuesta hostil no revela esperado ni diferencias a cajera: ${closed ? "cerrada" : "abierta"}`, async ({
    page,
  }) => {
    const writes = await setup(page, "cashier", closed, "dark", true);
    const history = page.locator(".fusion-cash-turnos table");
    await expect(history).toContainText("Terminal DEMO");
    await expect(page.locator(".cash-overview")).toHaveCount(0);
    for (const amount of [
      "87,654.32",
      "65,432.19",
      "54,321.87",
      "4,321.98",
      "3,210.87",
      "2,109.76",
    ])
      await expect(page.locator(".fusion-cash-turnos")).not.toContainText(
        amount,
      );
    const row = history.getByRole("row").filter({ hasText: "Terminal DEMO" });
    // Cashier columns: Equipo, Apertura, Estado, Esperado, Contado, Diferencias, Acciones.
    await expect(row.getByRole("cell").nth(3)).toHaveText("—");
    await expect(row.getByRole("cell").nth(5)).toHaveText("—");
    expect(writes).toEqual([]);
  });
