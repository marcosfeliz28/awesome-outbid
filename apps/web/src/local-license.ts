/** El servidor local es la única autoridad para firma, pago y reloj. */
export async function requireLocalLicenseWrite(
  enabled: boolean,
  fetcher: typeof fetch = fetch,
) {
  if (!enabled) return;
  let response: Response;
  try {
    response = await fetcher("/api/local-license/status", {
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "No se pudo comprobar la licencia local. No cobres hasta reconectar con el servidor de esta PC.",
    );
  }
  if (!response.ok || (await response.json()).mode !== "write")
    throw new Error(
      "La licencia local está en solo lectura. No se puede cobrar ni agregar ventas a la cola.",
    );
}

type HttpFailure = Error & { status?: number; reason?: string };

export const isLocalLicenseReadOnlyFailure = (failure: unknown) =>
  (failure as HttpFailure | undefined)?.status === 423;

/**
 * Un 423 sin `reason` identifica una captura individual fuera de vigencia.
 * Se divide el lote hasta aislarla; un 423 de licencia global se conserva
 * pendiente para que una renovación posterior pueda reintentarlo.
 */
export async function sendLicenseAwareBatches<T, R>(
  rows: T[],
  send: (rows: T[]) => Promise<R[]>,
): Promise<{ accepted: R[]; rejected: { row: T; message: string }[] }> {
  const accepted: R[] = [];
  const rejected: { row: T; message: string }[] = [];
  const attempt = async (part: T[]): Promise<void> => {
    if (!part.length) return;
    try {
      accepted.push(...(await send(part)));
    } catch (failure) {
      const error = failure as HttpFailure;
      if (error.status !== 423 || error.reason) throw failure;
      if (part.length === 1) {
        rejected.push({ row: part[0], message: error.message });
        return;
      }
      const middle = Math.ceil(part.length / 2);
      await attempt(part.slice(0, middle));
      await attempt(part.slice(middle));
    }
  };
  await attempt(rows);
  return { accepted, rejected };
}
