import { defineConfig, devices } from "@playwright/test";
// Puerto de la vista previa que arranca Playwright. Por defecto 4173 y, si ya
// hay una abierta ahí, se reutiliza. Otra copia del proyecto que corra la suite
// a la vez elige su puerto con FITSTORE_WEB_PORT: así no prueba, sin avisar, la
// compilación de la primera (con puerto propio no se reutiliza nada: si está
// ocupado, la corrida falla). Con FITSTORE_WEB_URL no se arranca nada.
const ownPort = process.env.FITSTORE_WEB_PORT;
const port = Number(ownPort || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error(
    "FITSTORE_WEB_PORT debe ser un puerto (1 a 65535): " + ownPort,
  );
const preview = "http://127.0.0.1:" + port;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  webServer: process.env.FITSTORE_WEB_URL
    ? undefined
    : {
        command: `pnpm --filter @fitstore/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
        url: preview,
        reuseExistingServer: !process.env.CI && !ownPort,
        timeout: 30000,
        // La vista previa reenvía /api a FITSTORE_API_PROXY (vite.config.ts).
        env: process.env.FITSTORE_API_PROXY
          ? { FITSTORE_API_PROXY: process.env.FITSTORE_API_PROXY }
          : {},
      },
  use: {
    baseURL: process.env.FITSTORE_WEB_URL || preview,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
  ],
});
