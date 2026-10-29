// Nombre de marca en un solo lugar: cambiar la marca toca solo este archivo.
export const BRAND_NAME = "Norexos";
export const BRAND_SLUG = "norexos";
export const BRAND_DOMAIN = "norexos.ai";

export function tituloPagina(seccion: string): string {
  return `${seccion} · ${BRAND_NAME}`;
}
