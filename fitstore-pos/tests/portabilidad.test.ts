// Portabilidad: regresiones rápidas, sin base de datos ni red, de los problemas
// que impedían instalar, probar, verificar y empaquetar el proyecto en Windows.
// Cada una falla con el código anterior a su corrección (ronda 9).
import { describe, expect, it } from "vitest";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { arch, platform, tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, inflateRawSync } from "node:zlib";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const tempDir = () => mkdtempSync(join(tmpdir(), "fitstore-portabilidad-"));
// En Windows un proceso recién terminado puede retener su carpeta un instante.
const remove = (dir: string) =>
  rmSync(dir, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 100,
  });

// Carpetas generadas o ajenas al código: no se recorren.
const GENERATED = new Set([
  "node_modules",
  "test-results",
  "playwright-report",
  "coverage",
  "target",
  "backups",
]);
function walk(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const hidden = entry.name.startsWith(".") && entry.name !== ".github";
      if (!hidden && !GENERATED.has(entry.name) && !/^dist/.test(entry.name))
        walk(path, found);
    } else if (entry.isFile()) found.push(path);
  }
  return found;
}
const rel = (path: string) => relative(root, path).replaceAll("\\", "/");
const sources = (...dirs: string[]) =>
  dirs
    .flatMap((dir) => walk(resolve(root, dir)))
    .filter((file) => /\.(ts|tsx|mjs)$/.test(file))
    .filter((file) => file !== fileURLToPath(import.meta.url));
const lineOf = (text: string, index: number) =>
  text.slice(0, index).split("\n").length;

// Los scripts de la ronda anterior se ejecutaban enteros al importarlos (uno
// arranca PostgreSQL y otro escribe un ZIP). Sólo se importan cuando exportan
// sus funciones y comprueban que son el módulo principal antes de actuar.
async function load(name: string): Promise<any> {
  const source = read("scripts/" + name);
  if (!/^export /m.test(source) || !source.includes("isMain("))
    throw new Error(
      `scripts/${name} no exporta funciones comprobables: se ejecutaría al importarlo`,
    );
  return import(/* @vite-ignore */ "../scripts/" + name);
}
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function until(condition: () => boolean, ms = 10000) {
  const end = Date.now() + ms;
  while (!condition() && Date.now() < end)
    await new Promise((r) => setTimeout(r, 50));
  return condition();
}
function node(args: string[], options: Record<string, unknown> = {}) {
  return new Promise<{ code: number | null; out: string }>((done) => {
    const child = spawn(process.execPath, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    child.on("close", (code) => done({ code, out }));
  });
}

describe("Portabilidad · rutas y procesos de las pruebas", () => {
  it("ningún script ni prueba usa URL.pathname como ruta de archivo", () => {
    // En Windows, new URL(x, import.meta.url).pathname es "/C:/…", que no
    // existe como ruta: no se cargaba .env ni arrancaban la base local y el
    // importador. La ruta correcta sale de fileURLToPath.
    const pattern =
      /new URL\(\s*[^()]*\bimport\.meta\.url\s*,?\s*\)\s*\.pathname\b/g;
    const uses: string[] = [];
    for (const file of sources("scripts", "tests")) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(pattern))
        uses.push(rel(file) + ":" + lineOf(text, m.index));
    }
    expect(uses).toEqual([]);
  });
  it("ningún script ni prueba ejecuta los atajos POSIX de node_modules/.bin", () => {
    // Esos atajos son guiones de sh: en Windows, spawn responde ENOENT. Las
    // herramientas se lanzan con el propio node y su entrada resuelta.
    const uses = sources("scripts", "tests")
      .filter((f) => readFileSync(f, "utf8").includes("node_modules/.bin/"))
      .map(rel);
    expect(uses).toEqual([]);
  });
  it("las pruebas de la API no bloquean el proceso con órdenes síncronas", () => {
    // La API cierra las conexiones inactivas a los 5 s. Si la prueba bloquea
    // su bucle de eventos más que eso (tres procesos de Node con spawnSync
    // tardan 6 s en Windows) no ve el cierre y la petición siguiente falla
    // con ECONNRESET.
    const text = read("tests/api.test.ts");
    const uses = [...text.matchAll(/\b(spawnSync|execSync|execFileSync)\(/g)];
    expect(uses.map((m) => m[1] + ":" + lineOf(text, m.index))).toEqual([]);
  });
});

