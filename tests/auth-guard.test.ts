import { describe, expect, it } from "vitest";
import { AuthGuard } from "../apps/api/src/common";

// Prueba de carga con un año de historial: el pool de Prisma se agotaba
// (P2024) y el guard convertía ese fallo de la base en un 401 «Inicia sesión»:
// la web intentaba renovar la sesión y las cajeras veían errores de sesión
// falsos. Un fallo de la base debe ser 503 (la web lo trata como «sin
// conexión» y reintenta); 401 sólo para token o sesión inválidos.

const USER_ID = "8f2b1c1e-5c1a-4a43-9d37-3a5b0c1d2e3f";
const SESSION_ID = "0b6c9a8e-1f2d-4e3c-8b7a-6d5e4f3a2b1c";

function prismaError(code: string, name = "PrismaClientKnownRequestError") {
  return Object.assign(new Error("Prisma " + code), { code, name });
}

function context(token = "token") {
  const req: any = { headers: { authorization: "Bearer " + token } };
  return {
    req,
    ctx: {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as any,
  };
}

function guard(db: any, verify: () => any = () => payload()) {
  return new AuthGuard(
    db,
    { verify } as any,
    { getAllAndOverride: () => undefined } as any,
  );
}

const payload = () => ({
  sub: USER_ID,
  type: "access",
  version: 1,
  sid: SESSION_ID,
});

function database(overrides: Record<string, any> = {}) {
  const user = {
    id: USER_ID,
    active: true,
    mustChangePassword: false,
    authVersion: 1,
    branchId: "main",
    name: "Cajera",
    email: "cajera@example.test",
    role: { name: "seller", permissions: ["sale:write"] },
  };
  return {
    user: { findUnique: async () => user },
    settings: { findUnique: async () => null },
    authSession: {
      updateMany: async () => ({ count: 1 }),
      findUnique: async () => ({
        id: SESSION_ID,
        userId: USER_ID,
        terminalId: null,
        lastActivityAt: new Date(),
      }),
    },
    terminal: { findUnique: async () => null, update: async () => ({}) },
    ...overrides,
  };
}

const failing = (error: unknown) => async () => {
  throw error;
};

describe("AuthGuard · fallos de la base no cierran la sesión", () => {
  for (const [label, error] of [
    ["pool agotado (P2024)", prismaError("P2024")],
    ["transacción vencida (P2028)", prismaError("P2028")],
    ["servidor inalcanzable (P1001)", prismaError("P1001")],
    ["servidor sin respuesta (P1002)", prismaError("P1002")],
    ["conexión cerrada (P1017)", prismaError("P1017")],
    [
      "sin conexión al iniciar",
      Object.assign(new Error("Can't reach database server"), {
        name: "PrismaClientInitializationError",
        errorCode: "P1001",
      }),
    ],
    [
      "error desconocido de la base",
      Object.assign(new Error("canceling statement due to statement timeout"), {
        name: "PrismaClientUnknownRequestError",
      }),
    ],
  ] as const) {
    it(`${label} → 503, no 401`, async () => {
      for (const where of ["user", "settings", "authSession"] as const) {
        const db: any = database();
        if (where === "authSession") {
          db.authSession.findUnique = failing(error);
          db.authSession.updateMany = failing(error);
        } else db[where].findUnique = failing(error);
        const { ctx } = context();
        await expect(guard(db).canActivate(ctx)).rejects.toMatchObject({
          status: 503,
          response: { code: "DB_UNAVAILABLE" },
        });
      }
    });
  }

  it("token inválido, sesión inexistente o usuario inactivo siguen siendo 401", async () => {
    const cases: [any, () => any][] = [
      [
        database(),
        () => {
          throw Object.assign(new Error("jwt expired"), {
            name: "TokenExpiredError",
          });
        },
      ],
      [database(), () => ({ ...payload(), type: "refresh" })],
      [
        database({
          user: { findUnique: async () => null },
        }),
        payload,
      ],
      [
        database({
          authSession: {
            updateMany: async () => ({ count: 0 }),
            findUnique: async () => null,
          },
        }),
        payload,
      ],
      // Un error de datos (no de disponibilidad) no se disfraza de 503.
      [
        database({ user: { findUnique: failing(prismaError("P2025")) } }),
        payload,
      ],
    ];
    for (const [db, verify] of cases) {
      const { ctx } = context();
      await expect(guard(db, verify).canActivate(ctx)).rejects.toMatchObject({
        status: 401,
        response: "Inicia sesión para continuar.",
      });
    }
  });

  it("con la base sana deja pasar y fija el actor", async () => {
    const { ctx, req } = context();
    await expect(guard(database()).canActivate(ctx)).resolves.toBe(true);
    expect(req.actor).toMatchObject({ id: USER_ID, sessionId: SESSION_ID });
  });
});
