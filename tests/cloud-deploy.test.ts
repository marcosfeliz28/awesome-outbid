import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cloudEnvironment,
  isMigrationCommand,
} from "../deploy/render/with-cloud-env.mjs";

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

  // M4: Prisma calculaba el pool con los núcleos físicos del host (17
  // conexiones fijas en Render). La API usa un tope explícito.
  it("fija un tope de conexiones del pool, configurable y validado", () => {
    const base = {
      RENDER_DATABASE_URL: "postgresql://nexora:x@db.internal:5432/fitstore",
    } as NodeJS.ProcessEnv;
    const limit = (env: NodeJS.ProcessEnv) =>
      new URL(cloudEnvironment(env).DATABASE_URL!).searchParams.get(
        "connection_limit",
      );
    expect(limit(base)).toBe("10");
    expect(limit({ ...base, NEXORA_DB_CONNECTION_LIMIT: "6" })).toBe("6");
    expect(
      limit({
        RENDER_DATABASE_URL: base.RENDER_DATABASE_URL + "?connection_limit=4",
      }),
    ).toBe("4");
    for (const bad of ["0", "101", "5.5", "diez"])
      expect(() =>
        cloudEnvironment({ ...base, NEXORA_DB_CONNECTION_LIMIT: bad }),
      ).toThrow(/NEXORA_DB_CONNECTION_LIMIT/);
  });

  // M1: las migraciones de Render no esperan bloqueos ni corren sentencias
  // sin límite; se reconoce `migrate deploy` sin cambiar el preDeployCommand.
  it("las migraciones llevan lock_timeout y statement_timeout", () => {
    const blueprint = read("render.yaml");
    const command = blueprint
      .split("\n")
      .find((line) => line.trimStart().startsWith("preDeployCommand:"))!
      .replace(/^\s*preDeployCommand:\s*/, "")
      .split(/\s+/);
    expect(isMigrationCommand(command.slice(2))).toBe(true);
    expect(isMigrationCommand(["node", "apps/api/dist/main.js"])).toBe(false);
    expect(isMigrationCommand(["prisma", "migrate", "status"])).toBe(false);
    const render = {
      RENDER_DATABASE_URL: "postgresql://nexora:x@db.internal:5432/fitstore",
    } as NodeJS.ProcessEnv;
    const options = (env: NodeJS.ProcessEnv) =>
      new URL(
        cloudEnvironment(env, { migration: true }).DATABASE_URL!,
      ).searchParams.get("options");
    expect(options(render)).toBe(
      "-c TimeZone=UTC -c lock_timeout=5s -c statement_timeout=120s",
    );
    expect(
      options({
        ...render,
        NEXORA_MIGRATION_LOCK_TIMEOUT: "3s",
        NEXORA_MIGRATION_STATEMENT_TIMEOUT: "30min",
      }),
    ).toBe("-c TimeZone=UTC -c lock_timeout=3s -c statement_timeout=30min");
    // El preDeploy no recibe el tope de pool de la API (no lo necesita).
    expect(
      new URL(
        cloudEnvironment(render, { migration: true }).DATABASE_URL!,
      ).searchParams.has("connection_limit"),
    ).toBe(false);
    // También con DATABASE_URL local (CI, pruebas con Docker).
    expect(
      options({ DATABASE_URL: "postgresql://f:l@127.0.0.1:5434/fitstore" }),
    ).toBe("-c lock_timeout=5s -c statement_timeout=120s");
    for (const bad of ["5 s", "-1s", "5h", "1;DROP", "s"])
      expect(() =>
        cloudEnvironment(
          { ...render, NEXORA_MIGRATION_LOCK_TIMEOUT: bad },
          { migration: true },
        ),
      ).toThrow(/NEXORA_MIGRATION_LOCK_TIMEOUT/);
  });

  it("documenta cómo escribir migraciones seguras y no repite prefijos", () => {
    const guide = read("docs/MIGRACIONES_SEGURAS.md");
    for (const text of [
      "lock_timeout",
      "statement_timeout",
      "NEXORA_MIGRATION_STATEMENT_TIMEOUT",
      "migrate resolve --rolled-back",
      "CREATE INDEX CONCURRENTLY",
      "Ampliar y luego retirar",
    ])
      expect(guide).toContain(text);
    // M2: dos migraciones con el mismo prefijo se ordenan por el resto del
    // nombre y pueden aplicarse en otro orden en una base nueva. Sólo se
    // toleran los dos casos históricos ya aplicados en producción.
    const names = readdirSync(resolve(root, "apps/api/prisma/migrations"))
      .filter((name) => /^\d{12}_/.test(name))
      .sort();
    const prefixes = names.map((name) => name.slice(0, 12));
    const repeated = [
      ...new Set(prefixes.filter((p, i) => prefixes.indexOf(p) !== i)),
    ];
    expect(repeated).toEqual(["202610170001", "202610190001"]);
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

describe("Operación · contingencia, monitoreo y restauración", () => {
  it("la contingencia nombra los ajustes reales y enlaza los procedimientos", () => {
    const plan = read("docs/CONTINGENCIA.md").replace(/\s+/g, " ");
    // La ruta del ajuste debe existir en la interfaz.
    expect(plan).toContain(
      "Configuración › Negocio y reglas › Editar configuración › «Permitir ventas sin conexión»",
    );
    expect(read("apps/web/src/Management.tsx")).toContain(
      "Permitir ventas sin conexión",
    );
    for (const link of [
      "MONITOREO.md",
      "RESTAURACION_RENDER.md",
      "INSTALADOR.md",
    ])
      expect(plan).toContain(`(${link})`);
    expect(plan).toContain("talonario");
    expect(plan).toContain("Sistema anterior");
  });

  it("el monitoreo vigila la salud profunda y la de la base cada minuto", () => {
    const guide = read("docs/MONITOREO.md");
    expect(guide).toContain("https://nexora-pos-web.onrender.com/api/health");
    expect(guide).toContain("https://nexora-pos-web.onrender.com/healthz/deep");
    expect(guide).toContain('`"database":"ok"`');
    expect(guide).toContain("**60 segundos**");
    expect(guide).toMatch(/Telegram/);
  });

  it("la restauración verifica la huella, es atómica y no pisa la base en uso", () => {
    const guide = read("docs/RESTAURACION_RENDER.md");
    expect(guide).toContain("sha256sum -c");
    expect(guide).toContain(
      "pg_restore --format=directory --single-transaction --exit-on-error --no-owner --no-privileges",
    );
    expect(guide).toContain("node scripts/restore.mjs");
    expect(guide).toContain("migrate status");
    expect(guide).toContain("RENDER_DATABASE_URL");
    expect(guide).toContain(
      "nunca se restaura encima de la base que está en uso",
    );
    expect(guide).toContain("(PRUEBA_RESTAURACION.md)");
    expect(read("docs/PRUEBA_RESTAURACION.md")).toContain(
      "Prueba real de respaldo y restauración",
    );
    const deploy = read("docs/DEPLOY-RENDER.md");
    for (const link of [
      "CONTINGENCIA.md",
      "MONITOREO.md",
      "RESTAURACION_RENDER.md",
      "MIGRACIONES_SEGURAS.md",
    ])
      expect(deploy).toContain(`(${link})`);
    expect(deploy).not.toContain("no se ha creado, comprado ni desplegado");
    expect(deploy).not.toContain("0.1c-256mb");
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

  // M5 (auditoría de infraestructura): si la API no resuelve al arrancar, la
  // web arranca igual con /api en 502 y reintenta; antes salía con error y
  // Render la dejaba en bucle de arranque fallido.
  it("la web arranca aunque la API no resuelva y /api responde 502 claro", () => {
    const entrypoint = read("deploy/render/start-nginx.sh");
    const startup = entrypoint.slice(
      entrypoint.indexOf("api_ip=$(resolve_api_ip)"),
      entrypoint.indexOf("exec /docker-entrypoint.sh"),
    );
    expect(startup).toContain("write_unavailable_upstream");
    expect(startup).not.toMatch(/if \[ -z "\$api_ip" \]; then[^]*?exit 1/);
    expect(entrypoint).toContain(
      "printf 'server 127.0.0.1:%s down;\\n' \"$api_port\"",
    );
    // Si el bucle de re-resolución muere, se detiene Nginx para que Render
    // reinicie la web (no queda con una IP vieja para siempre).
    expect(entrypoint).toContain("trap '");
    expect(entrypoint).toContain("kill -TERM $$");
    const nginx = read("deploy/render/nginx.conf.template");
    const api = nginx.slice(
      nginx.indexOf("location ^~ /api/ {"),
      nginx.indexOf("location = /sw.js {"),
    );
    expect(api).toContain("error_page 502 @nexora_api_unavailable;");
    expect(api).toContain("error_page 504 @nexora_api_timeout;");
    // El código se conserva (502/504): la PWA los trata como «sin conexión».
    expect(api).toMatch(
      /location @nexora_api_unavailable \{\s*default_type application\/json;\s*return 502 '\{"statusCode":502,"message":"[^']+"\}';/,
    );
    expect(api).toMatch(
      /location @nexora_api_timeout \{\s*default_type application\/json;\s*return 504 '/,
    );
    expect(api).not.toContain("proxy_intercept_errors");
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

describe("CI · cadena de suministro y despliegue protegido", () => {
  const workflows = readdirSync(resolve(root, ".github/workflows"))
    .filter((file) => /\.ya?ml$/.test(file))
    .map((file) => `.github/workflows/${file}`);

  // M10: una etiqueta móvil (@v4) puede reescribirse; un SHA, no.
  it("fija cada acción por SHA y limita el token a lectura", () => {
    expect(workflows.length).toBeGreaterThan(0);
    for (const path of workflows) {
      const text = read(path);
      const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
      for (const [, ref, comment] of uses) {
        expect(ref, `${path}: ${ref}`).toMatch(
          /^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/,
        );
        expect(comment, `${path}: ${ref} sin versión`).toMatch(/# v\d/);
      }
      expect(text, path).toMatch(/^permissions:\n {2}contents: read$/m);
      expect(text, path).not.toMatch(/contents: write|write-all/);
    }
    expect(read(".github/workflows/ci.yml")).toMatch(
      /image: postgres:17\.\d+@sha256:[0-9a-f]{64}/,
    );
    expect(read(".github/dependabot.yml")).toContain(
      "package-ecosystem: github-actions",
    );
  });

  // A4: el CI construye ambas imágenes (sin publicarlas) y las arranca como
  // en Render, terminando con post-deploy-check.mjs.
  it("construye las imágenes de Render y ejecuta la comprobación posterior", () => {
    const ci = read(".github/workflows/ci.yml");
    const job = ci.slice(ci.indexOf("  render-images:"));
    expect(job).toContain(
      "docker build -f deploy/render/Dockerfile.api -t nexora-pos-api:ci .",
    );
    expect(job).toContain(
      "docker build -f deploy/render/Dockerfile.web -t nexora-pos-web:ci .",
    );
    expect(job).toContain("bash deploy/render/ci-smoke.sh");
    expect(ci).not.toMatch(/docker (push|login)|--push/);
    const smoke = read("deploy/render/ci-smoke.sh");
    // Usa la misma orden de migración que Render y la misma comprobación.
    expect(smoke).toContain("preDeployCommand:");
    expect(smoke).toContain("render.yaml");
    expect(smoke).toContain("node deploy/render/post-deploy-check.mjs");
    // La web arranca antes que la API y debe responder igual.
    expect(smoke.indexOf('echo "2) La web arranca sin API"')).toBeLessThan(
      smoke.indexOf('echo "4) Arranca la API"'),
    );
    expect(smoke).toContain('"statusCode":502');
    // Comprobación manual tras desplegar, sin secretos en la orden.
    const post = read(".github/workflows/post-deploy-check.yml");
    expect(post).toContain("workflow_dispatch:");
    expect(post).toContain("NEXORA_WEB_URL: ${{ inputs.web_url }}");
    expect(post).not.toMatch(/run:.*\$\{\{/);
  });
});
