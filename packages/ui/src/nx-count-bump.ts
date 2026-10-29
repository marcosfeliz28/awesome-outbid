// El contador rebota solo cuando sube (una línea nueva en el carrito).
export function debeRebotar(anterior: number, actual: number): boolean {
  return actual > anterior;
}
