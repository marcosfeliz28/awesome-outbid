import { z } from "zod";

/**
 * The desktop installer owns a single local administrator.  It deliberately
 * has a shorter passphrase range than the hosted product, and is enabled only
 * by its private bootstrap environment flag.
 */
export function bootstrapOwnerPasswordSchema(localInstall: boolean) {
  return localInstall
    ? z.string().min(4).max(20).refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        { message: "La contraseña local debe tener de 4 a 20 caracteres." },
      )
    : z.string().min(12).max(128).refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        { message: "La contraseña debe tener entre 12 y 72 bytes UTF-8." },
      );
}
