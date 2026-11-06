// Clase CSS del indicador de estado según el tono. El texto lo pone quien usa el componente.
export type TonoEstado = "exito" | "alerta" | "error" | "neutro";

export function claseTono(tono: TonoEstado): string {
  switch (tono) {
    case "exito":
      return "nx-badge nx-badge--exito";
    case "alerta":
      return "nx-badge nx-badge--alerta";
    case "error":
      return "nx-badge nx-badge--error";
    case "neutro":
      return "nx-badge nx-badge--neutro";
    default:
      throw new Error(`Tono no válido: ${String(tono)}`);
  }
}
