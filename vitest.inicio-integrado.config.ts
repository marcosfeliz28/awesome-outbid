import { defineConfig } from "vitest/config";
export default defineConfig({
  test: { include: ["tests/inicio-integrado.test.ts"], environment: "node" },
});
