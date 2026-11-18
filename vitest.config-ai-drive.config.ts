import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/config-ai-drive-language.test.ts", "tests/ai-usage.test.ts", "tests/drive-backup-core.test.ts"], maxWorkers: 1 } });
