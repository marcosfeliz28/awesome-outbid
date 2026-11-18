import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/merchandise-premium.test.ts"], maxWorkers: 1 } });
