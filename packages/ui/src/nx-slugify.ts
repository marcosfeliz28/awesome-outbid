// Quita acentos (la ñ queda como n) y deja solo a-z, 0-9 separados por guiones.
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
