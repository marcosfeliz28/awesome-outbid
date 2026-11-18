import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "visual-inventario-higgsfield.spec.ts",
  workers: 1,
  timeout: 30000,
  retries: 0,
  outputDir: "test-results/higgsfield-inventario",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5198",
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
    serviceWorkers: "block",
    screenshot: "only-on-failure",
  },
  webServer: {
    command:
      "cd apps/web && pnpm exec vite --host 127.0.0.1 --port 5198 --strictPort",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: false,
  },
});
