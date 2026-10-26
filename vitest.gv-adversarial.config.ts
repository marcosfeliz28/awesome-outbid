import { defineConfig } from "vitest/config";

// T5: archivo nuevo, independiente de las listas existentes de Vitest.
export default defineConfig({
  test: {
    include: ["tests/adversarial/gv-independent-t5.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 180000,
  },
});
