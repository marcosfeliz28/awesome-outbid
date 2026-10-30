export const MERCHANDISE_STEPS = [
  "Tipo de movimiento",
  "Agregar productos",
  "Revisar y confirmar",
] as const;

// Paso actual (1 a 3); 4 cuando el movimiento ya quedó registrado.
export function merchandiseStep({
  lines,
  hasDraft,
  done,
}: {
  lines: number;
  hasDraft: boolean;
  done: boolean;
}): 1 | 2 | 3 | 4 {
  if (done) return 4;
  if (lines > 0 || hasDraft) return 3;
  return 2;
}
