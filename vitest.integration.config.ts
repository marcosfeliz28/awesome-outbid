import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/api.test.ts",
      "tests/minors.test.ts",
      "tests/telegram.test.ts",
      "tests/promotion-name.test.ts",
      "tests/incentives-api.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
