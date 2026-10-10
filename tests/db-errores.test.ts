import { describe, expect, it } from "vitest";
import { ApiExceptionFilter, safeErrorMessage } from "../apps/api/src/common";
import {
  constraintViolation,
  isDeadlock,
  moneyDb,
  retryDeadlock,
} from "../apps/api/src/database-errors";

// Auditoría 06/04 (P2028/P2024 fuera de AuthGuard, 23514/23503 sobre filas
// antiguas, interbloqueo 40P01 en transacciones de dinero). Las formas de los
// errores son las que entrega Prisma 6 contra PostgreSQL real.

const prisma = (
  code: string,
  name = "PrismaClientKnownRequestError",
  meta?: any,
) => Object.assign(new Error("Prisma " + code), { code, name, meta });
const deadlock = () =>
  prisma("P2010", "PrismaClientKnownRequestError", {
    code: "40P01",
    message: "ERROR: deadlock detected",
  });
// PrismaClientUnknownRequestError del ORM: sin code; el SQLSTATE y el nombre
// de la restricción sólo vienen dentro del texto.
const ormCheckViolation = () =>
  Object.assign(
    new Error(
      'Invalid `prisma.sale.update()` invocation: Error occurred during query execution: ConnectorError(QueryError(PostgresError { code: "23514", message: "new row for relation \\"Sale\\" violates check constraint \\"sale_amounts_nonnegative\\"" }))',
    ),
    { name: "PrismaClientUnknownRequestError" },
  );

function respond(error: unknown, path = "/api/sales") {
  const headers: Record<string, string> = {};
  let status = 0;
  let body: any;
  const res: any = {
    setHeader: (k: string, v: string) => (headers[k] = v),
    status(code: number) {
      status = code;
      return res;
    },
    json: (b: unknown) => (body = b),
  };
  const host: any = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ path }),
    }),
  };
  const log = console.error;
  console.error = () => undefined;
  try {
    new ApiExceptionFilter().catch(error, host);
  } finally {
    console.error = log;
  }
  return { status, body, headers };
}

describe("ApiExceptionFilter · errores de la base", () => {
  it.each(["P2028", "P2024", "P1001", "P1017"])(
    "%s fuera de AuthGuard es 503 DB_UNAVAILABLE reintentable, no 500",
    (code) => {
      const r = respond(prisma(code));
      expect(r.status).toBe(503);
      expect(r.body.code).toBe("DB_UNAVAILABLE");
      expect(r.headers["Retry-After"]).toBe("5");
    },
  );

  it("23514 en un UPDATE de una fila antigua (error desconocido del ORM) es 409 con la regla, no 503 ni 500", () => {
    const r = respond(ormCheckViolation());
    expect(r.status).toBe(409);
    expect(r.body.code).toBe("CONSTRAINT_VIOLATION");
    expect(r.body.message).toContain("sale_amounts_nonnegative");
    expect(r.body.message).toContain("MIGRACIONES_SEGURAS");
    expect(r.headers["Retry-After"]).toBeUndefined();
  });

  it("23514/23503 por consulta cruda y P2003 también son 409", () => {
    for (const e of [
      prisma("P2010", "PrismaClientKnownRequestError", {
        code: "23514",
        message:
          'ERROR: new row for relation "Payment" violates check constraint "payment_amounts_nonnegative"',
      }),
      prisma("P2010", "PrismaClientKnownRequestError", {
        code: "23503",
        message:
          'ERROR: insert or update on table "Sale" violates foreign key constraint "Sale_customerId_fkey"',
      }),
      prisma("P2003", "PrismaClientKnownRequestError", {
        constraint: "Payment_cashSessionId_fkey",
      }),
    ]) {
      const r = respond(e);
      expect(r.status).toBe(409);
      expect(r.body.code).toBe("CONSTRAINT_VIOLATION");
    }
  });

  it("un interbloqueo que agotó los reintentos es 409 reintentable, no 500", () => {
    expect(respond(deadlock()).status).toBe(409);
    expect(safeErrorMessage(deadlock())).toMatch(/Reintenta/);
  });

  it("un error cualquiera sigue siendo 500", () => {
    expect(respond(new Error("otra cosa")).status).toBe(500);
  });
});

describe("retryDeadlock / moneyDb", () => {
  it("reconoce 40P01 en sus formas", () => {
    expect(isDeadlock(deadlock())).toBe(true);
    expect(isDeadlock(prisma("40P01"))).toBe(true);
    expect(isDeadlock(prisma("P2034"))).toBe(true);
    expect(isDeadlock(new Error("ERROR: deadlock detected"))).toBe(true);
    expect(isDeadlock(prisma("P2002"))).toBe(false);
    expect(isDeadlock(null)).toBe(false);
    expect(constraintViolation(prisma("P2002"))).toBeNull();
  });

  it("reintenta como máximo 2 veces y entonces devuelve el error", async () => {
    let calls = 0;
    await expect(
      retryDeadlock(async () => {
        calls++;
        throw deadlock();
      }),
    ).rejects.toMatchObject({ code: "P2010" });
    expect(calls).toBe(3);
  });

  it("el segundo intento puede salir bien", async () => {
    let calls = 0;
    expect(
      await retryDeadlock(async () => {
        if (++calls < 2) throw deadlock();
        return "ok";
      }),
    ).toBe("ok");
    expect(calls).toBe(2);
  });

  it("otros errores no se reintentan", async () => {
    let calls = 0;
    await expect(
      retryDeadlock(async () => {
        calls++;
        throw prisma("P2002");
      }),
    ).rejects.toMatchObject({ code: "P2002" });
    expect(calls).toBe(1);
  });

  it("moneyDb reintenta la transacción completa con sus opciones", async () => {
    const seen: unknown[] = [];
    let calls = 0;
    const db: any = {
      $transaction: async (fn: any, options: unknown) => {
        seen.push(options);
        if (++calls < 3) throw deadlock();
        return fn("tx");
      },
    };
    const out = await moneyDb(db).$transaction(async (tx: any) => tx + "!", {
      timeout: 20000,
    });
    expect(out).toBe("tx!");
    expect(seen).toEqual([
      { timeout: 20000 },
      { timeout: 20000 },
      { timeout: 20000 },
    ]);
  });
});
