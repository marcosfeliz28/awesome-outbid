// La ñ se protege antes de quitar diacríticos: NFD la separa en n + tilde.
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/ñ/g, "\uE000")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\uE000/g, "ñ");
}