describe("Portabilidad · instalación y finales de línea", () => {
  it(".gitattributes fija LF para el texto y declara los binarios", () => {
    // Sin él, core.autocrlf=true (lo habitual en Git para Windows) baja el
    // código con CRLF.
    expect(existsSync(resolve(root, ".gitattributes"))).toBe(true);
    const lines = read(".gitattributes").split("\n");
    expect(lines).toContain("* text=auto eol=lf");
    for (const ext of ["png", "xlsx", "zip", "pdf", "woff2"])
      expect(lines).toContain(`*.${ext} binary`);
  });
  it("ningún archivo de código o configuración tiene finales CRLF", () => {
    // Las pruebas que leen archivos del repositorio, los scripts y los sha256
    // de docs/validacion suponen LF.
    const text =
      /\.(ts|tsx|mts|mjs|cjs|js|json|ya?ml|sql|prisma|css|html|md|conf|toml|sh)$/;
    const loose = new Set([
      "Dockerfile",
      ".gitattributes",
      ".gitignore",
      ".npmrc",
      ".prettierignore",
      ".dockerignore",
      ".env.example",
    ]);
    const withCrlf = walk(root)
      .filter((file) => text.test(file) || loose.has(rel(file)))
      .filter((file) => readFileSync(file).includes("\r\n"))
      .map(rel);
    expect(withCrlf).toEqual([]);
  });
  it("pnpm tiene decidida la compilación de los binarios de PostgreSQL local", () => {
    // Un paquete con script de instalación y sin decisión en allowBuilds hace
    // que «pnpm install» termine con ERR_PNPM_IGNORED_BUILDS (código 1) y
    // reescriba pnpm-workspace.yaml. Pasaba en Windows y en macOS.
    const block = read("pnpm-workspace.yaml").split(/^allowBuilds:\n/m)[1];
    const decided = new Map<string, string>();
    for (const line of (block ?? "").split("\n")) {
      const m = line.match(/^\s+"?([^":]+)"?:\s*(\S+)\s*$/);
      if (!m) break;
      decided.set(m[1], m[2]);
    }
    const locked = [
      ...new Set(
        [...read("pnpm-lock.yaml").matchAll(/'(@embedded-postgres\/[\w-]+)@/g)]
          .map((m) => m[1])
          .sort(),
      ),
    ];
    // Las plataformas donde se desarrolla y se prueba, más la de esta máquina.
    const here = `@embedded-postgres/${platform() === "win32" ? "windows" : platform()}-${arch()}`;
    const required = locked.filter(
      (name) => /\/(windows|darwin)-|\/linux-x64$/.test(name) || name === here,
    );
    expect(required.length).toBeGreaterThanOrEqual(4);
    for (const name of required)
      expect([name, decided.get(name)]).toEqual([
        name,
        expect.stringMatching(/^(true|false)$/),
      ]);
  });
  it("el reporte que escribe el importador no ensucia el repositorio", () => {
    // El importador deja revision-inventario.csv en la carpeta desde la que
    // se ejecuta, y la suite de integración lo ejecuta en apps/api. Con el
    // inventario real lleva costos: no debe versionarse.
    expect(read(".gitignore").split("\n")).toContain("revision-inventario.csv");
    // A Git sólo se le puede preguntar dentro de un repositorio (el ZIP no lo es).
    const git = (...args: string[]) =>
      spawnSync("git", args, { cwd: root, encoding: "utf8" });
    if (git("rev-parse", "--is-inside-work-tree").stdout?.trim() === "true")
      expect(git("ls-files", "--", "*revision-inventario.csv").stdout).toBe("");
  });
});

describe("Portabilidad · PostgreSQL local (scripts/local-db.mjs)", () => {
  const settings = (flags: string[]) =>
    flags.flatMap((flag, i) => (flag === "-c" ? [flags[i + 1]] : []));
  it("la carpeta de datos es una ruta nativa y los valores por defecto no cambian", async () => {
    const { config } = await load("local-db.mjs");
    const c = config({});
    expect(c.dir).toBe(resolve(root, ".local-db"));
    expect(isAbsolute(c.dir)).toBe(true);
    // "/C:/Users/…" es lo que daba URL.pathname en Windows.
    if (WINDOWS) expect(c.dir).not.toMatch(/^[\\/]/);
    expect(c.port).toBe(5434);
  });
  it("el puerto y la carpeta de datos se pueden cambiar por entorno", async () => {
    const { config } = await load("local-db.mjs");
    const dir = join(tmpdir(), "fitstore-datos-de-prueba");
    expect(
      config({ FITSTORE_DB_PORT: "5447", FITSTORE_DB_DIR: dir }),
    ).toMatchObject({ dir, port: 5447 });
    for (const bad of ["abc", "0", "70000", "54.5"])
      expect(() => config({ FITSTORE_DB_PORT: bad })).toThrow(
        /FITSTORE_DB_PORT/,
      );
  });
  it("arranca en UTC y sólo pide socket Unix donde existe", async () => {
    const { config } = await load("local-db.mjs");
    const windows = config({}, "win32");
    const linux = config({}, "linux");
    for (const c of [windows, linux]) {
      // Sin esto las sesiones heredan la zona del equipo (UTC-4 en la tienda).
      expect(settings(c.flags)).toContain("timezone=UTC");
      expect(settings(c.flags)).toContain("listen_addresses=127.0.0.1");
    }
    expect(settings(linux.flags)).toContain(
      "unix_socket_directories=" + linux.dir,
    );
    expect(
      settings(windows.flags).filter((s) => s.startsWith("unix_socket")),
    ).toEqual([]);
  });
  it("un clúster nuevo se crea en UTF-8 y no en la codificación del equipo", async () => {
    // initdb toma la codificación de la configuración regional: en Windows
    // salía WIN1252, que rechaza los caracteres fuera de esa tabla.
    const { config } = await load("local-db.mjs");
    for (const os of ["win32", "linux", "darwin"])
      expect(config({}, os).initFlags).toContain("--encoding=UTF8");
  });
  it("--detener termina bien cuando no hay nada en marcha", async () => {
    await load("local-db.mjs");
    const dir = tempDir();
    try {
      const r = await node(
        [resolve(root, "scripts/local-db.mjs"), "--detener"],
        {
          env: { ...process.env, FITSTORE_DB_DIR: dir },
        },
      );
      expect(r.out).toMatch(/No hay PostgreSQL local en marcha/);
      expect(r.code).toBe(0);
      // No inicializa ni deja nada en la carpeta.
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      remove(dir);
    }
  }, 30000);
});

describe("Portabilidad · verificación (scripts/verify.mjs)", () => {
  it("la API y sus puertos salen de FITSTORE_API_URL y PORT, con 3001 por defecto", async () => {
    const { targets } = await load("verify.mjs");
    expect(targets({})).toEqual({
      api: "http://127.0.0.1:3001/api",
      health: "http://127.0.0.1:3001/api/health",
      apiPort: "3001",
      proxy: "http://127.0.0.1:3001",
      local: true,
    });
    expect(targets({ PORT: "3105" })).toMatchObject({
      health: "http://127.0.0.1:3105/api/health",
      apiPort: "3105",
      proxy: "http://127.0.0.1:3105",
    });
    // La URL manda sobre PORT; el proxy de la PWA se respeta si viene dado.
    expect(
      targets({
        PORT: "3001",
        FITSTORE_API_URL: "http://localhost:3107/api/",
        FITSTORE_API_PROXY: "http://127.0.0.1:3999",
      }),
    ).toEqual({
      api: "http://localhost:3107/api",
      health: "http://localhost:3107/api/health",
      apiPort: "3107",
      proxy: "http://127.0.0.1:3999",
      local: true,
    });
    expect(
      targets({ FITSTORE_API_URL: "https://pos.example.test/api" }).local,
    ).toBe(false);
  });
  it("ejecuta pnpm en esta plataforma y devuelve el código de salida", async () => {
    // En Windows pnpm es un guion .cmd: spawn("pnpm") sin intérprete de
    // órdenes responde ENOENT.
    const { run } = await load("verify.mjs");
    expect(await run("pnpm", ["--version"], { stdio: "ignore" })).toBe(0);
    expect(
      await run("node", ["-e", "process.exit(7)"], { stdio: "ignore" }),
    ).toBe(7);
    // pnpm propaga el código de la orden que ejecuta.
    expect(
      await run("pnpm", ["exec", "node", "-e", "process.exit(3)"], {
        stdio: "ignore",
      }),
    ).toBe(3);
  }, 60000);
  it("una orden que no arranca no tumba la verificación", async () => {
    // Sin escuchar «error», el fallo de spawn era una excepción no capturada:
    // el script moría sin detener lo que ya había iniciado.
    const { launch, stop } = await load("verify.mjs");
    const dir = tempDir();
    try {
      const child = launch("orden-fitstore-que-no-existe", [], "ausente", {
        logDir: dir,
      });
      expect(child.listenerCount("error")).toBeGreaterThan(0);
      await stop(child);
      expect(child.pid === undefined || !alive(child.pid)).toBe(true);
      expect(existsSync(join(dir, "ausente.log"))).toBe(true);
    } finally {
      remove(dir);
    }
  }, 30000);
  it("detener acaba con el proceso iniciado y, en Windows, con todo su árbol", async () => {
    // La API se inicia con pnpm, que en Windows cuelga del intérprete de
    // órdenes: child.kill("SIGTERM") terminaba sólo ese intérprete, y pnpm,
    // tsx y la API seguían vivos con el puerto ocupado.
    const { launch, stop } = await load("verify.mjs");
    const dir = tempDir();
    let server = 0;
    try {
      const script = join(dir, "servidor.mjs");
      writeFileSync(
        script,
        `console.log("pid=" + process.pid);\nsetInterval(() => {}, 1000);\n`,
      );
      const child = launch("pnpm", ["exec", "node", script], "arbol", {
        logDir: dir,
      });
      const log = () => readFileSync(join(dir, "arbol.log"), "utf8");
      expect(await until(() => /pid=\d+/.test(log()), 20000)).toBe(true);
      server = Number(log().match(/pid=(\d+)/)![1]);
      expect(alive(child.pid) && alive(server)).toBe(true);
      await stop(child);
      expect(await until(() => !alive(child.pid))).toBe(true);
      if (WINDOWS) expect(await until(() => !alive(server))).toBe(true);
    } finally {
      if (server && alive(server)) process.kill(server, "SIGKILL");
      await until(() => !server || !alive(server));
      remove(dir);
    }
  }, 60000);
  it("a la base local se le pide un apagado limpio antes de matarla", async () => {
    // En Windows SIGTERM no ejecuta ningún manejador: terminar a local-db se
    // llevaba a postgres.exe sin cerrar la base y dejaba postmaster.pid. Se
    // le avisa por el canal IPC y se espera a que salga.
    const { launch, stop } = await load("verify.mjs");
    const dir = tempDir();
    try {
      const mark = join(dir, "marca.txt");
      const script = join(dir, "base.mjs");
      writeFileSync(
        script,
        `import { writeFileSync } from "node:fs";
process.on("message", (message) => {
  if (message !== "stop") return;
  writeFileSync(process.argv[2], "apagado limpio");
  process.exit(0);
});
process.send({ ready: true });
setInterval(() => {}, 1000);
`,
      );
      const child = launch("node", [script, mark], "base", {
        logDir: dir,
        ipc: true,
      });
      expect((await once(child, "message"))[0]).toEqual({ ready: true });
      await stop(child);
      expect(child.exitCode).toBe(0);
      expect(readFileSync(mark, "utf8")).toBe("apagado limpio");
    } finally {
      remove(dir);
    }
  }, 30000);
});

describe("Portabilidad · respaldo (scripts/backup.mjs)", () => {
  it("explica cómo indicar pg_dump cuando no está en el PATH", async () => {
    // El instalador de PostgreSQL para Windows no lo agrega al PATH: el
    // respaldo terminaba con «spawn pg_dump ENOENT» y ninguna pista.
    const backups = resolve(root, "backups");
    const existed = existsSync(backups);
    try {
      const r = await node([resolve(root, "scripts/backup.mjs")], {
        env: {
          ...process.env,
          DATABASE_URL: "postgresql://nadie:nada@127.0.0.1:1/ninguna",
          PG_DUMP_BIN: "pg_dump-fitstore-que-no-existe",
        },
      });
      expect(r.out).toContain("No se encontró pg_dump-fitstore-que-no-existe");
      expect(r.out).toContain("PG_DUMP_BIN");
      expect(r.code).toBe(1);
    } finally {
      // El script crea backups/ antes de llamar a pg_dump; si no existía, se
      // quita (rmdir sólo borra una carpeta vacía).
      if (!existed && existsSync(backups)) rmdirSync(backups);
    }
  }, 30000);
});

// Lector mínimo de ZIP para comprobar el archivo sin otra herramienta.
function readZip(path: string) {
  const b = readFileSync(path);
  const end = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(end).toBeGreaterThanOrEqual(0);
  const total = b.readUInt16LE(end + 10);
  let p = b.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < total; i++) {
    expect(b.readUInt32LE(p)).toBe(0x02014b50);
    const method = b.readUInt16LE(p + 10);
    const nameLength = b.readUInt16LE(p + 28);
    const local = b.readUInt32LE(p + 42);
    const start =
      local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const raw = b.subarray(start, start + b.readUInt32LE(p + 20));
    const data = method === 8 ? inflateRawSync(raw) : raw;
    expect(data.length).toBe(b.readUInt32LE(p + 24));
    expect(crc32(data)).toBe(b.readUInt32LE(p + 16));
    entries.push({
      name: b.subarray(p + 46, p + 46 + nameLength).toString("utf8"),
      data,
      time: b.readUInt16LE(p + 12),
      date: b.readUInt16LE(p + 14),
      mode: b.readUInt32LE(p + 38) >>> 16,
    });
    p += 46 + nameLength + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  return entries;
}
function sampleTree() {
  const dir = tempDir();
  const write = (path: string, content: string | Buffer) => {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  };
  write("fuente/README.md", "# Título\n\nDos líneas con LF.\n");
  write("fuente/apps/api/src/main.ts", "export const a = 1;\n");
  write("fuente/apps/web/public/icon.png", Buffer.from([137, 80, 0, 255]));
  write("fuente/docs/Guía de señalización.md", "ñandú\n");
  write("fuente/vacío.txt", "");
  write("fuente/.env.example", "JWT_SECRET=ejemplo\n");
  // Nada de esto debe salir del equipo.
  write("fuente/.env", "JWT_SECRET=secreto-real\n");
  write("fuente/.env.local", "JWT_SECRET=secreto-real\n");
  write("fuente/clave.pem", "privada\n");
  write("fuente/api.log", "registro\n");
  write("fuente/node_modules/x/index.js", "module.exports = 1;\n");
  write("fuente/apps/web/dist/index.html", "<html></html>\n");
  write("fuente/.local-db/PG_VERSION", "18\n");
  write("fuente/backups/fitstore-2026.dump", "respaldo con datos\n");
  write("fuente/apps/api/revision-inventario.csv", "ID;Costo\n1;99\n");
  return dir;
}

describe("Portabilidad · ZIP fuente (scripts/package.mjs)", () => {
  it("se genera sin Python y es reproducible, sin secretos ni datos locales", async () => {
    // Dependía de python3 o python: en Windows responde el alias de Microsoft
    // Store (código 9009) aunque Python no esté instalado.
    const { pack } = await load("package.mjs");
    const dir = sampleTree();
    try {
      const result = pack(join(dir, "fuente"), join(dir, "uno.zip"));
      const zip = readZip(join(dir, "uno.zip"));
      const names = zip.map((entry) => entry.name);
      expect(names).toEqual([
        "fitstore-pos/.env.example",
        "fitstore-pos/README.md",
        "fitstore-pos/apps/api/src/main.ts",
        "fitstore-pos/apps/web/public/icon.png",
        "fitstore-pos/docs/Guía de señalización.md",
        "fitstore-pos/vacío.txt",
      ]);
      expect(result.files).toBe(names.length);
      const content = (name: string) =>
        zip.find((entry) => entry.name === "fitstore-pos/" + name)!.data;
      // El contenido va byte a byte: los finales LF no se tocan.
      expect(content("README.md").toString("utf8")).toBe(
        "# Título\n\nDos líneas con LF.\n",
      );
      expect([...content("apps/web/public/icon.png")]).toEqual([
        137, 80, 0, 255,
      ]);
      expect(content("vacío.txt").length).toBe(0);
      // Fecha fija (5 de octubre de 2026, 00:00) y permisos 0644.
      for (const entry of zip)
        expect([entry.date, entry.time, entry.mode]).toEqual([
          ((2026 - 1980) << 9) | (10 << 5) | 5,
          0,
          0o100644,
        ]);
      pack(join(dir, "fuente"), join(dir, "dos.zip"));
      expect(
        readFileSync(join(dir, "uno.zip")).equals(
          readFileSync(join(dir, "dos.zip")),
        ),
      ).toBe(true);
    } finally {
      remove(dir);
    }
  });
  it("la orden empaqueta la carpeta actual en la ruta indicada", async () => {
    await load("package.mjs");
    const dir = sampleTree();
    try {
      const r = await node(
        [resolve(root, "scripts/package.mjs"), join(dir, "salida.zip")],
        { cwd: join(dir, "fuente") },
      );
      expect(r.out).toContain("ZIP: " + join(dir, "salida.zip"));
      expect(r.code).toBe(0);
      expect(readZip(join(dir, "salida.zip")).length).toBe(6);
    } finally {
      remove(dir);
    }
  }, 30000);
});
