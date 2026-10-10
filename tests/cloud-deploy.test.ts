import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { cloudEnvironment } from "../deploy/render/with-cloud-env.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

// Estado real comprobado en Render el 10-oct-2026 (A3). Ver render.yaml.
const PLAN_FLOOR: Record<string, { cpu: number; memoryMb: number }> = {
  "nexora-pos-web": { cpu: 0.5, memoryMb: 512 },
  "nexora-pos-api": { cpu: 1, memoryMb: 2048 },
  "nexora-pos-db": { cpu: 0.5, memoryMb: 1024 },
};
// El disco de PostgreSQL en Render sólo puede crecer.
const DISK_FLOOR_GB = 5;

// Bloque de un recurso de primer nivel (servicio o base) de render.yaml.
function resourceBlock(blueprint: string, name: string) {
  const lines = blueprint.split("\n");
  const at = lines.findIndex(
    (line) => line === `    name: ${name}` || line === `  - name: ${name}`,
  );
  if (at < 0) return "";
  let start = at;
  while (!lines[start].startsWith("  - ")) start -= 1;
  let end = start + 1;
  while (
    end < lines.length &&
    !lines[end].startsWith("  - ") &&
    !/^\S/.test(lines[end])
  )
    end += 1;
  return lines.slice(start, end).join("\n");
}

function yamlField(block: string, key: string) {
  return block.match(new RegExp(`^ {4}${key}: "?([^"\\n]*)"?$`, "m"))?.[1];
}

