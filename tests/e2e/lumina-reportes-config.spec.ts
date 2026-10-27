import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, screenshotPath } from "./apoyo";

test.use({ serviceWorkers: "block", reducedMotion: "reduce" });

const SESSION = "nexora-soporte-token";
const user = {
  id: "lumina-admin",
  name: "Administración visual",
  email: "visual@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "lumina-branch",
};

async function mockApp(context: BrowserContext) {
  let equipmentState: "states" | "empty" = "states";
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/terminals/register")
      return route.fulfill({
        json: { id: "terminal-here", status: "approved" },
      });
    if (path === "/api/terminals")
      return route.fulfill({
        json:
          equipmentState === "empty"
            ? []
            : [
                {
                  id: "terminal-pending",
                  name: "Caja recepción",
                  status: "pending",
                  identified: true,
                  connected: false,
                  openCashes: [],
                  createdByName: "Ana",
                  lastActivityAt: "2026-10-27T12:00:00.000Z",
                },
                {
                  id: "terminal-here",
                  name: "Equipo principal",
                  status: "approved",
                  identified: true,
                  connected: true,
                  openCashes: [],
                  lastActivityAt: "2026-10-27T14:00:00.000Z",
                },
                {
                  id: "terminal-revoked",
                  name: "Laptop anterior",
                  status: "revoked",
                  identified: true,
                  connected: false,
                  openCashes: [],
                  lastActivityAt: "2026-10-20T14:00:00.000Z",
                },
              ],
      });
    if (path === "/api/reportes") return route.fulfill({ json: [] });
    if (path.startsWith("/api/reports/"))
      return route.fulfill({
        json: {
          rows: [{ fecha: "2026-10-26", ventas: 12, total: 18400 }],
          total: 1,
          limit: 50,
        },
      });
    if (path === "/api/settings")
      return route.fulfill({
        json: {
          name: "Negocio de referencia",
          branchName: "Sucursal principal",
          address: "Santo Domingo",
          taxIncluded: true,
          receiptWidth: "80",
          ncfMode: "disabled",
          transferAccounts: [],
          cardTerminals: [],
        },
      });
    if (path === "/api/backups/status")
      return route.fulfill({
        json: { configured: false, missing: [], redirectUri: "" },
      });
    if (path === "/api/survey/summary")
      return route.fulfill({ json: { responses: 0, questions: [] } });
    if (path === "/api/support-access")
      return route.fulfill({ json: { enabled: false, expiresAt: null } });
    if (path === "/api/onboarding")
      return route.fulfill({ json: { available: false } });
    if (path === "/api/events") return route.fulfill({ status: 503, body: "" });
    if (request.method() === "GET") return route.fulfill({ json: [] });
    return route.fulfill({ json: {} });
  });
  return {
    showEmptyEquipment() {
      equipmentState = "empty";
    },
  };
}

async function open(page: Page, hash: string) {
  await page.goto("/#" + hash);
  await expect(page.locator(".main-content h1").first()).toBeVisible();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
}

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "movil", width: 390, height: 844 },
]) {
  test(`auditoría Lumina · Reportes, Configuración y Equipos · ${viewport.name}`, async ({
    page,
    context,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize(viewport);
    await page.addInitScript(
      ([sessionKey, terminalKey]) => {
        sessionStorage.setItem(sessionKey, "sesion-visual-local");
        localStorage.setItem("fitstore-theme", "dark");
        localStorage.setItem(
          terminalKey,
          JSON.stringify({
            id: "terminal-here",
            name: "Equipo principal",
            secret: "secreto-local-de-prueba",
          }),
        );
      },
      [SESSION, "fitstore-equipment:lumina-branch"],
    );
    const fixture = await mockApp(context);

    await open(page, "reports");
    await page.getByLabel("Desde").fill("2026-10-28");
    await page.getByLabel("Hasta").fill("2026-10-27");
    await expect(
      page.getByText("La fecha inicial es posterior a la final."),
    ).toBeVisible();
    await page.screenshot({
      path: screenshotPath(
        `docs/diseno/obsidian-lumina/adentro/auditoria-reportes-rango-invalido-${viewport.name}.png`,
      ),
      fullPage: true,
    });

    await open(page, "settings");
    const sections = page.getByRole("group", {
      name: "Secciones de configuración",
    });
    for (const label of [
      "Negocio y reglas",
      "Usuarios y permisos",
      "Bitácora",
      "Equipos",
    ]) {
      const button = sections.getByRole("button", { name: label });
      await button.click();
      await expect(button).toHaveAttribute("aria-pressed", "true");
    }
    await expect(page.locator(".equipment-item.pending .badge")).toHaveText(
      "Pendiente",
    );
    await expect(page.locator(".equipment-item.approved .badge")).toHaveText(
      "Aprobado",
    );
    await expect(page.locator(".equipment-item.revoked .badge")).toHaveText(
      "Revocado",
    );
    await page.screenshot({
      path: screenshotPath(
        `docs/diseno/obsidian-lumina/adentro/auditoria-equipos-estados-${viewport.name}.png`,
      ),
      fullPage: true,
    });

    fixture.showEmptyEquipment();
    await page.reload();
    await expect(page.locator(".main-content h1").first()).toBeVisible();
    await sections.getByRole("button", { name: "Equipos" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Todavía no hay equipos registrados",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: screenshotPath(
        `docs/diseno/obsidian-lumina/adentro/auditoria-equipos-vacio-${viewport.name}.png`,
      ),
      fullPage: true,
    });
  });
}
