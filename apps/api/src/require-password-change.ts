import type { PrismaClient } from "@prisma/client";
import { normalizeUsername } from "./auth";

export const PASSWORD_CHANGE_CONFIRMATION = "ROTATE_TEMPORARY_PASSWORDS";

export function passwordChangeUsernames(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((username) => normalizeUsername(username))
    .filter(Boolean);
}

type PasswordChangeUser = {
  id: string;
  usernameKey: string | null;
  email: string;
  branchId: string;
  mustChangePassword: boolean;
};

function resolveUsers(usernames: string[], users: PasswordChangeUser[]) {
  const resolved: PasswordChangeUser[] = [];
  const ids = new Set<string>();
  for (const username of usernames) {
    const matches = users.filter(
      (user) =>
        (user.usernameKey &&
          normalizeUsername(user.usernameKey) === username) ||
        normalizeUsername(user.email) === username,
    );
    const unique = [
      ...new Map(matches.map((user) => [user.id, user])).values(),
    ];
    if (unique.length !== 1 || ids.has(unique[0]?.id ?? ""))
      throw new Error(
        "La lista debe coincidir exactamente con cuentas existentes y activas, sin cuentas repetidas; no se modificó ninguna cuenta.",
      );
    ids.add(unique[0].id);
    resolved.push(unique[0]);
  }
  return resolved;
}

/**
 * Marca cuentas activas para cambiar su clave y revoca sus sesiones actuales.
 * La función es compartida por la orden administrativa y el arranque cloud.
 */
export async function requirePasswordChange(
  db: PrismaClient,
  usernames: string[],
) {
  if (!usernames.length || new Set(usernames).size !== usernames.length)
    throw new Error("Indica una lista no vacía y sin usuarios repetidos.");

  return db.$transaction(async (tx) => {
    const candidates = await tx.user.findMany({
      where: { active: true },
      select: {
        id: true,
        usernameKey: true,
        email: true,
        branchId: true,
        mustChangePassword: true,
      },
    });
    const requested = resolveUsers(usernames, candidates);

    // Orden estable para que dos instancias que arrancan a la vez no formen
    // un interbloqueo. La relectura posterior al lock garantiza idempotencia.
    const ids = requested.map((user) => user.id).sort();
    for (const id of ids)
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${id}::uuid FOR UPDATE`;
    const users = resolveUsers(
      usernames,
      await tx.user.findMany({
        where: { id: { in: ids }, active: true },
        select: {
          id: true,
          usernameKey: true,
          email: true,
          branchId: true,
          mustChangePassword: true,
        },
      }),
    );

    let changed = 0;
    for (const user of users) {
      if (user.mustChangePassword) continue;
      await tx.user.update({
        where: { id: user.id },
        data: { mustChangePassword: true, authVersion: { increment: 1 } },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.authAttempt.deleteMany({
        where: { key: { startsWith: `login:${user.id}:` } },
      });
      await tx.auditLog.create({
        data: {
          userId: "system",
          action: "require_password_change",
          entity: "user",
          entityId: user.id,
          branchId: user.branchId,
          after: { mustChangePassword: true },
        },
      });
      changed += 1;
    }
    return changed;
  });
}

/** No hace nada salvo que estén presentes las dos variables de seguridad. */
export async function forcePasswordChangeAtStartup(
  db: PrismaClient,
  env: NodeJS.ProcessEnv = process.env,
  log: (message: string) => void = console.log,
) {
  const rawUsernames = env.FORCE_PASSWORD_CHANGE_USERNAMES?.trim();
  if (
    !rawUsernames ||
    env.FORCE_PASSWORD_CHANGE_CONFIRM !== PASSWORD_CHANGE_CONFIRMATION
  )
    return 0;

  const changed = await requirePasswordChange(
    db,
    passwordChangeUsernames(rawUsernames),
  );
  log(`${changed} cuenta(s) requieren cambio de contraseña al iniciar.`);
  return changed;
}
