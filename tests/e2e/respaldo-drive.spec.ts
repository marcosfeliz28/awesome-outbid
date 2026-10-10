// Respaldo diario a Google Drive: la tarjeta de Configuración › Negocio y
// reglas (sólo administración). La API de las pruebas corre sin las variables
// de Google, así que el primer caso ve el estado real «No configurado»; los
// demás simulan las respuestas de /api/backups/* (la integración con un Google
// falso y una base real está en tests/drive-backup.test.ts).
import type { Page } from "@playwright/test";
import { test, expect, screenshotPath } from "./apoyo";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function openSettings(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  if (width < 1000)
    await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("button", { name: "Configuración", exact: true })
    .click();
  const card = page.locator("section.drive-card");
  await expect(
    card.getByRole("heading", { name: "Respaldo diario a Google Drive" }),
  ).toBeVisible();
  return card;
}
async function noOverflow(page: Page, width: number) {
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth - window.innerWidth,
    clipped: [...document.querySelectorAll("section.drive-card *")].filter(
      (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 1;
      },
    ).length,
  }));
  expect(overflow.page, "scrollWidth @" + width).toBeLessThanOrEqual(1);
  expect(overflow.clipped, "recortes @" + width).toBe(0);
}

const base = {
  configured: true,
  missing: [],
  redirectUri: "https://pos.example.com/api/backups/google/callback",
  folderName: "Nexora POS respaldos",
  connected: true,
  needsReconnect: false,
  account: "d•••@gmail.com",
  connectedAt: "2026-10-01T12:00:00.000Z",
  running: false,
  runningSince: null,
  lastRun: null,
  lastSuccess: null,
  consecutiveFailures: 0,
  nextRunAt: "2026-10-11T07:30:00.000Z",
  telegramAlerts: true,
};

for (const width of [1280, 390])
  test(`Respaldo a Drive @${width}: sin las variables dice «No configurado» y no ofrece conectar`, async ({
    page,
  }) => {
    await login(page);
    const card = await openSettings(page, width);
    await expect(
      card.getByText("No configurado", { exact: true }),
    ).toBeVisible();
    await expect(card.getByText(/GOOGLE_OAUTH_CLIENT_ID/)).toBeVisible();
    await expect(card.getByText(/docs\/RESPALDO_DRIVE\.md/)).toBeVisible();
    await expect(card.getByRole("button")).toHaveCount(0);
    await noOverflow(page, width);
  });

test("Respaldo a Drive @390: estado, error, «Respaldar ahora» y «Desconectar» caben y funcionan", async ({
  page,
}) => {
  let status: any = {
    ...base,
    lastRun: {
      at: "2026-10-10T07:31:00.000Z",
      trigger: "schedule",
      status: "failed",
      error: "Google Drive respondió HTTP 503.",
      durationMs: 1200,
    },
    lastSuccess: {
      at: "2026-10-09T07:32:00.000Z",
      size: 2.4 * 1024 * 1024,
      fileName: "nexora-2026-10-09-0332.dump.enc",
    },
    consecutiveFailures: 1,
  };
  const calls: string[] = [];
  await page.route("**/api/backups/**", async (route) => {
    const url = new URL(route.request().url());
    calls.push(route.request().method() + " " + url.pathname);
    if (url.pathname.endsWith("/backups/status"))
      return route.fulfill({ json: status });
    if (url.pathname.endsWith("/backups/run")) {
      status = { ...status, running: true };
      return route.fulfill({
        status: 201,
        json: {
          started: true,
          message:
            "Respaldo iniciado. Tarda unos minutos; el estado se actualiza solo.",
        },
      });
    }
    if (url.pathname.endsWith("/google/disconnect")) {
      status = { ...base, connected: false, account: null, nextRunAt: null };
      return route.fulfill({ status: 201, json: { connected: false } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await login(page);
  const card = await openSettings(page, 390);
  await expect(card.getByText("Último intento falló")).toBeVisible();
  await expect(
    card.getByText(/Último respaldo bueno: 9 de octubre/),
  ).toBeVisible();
  await expect(card.getByText(/2\.4 MB/)).toBeVisible();
  await expect(
    card.getByText(/falló: Google Drive respondió HTTP 503/),
  ).toBeVisible();
  await expect(card.getByText("d•••@gmail.com")).toBeVisible();
  await expect(card.getByText(/te avisamos por Telegram/)).toBeVisible();
  await noOverflow(page, 390);
  await card.screenshot({
    path: screenshotPath("docs/capturas/respaldo-drive-390.png"),
  });
  // Botones grandes para el dedo.
  for (const name of ["Respaldar ahora", "Desconectar"]) {
    const box = (await card.getByRole("button", { name }).boundingBox())!;
    expect(box.height, name).toBeGreaterThanOrEqual(44);
  }

  await card.getByRole("button", { name: "Respaldar ahora" }).click();
  await expect(page.getByText(/Respaldo iniciado/)).toBeVisible();
  await expect(
    card.getByRole("button", { name: "Respaldando…" }),
  ).toBeDisabled();
  status = { ...status, running: false };
  await page.reload();
  const again = await openSettings(page, 390);

  await again.getByRole("button", { name: "Desconectar" }).click();
  const dialog = page.getByRole("dialog", {
    name: "¿Desconectar Google Drive?",
  });
  await expect(dialog).toContainText("no se borran");
  await dialog.getByRole("button", { name: "Sí, desconectar" }).click();
  await expect(page.getByText(/quedó desconectado/)).toBeVisible();
  await expect(
    again.getByRole("button", { name: "Conectar con Google" }),
  ).toBeVisible();
  expect(calls).toContain("POST /api/backups/run");
  expect(calls).toContain("POST /api/backups/google/disconnect");
});

test("Respaldo a Drive @1280: «Conectar con Google» abre Google y a la vuelta avisa y limpia la dirección", async ({
  page,
}) => {
  let connected = false;
  await page.route("**/api/backups/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/backups/status"))
      return route.fulfill({
        json: connected
          ? { ...base, lastSuccess: null }
          : {
              ...base,
              connected: false,
              needsReconnect: true,
              account: null,
              nextRunAt: null,
            },
      });
    if (url.pathname.endsWith("/google/connect")) {
      connected = true;
      // En vez de Google, la misma vuelta que hace la API tras el permiso.
      return route.fulfill({ json: { url: "/?drive=connected#settings" } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  await login(page);
  const card = await openSettings(page, 1280);
  await expect(card.getByText(/Google retiró el permiso/)).toBeVisible();
  await expect(card.getByText("Hay que reconectar")).toBeVisible();
  await card.getByRole("button", { name: "Conectar con Google" }).click();
  await expect(page.getByText(/Google Drive quedó conectado/)).toBeVisible();
  await expect(page).toHaveURL(/\/#settings$/);
  const after = page.locator("section.drive-card");
  await expect(after.getByText("Conectado", { exact: true })).toBeVisible();
  await expect(
    after.getByText("Todavía no hay ningún respaldo."),
  ).toBeVisible();
  await expect(
    after.getByRole("button", { name: "Respaldar ahora" }),
  ).toBeVisible();
  await noOverflow(page, 1280);
  await after.screenshot({
    path: screenshotPath("docs/capturas/respaldo-drive-1280.png"),
  });
});

test("Respaldo a Drive: gerencia no ve la tarjeta", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("gerente@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
  const settings = page.getByRole("button", {
    name: "Configuración",
    exact: true,
  });
  if (await settings.count()) {
    await settings.click();
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
  }
  await expect(page.locator("section.drive-card")).toHaveCount(0);
});
