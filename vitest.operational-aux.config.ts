import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/operational-aux.test.ts",
      "tests/conciliar-transferencias.test.ts",
      "tests/courier-utils.test.ts",
    ],
    maxWorkers: 2,
  },
});
