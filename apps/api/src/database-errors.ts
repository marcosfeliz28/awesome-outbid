import { HttpException } from "@nestjs/common";

// Errores de Prisma que significan «la base no respondió a tiempo o no está
// disponible», no «los datos o la sesión son inválidos»: conexión imposible o
// cortada, tiempo agotado, pool lleno (P2024) o transacción vencida (P2028).
const UNAVAILABLE_CODES = new Set([
  "P1001", // No se puede llegar al servidor.
  "P1002", // El servidor no respondió a tiempo.
  "P1008", // Operación con tiempo agotado.
  "P1017", // El servidor cerró la conexión.
  "P2024", // Tiempo agotado esperando una conexión del pool.
  "P2028", // Error o tiempo agotado de una transacción interactiva.
  "P2037", // Demasiadas conexiones abiertas.
]);
const UNAVAILABLE_NAMES = new Set([
  "PrismaClientInitializationError",
  "PrismaClientRustPanicError",
  "PrismaClientUnknownRequestError",
]);

export function isDatabaseUnavailable(error: unknown) {
  const e = error as { code?: unknown; errorCode?: unknown; name?: unknown };
  if (!e || typeof e !== "object") return false;
  const code = typeof e.code === "string" ? e.code : e.errorCode;
  return (
    (typeof code === "string" && UNAVAILABLE_CODES.has(code)) ||
    (typeof e.name === "string" && UNAVAILABLE_NAMES.has(e.name))
  );
}

// 503 y no 401: la sesión puede ser válida; sólo falló la base. La web trata
// el 503 como «sin conexión» (reintenta con el mismo UUID) en vez de cerrar
// la sesión de la cajera.
export const databaseUnavailable = () =>
  new HttpException(
    {
      code: "DB_UNAVAILABLE",
      message:
        "El servidor está ocupado y no pudo comprobar tu sesión. Intenta de nuevo en unos segundos.",
    },
    503,
  );
