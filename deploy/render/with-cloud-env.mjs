import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Valores por defecto (ver docs/MIGRACIONES_SEGURAS.md y la auditoría de
// infraestructura M1/M4). Se pueden cambiar con variables del servicio API.
const DEFAULT_CONNECTION_LIMIT = 10;
const DEFAULT_MIGRATION_LOCK_TIMEOUT = "5s";
const DEFAULT_MIGRATION_STATEMENT_TIMEOUT = "120s";
const DURATION = /^(?:0|[1-9][0-9]{0,6}(?:ms|s|min)?)$/;

function duration(value, fallback, name) {
  const text = value?.trim() || fallback;
  if (!DURATION.test(text))
    throw new Error(
      `${name} no es una duración válida (por ejemplo 5s o 2min).`,
    );
  return text;
}

// `prisma migrate deploy` (el preDeployCommand de Render) se reconoce por sus
// argumentos para no tener que cambiar la orden configurada en el panel.
export function isMigrationCommand(args = []) {
  const at = args.indexOf("migrate");
  return at >= 0 && args[at + 1] === "deploy";
}

// Una migración nunca espera un bloqueo más de lock_timeout (las cajas que
// llegan detrás quedarían en cola) ni corre una sentencia más de
// statement_timeout. Si falla, se reintenta fuera de horario o con un valor
// mayor fijado a propósito (NEXORA_MIGRATION_*_TIMEOUT).
function migrationOptions(env) {
  const lock = duration(
    env.NEXORA_MIGRATION_LOCK_TIMEOUT,
    DEFAULT_MIGRATION_LOCK_TIMEOUT,
    "NEXORA_MIGRATION_LOCK_TIMEOUT",
  );
  const statement = duration(
    env.NEXORA_MIGRATION_STATEMENT_TIMEOUT,
    DEFAULT_MIGRATION_STATEMENT_TIMEOUT,
    "NEXORA_MIGRATION_STATEMENT_TIMEOUT",
  );
  return `-c lock_timeout=${lock} -c statement_timeout=${statement}`;
}

function addOptions(url, extra) {
  const current = url.searchParams.get("options")?.trim();
  url.searchParams.set("options", current ? `${current} ${extra}` : extra);
}

function connectionLimit(env) {
  const text = env.NEXORA_DB_CONNECTION_LIMIT?.trim();
  if (!text) return String(DEFAULT_CONNECTION_LIMIT);
  const value = Number(text);
  if (!/^[0-9]+$/.test(text) || value < 1 || value > 100)
    throw new Error(
      "NEXORA_DB_CONNECTION_LIMIT debe ser un entero de 1 a 100.",
    );
  return text;
}

function databaseEnvironment(source = process.env, { migration = false } = {}) {
  const env = { ...source };
  const renderUrl = env.RENDER_DATABASE_URL?.trim();

  if (!renderUrl) {
    if (!env.DATABASE_URL?.trim())
      throw new Error("Falta la conexión administrada a PostgreSQL.");
    if (migration) {
      let local;
      try {
        local = new URL(env.DATABASE_URL.trim());
      } catch {
        throw new Error("DATABASE_URL no es una URL válida.");
      }
      addOptions(local, migrationOptions(env));
      env.DATABASE_URL = local.toString();
    }
    return env;
  }

  let parsed;
  try {
    parsed = new URL(renderUrl);
  } catch {
    throw new Error(
      "La conexión administrada a PostgreSQL no es una URL válida.",
    );
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:")
    throw new Error("La conexión administrada no usa PostgreSQL.");

  // Render no permite interpolar parámetros sobre `fromDatabase` en el
  // Blueprint. Se añaden aquí sin imprimir nunca la URL ni sus credenciales.
  parsed.searchParams.set("sslmode", "require");
  parsed.searchParams.set("options", "-c TimeZone=UTC");
  if (migration) addOptions(parsed, migrationOptions(env));
  // Prisma calcula su pool con los núcleos físicos del HOST (no del
  // contenedor): en Render daba 17 conexiones fijas. Se fija un tope
  // explícito, salvo que la URL ya traiga uno.
  else if (!parsed.searchParams.has("connection_limit"))
    parsed.searchParams.set("connection_limit", connectionLimit(env));
  env.DATABASE_URL = parsed.toString();
  delete env.RENDER_DATABASE_URL;
  return env;
}

export function cloudEnvironment(source = process.env, options = {}) {
  return databaseEnvironment(source, options);
}

function isMain() {
  try {
    const [invoked, current] = [
      process.argv[1],
      fileURLToPath(import.meta.url),
    ].map((path) => realpathSync(path));
    return process.platform === "win32"
      ? invoked.toLowerCase() === current.toLowerCase()
      : invoked === current;
  } catch {
    return false;
  }
}

if (isMain()) {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error("Falta la orden que debe ejecutarse con el entorno cloud.");
    process.exit(2);
  }

  let env;
  try {
    env = cloudEnvironment(process.env, {
      migration: isMigrationCommand(args),
    });
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Entorno cloud inválido.",
    );
    process.exit(1);
  }

  // Un script de Node sin «node» delante (p. ej. apps/api/dist/main.js) se
  // carga en ESTE proceso: sin un segundo node residente (~46 MB) y con las
  // opciones de memoria que recibió este node (--max-old-space-size). Las
  // señales (SIGTERM de Render) las atiende directamente la API.
  if (/\.[cm]?js$/.test(command)) {
    for (const key of Object.keys(process.env))
      if (!(key in env)) delete process.env[key];
    Object.assign(process.env, env);
    const script = resolve(command);
    process.argv = [process.argv[0], script, ...args];
    try {
      await import(pathToFileURL(script).href);
    } catch (error) {
      // Nunca la URL de la base: se oculta si el mensaje la incluyera.
      console.error(
        "No se pudo iniciar el proceso de Nexora.",
        error instanceof Error
          ? error.message.replace(
              /postgres(?:ql)?:\/\/\S+/gi,
              "postgresql://***",
            )
          : "",
      );
      process.exit(1);
    }
  } else runChild(command, args, env);
}

function runChild(command, args, env) {
  const child = spawn(command, args, { env, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      if (child.exitCode === null) child.kill(signal);
    });
  child.on("error", () => {
    console.error("No se pudo iniciar el proceso de Nexora.");
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGTERM" ? 143 : 130);
  });
}
