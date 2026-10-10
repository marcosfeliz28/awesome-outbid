// Tamaño explícito del pool de conexiones de Prisma (auditoría 06, D-M2).
//
// Sin connection_limit, Prisma abre num_cpus * 2 + 1 conexiones por proceso:
// depende de la máquina (17 en una computadora de 8 núcleos, 3 en un
// contenedor con 1 CPU) y no del límite de PostgreSQL. Con pool_timeout por
// defecto (10 s) una ráfaga de ventas devolvía 500 (P2024) en vez de esperar.
//
// Valores: los que ya traiga DATABASE_URL tienen prioridad; si no, las
// variables NEXORA_DB_CONNECTION_LIMIT y NEXORA_DB_POOL_TIMEOUT (segundos);
// si no, DEFAULT_POOL. Los parámetros se agregan al final de la URL sin
// volver a codificar el resto (options=-c%20TimeZone%3DUTC queda intacto).
export const DEFAULT_POOL = { connectionLimit: 10, poolTimeout: 20 };

const positiveInt = (value: string | undefined, max: number) => {
  if (!value || !/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value.trim());
  return n >= 1 && n <= max ? n : undefined;
};

export function databaseUrlWithPool(
  url: string | undefined,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (!url?.trim()) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const add: string[] = [];
  if (!parsed.searchParams.has("connection_limit"))
    add.push(
      "connection_limit=" +
        (positiveInt(env.NEXORA_DB_CONNECTION_LIMIT, 200) ??
          DEFAULT_POOL.connectionLimit),
    );
  if (!parsed.searchParams.has("pool_timeout"))
    add.push(
      "pool_timeout=" +
        (positiveInt(env.NEXORA_DB_POOL_TIMEOUT, 600) ??
          DEFAULT_POOL.poolTimeout),
    );
  if (!add.length) return url;
  const [beforeHash, hash] = url.split(/#(.*)/s, 2);
  const joiner = !beforeHash.includes("?")
    ? "?"
    : /[?&]$/.test(beforeHash)
      ? ""
      : "&";
  return beforeHash + joiner + add.join("&") + (hash ? "#" + hash : "");
}
