import { defineConfig, devices } from "@playwright/test";
// Humo de navegador del producto (job verify-product): la PWA compilada con
// VITE_PRODUCT_TENANCY=required reenvía /api a la API en modo producto que
// arranca scripts/verify-product.mjs (FITSTORE_API_PROXY).
const port = Number(process.env.FITSTORE_WEB_PORT || 4273);
export default defineConfig({
  testDir: "tests/e2e-product",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/product" }],
  ],
  outputDir: "test-results/product",
  webServer: {
    command: `pnpm --filter @fitstore/web exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 30000,
    env: {
      FITSTORE_API_PROXY:
        process.env.FITSTORE_API_PROXY || "http://127.0.0.1:3101",
    },
  },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
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
