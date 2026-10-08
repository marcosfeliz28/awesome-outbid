import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "packages/shared/**/*.test.ts",
      "tests/invoice.test.ts",
      "tests/realtime.test.ts",
      "tests/inventario.test.ts",
      "tests/portabilidad.test.ts",
      "tests/e2e-higiene.test.ts",
      "tests/offline-policy.test.ts",
      "tests/cloud-deploy.test.ts",
      "tests/auth-username.test.ts",
    ],
  },
});
