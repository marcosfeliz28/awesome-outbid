// PostgreSQL local sin Docker para desarrollo y pruebas (pnpm db:local).
//
//   node scripts/local-db.mjs            inicia el servidor; Ctrl+C lo detiene
//   node scripts/local-db.mjs --detener  detiene el que usa la carpeta de datos
//
// FITSTORE_DB_PORT (5434) y FITSTORE_DB_DIR (.local-db) cambian el puerto y la
// carpeta de datos.
import { execFile, spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";

/** Carpeta de datos, puerto y opciones del servidor. */
export function config(env = process.env, platform = process.platform) {
  // Rutas con resolve y fileURLToPath: URL.pathname es "/C:/…" en Windows y
  // initdb no puede crear esa carpeta.
  const dir = env.FITSTORE_DB_DIR
    ? resolve(env.FITSTORE_DB_DIR)
    : resolve(root, ".local-db");
  const port = Number(env.FITSTORE_DB_PORT || 5434);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("FITSTORE_DB_PORT debe ser un puerto entre 1 y 65535.");
  const flags = [
    "-c",
    "listen_addresses=127.0.0.1",
    // Las sesiones empiezan en UTC, como en producción, y no en la zona del
    // equipo (initdb la copia a postgresql.conf).
    "-c",
    "timezone=UTC",
    "-c",
    "log_timezone=UTC",
  ];
  // El socket Unix va junto a los datos. En Windows no se usa, y con una ruta
  // de Windows el servidor no arranca.
  if (platform !== "win32") flags.push("-c", `unix_socket_directories=${dir}`);
  // initdb toma la codificación de la configuración regional del equipo:
  // WIN1252 en Windows, que rechaza cualquier carácter fuera de esa tabla.
  const initFlags = ["--encoding=UTF8"];
  return { dir, port, flags, initFlags };
}

function isPostgres(pid) {
  const run = (command, args) =>
    spawnSync(command, args, { encoding: "utf8" }).stdout ?? "";
  if (WINDOWS)
    return /postgres\.exe/i.test(
      run("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]),
    );
  try {
    return readFileSync(`/proc/${pid}/comm`, "utf8").includes("postgres");
  } catch {
    // Sin /proc (macOS).
    return run("ps", ["-p", String(pid), "-o", "comm="]).includes("postgres");
  }
}

/** PID del servidor que usa la carpeta de datos, o null si no hay ninguno. */
function postmaster(dir) {
  try {
    const first = readFileSync(join(dir, "postmaster.pid"), "utf8");
    const pid = Number(first.split("\n")[0]);
    // Un postmaster.pid viejo puede apuntar a un PID que hoy es otro programa.
    return Number.isInteger(pid) && pid > 0 && isPostgres(pid) ? pid : null;
  } catch {
    return null;
  }
}

// pg_ctl viene en el mismo paquete de binarios que usa embedded-postgres.
async function pgCtl() {
  const from = createRequire(import.meta.resolve("embedded-postgres"));
  const name = `@embedded-postgres/windows-${process.arch}`;
  return (await import(pathToFileURL(from.resolve(name)).href)).pg_ctl;
}

/**
 * Pide el apagado rápido (cierra sesiones y guarda) al servidor de la carpeta y
 * espera a que termine; con `own`, sólo si es ese proceso. Devuelve si quedó
 * detenido. La petición sale antes del primer await: llega aunque este proceso
 * esté terminando.
 */
async function shutdown(dir, ctl, own) {
  const pid = postmaster(dir);
  if (!pid || (own && pid !== own)) return !pid;
  if (WINDOWS)
    // Windows no tiene señales: pg_ctl avisa al servidor por su propio canal.
    await new Promise((done) =>
      execFile(ctl, ["stop", "-D", dir, "-m", "fast", "-w", "-t", "60"], done),
    );
  else process.kill(pid, "SIGINT");
  const end = Date.now() + (WINDOWS ? 0 : 60000);
  while (postmaster(dir) && Date.now() < end)
    await new Promise((done) => setTimeout(done, 200));
  return !postmaster(dir);
}

async function main() {
  const { dir, port, flags, initFlags } = config();
  if (process.argv.includes("--detener")) {
    const pid = postmaster(dir);
    if (!pid) {
      console.log(`No hay PostgreSQL local en marcha en ${dir}.`);
      return;
    }
    if (!(await shutdown(dir, WINDOWS ? await pgCtl() : null)))
      throw new Error(`No se pudo detener PostgreSQL local (PID ${pid}).`);
    console.log(`PostgreSQL local detenido (PID ${pid}).`);
    return;
  }

  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  const log = [];
  const database = new EmbeddedPostgres({
    databaseDir: dir,
    user: "fitstore",
    password: "fitstore_local",
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: flags,
    initdbFlags: initFlags,
    onLog: (message) => {
      log.push(String(message));
      if (log.length > 30) log.shift();
    },
    onError: (error) => console.error(String(error)),
  });

  // La biblioteca detiene el servidor en Windows con «taskkill /f»: lo mata sin
  // cerrar la base y deja postmaster.pid. Se sustituye su stop(), que también
  // llama su gancho de salida, por el apagado limpio del servidor propio.
  const ctl = WINDOWS ? await pgCtl() : null;
  const kill = database.stop.bind(database);
  let stopping;
  database.stop = () =>
    (stopping ??= (async () => {
      const own = database.process;
      // Sin servidor propio en marcha no hay nada que detener (y la biblioteca
      // esperaría para siempre la salida de un proceso que ya terminó).
      if (!own || own.exitCode !== null || own.signalCode !== null) return;
      if (!WINDOWS || !(await shutdown(dir, ctl, own.pid))) await kill();
    })());
  const exit = async (code) => {
    await database.stop();
    process.exit(code);
  };

  if (!existsSync(join(dir, "PG_VERSION"))) await database.initialise();
  try {
    await database.start();
  } catch {
    // La biblioteca rechaza sin motivo: lo da el registro del servidor.
    console.error(log.join("").trimEnd());
    const pid = postmaster(dir);
    throw new Error(
      `PostgreSQL no arrancó en 127.0.0.1:${port}.` +
        (pid
          ? ` Ya hay un servidor usando ${dir} (PID ${pid}); detenlo con: node scripts/local-db.mjs --detener`
          : ""),
    );
  }
  // Si el servidor termina por su cuenta (--detener desde otra terminal o un
  // fallo), este proceso no se queda esperando para siempre.
  database.process?.once("exit", (code) => {
    if (stopping) return;
    console.log("PostgreSQL local se detuvo.");
    process.exit(code === 0 ? 0 : 1);
  });

  let timezone;
  try {
    const client = database.getPgClient("postgres", "127.0.0.1");
    await client.connect();
    const found = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'fitstore'",
    );
    if (!found.rowCount) await client.query('CREATE DATABASE "fitstore"');
    timezone = (await client.query("SHOW timezone")).rows[0].TimeZone;
    await client.end();
  } catch (error) {
    console.error(error);
    return exit(1);
  }
  console.log(
    `PostgreSQL listo en 127.0.0.1:${port} (zona horaria ${timezone}). Ctrl+C para detener.`,
  );

  process.on("SIGINT", () => exit(0));
  process.on("SIGTERM", () => exit(0));
  if (process.send) {
    // Iniciado por otro script de Node (verify.mjs). En Windows no hay SIGTERM:
    // kill() termina este proceso sin ejecutar nada y, con él, a postgres.exe
    // sin cerrar la base. El apagado se pide por el canal IPC, y también
    // ocurre si el padre desaparece.
    process.on("message", (message) => {
      if (message === "stop") exit(0);
    });
    process.on("disconnect", () => exit(0));
    if (process.connected) process.send({ ready: true, port });
  }
  setInterval(() => {}, 30000);
}

// Sólo actúa cuando se ejecuta como script; las pruebas importan config().
function isMain() {
  try {
    const [a, b] = [process.argv[1], fileURLToPath(import.meta.url)].map(
      (path) => realpathSync(path),
    );
    return WINDOWS ? a.toLowerCase() === b.toLowerCase() : a === b;
  } catch {
    return false;
  }
}
if (isMain())
  await main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
