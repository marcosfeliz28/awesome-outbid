import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/store-settings-language.test.ts"], maxWorkers: 2 } });
