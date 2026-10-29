// Duraciones y curva de movimiento. Ninguna animación pasa de 240 ms.
export const DURACION = { rapida: 120, base: 180, lenta: 240 } as const;

export const CURVA_SALIDA = "cubic-bezier(.2,.8,.2,1)";

export function limitarDuracion(ms: number): number {
  return Math.min(Math.max(ms, 0), DURACION.lenta);
}
