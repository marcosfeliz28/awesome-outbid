import { HttpException } from "@nestjs/common";
import type { Prisma, PrismaClient } from "@prisma/client";

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

// Prisma envuelve SQLSTATE 40P01 (deadlock_detected) según la vía: en una
// consulta cruda llega como P2010 con meta.code, en una operación del ORM
// como P2034 («write conflict or a deadlock») o con el texto del servidor.
export function isDeadlock(error: unknown) {
  const e = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown };
  };
  if (!e || typeof e !== "object") return false;
  const detail = String(e.meta?.code ?? "") + String(e.meta?.message ?? "");
  const message = String(e.message ?? "");
  return (
    e.code === "40P01" ||
    e.code === "P2034" ||
    detail.includes("40P01") ||
    detail.includes("deadlock detected") ||
    message.includes("40P01") ||
    message.includes("deadlock detected")
  );
}

/**
 * Dos reintentos como máximo (tres intentos en total) ante un interbloqueo.
 * Sólo se usa alrededor de una transacción COMPLETA y repetible (las de dinero
 * son idempotentes por UUID o clave de operación); otros errores jamás se
 * reintentan. El jitter evita que las dos víctimas choquen otra vez a la vez.
 */
export async function retryDeadlock<T>(
  operation: () => Promise<T>,
  retries = 2,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (!isDeadlock(error) || attempt >= retries) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, 15 + attempt * 25 + Math.floor(Math.random() * 25)),
      );
    }
  }
}

export type ConstraintViolation = {
  kind: "check" | "foreign_key";
  name: string;
};

// Un CHECK o una FK agregados como NOT VALID se vuelven a evaluar en cada
// UPDATE de cada fila, también en las antiguas que ya los violaban (23514 y
// 23503). Prisma los devuelve como P2003/P2004 o como error desconocido con el
// texto del servidor; hay que reconocerlos ANTES de decidir que «la base no
// está disponible» (PrismaClientUnknownRequestError).
export function constraintViolation(
  error: unknown,
): ConstraintViolation | null {
  const e = error as {
    code?: unknown;
    message?: unknown;
    meta?: { code?: unknown; message?: unknown; constraint?: unknown };
  };
  if (!e || typeof e !== "object") return null;
  const text = [e.message, e.meta?.message, e.meta?.code]
    .map((part) => String(part ?? ""))
    .join("\n");
  const named = /violates (check|foreign key) constraint \\*"([^"\\]+)/.exec(
    text,
  );
  if (named)
    return {
      kind: named[1] === "check" ? "check" : "foreign_key",
      name: named[2],
    };
  const byCode =
    e.code === "23514" || /\b23514\b/.test(text)
      ? "check"
      : e.code === "23503" || e.code === "P2003" || /\b23503\b/.test(text)
        ? "foreign_key"
        : e.code === "P2004"
          ? "check"
          : null;
  if (!byCode) return null;
  const meta = e.meta?.constraint;
  const name = Array.isArray(meta) ? meta.join(",") : String(meta ?? "");
  return { kind: byCode, name: name || "desconocida" };
}

export const constraintConflictMessage = (v: ConstraintViolation) =>
  `Este registro no cumple una regla de integridad de la base de datos (${v.name}) y no se puede modificar así. ` +
  "Si es un registro antiguo, pide a soporte que lo revise y lo corrija (consulta de violaciones en docs/MIGRACIONES_SEGURAS.md).";

/**
 * Transacciones interactivas de dinero (venta, anulación, devolución, cierre,
 * movimientos, gastos y pagos a proveedor) con dos reintentos ante un
 * interbloqueo. Son repetibles: cada una se identifica por UUID o clave de
 * operación y revisa primero si ya se hizo. Se usa como
 * `moneyDb(this.db).$transaction(async (tx) => …, opciones)`.
 */
export function moneyDb(db: Pick<PrismaClient, "$transaction">) {
  return {
    $transaction: <T>(
      operation: (tx: Prisma.TransactionClient) => Promise<T>,
      options?: { timeout?: number; maxWait?: number },
    ): Promise<T> => retryDeadlock(() => db.$transaction(operation, options)),
  };
}
