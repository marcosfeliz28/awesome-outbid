import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: [
      "tests/inventario-presentacion.test.ts",
      "tests/inventory-language.test.ts",
    ],
  },
});
