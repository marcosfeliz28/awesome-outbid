// Datos del encabezado de página: un solo h1 y hasta 2 acciones.
export function encabezadoPagina({
  titulo,
  subtitulo,
  acciones = [],
}: {
  titulo: string;
  subtitulo?: string;
  acciones?: string[];
}) {
  if (titulo.trim() === "") throw new Error("El encabezado necesita un título");
  if (acciones.length > 2)
    throw new Error("Un encabezado admite hasta 2 acciones");
  return { h1: titulo, subtitulo: subtitulo ?? null, acciones };
}
