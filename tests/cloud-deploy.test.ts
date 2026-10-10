import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
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
    // /healthz/deep sí comprueba la API, sin exponer su cuerpo. Desde S-06
    // (auditoría 2026-10-10) consulta la preparación (API + base de datos),
    // porque /api/health público ya no detalla el estado de la base.
    const deep = nginx.match(/location = \/healthz\/deep \{[^}]*\}/)?.[0] ?? "";
    expect(deep).toContain("auth_request /_nexora_api_ready;");
    expect(deep).toContain("=503");
    expect(deep).not.toContain("return 204;");
    const ready = nginx.match(/location = \/_nexora_api_ready \{[^}]*\}/)?.[0];
    expect(ready).toContain("internal;");
    expect(ready).toContain("proxy_pass http://nexora_api/api/health/ready;");
    expect(ready).toContain("proxy_pass_request_body off;");
    expect(read("render.yaml")).toContain("healthCheckPath: /healthz\n");
  });

  // S-01/S-02/S-04 (auditoría de seguridad 2026-10-10): antes Nginx enviaba
  // siempre $remote_addr, que en Render es el proxy del borde y es la misma
  // para todos los clientes. Ahora acepta CF-Connecting-IP, que Cloudflare
  // fija, sólo desde la red del borde; la X-Forwarded-For del cliente sigue
  // sin usarse nunca. Las pruebas anteriores exigían ignorar
  // CF-Connecting-IP siempre; se sustituyen por estas, que además ejecutan
  // Nginx de verdad cuando está instalado.
  it("reemplaza X-Forwarded-For con la IP del cliente y sólo cree CF-Connecting-IP desde el borde", () => {
    const nginx = read("deploy/render/nginx.conf.template");
    const geo = nginx.match(
      /geo \$remote_addr \$nexora_trusted_edge \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(geo).toContain("default 0;");
    expect(geo).toContain(
      "include /etc/nginx/snippets/nexora-trusted-edge.conf;",
    );
    const map = nginx.match(
      /map "\$nexora_trusted_edge\|\$http_cf_connecting_ip" \$nexora_client_ip \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(map).toContain("default $remote_addr;");
    // Sólo con el borde de confianza (1|) y una sola IP con forma válida.
    for (const line of map!.split("\n").filter((l) => l.includes("~")))
      expect(line).toMatch(
        /"~\^1\\\|\(\?<nexora_cf_ipv[46]>.*\)\$" \$nexora_cf_ipv[46];$/,
      );
    expect(nginx).not.toMatch(
      /\$http_(?:cf_ray|x_forwarded_for|true_client_ip|x_real_ip)/,
    );
    expect(nginx).not.toContain("$proxy_add_x_forwarded_for");
    expect(nginx).not.toContain("real_ip_header");
    expect(
      nginx.match(/proxy_set_header X-Forwarded-For \$nexora_client_ip;/g),
    ).toHaveLength(2);
    expect(
      nginx.match(/proxy_set_header X-Real-IP \$nexora_client_ip;/g),
    ).toHaveLength(2);
    // Las cabeceras del borde no llegan a la API.
    expect(nginx.match(/proxy_set_header CF-Connecting-IP "";/g)).toHaveLength(
      2,
    );
    expect(nginx.match(/proxy_set_header True-Client-IP "";/g)).toHaveLength(2);
    expect(nginx).toContain("proxy_set_header X-Forwarded-Proto https;");
    // El snippet se genera al arrancar y la imagen trae el generador.
    const entrypoint = read("deploy/render/start-nginx.sh");
    expect(entrypoint).toContain(
      "nexora-render-trusted-edge /etc/nginx/snippets/nexora-trusted-edge.conf",
    );
    expect(entrypoint.indexOf("nexora-render-trusted-edge")).toBeLessThan(
      entrypoint.indexOf("exec /docker-entrypoint.sh"),
    );
    expect(read("deploy/render/Dockerfile.web")).toContain(
      "COPY --chmod=755 deploy/render/render-trusted-edge.sh /usr/local/bin/nexora-render-trusted-edge",
    );
  });

  it.skipIf(process.platform === "win32")(
    "genera la lista del borde sólo con redes válidas",
    () => {
      const dir = mkdtempSync(join(tmpdir(), "nexora-edge-"));
      const target = join(dir, "edge.conf");
      const render = (value?: string) =>
        spawnSync(
          "sh",
          [resolve(root, "deploy/render/render-trusted-edge.sh"), target],
          {
            env: {
              PATH: process.env.PATH,
              ...(value === undefined
                ? {}
                : { NEXORA_TRUSTED_EDGE_CIDRS: value }),
            },
            encoding: "utf8",
          },
        );
      try {
        expect(render().status).toBe(0);
        expect(readFileSync(target, "utf8")).toBe(
          "10.0.0.0/8 1;\n172.16.0.0/12 1;\n192.168.0.0/16 1;\n100.64.0.0/10 1;\nfc00::/7 1;\n",
        );
        expect(render("10.1.0.0/16, 2001:db8::/32").status).toBe(0);
        expect(readFileSync(target, "utf8")).toBe(
          "10.1.0.0/16 1;\n2001:db8::/32 1;\n",
        );
        expect(render("none").status).toBe(0);
        expect(readFileSync(target, "utf8")).toBe("");
        for (const bad of ["10.0.0.0/8; return 200", "0.0.0.0", "evil"]) {
          const r = render(bad);
          expect(r.status).toBe(1);
          expect(r.stderr).toContain("NEXORA_TRUSTED_EDGE_CIDRS");
          // Se conserva el último snippet válido; nunca uno a medias.
          expect(readFileSync(target, "utf8")).toBe("");
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );

  const hasNginx =
    process.platform !== "win32" &&
    spawnSync("nginx", ["-v"], { encoding: "utf8" }).status === 0;
  it.skipIf(!hasNginx)(
    "Nginx real: la API recibe la IP de CF-Connecting-IP sólo desde el borde y nunca la X-Forwarded-For del cliente",
    async () => {
      const { createServer } = await import("node:http");
      const { writeFileSync, mkdirSync, existsSync } = await import("node:fs");
      const { spawn } = await import("node:child_process");
      const freePort = () =>
        new Promise<number>((done) => {
          const probe = createServer().listen(0, "127.0.0.1", () => {
            const { port } = probe.address() as { port: number };
            probe.close(() => done(port));
          });
        });
      // API simulada: devuelve las cabeceras que recibe.
      const api = createServer((req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(req.headers));
      });
      const apiPort = await freePort();
      await new Promise<void>((done) => api.listen(apiPort, "127.0.0.1", done));
      const webPort = await freePort();
      const dir = mkdtempSync(join(tmpdir(), "nexora-nginx-"));
      const snippets = join(dir, "snippets");
      mkdirSync(snippets);
      mkdirSync(join(dir, "html"));
      writeFileSync(
        join(snippets, "nexora-api-upstream.conf"),
        `server 127.0.0.1:${apiPort};\n`,
      );
      writeFileSync(join(snippets, "nexora-security-headers.conf"), "");
      const site = read("deploy/render/nginx.conf.template")
        .replaceAll("/etc/nginx/snippets", snippets)
        .replace("${PORT}", String(webPort))
        .replace("/usr/share/nginx/html", join(dir, "html"));
      writeFileSync(join(dir, "site.conf"), site);
      writeFileSync(
        join(dir, "nginx.conf"),
        `worker_processes 1;\npid ${dir}/nginx.pid;\nerror_log ${dir}/error.log;\n` +
          `events { worker_connections 64; }\nhttp {\n access_log off;\n` +
          ["client_body", "proxy", "fastcgi", "uwsgi", "scgi"]
            .map((t) => ` ${t}_temp_path ${dir}/tmp_${t};`)
            .join("\n") +
          `\n include ${dir}/site.conf;\n}\n`,
      );
      const edge = (cidrs: string) =>
        spawnSync(
          "sh",
          [
            resolve(root, "deploy/render/render-trusted-edge.sh"),
            join(snippets, "nexora-trusted-edge.conf"),
          ],
          { env: { PATH: process.env.PATH, NEXORA_TRUSTED_EDGE_CIDRS: cidrs } },
        ).status;
      const start = () =>
        spawn(
          "nginx",
          [
            "-p",
            dir,
            "-e",
            join(dir, "error.log"),
            "-c",
            join(dir, "nginx.conf"),
            "-g",
            "daemon off;",
          ],
          { stdio: "ignore" },
        );
      const seen = async (headers: Record<string, string>) => {
        for (let i = 0; i < 50; i++) {
          try {
            const r = await fetch(`http://127.0.0.1:${webPort}/api/eco`, {
              headers,
            });
            return (await r.json()) as Record<string, string>;
          } catch {
            await new Promise((done) => setTimeout(done, 100));
          }
        }
        throw new Error(
          "Nginx no arrancó: " +
            (existsSync(join(dir, "error.log"))
              ? readFileSync(join(dir, "error.log"), "utf8")
              : ""),
        );
      };
      let proc = undefined as ReturnType<typeof spawn> | undefined;
      const stop = async () => {
        if (!proc || proc.exitCode !== null) return;
        const exited = new Promise((done) => proc!.once("exit", done));
        proc.kill("SIGTERM");
        await exited;
      };
      try {
        // Conexión desde el borde de confianza (127.0.0.1 en esta prueba).
        expect(edge("127.0.0.1/32")).toBe(0);
        proc = start();
        const real = await seen({ "CF-Connecting-IP": "198.51.100.23" });
        expect(real["x-forwarded-for"]).toBe("198.51.100.23");
        expect(real["x-real-ip"]).toBe("198.51.100.23");
        expect(real["cf-connecting-ip"]).toBeUndefined();
        expect(real["true-client-ip"]).toBeUndefined();
        const v6 = await seen({ "CF-Connecting-IP": "2001:db8::7" });
        expect(v6["x-forwarded-for"]).toBe("2001:db8::7");
        // X-Forwarded-For y True-Client-IP del navegador nunca se creen.
        const forged = await seen({
          "X-Forwarded-For": "203.0.113.99",
          "True-Client-IP": "203.0.113.98",
        });
        expect(forged["x-forwarded-for"]).toBe("127.0.0.1");
        // Una lista o un texto en CF-Connecting-IP no es una IP: se ignora.
        for (const value of [
          "198.51.100.1, 203.0.113.5",
          "evil;x",
          "1.2.3",
          "fe80::1%eth0",
        ])
          expect(
            (await seen({ "CF-Connecting-IP": value }))["x-forwarded-for"],
          ).toBe("127.0.0.1");
        await stop();
        // Si la conexión no viene del borde, CF-Connecting-IP no vale nada.
        expect(edge("10.0.0.0/8")).toBe(0);
        proc = start();
        const outside = await seen({ "CF-Connecting-IP": "198.51.100.23" });
        expect(outside["x-forwarded-for"]).toBe("127.0.0.1");
      } finally {
        await stop();
        await new Promise((done) => api.close(done));
        rmSync(dir, { recursive: true, force: true });
      }
    },
    30000,
  );

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
