import { describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, readdirSync } from "node:fs";
import { promisify } from "node:util";
import {
  EXPECTED_CONSTRAINTS,
  EXPECTED_INDEXES,
  EXPECTED_TRIGGER,
  evaluateDatabaseFacts,
} from "../deploy/render/post-deploy-check.mjs";

// Auditoría 04 N2 y 06 D-M9: Prisma no muestra los NOTICE de las migraciones;
// post-deploy-check.mjs comprueba, de solo lectura, que índices, restricciones
// y disparador existan y sean válidos. La lectura contra PostgreSQL real está
// en tests/datos-integridad-postgres.test.ts.

const run = promisify(execFile);
const script = "deploy/render/post-deploy-check.mjs";
const cleanEnv = () => {
  const env = { ...process.env, NEXORA_CHECK_ATTEMPTS: "1" };
  for (const key of [
    "RENDER_DATABASE_URL",
    "DATABASE_URL",
    "NEXORA_WEB_URL",
    "NEXORA_API_URL",
    "GITHUB_ACTIONS",
  ])
    delete env[key];
  return env;
};
const healthy = () => ({
  invalidIndexes: [] as string[],
  indexes: Object.fromEntries(EXPECTED_INDEXES.map((n) => [n, true])),
  constraints: Object.fromEntries(EXPECTED_CONSTRAINTS.map((n) => [n, true])),
  notValid: [] as string[],
  trigger: true,
  authAttemptUpdatedAt: true,
  planCacheMode: "force_custom_plan",
});

describe("post-deploy-check · base de datos", () => {
  it("una base sana no produce fallos ni avisos", () => {
    expect(evaluateDatabaseFacts(healthy())).toEqual({
      failures: [],
      warnings: [],
    });
  });

  it("cada defecto falla (o avisa) nombrando el objeto", () => {
    const f = (change: (facts: ReturnType<typeof healthy>) => void) => {
      const facts = healthy();
      change(facts);
      return evaluateDatabaseFacts(facts);
    };
    expect(
      f((x) => x.invalidIndexes.push("Sale_customerId_idx")).failures[0],
    ).toMatch(/índices inválidos.*Sale_customerId_idx/);
    // D-M9: Variant_sku_ci_key ausente.
    expect(
      f((x) => delete (x.indexes as any).Variant_sku_ci_key).failures[0],
    ).toMatch(/faltan índices.*Variant_sku_ci_key/);
    expect(
      f((x) => delete (x.constraints as any).sale_status_valid).failures[0],
    ).toMatch(/faltan restricciones.*sale_status_valid/);
    expect(
      f((x) => x.notValid.push("purchase_item_quantities_valid")).failures[0],
    ).toMatch(/sin validar.*purchase_item_quantities_valid/);
    expect(f((x) => (x.trigger = false)).failures[0]).toContain(
      EXPECTED_TRIGGER,
    );
    expect(f((x) => (x.authAttemptUpdatedAt = false)).failures[0]).toContain(
      "updatedAt",
    );
    const plan = f((x) => (x.planCacheMode = "auto"));
    expect(plan.failures).toEqual([]);
    expect(plan.warnings[0]).toMatch(/plan_cache_mode = auto/);
  });

  it("todo nombre esperado lo crea alguna migración", () => {
    const dir = "apps/api/prisma/migrations";
    const sql = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => readFileSync(`${dir}/${e.name}/migration.sql`, "utf8"))
      .join("\n");
    for (const name of [
      ...EXPECTED_INDEXES,
      ...EXPECTED_CONSTRAINTS,
      EXPECTED_TRIGGER,
    ])
      expect(sql, name).toContain(name);
  });
});

describe("post-deploy-check · línea de órdenes", () => {
  it("sin destinos termina con 2; --db-only sin base falla con un mensaje claro", async () => {
    await expect(
      run("node", [script], { env: cleanEnv() }),
    ).rejects.toMatchObject({ code: 2 });
    const failed = await run("node", [script, "--db-only"], {
      env: cleanEnv(),
    }).catch((e) => e);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toMatch(/falta RENDER_DATABASE_URL o DATABASE_URL/);
  });

  it("con --db y una base inalcanzable falla sin imprimir la URL", async () => {
    const url = "postgresql://usuario:clave-secreta@127.0.0.1:1/x";
    const failed = await run("node", [script, "--db-only"], {
      env: { ...cleanEnv(), DATABASE_URL: url },
      timeout: 60_000,
    }).catch((e) => e);
    expect(failed.code).toBe(1);
    expect(failed.stderr).toMatch(/no se pudo leer la base de datos/);
    expect(failed.stdout + failed.stderr).not.toContain("clave-secreta");
  });

  it("solo con la URL de la web verifica /api/health y avisa que omitió la base", async () => {
    const server = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      res.end(req.url === "/api/health" ? '{"status":"ok"}' : "{}");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const { port } = server.address() as { port: number };
    try {
      const ok = await run("node", [script, `http://127.0.0.1:${port}`], {
        env: { ...cleanEnv(), GITHUB_ACTIONS: "true" },
      });
      expect(ok.stdout).toContain("web: ok");
      expect(ok.stderr).toMatch(/AVISO .*OMITIDA/);
      expect(ok.stdout).toContain("::warning::");
    } finally {
      server.close();
    }
  });
});
