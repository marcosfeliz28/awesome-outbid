const colador = new Intl.Collator("es");

// Orden estable por clave con locale es; null/undefined van al final en su orden original.
export function ordenarEstable<T>(
  lista: readonly T[],
  clave: (item: T) => string | null | undefined,
): T[] {
  return lista
    .map((item, indice) => ({ item, indice, k: clave(item) }))
    .sort((a, b) => {
      const aNulo = a.k == null;
      const bNulo = b.k == null;
      if (aNulo || bNulo)
        return aNulo === bNulo ? a.indice - b.indice : aNulo ? 1 : -1;
      return (
        colador.compare(a.k as string, b.k as string) || a.indice - b.indice
      );
    })
    .map((x) => x.item);
}
