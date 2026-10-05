import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["packages/shared/**/*.test.ts", "tests/invoice.test.ts"] },
});
