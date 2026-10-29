const PUNTOS = "…";

const esAlta = (c: number) => c >= 0xd800 && c <= 0xdbff;

// Corta sin partir palabras ni pares de surrogados; el "…" cuenta dentro del límite.
export function truncar(texto: string, max: number): string {
  if (max <= 0) return "";
  if (texto.length <= max) return texto;
  const espacio = texto.lastIndexOf(" ", max - 1);
  if (espacio > 0) return texto.slice(0, espacio) + PUNTOS;
  let corte = Math.min(max - 1, texto.length);
  if (corte > 0 && esAlta(texto.charCodeAt(corte - 1))) corte--;
  return texto.slice(0, corte) + PUNTOS;
}
