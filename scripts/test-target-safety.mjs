const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);

export function assertLocalHttpUrl(value, label) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${label} debe ser una URL local válida.`);
  }
  if (
    parsed.protocol !== "http:" ||
    !LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error(
      `${label} debe apuntar por HTTP al equipo local (loopback).`,
    );
  }
  return parsed;
}

/** Evita que las herramientas de prueba contacten servicios fuera del equipo. */
export function assertSafeTestTargets({ apiUrl, proxyUrl, databaseUrl, env }) {
  assertLocalHttpUrl(apiUrl, "FITSTORE_API_URL");
  if (proxyUrl) assertLocalHttpUrl(proxyUrl, "FITSTORE_API_PROXY");

  let database;
  try {
    database = new URL(databaseUrl);
  } catch {
    throw new Error(
      "DATABASE_URL debe definir una base PostgreSQL local de pruebas.",
    );
  }
  const databaseName = database.pathname.replace(/^\//, "");
  if (
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !LOOPBACK_HOSTS.has(database.hostname.toLowerCase()) ||
    database.searchParams.has("host") ||
    database.searchParams.has("hostaddr") ||
    !databaseName
  ) {
    throw new Error(
      "DATABASE_URL debe apuntar a una base PostgreSQL del equipo local.",
    );
  }

  const isolatedCi =
    env.CI === "true" &&
    env.GITHUB_ACTIONS === "true" &&
    databaseName === "fitstore";
  if (!isolatedCi && env.NEXORA_TEST_ALLOW_LOCAL_DATABASE !== "1") {
    throw new Error(
      "Base local de pruebas no autorizada: define NEXORA_TEST_ALLOW_LOCAL_DATABASE=1.",
    );
  }
}
