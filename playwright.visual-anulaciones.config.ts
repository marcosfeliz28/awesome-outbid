import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  testMatch: "visual-anulaciones-02.spec.ts",
  workers: 1,
  timeout: 60000,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5282",
    serviceWorkers: "block",
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined },
  },
  webServer: {
    command:
      "cd apps/web && node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5282 --strictPort",
    url: "http://127.0.0.1:5282",
    reuseExistingServer: false,
  },
});
