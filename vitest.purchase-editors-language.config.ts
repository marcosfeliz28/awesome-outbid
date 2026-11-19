import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/purchase-editors-language.test.ts", "tests/operaciones-language.test.ts", "tests/operations-presentation.test.ts", "tests/productos-presentacion.test.ts", "tests/caja-turnos-presentacion.test.ts"], maxWorkers: 2 } });
