import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cloudEnvironment } from "../deploy/render/with-cloud-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("Render · aislamiento reproducible", () => {
  it("declara una sola entrada pública, API privada y PostgreSQL cerrado", () => {
    const blueprint = read("render.yaml");
    expect(blueprint.match(/^\s*- type: web$/gm)).toHaveLength(1);
    expect(blueprint.match(/^\s*- type: pserv$/gm)).toHaveLength(1);
    expect(blueprint).toContain("name: nexora-pos-web");
    expect(blueprint).toContain("name: nexora-pos-api");
    expect(blueprint).toContain("name: nexora-pos-db");
    expect(blueprint).toContain("ipAllowList: []");
    expect(blueprint).toContain("property: hostport");
    expect(blueprint).toContain("property: connectionString");
    expect(blueprint).toContain("envVarKey: RENDER_EXTERNAL_URL");
    expect(blueprint.match(/region: virginia/g)).toHaveLength(3);
    expect(blueprint.match(/plan: 0\.5c-512mb/g)).toHaveLength(2);
    expect(blueprint).toContain("plan: 0.1c-256mb");
    expect(blueprint).toContain('postgresMajorVersion: "17"');
    expect(blueprint).toContain("diskSizeGB: 1");
    expect(blueprint.match(/autoDeployTrigger: off/g)).toHaveLength(2);
    expect(blueprint).toContain("healthCheckPath: /healthz");
  });

  it("aplica migraciones antes de publicar y no ejecuta seed ni db push", () => {
    const blueprint = read("render.yaml");
    const command = blueprint
      .split("\n")
      .find((line) => line.trimStart().startsWith("preDeployCommand:"));
    expect(command).toContain("with-cloud-env.mjs");
    expect(command).toContain("migrate deploy");
    expect(command).not.toMatch(/\b(seed|db push)\b/);
  });

  it("no incorpora credenciales literales en los archivos cloud", () => {
    const content = [
      read("render.yaml"),
      read("deploy/render/Dockerfile.api"),
      read("deploy/render/Dockerfile.web"),
      read("deploy/render/nginx.conf.template"),
      read("deploy/render/start-nginx.sh"),
      read("deploy/render/with-cloud-env.mjs"),
    ].join("\n");
    expect(content).not.toMatch(/postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i);
    expect(content).not.toMatch(
      /(?:password|secret|api[_-]?key)\s*[:=]\s*["'][^"']+["']/i,
    );
    expect(content).toContain("generateValue: true");
  });
});

describe("Render · conexión de PostgreSQL", () => {
  it("añade TLS y UTC sin perder parámetros ni propagar la variable intermedia", () => {
    const env = cloudEnvironment({
      RENDER_DATABASE_URL:
        "postgresql://nexora:p%40ss@db.internal:5432/fitstore?application_name=pos",
      WEB_ORIGIN: "https://nexora.example",
    } as NodeJS.ProcessEnv);
    const parsed = new URL(env.DATABASE_URL!);
    expect(parsed.protocol).toBe("postgresql:");
    expect(parsed.hostname).toBe("db.internal");
    expect(parsed.searchParams.get("sslmode")).toBe("require");
    expect(parsed.searchParams.get("options")).toBe("-c TimeZone=UTC");
    expect(parsed.searchParams.get("application_name")).toBe("pos");
    expect(env.RENDER_DATABASE_URL).toBeUndefined();
    expect(env.WEB_ORIGIN).toBe("https://nexora.example");
  });

  it("respeta DATABASE_URL local cuando no está dentro de Render", () => {
    const local = "postgresql://fitstore:local@127.0.0.1:5434/fitstore";
    expect(cloudEnvironment({ DATABASE_URL: local }).DATABASE_URL).toBe(local);
  });

  it("rechaza conexiones ausentes, dañadas o de otro protocolo", () => {
    expect(() => cloudEnvironment({})).toThrow(/Falta la conexión/);
    expect(() =>
      cloudEnvironment({ RENDER_DATABASE_URL: "no-es-url" }),
    ).toThrow(/no es una URL válida/);
    expect(() =>
      cloudEnvironment({ RENDER_DATABASE_URL: "https://db.internal/base" }),
    ).toThrow(/no usa PostgreSQL/);
  });
});

