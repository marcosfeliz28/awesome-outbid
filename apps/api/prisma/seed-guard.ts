/** La semilla trae la marca y los usuarios de la tienda de demostración. */
export function assertSeedAllowed(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production")
    throw new Error("No se permiten datos de demostración en producción.");
  if (env.PRODUCT_TENANCY === "required")
    throw new Error(
      "La semilla de demostración no se ejecuta en modo producto (PRODUCT_TENANCY=required): crea las empresas con el alta de empresa.",
    );
}
