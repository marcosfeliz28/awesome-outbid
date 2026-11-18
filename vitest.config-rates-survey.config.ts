import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/config-rates-survey-language.test.ts"],
    maxWorkers: 2,
  },
});
