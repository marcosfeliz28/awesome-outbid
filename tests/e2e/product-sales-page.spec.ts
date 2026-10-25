import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { test, expect } from "./apoyo";

let productWeb: ChildProcess | undefined;
let productOrigin = "";

async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No se pudo reservar un puerto para la página comercial.");
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

async function waitForProductWeb(origin: string, child: ChildProcess) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(
        `La web de producto terminó con código ${child.exitCode}.`,
      );
    if (
      await fetch(origin)
        .then((response) => response.ok)
        .catch(() => false)
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("La web de producto no arrancó en 30 segundos.");
}

test.describe("Página pública de planes", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    const port = await freePort();
    productOrigin = `http://127.0.0.1:${port}`;
    productWeb = spawn(
      "pnpm",
      [
        "--filter",
        "@fitstore/web",
        "exec",
        "vite",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, VITE_PRODUCT_TENANCY: "required" },
        stdio: "ignore",
      },
    );
    await waitForProductWeb(productOrigin, productWeb);
  });

  test.afterAll(async () => {
    if (!productWeb || productWeb.exitCode !== null) return;
    productWeb.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5_000);
      productWeb?.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  });

  test("mantiene el acceso en / y descubre /planes con teclado", async ({
    page,
  }) => {
    await page.goto(productOrigin + "/");
    await expect(
      page.getByRole("heading", { name: "Un nuevo día para crecer." }),
    ).toBeVisible();

    const plansLink = page.getByRole("link", {
      name: "Ver planes de Nexora POS",
    });
    await expect(plansLink).toBeVisible();
    await plansLink.focus();
    await expect(plansLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(productOrigin + "/planes");
  });

  for (const width of [320, 390, 1280]) {
    test(`presenta los planes y pagos manuales a ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(productOrigin + "/planes");

      await expect(page.getByRole("banner")).toBeVisible();
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("contentinfo")).toBeVisible();

      for (const price of ["1,250", "2,000", "4,000", "7,000"])
        await expect(
          page.getByText(`RD$${price}`, { exact: false }),
        ).toBeVisible();

      await expect(page.getByText(/transferencia/i).first()).toBeVisible();
      await expect(page.getByText(/efectivo/i).first()).toBeVisible();
      await expect(
        page.getByRole("button", { name: /tarjeta|pasarela/i }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("link", { name: /pagar con tarjeta|pasarela/i }),
      ).toHaveCount(0);
      await expect(page.getByLabel(/número de tarjeta/i)).toHaveCount(0);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `desbordamiento a ${width} px`).toBeLessThanOrEqual(1);

      const undersized = await page
        .locator("a:visible, button:visible")
        .evaluateAll((controls) =>
          controls
            .map((control) => {
              const box = control.getBoundingClientRect();
              return {
                label:
                  control.textContent?.trim() ||
                  control.getAttribute("aria-label"),
                width: box.width,
                height: box.height,
              };
            })
            .filter(({ width, height }) => width < 44 || height < 44),
        );
      expect(undersized, "controles menores de 44 × 44 px").toEqual([]);

      const annualPriceColor = await page
        .locator(".sales-plan-annual strong")
        .first()
        .evaluate((element) => getComputedStyle(element).color);
      expect(annualPriceColor).toBe("rgb(247, 251, 255)");

      if (width === 1280) {
        const priceLine = page.locator(".sales-plan-price").nth(1);
        const [priceBox, suffixBox] = await Promise.all([
          priceLine.locator("strong").boundingBox(),
          priceLine.locator("span").boundingBox(),
        ]);
        expect(priceBox).not.toBeNull();
        expect(suffixBox).not.toBeNull();
        expect(suffixBox!.x).toBeGreaterThan(priceBox!.x + priceBox!.width);
        expect(suffixBox!.y).toBeLessThan(priceBox!.y + priceBox!.height);
      }
    });
  }

  test("respeta reducir movimiento", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(productOrigin + "/planes");
    const duration = await page
      .locator(".sales-button")
      .first()
      .evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(duration).toMatch(/^(?:0s|0\.00001s|1e-05s|0\.01ms)$/);
  });
});
