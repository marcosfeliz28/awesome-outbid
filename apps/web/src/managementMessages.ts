/** Lecturas: no mostramos detalles internos del servidor a la persona usuaria. */
export function managementQueryError(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  if (status === 401)
    return "Tu sesión terminó. Vuelve a entrar para continuar.";
  if (status === 403)
    return "No tienes acceso a esta información. Pide ayuda a gerencia.";
  return "No pudimos cargar la información. Revisa tu conexión y pulsa Reintentar.";
}

/** Conserva indicaciones breves de negocio; nunca trazas, SQL ni claves internas. */
export function businessErrorMessage(error: unknown): string {
  const message = (error as { message?: unknown } | null)?.message;
  if (
    typeof message === "string" &&
    message.length <= 240 &&
    /^(Indica|Selecciona|Ingresa|Revisa|Confirma|Debes|El monto|La cantidad|El saldo|No puedes|No hay stock|Stock insuficiente|PIN incorrecto|Ya existe|Falta|El cliente|El proveedor|La fecha|La devolución)\b/.test(
      message,
    ) &&
    !/prisma|sql|select\s|insert\s|update\s|delete\s|exception|stack|constraint|\bat\b|token|secret|password|\/api\/|[{}<>\r\n]|\bP\d{4}\b/i.test(
      message,
    )
  )
    return message;
  return "No pudimos completar la operación. Revisa los datos y tu conexión e inténtalo de nuevo. Si continúa, pide ayuda a gerencia.";
}
