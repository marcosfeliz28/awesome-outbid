type ApiLikeError = { status?: unknown; message?: unknown };

/** El único 409 que la caja puede reenviar como confirmación consciente. */
export function isLargeForeignConfirmationError(
  error: unknown,
): error is ApiLikeError & { status: 409; message: string } {
  if (!error || typeof error !== "object") return false;
  const value = error as ApiLikeError;
  return (
    value.status === 409 &&
    typeof value.message === "string" &&
    value.message.startsWith("Revisa el monto en dólares:")
  );
}

/** Conserva el mismo intento y agrega solo la confirmación (y el PIN si existe). */
export function largeForeignRetryInput<T extends Record<string, unknown>>(
  input: T,
  managerPin: string,
) {
  return {
    ...input,
    confirmLargeForeign: true as const,
    ...(managerPin ? { managerPin } : {}),
  };
}
