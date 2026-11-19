export type CashCloseResult<T> =
  | { status: "ready"; cuadre: T }
  | { status: "closed_without_cuadre"; error: unknown };

/**
 * El cierre y la carga de su impreso son dos operaciones distintas. Una vez
 * confirmado el cierre no se vuelve a intentar aunque el cuadre no cargue.
 */
export async function completeCashClose<T>(
  close: () => Promise<unknown>,
  loadCuadre: () => Promise<T>,
): Promise<CashCloseResult<T>> {
  await close();
  try {
    return { status: "ready", cuadre: await loadCuadre() };
  } catch (error) {
    return { status: "closed_without_cuadre", error };
  }
}
