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

describe("Respaldo cloud · tarea Windows", () => {
  it("se ejecuta como usuario limitado al iniciar sesión y diariamente, sin guardar claves", () => {
    const task = read("scripts/Register-NexoraCloudBackupTask.ps1");
    const runner = read("scripts/Invoke-NexoraCloudBackupTask.ps1");
    expect(task).toContain("SupportsShouldProcess = $true");
    expect(task).toContain("New-ScheduledTaskTrigger -AtLogOn");
    expect(task).toContain("New-ScheduledTaskTrigger -Daily");
    expect(task).toContain("-StartWhenAvailable");
    expect(task).toContain("-LogonType Interactive -RunLevel Limited");
    expect(task).toContain("configure list-profiles");
    expect(task).not.toMatch(
      /AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|SecretAccessKey/i,
    );
    expect(task).toContain("pull-cloud-backup.ps1");
    expect(runner).toContain("& $backupScript");
    expect(read("docs/RESPALDO_CLOUD_RENDER.md")).toContain(
      "Register-NexoraCloudBackupTask.ps1",
    );
  });
});

describe("Render · proxy público", () => {
  it("agrega cabeceras de seguridad sin bloquear PWA, cámara ni Sentry", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const headers = read("deploy/render/security-headers.conf");
    const monitoring = read("apps/web/src/monitoring.ts");
    const dsn = monitoring.match(/const SENTRY_DSN\s*=\s*"([^"]+)"/)?.[1];
    expect(dsn).toBeTruthy();
    for (const name of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
    ])
      expect(headers).toContain(name);
    expect(headers).toContain("worker-src 'self' blob:");
    expect(headers).toContain("camera=(self)");
    expect(headers).toContain(new URL(dsn!).origin);
    expect(
      nginx.match(
        /include \/etc\/nginx\/snippets\/nexora-security-headers.conf;/g,
      ),
    ).toHaveLength(11);
    // HSTS cubre subdominios.
    expect(headers).toContain(
      'Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    );
  });

  it("deja una sola fuente de cabeceras de seguridad también en /api", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const headers = read("deploy/render/security-headers.conf");
    // Las cabeceras que Helmet añade en la API se descartan (en /api/ y en
    // /api/events) para que no lleguen duplicadas ni contradictorias.
    for (const name of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
    ])
      expect(nginx.split(`proxy_hide_header ${name};`)).toHaveLength(3);
    expect(nginx).toContain("location ^~ /api/ {");
    // /api conserva `no-referrer`, más estricto que lo que usa la web.
    expect(nginx).toContain('~^/api/ "no-referrer";');
    expect(headers).toContain(
      "add_header Referrer-Policy $nexora_referrer_policy always;",
    );
    expect(headers).toContain('add_header X-Frame-Options "DENY" always;');
    expect(headers).toContain("frame-ancestors 'none'");
    expect(headers).toContain("object-src 'none'");
    expect(nginx).toContain("server_tokens off;");
  });

  it("responde 404 a dotfiles, mapas y archivos inexistentes sin romper la SPA", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const block = (head: string) => {
      const start = nginx.indexOf(head);
      expect(start, head).toBeGreaterThan(-1);
      return nginx.slice(start, nginx.indexOf("\n    }", start));
    };
    expect(block("location ~ /\\. {")).toContain("return 404;");
    expect(block("location ~* \\.map$ {")).toContain("return 404;");
    // Extensión desconocida: 404 y nunca el HTML de la SPA.
    expect(block("location ~ \\.[A-Za-z0-9]+$ {")).toContain(
      "try_files $uri =404;",
    );
    expect(block("location ~ ^/assets/ {")).toContain("try_files $uri =404;");
    // Rutas sin extensión: fallback a index.html (que sigue sin caché).
    expect(block("location / {")).toContain("try_files $uri /index.html;");
    // Las reglas de archivos van antes del fallback de la SPA.
    expect(nginx.indexOf("location ~ /\\. {")).toBeLessThan(
      nginx.indexOf("location / {"),
    );
  });

  it("sirve el manifest con su tipo y cachea inmutable sólo /assets con hash", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const block = (head: string) => {
      const start = nginx.indexOf(head);
      expect(start, head).toBeGreaterThan(-1);
      return nginx.slice(start, nginx.indexOf("\n    }", start));
    };
    const manifest = block("location = /manifest.webmanifest {");
    expect(manifest).toContain("types {}");
    expect(manifest).toContain("default_type application/manifest+json;");
    const assets = block("location ~ ^/assets/ {");
    expect(assets).toContain(
      'add_header Cache-Control "public, max-age=31536000, immutable";',
    );
    // Sin `always`: un 404 de un hash viejo nunca queda cacheado como inmutable.
    expect(assets).not.toMatch(/Cache-Control[^;]*always/);
    // El service worker, el HTML y la config en runtime siguen sin caché.
    for (const file of ["sw.js", "index.html", "runtime-config.js"]) {
      const loc = block(`location = /${file} {`);
      expect(loc).toContain("no-cache, no-store, must-revalidate");
      expect(loc).not.toContain("immutable");
    }
  });

  it("actualiza el upstream de la API, conserva SSE sin buffering y separa la salud", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    // El upstream lo mantiene start-nginx.sh; ya no hay DNS propio de Nginx.
    expect(nginx).toContain(
      "include /etc/nginx/snippets/nexora-api-upstream.conf;",
    );
    expect(nginx).not.toMatch(/^\s*resolver\s/m);
    expect(nginx).not.toMatch(/\bresolve;/);
    expect(nginx).not.toContain("zone nexora_api");
    expect(nginx).not.toContain("${API_UPSTREAM}");
    expect(nginx).toContain("location = /api/events");
    expect(nginx).toContain("proxy_buffering off;");
    // /healthz es liveness de Nginx: nunca depende de la API.
    const healthz = nginx.match(/location = \/healthz \{[^}]*\}/)?.[0] ?? "";
    expect(healthz).toContain("return 204;");
    expect(healthz).not.toContain("auth_request");
    expect(healthz).not.toContain("proxy_pass");
    // /healthz/deep sí comprueba la API, sin exponer su cuerpo.
    const deep = nginx.match(/location = \/healthz\/deep \{[^}]*\}/)?.[0] ?? "";
    expect(deep).toContain("auth_request /_nexora_api_live;");
    expect(deep).toContain("=503");
    expect(deep).not.toContain("return 204;");
    const live = nginx.match(/location = \/_nexora_api_live \{[^}]*\}/)?.[0];
    expect(live).toContain("internal;");
    expect(live).toContain("proxy_pass http://nexora_api/api/health/live;");
    expect(live).toContain("proxy_pass_request_body off;");
    expect(read("render.yaml")).toContain("healthCheckPath: /healthz\n");
  });

  it("reemplaza X-Forwarded-For usando sólo la IP de conexión confiable", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    expect(nginx).toContain("map $remote_addr $nexora_client_ip {");
    expect(nginx).toContain("default $remote_addr;");
    expect(nginx).not.toMatch(
      /\$http_(?:cf_ray|cf_connecting_ip|x_forwarded_for)/,
    );
    expect(
      nginx.match(/proxy_set_header X-Forwarded-For \$nexora_client_ip;/g),
    ).toHaveLength(2);
    expect(nginx).not.toContain("$proxy_add_x_forwarded_for");
    expect(nginx).not.toContain("$http_x_forwarded_for");
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto https;");
  });

  it("ignora CF-Ray, CF-Connecting-IP y X-Forwarded-For falsificados juntos", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const map = nginx.match(
      /map \$remote_addr \$nexora_client_ip \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(map).toBeTruthy();
    expect(map).toContain("default $remote_addr;");
    expect(map).not.toMatch(
      /\$http_(?:cf_ray|cf_connecting_ip|x_forwarded_for)/,
    );

    // El cliente falsifica las tres cabeceras; Nginx conserva la IP del socket.
    const request = {
      socketIp: "10.20.30.40",
      cfRay: "a1b2c3d4e5f67890-IAD",
      forgedCfConnectingIp: "198.51.100.77",
      forgedXForwardedFor: "203.0.113.99",
    };
    const apiIp = request.socketIp;
    expect(apiIp).toBe("10.20.30.40");
    expect(apiIp).not.toBe(request.forgedCfConnectingIp);
    expect(apiIp).not.toBe(request.forgedXForwardedFor);
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
      'NGINX_ENVSUBST_FILTER="^(API_UPSTREAM|PORT)$"',
    );
    expect(dockerfile).toContain("apk add --no-cache musl-utils");
    expect(entrypoint).not.toContain("NGINX_RESOLVER");
    expect(entrypoint).toContain("API_UPSTREAM no tiene el formato");
    expect(entrypoint).toContain('getent hosts "$api_host"');
    // Bucle de refresco: resuelve con el sistema cada 10 s, reescribe el
    // upstream y recarga Nginx sólo si la IP cambió.
    expect(entrypoint).toContain("nexora-api-upstream.conf");
    expect(entrypoint).toContain("NEXORA_UPSTREAM_REFRESH_SECONDS:-10");
    expect(entrypoint).toContain('"$new_ip" != "$current_ip"');
    expect(entrypoint).toContain("nginx -s reload");
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
