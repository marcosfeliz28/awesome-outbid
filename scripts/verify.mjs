// Verificación completa: pruebas de la API y de navegador contra la API en
// marcha. Si no responde, inicia PostgreSQL local y la API de desarrollo, y los
// detiene al terminar.
//
// FITSTORE_API_URL (http://127.0.0.1:PORT/api) y PORT (3001) indican qué API se
// verifica; se leen del entorno y de .env, igual que DATABASE_URL.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, mkdirSync, openSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { connect } from "node:net";
import { dirname, resolve } from "node:path";
import { clearTimeout, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WINDOWS = process.platform === "win32";
const children = [];

/** API que se verifica, con los valores por defecto de la API y de las pruebas. */
export function targets(env = process.env) {
  const port = String(env.PORT || 3001);
  const api = (env.FITSTORE_API_URL || `http://127.0.0.1:${port}/api`).replace(
    /\/+$/,
    "",
  );
  const url = new URL(api);
  return {
    api,
    health: api + "/health",
    // Puerto en el que debe escuchar la API si hay que iniciarla aquí.
    apiPort: url.port || (url.protocol === "https:" ? "443" : "80"),
    // La PWA de las pruebas de navegador reenvía /api a esta misma API.
    proxy: env.FITSTORE_API_PROXY || url.origin,
    local: ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
  };
}

// En Windows pnpm es un guion .cmd y spawn, sin intérprete de órdenes,
// responde ENOENT. Con intérprete la orden va en una sola cadena, porque Node
// no escapa los argumentos sueltos.
function command(name, args) {
  if (name === "node") return [process.execPath, args, {}];
  if (!WINDOWS) return [name, args, {}];
  const quote = (arg) =>
    /[\s"&|<>^()]/.test(arg) ? `"${arg.replaceAll('"', '\\"')}"` : arg;
  return [[name, ...args].map(quote).join(" "), [], { shell: true }];
}

/** Ejecuta una orden hasta que termina y devuelve su código de salida. */
export function run(name, args, options = {}) {
  const [file, argv, shell] = command(name, args);
  const child = spawn(file, argv, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
    ...options,
    ...shell,
  });
  return new Promise((done, fail) => {
    child.on("error", fail);
    child.on("exit", (code) => done(code ?? 1));
  });
}

/** Inicia un proceso de apoyo con su salida en un registro. */
export function launch(name, args, label, options = {}) {
  const logDir = options.logDir ?? resolve(root, "test-results");
  mkdirSync(logDir, { recursive: true });
  const log = openSync(resolve(logDir, label + ".log"), "w");
  const [file, argv, shell] = command(name, args);
  const child = spawn(file, argv, {
    cwd: root,
    stdio: ["ignore", log, log, ...(options.ipc ? ["ipc"] : [])],
    env: options.env ?? process.env,
    ...shell,
  });
  closeSync(log);
  // Sin este manejador, un fallo de spawn es una excepción no capturada y el
  // script muere sin detener lo que ya inició.
  child.on("error", (error) =>
    console.error(`No se pudo iniciar ${label}: ${error.message}`),
  );
  children.push(child);
  return child;
}

const ended = (child) =>
  child.pid === undefined ||
  child.exitCode !== null ||
  child.signalCode !== null;
function exited(child, ms) {
  if (ended(child)) return Promise.resolve(true);
  return new Promise((done) => {
    const timer = setTimeout(() => done(false), ms);
    child.once("exit", () => {
      clearTimeout(timer);
      done(true);
    });
  });
}

/** Detiene un proceso iniciado con launch y los que haya lanzado. */
export async function stop(child) {
  if (ended(child)) return;
  if (child.connected) {
    // local-db: apagado limpio de PostgreSQL. En Windows no existe SIGTERM:
    // kill() se lleva a postgres.exe sin cerrar la base y queda postmaster.pid.
    try {
      child.send("stop");
    } catch {
      // El canal se cerró: el proceso ya está saliendo.
    }
    if (await exited(child, 30000)) return;
  }
  // En Windows kill() termina sólo el intérprete de órdenes: pnpm, tsx y la
  // API seguirían vivos con el puerto ocupado.
  if (WINDOWS)
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  else child.kill("SIGTERM");
  await exited(child, 10000);
}
const stopAll = () => Promise.all(children.map(stop));

async function available(url) {
  try {
    return (await fetch(url, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}
async function wait(url, child) {
  // tsx compila la API al arrancar: en Windows, con el equipo ocupado, tarda.
  const until = Date.now() + 90000;
  while (Date.now() < until && !ended(child)) {
    if (await available(url)) return;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("No se pudo iniciar " + url + ". Consulta test-results.");
}
function listening(host, port) {
  return new Promise((done) => {
    const socket = connect({ host, port });
    const finish = (open) => {
      socket.destroy();
      done(open);
    };
    socket.setTimeout(1000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}
// Inicia PostgreSQL local salvo que ya haya un servidor en DATABASE_URL (el de
// otra terminal, el servicio del equipo o el del CI), y espera a que acepte
// conexiones antes de arrancar la API.
async function startDatabase(env) {
  try {
    const url = new URL(env.DATABASE_URL);
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (await listening(host, Number(url.port || 5432))) return;
  } catch {
    // Sin DATABASE_URL válida se intenta igualmente con la base local.
  }
  const child = launch("node", ["scripts/local-db.mjs"], "database", {
    env,
    ipc: true,
  });
  const ready = await new Promise((done) => {
    const timer = setTimeout(() => done(false), 120000);
    const finish = (value) => {
      clearTimeout(timer);
      done(value);
    };
    child.once("message", (message) => finish(Boolean(message?.ready)));
    child.once("exit", () => finish(false));
    child.once("error", () => finish(false));
  });
  if (!ready)
    console.error(
      "PostgreSQL local no arrancó (test-results/database.log); se sigue con la base de DATABASE_URL.",
    );
}

async function main() {
  // El mismo .env que leen la API y las pruebas; lo exportado en la consola
  // tiene prioridad.
  createRequire(resolve(root, "apps/api/package.json"))("dotenv").config({
    path: resolve(root, ".env"),
    quiet: true,
  });
  const target = targets();
  // Las pruebas, la PWA y la API que se inicie aquí usan la misma API.
  const env = {
    ...process.env,
    FITSTORE_API_URL: target.api,
    FITSTORE_API_PROXY: target.proxy,
  };
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"])
    process.on(signal, () => stopAll().then(() => process.exit(1)));
  let code = 1;
  try {
    if (!(await available(target.health))) {
      if (!target.local)
        throw new Error(
          `La API ${target.api} no responde y no es de este equipo: no se puede iniciar desde aquí.`,
        );
      await startDatabase(env);
      const api = launch("pnpm", ["--filter", "@fitstore/api", "dev"], "api", {
        env: { ...env, PORT: target.apiPort },
      });
      await wait(target.health, api);
    }
    code = await run(
      "pnpm",
      ["exec", "vitest", "run", "--config", "vitest.integration.config.ts"],
      { env },
    );
    if (code === 0) code = await run("pnpm", ["test:e2e"], { env });
    else
      console.error(
        "Fallaron las pruebas de la API; no se ejecutan las de navegador.",
      );
  } catch (error) {
    console.error(error);
    code = 1;
  } finally {
    await stopAll();
  }
  process.exitCode = code;
  // Nada debería quedar abierto; si quedara, no se retiene la consola.
  setTimeout(() => process.exit(code), 5000).unref();
}

// Sólo actúa cuando se ejecuta como script; las pruebas importan sus funciones.
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
if (isMain()) await main();
