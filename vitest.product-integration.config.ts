import { defineConfig } from "vitest/config";

// Pruebas contra la API compilada en modo producto (PRODUCT_TENANCY=required)
// que arranca scripts/verify-product.mjs (job verify-product de ci.yml).
// Las suites compartidas de vitest.integration.config.ts no corren aquí: usan
// el login demo y SQL de la empresa Demo.
export default defineConfig({
  test: {
    globalSetup: ["tests/product-live/setup.ts"],
    include: ["tests/product-live/**/*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 120000,
    fileParallelism: false,
  },
});