function planViolations(blueprint: string) {
  const violations: string[] = [];
  for (const [name, floor] of Object.entries(PLAN_FLOOR)) {
    const block = resourceBlock(blueprint, name);
    const plan = yamlField(block, "plan");
    const match = plan?.match(/^(\d+(?:\.\d+)?)c-(\d+)(mb|gb|g)$/);
    if (!match) {
      violations.push(`${name}: plan ausente o con otra forma (${plan})`);
      continue;
    }
    const cpu = Number(match[1]);
    const memoryMb = Number(match[2]) * (match[3] === "mb" ? 1 : 1024);
    if (cpu < floor.cpu || memoryMb < floor.memoryMb)
      violations.push(
        `${name}: plan ${plan} menor que ${floor.cpu}c-${floor.memoryMb}mb`,
      );
    if (
      name !== "nexora-pos-db" &&
      !(Number(yamlField(block, "numInstances")) >= 1)
    )
      violations.push(`${name}: sin instancias`);
  }
  const disk = Number(
    yamlField(resourceBlock(blueprint, "nexora-pos-db"), "diskSizeGB"),
  );
  if (!(disk >= DISK_FLOOR_GB))
    violations.push(
      `nexora-pos-db: disco ${disk} GB menor que ${DISK_FLOOR_GB} GB`,
    );
  return violations;
}

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
    expect(blueprint).toContain('postgresMajorVersion: "17"');
    expect(blueprint.match(/autoDeployTrigger: off/g)).toHaveLength(2);
    expect(blueprint).toContain("healthCheckPath: /healthz");
  });

  // A3 (auditoría de infraestructura, 10-oct-2026): render.yaml debe
  // coincidir con lo que corre en Render. Si declarara planes menores, una
  // sincronización del Blueprint bajaría la API o la base (reinicio en horario
  // de tienda) e intentaría encoger el disco, que Render no permite. Los
  // mínimos de PLAN_FLOOR sólo se cambian a la vez que el plan real, nunca
  // para que pase la prueba. Subir un plan está permitido; bajarlo, no.
  it("no baja por accidente los planes ni el disco reales de Render", () => {
    const blueprint = read("render.yaml");
    expect(planViolations(blueprint)).toEqual([]);
    const database = resourceBlock(blueprint, "nexora-pos-db");
    expect(yamlField(database, "databaseName")).toBe("fitstore_bfjz");
    expect(yamlField(database, "storageAutoscalingEnabled")).toBe("false");
    // La regla queda escrita junto a los planes.
    expect(blueprint).toContain("PRIMERO aquí");
  });

  it("la comprobación de planes detecta una bajada o un disco menor", () => {
    const blueprint = read("render.yaml");
    const apiAt = blueprint.search(/^ {4}name: nexora-pos-api$/m);
    const downgradeApi =
      blueprint.slice(0, apiAt) +
      blueprint.slice(apiAt).replace(/plan: \S+/, "plan: 0.5c-512mb");
    expect(planViolations(downgradeApi)).toEqual([
      "nexora-pos-api: plan 0.5c-512mb menor que 1c-2048mb",
    ]);
    expect(
      planViolations(blueprint.replace(/diskSizeGB: \d+/, "diskSizeGB: 1")),
    ).toEqual(["nexora-pos-db: disco 1 GB menor que 5 GB"]);
    expect(
      planViolations(blueprint.replace("plan: 0.5c-1g", "plan: 0.1c-256mb")),
    ).toEqual(["nexora-pos-db: plan 0.1c-256mb menor que 0.5c-1024mb"]);
    expect(
      planViolations(blueprint.replace("plan: 1c-2g", "plan: 2c-4g")),
    ).toEqual([]);
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
    // G8: el DSN ya no está en el código; llega en VITE_SENTRY_DSN al
    // compilar. La CSP sólo autoriza Sentry si hay DSN (marcador que rellena
    // render-security-headers.sh al arrancar; ver la prueba siguiente).
    expect(read("deploy/render/Dockerfile.web")).toContain(
      "ARG VITE_SENTRY_DSN",
    );
    expect(read("render.yaml")).toContain("key: VITE_SENTRY_DSN");
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
    expect(headers).toContain("connect-src 'self'${NEXORA_CSP_SENTRY_SRC};");
    expect(headers).not.toMatch(/sentry\.io/i);
    expect(
      nginx.match(
        /include \/etc\/nginx\/snippets\/nexora-security-headers.conf;/g,
      ),
    ).toHaveLength(12);
    // HSTS cubre subdominios.
    expect(headers).toContain(
      'Strict-Transport-Security "max-age=31536000; includeSubDomains"',
    );
  });

  it.skipIf(process.platform === "win32")(
    "la CSP sólo incluye el host de Sentry cuando hay VITE_SENTRY_DSN",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "nexora-csp-"));
      const render = (dsn?: string) => {
        const target = join(dir, "headers.conf");
        const env: NodeJS.ProcessEnv = { PATH: process.env.PATH };
        if (dsn !== undefined) env.VITE_SENTRY_DSN = dsn;
        const result = spawnSync(
          "sh",
          [
            resolve(root, "deploy/render/render-security-headers.sh"),
            resolve(root, "deploy/render/security-headers.conf"),
            target,
          ],
          { env, encoding: "utf8" },
        );
        expect(result.status, result.stderr).toBe(0);
        const text = readFileSync(target, "utf8");
        expect(text).not.toContain("NEXORA_CSP_SENTRY_SRC");
        return {
          connect: text.match(/connect-src [^;]*;/)?.[0],
          stderr: result.stderr,
          lines: text.trim().split("\n").length,
        };
      };
      try {
        const expectedLines = read("deploy/render/security-headers.conf")
          .trim()
          .split("\n").length;
        // Por defecto (sin DSN o vacío): nada de Sentry.
        expect(render().connect).toBe("connect-src 'self';");
        expect(render("  ").connect).toBe("connect-src 'self';");
        // Con DSN: sólo el origen (sin clave ni proyecto).
        const on = render(
          "https://abc123@o4512218489683968.ingest.us.sentry.io/4512",
        );
        expect(on.connect).toBe(
          "connect-src 'self' https://o4512218489683968.ingest.us.sentry.io;",
        );
        expect(on.lines).toBe(expectedLines);
        // Un DSN inválido o que intente inyectar directivas no rompe el
        // arranque: se avisa y la CSP queda en 'self'.
        for (const bad of [
          "http://k@o1.ingest.sentry.io/1",
          'https://k@evil.example"; add_header X y/1',
          "no-es-un-dsn",
        ]) {
          const off = render(bad);
          expect(off.connect).toBe("connect-src 'self';");
          expect(off.stderr).toContain("VITE_SENTRY_DSN no tiene el formato");
          expect(off.lines).toBe(expectedLines);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

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
    // Los .txt (licencias.txt) llevan charset UTF-8 sin cambiar el resto:
    // misma caché y cabeceras que el bloque genérico y nada global.
    const txt = block("location ~* \\.txt$ {");
    const generic = block("location ~ \\.[A-Za-z0-9]+$ {");
    expect(txt).toContain("charset utf-8;");
    expect(txt).toContain("charset_types text/plain;");
    for (const line of [
      'add_header Cache-Control "no-cache";',
      "include /etc/nginx/snippets/nexora-security-headers.conf;",
      "try_files $uri =404;",
    ]) {
      expect(txt).toContain(line);
      expect(generic).toContain(line);
    }
    expect(nginx.match(/^\s*charset\s/gm)).toHaveLength(1);
    // Va antes del bloque genérico (en Nginx gana la primera regex) y
    // después de las reglas de dotfiles y mapas.
    expect(nginx.indexOf("location ~* \\.txt$ {")).toBeLessThan(
      nginx.indexOf("location ~ \\.[A-Za-z0-9]+$ {"),
    );
    expect(nginx.indexOf("location ~ /\\. {")).toBeLessThan(
      nginx.indexOf("location ~* \\.txt$ {"),
    );
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
    // El snippet de cabeceras se genera al arrancar desde la plantilla.
    expect(dockerfile).toContain(
      "COPY deploy/render/security-headers.conf /etc/nginx/nexora/security-headers.conf.in",
    );
    expect(dockerfile).toContain(
      "deploy/render/render-security-headers.sh /usr/local/bin/nexora-render-security-headers",
    );
    expect(entrypoint).toContain(
      "nexora-render-security-headers /etc/nginx/nexora/security-headers.conf.in",
    );
    expect(entrypoint.indexOf("nexora-render-security-headers")).toBeLessThan(
      entrypoint.indexOf("exec /docker-entrypoint.sh"),
    );
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
