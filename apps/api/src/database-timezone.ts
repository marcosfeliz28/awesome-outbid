// D-B7 (auditoría 06 v2): el código y las migraciones asumen que la sesión de
// PostgreSQL trabaja en UTC (las columnas son `timestamp` sin zona y Prisma las
// escribe en UTC). Render fija TimeZone=UTC en la conexión (with-cloud-env.mjs),
// pero con un DATABASE_URL tal cual (instalador, desarrollo, otra nube) la base
// podría usar otra zona y correr horas las fechas sin que nadie lo note.

const UTC_NAMES = new Set([
  "utc",
  "etc/utc",
  "etc/uct",
  "uct",
  "z",
  "zulu",
  "etc/zulu",
  "gmt",
  "etc/gmt",
  "etc/gmt+0",
  "etc/gmt-0",
  "etc/gmt0",
  "gmt0",
  "etc/greenwich",
  "greenwich",
  "universal",
  "etc/universal",
]);

export const isUtcTimeZone = (name: unknown) =>
  typeof name === "string" && UTC_NAMES.has(name.trim().toLowerCase());

export const timeZoneWarning = (name: string) =>
  `[Nexora] AVISO: la zona horaria de la sesión de PostgreSQL es «${name}», no UTC. ` +
  "Las fechas guardadas (timestamp sin zona) pueden correrse horas. " +
  "Agrega `?options=-c%20TimeZone%3DUTC` a DATABASE_URL o ejecuta " +
  "ALTER ROLE <usuario> SET TimeZone TO 'UTC'.";

/**
 * Lee `TimeZone` de la sesión al arrancar y avisa si no es UTC. Nunca lanza ni
 * impide el arranque: es un diagnóstico.
 */
export async function checkDatabaseTimeZone(
  db: { $queryRawUnsafe: (query: string) => Promise<unknown> },
  warn: (message: string) => void = console.warn,
): Promise<string | null> {
  try {
    const rows = (await db.$queryRawUnsafe(
      "SELECT current_setting('TimeZone') AS tz",
    )) as { tz?: unknown }[];
    const name = rows?.[0]?.tz;
    if (typeof name !== "string") return null;
    if (!isUtcTimeZone(name)) warn(timeZoneWarning(name));
    return name;
  } catch {
    return null;
  }
}
