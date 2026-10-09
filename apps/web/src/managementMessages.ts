const GENERIC =
  "No pudimos completar la operación. Revisa los datos y tu conexión e inténtalo de nuevo. Si continúa, pide ayuda a gerencia.";
// Lista NEGRA: la API ya responde en español de negocio («Código no
// encontrado…», «Abre tu caja…», «…se requiere el PIN de un gerente»); sólo
// se oculta lo que parece técnico (SQL, Prisma, trazas, JSON, rutas, red).
const TECHNICAL =
  /prisma|sql|select\s|insert\s|update\s|delete\s|exception|stack|constraint|token|secret|password|\/api\/|[{}<>\r\n]|\bP\d{4}\b|failed to fetch|networkerror|internal server error/i;

/** Lecturas: no mostramos detalles internos del servidor a la persona usuaria. */
export function managementQueryError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401)
    return "Tu sesión terminó. Vuelve a entrar para continuar.";
  if (status === 403)
    return "No tienes acceso a esta información. Pide ayuda a gerencia.";
  if (status && status < 500) return businessErrorMessage(error);
  return "No pudimos cargar la información. Revisa tu conexión y pulsa Reintentar.";
}

/** Conserva los mensajes de negocio; nunca trazas, SQL ni claves internas. */
export function businessErrorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === "string" &&
    message.trim() &&
    message.length <= 300 &&
    !TECHNICAL.test(message)
    ? message
    : GENERIC;
}
