// Solo usa el estado visible de la caja. No consulta el esperado de la cajera
// ni atribuye un descuadre a una causa que el sistema no haya demostrado.
export type CloseIssue = "pending" | "card" | "cash" | "unknown";

export function closeCashAssistant(issue: CloseIssue, pending: number): {
  lines: [string, string, string];
  note: string | null;
} {
  if (pending > 0 || issue === "pending")
    return {
      lines: [
        `Hay ${pending} ventas pendientes de sincronizar en este equipo.`,
        "Sincronízalas y resuelve cualquier conflicto antes de cerrar.",
        "Después vuelve a contar el efectivo y compara el lote de tarjeta.",
      ],
      note: null,
    };
  if (issue === "card")
    return {
      lines: [
        "El total de tarjeta declarado no coincide con el registrado.",
        "Compara el lote cerrado del verifón con tus cobros con tarjeta.",
        "Este aviso no permite saber la causa exacta de la diferencia.",
      ],
      note: "Diferencia de tarjeta pendiente de comprobar con el lote del verifón.",
    };
  if (issue === "cash")
    return {
      lines: [
        "El efectivo contado no cuadra con las operaciones registradas.",
        "Vuelve a contar billetes y monedas y revisa las salidas de caja.",
        "El cierre ciego no permite saber la causa exacta antes de cerrar.",
      ],
      note: "Diferencia de efectivo pendiente de comprobar con el conteo y las salidas de caja.",
    };
  return {
    lines: [
      "Cuenta el efectivo por denominación antes de cerrar.",
      "Compara la tarjeta declarada con el lote del verifón.",
      "Este paso no permite saber la causa de una diferencia todavía.",
    ],
    note: null,
  };
}
