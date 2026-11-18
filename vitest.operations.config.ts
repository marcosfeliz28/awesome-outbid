import { defineConfig } from "vitest/config";
export default defineConfig({test:{include:["tests/operations-presentation.test.ts","tests/productos-presentacion.test.ts","tests/caja-turnos-presentacion.test.ts","tests/inventario-presentacion.test.ts"],maxWorkers:2}});
