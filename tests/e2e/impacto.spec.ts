import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

// Capa «Modo visual: Impacto» (9-nov-2026): interruptor en Configuración,
// la caja sin animar, movimiento reducido y presupuesto de rendimiento.
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
// Cuenta las View Transitions que pide la app.
const spyTransitions = (page: Page) =>
  page.addInitScript(() => {
    const w = window as any;
    w.__vt = 0;
    const original = document.startViewTransition?.bind(document);
    if (original)
      (document as any).startViewTransition = (cb: () => void) => {
        w.__vt++;
        return original(cb);
      };
  });
const impacto = (page: Page) =>
  page.addInitScript(() => localStorage.setItem("norexos-visual", "impacto"));

test("viene apagada y el administrador la enciende con el teclado en Configuración › Apariencia", async ({
  page,
}) => {
  await login(page);
  await expect(page.locator("html")).toHaveAttribute("data-visual", "estandar");
  await page.evaluate(() => (location.hash = "settings"));
  await page.locator(".tabs.outside button", { hasText: "Apariencia" }).click();
  const check = page.getByLabel("Activar el modo Impacto en este equipo");
  await check.focus();
  await page.keyboard.press("Space");
  await expect(check).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-visual", "impacto");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-visual", "impacto");
  await page.locator(".tabs.outside button", { hasText: "Apariencia" }).click();
  await page.getByLabel("Activar el modo Impacto en este equipo").uncheck();
  await expect(page.locator("html")).toHaveAttribute("data-visual", "estandar");
});

test("en Impacto los cambios de vista usan View Transitions, pero entrar a la caja no", async ({
  page,
}) => {
  await spyTransitions(page);
  await impacto(page);
  await login(page);
  const transitions = () => page.evaluate(() => (window as any).__vt as number);
  const hasApi = await page.evaluate(() => "startViewTransition" in document);
  await page.locator(".nav-item", { hasText: "Reportes" }).click();
  await expect(page).toHaveURL(/#reports/);
  if (hasApi) expect(await transitions()).toBe(1);
  await page.locator(".nav-item", { hasText: "Punto de venta" }).click();
  await expect(page.locator(".pos-shell")).toBeVisible();
  if (hasApi) expect(await transitions()).toBe(1);
  // En la caja nada de la capa aplica: sin cifras que cuentan ni velo en gráficas.
  await expect(page.locator(".pos-shell .count-up")).toHaveCount(0);
  const name = await page
    .locator(".main-content")
    .evaluate((el) => getComputedStyle(el).viewTransitionName);
  expect(name).toBe("none");
});

test("con «reducir movimiento» la capa no anima nada", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await spyTransitions(page);
  await impacto(page);
  await login(page);
  await page.locator(".nav-item", { hasText: "Reportes" }).click();
  await expect(page).toHaveURL(/#reports/);
  expect(await page.evaluate(() => (window as any).__vt)).toBe(0);
  await page.evaluate(() => (location.hash = "demo"));
  await expect(page.locator(".demo-banner")).toBeVisible();
  // Cifras quietas (valor final directo) y sin velo ni destellos.
  await expect(page.locator(".count-up")).toHaveCount(0);
  await expect(page.getByText("RD$ 412,850.00")).toBeVisible();
  const anim = await page.evaluate(() => {
    const wrapper = document.querySelector(".recharts-wrapper");
    const star = document.querySelector(".empty-art .flota");
    return [
      wrapper && getComputedStyle(wrapper, "::after").display,
      star && getComputedStyle(star).animationName,
    ];
  });
  expect(anim).toEqual(["none", "none"]);
});

test("presupuesto: la demostración anima sin tareas largas ni saltos (CLS 0)", async ({
  page,
}, testInfo) => {
  await impacto(page);
  await page.addInitScript(() => {
    const w = window as any;
    w.__long = [];
    w.__shift = [];
    new PerformanceObserver((list) =>
      w.__long.push(...list.getEntries().map((e) => [e.startTime, e.duration])),
    ).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) =>
      w.__shift.push(
        ...list
          .getEntries()
          .map((e: any) => [e.startTime, e.value, e.hadRecentInput]),
      ),
    ).observe({ type: "layout-shift", buffered: true });
  });
  await login(page);
  // Tablero en reposo; desde aquí se mide la demostración.
  await page.waitForTimeout(1500);
  // Tareas largas: desde el cambio de vista. CLS: desde el primer cuadro de la
  // demostración (el pie de página baja al cambiar a una página más corta
  // también en el modo estándar; eso no es de la animación).
  const [t0, t1] = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const start = performance.now();
        const frames = () =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resolve([start, performance.now()])),
          );
        new MutationObserver((_, obs) => {
          if (document.querySelector(".demo-banner")) {
            obs.disconnect();
            frames();
          }
        }).observe(document.body, { childList: true, subtree: true });
        location.hash = "demo";
      }),
  );
  await page.waitForTimeout(1500);
  const result = await page.evaluate(
    ([start, mounted]) => {
      const w = window as any;
      const long = w.__long.filter(([t]: number[]) => t >= start);
      const cls = w.__shift
        .filter(([t, , input]: any[]) => t >= mounted && !input)
        .reduce((sum: number, [, v]: number[]) => sum + v, 0);
      return { long, cls, mountMs: mounted - start };
    },
    [t0, t1],
  );
  await testInfo.attach("medidas-impacto.json", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  expect(result.cls).toBe(0);
  expect(result.long.filter(([, d]: number[]) => d > 50)).toEqual([]);
  // Las cifras terminan en su valor exacto.
  await expect(page.locator(".count-live").first()).toHaveText(
    "RD$ 412,850.00",
  );
});
