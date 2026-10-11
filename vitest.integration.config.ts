import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    // Falla de inmediato si la API de :3001 (u otra) no es la de este repositorio.
    globalSetup: ["tests/setup/integration-api.ts"],
    include: [
      "tests/api.test.ts",
      "tests/caja-por-usuario.test.ts",
      "tests/caja-fondo-sugerido.test.ts",
      "tests/dinero-auditoria.test.ts",
      "tests/minors.test.ts",
      "tests/telegram.test.ts",
      "tests/promotion-name.test.ts",
      "tests/incentives-api.test.ts",
      "tests/password-account.test.ts",
      "tests/perf-api.test.ts",
      "tests/drive-backup.test.ts",
      "tests/auth-lockout.test.ts",
      "tests/offline-review-api.test.ts",
      "tests/datos-concurrencia-api.test.ts",
      "tests/inventory-import-api.test.ts",
      "tests/alertas-postgres.test.ts",
      "tests/restos-api.test.ts",
      "tests/credito-api.test.ts",
      "tests/calidad-dinero-api.test.ts",
      "tests/calidad-seguridad-api.test.ts",
      "tests/void-requests-api.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
