type DecisionKind = "change-mode" | "register" | "review-conflict";

type DecisionContext = {
  lines?: number;
  direction?: "entry" | "exit";
  units?: number;
  damaged?: number;
  reason?: string;
};

export function merchandiseDecision(
  kind: DecisionKind,
  context: DecisionContext,
) {
  if (kind === "change-mode") {
    const lines = context.lines ?? 0;
    return {
      title: "Cambiar de modo",
      consequence: `Se descartarán ${lines} líneas sin registrar ningún movimiento de inventario.`,
      confirmLabel: "Descartar y cambiar",
    };
  }
  if (kind === "review-conflict") {
    return {
      title: "Revisar operación pendiente",
      consequence:
        "La operación original seguirá en la cola hasta que confirmes la corrección.",
      confirmLabel: "Cargar para corregir",
    };
  }
  const units = context.units ?? 0;
  const damaged = context.damaged ?? 0;
  if (context.direction === "entry") {
    return {
      title: "Confirmar entrada de mercancía",
      consequence: `Se registrarán ${units} unidades en inventario.${damaged ? ` Otras ${damaged} dañadas no entrarán al stock.` : ""}`,
      confirmLabel: "Registrar entrada",
    };
  }
  return {
    title: "Confirmar salida de mercancía",
    consequence: `Se descontarán ${units} unidades del inventario por ${(context.reason ?? "salida").toLowerCase()}.`,
    confirmLabel: "Registrar salida",
  };
}
