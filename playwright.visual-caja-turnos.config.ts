import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "./tests",
  testMatch: "visual-caja-turnos-higgsfield.spec.ts",
  workers: 1,
  timeout: 30000,
  retries: 0,
  outputDir: "test-results/higgsfield-caja-turnos",
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5191",
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
      "cd apps/web && pnpm exec vite --host 127.0.0.1 --port 5191 --strictPort",
    url: "http://127.0.0.1:5191",
    reuseExistingServer: false,
  },
});
