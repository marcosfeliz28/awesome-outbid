import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  testMatch: [
    "visual-inicio-higgsfield.spec.ts",
    "visual-caja-higgsfield.spec.ts",
  ],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: [["list"]],
  webServer: {
    command:
      "pnpm --filter @fitstore/web exec vite preview --host 127.0.0.1 --port 4182 --strictPort",
    url: "http://127.0.0.1:4182",
    reuseExistingServer: false,
    timeout: 30_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4182",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
