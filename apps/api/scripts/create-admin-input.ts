import { z } from "zod";

const bcryptCompatible = (value: string) =>
  Buffer.byteLength(value, "utf8") <= 72;

export function createAdminInputSchema(localInstall = false) {
  return z
    .object({
      email: z.string().email(),
      password: z.string().min(4).max(128).refine(bcryptCompatible),
      pin: z.string().regex(/^\d{6}$/),
      name: z.string().min(2).max(100).optional(),
      mode: z.enum(["bootstrap", "repair"]).default("bootstrap"),
    })
    .superRefine((input, context) => {
      const localBootstrap = localInstall && input.mode === "bootstrap";
      const minimum = localBootstrap ? 4 : 12;
      const maximum = localBootstrap ? 20 : 128;
      if (input.password.length < minimum || input.password.length > maximum) {
        context.addIssue({
          code: "custom",
          path: ["password"],
          message: localBootstrap
            ? "La contraseña debe tener de 4 a 20 caracteres."
            : "La contraseña debe tener al menos 12 caracteres.",
        });
      }
    });
}
