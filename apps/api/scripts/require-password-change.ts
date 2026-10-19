import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { normalizeUsername } from "../src/auth";

config({ path: "../../.env", quiet: true });
const db = new PrismaClient();

async function main() {
  if (process.env.PASSWORD_CHANGE_CONFIRM !== "ROTATE_TEMPORARY_PASSWORDS")
    throw new Error(
      "Confirma la operación con PASSWORD_CHANGE_CONFIRM=ROTATE_TEMPORARY_PASSWORDS.",
    );
  const usernames = (process.env.PASSWORD_CHANGE_USERNAMES ?? "")
    .split(",")
    .map((value) => normalizeUsername(value))
    .filter(Boolean);
  if (!usernames.length || new Set(usernames).size !== usernames.length)
    throw new Error("Indica una lista no vacía y sin usuarios repetidos.");

  const changedCount = await db.$transaction(async (tx) => {
    const users = await tx.user.findMany({
      where: { usernameKey: { in: usernames }, active: true },
      select: {
        id: true,
        usernameKey: true,
        branchId: true,
        mustChangePassword: true,
      },
    });
    if (users.length !== usernames.length)
      throw new Error(
        "La lista debe coincidir exactamente con cuentas existentes y activas; no se modificó ninguna cuenta.",
      );
    let changed = 0;
    for (const user of users) {
      if (user.mustChangePassword) continue;
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
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
  console.log(
    `${changedCount} cuenta(s) quedaron marcadas para cambiar su contraseña.`,
  );
}

main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Operación fallida.",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