describe("Render · operación inicial", () => {
  it("documenta el bootstrap real del administrador, no un modo inexistente", () => {
    const guide = read("docs/DEPLOY-RENDER.md");
    expect(guide).toContain("`ADMIN_MODE=bootstrap`");
    expect(guide).toContain(
      "node deploy/render/with-cloud-env.mjs node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/create-admin.ts",
    );
    expect(guide).not.toContain("ADMIN_MODE=create");
  });
});

describe("Render · proxy público", () => {
  it("resuelve de nuevo la API privada y conserva SSE sin buffering", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    expect(nginx).toContain("resolver ${NGINX_RESOLVER} valid=10s ipv6=off;");
    expect(nginx).toContain("server ${API_UPSTREAM} resolve;");
    expect(nginx).toContain("zone nexora_api 64k;");
    expect(nginx).toContain("location = /api/events");
    expect(nginx).toContain("proxy_buffering off;");
    expect(nginx).toContain("location = /healthz");
    expect(nginx).toContain("return 204;");
  });

  it("reemplaza X-Forwarded-For por la IP confiable de la capa pública", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    expect(nginx).toContain("$http_cf_connecting_ip $nexora_client_ip");
    expect(
      nginx.match(/proxy_set_header X-Forwarded-For \$nexora_client_ip;/g),
    ).toHaveLength(2);
    expect(nginx).not.toContain("$proxy_add_x_forwarded_for");
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto https;");
  });

  it("fija una versión de Nginx compatible y valida valores antes de sustituirlos", () => {
    const dockerfile = read("deploy/render/Dockerfile.web");
    const apiDockerfile = read("deploy/render/Dockerfile.api");
    expect(dockerfile).toContain("FROM node:24.21.0-bookworm-slim AS build");
    expect(
      apiDockerfile.match(/FROM node:24\.21\.0-bookworm-slim/g),
    ).toHaveLength(2);
    const entrypoint = read("deploy/render/start-nginx.sh");
    expect(dockerfile).toContain("FROM nginx:1.30.5-alpine3.24");
    expect(dockerfile).toContain(
      'NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|NGINX_RESOLVER|PORT)$"',
    );
    expect(entrypoint).toContain("/etc/resolv.conf");
    expect(entrypoint).toContain("API_UPSTREAM no tiene el formato");
    expect(entrypoint).toContain('api_host="${api_host}-discovery"');
    expect(entrypoint).toContain('API_UPSTREAM="${api_host}:${api_port}"');
    expect(entrypoint).toContain('exec /docker-entrypoint.sh "$@"');
  });

  it("las imágenes copian todos los archivos y herramientas que invocan", () => {
    const api = read("deploy/render/Dockerfile.api");
    const web = read("deploy/render/Dockerfile.web");
    const apiPackage = JSON.parse(read("apps/api/package.json"));
    const webPackage = JSON.parse(read("apps/web/package.json"));
    for (const source of [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".npmrc",
      "tsconfig.base.json",
      "apps/api",
      "packages/shared",
      "deploy/render/with-cloud-env.mjs",
    ])
      expect(api).toContain(source);
    for (const source of [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".npmrc",
      "tsconfig.base.json",
      "apps/web",
      "packages/shared",
      "packages/ui",
    ])
      expect(web).toContain(source);
    expect(apiPackage.devDependencies).toMatchObject({
      "@types/node": expect.any(String),
      prisma: "6.19.0",
      tsx: expect.any(String),
      typescript: "~5.9.3",
    });
    expect(webPackage.devDependencies).toMatchObject({
      "@types/node": expect.any(String),
      typescript: "~5.9.3",
      vite: expect.any(String),
    });
  });
});
