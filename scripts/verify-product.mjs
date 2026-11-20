// Verificación del PRODUCTO en vivo (job verify-product de ci.yml): arranca la
// API compilada como en Render (with-cloud-env.mjs, NODE_ENV=production,
// PRODUCT_TENANCY=required, registro público cerrado) sobre la base de
// DATABASE_URL, ya preparada con el preDeploy real; luego corre
// vitest.product-integration.config.ts y el humo de navegador
// (playwright.product.config.ts). Antes: `pnpm build` con
// VITE_PRODUCT_TENANCY=required y `node deploy/render/producto-predeploy.mjs`.
// Solo contra una base y una API de este equipo (Q-01).
import { createHash, randomBytes } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { launch, remoteTarget, run, stop, targets } from "./verify.mjs";

const port = process.env.NEXORA_PRODUCT_API_PORT || "3101";
const webPort = process.env.FITSTORE_WEB_PORT || "4273";
const api = `http://127.0.0.1:${port}/api`;
// Token de operador desechable de esta corrida: la API solo recibe su sha256.
const platformToken = randomBytes(32).toString("hex");
const testEnv = {
  ...process.env,
  FITSTORE_API_URL: api,
  FITSTORE_API_PROXY: `http://127.0.0.1:${port}`,
  FITSTORE_WEB_PORT: webPort,
  NEXORA_CI_PLATFORM_TOKEN: platformToken,
  NEXORA_CI_DATABASE_URL: process.env.DATABASE_URL,
};
const apiEnv = {
  ...process.env,
  NODE_ENV: "production",
  PORT: port,
  ENABLE_SWAGGER: "false",
  PRODUCT_TENANCY: "required",
  PRODUCT_PUBLIC_REGISTRATION: "disabled",
  PLATFORM_ADMIN_TOKEN_SHA256: createHash("sha256")
    .update(platformToken)
    .digest("hex"),
  APP_PUBLIC_URL: `http://127.0.0.1:${webPort}`,
  WEB_ORIGIN: `http://127.0.0.1:${webPort}`,
  JWT_SECRET: randomBytes(32).toString("hex"),
  // Datos bancarios ficticios: solo habilitan «pedir pago» de una empresa suspendida.
  NEXORA_BILLING_BANK_NAME: "Banco ficticio CI",
  NEXORA_BILLING_BANK_ACCOUNT: "000-0000000-0",
  NEXORA_BILLING_BANK_HOLDER: "Titular ficticio CI",
};
for (const key of ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "RESEND_API_KEY"])
  delete apiEnv[key];

let child;
let code = 1;
try {
  const problem = remoteTarget(targets(testEnv), testEnv);
  if (problem) throw new Error(problem);
  if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL.");
  if (
    await fetch(api + "/health").then(
      (r) => r.ok,
      () => false,
    )
  )
    throw new Error(`Ya hay una API en :${port}; detenla antes.`);
  child = launch(
    "node",
    ["deploy/render/with-cloud-env.mjs", "apps/api/dist/main.js"],
    "api-product",
    { env: apiEnv },
  );
  const until = Date.now() + 60000;
  while (
    !(await fetch(api + "/health").then(
      (r) => r.ok,
      () => false,
    ))
  ) {
    if (Date.now() > until || child.exitCode !== null)
      throw new Error(
        "La API de producto no arrancó (test-results/api-product.log).",
      );
    await sleep(250);
  }
  code = await run(
    "pnpm",
    [
      "exec",
      "vitest",
      "run",
      "--config",
      "vitest.product-integration.config.ts",
    ],
    { env: testEnv },
  );
  if (code === 0)
    code = await run(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        "--config",
        "playwright.product.config.ts",
      ],
      { env: testEnv },
    );
} catch (error) {
  console.error(error);
  code = 1;
} finally {
  if (child) await stop(child);
}
process.exit(code);
