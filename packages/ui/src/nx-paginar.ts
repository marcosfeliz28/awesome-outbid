// Tamaño de página no válido (0, negativo, NaN) = todo en una sola página.
export function paginar<T>(
  lista: T[],
  pagina: number,
  tamano: number,
): { items: T[]; pagina: number; totalPaginas: number } {
  const tamanoOk = Number.isFinite(tamano) && tamano >= 1 ? Math.floor(tamano) : Math.max(lista.length, 1);
  const totalPaginas = Math.max(1, Math.ceil(lista.length / tamanoOk));
  const paginaOk = Number.isFinite(pagina)
    ? Math.min(Math.max(Math.trunc(pagina), 1), totalPaginas)
    : 1;
  const inicio = (paginaOk - 1) * tamanoOk;
  return { items: lista.slice(inicio, inicio + tamanoOk), pagina: paginaOk, totalPaginas };
}
