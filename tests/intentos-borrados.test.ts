// Carrera de CI (password-account, «dos cambios simultáneos»): el cambio de
// contraseña que gana borra las filas AuthAttempt de la cuenta sin el candado
// de verifyAttempt. Si eso pasa a mitad del intento del perdedor, su
// `authAttempt.update` daba P2025 y la API respondía 404 en vez de 400.
// Aquí `verify` borra las filas igual que el ganador, sin carrera real.
import { describe, expect, it } from "vitest";
import { verifyAttempt } from "../apps/api/src/security";

function fakeDb(keys: string[]) {
  const rows = new Map<string, any>(
    keys.map((key) => [
      key,
      {
        key,
        failedAttempts: 1,
        lockedUntil: null,
        windowStartedAt: new Date(),
      },
    ]),
  );
  const missing = () => Object.assign(new Error("P2025"), { code: "P2025" });
  const authAttempt = {
    upsert: async ({ where, create, update }: any) => {
      const row = rows.get(where.key);
      const next = row
        ? { ...row, ...update }
        : {
            failedAttempts: 0,
            lockedUntil: null,
            windowStartedAt: null,
            ...create,
          };
      rows.set(where.key, next);
      return next;
    },
    update: async ({ where, data }: any) => {
      const row = rows.get(where.key);
      if (!row) throw missing();
      rows.set(where.key, { ...row, ...data });
    },
    updateMany: async ({ where, data }: any) => {
      const row = rows.get(where.key);
      if (row) rows.set(where.key, { ...row, ...data });
      return { count: row ? 1 : 0 };
    },
  };
  // Sólo el candado consultivo y el UPDATE crudo del fallo propio.
  const $queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
    if (!strings.join("?").includes('UPDATE "AuthAttempt"')) return [];
    const row = rows.get(values[0]);
    if (!row) return [];
    row.failedAttempts += 1;
    return [{ failedAttempts: row.failedAttempts }];
  };
  const tx = { authAttempt, $queryRaw };
  return { rows, db: { $transaction: (work: any) => work(tx) } };
}

const own = "login:user-1:10.0.0.1";
const budget = {
  key: "login-account:user-1",
  max: 30,
  windowMs: 3600000,
  message: "Cuenta bloqueada.",
  scope: "account",
};
const messages = { blocked: "Bloqueada.", wrong: "Incorrecta." };

describe("verifyAttempt con las filas borradas por un cambio de contraseña", () => {
  it("acierto: no responde 404 aunque la fila propia desaparezca", async () => {
    const { db, rows } = fakeDb([own, budget.key]);
    const matched = await verifyAttempt(
      db,
      own,
      async () => {
        rows.clear();
        return "user-1";
      },
      messages,
      { budgets: [budget] },
    );
    expect(matched).toBe("user-1");
  });

  it("fallo: responde «Incorrecta.» (400) y el cupo de la cuenta sigue contando", async () => {
    const { db, rows } = fakeDb([own, budget.key]);
    const attempt = verifyAttempt(
      db,
      own,
      async () => {
        rows.clear();
        return null;
      },
      messages,
      { budgets: [budget] },
    );
    await expect(attempt).rejects.toMatchObject({
      status: 400,
      message: "Incorrecta.",
    });
    expect(rows.get(budget.key)).toMatchObject({ failedAttempts: 2 });
  });

  it("fallo 30: recrea el cupo bloqueado y no permite un intento 31", async () => {
    const { db, rows } = fakeDb([own, budget.key]);
    rows.get(budget.key).failedAttempts = 29;
    let checks = 0;

    const thirtieth = verifyAttempt(
      db,
      own,
      async () => {
        checks += 1;
        rows.clear();
        return null;
      },
      messages,
      { budgets: [budget] },
    );
    await expect(thirtieth).rejects.toMatchObject({
      status: 400,
      message: "Incorrecta.",
    });
    expect(rows.get(budget.key)).toMatchObject({ failedAttempts: 30 });
    expect(rows.get(budget.key).lockedUntil).toBeInstanceOf(Date);

    const thirtyFirst = verifyAttempt(
      db,
      own,
      async () => {
        checks += 1;
        return "user-1";
      },
      messages,
      { budgets: [budget] },
    );
    await expect(thirtyFirst).rejects.toMatchObject({
      status: 400,
      message: "Cuenta bloqueada.",
    });
    expect(checks).toBe(1);
  });
});
