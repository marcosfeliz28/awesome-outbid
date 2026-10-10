import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/api.test.ts",
      "tests/dinero-auditoria.test.ts",
      "tests/minors.test.ts",
      "tests/telegram.test.ts",
      "tests/promotion-name.test.ts",
      "tests/incentives-api.test.ts",
      "tests/password-account.test.ts",
      "tests/perf-api.test.ts",
      "tests/drive-backup.test.ts",
      "tests/auth-lockout.test.ts",
      "tests/offline-review-api.test.ts",
      "tests/datos-concurrencia-api.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
