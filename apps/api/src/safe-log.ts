// Los errores del ORM y de proveedores pueden contener SQL, credenciales o
// datos personales en message, stack, cause y meta. Sólo estos diagnósticos
// de formato cerrado pueden ir a los registros de la aplicación.
export function errorDiagnostic(error: unknown) {
  const value = error as { code?: unknown; name?: unknown } | null;
  const types = new Set([
    "Error",
    "TypeError",
    "RangeError",
    "SyntaxError",
    "PrismaClientKnownRequestError",
    "PrismaClientUnknownRequestError",
    "PrismaClientValidationError",
    "PrismaClientInitializationError",
  ]);
  return {
    type:
      typeof value?.name === "string" && types.has(value.name)
        ? value.name
        : "Error",
    ...(typeof value?.code === "string" && /^P\d{4}$/.test(value.code)
      ? { code: value.code }
      : {}),
  };
}

// Sólo textos completos escritos por validateSecret. Nunca se admite una
// coincidencia parcial ni se registra el valor configurado, stack o causa.
const SAFE_STARTUP_CONFIGURATION_MESSAGES = [
  "Configura JWT_SECRET con al menos 32 caracteres aleatorios.",
  "JWT_SECRET de producción debe ser aleatorio; genera 32 bytes con crypto.randomBytes.",
] as const;

export function logInternalError(
  error: unknown,
  area:
    | "api"
    | "startup"
    | "sales-sync"
    | "reports"
    | "alerts"
    | "credit-reminder"
    | "retention",
  level: "error" | "warn" = "error",
) {
  const configurationMessage =
    area === "startup" && error instanceof Error
      ? SAFE_STARTUP_CONFIGURATION_MESSAGES.find(
          (message) => message === error.message,
        )
      : undefined;
  if (configurationMessage) {
    console[level]("[startup] Configuración inválida.", {
      ...errorDiagnostic(error),
      message: configurationMessage,
    });
    return;
  }
  console[level](`[${area}] Error interno.`, errorDiagnostic(error));
}
