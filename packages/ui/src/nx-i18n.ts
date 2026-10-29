// Traductor sin dependencias: si falta la clave en el diccionario, usa el texto en español.
export function crearTraductor(
  diccionario: Record<string, string>,
  respaldo: Record<string, string>,
): (clave: string) => string {
  return (clave) => diccionario[clave] ?? respaldo[clave] ?? clave;
}
