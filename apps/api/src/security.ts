import { bad } from "./common";

export function validateSecret(
  secret: string | undefined,
  production: boolean,
) {
  if (!secret || secret.length < 32)
    throw new Error(
      "Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
    );
  if (production) {
    const frequencies = new Map<string, number>();
    for (const char of secret)
      frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
    const entropy = [...frequencies.values()].reduce(
      (sum, n) => sum - (n / secret.length) * Math.log2(n / secret.length),
      0,
    );
    const repeated = Array.from(
      { length: Math.floor(secret.length / 2) },
      (_, i) => i + 1,
    ).some(
      (length) =>
        secret ===
        secret
          .slice(0, length)
          .repeat(Math.ceil(secret.length / length))
          .slice(0, secret.length),
    );
    if (
      repeated ||
      /replace|example|changeme|fitstore|secret-of|password/i.test(secret) ||
      frequencies.size < 12 ||
      entropy < 3.5
    )
      throw new Error(
        "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
      );
  }
  return secret;
}

// El contador pertenece al solicitante, nunca bloquea la cuenta de otro usuario.
// Se serializan comprobación, decisión y actualización; un rechazo se devuelve después del COMMIT.
export const verifyPinAttempt = (
  db: any,
  key: string,
  verify: () => Promise<string | null>,
) =>
  verifyAttempt(db, key, verify, {
    blocked:
      "PIN bloqueado temporalmente para este usuario. Espera 15 minutos.",
    wrong: "PIN incorrecto.",
  });

// Cinco fallos con la misma clave la bloquean 15 minutos. La contraseña usa
// el mismo contador, con su propia clave y mensajes (R9-seguridad-1).
export async function verifyAttempt(
  db: any,
  key: string,
  verify: (tx: any) => Promise<string | null>,
  messages: { blocked: string; wrong: string },
) {
  const result = await db.$transaction(
    async (tx: any) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS locked`;
      const row = await tx.authAttempt.upsert({
        where: { key },
        create: { key },
        update: {},
      });
      if (row.lockedUntil && row.lockedUntil > new Date())
        return { blocked: true };
      if (row.lockedUntil)
        await tx.authAttempt.update({
          where: { key },
          data: { failedAttempts: 0, lockedUntil: null },
        });
      const matched = await verify(tx);
      if (matched) {
        await tx.authAttempt.update({
          where: { key },
          data: { failedAttempts: 0, lockedUntil: null },
        });
        return { matched };
      }
      // lockedUntil se guarda en UTC, como lo lee Prisma, y no en la zona
      // horaria de la sesión.
      await tx.$queryRaw`UPDATE "AuthAttempt" SET "failedAttempts"="failedAttempts"+1,
      "lockedUntil"=CASE WHEN "failedAttempts"+1 >= 5 THEN (NOW() AT TIME ZONE 'UTC')+INTERVAL '15 minutes' ELSE NULL END
      WHERE key=${key} RETURNING "failedAttempts"`;
      return { matched: null };
    },
    { timeout: 20000 },
  );
  if (result.blocked) bad(messages.blocked);
  if (!result.matched) bad(messages.wrong);
  return result.matched as string;
}
