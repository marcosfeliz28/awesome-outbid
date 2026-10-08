import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

function databaseEnvironment(source = process.env) {
  const env = { ...source };
  const renderUrl = env.RENDER_DATABASE_URL?.trim();

  if (!renderUrl) {
    if (!env.DATABASE_URL?.trim())
      throw new Error("Falta la conexión administrada a PostgreSQL.");
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
  env.DATABASE_URL = parsed.toString();
  delete env.RENDER_DATABASE_URL;
  return env;
}

export function cloudEnvironment(source = process.env) {
  return databaseEnvironment(source);
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
    env = cloudEnvironment();
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Entorno cloud inválido.",
    );
    process.exit(1);
  }

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
